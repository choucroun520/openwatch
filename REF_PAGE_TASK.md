# Task: Upgrade /ref/[reference] to Premium Money Page

## Goal
Transform `/ref/[reference]` from a basic listing page into the best single-reference intelligence page on the web. This is the page users bookmark. Make it feel like a Bloomberg terminal for one watch.

## File to edit
`src/app/ref/[reference]/page.tsx` — currently ~250 lines, reads from market_data and price_history tables.

## Current DB state (use this data)
- `market_data`: 1000 rows (ref_number, brand, price, source, condition, has_box, has_papers, dealer_name, listing_url, scraped_at, is_sold)
- `price_history`: seeded with today's snapshot (avg_price, floor_price, ceiling_price, listing_count per ref)
- `listings`: 115 rows (RC Crown inventory — these are high quality)
- `market_sales`: may have rows from scraper agent running in parallel (check, don't crash if empty)

## MSRP reference table (embed in page)
```ts
const MSRP: Record<string, number> = {
  "126610LN": 9100, "126610LV": 9100, "126710BLRO": 10800, "126710BLNR": 10800,
  "126720VTNR": 10800, "126500LN": 14800, "124060": 8100, "126333": 9750,
  "228238": 36100, "326938": 29500, "5711/1A-011": 31000, "5726/1A-001": 59500,
  "5980/1AR-001": 65800, "15510ST.OO.1320ST.06": 22100,
  "26240ST.OO.1320ST.02": 29900, "26331ST.OO.1220ST.03": 28900,
  "4500V/110A-B128": 22900
}
```

## Page sections to build

### 1. Hero Header
- Large ref number (monospace, bold)
- Brand name + model name below
- Four stat pills inline: Floor Price | Avg Price | # Listings | Grey Market Premium %
- Grey market premium = ((avg_price - MSRP) / MSRP * 100). Show green if < 20%, amber 20-50%, red > 50%
- "Best deal right now" badge pointing to lowest priced active listing

### 2. Price Intelligence Bar (below header)
Three columns side by side:
- **Floor** (lowest active listing) in green
- **Average** (mean of active listings) in blue  
- **Ceiling** (highest active listing) in red/muted
- Small label under each: "floor", "market avg", "ceiling"
- MSRP shown as a baseline marker if known: "MSRP $X,XXX"

### 3. Active Listings Grid
All active listings from `market_data` for this ref, sorted by price ascending by default.
- Sort controls: Price ↑, Price ↓, Newest, Source
- Filter chips: All Sources | Chrono24 | RC Crown | WatchBox | eBay
- Filter chips: All Conditions | Unworn | Excellent | Good
- Each card shows:
  - Price (large, bold) with currency
  - Source badge with trust indicator dot (green=high trust, yellow=medium)
  - Condition badge
  - Box/Papers icons (📦 📄) if present
  - Dealer name
  - Time ago (scraped_at)
  - "View Listing →" link if listing_url exists
- Highlight the single cheapest listing with a subtle "🏆 Best Price" ribbon
- Trust score logic: RC Crown/eBay sold = green dot, Chrono24 physical = yellow, unknown = grey

### 4. Price History Chart
Use the existing `PriceHistoryDualChart` component if it exists, or build a simple recharts AreaChart.
- X axis: dates from price_history snapshots
- Y axis: price in USD
- Two lines: avg_price (blue) and floor_price (green)
- If only 1 snapshot (today), show a single point with message: "Price history is being tracked — check back in 24h for trend data"
- Toggle: 7D / 30D / 90D (filter price_history rows by date range)

### 5. Market Sales (Confirmed Transactions)
Query `market_sales` for this ref, ordered by sold_at DESC, limit 10.
If empty: show "No confirmed sales recorded yet — auction and eBay data coming soon" with dashed border empty state.
If has data: table with columns: Price | Source | Condition | Box+Papers | Date | Trust

### 6. Reference Intelligence Panel (sidebar or bottom section)
- MSRP: $X,XXX (or "Not listed" if unknown)
- Grey Market Premium: +XX% above retail
- Total active listings: N
- Cheapest listing: $X,XXX (source)
- Most expensive: $X,XXX (source)
- Data freshness: "Updated X hours ago"
- Related refs (same brand, similar price range): show 3-4 ref chips that link to /ref/[ref]

## Design rules
- All colors via CSS vars (--ow-bg-card, --ow-border, etc.) — no hardcoded hex for backgrounds
- Accent colors: blue #2563eb, green #22c55e, amber #eab308, red #ef4444
- Use var(--ow-bg-elevated) for card backgrounds
- Section headers: small uppercase label (10px tracking-widest muted) above h2 with blue left border (3px solid #2563eb, paddingLeft 10px) — consistent with rest of app
- Empty states: dashed border, centered icon + message
- No new npm packages

## After building
1. `npx tsc --noEmit` — fix all errors
2. Commit: `feat(ref-page): premium reference detail — price intel, trust scores, history chart, sales`
3. Push + PR
4. `openclaw system event --text "PR ready: ref-page upgrade" --mode now`
