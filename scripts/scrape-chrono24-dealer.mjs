// scripts/scrape-chrono24-dealer.mjs
// Usage: node scripts/scrape-chrono24-dealer.mjs <dealer-slug>
// Example: node scripts/scrape-chrono24-dealer.mjs jewelsintimeofboca
//
// FlareSolverr must be running at http://localhost:8191

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { JSDOM } from 'jsdom';
config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const FLARE_URL = 'http://localhost:8191/v1';
const PAGE_SIZE = 60;

// Only track these brands — all others are ignored
const ALLOWED_BRANDS = [
  'rolex',
  'richard mille',
  'patek philippe',
  'patek',
  'vacheron constantin',
  'vacheron',
  'f.p. journe',
  'fp journe',
  'audemars piguet',
  'audemars',
];

function isAllowedBrand(title) {
  if (!title) return false;
  const t = title.toLowerCase();
  return ALLOWED_BRANDS.some(b => t.startsWith(b));
}

async function flareGet(url) {
  const res = await fetch(FLARE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd: 'request.get', url, maxTimeout: 35000 }),
  });
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(`FlareSolverr error: ${data.message}`);
  return data.solution.response;
}

function parsePrice(str) {
  const match = str.match(/\$([\d,]+)/);
  return match ? parseInt(match[1].replace(/,/g, ''), 10) : null;
}

/**
 * Parse all listing cards from a Chrono24 search results page.
 * Returns ALL cards (including cheap accessories) so pagination logic
 * can use raw card count to determine when to stop.
 * Price filtering happens later in the upsert pipeline.
 */
function parseCards(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const results = [];

  doc.querySelectorAll('[class*="js-article-item-container"]').forEach(card => {
    try {
      const link = card.querySelector('a[href*="--id"]');
      if (!link) return;
      const href = link.getAttribute('href');
      const idMatch = href.match(/--id(\d+)\.htm/);
      if (!idMatch) return;
      const chrono24Id = idMatch[1];

      const img = card.querySelector('img[alt]');
      const title = img?.getAttribute('alt') || card.querySelector('a[href*="--id"]')?.textContent?.trim() || '';
      const masterSrc = img?.getAttribute('data-lazy-sweet-spot-master-src') || '';
      const imgUrl = masterSrc
        ? masterSrc.replace('_SIZE_', '280')
        : (img?.getAttribute('src') || '');

      const price = parsePrice(card.textContent || '');
      const url = href.startsWith('/') ? `https://www.chrono24.com${href}` : href;

      // Include even if price is null/low — filter on upsert side
      results.push({ chrono24Id, title, price, imgUrl, url });
    } catch {
      // skip malformed card
    }
  });

  return results;
}

async function getMerchantId(slug) {
  console.log(`  Fetching dealer profile: https://www.chrono24.com/dealer/${slug}/index.htm`);
  const html = await flareGet(`https://www.chrono24.com/dealer/${slug}/index.htm`);
  const match = html.match(/"contactDealerLayerMerchantId":\s*(\d+)/);
  if (!match) throw new Error(`Could not find merchantId for dealer: ${slug}`);
  return parseInt(match[1], 10);
}

async function getDealerName(slug) {
  try {
    const html = await flareGet(`https://www.chrono24.com/dealer/${slug}/index.htm`);
    // Try H1 tag first
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    if (h1Match) return h1Match[1].trim();
    // Fallback: look for "dealerName" in metaData JSON
    const nameMatch = html.match(/"dealerName":\s*"([^"]+)"/);
    if (nameMatch) return nameMatch[1].trim();
  } catch {
    // ignore
  }
  return slug;
}

