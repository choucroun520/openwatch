Read CLAUDE.md, OPENWATCH-CONTEXT.md, and all existing src/ files before writing anything.

You are building the market intelligence layer for OpenWatch — eBay sold comps for every watch ref, shown on every listing card and detail page.

DO NOT touch: middleware.ts, .env files, auth logic, existing migrations 00001-00014.

---

## STEP 1: New migration — supabase/migrations/00015_market_comps.sql

```sql
-- Market comparable sales from external sources (eBay, Chrono24, etc.)
CREATE TABLE IF NOT EXISTS market_comps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT NOT NULL,
  brand_name TEXT,
  source TEXT NOT NULL DEFAULT 'ebay', -- 'ebay' | 'chrono24' | 'watchcharts'
  title TEXT,
  price NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  condition TEXT, -- 'new', 'used', 'unworn', etc.
  has_box BOOLEAN,
  has_papers BOOLEAN,
  sale_date DATE,
  listing_url TEXT,
  seller_name TEXT,
  seller_country TEXT,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_market_comps_ref ON market_comps(reference_number);
CREATE INDEX idx_market_comps_source ON market_comps(source);
CREATE INDEX idx_market_comps_scraped_at ON market_comps(scraped_at DESC);

-- View for per-ref statistics
CREATE OR REPLACE VIEW market_comp_stats AS
SELECT
  reference_number,
  source,
  COUNT(*) as total_comps,
  MIN(price) as floor_price,
  ROUND(AVG(price), 2) as avg_price,
  MAX(price) as ceiling_price,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) as median_price,
  COUNT(CASE WHEN sale_date >= NOW() - INTERVAL '30 days' THEN 1 END) as sold_30d,
  COUNT(CASE WHEN sale_date >= NOW() - INTERVAL '7 days' THEN 1 END) as sold_7d,
  MAX(scraped_at) as last_updated
FROM market_comps
WHERE price > 5000 -- filter out accessories/parts
GROUP BY reference_number, source;

-- RLS: anyone can read market comps (public market data)
ALTER TABLE market_comps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read market comps" ON market_comps FOR SELECT USING (true);
CREATE POLICY "Service role can insert market comps" ON market_comps FOR INSERT WITH CHECK (true);
```

---

## STEP 2: eBay scraper script — scripts/scrape-ebay.mjs

Build a Node.js script that:
1. Fetches all RC Crown listings from Supabase to get reference numbers
2. For each unique reference_number, scrapes eBay sold listings
3. Saves results to market_comps table

```javascript
// scripts/scrape-ebay.mjs
// Run with: node scripts/scrape-ebay.mjs
// Uses Playwright to scrape eBay sold listings for all watch refs

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
  // Remove variant suffixes, clean up
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
  const { data: listings } = await sb
    .from('listings')
    .select('reference_number, brand:brands(name)')
    .not('reference_number', 'is', null);
  
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
    console.log(`[${i+1}/${refList.length}] Scraping eBay for ${brand} ${ref}...`);
    
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
      const { error } = await sb.from('market_comps').insert(comps);
      if (error) console.error('Insert error:', error.message);
      else { totalInserted += comps.length; console.log(`  Inserted ${comps.length} comps`); }
    }
    
    // Rate limit - be respectful
    await new Promise(r => setTimeout(r, 1500));
  }
  
  await browser.close();
  console.log(`\nDone! Total inserted: ${totalInserted} market comps`);
}

main().catch(console.error);
```

---

## STEP 3: Market stats API route — src/app/api/market/stats/route.ts

```typescript
// GET /api/market/stats?refs=126710BLRO,126610LN-0001,...
// Returns floor/avg/ceiling/count for each ref
```

Query market_comp_stats view, return JSON:
```json
{
  "126710BLRO": { "floor": 21000, "avg": 23400, "ceiling": 28000, "sold_30d": 8 },
  "5711-1R-001": { "floor": 155000, "avg": 171000, "ceiling": 198000, "sold_30d": 2 }
}
```

