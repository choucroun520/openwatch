Read CLAUDE.md, OPENWATCH-CONTEXT.md, and watchmarket-v2.jsx fully before touching anything.
The foundation (migrations, utilities, types, schemas) is already built in src/. Now build all the UI pages and API routes.

---

## 1. Top Navigation — src/components/layout/top-nav.tsx

Sticky dark nav bar (OpenSea OS2 style):
- Left: watch icon + "OpenWatch" gradient text (blue to purple). Click → /network
- Center pills: [Network] [My Inventory] [Analytics] [Inquiries] — active = filled blue bg
- Right: "List a Watch" gradient button + avatar dropdown (Profile, Settings, Sign Out)
- Mobile: hamburger Sheet with nav items stacked
- z-50, backdrop-blur, border-b border-border

---

## 2. Auth Pages

### src/app/(auth)/login/page.tsx
- Dark card centered on page
- OpenWatch logo at top
- Email + password inputs
- "Sign In" gradient button
- Link to /register
- Supabase email/password auth

### src/app/(auth)/register/page.tsx
- Invite Code field (required)
- Full Name, Company Name, Email, Password, Location
- Specialties: multi-select checkboxes from BRANDS list
- "Join OpenWatch" button
- Validates invite code via API before submitting

### src/app/api/auth/register/route.ts
- POST: body = { invite_code, full_name, company_name, email, password, location, specialties }
- Check invite code is valid via validate_invite_code() function
- Create Supabase auth user
- Insert profile row with dealer role
- Call use_invite_code() to mark used
- Return 200 or error

---

## 3. Root page redirect — src/app/page.tsx
Redirect to /network if session exists, else /login

---

## 4. Network Browse — src/app/network/page.tsx

The main page. Server component fetches all active listings with brand+model joins.

LAYOUT TOP TO BOTTOM:

A. Stats bar (4 cards in a row):
   - "Network Listings" | count of active listings
   - "Active Dealers" | count of distinct dealer_ids  
   - "Brands" | count of distinct brand_ids
   - "Avg Floor" | average of floor prices across all brands
   Label: text-xs text-faint uppercase. Value: text-lg font-bold font-mono

B. Brand filter tabs (horizontal scroll, no wrap):
   [All] [Rolex] [Patek Philippe] [Audemars Piguet] [Omega] [Richard Mille] [Vacheron Constantin] [Cartier] [IWC] [Breitling] [A. Lange & Söhne]
   Active tab: bg-accent text-white rounded-full px-3 py-1
   Clicking filters the grid below (client-side filter via URL param)

C. Filter bar (horizontal):
   - Condition dropdown (All + CONDITIONS from constants)
   - Material dropdown (All + MATERIALS from constants)
   - Price min/max inputs
   - Sort select: Newest / Price Low→High / Price High→Low / Most Viewed
   - Item count: "342 watches" text

D. Listing grid (4 cols desktop, 2 tablet, 1 mobile):
   Each card = src/components/network/listing-card.tsx

   ListingCard props: listing + brand + model + dealer

   Card layout:
   - Image area (h-48, brand-colored gradient bg, watch icon centered)
     - Top-left: rarity badge (if price < avg * 0.85 → "Below Market" green badge)
     - Top-right: "Full Set" green badge if has_box AND has_papers
   - Card body:
     - Row: dealer avatar (w-5 h-5 rounded-full bg-accent) + dealer name (text-xs text-muted)
     - Model name: text-sm font-semibold text-foreground
     - Ref · Year · Material: text-xs text-muted
     - Condition badge (color coded)
     - Price: text-base font-bold font-mono + "Listed Xd ago" text-xs text-faint
   - Hover: border-accent shadow-hover -translate-y-1 transition-all duration-150
   - Click → /listing/[id]

Network page is a server component. Pass listings to a client component (NetworkGrid) that handles filtering/sorting with useState.

---

## 5. Listing Detail — src/app/listing/[id]/page.tsx

Server component fetches: listing + brand + model + dealer profile.

TWO COLUMN LAYOUT (gap-8, listing image left, info right):