async function scrapeAllPages(merchantId) {
  const allListings = [];
  let page = 1;
  let totalExpected = null;

  while (true) {
    // Chrono24 pagination: p=1 is fixed, showpage=N increments
    const url = `https://www.chrono24.com/search/index.htm?dosearch=true&merchantId=${merchantId}&p=1&pageSize=60&showpage=${page}&sortorder=1`;
    console.log(`  Scraping page ${page}${totalExpected ? ` of ~${Math.ceil(totalExpected / PAGE_SIZE)}` : ''}...`);

    const html = await flareGet(url);

    // Parse total count on first page
    if (page === 1) {
      const numMatch = html.match(/"numResult":\s*(\d+)/);
      totalExpected = numMatch ? parseInt(numMatch[1], 10) : null;
      if (totalExpected !== null) {
        console.log(`  Total listings found: ${totalExpected}`);
      }
    }

    const cards = parseCards(html);
    console.log(`  Page ${page}: ${cards.length} cards parsed (all price tiers)`);

    // Break only when no cards at all — NOT based on filtered count
    if (cards.length === 0) break;
    allListings.push(...cards);

    if (totalExpected !== null && allListings.length >= totalExpected) break;
    if (cards.length < PAGE_SIZE) break;

    page++;
    // Respectful rate limit between pages
    await new Promise(r => setTimeout(r, 2000));
  }

  return allListings;
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: node scripts/scrape-chrono24-dealer.mjs <dealer-slug>');
    console.error('Example: node scripts/scrape-chrono24-dealer.mjs jewelsintimeofboca');
    process.exit(1);
  }

  console.log(`\n🔍 Scraping Chrono24 dealer: ${slug}`);

  // Get merchantId from dealer profile page
  console.log('Getting merchant ID...');
  const merchantId = await getMerchantId(slug);
  console.log(`Merchant ID: ${merchantId}`);

  // Get dealer name
  const dealerName = await getDealerName(slug);
  console.log(`Dealer name: ${dealerName}`);

  // Upsert dealer record
  const { data: dealer, error: dealerErr } = await sb
    .from('chrono24_dealers')
    .upsert(
      { merchant_id: merchantId, slug, name: dealerName },
      { onConflict: 'merchant_id' }
    )
    .select('id')
    .single();

  if (dealerErr) {
    console.error('Dealer upsert error:', dealerErr.message);
    process.exit(1);
  }
  console.log(`Dealer DB ID: ${dealer.id}`);

  // Scrape all pages
  console.log('\nScraping inventory...');
  const listings = await scrapeAllPages(merchantId);
  // Deduplicate by chrono24_id (pages can overlap)
  const seen = new Set();
  const deduped = listings.filter(l => {
    if (seen.has(l.chrono24Id)) return false;
    seen.add(l.chrono24Id);
    return true;
  });
  console.log(`\nTotal scraped: ${deduped.length} unique listings (${listings.length - deduped.length} duplicates removed)`);
  const listings_unique = deduped;

  // Get existing active listing IDs for sold detection
  const { data: existing } = await sb
    .from('chrono24_listings')
    .select('chrono24_id')
    .eq('merchant_id', merchantId)
    .eq('is_sold', false);

  const existingIds = new Set((existing ?? []).map(l => l.chrono24_id));
  const scrapedIds = new Set(listings_unique.map(l => l.chrono24Id));

  // Listings that disappeared = sold
  const soldIds = [...existingIds].filter(id => !scrapedIds.has(id));
  if (soldIds.length > 0) {
    console.log(`\n🔴 Marking ${soldIds.length} listings as sold...`);
    const { error: soldErr } = await sb
      .from('chrono24_listings')
      .update({ is_sold: true, sold_detected_at: new Date().toISOString() })
      .in('chrono24_id', soldIds);
    if (soldErr) console.error('Sold mark error:', soldErr.message);
  }

  // Upsert all current listings in batches of 100
  const now = new Date().toISOString();
  // Store all listings regardless of price — accessories included.
  // Consumers can filter by price threshold when querying.
  const toUpsert = listings_unique
    .filter(l => l.chrono24Id && l.title && isAllowedBrand(l.title)) // target brands only
    .map(l => ({
      chrono24_id: l.chrono24Id,
      dealer_id: dealer.id,
      merchant_id: merchantId,
      title: (l.title ?? '').substring(0, 255),
      price: l.price ?? null,
      currency: 'USD',
      image_url: (l.imgUrl ?? '').substring(0, 500) || null,
      listing_url: (l.url ?? '').substring(0, 500) || null,
      is_sold: false,
      last_seen_at: now,
      scraped_at: now,
    }));

  let upsertedCount = 0;
  for (let i = 0; i < toUpsert.length; i += 100) {
    const chunk = toUpsert.slice(i, i + 100);
    const { error: upsertErr } = await sb
      .from('chrono24_listings')
      .upsert(chunk, { onConflict: 'chrono24_id', ignoreDuplicates: false });
    if (upsertErr) {
      console.error(`Upsert error at chunk ${i}:`, upsertErr.message);
    } else {
      upsertedCount += chunk.length;
      console.log(`  Upserted ${upsertedCount}/${toUpsert.length}`);
    }
  }

  // Update dealer metadata
  await sb
    .from('chrono24_dealers')
    .update({
      total_listings: listings_unique.length,
      last_scraped_at: now,
      updated_at: now,
    })
    .eq('id', dealer.id);

  console.log(`\n✅ Done!`);
  console.log(`   ${listings_unique.length} listings saved`);
  console.log(`   ${soldIds.length} marked as sold`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
