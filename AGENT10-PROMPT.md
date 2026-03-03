Read CLAUDE.md, OPENWATCH-CONTEXT.md, and all existing src/ files before writing anything.

You are rebuilding the analytics page into the most data-rich, visually stunning watch market intelligence dashboard possible. Think Bloomberg Terminal meets watch market.

recharts@3.7.0 is already installed. Use it for all charts.
Tailwind + shadcn/ui available. Dark theme: bg #0b0b14, cards #111119.

DO NOT touch: middleware.ts, auth logic, migrations, scraper scripts.

---

## CURRENT DATA (from market_data table)
- **1,000 Chrono24 asking-price comps** (is_sold=false)
- Rolex: 741 listings, 20 refs
- Patek Philippe: 163 listings, 3 refs
- Vacheron Constantin: 60 listings, 1 ref
- Audemars Piguet: 36 listings, 1 ref
- Richard Mille: 0 (no data yet)
- F.P. Journe: 0 (no data yet)
- **Condition column is empty** — Chrono24 scraper didn't capture it
- **is_sold=0** — eBay API not connected yet, all data is asking prices
- Some noise: floor prices too low (Rolex $1,307 = accessories/straps getting through)

## DATA QUALITY FIX
Add `AND price > 4000` filter on all analytics queries for Rolex.
Add `AND price > 10000` for Patek.
Add `AND price > 5000` for Vacheron.
Add `AND price > 50000` for AP.
This removes accessories/straps/parts from analytics.

## MSRP REFERENCE TABLE (static, hardcode in code)
Use for grey market premium calculation: (market_avg - msrp) / msrp * 100

```typescript
const MSRP: Record<string, number> = {
  // Rolex
  '126710BLRO': 10800,   // GMT-Master II Pepsi
  '126710BLNR': 10800,   // GMT-Master II Batman
  '126720VTNR': 10800,   // GMT-Master II Sprite
  '126610LN': 9100,      // Submariner Date
  '126610LV': 9100,      // Submariner Hulk
  '126613LN': 12550,     // Submariner Two-Tone
  '124060': 8100,        // Submariner No Date
  '126234': 7150,        // Datejust 36
  '126333': 9750,        // Datejust 41 Two-Tone
  '126334': 8950,        // Datejust 41 Steel
  '116500LN': 14550,     // Daytona Steel
  '126500LN': 14800,     // Daytona Steel (new)
  '228395TBR': 485350,   // Day-Date 40 Meteorite
  // Patek
  '5711/1A-011': 31000,  // Nautilus (discontinued)
  '5712/1A-001': 56900,  // Nautilus Moonphase
  '5726/1A-014': 59500,  // Annual Calendar
  // AP
  '15510ST.OO.1320ST.06': 22100, // Royal Oak 41
  '26240ST.OO.1320ST.02': 29900, // Royal Oak Chrono
  // Vacheron
  '4500V/110A-B128': 22900, // Overseas 41
};
```

---

## STEP 1: Enhanced API route — /api/analytics/summary/route.ts

Completely rewrite this route to return ALL data needed for the dashboard:

```typescript
{
  overview: {
    total_listings: number,
    refs_tracked: number,
    brands_covered: number,
    last_updated: string,
    data_freshness_hours: number,
  },
  brands: Array<{
    brand: string,
    total_listings: number,
    refs_count: number,
    floor_price: number,
    avg_price: number,
    ceiling_price: number,
    price_range: number,        // ceiling - floor
    change_30d: number,         // % from ref_price_trend view
    heat_score: number,
  }>,
  top_refs: Array<{             // top 15 by listing count
    ref_number: string,
    brand: string,
    model: string,
    floor: number,
    avg: number,
    ceiling: number,
    listings: number,
    spread: number,             // ceiling - floor
    spread_pct: number,         // (ceiling - floor) / avg * 100
    change_30d: number,
    heat_score: number,
    msrp: number | null,
    grey_market_premium_pct: number | null,  // (avg - msrp) / msrp * 100
  }>,
  deals: Array<{                // listings priced >8% below ref avg
    ref_number: string,
    brand: string,
    price: number,
    ref_avg: number,
    discount_pct: number,
    listing_url: string,
    source: string,
    scraped_at: string,
  }>,
  price_distribution: Array<{  // for histogram chart
    brand: string,
    bucket: string,             // e.g. "$20K-25K"
    count: number,
    min: number,
    max: number,
  }>,
  supply_by_ref: Array<{        // for supply chart
    ref_number: string,
    brand: string,
    count: number,
  }>,
}
```

Query with brand-specific price minimums to filter out accessories:
- Rolex: price > 4000
- Patek Philippe: price > 10000
- Vacheron Constantin: price > 5000
- Audemars Piguet: price > 50000

For deals: join market_data with ref_market_stats (the Supabase view), find listings where price < (avg_price * 0.92).

For price_distribution: bucket prices into ranges (compute in JS, not SQL).

---

## STEP 2: Full analytics page rebuild — src/app/analytics/page.tsx

Make this a CLIENT COMPONENT (`"use client"`) that fetches from /api/analytics/summary.
Use useState/useEffect for interactive filters.

### Layout (top to bottom):

---

### Section 1: Page Header
```
MARKET INTELLIGENCE                    [Last updated: 3 min ago]
Real-time watch market analytics       [1,000 listings · 24 refs · 4 brands]
```

---

### Section 2: Brand Overview Cards (horizontal scroll on mobile, grid on desktop)
6 cards (one per brand). For brands with no data show "No data yet — add a dealer".

