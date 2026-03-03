Read CLAUDE.md, OPENWATCH-CONTEXT.md, and ALL existing src/ files before writing anything.

You are doing a FULL UI REDESIGN of OpenWatch to match OpenSea.io as closely as possible — same layout, same UX patterns, same feel — but for luxury watches instead of NFTs.

The backend (Supabase, API routes, data fetching) is already built and working with 58 real listings from RC Crown dealer. Do NOT touch API routes or migrations. Only replace/rewrite UI files.

---

## DESIGN SYSTEM (non-negotiable)

**Colors — exact match:**
- Root bg: #0b0b14
- Card bg: #111119
- Elevated (hover/active): #161622
- Border: #1c1c2a
- Border light: #22222e
- Accent blue: #2563eb
- Gradient: from-blue-600 to-purple-600
- Text default: #e2e8f0
- Text muted: #94a3b8
- Text faint: #64748b
- Success: #22c55e
- Danger: #ef4444
- Warning: #eab308

**Typography:** Inter (already installed)
**All prices:** font-mono font-bold — always

---

## PAGE 1: HOMEPAGE — src/app/page.tsx (replaces redirect, becomes real homepage)

OpenSea-style landing page for authenticated dealers (dev mode = no auth).

### A. Top navigation (GLOBAL — update src/components/layout/top-nav.tsx)
Match OpenSea nav exactly:
- Left: ⌚ OpenWatch logo (gradient text)
- Center: large search bar (placeholder "Search watches, references, dealers...") with magnifier icon — full width on mobile
- Right icons row:
  - Explore (dropdown: Network, Brands, Dealers, Rankings)  
  - Stats (link to /rankings)
  - Activity (link to /activity)
  - Notifications bell icon
  - Profile avatar dropdown (My Inventory, Profile, Settings, Sign Out)
  - "List a Watch" button (blue gradient)
- Mobile: hamburger → Sheet with all nav items + search
- Height: 72px, sticky, backdrop-blur-md, border-b

### B. Hero section
Full-width hero, height 500px:
- Background: subtle animated gradient (dark blue → dark purple → dark blue, 8s loop)
- Centered content:
  - "The Dealer Network for Luxury Watches" — text-5xl font-black text-white
  - "Invite-only. Wholesale prices. No middlemen." — text-xl text-muted mt-4
  - Two CTA buttons: [Explore Network] (gradient) [View Rankings] (outline)
- Bottom: 4 animated stat counters (count up on load):
  - Total Watches | Active Dealers | Brands | Network Volume

### C. Trending Brands (OpenSea "Notable Collections" style)
Section title: "Trending Brands" with "View all →" link
Horizontal scroll row of brand cards (no scroll arrows needed):

Each brand card (w-48, h-64, rounded-xl, card bg):
- Top 3/4: brand color gradient background with watch brand initial centered large
- Bottom 1/4: brand name bold, "X listings" muted, floor price in mono
- Hover: scale-105 border-accent

Brands to show: Rolex, Patek Philippe, AP, Vacheron Constantin, Richard Mille

### D. Featured Listings (OpenSea "Recently Listed" grid)
Section title: "Recently Listed" with "See all →"
Grid: 5 columns desktop, 3 tablet, 2 mobile
Show latest 10 listings — same ListingCard as network page

### E. Live Activity Feed preview
Section title: "Live Activity" with "See all →"
Show last 8 market_events in a table:
Event badge | Watch (brand + ref) | Dealer | Price | Time ago
"See full activity →" link at bottom

### F. Stats highlight (OpenSea "Top Collections" table preview)
Section title: "Top Brands by Volume"
Table: Brand | Floor | Avg Price | Listed | 24h Change (mock %)
Show top 5 brands, "View full rankings →" link

---

## PAGE 2: NETWORK (BROWSE) — src/app/network/page.tsx

Full OpenSea collection browse experience.

### Layout: Left sidebar filters + Right items grid

LEFT SIDEBAR (w-64, sticky, hidden mobile → Sheet on mobile):
- "Filter" header with collapse toggle
- STATUS section: checkboxes [Active] [Incoming/Pending]
- BRAND section: checkboxes for each brand with count badge
- CONDITION section: checkboxes [Unworn] [Mint] [Excellent] [Very Good] [Good] [Fair]
- HAS BOX: toggle switch
- HAS PAPERS: toggle switch
- PRICE RANGE: two inputs (Min / Max) + "Apply" button
- YEAR RANGE: two inputs (From / To) + "Apply" button
- [Clear all filters] button at bottom (accent color)

RIGHT MAIN AREA:
- Top bar:
  - "342 watches" count (bold)
  - Active filter chips (e.g. "Rolex ×" "Has Papers ×") — removable pills
  - Sort dropdown: [Recently Listed] [Price: Low→High] [Price: High→Low] [Oldest]
  - View toggle: [Grid icon] [List icon]

