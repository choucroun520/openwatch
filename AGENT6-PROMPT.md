Read CLAUDE.md, OPENWATCH-CONTEXT.md, and all existing src/ files before writing anything.

You are building the Chrono24 market intelligence layer for OpenWatch.

DO NOT touch: middleware.ts, .env files, auth logic, existing migrations 00001-00015.

## CONTEXT

FlareSolverr is running at http://localhost:8191 — it bypasses Cloudflare Turnstile on Chrono24.

Key discoveries:
- `merchantId=XXXX` in the search URL filters by specific dealer (e.g. merchantId=5132 returns all 1,058 listings from "Jewels in Time")
- Dealer profile pages are at `/dealer/{slug}/index.htm` and contain `data.contactDealerLayerMerchantId` in the window.metaData JSON
- Per-ref search: `https://www.chrono24.com/search/index.htm?query=126710blro&dosearch=true&sortorder=1` returns 60 cards
- Cards use class `js-article-item-container`, each has image (img alt=title, data-lazy-sweet-spot-master-src), link (href with --idXXX.htm), price in text
- market_comps table already exists (migration 00015) — source values: 'ebay' | 'chrono24' | 'watchcharts'

## FlareSolverr helper

```python
import urllib.request, json, re
from bs4 import BeautifulSoup

def flare_get(url, timeout_ms=35000):
    payload = json.dumps({"cmd": "request.get", "url": url, "maxTimeout": timeout_ms}).encode()
    req = urllib.request.Request("http://localhost:8191/v1", data=payload, headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=timeout_ms//1000 + 10).read())["solution"]["response"]
```

## Card parser (already validated working)

```python
def parse_chrono24_cards(html):
    soup = BeautifulSoup(html, "html.parser")
    results = []
    cards = soup.find_all("div", class_=re.compile(r"js-article-item-container"))
    for card in cards:
        try:
            link_el = card.find("a", href=re.compile(r'--id\d+\.htm'))
            if not link_el: continue
            href = link_el["href"]
            listing_id = re.search(r'--id(\d+)\.htm', href)
            listing_id = listing_id.group(1) if listing_id else None
            if not listing_id: continue
            
            url = f"https://www.chrono24.com{href}" if href.startswith("/") else href
            
            img = card.find("img", alt=True)
            title = img["alt"] if img else card.get_text(" ", strip=True)[:60]
            img_url = ""
            if img:
                master = img.get("data-lazy-sweet-spot-master-src", "")
                img_url = master.replace("_SIZE_", "280") if master else img.get("src", "")
            
            text = card.get_text(" ", strip=True)
            price_match = re.search(r'\$\s*([\d,]+)', text)
            price = int(price_match.group(1).replace(",","")) if price_match else None
            
            if price and price > 1000 and listing_id:
                results.append({
                    "chrono24_id": listing_id,
                    "title": title,
                    "price": price,
                    "url": url,
                    "image_url": img_url,
                })
        except:
            pass
    return results
```

---

## STEP 1: Migration 00016 — Chrono24 dealers + listings tables

File: `supabase/migrations/00016_chrono24_tracking.sql`

```sql
-- Chrono24 dealer profiles we track
CREATE TABLE IF NOT EXISTS chrono24_dealers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id INTEGER UNIQUE NOT NULL,        -- Chrono24's merchantId (e.g. 5132)
  slug TEXT UNIQUE NOT NULL,                   -- URL slug (e.g. jewelsintimeofboca)
  name TEXT NOT NULL,
  country TEXT,
  total_listings INTEGER DEFAULT 0,
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- All Chrono24 listings we track (current + sold)
CREATE TABLE IF NOT EXISTS chrono24_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chrono24_id TEXT UNIQUE NOT NULL,            -- Chrono24's listing ID (e.g. 41498331)
  dealer_id UUID REFERENCES chrono24_dealers(id),
  merchant_id INTEGER,                          -- Denormalized for fast lookup
  title TEXT NOT NULL,
  reference_number TEXT,
  brand_name TEXT,
  price NUMERIC(14,2),
  currency TEXT DEFAULT 'USD',
  image_url TEXT,
  listing_url TEXT,
  condition TEXT,
  is_sold BOOLEAN DEFAULT FALSE,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  sold_detected_at TIMESTAMPTZ,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_c24_listings_dealer ON chrono24_listings(dealer_id);
CREATE INDEX idx_c24_listings_ref ON chrono24_listings(reference_number);
CREATE INDEX idx_c24_listings_sold ON chrono24_listings(is_sold);
CREATE INDEX idx_c24_listings_merchant ON chrono24_listings(merchant_id);

-- RLS: public read
ALTER TABLE chrono24_dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE chrono24_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read chrono24_dealers" ON chrono24_dealers FOR SELECT USING (true);
CREATE POLICY "Public read chrono24_listings" ON chrono24_listings FOR SELECT USING (true);
CREATE POLICY "Service insert chrono24_dealers" ON chrono24_dealers FOR INSERT WITH CHECK (true);
CREATE POLICY "Service insert chrono24_listings" ON chrono24_listings FOR INSERT WITH CHECK (true);
CREATE POLICY "Service update chrono24_dealers" ON chrono24_dealers FOR UPDATE USING (true);
CREATE POLICY "Service update chrono24_listings" ON chrono24_listings FOR UPDATE USING (true);
```