LEFT COLUMN:
- Image area: large (min-h-96), brand gradient bg, watch icon
- Badges overlaid: "Full Set" bottom-left if has_box+has_papers, condition badge bottom-right

RIGHT COLUMN:
- Dealer row: avatar + company_name + verified badge + seller_rating stars
- Brand name in accent blue (links to /network?brand=slug)
- Model + Reference: text-2xl font-black
- Traits grid (3 cols, 3 rows = 9 boxes):
  Each box: bg-accent/10 border border-accent/20 rounded-lg p-3 text-center
  Trait name: text-xs text-accent uppercase font-bold
  Trait value: text-sm font-semibold text-foreground
  Traits: Brand, Model, Reference, Material, Dial Color, Case Size, Year, Condition, Movement

- Price box (card):
  - "Wholesale Price" label text-xs text-faint
  - Price: text-4xl font-black font-mono
  - Comparison vs model avg: "X% below avg" (text-success) or "X% above avg" (text-danger)
  - "Send Inquiry" button: full width, gradient bg

- Dealer notes (if listing.notes is set): card with notes text

Inquiry dialog (triggered by "Send Inquiry" button):
- Title: "Inquiry — [Brand Model Ref]"
- Message textarea (required)
- Offer Price input (optional, CurrencyInput)
- Submit → POST /api/inquiries
- Success toast + close dialog

---

## 6. My Inventory — src/app/inventory/page.tsx

Protected dealer page.

A. Stats row (4 cards): Active | Sold | Total Views | Avg Days Listed

B. Top bar: "My Inventory" h1 + "Add Watch" gradient button (right)

C. Table (src/components/inventory/inventory-table.tsx):
   Columns: Watch | Condition | Price | Status | Views | Listed | Actions
   - Watch: brand logo gradient (24px) + "Brand Model" bold + ref text-muted below
   - Condition: condition-badge component
   - Price: font-mono bold
   - Status: badge (active=green, sold=blue, delisted=gray, pending=yellow)
   - Views: number
   - Listed: timeAgo
   - Actions: Edit icon button, Mark Sold icon button, Delist icon button

D. "Add Watch" opens a Dialog with a 5-step form (use Tabs for steps or a stepper):

   Step 1 — IDENTITY:
   Brand (Select → brands from DB), Model (Select, filtered by brand via useEffect), 
   Reference Number (Input), Year (Input number 1950-2026), Serial Number (Input optional)
   
   Step 2 — DETAILS:
   Material (Select MATERIALS), Dial Color (Select DIAL_COLORS), Case Size (Input),
   Movement (Select MOVEMENTS), Complications (checkboxes COMPLICATIONS),
   Condition (Select CONDITIONS), Condition Score (Input 1-10 optional)
   
   Step 3 — COMPLETENESS:
   Has Box (Switch), Has Papers (Switch), Has Warranty (Switch),
   Warranty Date (Input date, shows if has_warranty=true), Service History (Textarea optional)
   
   Step 4 — PRICING:
   Wholesale Price (CurrencyInput required), Retail Price (CurrencyInput optional),
   Accepts Inquiries (Switch default true), Notes (Textarea optional)
   
   Step 5 — REVIEW:
   Summary of all entered data in a clean grid
   "Submit Listing" button
   
   On submit → POST /api/inventory → creates listing + records market_event
   On success: toast, close dialog, refresh table

API routes:
- GET /api/inventory — fetch dealer's own listings
- POST /api/inventory — create listing
- PATCH /api/inventory/[id] — update listing
- DELETE /api/inventory/[id] — soft delete
- PATCH /api/inventory/[id]/status — update status (sold/delisted/active)

---

## 7. Analytics — src/app/analytics/page.tsx

Server component, fetches all data and passes to client.

A. "Market Analytics" h1 + subtitle "Real-time intelligence across the dealer network."

B. KPI cards row (5 cards):
   Total Network Listings | Active Dealers | Brands Tracked | Total Volume (sum wholesale_price of sold) | Avg Days to Sell

