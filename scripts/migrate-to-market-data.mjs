// scripts/migrate-to-market-data.mjs
// Migrates existing market_comps data into the unified market_data table.
// Run once: node scripts/migrate-to-market-data.mjs

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_BRANDS = [
  'rolex', 'richard mille', 'patek', 'vacheron', 'f.p. journe', 'fp journe', 'audemars'
];

function brandAllowed(brandName) {
  if (!brandName) return false;
  const lower = brandName.toLowerCase();
  return ALLOWED_BRANDS.some(b => lower.includes(b));
}

async function main() {
  console.log('\n📦 Migrate market_comps → market_data');

  // Fetch all market_comps
  const { data: comps, error } = await sb
    .from('market_comps')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching market_comps:', error.message);
    process.exit(1);
  }

  console.log(`Total market_comps: ${comps.length}`);

  const filtered = comps
    .filter(c => c.price > 1000)
    .filter(c => brandAllowed(c.brand_name));

  console.log(`After brand + price filter: ${filtered.length}`);

  const rows = filtered.map(c => ({
    ref_number: c.reference_number,
    brand: c.brand_name || 'Unknown',
    model: null,
    price: parseFloat(c.price),
    currency: c.currency || 'USD',
    is_sold: c.source === 'ebay',
    condition: c.condition || null,
    has_box: c.has_box ?? null,
    has_papers: c.has_papers ?? null,
    source: c.source,
    source_id: String(c.id),
    dealer_name: c.seller_name || null,
    dealer_country: c.seller_country || null,
    listing_url: c.listing_url || null,
    listed_at: (!c.is_sold && c.sale_date) ? new Date(c.sale_date).toISOString() : null,
    sold_at: (c.source === 'ebay' && c.sale_date) ? new Date(c.sale_date).toISOString() : null,
    scraped_at: c.scraped_at || c.created_at,
    first_seen_at: c.created_at,
    last_seen_at: c.scraped_at || c.created_at,
  }));

  console.log(`Inserting ${rows.length} rows into market_data...`);

  const BATCH = 200;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error: insertErr } = await sb
      .from('market_data')
      .insert(batch);

    if (insertErr) {
      console.error(`  Batch error at ${i}:`, insertErr.message);
    } else {
      inserted += batch.length;
      console.log(`  ${Math.min(i + BATCH, rows.length)} / ${rows.length}`);
    }
  }

  console.log(`\n✅ Done! Inserted/upserted ${inserted} rows into market_data`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