Apply with:
```bash
npx supabase db push --local=false
```

Or directly via Supabase API if CLI fails.

---

## STEP 2: scripts/scrape-chrono24-dealer.mjs

Full dealer inventory scraper. Takes a dealer slug, scrapes all pages, upserts into chrono24_listings.

```javascript
// scripts/scrape-chrono24-dealer.mjs
// Usage: node scripts/scrape-chrono24-dealer.mjs <dealer-slug>
// Example: node scripts/scrape-chrono24-dealer.mjs jewelsintimeofboca

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { createRequire } from 'module';
config({ path: '.env.local' });

const require = createRequire(import.meta.url);
const { BeautifulSoup } = require('cheerio'); // use cheerio for Node.js

// OR use built-in parsing:
import { JSDOM } from 'jsdom';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const FLARE_URL = 'http://localhost:8191/v1';
const PAGE_SIZE = 60; // Chrono24 returns 60 per page

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
  return match ? parseInt(match[1].replace(/,/g, '')) : null;
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
      const imgUrl = masterSrc ? masterSrc.replace('_SIZE_', '280') : (img?.getAttribute('src') || '');
      
      const price = parsePrice(card.textContent || '');
      if (!price || price < 500) return;
      
      const url = href.startsWith('/') ? `https://www.chrono24.com${href}` : href;
      
      results.push({ chrono24Id, title, price, imgUrl, url });
    } catch {}
  });
  
  return results;
}

async function getMerchantId(slug) {
  const html = await flareGet(`https://www.chrono24.com/dealer/${slug}/index.htm`);
  const match = html.match(/"contactDealerLayerMerchantId":\s*(\d+)/);
  if (!match) throw new Error(`Could not find merchantId for dealer: ${slug}`);
  return parseInt(match[1]);
}

async function getDealerName(html) {
  const match = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  return match ? match[1].trim() : 'Unknown Dealer';
}

