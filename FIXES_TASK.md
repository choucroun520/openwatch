# OpenWatch — Fix All Broken Pages & Remove All Mock Data

## Goal
Make every page show real data from the DB. Nothing mock, nothing empty, nothing broken.
Current DB state: listings=115 (RC Crown), market_comps=2316 (Chrono24), market_data=1000, ref_heat_index=25, market_sales=0, price_history=0, market_events=0, sentiment_reports=12 (fake).

---

## FIX 1 — Seed `price_history` from `market_comps`

**File:** Create `scripts/seed-price-history.mjs`

Logic:
- Read all rows from `market_comps` grouped by `(ref_number, brand, source)`
- For each group compute: avg_price, floor_price (5th percentile), ceiling_price (95th percentile), listing_count
- Upsert into `price_history` table with `snapshot_date = today` and `source = 'chrono24'`
- Also check if `price_history` table exists — if not, create it via Supabase

`price_history` schema (create if missing via Supabase JS client):
```sql
create table if not exists price_history (
  id uuid default gen_random_uuid() primary key,
  ref_number text not null,
  brand text not null,
  model_name text,
  avg_price numeric,
  floor_price numeric,
  ceiling_price numeric,
  listing_count integer default 0,
  sold_count integer default 0,
  snapshot_date date not null,
  source text not null default 'chrono24',
  created_at timestamptz default now(),
  unique(ref_number, snapshot_date, source)
);
```

Run the script immediately after creating it: `node scripts/seed-price-history.mjs`

---

## FIX 2 — Fix `ref_heat_index` heat scores

**File:** Create `scripts/rebuild-heat-index.mjs`

Current problem: all 25 rows have heat_score=18 (fake). Need real scores.

Logic per ref:
- `listing_count` = count of active listings in market_data
- `price_premium_pct` = (avg_price - MSRP) / MSRP * 100 (use MSRP map below)
- `heat_score` = min(100, listing_count * 0.5 + max(0, price_premium_pct) * 0.5)
- `price_change_30d` = null for now (no history yet — will populate as snapshots accumulate)

MSRP map to embed in script:
```js
const MSRP = {
  "126610LN": 9100, "126610LV": 9100, "126710BLRO": 10800, "126710BLNR": 10800,
  "126720VTNR": 10800, "126500LN": 14800, "124060": 8100, "126333": 9750,
  "228238": 36100, "326938": 29500, "5711/1A-011": 31000, "5726/1A-001": 59500,
  "5980/1AR-001": 65800, "15510ST.OO.1320ST.06": 22100,
  "26240ST.OO.1320ST.02": 29900, "26331ST.OO.1220ST.03": 28900,
  "4500V/110A-B128": 22900
}
```

Upsert results into `ref_heat_index`. Run immediately after creating.

---

## FIX 3 — Fix `/sold` page to use `market_comps` as fallback

**File:** `src/app/sold/page.tsx`

Current problem: reads `market_sales` which has 0 rows → blank page.

Fix: When `market_sales` is empty, fall back to `market_comps` ordered by `scraped_at DESC`.
- Show listings from `market_comps` styled as "Market Listings" (not "Sold") with a banner: "Confirmed sale records coming soon — showing current market listings"
- Map `market_comps` fields: ref_number, brand, price, currency, source, scraped_at, dealer_name, listing_url
- Keep existing filter UI (brand dropdown)
- Show source badge per row (chrono24, rccrown, etc.)

---

## FIX 4 — Fix `/activity` page to use `listings` as fallback

**File:** `src/app/activity/page.tsx`

Current problem: reads `market_events` which has 0 rows → blank page.

Fix: When `market_events` is empty, synthesize events from `listings` table:
- Each listing with status='active' → event type `listing_created`, event_time = `listed_at`
- Each listing with status='sold' → event type `listing_sold`, event_time = `sold_at`
- Show listing reference, price, dealer name, time ago
- Add banner: "Live market events coming soon — showing recent listing activity"
- Read from `listings` table joined with `profiles` (dealer company_name) ordered by listed_at DESC limit 50

---

## FIX 5 — Fix Analytics Sentiment tab — remove mock data

**File:** `src/app/api/analytics/sentiment/route.ts`

Current problem: POST endpoint returns hardcoded fake `mockData` array. GET returns real DB rows but DB only has whatever was seeded.

