# CLAUDE.md — WatchMarket: OpenSea for Luxury Watches
# Version 1.0 — Complete Build Specification
# Sub-project of WatchFunder

---

## BLOCK 0: PROJECT IDENTITY & GROUND RULES

### What This Is
WatchMarket — an OpenSea-style marketplace for luxury watches. This is a standalone sub-project inside the WatchFunder ecosystem. Think opensea.io, but every NFT collection is a watch brand, every NFT item is an individual watch listed for sale, and every listing feeds a real-time analytics engine that tracks demand, supply ratios, floor prices, and ROI signals.

### The OpenSea → Watch Market Translation
```
OpenSea Concept          →  WatchMarket Equivalent
─────────────────────────────────────────────────────
NFT Collection           →  Watch Brand (Rolex, Patek, AP, etc.)
Collection subcategory   →  Model Line (Submariner, Daytona, Nautilus, etc.)
NFT Item                 →  Individual Watch Listed for Sale
Floor Price              →  Lowest current ask for that brand/model
Traits                   →  Material, Dial Color, Case Size, Complication, Year, Condition
Owner                    →  Current Seller / Dealer
Volume                   →  Total USD traded in timeframe
Mint / Drop              →  New Release from Manufacturer
Rarity                   →  Production Scarcity + Condition Grade
Collection Offer         →  Standing bid on any watch in a model line
Activity Feed            →  Sales, Listings, Offers — timestamped
Stats Page               →  Market Analytics with supply/demand intelligence
```

### Ground Rules
1. **This is a Next.js 14+ App Router project.** TypeScript strict mode. Tailwind CSS + shadcn/ui components.
2. **Dark theme by default** — matching OpenSea OS2's dark UI. Background: #0b0b14. Cards: #111119. Borders: #1c1c2a. Text: #e2e8f0. Accent: #2563eb (blue). Success: #22c55e. Danger: #ef4444.
3. **Money is NEVER a JavaScript number on the backend.** Always `string` on frontend display, `NUMERIC(14,2)` in database. Use formatCurrency() utility. Frontend display can use Number for charts only.
4. **Every listing creates an analytics event.** When a watch is listed, sold, delisted, or price-changed — an event record is created that feeds the analytics engine.
5. **Supabase is the backend.** Postgres for data, Auth for users, Storage for watch images, Realtime for live price updates.
6. **Every write API route:** authenticate → rate limit → authorize → validate → execute → log event → return.
7. **Soft deletes on all entity tables.** `deleted_at TIMESTAMPTZ` column. Never hard-delete a listing — archive it.
8. **Row Level Security (RLS) enforced at database level.** Sellers see only their own listings for editing. Everyone sees all listings for browsing. Admins see everything.
9. **Font: Inter.** The only font. Weights: 400, 500, 600, 700, 800, 900. Monospace for prices: system monospace stack.
10. **Follow OpenSea's exact page structure.** Not inspired by — replicated. Same layout patterns, same data hierarchy, same navigation flow.

### Tech Stack
```
Framework:      Next.js 14+ (App Router)
Language:       TypeScript (strict mode)
Database:       Supabase (PostgreSQL + Auth + Storage + Realtime)
Styling:        Tailwind CSS + shadcn/ui
Charts:         Recharts
State:          Zustand (client UI state only)
Forms:          React Hook Form + Zod
Email:          Resend
Rate Limiting:  @upstash/ratelimit
Deployment:     Vercel
Image CDN:      Supabase Storage + Vercel Image Optimization
```

---

## BLOCK 1: DATABASE SCHEMA

### Core Tables