async function scrapeAllPages(merchantId) {
  const allListings = [];
  let page = 1;
  let totalExpected = null;
  
  while (true) {
    const url = `https://www.chrono24.com/search/index.htm?merchantId=${merchantId}&dosearch=true&sortorder=1&pageSize=60&p=${page}`;
    console.log(`  Scraping page ${page}...`);
    
    const html = await flareGet(url);
    
    // Get total on first page
    if (page === 1) {
      const numMatch = html.match(/"numResult":\s*(\d+)/);
      totalExpected = numMatch ? parseInt(numMatch[1]) : null;
      console.log(`  Total listings: ${totalExpected}`);
    }
    
    const cards = parseCards(html);
    console.log(`  Page ${page}: ${cards.length} listings`);
    
    if (cards.length === 0) break;
    allListings.push(...cards);
    
    // Check if we have all listings
    if (totalExpected && allListings.length >= totalExpected) break;
    if (cards.length < PAGE_SIZE) break;
    
    page++;
    await new Promise(r => setTimeout(r, 2000)); // Rate limit
  }
  
  return allListings;
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: node scrape-chrono24-dealer.mjs <dealer-slug>');
    process.exit(1);
  }
  
  console.log(`\n🔍 Scraping Chrono24 dealer: ${slug}`);
  console.log('Getting merchant ID...');
  
  const merchantId = await getMerchantId(slug);
  console.log(`Merchant ID: ${merchantId}`);
  
  // Upsert dealer record
  const { data: dealer, error: dealerErr } = await sb
    .from('chrono24_dealers')
    .upsert({ merchant_id: merchantId, slug, name: slug }, { onConflict: 'merchant_id' })
    .select('id')
    .single();
  
  if (dealerErr) { console.error('Dealer upsert error:', dealerErr.message); process.exit(1); }
  console.log(`Dealer DB ID: ${dealer.id}`);
  
  // Scrape all pages
  console.log('\nScraping inventory...');
  const listings = await scrapeAllPages(merchantId);
  console.log(`\nTotal scraped: ${listings.length} listings`);
  
  // Get existing listing IDs (for sold detection)
  const { data: existing } = await sb
    .from('chrono24_listings')
    .select('chrono24_id')
    .eq('merchant_id', merchantId)
    .eq('is_sold', false);
  
  const existingIds = new Set(existing?.map(l => l.chrono24_id) || []);
  const scrapedIds = new Set(listings.map(l => l.chrono24Id));
  
  // Listings that disappeared = sold
  const soldIds = [...existingIds].filter(id => !scrapedIds.has(id));
  if (soldIds.length > 0) {
    console.log(`\n🔴 Marking ${soldIds.length} listings as sold...`);
    await sb.from('chrono24_listings')
      .update({ is_sold: true, sold_detected_at: new Date().toISOString() })
      .in('chrono24_id', soldIds);
  }
  
  // Upsert all current listings
  const toUpsert = listings.map(l => ({
    chrono24_id: l.chrono24Id,
    dealer_id: dealer.id,
    merchant_id: merchantId,
    title: l.title?.substring(0, 255),
    price: l.price,
    currency: 'USD',
    image_url: l.imgUrl?.substring(0, 500),
    listing_url: l.url?.substring(0, 500),
    is_sold: false,
    last_seen_at: new Date().toISOString(),
    scraped_at: new Date().toISOString(),
  }));
  
  // Batch upsert in chunks of 100
  for (let i = 0; i < toUpsert.length; i += 100) {
    const chunk = toUpsert.slice(i, i + 100);
    const { error } = await sb.from('chrono24_listings')
      .upsert(chunk, { onConflict: 'chrono24_id', ignoreDuplicates: false });
    if (error) console.error(`Upsert error at chunk ${i}:`, error.message);
    else console.log(`  Upserted ${i + chunk.length}/${toUpsert.length}`);
  }
  
  // Update dealer record
  await sb.from('chrono24_dealers').update({
    total_listings: listings.length,
    last_scraped_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', dealer.id);
  
  console.log(`\n✅ Done! ${listings.length} listings saved, ${soldIds.length} marked sold`);
}

main().catch(console.error);
```

---

## STEP 3: scripts/scrape-chrono24-market.mjs

Per-reference market comps scraper. For each unique ref in the listings table, scrapes the Chrono24 search page and inserts into `market_comps` with source='chrono24'.

Similar structure to scrape-chrono24-dealer.mjs but iterates refs.

Key difference: market_comps stores **asking prices** (current listings), which is different from eBay **sold prices**.
- source='chrono24' in market_comps = current asking price on grey market
- source='ebay' in market_comps = actual sold price

Only scrape refs where market_comps count for that ref+source is 0 or last scraped > 24h ago.

After inserting, also add to market_comps table:
```javascript
{
  reference_number: ref,
  brand_name: brand,
  source: 'chrono24',
  title: listing.title,
  price: listing.price,
  currency: 'USD',
  listing_url: listing.url,
  scraped_at: new Date().toISOString(),
}
```

---

## STEP 4: API routes

### GET /api/chrono24/dealers
Returns all chrono24_dealers with listing counts.

### GET /api/chrono24/dealer/[slug]  
Returns dealer info + paginated listings from chrono24_listings table.

### POST /api/chrono24/scrape
Body: `{ "slug": "jewelsintimeofboca" }`
Triggers scrape-chrono24-dealer.mjs inline (spawn child process).
Returns: `{ "started": true, "dealer": "jewelsintimeofboca" }`

---

## STEP 5: Chrono24 Dealers page — src/app/dealers/page.tsx

Update the existing stub to show:
- Two sections: "OpenWatch Dealers" (our invited dealers) + "Market Dealers" (scraped from Chrono24)
- For Chrono24 dealers: show name, country, total listings, last scraped, "View All" button
- "Add Dealer" button: input for Chrono24 dealer slug → triggers POST /api/chrono24/scrape

---

## STEP 6: Sold detection badge on listing cards

Update ListingCard to accept `isSoldOnChrono24?: boolean` prop.

When a watch with a matching reference_number has `is_sold: true` in chrono24_listings AND the same chrono24_id → show a "Sold on C24" badge.

This cross-references our OpenWatch listings with Chrono24 sold data.

---

## DONE CRITERIA

1. Migration 00016 applied ✅
2. `node scripts/scrape-chrono24-dealer.mjs jewelsintimeofboca` runs and upserts listings ✅
3. `node scripts/scrape-chrono24-market.mjs` runs and inserts market_comps for all refs ✅
4. /api/chrono24/dealers returns data ✅
5. /dealers page shows Chrono24 dealers section ✅
6. npx tsc --noEmit = 0 errors ✅
7. git add -A && git commit -m "feat: Chrono24 scraper — dealer inventory tracking + sold detection + market comps" ✅

After committing, run:
```bash
node scripts/scrape-chrono24-dealer.mjs jewelsintimeofboca
```

Then:
openclaw system event --text "Done: OpenWatch Agent 6 — Chrono24 dealer scraper, sold detection, market comps. jewelsintimeofboca scraped." --mode now
