// scripts/scrape-ebay-api.mjs
// Uses eBay Finding API (official) to get completed/sold listings.
// Free tier: 5,000 calls/day.
// Docs: https://developer.ebay.com/devzone/finding/CallRef/findCompletedItems.html
//
// Usage: node scripts/scrape-ebay-api.mjs
// Requires: EBAY_APP_ID in .env.local

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EBAY_APP_ID = process.env.EBAY_APP_ID;
if (!EBAY_APP_ID) {
  console.error('❌ EBAY_APP_ID not set in .env.local');
  console.error('Get it at: https://developer.ebay.com');
  process.exit(1);
}

const ALLOWED_BRANDS = ['rolex', 'richard mille', 'patek', 'vacheron', 'f.p. journe', 'fp journe', 'audemars'];

// eBay Finding API endpoint
const FINDING_API = 'https://svcs.ebay.com/services/search/FindingService/v1';

async function searchCompletedItems(query, page = 1) {
  const params = new URLSearchParams({
    'OPERATION-NAME': 'findCompletedItems',
    'SERVICE-VERSION': '1.0.0',
    'SECURITY-APPNAME': EBAY_APP_ID,
    'RESPONSE-DATA-FORMAT': 'JSON',
    'REST-PAYLOAD': '',
    'keywords': query,
    'categoryId': '31387', // Wristwatches category
    'itemFilter(0).name': 'SoldItemsOnly',
    'itemFilter(0).value': 'true',
    'itemFilter(1).name': 'MinPrice',
    'itemFilter(1).value': '1000',
    'itemFilter(1).paramName': 'Currency',
    'itemFilter(1).paramValue': 'USD',
    'sortOrder': 'EndTimeSoonest',
    'paginationInput.entriesPerPage': '100',
    'paginationInput.pageNumber': page.toString(),
    'outputSelector': 'SellerInfo,PictureURLLarge',
  });

  const res = await fetch(`${FINDING_API}?${params}`);
  const data = await res.json();
  return data?.findCompletedItemsResponse?.[0];
}

function parseCondition(conditionId) {
  const map = {
    '1000': 'new', '1500': 'new', '1750': 'new',
    '2000': 'excellent', '2500': 'excellent',
    '3000': 'very_good', '4000': 'good', '5000': 'fair', '6000': 'fair',
  };
  return map[conditionId] || 'used';
}

async function scrapeRef(ref, brand) {
  const query = `${brand} ${ref}`;
  console.log(`  Searching eBay: "${query}"`);

  const results = [];
  let page = 1;
  let totalPages = 1;

  while (page <= Math.min(totalPages, 3)) { // max 3 pages = 300 results per ref
    const response = await searchCompletedItems(query, page);

    if (!response || response.ack?.[0] !== 'Success') {
      console.log(`  eBay API error:`, response?.errorMessage?.[0]?.error?.[0]?.message?.[0] || 'Unknown');
      break;
    }

    totalPages = parseInt(response.paginationOutput?.[0]?.totalPages?.[0] || '1');
    const items = response.searchResult?.[0]?.item || [];

    for (const item of items) {
      try {
        const title = item.title?.[0] || '';
        const priceStr = item.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.['__value__'];
        const price = priceStr ? parseFloat(priceStr) : null;
        if (!price || price < 1000) continue;

        const conditionId = item.condition?.[0]?.conditionId?.[0];
        const endTime = item.listingInfo?.[0]?.endTime?.[0];
        const itemId = item.itemId?.[0];
        const viewUrl = item.viewItemURL?.[0];

        // Only include items that actually sold (not just completed/unsold)
        const soldCount = parseInt(item.sellingStatus?.[0]?.quantitySold?.[0] || '0');
        if (soldCount === 0) continue;

        results.push({
          ref_number: ref,
          brand,
          price,
          is_sold: true,
          source: 'ebay',
          source_id: itemId,
          condition: parseCondition(conditionId),
          listing_url: viewUrl,
          sold_at: endTime ? new Date(endTime).toISOString() : null,
          scraped_at: new Date().toISOString(),
        });
      } catch {}
    }

    page++;
    await new Promise(r => setTimeout(r, 500));
  }

  return results;
}

async function main() {
  console.log('🔍 eBay Sold Listings Scraper (Official API)\n');

  // Get refs to scrape from existing market_data
  const { data: refs } = await sb
    .from('market_data')
    .select('ref_number, brand')
    .eq('is_sold', false)
    .not('ref_number', 'is', null);

  const uniqueRefs = {};
  refs?.forEach(r => {
    if (!uniqueRefs[r.ref_number]) uniqueRefs[r.ref_number] = r.brand;
  });

  const refList = Object.entries(uniqueRefs).filter(([_, brand]) =>
    ALLOWED_BRANDS.some(b => brand.toLowerCase().includes(b))
  );

  console.log(`Found ${refList.length} refs to scrape\n`);

  let totalInserted = 0;

  for (let i = 0; i < refList.length; i++) {
    const [ref, brand] = refList[i];
    console.log(`[${i+1}/${refList.length}] ${brand} ${ref}`);

    const comps = await scrapeRef(ref, brand);
    console.log(`  Found ${comps.length} sold listings`);

    if (comps.length > 0) {
      const { error } = await sb
        .from('market_data')
        .upsert(comps, { onConflict: 'source,source_id', ignoreDuplicates: true });

      if (error) console.error('  Insert error:', error.message);
      else totalInserted += comps.length;
    }

    // Rate limit: 5 req/sec max on eBay Finding API
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n✅ Done! ${totalInserted} sold comps inserted into market_data`);
}

main().catch(console.error);