```sql
-- 1. profiles (extends Supabase Auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer','seller','dealer','admin','super_admin')),
  bio TEXT,
  website TEXT,
  location TEXT,
  verified BOOLEAN DEFAULT false,
  seller_rating NUMERIC(3,2) DEFAULT 0,
  total_sales INTEGER DEFAULT 0,
  total_listings INTEGER DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 2. brands (Collections in OpenSea terms)
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  banner_url TEXT,
  founded INTEGER,
  headquarters TEXT,
  website TEXT,
  annual_production INTEGER,
  market_share NUMERIC(5,2),
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 3. models (Sub-collections — e.g., Submariner under Rolex)
CREATE TABLE models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'Dive','Chronograph','Dress','Sport','Complication','Luxury Sport','Heritage','Ladies','Contemporary'
  year_introduced INTEGER,
  annual_production INTEGER,
  reference_numbers TEXT[], -- array of known ref numbers
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(brand_id, slug)
);

-- 4. listings (Individual NFT Items — watches for sale)
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES profiles(id),
  brand_id UUID NOT NULL REFERENCES brands(id),
  model_id UUID NOT NULL REFERENCES models(id),
  
  -- Watch Details (Traits in OpenSea)
  reference_number TEXT NOT NULL,
  serial_number TEXT,
  year INTEGER NOT NULL,
  material TEXT NOT NULL, -- 'Stainless Steel','18k Yellow Gold','18k Rose Gold','18k White Gold','Platinum','Titanium','Ceramic','Carbon TPT','Bronze'
  dial_color TEXT NOT NULL,
  case_size TEXT, -- e.g., '41mm'
  movement TEXT, -- 'Automatic','Manual Wind','Quartz'
  complications TEXT[], -- array: 'Date','Chronograph','GMT','Moon Phase','Perpetual Calendar','Tourbillon','Minute Repeater'
  condition TEXT NOT NULL, -- 'Unworn','Mint','Excellent','Very Good','Good','Fair'
  condition_score NUMERIC(3,1), -- 10.0 scale
  
  -- Completeness
  has_box BOOLEAN DEFAULT false,
  has_papers BOOLEAN DEFAULT false,
  has_warranty BOOLEAN DEFAULT false,
  warranty_date DATE,
  service_history TEXT,
  
  -- Pricing
  price NUMERIC(14,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  accepts_offers BOOLEAN DEFAULT true,
  minimum_offer NUMERIC(14,2),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','sold','delisted','expired','flagged')),
  featured BOOLEAN DEFAULT false,
  views INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  
  -- Images
  images TEXT[], -- array of Supabase Storage URLs, first = primary
  
  -- Metadata
  listed_at TIMESTAMPTZ DEFAULT now(),
  sold_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 5. offers (Bids on listings)
CREATE TABLE offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id),
  buyer_id UUID NOT NULL REFERENCES profiles(id),
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','expired','cancelled')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 6. sales (Completed transactions)
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id),
  seller_id UUID NOT NULL REFERENCES profiles(id),
  buyer_id UUID NOT NULL REFERENCES profiles(id),
  sale_price NUMERIC(14,2) NOT NULL,
  platform_fee NUMERIC(14,2) NOT NULL, -- 2.5% like OpenSea
  seller_proceeds NUMERIC(14,2) NOT NULL,
  payment_method TEXT,
  sale_date TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. market_events (Analytics engine — every action is tracked)
CREATE TABLE market_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'listing_created','listing_sold','listing_delisted','price_changed','offer_made','offer_accepted','offer_rejected'
  listing_id UUID REFERENCES listings(id),
  brand_id UUID REFERENCES brands(id),
  model_id UUID REFERENCES models(id),
  actor_id UUID REFERENCES profiles(id),
  price NUMERIC(14,2),
  previous_price NUMERIC(14,2),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. price_snapshots (Hourly/daily aggregated prices per model)
CREATE TABLE price_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES models(id),
  brand_id UUID NOT NULL REFERENCES brands(id),
  snapshot_date DATE NOT NULL,
  floor_price NUMERIC(14,2),
  avg_price NUMERIC(14,2),
  ceiling_price NUMERIC(14,2),
  total_listed INTEGER,
  total_sold INTEGER,
  volume NUMERIC(14,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(model_id, snapshot_date)
);

-- 9. watchlists (User saves/favorites)
CREATE TABLE watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  listing_id UUID REFERENCES listings(id),
  model_id UUID REFERENCES models(id),
  brand_id UUID REFERENCES brands(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, listing_id)
);

-- 10. messages (Buyer-seller communication)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id),
  sender_id UUID NOT NULL REFERENCES profiles(id),
  recipient_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
```

