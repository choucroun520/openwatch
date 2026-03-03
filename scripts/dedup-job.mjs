#!/usr/bin/env node
/**
 * OpenWatch Deduplication Job
 *
 * Runs after each scrape batch to detect and link duplicate listings.
 * A "duplicate" is when the same physical watch appears on multiple
 * platforms or is re-listed by the same seller.
 *
 * Tier 1B  — same serial_number + ref_number              (confidence 1.0)
 * Tier 2A  — same dealer + same ref + price within 3%     (confidence 0.9)
 * Tier 2B  — same platform re-post within 48h             (confidence 0.9)
 * Tier 3A  — fuzzy seller name + same ref + price <5%     (confidence 0.7)
 * Tier 3B  — same ref/condition/year/market, price <5%    (confidence 0.7)
 * Tier 4B  — loose combination of signals                 (confidence 0.5)
 *
 * Usage:
 *   node scripts/dedup-job.mjs
 *   node scripts/dedup-job.mjs --dry-run    (print findings, no writes)
 *   node scripts/dedup-job.mjs --batch 500  (process up to N rows per run)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Env loading ────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = join(__dirname, "..", ".env.local");
  if (!existsSync(envPath)) return;
  try {
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (key && !process.env[key]) process.env[key] = val;
    }
  } catch (e) {
    console.warn("Could not load .env.local:", e.message);
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── CLI args ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const BATCH_IDX = args.indexOf("--batch");
const BATCH_SIZE = BATCH_IDX >= 0 ? parseInt(args[BATCH_IDX + 1], 10) : 1000;
const VERBOSE = args.includes("--verbose");

// ── Trust weight (mirrors Section 4 of ARCHITECTURE.md) ───────────────────────

function computeTrustWeight(source, eventType, sellerScore) {
  // Tier 1 — confirmed sales
  const auctionHouses = ["phillips", "christies", "sothebys"];
  if (auctionHouses.includes(source)) return 1.0;
  if (source === "ebay_sold") return 0.9;
  if (source === "watchcharts") return 0.85;
  if (source === "reddit_watchexchange" && eventType === "sold") return 0.8;

  // Tier 2 — reputable dealers
  if (source === "rccrown") return 0.9;
  if (source === "watchbox" || source === "bobs_watches") return 0.85;

  // Tier 5 — broker exclusions (check before tier 3/4)
  if (sellerScore !== null && sellerScore !== undefined && sellerScore < 40) return 0.0;

  // Tier 3 — marketplace physical holders
  if (sellerScore !== null && sellerScore > 70) return 0.7;
  if (source === "yahoo_japan") return 0.65;

  // Tier 4 — marketplace uncertain
  if (sellerScore !== null && sellerScore >= 40 && sellerScore <= 70) return 0.5;

  return 0.5;
}

// ── Levenshtein distance (simple implementation for short strings) ─────────────

function levenshtein(a, b) {
  if (!a) return b ? b.length : 0;
  if (!b) return a.length;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

function nameSimilarity(a, b) {
  if (!a || !b) return 0;
  const la = a.toLowerCase().trim();
  const lb = b.toLowerCase().trim();
  if (la === lb) return 1.0;
  const maxLen = Math.max(la.length, lb.length);
  if (maxLen === 0) return 1.0;
  return 1 - levenshtein(la, lb) / maxLen;
}

// ── Pick canonical record from two candidates ─────────────────────────────────

function pickCanonical(rowA, rowB) {
  // Prefer confirmed sales over asking prices
  const salesTypes = new Set(["sold", "auction_hammer"]);
  if (salesTypes.has(rowA.event_type) && !salesTypes.has(rowB.event_type)) return rowA;
  if (!salesTypes.has(rowA.event_type) && salesTypes.has(rowB.event_type)) return rowB;

  // Higher trust_weight wins
  const twA = rowA.trust_weight ?? 0.5;
  const twB = rowB.trust_weight ?? 0.5;
  if (twA > twB) return rowA;
  if (twB > twA) return rowB;

  // Older first_seen_at wins (original post)
  const dateA = new Date(rowA.first_seen_at);
  const dateB = new Date(rowB.first_seen_at);
  return dateA <= dateB ? rowA : rowB;
}

// ── Stats tracking ─────────────────────────────────────────────────────────────

const stats = {
  processed: 0,
  already_canonical: 0,
  tier1b_serial: 0,
  tier2a_dealer_cross: 0,
  tier2b_repost: 0,
  tier3a_fuzzy_seller: 0,
  tier3b_same_market: 0,
  tier4b_loose: 0,
  marked_canonical: 0,
  errors: 0,
};

// ── Resolve a duplicate pair ───────────────────────────────────────────────────

async function resolveGroup(rowA, rowB, confidence, method) {
  const canonical = pickCanonical(rowA, rowB);
  const duplicate = canonical.id === rowA.id ? rowB : rowA;

  if (VERBOSE) {
    console.log(
      `  [${method}] ${duplicate.source}:${duplicate.ref_number} → canonical ${canonical.source}:${canonical.id.slice(0, 8)} (conf: ${confidence})`
    );
  }

  if (DRY_RUN) return;

  const now = new Date().toISOString();

  // Mark canonical
  const { error: e1 } = await sb
    .from("watch_market_events")
    .update({ is_canonical: true, updated_at: now })
    .eq("id", canonical.id)
    .is("is_canonical", null);

  if (e1 && e1.code !== "23505") {
    // Ignore "already set" conflicts
    if (VERBOSE) console.warn(`    Warn (canonical update): ${e1.message}`);
  }

  // Mark duplicate
  const { error: e2 } = await sb
    .from("watch_market_events")
    .update({
      canonical_id: canonical.id,
      is_canonical: false,
      dedup_confidence: confidence,
      dedup_method: method,
      updated_at: now,
    })
    .eq("id", duplicate.id);

  if (e2) {
    console.warn(`    ⚠️  Failed to mark duplicate ${duplicate.id}: ${e2.message}`);
    stats.errors++;
  }
}

// ── Main dedup logic for a single row ─────────────────────────────────────────

async function processRow(row, allCandidatesByRef) {
  stats.processed++;
  const candidates = (allCandidatesByRef.get(row.ref_number) || [])
    .filter((c) => c.id !== row.id);

  // ── Tier 1B: Serial number match ────────────────────────────────────────────
  if (row.serial_number) {
    const serialMatch = candidates.find(
      (c) => c.serial_number && c.serial_number === row.serial_number
    );
    if (serialMatch) {
      await resolveGroup(row, serialMatch, 1.0, "tier1b_serial");
      stats.tier1b_serial++;
      return "tier1b_serial";
    }
  }

  // ── Tier 2A: Same dealer platform ID, same ref, price within 3%, diff source ─
  if (row.seller_platform_id) {
    const dealerCross = candidates.find((c) => {
      if (!c.seller_platform_id) return false;
      if (c.seller_platform_id !== row.seller_platform_id) return false;
      if (c.source === row.source) return false; // must be different platforms
      if (!c.price_usd || !row.price_usd) return false;
      const priceDiff = Math.abs(c.price_usd - row.price_usd) / row.price_usd;
      return priceDiff < 0.03;
    });
    if (dealerCross) {
      await resolveGroup(row, dealerCross, 0.9, "tier2a_dealer_cross_platform");
      stats.tier2a_dealer_cross++;
      return "tier2a";
    }
  }

  // ── Tier 2B: Same platform re-post (same source, price within 1%, same condition, 48h) ─
  const repost = candidates.find((c) => {
    if (c.source !== row.source) return false;
    if (c.condition !== row.condition) return false;
    if (!c.price_usd || !row.price_usd) return false;
    const priceDiff = Math.abs(c.price_usd - row.price_usd) / row.price_usd;
    if (priceDiff >= 0.01) return false;
    const timeDiff = Math.abs(
      new Date(c.first_seen_at).getTime() - new Date(row.first_seen_at).getTime()
    );
    return timeDiff < 48 * 3600 * 1000; // 48 hours
  });
  if (repost) {
    await resolveGroup(row, repost, 0.9, "tier2b_repost");
    stats.tier2b_repost++;
    return "tier2b";
  }

  // ── Tier 3A: Fuzzy seller name, same ref, price within 5%, diff source ───────
  if (row.seller_name) {
    const fuzzySeller = candidates.find((c) => {
      if (!c.seller_name) return false;
      if (c.source === row.source) return false;
      const sim = nameSimilarity(row.seller_name, c.seller_name);
      if (sim < 0.7) return false;
      if (!c.price_usd || !row.price_usd) return false;
      const priceDiff = Math.abs(c.price_usd - row.price_usd) / row.price_usd;
      return priceDiff < 0.05;
    });
    if (fuzzySeller) {
      await resolveGroup(row, fuzzySeller, 0.7, "tier3a_fuzzy_seller");
      stats.tier3a_fuzzy_seller++;
      return "tier3a";
    }
  }

  // ── Tier 3B: Same ref/condition/year/market, price within 5%, within 14 days ─
  const sameMarketWatch = candidates.find((c) => {
    if (c.market_code !== row.market_code || !row.market_code) return false;
    if (c.condition !== row.condition || !row.condition) return false;
    if (c.year_made !== row.year_made || !row.year_made) return false;
    if (!c.price_usd || !row.price_usd) return false;
    const priceDiff = Math.abs(c.price_usd - row.price_usd) / row.price_usd;
    if (priceDiff >= 0.05) return false;
    // Only match private/dealer sellers, not auction houses
    if (row.seller_type === "auction_house" || c.seller_type === "auction_house") return false;
    const timeDiff = Math.abs(
      new Date(c.first_seen_at).getTime() - new Date(row.first_seen_at).getTime()
    );
    return timeDiff < 14 * 24 * 3600 * 1000; // 14 days
  });
  if (sameMarketWatch) {
    await resolveGroup(row, sameMarketWatch, 0.7, "tier3b_same_market_watch");
    stats.tier3b_same_market++;
    return "tier3b";
  }

  // ── Tier 4B: Loose combination ────────────────────────────────────────────────
  // Same ref, price within 5%, same box/papers, same market, within 7 days
  const loosMatch = candidates.find((c) => {
    if (!c.price_usd || !row.price_usd) return false;
    const priceDiff = Math.abs(c.price_usd - row.price_usd) / row.price_usd;
    if (priceDiff >= 0.05) return false;
    // At least 2 of: same market, same box status, same papers status, same condition
    let signals = 0;
    if (row.market_code && c.market_code === row.market_code) signals++;
    if (row.has_box !== null && c.has_box === row.has_box) signals++;
    if (row.has_papers !== null && c.has_papers === row.has_papers) signals++;
    if (row.condition && c.condition === row.condition) signals++;
    if (signals < 2) return false;
    const timeDiff = Math.abs(
      new Date(c.first_seen_at).getTime() - new Date(row.first_seen_at).getTime()
    );
    return timeDiff < 7 * 24 * 3600 * 1000; // 7 days
  });
  if (loosMatch) {
    await resolveGroup(row, loosMatch, 0.5, "tier4b_loose");
    stats.tier4b_loose++;
    return "tier4b";
  }

  // ── No duplicate found — mark as canonical ────────────────────────────────────
  if (!DRY_RUN) {
    const { error } = await sb
      .from("watch_market_events")
      .update({ is_canonical: true, updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("is_canonical", null); // only update if still unprocessed
    if (error && VERBOSE) console.warn(`    Warn (mark canonical): ${error.message}`);
  }
  stats.marked_canonical++;
  return "canonical";
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🔍 OpenWatch Dedup Job");
  console.log(`   Batch size: ${BATCH_SIZE} | Dry run: ${DRY_RUN}`);
  console.log("─".repeat(60));

  // ── 1. Check table exists ─────────────────────────────────────────────────────
  const { error: tableCheckErr } = await sb
    .from("watch_market_events")
    .select("id")
    .limit(1);

  if (tableCheckErr) {
    if (tableCheckErr.message.includes("does not exist") ||
        tableCheckErr.code === "42P01") {
      console.log("⚠️  Table watch_market_events does not exist yet.");
      console.log("   Run scripts/setup-unified-schema.sql in Supabase first.");
      console.log("   Exiting gracefully.");
      process.exit(0);
    }
    console.error("❌ Unexpected DB error:", tableCheckErr.message);
    process.exit(1);
  }

  // ── 2. Count unprocessed rows ─────────────────────────────────────────────────
  const { count: totalUnprocessed, error: countErr } = await sb
    .from("watch_market_events")
    .select("*", { count: "exact", head: true })
    .is("canonical_id", null)
    .is("is_canonical", null);

  if (countErr) {
    console.error("❌ Error counting rows:", countErr.message);
    process.exit(1);
  }

  console.log(`   Unprocessed rows: ${totalUnprocessed ?? "unknown"}`);

  if (totalUnprocessed === 0) {
    console.log("\n✅ Nothing to process — all rows already deduplicated.");
    return;
  }

  // ── 3. Fetch unprocessed rows ─────────────────────────────────────────────────
  const { data: unprocessed, error: fetchErr } = await sb
    .from("watch_market_events")
    .select(
      "id, event_type, source, ref_number, brand, price_usd, price_local, currency_local, " +
      "market_code, condition, has_box, has_papers, year_made, " +
      "seller_type, seller_platform_id, seller_name, " +
      "serial_number, trust_weight, is_canonical, canonical_id, " +
      "first_seen_at"
    )
    .is("canonical_id", null)
    .is("is_canonical", null)
    .order("first_seen_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchErr) {
    console.error("❌ Error fetching unprocessed rows:", fetchErr.message);
    process.exit(1);
  }

  if (!unprocessed || unprocessed.length === 0) {
    console.log("\n✅ No unprocessed rows found.");
    return;
  }

  console.log(`   Processing ${unprocessed.length} rows in this batch...\n`);

  // ── 4. Collect unique ref numbers from this batch ─────────────────────────────
  const refsInBatch = [...new Set(unprocessed.map((r) => r.ref_number))];

  // ── 5. Fetch ALL canonical/unprocessed rows for these refs (as comparison pool) ─
  // We need to compare against both already-canonical rows AND other unprocessed rows
  const { data: pool, error: poolErr } = await sb
    .from("watch_market_events")
    .select(
      "id, event_type, source, ref_number, brand, price_usd, price_local, currency_local, " +
      "market_code, condition, has_box, has_papers, year_made, " +
      "seller_type, seller_platform_id, seller_name, " +
      "serial_number, trust_weight, is_canonical, canonical_id, " +
      "first_seen_at"
    )
    .in("ref_number", refsInBatch)
    // Include: canonical records AND unprocessed records (but NOT confirmed duplicates)
    .or("is_canonical.eq.true,is_canonical.is.null")
    .is("canonical_id", null);

  if (poolErr) {
    console.error("❌ Error fetching comparison pool:", poolErr.message);
    process.exit(1);
  }

  // Index pool by ref_number
  const poolByRef = new Map();
  for (const row of pool || []) {
    if (!poolByRef.has(row.ref_number)) poolByRef.set(row.ref_number, []);
    poolByRef.get(row.ref_number).push(row);
  }

  // ── 6. Process each unprocessed row ───────────────────────────────────────────
  for (const row of unprocessed) {
    // Skip if this row was already resolved by a previous iteration in this batch
    // (it might appear in both unprocessed and pool)
    await processRow(row, poolByRef);
  }

  // ── 7. Summary ────────────────────────────────────────────────────────────────
  const totalDuplicates =
    stats.tier1b_serial +
    stats.tier2a_dealer_cross +
    stats.tier2b_repost +
    stats.tier3a_fuzzy_seller +
    stats.tier3b_same_market +
    stats.tier4b_loose;

  const totalGroups = totalDuplicates; // each resolution = 1 pair resolved

  console.log("\n" + "─".repeat(60));
  console.log("📊 DEDUP SUMMARY");
  console.log("─".repeat(60));
  console.log(`  Rows processed:          ${stats.processed}`);
  console.log(`  Marked canonical:        ${stats.marked_canonical}`);
  console.log(`  Total duplicates found:  ${totalDuplicates}`);
  console.log(`    Tier 1B (serial):      ${stats.tier1b_serial}`);
  console.log(`    Tier 2A (dealer/cross):${stats.tier2a_dealer_cross}`);
  console.log(`    Tier 2B (repost):      ${stats.tier2b_repost}`);
  console.log(`    Tier 3A (fuzzy seller):${stats.tier3a_fuzzy_seller}`);
  console.log(`    Tier 3B (same market): ${stats.tier3b_same_market}`);
  console.log(`    Tier 4B (loose):       ${stats.tier4b_loose}`);
  console.log(`  Errors:                  ${stats.errors}`);
  if (DRY_RUN) {
    console.log("\n  ⚠️  DRY RUN — no changes written to DB");
  }

  if (totalUnprocessed > BATCH_SIZE) {
    const remaining = totalUnprocessed - stats.processed;
    console.log(`\n  ⏭️  ${remaining} rows remaining — run again to process next batch`);
  } else {
    console.log("\n✅ All unprocessed rows handled.");
  }
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
