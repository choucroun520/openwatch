Read CLAUDE.md, OPENWATCH-CONTEXT.md, and all existing src/ files before writing anything.

You are rebuilding OpenWatch as a **pure analytics platform** — no dealer onboarding, no marketplace. The goal: track floor prices, trends, and market intelligence for 6 luxury watch brands globally.

Target brands: Rolex, Richard Mille, Patek Philippe, Vacheron Constantin, F.P. Journe, Audemars Piguet.
Year filter: 2005+ only (no vintage).

DO NOT touch: middleware.ts, auth logic, FlareSolverr scripts.

---

## STEP 1: Migration 00018 — unified market_data table

File: `supabase/migrations/00018_market_data.sql`

```sql
-- Unified market intelligence table — every listing from every source
CREATE TABLE IF NOT EXISTS market_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Watch identity
  ref_number TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT,

  -- Price
  price NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_sold BOOLEAN NOT NULL DEFAULT FALSE, -- false=asking, true=confirmed sold

  -- Condition
  condition TEXT,           -- 'unworn' | 'excellent' | 'very_good' | 'good' | 'fair'
  has_box BOOLEAN,
  has_papers BOOLEAN,
  year INTEGER,             -- production year of this specific watch

  -- Source
  source TEXT NOT NULL,     -- 'chrono24' | 'ebay' | 'watchbox' | 'bobswatches' | 'phillips' | 'sothebys'
  source_id TEXT,           -- original listing ID on source platform
  dealer_name TEXT,
  dealer_country TEXT,
  listing_url TEXT,

  -- Dates
  listed_at TIMESTAMPTZ,
  sold_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_md_ref ON market_data(ref_number);
CREATE INDEX IF NOT EXISTS idx_md_brand ON market_data(brand);
CREATE INDEX IF NOT EXISTS idx_md_source ON market_data(source);
CREATE INDEX IF NOT EXISTS idx_md_is_sold ON market_data(is_sold);
CREATE INDEX IF NOT EXISTS idx_md_price ON market_data(price);
CREATE INDEX IF NOT EXISTS idx_md_scraped ON market_data(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_md_listed ON market_data(listed_at DESC);
CREATE INDEX IF NOT EXISTS idx_md_source_id ON market_data(source, source_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_md_source_unique ON market_data(source, source_id) WHERE source_id IS NOT NULL;

-- RLS: public read
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read market_data" ON market_data FOR SELECT USING (true);
CREATE POLICY "Service write market_data" ON market_data FOR ALL USING (true);

-- ─── Analytics Views ─────────────────────────────────────────────────────────

-- Per-ref current market stats (asking prices only, last 30 days)
CREATE OR REPLACE VIEW ref_market_stats AS
SELECT
  ref_number,
  brand,
  model,
  COUNT(*) AS total_listings,
  MIN(price) AS floor_price,
  ROUND(AVG(price), 2) AS avg_price,
  MAX(price) AS ceiling_price,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) AS median_price,
  MAX(scraped_at) AS last_updated
FROM market_data
WHERE
  is_sold = FALSE
  AND price > 1000
  AND scraped_at >= NOW() - INTERVAL '30 days'
GROUP BY ref_number, brand, model;

-- Per-ref sold stats (actual transaction prices, last 90 days)
CREATE OR REPLACE VIEW ref_sold_stats AS
SELECT
  ref_number,
  brand,
  model,
  COUNT(*) AS total_sold,
  MIN(price) AS sold_floor,
  ROUND(AVG(price), 2) AS sold_avg,
  MAX(price) AS sold_ceiling,
  MAX(sold_at) AS last_sold_at
FROM market_data
WHERE
  is_sold = TRUE
  AND price > 1000
  AND scraped_at >= NOW() - INTERVAL '90 days'
GROUP BY ref_number, brand, model;

-- Price trend: 30-day change per ref
CREATE OR REPLACE VIEW ref_price_trend AS
WITH
  recent AS (
    SELECT ref_number, brand, ROUND(AVG(price),2) AS avg_price
    FROM market_data
    WHERE is_sold = FALSE AND price > 1000
      AND scraped_at >= NOW() - INTERVAL '7 days'
    GROUP BY ref_number, brand
  ),
  older AS (
    SELECT ref_number, brand, ROUND(AVG(price),2) AS avg_price
    FROM market_data
    WHERE is_sold = FALSE AND price > 1000
      AND scraped_at >= NOW() - INTERVAL '37 days'
      AND scraped_at < NOW() - INTERVAL '7 days'
    GROUP BY ref_number, brand
  )
SELECT
  r.ref_number,
  r.brand,
  r.avg_price AS current_avg,
  o.avg_price AS prior_avg,
  ROUND(((r.avg_price - o.avg_price) / NULLIF(o.avg_price, 0)) * 100, 2) AS change_pct_30d
FROM recent r
LEFT JOIN older o USING (ref_number, brand)
WHERE o.avg_price IS NOT NULL;

-- Heat index: combines listing volume + price trend + recency
CREATE OR REPLACE VIEW ref_heat_index AS
SELECT
  ms.ref_number,
  ms.brand,
  ms.model,
  ms.avg_price,
  ms.total_listings,
  COALESCE(ss.total_sold, 0) AS total_sold_90d,
  COALESCE(pt.change_pct_30d, 0) AS price_change_30d,
  -- Heat = weighted score (more listings + more sold + positive trend = hotter)
  ROUND(
    (LEAST(ms.total_listings, 100) * 0.3) +
    (LEAST(COALESCE(ss.total_sold, 0), 50) * 0.4) +
    (GREATEST(COALESCE(pt.change_pct_30d, 0), 0) * 0.3),
  2) AS heat_score
FROM ref_market_stats ms
LEFT JOIN ref_sold_stats ss USING (ref_number, brand)
LEFT JOIN ref_price_trend pt USING (ref_number, brand)
ORDER BY heat_score DESC;
```

