Read CLAUDE.md, OPENWATCH-CONTEXT.md, and ALL existing src/ files before writing anything.
Also study the design reference screenshots in opensea-refs/ref1.png, ref2.png, ref3.png.

You are doing a PRECISION UI REDESIGN to match OpenSea.io exactly — same layout, same sidebar, same card design, same detail pages. For watches instead of NFTs.

DO NOT touch: API routes, Supabase migrations, database logic, middleware.ts, or .env files.
ONLY rewrite: UI components, page layouts, CSS/styles.

---

## CRITICAL DESIGN RULES (from OpenSea screenshots)

**Global:**
- Root bg: #121212
- Card bg: #1E1E2E
- Sidebar bg: #121212 (no border, blends with page)
- Text default: #FFFFFF
- Text muted: #8A939B
- Active/accent: #2081E2 (OpenSea blue)
- Success: #34C759
- Danger: #EB5757
- Border subtle: #333333
- Font: Inter

**Cards image area: WHITE background (#FFFFFF) for watch photos — not gradient**
**All prices: font-mono font-bold**

---

## CHANGE 1: REPLACE TOP NAV WITH LEFT SIDEBAR

Delete src/components/layout/top-nav.tsx entirely.
Create src/components/layout/sidebar.tsx — fixed left sidebar, 72px wide (icon-only) that expands to 220px on hover or when toggled.

**Sidebar structure (top to bottom):**

Logo area:
- ⌚ watch icon (28px) when collapsed
- "⌚ OpenWatch" when expanded — white bold 18px

Nav items (each: icon 20px + label 14px, row height 44px, padding-left 16px, gap icon-to-text 12px):
- Active: text white + subtle left border 2px #2081E2
- Inactive: text #8A939B icon #8A939B
- Hover: bg #1a1a1a rounded-lg

Top nav items:
1. Compass icon → "Discover" → href /
2. Grid3x3 icon → "Browse" → href /network
3. BarChart3 icon → "Rankings" → href /rankings
4. Zap icon → "Activity" → href /activity
5. Building2 icon → "Dealers" → href /dealers (new page, simple dealer list)

Separator (1px #333)

Bottom nav items (with chevron-right → means has submenu, not implemented yet):
6. Package icon → "My Inventory" → href /inventory
7. MessageSquare icon → "Inquiries" → href /inquiries
8. User icon → "Profile" → href /profile (stub page, just shows "Coming Soon")
9. Settings icon → "Settings" → href /settings (stub page)
10. Shield icon → "Admin" → href /admin (show only if role=admin/super_admin)

Bottom of sidebar:
- Separator
- Small "OpenWatch v1.0" text in #8A939B 10px when expanded

**Mobile behavior:**
- On mobile: sidebar is hidden, replaced by bottom tab bar with 5 icons (Discover, Browse, Rankings, Activity, Inventory)

**Layout wrapper — src/components/layout/app-layout.tsx:**
All authenticated pages wrap with: sidebar (fixed left) + main content (margin-left 72px, expands to 220px when sidebar open)

Update ALL page files to use AppLayout wrapper:
- src/app/page.tsx
- src/app/network/page.tsx
- src/app/ranking/page.tsx
- src/app/activity/page.tsx
- src/app/inventory/page.tsx
- src/app/inquiries/page.tsx
- src/app/analytics/page.tsx
- src/app/collection/[slug]/page.tsx
- src/app/listing/[id]/page.tsx
- src/app/admin/page.tsx

Also add a top bar inside AppLayout (NOT the sidebar):
- Height 56px, bg #121212, border-b #222
- Left: Search input (dark, rounded-lg, placeholder "Search watches, refs, dealers...")
- Right: "List a Watch" button (blue #2081E2) + dealer avatar circle (shows company initial)

---

## CHANGE 2: LISTING CARD — OPENSEA EXACT STYLE

Rewrite src/components/network/listing-card.tsx completely:

**Card container:**
- bg #1E1E2E, border-radius 12px, overflow hidden
- border: 1px solid transparent
- hover: border 1px solid #333, translateY(-2px), shadow

**Image area (CRITICAL — white background):**
- Aspect ratio 1:1 (square using padding-bottom: 100% trick or aspect-video)
- bg #FFFFFF (white) for the watch image area
- If listing.images[0] exists: <img> fills the area, object-contain, padding 8px
- If no image: show brand logo SVG centered on white bg
- Top-right on hover: circular "+" add-to-watchlist button (28px, bg #2081E2/90, white +)
- Top-left badges: condition badge IF condition is not 'excellent'

**Card bottom info (padding 12px):**

Row 1: Name + rarity-style badge
- Left: listing.notes?.slice(0,35) OR brand+ref — white 13px truncated
- Right: condition badge pill (if unworn/mint → blue diamond icon + "New", if excellent → nothing, if good/fair → orange/red pill)

Row 2: Price
- wholesale_price formatted — white bold 14px font-mono
- If 0 → "Price on Request" gray italic

Row 3: Dealer info
- "RC Crown" or dealer.company_name — gray #8A939B 11px
- Verified checkmark (blue ✓ inline) if dealer.verified

**Hover state — "Make Offer" button appears:**
- Replaces row 3 on hover
- Left: "Make Offer" button — bg #2081E2, white text 12px rounded-lg px-3 py-1.5
- Right: price again in white mono

---

## CHANGE 3: BRAND LOGOS (replace gradient initials)

Create src/components/shared/brand-logo.tsx

Instead of colorful gradient circles with letters, show clean brand logos using SVG text:

Each brand gets a styled SVG "wordmark" badge:
- Container: 32px × 32px rounded-full bg #1a1a1a border border-[#333]
- Inside: brand-specific colored letter initial in the brand's actual font/color:
  - Rolex → green #006039 "R" serif
  - Patek Philippe → navy #002856 "P" serif  
  - Audemars Piguet → blue #003087 "AP" small
  - Vacheron Constantin → red #8B0000 "VC"
  - Richard Mille → dark #222 "RM"
  - Omega → blue "Ω" symbol
  - Default → gray "#" 

On cards: show 20px version next to dealer name
On brand collection pages: show 48px version in header

---

## CHANGE 4: HOMEPAGE REDESIGN — src/app/page.tsx

Match OpenSea discover page layout (but inside AppLayout with sidebar):

**A. Hero carousel area:**
- Full width, height 280px, rounded-2xl
- Single featured card (use first RC Crown listing as feature)
- Background: gradient from brand color
- Bottom-left overlay: RC Crown stats
  - "WATCHES" → count of active listings
  - "PRICE RANGE" → "$11.4K – $222.5K"  
  - "DEALER" → "RC Crown ✓"
- Carousel dot indicators at bottom

**B. "Trending Brands" section:**
- Section header: "Trending" white bold 20px + "brands" gray 20px
- Horizontal list of brand rows (like OpenSea's right panel trending list):
  Each row (height 56px):
  - Brand logo circle (40px)
  - Brand name + verified badge
  - "X listings" gray 12px
  - Floor price right-aligned white bold mono
  - % off avg (green if below, red if above) 12px
  - Mini sparkline SVG (green line, 60px wide)

**C. "Recently Listed" grid:**
- Section title: "Recently Listed" white bold 20px
- 5-column grid of ListingCard (latest 10)
- "See all →" link right side

**D. Right panel (desktop only, fixed, ~280px):**
- Tab: "Watches" active
- Time: "All time" dropdown
- Column headers: WATCH | PRICE
- List of top 10 listings by price:
  Each row: brand avatar (32px) + name truncated + price right-aligned white mono + % badge

---

## CHANGE 5: NETWORK PAGE LAYOUT — src/app/network/page.tsx

Match OpenSea collection items page:

**Left filter panel (240px, same page, NOT sidebar):**
- Collapse button «
- Search input "Search by ref or trait"
- **Status section:** "All" | "Active" | "Incoming" chip buttons
- **Brand section:** checkboxes (Rolex 28, Patek 9, AP 12, Vacheron 2...)
- **Condition:** chips Unworn / Mint / Excellent / Good / Fair
- **Box & Papers:** toggle switches
- **Price range:** min / max inputs + Apply button
- **Year range:** From / To
- Clear all filters link

**Top controls bar:**
- Item count: "50 WATCHES" uppercase gray 11px
- Sort dropdown: "Recently Listed ▾"
- View icons: large grid / small grid / list

**Grid (5 col desktop, 3 tablet, 2 mobile, 1 phone):**
ListingCard components

---

## CHANGE 6: COLLECTION/BRAND PAGE — src/app/collection/[slug]/page.tsx

Match OpenSea Pudgy Penguins collection page:

**Banner:** 160px tall, brand gradient, full width
**Header below banner:**
- Brand avatar (56px circle, overlapping banner) + brand name bold 28px + verified badge
- Meta badges row: "◆ ROLEX" pill, "28 WATCHES" pill, "FOUNDED 1905" pill
- Stats row right-aligned: FLOOR PRICE | AVG PRICE | LISTED | DEALERS

**Tabs:** Items | Activity | Analytics
**Items tab:** filter sidebar + grid (same as network page but pre-filtered)
**Activity tab:** events table
**Analytics tab:** price history chart + distribution charts

---

## CHANGE 7: LISTING DETAIL PAGE — src/app/listing/[id]/page.tsx

Match OpenSea item detail exactly:

**Two column layout (no sidebar on detail, full content width):**

LEFT (col-span-5 of 12):
- Image card: white bg, rounded-2xl, watch image object-contain, p-8
- Below image: Completeness row: "Box ✓" "Papers ✓" "Warranty ✗" — pill badges
- "About [Brand]" card: brand description 2-3 sentences, gray text

RIGHT (col-span-7 of 12):
- Breadcrumb: [Brand name] > [Reference]
- Title: 26px bold — listing.notes truncated to 60 chars
- Subtitle: reference · year · condition — gray 14px
- Dealer row: avatar 32px + "RC Crown" bold + verified badge + "5.0 ★" rating

**Price card (rounded-2xl border #333 p-6 mt-4):**
- "Current Price" — gray 12px uppercase
- Price: 36px black font-mono (or "Price on Request")
- Below price: "X% below avg for [brand]" — green text if below avg
- Buttons: [Make Offer] (blue full width) [Save] (outline full width)
- "12 watching" — gray 12px mt-2

**Traits grid (3×3, below price card):**
OpenSea trait box style:
- bg #1a1a3a border border-blue-900/40 rounded-xl p-3 text-center
- Trait type: blue #2081E2 10px uppercase bold
- Trait value: white 14px font-semibold
- "X% have this" gray 11px (compute from listings table for that brand)
Traits: Brand | Reference | Condition | Year | Box | Papers | Material | Dealer | Category

**Full width sections below:**
- Price History card: AreaChart (recharts) with white line on dark bg — "No history yet" if empty
- "More from RC Crown" horizontal scroll: 5 other cards same dealer
- "Similar Watches" horizontal scroll: 5 same brand

---

## CHANGE 8: DEALERS PAGE — src/app/dealers/page.tsx (NEW)

Simple page listing all dealers:
Grid of dealer cards (3 col):
- Card: bg #1E1E2E rounded-2xl p-6
- Avatar circle 64px with company initial
- Company name bold 18px + verified badge
- Location gray 12px
- Stats: "X watches" | "Avg price $X"
- "View Inventory" button → /network?dealer=[id]

---

## CHANGE 9: RC CROWN DEALER PROFILE — fix in DB + UI

The RC Crown dealer profile (id: bfbe0f68-ac28-4da0-9df0-1c20fd74e086) should show:
- company_name: "RC Crown"
- verified: true
- seller_rating: 5.0
- location: "Montreal, QC"
- specialties: ["Rolex","Patek Philippe","Audemars Piguet","Vacheron Constantin"]

In the dealer avatar on cards, show "RC" initials (not just first letter) in a green circle (#006039 bg) to match RC Crown branding.

Update the dealer avatar logic in listing-card.tsx:
- If company_name starts with "RC" → show "RC" in green circle
- Otherwise → show first initial

---

## TECHNICAL REQUIREMENTS

- All page files must import and use AppLayout from @/components/layout/app-layout
- Remove all TopNav imports from all pages
- Keep all existing API route files unchanged
- Keep middleware.ts unchanged
- Keep all existing data fetching logic
- TypeScript strict — zero errors
- All money: font-mono font-bold
- Graceful null handling: listing.model?.name, listing.brand?.name ?? "Unknown"

## STUB PAGES NEEDED

src/app/dealers/page.tsx — dealer grid
src/app/profile/page.tsx — "Profile coming soon" centered card
src/app/settings/page.tsx — "Settings coming soon" centered card

---

## DONE CRITERIA

1. Left sidebar visible on all pages (icon-only 72px, hover to expand 220px) ✅
2. All listing cards have WHITE image background ✅
3. Cards match OpenSea style (square image, name+rarity, price, dealer, hover button) ✅
4. Homepage has hero + trending brands + recently listed + right panel ✅
5. Network page has left filter panel + 5-col grid ✅
6. Brand collection pages have banner + stats + tabs ✅
7. Listing detail has price card + traits grid + price history + more from dealer ✅
8. Dealers page shows all dealers ✅
9. RC Crown marked as verified with green "RC" avatar ✅
10. Mobile: bottom tab bar ✅
11. npx tsc --noEmit = 0 errors ✅
12. npm run build has no errors ✅
13. git add -A && git commit -m "redesign: full OpenSea UI — sidebar, white card bgs, brand logos, detail pages" ✅

When completely finished run:
openclaw system event --text "Done: OpenWatch Agent 4 — full OpenSea UI redesign complete. Sidebar, white cards, brand logos, all pages updated." --mode now