### Indexes
```sql
CREATE INDEX idx_listings_brand ON listings(brand_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_listings_model ON listings(model_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_listings_seller ON listings(seller_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_listings_status ON listings(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_listings_price ON listings(price) WHERE deleted_at IS NULL AND status = 'active';
CREATE INDEX idx_listings_listed_at ON listings(listed_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_market_events_type ON market_events(event_type, created_at DESC);
CREATE INDEX idx_market_events_brand ON market_events(brand_id, created_at DESC);
CREATE INDEX idx_market_events_model ON market_events(model_id, created_at DESC);
CREATE INDEX idx_price_snapshots_model ON price_snapshots(model_id, snapshot_date DESC);
CREATE INDEX idx_offers_listing ON offers(listing_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_date ON sales(sale_date DESC);
```

---

## BLOCK 2: PAGE STRUCTURE — Exact OpenSea OS2 Mapping

### Navigation (Top Bar — sticky)
```
[⌚ WatchMarket Logo]  [Discover] [Collections] [Activity] [Analytics]  [🔍 Search]  [List a Watch btn]
```

### Page Map
```
Route                           →  OpenSea Equivalent             →  What It Shows
─────────────────────────────────────────────────────────────────────────────────────
/                               →  opensea.io                     →  Discover: trending table, featured brands, top movers, category tabs
/collections                    →  opensea.io/collections         →  All brands ranked: floor, volume, change%, listed count, sparkline
/collection/[brand-slug]        →  opensea.io/collection/[name]   →  Brand page: banner, stats bar, model tabs, sidebar filters, item grid
/collection/[brand]/[model]     →  (trait-filtered view)          →  Model-specific view within brand
/item/[listing-id]              →  opensea.io/assets/[item]       →  Listing detail: image, traits grid, price, buy/offer, seller, chart, similar
/activity                       →  opensea.io/activity            →  Live feed: sales, listings, offers, price changes — filterable
/analytics                      →  opensea.io/stats (expanded)    →  Market intelligence: momentum, supply risk, ROI signals, brand share
/list                           →  opensea.io/create              →  List a watch for sale form
/profile/[user-id]              →  opensea.io/[username]          →  User profile: their listings, sales history, rating
/settings                       →  opensea.io/settings            →  Account settings
```

---

## BLOCK 3: BRAND PAGE LAYOUT (The Critical Page)

This is the page that opens when you click a brand (collection). It must replicate OpenSea's collection page exactly:

```
┌──────────────────────────────────────────────────────────────────────┐
│  BANNER IMAGE (full width, 180px height, brand gradient/image)       │
│  ┌─────────┐                                                         │
│  │  ICON   │  (overlapping banner bottom, 72px, rounded)             │
│  └─────────┘                                                         │
├──────────────────────────────────────────────────────────────────────┤
│  Brand Name ✓verified    brand description text...                   │
├──────────────────────────────────────────────────────────────────────┤
│  STATS BAR (horizontal):                                             │
│  Floor price | 1d floor % | 24h volume | Total volume | Listed | Owners│
├──────────────────────────────────────────────────────────────────────┤
│  MODEL TABS: [All Models] [Submariner 234] [Daytona 156] [GMT 189]  │
├──────────────────────────────────────────────────────────────────────┤
│ ┌─SIDEBAR──────┐ ┌─MAIN GRID───────────────────────────────────────┐│
│ │ Status       │ │ ◀ Filter toggle | 234 items | Sort: Price ↑ | ⊞☰││
│ │ [All][Listed]│ │                                                  ││
│ │              │ │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐               ││
│ │ Material ▼   │ │ │ IMG │ │ IMG │ │ IMG │ │ IMG │               ││
│ │ Condition ▼  │ │ │Brand│ │Brand│ │Brand│ │Brand│               ││
│ │ Price Range  │ │ │Model│ │Model│ │Model│ │Model│               ││
│ │ [min] [max]  │ │ │$$$$$│ │$$$$$│ │$$$$$│ │$$$$$│               ││
│ │              │ │ └─────┘ └─────┘ └─────┘ └─────┘               ││
│ │ Brand Intel  │ │                                                  ││
│ │ • Prod: 1.2M │ │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐               ││
│ │ • Share: 29% │ │ │ ... │ │ ... │ │ ... │ │ ... │               ││
│ │ • Supply: 2% │ │ └─────┘ └─────┘ └─────┘ └─────┘               ││
│ └──────────────┘ └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```