Apply: `npx supabase db push --local=false`

---

## STEP 2: Migration script — migrate existing data into market_data

File: `scripts/migrate-to-market-data.mjs`

Reads from:
- `market_comps` table (existing chrono24 asking + ebay sold comps)

Maps to `market_data`:
- source='chrono24' comps → is_sold=false
- source='ebay' comps → is_sold=true (eBay sold listings are completed sales)

```javascript
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: comps } = await sb.from('market_comps').select('*');
  console.log(`Migrating ${comps.length} market_comps...`);

  const ALLOWED_BRANDS = ['rolex','richard mille','patek','vacheron','f.p. journe','fp journe','audemars'];

  const rows = comps
    .filter(c => c.price > 1000)
    .filter(c => ALLOWED_BRANDS.some(b => (c.brand_name||'').toLowerCase().includes(b)))
    .map(c => ({
      ref_number: c.reference_number,
      brand: c.brand_name || 'Unknown',
      price: c.price,
      currency: c.currency || 'USD',
      is_sold: c.source === 'ebay',
      source: c.source,
      source_id: c.id,
      listing_url: c.listing_url,
      listed_at: c.sale_date ? new Date(c.sale_date).toISOString() : null,
      sold_at: (c.source === 'ebay' && c.sale_date) ? new Date(c.sale_date).toISOString() : null,
      scraped_at: c.scraped_at || c.created_at,
      first_seen_at: c.created_at,
      last_seen_at: c.scraped_at || c.created_at,
    }));

  console.log(`Inserting ${rows.length} rows into market_data...`);
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await sb.from('market_data').insert(rows.slice(i, i+200));
    if (error) console.error('Insert error:', error.message);
    else console.log(`  ${Math.min(i+200, rows.length)}/${rows.length}`);
  }
  console.log('Done!');
}
main().catch(console.error);
```

---

## STEP 3: Update Chrono24 market scraper output

Update `scripts/scrape-chrono24-market.mjs` to also write into `market_data` in addition to `market_comps`:

After inserting into `market_comps`, also upsert into `market_data` with:
- `is_sold: false`
- `source: 'chrono24'`
- `source_id: listing.chrono24Id`

---

## STEP 4: Redesign the UI as analytics platform

### 4a: New main page layout

The `/network` page was a listings marketplace. Rename/repurpose it.

**New page structure:**
```
/                    → redirect to /analytics
/analytics           → main dashboard (floor prices, heat map, trends)
/ref/[refNumber]     → deep dive on one reference
/brands              → brand comparison page
/trending            → top movers this week
/sold                → recent confirmed sales
/news                → brand news feed (Phase 2, stub for now)
```

### 4b: Main analytics dashboard — src/app/analytics/page.tsx

Full redesign. This is the homepage. Layout:

**Top stats bar (4 cards):**
- Total listings tracked (count from market_data where is_sold=false)
- Confirmed sales (90d) (count from market_data where is_sold=true)
- Refs tracked (distinct ref_number count)
- Last data update (max scraped_at)

**Brand performance table:**
Columns: Brand | Refs Tracked | Avg Price | 30d Change | Heat Score | Action
Rows: one per brand (Rolex, AP, Patek, VC, RM, FPJ)
Sorted by heat score desc.

