// scripts/snapshot-prices.mjs
// Takes a daily snapshot of per-ref market stats from market_data.
// Builds the historical chart data over time.
// Run daily via Vercel cron (midnight UTC), or manually: node scripts/snapshot-prices.mjs

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('\n📸 Price Snapshot — market_data → price_snapshots_v2');

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Fetch current asking price stats per ref
  const { data: askingStats, error: askErr } = await sb
    .from('ref_market_stats')
    .select('ref_number, brand, model, total_listings, floor_price, avg_price, ceiling_price');

  if (askErr) {
    console.error('Error fetching ref_market_stats:', askErr.message);
    process.exit(1);
  }

  // Fetch current sold stats per ref
  const { data: soldStats, error: soldErr } = await sb
    .from('ref_sold_stats')
    .select('ref_number, brand, total_sold');

  if (soldErr) {
    console.error('Error fetching ref_sold_stats:', soldErr.message);
    process.exit(1);
  }

  const soldMap = new Map(
    (soldStats ?? []).map(s => [`${s.ref_number}::${s.brand}`, s.total_sold])
  );

  const rows = (askingStats ?? []).map(s => ({
    ref_number: s.ref_number,
    brand: s.brand,
    snapshot_date: today,
    floor_price: s.floor_price ? parseFloat(s.floor_price) : null,
    avg_price: s.avg_price ? parseFloat(s.avg_price) : null,
    ceiling_price: s.ceiling_price ? parseFloat(s.ceiling_price) : null,
    listing_count: s.total_listings,
    sold_count: soldMap.get(`${s.ref_number}::${s.brand}`) ?? 0,
    source: 'all',
  }));

  console.log(`Snapshotting ${rows.length} refs for ${today}`);

  const BATCH = 200;
  let upserted = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await sb
      .from('price_snapshots_v2')
      .upsert(batch, { onConflict: 'ref_number,snapshot_date,source', ignoreDuplicates: false });

    if (error) {
      console.error(`  Batch error at ${i}:`, error.message);
    } else {
      upserted += batch.length;
      console.log(`  ${Math.min(i + BATCH, rows.length)} / ${rows.length}`);
    }
  }

  console.log(`\n✅ Done! Upserted ${upserted} snapshots for ${today}`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