### Item Card Layout (Grid View)
```
┌──────────────────┐
│   WATCH IMAGE     │  ← Brand gradient bg + watch photo
│   [Rare]  [Full]  │  ← Rarity badge + Full Set badge
├──────────────────┤
│ Brand Name        │  ← 11px, muted color
│ Model Name        │  ← 13px, bold, white
│ Ref · Year · Mat  │  ← 11px, muted
│                   │
│ Price    Listed   │
│ $14,200  3d ago   │  ← Price = 16px bold mono
└──────────────────┘
```

---

## BLOCK 4: API ROUTES

```
PUBLIC (no auth required):
GET    /api/v1/brands                    →  All brands with computed stats
GET    /api/v1/brands/[slug]             →  Single brand with models
GET    /api/v1/models/[id]               →  Single model with listings
GET    /api/v1/listings                  →  Browse/search all listings (paginated, filterable)
GET    /api/v1/listings/[id]             →  Single listing detail
GET    /api/v1/activity                  →  Market events feed (paginated)
GET    /api/v1/analytics/overview        →  Market-wide stats
GET    /api/v1/analytics/brand/[slug]    →  Brand-specific analytics
GET    /api/v1/analytics/model/[id]      →  Model-specific analytics  
GET    /api/v1/analytics/supply-risk     →  Supply oversaturation data
GET    /api/v1/analytics/momentum        →  Price momentum rankings
GET    /api/v1/price-history/[model-id]  →  Time series price data

AUTHENTICATED (seller/dealer):
POST   /api/v1/listings                  →  Create new listing [RATE: critical]
PATCH  /api/v1/listings/[id]             →  Update listing (price, details) [RATE: standard]
DELETE /api/v1/listings/[id]             →  Delist (soft delete) [RATE: standard]
POST   /api/v1/listings/[id]/images      →  Upload images [RATE: critical]

AUTHENTICATED (buyer):
POST   /api/v1/offers                    →  Make an offer [RATE: critical]
PATCH  /api/v1/offers/[id]               →  Cancel offer [RATE: standard]
POST   /api/v1/listings/[id]/buy         →  Buy now [RATE: critical]

AUTHENTICATED (seller response):
PATCH  /api/v1/offers/[id]/accept        →  Accept offer → creates sale [RATE: critical]
PATCH  /api/v1/offers/[id]/reject        →  Reject offer [RATE: standard]

ADMIN:
GET    /api/v1/admin/analytics           →  Full analytics dashboard data
POST   /api/v1/admin/brands              →  Add/update brand [RATE: critical]
POST   /api/v1/admin/models              →  Add/update model [RATE: critical]
POST   /api/v1/admin/verify-brand        →  Toggle brand verification [RATE: standard]
POST   /api/v1/admin/feature-listing     →  Feature a listing [RATE: standard]

CRON:
POST   /api/v1/cron/snapshot-prices      →  Daily price snapshot generation
POST   /api/v1/cron/expire-listings      →  Expire old listings
POST   /api/v1/cron/compute-analytics    →  Recompute brand/model analytics
```

---

## BLOCK 5: ANALYTICS ENGINE

The analytics engine is the killer differentiator. Every listing action creates a `market_events` record. Cron jobs and real-time computations produce these analytics:

### Per-Brand Computed Stats
- Floor price (lowest active listing)
- Average price (mean of active listings)
- Ceiling price (highest active listing)
- Total volume (sum of all sales)
- 24h / 7d / 30d volume
- 1d / 7d / 30d price change %
- Total active listings
- Total unique sellers
- Supply ratio = active listings / annual production
- Velocity = sales per day (7d avg)

