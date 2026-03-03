Read CLAUDE.md, OPENWATCH-CONTEXT.md, AGENT9-REQUIREMENTS.md, and all existing src/ files before writing anything.

You are building the collection/dealer browsing UX for OpenWatch analytics platform — OpenSea-style navigation between brands, references, and dealers.

DO NOT touch: middleware.ts, auth logic, migration files, market_data table structure.

Current state:
- market_data table has 1,000 rows (Chrono24 asking prices)
- chrono24_dealers table has dealer records (Jewels in Time: merchant_id=5132)
- /analytics, /trending, /sold, /ref/[refNumber] pages already exist (Agent 8 built them)
- Dark theme: bg #0b0b14, cards #111119, accent blue #2081E2
- Left sidebar navigation already exists (sidebar.tsx)

---

## STEP 1: Fix eBay sold data scraper

The eBay scraper at `scripts/scrape-ebay.mjs` uses Playwright which is crashing.
Rewrite it to use `node-fetch` + HTML parsing (no Playwright) like this:

```javascript
// scripts/scrape-ebay.mjs (rewritten — no Playwright)
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { JSDOM } from 'jsdom';
config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

async function fetchEbaySold(ref, brand) {
  const query = encodeURIComponent(`${brand} ${ref}`);
  const url = `https://www.ebay.com/sch/i.html?_nkw=${query}&LH_Sold=1&LH_Complete=1&_sop=13&_ipg=25`;
  const res = await fetch(url, { headers: HEADERS });
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
  const { data: refs } = await sb.from('market_data')
    .select('ref_number, brand')
    .eq('is_sold', false)
    .order('ref_number');
  
  const unique = {};
  refs?.forEach(r => { if (!unique[r.ref_number]) unique[r.ref_number] = r.brand; });
  const refList = Object.entries(unique);
  console.log(`Scraping eBay sold listings for ${refList.length} refs...`);

  let total = 0;
  for (let i = 0; i < refList.length; i++) {
    const [ref, brand] = refList[i];
    console.log(`[${i+1}/${refList.length}] ${brand} ${ref}`);
    try {
      const items = await fetchEbaySold(ref, brand);
      console.log(`  Found ${items.length} sold listings`);
      if (!items.length) continue;

      const rows = items.map(item => ({
        ref_number: ref,
        brand,
        price: item.price,
        currency: 'USD',
        is_sold: true,
        source: 'ebay',
        source_id: item.link?.match(/itm\/(\d+)/)?.[1] || null,
        listing_url: item.link?.substring(0, 500),
        sold_at: item.dateText ? new Date(item.dateText).toISOString() : null,
        scraped_at: new Date().toISOString(),
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      })).filter(r => r.source_id); // must have ID to dedup

      const { error } = await sb.from('market_data')
        .upsert(rows, { onConflict: 'source,source_id', ignoreDuplicates: true });
      if (error) console.error('  Error:', error.message);
      else total += rows.length;
    } catch (e) {
      console.error(`  Error: ${e.message?.substring(0, 60)}`);
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  console.log(`\n✅ Done! ${total} eBay sold listings added to market_data`);
}
main().catch(console.error);
```

Run it: `node scripts/scrape-ebay.mjs`

---

## STEP 2: Brand collection page — src/app/brands/page.tsx

URL: /brands

Shows all 6 target brands as large cards (like OpenSea categories):

Each brand card:
- Brand name + colored logo (use existing brand-logo.tsx component)
- Stats: X refs tracked | Floor $X | Avg $X
- 30d trend badge (green +X% or red -X%)
- "View Collection →" button

Data: query market_data grouped by brand.

---

## STEP 3: Brand page — src/app/brands/[brand]/page.tsx

URL: /brands/rolex, /brands/patek-philippe, etc.

Header: Brand name + logo + total listings + avg price

Grid of reference cards (like OpenSea NFT collection items):
Each ref card shows:
- Watch image (use a placeholder or first image from market_data for that ref)
- Reference number (bold)
- Model name
- Floor price (lowest current asking)
- # Listed (count of active listings)
- 30d change badge
- Click → goes to /ref/[refNumber]

Filter bar at top:
- Sort: Floor price ↑↓ | Most listed | Trending
- Price range slider

Data: query market_data where brand=X, group by ref_number.

---

## STEP 4: Reference collection page — src/app/ref/[refNumber]/page.tsx

Agent 8 already built a ref page. ENHANCE it (don't replace):

Add below the price charts:

**"All Listings" section** (OpenSea-style grid):
- Grid of listing cards showing EVERY current listing for this ref from market_data
- Each card: price, condition, source badge (C24/eBay/WatchBox), dealer name (clickable), image if available, "View →" button linking to external_url
- Sort: price low→high (default), newest
- Filter: source, condition, has box, has papers

**"Recent Sales" section:**
- Table of confirmed sold listings from market_data where is_sold=true
- Columns: Price | Condition | Source | Date | Link

Make dealer name in every card a clickable link → /dealers/[dealerSlug]

---

## STEP 5: Dealer profile page — src/app/dealers/[slug]/page.tsx

URL: /dealers/jewelsintimeofboca

Header card:
- Dealer name + verified badge
- Location | Member since | Total listings | Avg price
- Chrono24 profile link button

Stats row: Total Listed | Brands | Avg Price | Price Range

**Inventory grid** (same card style as brand/ref pages):
- All listings from market_data where dealer_name matches
- Filter by brand (tab bar: All | Rolex | Patek | AP | Vacheron | RM | FPJ)
- Sort: price, newest, brand
- Each card links to external listing URL

---

## STEP 6: Dealers list page — src/app/dealers/page.tsx

URL: /dealers

Update the existing dealers page to show:

Two sections:

**"Tracked Dealers"** — dealers we actively scrape:
Grid of dealer cards showing:
- Name + verified badge
- Total listings | Brands they carry | Last synced
- "View Inventory" button → /dealers/[slug]
- "Sync Now" button → POST /api/chrono24/scrape

Data: from chrono24_dealers table joined with market_data counts.

---

## STEP 7: Listing card component for analytics context

Create `src/components/analytics/market-listing-card.tsx`:

Props: `{ listing: MarketDataRow, showDealer?: boolean, showSource?: boolean }`

Consistent card used across:
- /ref/[refNumber] listings grid
- /dealers/[slug] inventory grid
- /brands/[brand] ref cards

Card design (dark, OpenSea-inspired):
- Square image area (white bg for watch, dark bg otherwise) 
- Source badge top-right: "C24" (blue), "eBay" (yellow), "WatchBox" (green)
- Price: large, bold
- Condition badge
- Dealer name (clickable if showDealer=true)
- Box/Papers icons
- "View →" external link

---

## STEP 8: Update sidebar navigation

Update `src/components/layout/sidebar.tsx` to add:

```
📊 Analytics          /analytics
🔥 Trending           /trending  
💰 Sold               /sold
🏷️ Brands             /brands      ← NEW
👔 Dealers            /dealers     ← update existing
🔍 Search             /search      ← stub ok
📰 News               /news        ← stub (coming soon)
```

---

## STEP 9: API routes

### GET /api/brands
Returns: [{ brand, refs_count, total_listings, avg_price, floor_price, change_30d }]
Query market_data grouped by brand.

### GET /api/brands/[brand]
Returns: [{ ref_number, model, floor_price, avg_price, listing_count, change_30d }]
Grouped by ref_number for that brand.

### GET /api/dealers
Returns: dealers from chrono24_dealers with listing counts from market_data.

### GET /api/dealers/[slug]
Returns: dealer info + paginated listings from market_data filtered by dealer_name.

### GET /api/ref/[refNumber]/listings
Returns: all market_data rows for a ref (paginated, filterable by source/condition/is_sold).

---

## DONE CRITERIA

1. `node scripts/scrape-ebay.mjs` runs and inserts sold data into market_data ✅
2. /brands page shows all 6 brand cards with stats ✅
3. /brands/rolex shows all Rolex refs as collection grid ✅
4. /ref/[refNumber] has "All Listings" grid + "Recent Sales" section ✅
5. /dealers shows tracked dealers with inventory counts ✅
6. /dealers/[slug] shows full dealer inventory with brand filter tabs ✅
7. Dealer names on all listing cards are clickable links ✅
8. Sidebar updated with Brands + Dealers links ✅
9. npx tsc --noEmit = 0 errors ✅
10. git add -A && git commit -m "feat: collection pages — brands, dealer profiles, ref listings grid (OpenSea UX)" ✅
11. git push origin main ✅

When completely done:
openclaw system event --text "Done: OpenWatch Agent 9 — OpenSea UX complete. Brands page, dealer profiles, ref collection grids, eBay sold data fixed." --mode now