- Grid view (4 col desktop, 2 tablet, 1 mobile):
  ListingCard (see below)

- List view:
  Table: Image (48px) | Watch | Ref | Condition | Box/Papers | Price | Listed | Actions

### ListingCard (src/components/network/listing-card.tsx — REWRITE):
OpenSea item card exact style:
- Image area (h-56): brand gradient bg, watch emoji centered 3xl
  - Top-left: rarity badge IF wholesale_price === 0 → "No Price" gray ELSE IF price < floor → "Below Market" green
  - Top-right: "Full Set" badge (green) if has_box AND has_papers
  - On hover: overlay with "Quick View" button appears (opens inquiry modal)
- Card footer:
  - Line 1: dealer avatar (w-5) + dealer company_name — text-xs text-muted
  - Line 2: brand name — text-xs text-accent
  - Line 3: model name OR listing notes truncated — text-sm font-semibold
  - Line 4: ref number · year (if set) — text-xs text-faint
  - Line 5: condition badge (colored pill)
  - Bottom row: Price (font-mono font-bold text-base) | "Make Offer" button (xs, outline)
  - If wholesale_price === 0: show "Price on Request" instead
- Hover: -translate-y-1 border-accent shadow-lg transition-all duration-150

---

## PAGE 3: COLLECTION/BRAND PAGE — src/app/collection/[slug]/page.tsx (NEW)

OpenSea collection page but for a watch brand.