### Per-Model Computed Stats
- Same as brand, but model-specific
- Trait distribution (% of listings per material, dial, condition)
- Price by trait (avg price for steel vs gold, etc.)

### Market-Wide Analytics
- **Momentum Rankings:** Brands/models sorted by 30d price change
- **Supply Risk Matrix:** Models with high listing-to-production ratio (potential crash)
- **ROI Signals:** Models with rising demand + low supply + strong momentum
- **Volume Leaders:** Highest traded brands/models
- **Price Discovery:** Floor-to-ceiling spread as investment upside indicator

### Snapshot Strategy
- `price_snapshots` table stores daily aggregated data per model
- Cron job runs at midnight UTC: queries all active listings, computes floor/avg/ceiling/count/volume
- Historical data enables: "Show me Submariner floor price over the last 90 days"

---

## BLOCK 6: DESIGN SYSTEM — OpenSea OS2 Dark Theme

```typescript
// tailwind.config.ts theme.extend
colors: {
  bg: { DEFAULT: "#0b0b14", card: "#111119", elevated: "#161622", hover: "#1a1a28" },
  border: { DEFAULT: "#1c1c2a", light: "#22222e", focus: "#2563eb" },
  text: { DEFAULT: "#e2e8f0", muted: "#94a3b8", dim: "#64748b", faint: "#475569" },
  accent: { DEFAULT: "#2563eb", hover: "#3b82f6", light: "#2563eb18" },
  success: { DEFAULT: "#22c55e", light: "#22c55e18" },
  danger: { DEFAULT: "#ef4444", light: "#ef444418" },
  warning: { DEFAULT: "#eab308", light: "#eab30818" },
  rare: { DEFAULT: "#8b5cf6", light: "#8b5cf618" },
  legendary: { DEFAULT: "#eab308", light: "#eab30818" },
},
borderRadius: { sm: "6px", md: "10px", lg: "14px", xl: "16px", "2xl": "20px" },
boxShadow: {
  card: "0 1px 3px rgba(0,0,0,.3), 0 1px 2px rgba(0,0,0,.2)",
  hover: "0 8px 30px rgba(37,99,235,.12)",
  elevated: "0 4px 20px rgba(0,0,0,.4)",
},
fontFamily: {
  sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"],
  mono: ["ui-monospace", "SFMono-Regular", "SF Mono", "Menlo", "monospace"],
},
```

### Component Rules
1. **Cards:** `bg-card border border-border rounded-lg` — hover adds `border-accent` + `shadow-hover` + `translateY(-3px)`
2. **Buttons Primary:** `bg-gradient-to-r from-accent to-[#7c3aed] text-white rounded-lg font-bold`
3. **Tables:** No cell borders. Header row: `bg-bg text-faint text-xs uppercase tracking-wider`. Row dividers: `border-b border-border`. Hover: `bg-elevated`.
4. **Stats bar:** Horizontal flex, items separated by 28px gap. Label: 11px faint. Value: 15px bold mono.
5. **Verified badge:** Blue circle with white checkmark SVG, 14px.
6. **Price display:** `font-mono font-bold` — always. Green for positive change, red for negative.
7. **Sparklines:** Inline SVG polylines. Green stroke if uptrend, red if downtrend. Fill with gradient fade.
8. **Rarity badges:** Rounded pill, background with 0.1 opacity of color. Legendary=gold, Rare=purple, Common=no badge, Below Market=green.
9. **Full Set badge:** Green with "Full Set" text when both box AND papers.

---

## BLOCK 7: FILE STRUCTURE