**Top 10 trending refs table:**
From `ref_heat_index` view. Columns: Ref | Model | Floor | Avg | 30d % | Heat | Listings | Action→

**Top 10 recently sold:**
From market_data where is_sold=true, order by sold_at desc limit 10.
Show: Ref | Price | Condition | Source | Date

**Price distribution chart (per brand):**
Bar chart showing avg prices across refs for selected brand.

### 4c: Reference deep dive — src/app/ref/[refNumber]/page.tsx

Header: Brand logo + Ref number + Model name

**Stats row:** Floor | Avg | Ceiling | 30d change | Listed now | Sold (90d)

**Price history chart:**
- X axis: date (last 90 days)
- Y axis: price
- Two lines: asking price avg (blue) + sold price avg (green)
- Use recharts or similar

**Current listings table:**
From market_data where ref_number=X and is_sold=false, order by price asc.
Columns: Price | Condition | Box/Papers | Source | Dealer | Listed | Link→

**Recent sales table:**
From market_data where ref_number=X and is_sold=true, order by sold_at desc.
Columns: Price | Condition | Source | Date | Link→

**Market intelligence sidebar:**
- Grey market premium: (avg_asking - retail_msrp) / retail_msrp * 100
- Days on market avg: computed if we have listed_at data
- Buy signal: simple rule-based (price below 90d avg = green, above = red)

### 4d: Trending page — src/app/trending/page.tsx

Table from `ref_heat_index` view, sorted by heat_score desc.
With filter tabs: All | Rolex | Patek | AP | Vacheron | RM | FP Journe

### 4e: Sold page — src/app/sold/page.tsx

Recent confirmed sales from market_data where is_sold=true.
Shows: ref, price, condition, source, date. Filterable by brand.

### 4f: Navigation update

Update sidebar to reflect analytics platform:
- 📊 Analytics (was Network)
- 🔥 Trending
- 💰 Sold
- 🔍 Search refs
- 📰 News (stub — coming soon)
- ⚙️ Settings → scraper controls

Remove: "Make Offer", dealer onboarding, listing detail pages (or keep but deprioritize).

---

## STEP 5: API routes for analytics

### GET /api/analytics/summary
Returns: { total_listings, total_sold_90d, refs_tracked, last_updated, brands: [{brand, avg_price, change_30d, heat_score}] }
Queries market_data + ref_heat_index.

### GET /api/analytics/trending?limit=20&brand=Rolex
Returns top refs from ref_heat_index view. Filterable by brand.

### GET /api/analytics/ref/[refNumber]
Returns: { market_stats, sold_stats, price_history: [{date, avg_asking, avg_sold}], listings: [], sales: [] }

---

## STEP 6: Price history data for charts

The `ref_market_stats` view gives current snapshot but not history.

Add a lightweight price history table:

```sql
-- In migration 00018 or a new one
CREATE TABLE IF NOT EXISTS price_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_number TEXT NOT NULL,
  brand TEXT NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  floor_price NUMERIC(14,2),
  avg_price NUMERIC(14,2),
  ceiling_price NUMERIC(14,2),
  listing_count INTEGER,
  sold_count INTEGER,
  source TEXT DEFAULT 'all',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ref_number, snapshot_date, source)
);
CREATE INDEX IF NOT EXISTS idx_snapshots_ref ON price_snapshots(ref_number, snapshot_date DESC);
```

Add a script `scripts/snapshot-prices.mjs` that:
1. Queries `ref_market_stats` + `ref_sold_stats` for all tracked refs
2. Inserts one row per ref per day into `price_snapshots`
3. This builds the historical chart data over time

Run it once now to seed today's snapshot, then add to Vercel cron (daily at midnight).

---

## DONE CRITERIA

1. Migration 00018 applied (market_data + views + price_snapshots) ✅
2. `node scripts/migrate-to-market-data.mjs` runs, existing data migrated ✅
3. `node scripts/snapshot-prices.mjs` runs, seeds today's snapshots ✅
4. /analytics page shows: stats bar, brand table, trending refs, recent sales ✅
5. /ref/[refNumber] shows: price history chart, current listings, recent sales ✅
6. /trending page works with brand filter tabs ✅
7. /sold page works ✅
8. Sidebar updated to analytics nav ✅
9. npx tsc --noEmit = 0 errors ✅
10. git add -A && git commit -m "feat: analytics platform — market_data table, dashboard, trending, sold, ref deep dive" ✅
11. git push origin main ✅

When completely done:
openclaw system event --text "Done: OpenWatch Agent 8 — full analytics platform built. market_data unified table, analytics dashboard, trending, sold pages, ref deep dive with price charts." --mode now
