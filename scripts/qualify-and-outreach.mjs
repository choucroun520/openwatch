#!/usr/bin/env node
/**
 * OpenWatch Seller Qualification + AI Outreach Generator
 * 
 * Analyzes listings and generates personalized AI negotiation messages.
 * 
 * What it does:
 * 1. Scores each seller (0-100): physical holder vs broker
 * 2. Calculates motivation score: days on market + price drops = desperation index
 * 3. Generates AI outreach message tailored to the seller type + price gap
 * 4. Outputs ready-to-send messages with the most likely to deal sellers first
 * 
 * Usage:
 *   node scripts/qualify-and-outreach.mjs --ref 126610LN --max-price 12000
 *   node scripts/qualify-and-outreach.mjs --ref 5711/1A-011 --max-price 85000 --aggressive
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env
function loadEnv() {
  const envPath = join(__dirname, "..", ".env.local");
  try {
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const [key, ...vals] = line.split("=");
      if (key && vals.length > 0) process.env[key.trim()] = vals.join("=").trim();
    }
  } catch {}
}
loadEnv();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const OPENAI_KEY = process.env.OPENAI_API_KEY || "";

// ── Seller Qualification Engine ───────────────────────────────────────────────

const BROKER_SIGNALS = [
  { pattern: /available to order/i,       score: -35, label: "🚨 'Available to order' = no stock" },
  { pattern: /on request/i,               score: -30, label: "🚨 'On request' = no stock" },
  { pattern: /can source/i,               score: -35, label: "🚨 'Can source' = broker" },
  { pattern: /stock photo/i,              score: -20, label: "⚠️ Stock photo" },
  { pattern: /ships worldwide/i,          score: -10, label: "⚠️ Generic shipping claim" },
  { pattern: /100\+ listings|50\+ watches/i, score: -15, label: "⚠️ High-volume dealer (likely broker)" },
];

const PHYSICAL_SIGNALS = [
  { pattern: /serial.*\d{6,}/,            score: +25, label: "✅ Serial number shown" },
  { pattern: /private seller/i,           score: +20, label: "✅ Private seller" },
  { pattern: /box.*papers|papers.*box/i,  score: +15, label: "✅ Box & papers confirmed" },
  { pattern: /original receipt/i,         score: +20, label: "✅ Original receipt" },
  { pattern: /video.*available/i,         score: +15, label: "✅ Video available" },
  { pattern: /can ship.*insured/i,        score: +10, label: "✅ Insured shipping" },
  { pattern: /\d{4}\s*purchase/i,         score: +10, label: "✅ Purchase year mentioned" },
];

function qualifySeller(listing) {
  const text = [
    listing.raw_title || "",
    listing.description || "",
    listing.dealer_name || "",
  ].join(" ").toLowerCase();

  let score = 50;
  const signals = [];

  for (const s of BROKER_SIGNALS) {
    if (s.pattern.test(text)) {
      score += s.score;
      signals.push(s.label);
    }
  }
  for (const s of PHYSICAL_SIGNALS) {
    if (s.pattern.test(text)) {
      score += s.score;
      signals.push(s.label);
    }
  }

  // Listing count signal (if dealer has many listings = broker)
  if (listing.dealer_listing_count > 100) {
    score -= 20;
    signals.push(`⚠️ Dealer has ${listing.dealer_listing_count}+ listings`);
  } else if (listing.dealer_listing_count > 20) {
    score -= 10;
    signals.push(`⚠️ Dealer has ${listing.dealer_listing_count} listings`);
  } else if (listing.dealer_listing_count && listing.dealer_listing_count <= 5) {
    score += 15;
    signals.push(`✅ Small seller (${listing.dealer_listing_count} listings)`);
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    signals,
    verdict: score >= 70 ? "LIKELY PHYSICAL" : score >= 40 ? "UNCERTAIN" : "LIKELY BROKER",
  };
}

// ── Motivation Score (Days on Market + Price Drops) ───────────────────────────

function motivationScore(listing) {
  let score = 0;
  const signals = [];

  const scraped = new Date(listing.scraped_at || listing.created_at || Date.now());
  const daysOld = Math.floor((Date.now() - scraped.getTime()) / 86400000);

  if (daysOld > 90) {
    score += 40;
    signals.push(`🕐 Listed ${daysOld} days ago (very motivated)`);
  } else if (daysOld > 30) {
    score += 25;
    signals.push(`🕐 Listed ${daysOld} days ago (moderately motivated)`);
  } else if (daysOld > 14) {
    score += 15;
    signals.push(`🕐 Listed ${daysOld} days ago`);
  }

  if (listing.price_drops > 0) {
    score += listing.price_drops * 15;
    signals.push(`📉 Price dropped ${listing.price_drops} time(s) = seller is flexible`);
  }

  return { score: Math.min(100, score), signals, daysOld };
}

// ── Opening Offer Calculator ──────────────────────────────────────────────────

function calculateOffer(askingPrice, motivation, qualification, maxPrice) {
  // Base discount: 8% off asking
  let discountPct = 0.08;

  // More aggressive if seller is motivated
  if (motivation.score > 60) discountPct += 0.05;
  if (motivation.score > 80) discountPct += 0.05;

  // If listing has price drops, they're flexible
  if (motivation.signals.some(s => s.includes("Price dropped"))) discountPct += 0.04;

  // Less aggressive on physical holders (they know their worth)
  if (qualification.verdict === "LIKELY PHYSICAL") discountPct -= 0.02;

  const openingOffer = Math.round(askingPrice * (1 - discountPct));
  
  return {
    openingOffer: Math.min(openingOffer, maxPrice || Infinity),
    discountPct: Math.round(discountPct * 100),
    canAfford: !maxPrice || openingOffer <= maxPrice,
  };
}

// ── AI Message Generator ──────────────────────────────────────────────────────

async function generateOutreachMessage(listing, qualification, motivation, offer, style = "professional") {
  if (!OPENAI_KEY) {
    // Fallback template if no API key
    return generateTemplateMessage(listing, qualification, motivation, offer, style);
  }

  const context = {
    ref: listing.ref_number,
    asking: listing.price,
    currency: listing.currency || "USD",
    market: listing.market_code || "US",
    days_listed: motivation.daysOld,
    seller_type: qualification.verdict,
    opening_offer: offer.openingOffer,
    discount: offer.discountPct,
    has_price_drops: motivation.signals.some(s => s.includes("Price dropped")),
  };

  const systemPrompt = `You are a professional luxury watch dealer/buyer. You're writing a message to a seller on Chrono24 about purchasing their watch. 
Your goal: negotiate the best price, verify they physically have the watch, and determine if they're a serious seller.
Style: ${style === "aggressive" ? "Direct, confident, mention you're a serious buyer ready to pay cash quickly" : "Professional, respectful, mention you're an experienced collector/dealer"}
Keep messages SHORT — 3-4 sentences max. No fluff.`;

  const userPrompt = `Generate an opening message for this situation:
- Watch: ${context.ref}
- Their asking price: ${context.currency} ${context.asking?.toLocaleString()}
- My opening offer: USD ${offer.openingOffer.toLocaleString()} (${offer.discountPct}% below asking)
- They've had it listed ${context.days_listed} days${context.has_price_drops ? " and already dropped the price" : ""}
- Seller verdict: ${context.seller_type}

The message should:
1. Show genuine interest in their specific watch
2. Subtly verify they physically have the watch ("is the watch with you currently?")
3. State my offer clearly
4. Ask about timeline/urgency (signals motivation)
5. Sound like a real person, not an automated message

Do NOT mention their listing number or platform. Write as if you saw their watch somewhere.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 300,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || generateTemplateMessage(listing, qualification, motivation, offer, style);
  } catch {
    return generateTemplateMessage(listing, qualification, motivation, offer, style);
  }
}

function generateTemplateMessage(listing, qualification, motivation, offer, style) {
  const ref = listing.ref_number;
  const asking = listing.price;
  const offerAmt = offer.openingOffer;
  const dayLine = motivation.daysOld > 30 ? ` I noticed it's been available for a while.` : "";
  
  if (style === "aggressive") {
    return `Hi, I'm a professional watch dealer actively looking for the ${ref}. I can wire payment same day.${dayLine} I'm prepared to offer $${offerAmt.toLocaleString()} — is the watch physically with you and ready to ship? Let me know if you're open to discussing.`;
  }
  
  return `Hello, I came across your ${ref} and I'm very interested. I'm a serious collector and I've been looking for one in good condition.${dayLine} Would you consider $${offerAmt.toLocaleString()}? I can move quickly if the watch is as described. Is it currently with you?`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const refIdx = args.indexOf("--ref");
  const maxPriceIdx = args.indexOf("--max-price");
  const aggressive = args.includes("--aggressive");

  const ref = refIdx >= 0 ? args[refIdx + 1] : null;
  const maxPrice = maxPriceIdx >= 0 ? parseInt(args[maxPriceIdx + 1]) : null;

  if (!ref) {
    console.log("Usage: node scripts/qualify-and-outreach.mjs --ref <ref_number> [--max-price <usd>] [--aggressive]");
    process.exit(1);
  }

  console.log(`\n🎯 OpenWatch — Seller Intelligence Report`);
  console.log(`   Ref: ${ref}${maxPrice ? ` | Max budget: $${maxPrice.toLocaleString()}` : ""}`);
  console.log(`   Style: ${aggressive ? "Aggressive" : "Professional"}`);
  console.log("─".repeat(60));

  // Fetch listings from market_comps
  const { data: listings, error } = await sb
    .from("market_comps")
    .select("*")
    .eq("ref_number", ref)
    .order("price", { ascending: true })
    .limit(50);

  if (error || !listings?.length) {
    console.log(`\n  No listings found for ${ref} in market_comps.`);
    console.log(`  Run: python3 scripts/scrape-global-markets.py --ref ${ref}`);
    process.exit(0);
  }

  console.log(`\n  Found ${listings.length} listings across ${new Set(listings.map(l => l.market_code || l.source)).size} markets`);

  // Score and rank all listings
  const scored = listings.map(listing => {
    const qual = qualifySeller(listing);
    const motiv = motivationScore(listing);
    const offer = calculateOffer(listing.price, motiv, qual, maxPrice);
    
    // Combined priority score: quality + motivation + affordability
    const priority = (
      qual.score * 0.4 +
      motiv.score * 0.3 +
      (offer.canAfford ? 30 : 0)
    );

    return { listing, qual, motiv, offer, priority };
  }).sort((a, b) => b.priority - a.priority);

  // Print top 5 opportunities
  console.log(`\n  TOP TARGETS (ranked by deal probability):\n`);

  for (const [i, item] of scored.slice(0, 5).entries()) {
    const { listing, qual, motiv, offer } = item;
    const flag = {
      US: "🇺🇸", DE: "🇩🇪", FR: "🇫🇷", UK: "🇬🇧",
      JP: "🇯🇵", HK: "🇭🇰", SG: "🇸🇬", CH: "🇨🇭", AE: "🇦🇪",
    }[listing.market_code] || "🌐";

    console.log(`  ${i + 1}. ${flag} ${listing.currency} ${listing.price?.toLocaleString()} (≈ $${listing.price?.toLocaleString()} USD)`);
    console.log(`     Seller: ${qual.verdict} (${qual.score}/100)`);
    if (qual.signals.length) console.log(`     Signals: ${qual.signals.join(", ")}`);
    console.log(`     Motivation: ${motiv.score}/100 — ${motiv.daysOld} days listed`);
    if (motiv.signals.length) console.log(`     ${motiv.signals.join(", ")}`);
    console.log(`     Opening offer: $${offer.openingOffer.toLocaleString()} (${offer.discountPct}% off)`);
    if (listing.listing_url) console.log(`     URL: ${listing.listing_url}`);

    if (offer.canAfford || !maxPrice) {
      console.log(`\n     📩 OUTREACH MESSAGE:`);
      const msg = await generateOutreachMessage(listing, qual, motiv, offer, aggressive ? "aggressive" : "professional");
      console.log(`     ─────────────────────────────────────────`);
      console.log(msg.split("\n").map(l => `     ${l}`).join("\n"));
      console.log(`     ─────────────────────────────────────────`);
    } else {
      console.log(`     ❌ Over budget (asking > $${maxPrice.toLocaleString()})`);
    }
    console.log();
  }

  // Market summary
  const byMarket = {};
  for (const l of listings) {
    const key = l.market_code || l.source || "unknown";
    if (!byMarket[key]) byMarket[key] = [];
    byMarket[key].push(l.price);
  }
  
  console.log("─".repeat(60));
  console.log("  MARKET PRICE SUMMARY:");
  for (const [market, prices] of Object.entries(byMarket).sort((a, b) => Math.min(...a[1]) - Math.min(...b[1]))) {
    const floor = Math.min(...prices);
    const avg = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
    console.log(`    ${market}: floor $${floor.toLocaleString()}  avg $${avg.toLocaleString()}  (${prices.length} listings)`);
  }
}

main().catch(console.error);