---

## STEP 4: Market badge component — src/components/shared/market-badge.tsx

Props: `{ askingPrice: number, marketAvg: number, soldCount: number }`

Shows:
- If asking > market avg by >5%: red badge "X% above market"
- If asking < market avg by >5%: green badge "X% below market"
- If within 5%: gray badge "At market"
- Below: "eBay: $X avg · Y sold/30d" in gray 11px

Used on listing cards and detail pages.

---

## STEP 5: Update listing card — src/components/network/listing-card.tsx

The network grid needs to fetch market stats and pass them to cards.
Update src/components/network/network-grid.tsx to:
1. After listings load, fetch /api/market/stats?refs=[all listing refs joined by comma]
2. Pass marketStats map to each ListingCard

Update ListingCard to accept optional `marketStats` prop:
```typescript
interface MarketStats { floor: number; avg: number; ceiling: number; sold_30d: number; }
interface ListingCardProps { listing: ListingWithRelations; marketStats?: MarketStats; }
```

Show MarketBadge below price if marketStats available.

---

## STEP 6: Update listing detail — src/app/listing/[id]/page.tsx

On the detail page, fetch market comps for this listing's reference:
```typescript
const { data: comps } = await supabase
  .from('market_comps')
  .select('*')
  .eq('reference_number', listing.reference_number)
  .order('sale_date', { ascending: false })
  .limit(20);
```

Add a "Market Comps" card below the price card:
- Header: "eBay Recent Sales" + "X sold in last 30 days"
- Stats row: Floor $X | Avg $X | Ceiling $X
- MarketBadge showing vs RC Crown asking
- Table of recent comps (last 10):
  - Title (truncated 40 chars) | Price | Date | Link icon →

Also populate the price history chart with market_comps data:
- X-axis: sale_date
- Y-axis: price
- Blue line for market comps, show asking price as horizontal dashed line

---

## STEP 7: Per-ref deep dive page — src/app/ref/[reference]/page.tsx (NEW)

URL: /ref/126710BLRO

Shows everything about a specific reference:
- Header: Brand + Model name + Reference number
- Stats: Current listings on OpenWatch | eBay floor | eBay avg | eBay sold/30d
- Price history chart (all time from market_comps)
- All OpenWatch listings for this ref (card grid)
- All eBay comps table (paginated)
- "Watch this ref" button (future: alerts)

---

## STEP 8: Market comps API — src/app/api/market/comps/route.ts

GET /api/market/comps?ref=126710BLRO&limit=20
Returns array of market_comps for a reference number.

---

## STEP 9: Scraper status on analytics page

Update src/app/analytics/page.tsx to show:
- "Market Data" section header
- "Last updated: X minutes ago" (from MAX scraped_at in market_comps)
- "X total comps · Y refs covered · Z avg comps per ref"
- Button: "Refresh Market Data" → POST /api/market/refresh (triggers scrape)

POST /api/market/refresh route — src/app/api/market/refresh/route.ts:
- Runs the scraper logic inline (not via child process)
- Returns { started: true, refs: count }

---

## DONE CRITERIA

1. Migration 00015 applied to Supabase ✅
2. scripts/scrape-ebay.mjs exists and runs cleanly ✅
3. /api/market/stats returns data for known refs ✅
4. Listing cards show market badge (above/below/at market) ✅
5. Listing detail shows eBay comps table + price history chart ✅
6. /ref/[reference] deep dive page works ✅
7. Analytics page shows market data stats ✅
8. npx tsc --noEmit = 0 errors ✅
9. git add -A && git commit -m "feat: market intelligence — eBay sold comps, market badges, ref deep dive" ✅

After committing, run the scraper:
```bash
node scripts/scrape-ebay.mjs
```

When completely finished (including scraper run) run:
openclaw system event --text "Done: OpenWatch Agent 5 — market intelligence built. eBay comps scraped for all refs." --mode now
