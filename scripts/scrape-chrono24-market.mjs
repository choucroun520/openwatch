// scripts/scrape-chrono24-market.mjs
// Usage: node scripts/scrape-chrono24-market.mjs
//
// For each unique reference_number in the listings table, scrapes Chrono24 search
// results and inserts asking prices into market_comps with source='chrono24'.
//
// Skips refs that were already scraped within the last 24 hours.
// FlareSolverr must be running at http://localhost:8191.

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { JSDOM } from 'jsdom';
config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const FLARE_URL = 'http://localhost:8191/v1';

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
      const title = img?.getAttribute('alt') || '';
      const masterSrc = img?.getAttribute('data-lazy-sweet-spot-master-src') || '';
      const imgUrl = masterSrc
        ? masterSrc.replace('_SIZE_', '280')
        : (img?.getAttribute('src') || '');

      const price = parsePrice(card.textContent || '');
      if (!price || price < 500) return;

      const url = href.startsWith('/') ? `https://www.chrono24.com${href}` : href;

      results.push({ chrono24Id, title, price, imgUrl, url });
    } catch {
      // skip malformed card
    }
  });

  return results;
}

async function scrapeRefOnChrono24(ref) {
  const encoded = encodeURIComponent(ref);
  const url = `https://www.chrono24.com/search/index.htm?query=${encoded}&dosearch=true&sortorder=1`;

  try {
    const html = await flareGet(url);
    return parseCards(html);
  } catch (err) {
    console.error(`  Error scraping ${ref}:`, err.message?.substring(0, 80));
    return [];
  }
}

async function getRefsToScrape() {
  // Get all unique refs from listings table
  const { data: listings, error } = await sb
    .from('listings')
    .select('reference_number, brand:brands(name)')
    .not('reference_number', 'is', null)
    .is('deleted_at', null);

  if (error) throw new Error(`Failed to fetch listings: ${error.message}`);

  // Build ref→brand map
  const refs = {};
  for (const l of listings ?? []) {
    if (l.reference_number && !refs[l.reference_number]) {
      refs[l.reference_number] = l.brand?.name || 'Watch';
    }
  }

  // Check which refs already have recent Chrono24 comps (< 24h ago)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const refList = Object.keys(refs);

  if (refList.length === 0) return {};

  const { data: recentComps } = await sb
    .from('market_comps')
    .select('reference_number')
    .eq('source', 'chrono24')
    .in('reference_number', refList)
    .gte('scraped_at', twentyFourHoursAgo);

  const recentlyScraped = new Set((recentComps ?? []).map(c => c.reference_number));

  // Filter to refs that need scraping
  const toScrape = {};
  for (const [ref, brand] of Object.entries(refs)) {
    if (!recentlyScraped.has(ref)) {
      toScrape[ref] = brand;
    }
  }

  return toScrape;
}

async function main() {
  console.log('\n🔍 Chrono24 Market Comps Scraper');
  console.log('Fetching refs to scrape...');

  const toScrape = await getRefsToScrape();
  const refList = Object.entries(toScrape);

  if (refList.length === 0) {
    console.log('All refs scraped within the last 24h. Nothing to do.');
    return;
  }

  console.log(`Found ${refList.length} refs to scrape\n`);

  let totalInserted = 0;

  for (let i = 0; i < refList.length; i++) {
    const [ref, brand] = refList[i];
    console.log(`[${i + 1}/${refList.length}] ${brand} ${ref}`);

    const cards = await scrapeRefOnChrono24(ref);
    console.log(`  Found ${cards.length} listings on Chrono24`);

    if (cards.length === 0) {
      await new Promise(r => setTimeout(r, 1500));
      continue;
    }

    const now = new Date().toISOString();
    const comps = cards
      .filter(c => c.price > 1000)
      .map(c => ({
        reference_number: ref,
        brand_name: brand,
        source: 'chrono24',
        title: (c.title ?? '').substring(0, 255),
        price: c.price,
        currency: 'USD',
        listing_url: (c.url ?? '').substring(0, 500),
        scraped_at: now,
        // Chrono24 comps = asking prices, not sold prices — sale_date stays null
        sale_date: null,
      }));

    if (comps.length > 0) {
      const { error: insertErr } = await sb.from('market_comps').insert(comps);
      if (insertErr) {
        console.error('  Insert error:', insertErr.message);
      } else {
        totalInserted += comps.length;
        console.log(`  Inserted ${comps.length} comps`);
      }
    }

    // Respectful rate limit
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\n✅ Done! Total inserted: ${totalInserted} market comps (source=chrono24)`);
  console.log('Note: Chrono24 comps = current asking prices (not sold). eBay comps = sold prices.');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