C. Brand Rankings table:
   Columns: # | Brand | Floor Price | Avg Price | Ceiling | Listed | Change (sparkline)
   Floor = MIN wholesale_price of active listings for brand
   Avg = AVG wholesale_price of active listings for brand
   Ceiling = MAX wholesale_price of active listings for brand
   Listed = COUNT active listings for brand
   Click row → /network?brand=[slug]

D. Model Rankings (top 10 by listing count):
   Model | Brand | Floor | Avg | Listed
   
E. Recent Activity (last 20 market_events):
   Event badge + watch info + dealer + price + timeAgo

---

## 8. Inquiries — src/app/inquiries/page.tsx

Tabs: [Received (N)] [Sent (N)]

Table columns: Watch | From/To | Message | Offer Price | Status | Time | Actions

Received tab actions: "Reply" button (opens reply dialog) + "Close" button
Sent tab: read-only

Reply dialog: textarea + submit → PATCH /api/inquiries/[id] with reply message

API routes:
- GET /api/inquiries — list inquiries where from_dealer_id = user OR to_dealer_id = user
- POST /api/inquiries — create inquiry (from listing detail page)
- PATCH /api/inquiries/[id] — update status or add reply

---

## 9. Admin — src/app/admin/page.tsx

Simple admin dashboard (role: admin or super_admin only):

A. Pending Dealers table: name + company + email + joined_at + Verify button
B. Invite Codes table: code + status + used_by + created_at
C. "Generate Invite Code" button → POST /api/admin/invite-codes → creates new code OW-XXXX-XXXX

API routes:
- POST /api/admin/invite-codes
- PATCH /api/admin/verify-dealer/[id]

---

## 10. Shared components

src/components/shared/verified-badge.tsx — blue filled circle + white checkmark, configurable size
src/components/shared/condition-badge.tsx — pill badge: Unworn/Mint=green, Excellent/VeryGood=blue, Good=yellow, Fair=red
src/components/shared/price-change.tsx — +2.3% text-success or -1.5% text-danger, font-mono
src/components/shared/loading-skeleton.tsx — shimmer variants: card (same dimensions as ListingCard), table-row, stat-card
src/components/shared/empty-state.tsx — icon + heading + subtext + optional action button
src/components/charts/sparkline.tsx — SVG, props: data number[], positive boolean, w/h. Green or red stroke + gradient fill.
src/components/shared/currency-input.tsx — Input that formats as currency on blur, stores as string

---

## 11. Loading + Error pages

src/app/network/loading.tsx — grid of 8 skeleton cards
src/app/inventory/loading.tsx — table skeleton rows
src/app/analytics/loading.tsx — skeleton KPI cards + table
src/app/inquiries/loading.tsx — table skeleton
src/app/listing/[id]/loading.tsx — two-column skeleton
src/app/error.tsx — global error boundary with "Something went wrong" + retry button

---

## DESIGN RULES (non-negotiable)

- ALL backgrounds: bg-[#0b0b14] root, bg-[#111119] cards
- ALL money: font-mono font-bold — never a plain number
- Card hover: hover:border-accent hover:shadow-hover hover:-translate-y-1 transition-all duration-150
- Primary button: bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg
- Table headers: text-xs text-faint uppercase tracking-wider
- Table rows: hover:bg-[#161622] border-b border-border
- Use shadcn/ui components only (button, card, input, select, dialog, table, badge, tabs, sheet, switch, textarea, avatar, skeleton, tooltip)
- Every interactive element: cursor-pointer, min tap target 44px on mobile
- Toasts via sonner (already included with shadcn)

---

## DONE CRITERIA

1. All pages render without crashing ✅
2. Network grid shows listings with filters working ✅
3. Add Watch dialog 5-step form works ✅
4. Inquiry modal sends + appears in /inquiries ✅
5. Analytics shows computed stats from DB ✅
6. Login → register with invite code works ✅
7. Admin can generate invite codes ✅
8. npx tsc --noEmit = 0 errors ✅
9. git add -A && git commit -m "feat: OpenWatch Phase 1 UI — network, inventory, analytics, inquiries, auth, admin" ✅

When completely finished run:
openclaw system event --text "Done: OpenWatch Agent 2 — all UI pages built and committed" --mode now