```
src/
├── app/
│   ├── layout.tsx                        # Root layout: Inter font, dark theme, metadata
│   ├── page.tsx                          # Discover page (home)
│   ├── collections/
│   │   └── page.tsx                      # All brands ranked table
│   ├── collection/
│   │   ├── [brandSlug]/
│   │   │   ├── page.tsx                  # Brand page (THE critical page)
│   │   │   └── [modelSlug]/page.tsx      # Model-filtered view
│   ├── item/
│   │   └── [listingId]/page.tsx          # Listing detail
│   ├── activity/
│   │   └── page.tsx                      # Activity feed
│   ├── analytics/
│   │   └── page.tsx                      # Market analytics
│   ├── list/
│   │   └── page.tsx                      # Create listing form
│   ├── profile/
│   │   └── [userId]/page.tsx             # User profile
│   ├── api/v1/                           # All API routes (see Block 4)
│   │   ├── brands/route.ts
│   │   ├── brands/[slug]/route.ts
│   │   ├── listings/route.ts
│   │   ├── listings/[id]/route.ts
│   │   ├── offers/route.ts
│   │   ├── activity/route.ts
│   │   ├── analytics/
│   │   │   ├── overview/route.ts
│   │   │   ├── momentum/route.ts
│   │   │   └── supply-risk/route.ts
│   │   ├── price-history/[modelId]/route.ts
│   │   ├── admin/
│   │   │   ├── brands/route.ts
│   │   │   └── models/route.ts
│   │   └── cron/
│   │       ├── snapshot-prices/route.ts
│   │       └── expire-listings/route.ts
│   └── (auth)/
│       ├── login/page.tsx
│       └── register/page.tsx
├── components/
│   ├── layout/
│   │   ├── top-nav.tsx                   # Sticky nav bar
│   │   ├── search-bar.tsx                # Global search with autocomplete
│   │   └── footer.tsx
│   ├── discover/
│   │   ├── trending-table.tsx            # Ranked collections table
│   │   ├── featured-carousel.tsx         # Featured brand cards
│   │   ├── top-movers.tsx                # Top movers grid
│   │   └── category-tabs.tsx             # Category filter tabs
│   ├── brand/
│   │   ├── brand-banner.tsx              # Banner + icon + name
│   │   ├── brand-stats-bar.tsx           # Floor, volume, change, listed, owners
│   │   ├── model-tabs.tsx                # Model sub-navigation
│   │   ├── filter-sidebar.tsx            # Status, Material, Condition, Price filters
│   │   └── listing-grid.tsx              # Item cards in grid/list view
│   ├── listing/
│   │   ├── listing-card.tsx              # Individual item card (grid mode)
│   │   ├── listing-row.tsx               # Individual item row (list mode)
│   │   ├── listing-detail.tsx            # Full listing page content
│   │   ├── traits-grid.tsx               # OpenSea-style property boxes
│   │   ├── price-box.tsx                 # Price + Buy/Offer buttons
│   │   └── similar-listings.tsx          # "More from this model"
│   ├── analytics/
│   │   ├── momentum-table.tsx            # Hot/cold rankings
│   │   ├── supply-risk-matrix.tsx        # Oversaturation risk table
│   │   ├── roi-signals.tsx               # Investment potential cards
│   │   └── brand-market-share.tsx        # Market share visualization
│   ├── charts/
│   │   ├── sparkline.tsx                 # Inline mini chart
│   │   ├── price-chart.tsx               # Interactive price history
│   │   └── volume-chart.tsx              # Volume bars
│   └── shared/
│       ├── verified-badge.tsx            # Blue checkmark
│       ├── rarity-badge.tsx              # Color-coded rarity pill
│       ├── full-set-badge.tsx            # Box + Papers indicator
│       ├── price-change.tsx              # +2.3% green / -1.5% red
│       ├── loading-skeleton.tsx          # Shimmer loading states
│       └── empty-state.tsx               # "No items found"
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   ├── admin.ts
│   │   └── middleware.ts
│   ├── utils/
│   │   ├── currency.ts                   # formatCurrency, parseCurrency
│   │   ├── dates.ts                      # timeAgo, formatDate
│   │   ├── analytics.ts                  # computeFloor, computeSupplyRatio, computeMomentum
│   │   └── errors.ts                     # AppError class
│   ├── validations/
│   │   ├── listing.ts                    # Zod schema for create/update listing
│   │   ├── offer.ts                      # Zod schema for offers
│   │   └── search.ts                     # Zod schema for search/filter params
│   ├── constants.ts                      # MATERIALS, CONDITIONS, CATEGORIES, etc.
│   └── types.ts                          # TypeScript interfaces
└── hooks/
    ├── use-listings.ts                   # Fetch/filter listings
    ├── use-brand.ts                      # Fetch brand data
    ├── use-analytics.ts                  # Fetch analytics data
    └── use-realtime.ts                   # Supabase Realtime subscriptions
```

