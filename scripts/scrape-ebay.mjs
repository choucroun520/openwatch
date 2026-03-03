// scripts/scrape-ebay.mjs
// Run with: node scripts/scrape-ebay.mjs
// Uses Playwright to scrape eBay sold listings for all watch refs
// Requires: npm install playwright && npx playwright install chromium

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Clean a reference number for eBay search
function cleanRef(ref) {
  return ref.replace(/[-\.]/g, ' ').trim();
}

// Parse price string to number
function parsePrice(str) {
  const match = str.match(/[\d,]+\.?\d*/);
  if (!match) return null;
  return parseFloat(match[0].replace(/,/g, ''));
}

async function scrapeEbayForRef(page, ref, brandName) {
  const query = encodeURIComponent(`${brandName} ${cleanRef(ref)}`);
  const url = `https://www.ebay.com/sch/i.html?_nkw=${query}&LH_Sold=1&LH_Complete=1&_sop=13&LH_ItemCondition=3000&_ipg=25`;

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    const items = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('.s-item').forEach(el => {
        const title = el.querySelector('.s-item__title')?.innerText?.trim();
        const priceEl = el.querySelector('.s-item__price');
        const price = priceEl?.innerText?.trim();
        const dateEl = el.querySelector('.s-item__ended-date, .s-item__listingDate');
        const date = dateEl?.innerText?.trim();
        const link = el.querySelector('a.s-item__link')?.href;
        if (title && price && !title.includes('Shop on eBay')) {
          results.push({ title, price, date, link });
        }
      });
      return results.slice(0, 20);
    });

    return items;
  } catch (e) {
    console.error(`Error scraping ${ref}:`, e.message?.substring(0, 60));
    return [];
  }
}

async function main() {
  console.log('Fetching listings from Supabase...');
  const { data: listings, error } = await sb
    .from('listings')
    .select('reference_number, brand:brands(name)')
    .not('reference_number', 'is', null);

  if (error) {
    console.error('Failed to fetch listings:', error.message);
    process.exit(1);
  }

  // Get unique refs with brand names
  const refs = {};
  listings?.forEach(l => {
    if (l.reference_number && !refs[l.reference_number]) {
      refs[l.reference_number] = l.brand?.name || 'Watch';
    }
  });

  console.log(`Found ${Object.keys(refs).length} unique refs to scrape`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });
  const page = await ctx.newPage();

  let totalInserted = 0;
  const refList = Object.entries(refs);

  for (let i = 0; i < refList.length; i++) {
    const [ref, brand] = refList[i];
    console.log(`[${i + 1}/${refList.length}] Scraping eBay for ${brand} ${ref}...`);

    const items = await scrapeEbayForRef(page, ref, brand);
    console.log(`  Found ${items.length} sold listings`);

    const comps = [];
    for (const item of items) {
      const price = parsePrice(item.price);
      if (!price || price < 5000) continue; // filter accessories

      // Parse date
      let saleDate = null;
      if (item.date) {
        const parsed = new Date(item.date);
        if (!isNaN(parsed.getTime())) saleDate = parsed.toISOString().split('T')[0];
      }

      comps.push({
        reference_number: ref,
        brand_name: brand,
        source: 'ebay',
        title: item.title?.substring(0, 255),
        price,
        currency: 'USD',
        sale_date: saleDate,
        listing_url: item.link?.substring(0, 500),
      });
    }

    if (comps.length > 0) {
      const { error: insertError } = await sb.from('market_comps').insert(comps);
      if (insertError) console.error('Insert error:', insertError.message);
      else {
        totalInserted += comps.length;
        console.log(`  Inserted ${comps.length} comps`);
      }
    }

    // Rate limit - be respectful
    await new Promise(r => setTimeout(r, 1500));
  }

  await browser.close();
  console.log(`\nDone! Total inserted: ${totalInserted} market comps`);
}

main().catch(console.error);