Each card:
```
┌─────────────────────────────┐
│ 🟢 ROLEX          +2.3% ↑  │  ← brand name + 30d trend badge
│                              │
│ Floor    Avg      Ceiling    │
│ $7,150   $41,414  $143,800  │
│                              │
│ 741 listings · 20 refs      │
│ ████░░░░░░ Heat: 72         │  ← heat bar
└─────────────────────────────┘
```
Click card → navigates to /brands/[brand]

---

### Section 3: Market Pulse (4 metric cards in a row)
```
📊 Most Listed Ref    💰 Highest Floor      📉 Widest Spread    🔥 Hottest Brand
  126234 (60 units)     AP 15510ST $148K     Rolex 116500LN       Patek Philippe
  Rolex Datejust 36     Most expensive        $98K spread          Heat: 16.3
```

---

### Section 4: Price Distribution Chart (recharts BarChart)
Title: "Price Distribution by Brand"
- X axis: price ranges ($0-10K, $10-25K, $25-50K, $50-100K, $100K+)
- Y axis: number of listings
- Grouped bars (one color per brand)
- Use BRAND_COLORS: Rolex=#10b981, Patek=#6366f1, AP=#f59e0b, Vacheron=#ec4899

```tsx
// Brand color map
const BRAND_COLORS: Record<string, string> = {
  'Rolex': '#10b981',
  'Patek Philippe': '#6366f1',
  'Audemars Piguet': '#f59e0b',
  'Vacheron Constantin': '#ec4899',
  'Richard Mille': '#ef4444',
  'F.P. Journe': '#8b5cf6',
};
```

---

### Section 5: Top Refs Table — "Market Overview"
Title: "All Tracked References" with brand filter tabs (All | Rolex | Patek | AP | VC)

Columns:
| Ref | Model | Floor | Avg | Ceiling | Spread | Grey Mkt Premium | Listings | 30d | Heat |

- **Spread** = ceiling - floor, shown as "$X,XXX"
- **Grey Mkt Premium** = if MSRP known: show "+X% above retail" (green=below retail, amber=0-50% above, red=50%+ above)
- **30d** = price change badge (green/red arrow)
- **Heat** = colored dot (🔴 hot >50, 🟡 warm 20-50, ⚫ cold <20)
- Click row → /ref/[refNumber]

Sort by: Heat (default) | Floor | Avg | Listings | Spread

---

### Section 6: 🔥 Hot Deals Feed
Title: "Potential Deals" subtitle: "Listings priced below market average"

Only show if deals array has items. If no deals: show empty state "No deals detected — market is fairly priced right now"

Each deal card:
```
┌─────────────────────────────────────────┐
│ ROLEX 126710BLRO                        │
│ GMT-Master II Pepsi                      │
│                                          │
│ Listed: $22,100    Ref avg: $23,600     │
│         ↑ -6.4% below market           │
│                                          │
│ [View on Chrono24 →]                    │
└─────────────────────────────────────────┘
```

---

### Section 7: Supply Analysis Chart (recharts BarChart horizontal)
Title: "Supply by Reference (Top 15)"
Horizontal bar chart: ref numbers on Y axis, listing count on X axis.
Color bars by brand using BRAND_COLORS.
Click bar → /ref/[refNumber]

---

### Section 8: Grey Market Premium Table
Title: "Grey Market vs. Retail"
Only show refs where MSRP is known.

Columns: Watch | Retail MSRP | Market Avg | Premium | # Listed

```
Rolex GMT-Master II Pepsi  | $10,800  | $23,600  | +118% | 60 listings
Rolex Submariner Date      | $9,100   | $18,400  | +102% | 45 listings
Patek Nautilus 5711/1A     | $31,000  | $141,000 | +355% | 28 listings
```

Sort by premium % descending. This is gold data.

---

### Section 9: Data Coverage Card
Title: "Data Coverage"
Small card showing:
- "1,000 Chrono24 asking prices scraped"
- "0 confirmed sales (eBay API key needed)"
- "Last Chrono24 sync: X hours ago"
- "Next sync: in X hours"
- [Refresh Data] button → POST /api/chrono24/refresh (triggers rescrape)

---

## STEP 3: Loading skeleton — src/app/analytics/loading.tsx

Beautiful loading skeleton that mirrors the layout: pulsing gray bars where content will be.

---

## STEP 4: Responsive design requirements
- Mobile: single column, brand cards scroll horizontally, tables become cards
- Desktop: 2-3 column grid for brand cards, full tables
- All charts responsive (ResponsiveContainer from recharts)

---

## STEP 5: Performance
- Page fetches ONE endpoint (/api/analytics/summary) not multiple
- API route does all DB queries in parallel (Promise.all)
- Add revalidate = 300 (5 min cache) to the API route
- Add Suspense boundary with loading.tsx

---

## DONE CRITERIA

1. /analytics loads with all 8 sections populated with real data ✅
2. Brand cards show correct floor/avg/ceiling for Rolex/Patek/AP/Vacheron ✅
3. Price distribution chart renders with recharts ✅
4. Top refs table sortable, brand filterable ✅
5. Grey market premium table shows ✅
6. Supply chart renders ✅
7. Mobile responsive ✅
8. npx tsc --noEmit = 0 errors ✅
9. git add -A && git commit -m "feat: analytics dashboard v2 — price distribution, grey market premium, deals, supply chart, brand cards" ✅
10. git push origin main ✅

When done:
openclaw system event --text "Done: OpenWatch Agent 10 — analytics dashboard v2 complete. All metrics live." --mode now