---

## BLOCK 8: BUILD PHASES

### Phase 1: Foundation (Day 1-2)
- [ ] Project scaffold: Next.js + TypeScript + Tailwind + shadcn/ui
- [ ] All design tokens in tailwind.config.ts (dark theme from Block 6)
- [ ] Supabase project + all migrations from Block 1
- [ ] Seed data: 8 brands, 30+ models, 500+ sample listings
- [ ] Core utilities: currency.ts, dates.ts, analytics.ts, errors.ts
- [ ] Zod schemas for all entities
- [ ] Type definitions
- [ ] Top nav component
- [ ] Auth pages (login/register)

### Phase 2: Browse Experience (Day 3-5)
- [ ] Discover page (home): trending table, featured carousel, top movers, category tabs
- [ ] Collections page: ranked brand table with sort options
- [ ] Brand page (THE critical page): banner, stats bar, model tabs, sidebar filters, item grid with grid/list toggle
- [ ] Listing card component (grid + list variants)
- [ ] Search with autocomplete
- [ ] Sparkline charts
- [ ] Verified badges, rarity badges, full set badges

### Phase 3: Listing Detail + Seller Flow (Day 6-8)
- [ ] Listing detail page: image, traits grid, price box, seller info, price history chart, similar items
- [ ] Create listing form with image upload
- [ ] Edit listing, update price
- [ ] Delist functionality
- [ ] Offer system: make/cancel/accept/reject
- [ ] Activity feed page
- [ ] Market events recording on every action

### Phase 4: Analytics Engine (Day 9-11)
- [ ] Analytics overview page
- [ ] Momentum rankings (hot/cold)
- [ ] Supply risk matrix
- [ ] ROI signals
- [ ] Brand market share
- [ ] Price history charts (interactive, per model)
- [ ] Cron jobs: daily snapshots, expire listings, compute analytics
- [ ] Real-time price updates via Supabase Realtime

### Phase 5: Polish + Deploy (Day 12-14)
- [ ] Mobile responsive (375px minimum)
- [ ] Loading skeletons on every page
- [ ] Empty states
- [ ] Error boundaries
- [ ] SEO metadata
- [ ] Image optimization
- [ ] Rate limiting on all write routes
- [ ] RLS policies
- [ ] Vercel deployment
- [ ] Production seed data

---

## BLOCK 9: SEED DATA

Pre-populate the database with these brands and models (real production data):

```
BRANDS:
1. Rolex — 1,240,000/yr — 29.2% share — Geneva, Switzerland — 1905
2. Patek Philippe — 72,000/yr — 5.1% share — Geneva, Switzerland — 1839
3. Audemars Piguet — 50,000/yr — 7.0% share — Le Brassus, Switzerland — 1875
4. Omega — 570,000/yr — 7.7% share — Biel/Bienne, Switzerland — 1848
5. Richard Mille — 5,500/yr — 2.7% share — Les Breuleux, Switzerland — 2001
6. Vacheron Constantin — 25,000/yr — 2.2% share — Geneva, Switzerland — 1755
7. Cartier — 450,000/yr — 7.0% share — Paris, France — 1847
8. A. Lange & Söhne — 5,500/yr — 1.2% share — Glashütte, Germany — 1845
9. IWC — 80,000/yr — 2.6% share — Schaffhausen, Switzerland — 1868
10. Breitling — 170,000/yr — 2.6% share — Grenchen, Switzerland — 1884

MODELS per brand: (see prototype watchmarket-v2.jsx for complete model data with reference numbers, floor/avg/ceiling prices, categories, and year introduced)
```

---

## REFERENCE FILE

The interactive prototype is `watchmarket-v2.jsx` — use it as visual reference for every component. It contains the complete data model, all page layouts, and the exact user flow. Make it look like that, but production-grade with real Supabase data.