### A. Banner + Header
- Banner: full-width gradient (brand-specific color scheme, 200px)
- Brand logo area: large circle (80px) with brand initial, border-4 border-[#0b0b14], overlapping banner bottom
- Brand name: text-3xl font-black
- Subtitle: "X listings · Floor: $XX,XXX · X dealers"
- Stats row (5 boxes): Floor Price | Avg Price | Total Listed | Total Volume | Unique Dealers

### B. Tabs: [Items] [Activity] [Analytics]

#### Items tab:
Same sidebar filter + grid as network page but pre-filtered to this brand

#### Activity tab:
Table of market_events for this brand:
Event | Watch | Price | Dealer | Time

#### Analytics tab:
- Price history line chart (recharts): floor price over time (from price_snapshots if data exists, else mock flat line)
- Listings over time bar chart
- Condition distribution pie chart
- Material distribution (horizontal bar chart)

### C. Traits/Filters sidebar
For each filterable trait (condition, material, year range) show count of listings

---

## PAGE 4: ITEM DETAIL — src/app/listing/[id]/page.tsx (REWRITE)

Match OpenSea item detail exactly.

### Layout: 2 columns (image left, info right) then full-width sections below

LEFT (col-span-1):
- Large image card (rounded-2xl, border, bg card):
  - Image area: min-h-[400px], brand gradient bg, large watch emoji
  - Toolbar row below: Share icon | Refresh icon | More (3 dots)
- Below image: "Completeness" card:
  - Grid 3 cols: Has Box (✅/❌) | Has Papers (✅/❌) | Has Warranty (✅/❌)

RIGHT (col-span-1):
- Breadcrumb: Brand name (link) > Reference
- Title: model name or listing notes — text-2xl font-black
- Subtitle: reference · year · condition
- Dealer row: verified badge + company name + "X sales" + seller_rating stars
- 
- Traits grid (OpenSea style 3×3):
  Each trait box: bg-blue-950/30 border border-blue-800/30 rounded-xl p-3 text-center
  - Trait type: text-xs text-accent uppercase font-bold
  - Trait value: text-sm font-semibold mt-1
  - Trait rarity %: text-xs text-muted (for key traits, show % of listings with that value)
  Traits: Brand, Reference, Material (if set), Condition, Year (if set), Box, Papers, Dealer, Listed Date

- Price card (rounded-2xl border card p-6):
  - "Current Price" label text-xs text-faint
  - Price: text-4xl font-black font-mono (or "Price on Request" if 0)
  - Comparison: "X% below avg for [Model]" green text
  - Two buttons (full width):
    [Make Offer] (gradient) [Save to Watchlist] (outline)
  - "X people watching this" text-xs text-muted

BELOW (full width, two columns of cards):

LEFT COLUMN:
- Price History card:
  - Tab toggle: [Price History] [Listings]  
  - recharts AreaChart — use price_snapshots data if exists, else show "No price history yet"
  - X-axis: date, Y-axis: price

RIGHT COLUMN:
- Offers / Inquiries card:
  - Table: From | Offer Price | Date | Status
  - "Make Offer" button triggers inquiry modal

FULL WIDTH:
- "More from this dealer" row: horizontal scroll of 5 other listings from same dealer
- "Similar Watches" row: horizontal scroll of 5 listings same brand

---

## PAGE 5: RANKINGS — src/app/rankings/page.tsx (NEW, like OpenSea Stats page)

Full-page rankings table.

### Time filter tabs: [1h] [6h] [24h] [7d] [30d] [All time]
(Note: filter by market_events timestamp — show brands with most activity in that window)

### Rankings table (full width):
Columns:
- # (rank)
- Brand (logo circle + name)
- Floor Price (font-mono)
- 24h Volume (total wholesale_price of active listings added today)
- 24h % change in floor (compare today's floor to yesterday's)
- 7d Volume
- Listed (count active)
- Owners (distinct dealer count)
- Trending sparkline (inline SVG, 7 data points)

Each row: hover bg-elevated, click → /collection/[slug]

---

## PAGE 6: ACTIVITY — src/app/activity/page.tsx (NEW, like OpenSea Activity page)

### Filter row (horizontal, scrollable):
Toggle pills: [All] [Listed] [Sold] [Price Changed] [Inquiries]

### Activity table (full width):
Columns: Event badge | Item (image circle + brand + ref) | Price | Quantity | From | To | Time
- Event badges: Listed=blue, Sold=green, Price Changed=yellow, Inquiry=purple
- Time: relative (2 minutes ago)
- Load more button at bottom (pagination)

---

## PAGE 7: MY INVENTORY — src/app/inventory/page.tsx (KEEP EXISTING, but reskin)

Same functionality, just update the visual style to match new dark theme.
Keep the 5-step add watch dialog.
Update table to match new design system.

---

## GLOBAL COMPONENTS TO REWRITE

### src/components/layout/top-nav.tsx
(Full OpenSea nav as described above)

### src/components/network/listing-card.tsx
(Full OpenSea card as described above)

### src/components/shared/brand-avatar.tsx (NEW)
Circle with brand initial + brand-specific gradient color:
- Rolex: green gradient (#006039 → #00843D)
- Patek Philippe: navy gradient (#002856 → #003A7A)
- AP: blue gradient (#002366 → #003399)
- Vacheron: red gradient (#8B0000 → #C00000)
- Richard Mille: dark gradient (#1a1a1a → #333333)
- Omega: blue gradient (#003087 → #004AAD)
- Default: blue-purple gradient

### src/components/shared/stat-card.tsx (NEW)
Reusable stat card: icon + label + value + optional change indicator

### src/components/shared/activity-row.tsx (NEW)
Single row for activity feed: event badge + item + price + from + to + time

### src/components/charts/price-history-chart.tsx (NEW)
recharts AreaChart with dark theme styling:
- bg transparent, grid lines #1c1c2a
- stroke accent blue, fill blue with 20% opacity
- tooltip: dark card bg, white text
- Responsive container

---

## ROUTING UPDATES

Update src/app/page.tsx to show the homepage (not redirect).
Add to src/app/page.tsx proper server component that fetches stats + trending + recent listings.

New routes needed:
- /collection/[slug] → brand collection page
- /rankings → stats/rankings
- /activity → activity feed

---

## DATA MAPPING NOTES

For pages that need volume/floor stats, compute from listings table:
- floor_price = MIN(wholesale_price) WHERE wholesale_price > 0 AND brand_id = X AND status = 'active'
- avg_price = AVG(wholesale_price) WHERE wholesale_price > 0 AND brand_id = X AND status = 'active'
- volume = SUM(wholesale_price) WHERE brand_id = X AND status = 'sold'
- listed_count = COUNT(*) WHERE brand_id = X AND status = 'active'
- dealer_count = COUNT(DISTINCT dealer_id) WHERE brand_id = X AND status = 'active'

Since most listings have wholesale_price = 0 (RC Crown import), show "—" or "Price on Request" gracefully everywhere instead of $0.

---

## DONE CRITERIA

1. Homepage looks like opensea.io with hero + trending + featured + activity ✅
2. Network page has left filter sidebar + item grid ✅
3. Brand collection pages exist at /collection/[slug] ✅
4. Item detail has traits grid + price history chart + dealer section ✅
5. Rankings page has table with floor/volume/count ✅
6. Activity page shows market events feed ✅
7. All pages use new ListingCard and TopNav ✅
8. Dark theme consistent throughout (#0b0b14 bg) ✅
9. All money displays: font-mono font-bold ✅
10. Mobile responsive (hamburger nav, stacked filters) ✅
11. npx tsc --noEmit = 0 errors ✅
12. git add -A && git commit -m "redesign: OpenSea-style UI — homepage, collection pages, rankings, activity, new nav, listing cards" ✅

When completely finished run:
openclaw system event --text "Done: OpenWatch Agent 3 — full OpenSea redesign complete" --mode now
