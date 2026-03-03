// scripts/scrape-ebay.mjs (rewritten — no Playwright)
// Run with: node scripts/scrape-ebay.mjs
// Uses native fetch + jsdom (no browser required)

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { JSDOM } from 'jsdom';
config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

async function fetchEbaySold(ref, brand) {
  const query = encodeURIComponent(`${brand} ${ref}`);
  const url = `https://www.ebay.com/sch/i.html?_nkw=${query}&LH_Sold=1&LH_Complete=1&_sop=13&_ipg=25`;

  let res;
  try {
    res = await fetch(url, { headers: HEADERS });
  } catch (e) {
    console.error(`  Fetch error: ${e.message?.substring(0, 80)}`);
    return [];
  }

  const html = await res.text();
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const results = [];

  doc.querySelectorAll('.s-item').forEach(item => {
    const title = item.querySelector('.s-item__title')?.textContent?.trim();
    const priceText = item.querySelector('.s-item__price')?.textContent?.trim();
    const dateText = item.querySelector('.s-item__ended-date, .s-item__listingDate')?.textContent?.trim();
    const link = item.querySelector('a.s-item__link')?.href;
    if (!title || !priceText || title.includes('Shop on eBay')) return;
    const price = parseInt(priceText.replace(/[^0-9]/g, ''));
    if (!price || price < 3000) return; // skip non-watch prices
    results.push({ title, price, dateText, link });
  });

  return results;
}

async function main() {
  // Get unique refs from market_data
  const { data: refs, error: refsErr } = await sb
    .from('market_data')
    .select('ref_number, brand')
    .eq('is_sold', false)
    .order('ref_number');

  if (refsErr) {
    console.error('Failed to fetch refs:', refsErr.message);
    process.exit(1);
  }

  const unique = {};
  refs?.forEach(r => { if (r.ref_number && !unique[r.ref_number]) unique[r.ref_number] = r.brand; });
  const refList = Object.entries(unique);
  console.log(`Scraping eBay sold listings for ${refList.length} refs...`);

  let total = 0;
  for (let i = 0; i < refList.length; i++) {
    const [ref, brand] = refList[i];
    console.log(`[${i + 1}/${refList.length}] ${brand} ${ref}`);
    try {
      const items = await fetchEbaySold(ref, brand);
      console.log(`  Found ${items.length} sold listings`);
      if (!items.length) continue;

      const rows = items.map(item => {
        const sourceId = item.link?.match(/itm\/(\d+)/)?.[1] ?? null;
        let soldAt = null;
        if (item.dateText) {
          const parsed = new Date(item.dateText);
          if (!isNaN(parsed.getTime())) soldAt = parsed.toISOString();
        }
        return {
          ref_number: ref,
          brand: brand ?? 'Unknown',
          price: item.price,
          currency: 'USD',
          is_sold: true,
          source: 'ebay',
          source_id: sourceId,
          listing_url: item.link?.substring(0, 500) ?? null,
          sold_at: soldAt,
          scraped_at: new Date().toISOString(),
          first_seen_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        };
      }).filter(r => r.source_id); // must have ID to dedup

      if (!rows.length) continue;

      const { error } = await sb
        .from('market_data')
        .upsert(rows, { onConflict: 'source,source_id', ignoreDuplicates: true });
      if (error) console.error('  Error:', error.message);
      else total += rows.length;
    } catch (e) {
      console.error(`  Error: ${e.message?.substring(0, 80)}`);
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  console.log(`\n✅ Done! ${total} eBay sold listings added to market_data`);
}

main().catch(console.error);
