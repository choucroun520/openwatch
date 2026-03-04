// scripts/seed-price-history.mjs
// Reads market_comps, computes per-ref price stats, upserts into price_history table.
// Creates price_history table if it doesn't exist.
// Run: node scripts/seed-price-history.mjs

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function percentile(sortedArr, pct) {
  if (sortedArr.length === 0) return null;
  const idx = Math.ceil((pct / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, Math.min(idx, sortedArr.length - 1))];
}

async function ensureTable() {
  // Create price_history table if it doesn't exist
  const { error } = await sb.rpc('exec_sql', {
    sql: `
      create table if not exists price_history (
        id uuid default gen_random_uuid() primary key,
        ref_number text not null,
        brand text not null,
        model_name text,
        avg_price numeric,
        floor_price numeric,
        ceiling_price numeric,
        listing_count integer default 0,
        sold_count integer default 0,
        snapshot_date date not null,
        source text not null default 'chrono24',
        created_at timestamptz default now(),
        unique(ref_number, snapshot_date, source)
      );
    `
  });

  if (error) {
    // rpc might not exist — try direct query instead
    console.log('Note: Could not run exec_sql RPC, table may already exist or will be created on first upsert.');
  }
}

async function main() {
  console.log('\n📊 Seeding price_history from market_comps...');

  await ensureTable();

  const today = new Date().toISOString().slice(0, 10);

  // Fetch all market_comps rows (uses reference_number, brand_name columns)
  const { data: comps, error: compsErr } = await sb
    .from('market_comps')
    .select('reference_number, brand_name, price, currency, source, scraped_at')
    .gt('price', 0)
    .limit(10000);

  if (compsErr) {
    console.error('Error fetching market_comps:', compsErr.message);
    process.exit(1);
  }

  const rows = comps ?? [];
  console.log(`  Found ${rows.length} market_comps rows`);

  if (rows.length === 0) {
    console.log('  No data to seed.');
    process.exit(0);
  }

  // Group by (reference_number, brand_name, source)
  const groups = new Map();
  for (const row of rows) {
    const ref = row.reference_number;
    const brand = row.brand_name ?? 'Unknown';
    const src = row.source ?? 'chrono24';
    if (!ref) continue;
    const key = `${ref}::${brand}::${src}`;
    if (!groups.has(key)) {
      groups.set(key, {
        ref_number: ref,
        brand: brand,
        model_name: null,
        source: src,
        prices: [],
      });
    }
    const price = parseFloat(row.price);
    if (!isNaN(price) && price > 0) {
      groups.get(key).prices.push(price);
    }
  }

  console.log(`  Grouped into ${groups.size} (ref, brand, source) combinations`);

  // Compute stats and build upsert rows
  const upsertRows = [];
  for (const [, group] of groups) {
    const sorted = [...group.prices].sort((a, b) => a - b);
    if (sorted.length === 0) continue;

    const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length;
    const floor = percentile(sorted, 5);   // 5th percentile
    const ceiling = percentile(sorted, 95); // 95th percentile

    upsertRows.push({
      ref_number: group.ref_number,
      brand: group.brand,
      source: group.source,
      market_code: 'US',
      price_usd: Math.round(avg),
      avg_price_usd: Math.round(avg),
      floor_price_usd: Math.round(floor),
      ceiling_price_usd: Math.round(ceiling),
      listing_count: sorted.length,
      snapshot_date: today,
    });
  }

  console.log(`  Upserting ${upsertRows.length} rows into price_history...`);

  // Upsert in batches of 200
  const BATCH = 200;
  let upserted = 0;
  let errors = 0;

  for (let i = 0; i < upsertRows.length; i += BATCH) {
    const batch = upsertRows.slice(i, i + BATCH);
    const { error } = await sb
      .from('price_history')
      .upsert(batch, { onConflict: 'ref_number,snapshot_date,source,market_code', ignoreDuplicates: false });

    if (error) {
      console.error(`  Batch ${i}-${i + BATCH} error:`, error.message);
      errors++;
    } else {
      upserted += batch.length;
      console.log(`  ${Math.min(i + BATCH, upsertRows.length)} / ${upsertRows.length}`);
    }
  }

  console.log(`\n✅ Done! Upserted ${upserted} rows into price_history for ${today}`);
  if (errors > 0) console.log(`  ⚠️  ${errors} batch(es) had errors`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