Fix:
- DELETE the entire `POST` function and mock data — remove all ~80 lines of mock
- GET: return real rows from `sentiment_reports` table ordered by `created_at DESC` limit 20
- If table is empty or returns 0 rows, return empty array `[]` — let the UI handle the empty state
- Add a proper empty state in `src/app/analytics/page.tsx` Sentiment tab: show a card that says "No sentiment reports yet — sentiment analysis runs automatically when market data is refreshed" with a subtle icon

---

## FIX 6 — Fix Analytics Trends tab empty state

**File:** `src/app/analytics/page.tsx` — Trends tab section

Current problem: `price_history` has 0 rows → Trends tab shows nothing or errors.

Fix:
- After FIX 1 seeds price_history, the tab will have data
- But also add an explicit empty state UI for when price_history is empty: card with "Price trend data accumulates daily. Check back tomorrow for 7-day and 30-day momentum charts." with a TrendingUp icon
- The existing fetch to `/api/analytics/trends` is fine — just needs the empty state UI

---

## FIX 7 — Fix Analytics Arbitrage tab empty/misleading state

**File:** `src/app/analytics/page.tsx` — Arbitrage tab section
**File:** `src/app/api/analytics/arbitrage/route.ts`

Current problem: Only has USD Chrono24 data — no real cross-currency comps. Shows fake arbitrage opportunities.

Fix in API route:
- Query `market_comps` grouped by ref_number
- Only return arbitrage opportunities where the same ref has listings in BOTH a non-USD currency AND USD
- If no cross-currency pairs exist, return `[]`

Fix in UI:
- If `arbData.length === 0`, show empty state: "No cross-market arbitrage opportunities found. Arbitrage analysis requires price data from multiple currency markets. Add EU/JP/CH market data sources in Settings." with a Globe icon and link to /settings

---

## FIX 8 — Fix `/trending` page ranking

**File:** `src/app/trending/page.tsx`

Current problem: reads `ref_heat_index` but after FIX 2, scores will be real. 
Also fix UI: if heat_score and price_change_30d are null or 0, show "—" not "0%".
Add: show listing count badge on each row.
Add: show MSRP vs current price delta for known refs.

---

## FIX 9 — Dealers page — handle empty chrono24_dealers

**File:** `src/app/dealers/page.tsx` and `src/app/dealers/chrono24-dealers-section.tsx`

Current problem: `chrono24_dealers` has 0 rows — section may show empty or error.

Fix: In chrono24-dealers-section, if 0 rows returned show a clean empty state card: "Dealer intelligence database is being built. Run the Chrono24 dealer scraper to populate." — don't crash, don't show broken UI.

---

## FIX 10 — Settings page — seed `app_settings` defaults

**File:** Create `scripts/seed-app-settings.mjs`

Current: `app_settings` has 0 rows → settings page shows all keys as "not set"

Seed these rows (key, value) with empty string values so the UI renders correctly:
- EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, WATCHCHARTS_API_KEY
- REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET
- OPENAI_API_KEY, ANTHROPIC_API_KEY

These are just placeholders — value = "" — so the settings page shows them as "not configured" vs erroring.

---

## POLISH — Empty states everywhere

For every page/tab that can be empty, use this consistent empty state pattern:
```tsx
<div style={{ 
  border: "1px dashed var(--ow-border)", 
  borderRadius: 12, 
  padding: "48px 24px",
  textAlign: "center"
}}>
  <Icon size={32} style={{ color: "var(--ow-text-dim)", margin: "0 auto 12px" }} />
  <p style={{ color: "var(--ow-text-muted)", fontWeight: 600, marginBottom: 4 }}>Title</p>
  <p style={{ color: "var(--ow-text-dim)", fontSize: 13 }}>Explanation</p>
</div>
```

---

## After all fixes

1. Run `node scripts/seed-price-history.mjs`
2. Run `node scripts/rebuild-heat-index.mjs`
3. Run `npx tsc --noEmit` — fix any errors
4. `git add -A && git commit -m "fix: remove all mock data, fix empty pages, seed real data from market_comps"`
5. `git push origin feat/data-fixes`
6. `gh pr create --fill --base main`
7. `openclaw system event --text "PR ready: data-fixes — all pages fixed, mock data removed" --mode now`
