# Agent 9 Requirements — Dealer Profiles + Collection Pages

## The Vision (OpenSea UX for watches)

### 1. Collection Page = Watch Reference
URL: /ref/[refNumber] (e.g. /ref/126710BLRO)

Like OpenSea's collection page:
- Shows ALL listings for that specific reference from ALL sources (Chrono24, eBay, WatchBox, etc.)
- Filter bar: condition, price range, has box, has papers, source, dealer
- Sort: price low→high, newest, best deal
- Each card: image, price, condition, source badge, dealer name
- Click a dealer name → goes to dealer profile page

### 2. Brand Page = Like OpenSea category
URL: /brand/[brandSlug] (e.g. /brand/rolex)

Shows all refs for that brand as collection cards:
- Each ref card: ref number, model name, floor price, # listed, 30d trend
- Click ref → goes to /ref/[refNumber] collection page

### 3. Dealer Profile Page = Like OpenSea holder profile
URL: /dealer/[dealerSlug] or /dealer/[dealerId]

Shows everything from ONE dealer:
- Dealer header: name, location, verified badge, total listings, avg price
- Grid of all their current listings (same card style as collection page)
- Filter by brand, price range, condition
- If dealer has Chrono24 profile → show link to their C24 page

### 4. Cross-linking everywhere
- On every listing card → dealer name is clickable → goes to dealer profile
- On dealer profile → brand tags are clickable → goes to brand page
- On brand page → ref cards are clickable → goes to ref collection page
- On ref collection page → dealer names clickable → dealer profile

### Data sources for these pages
- market_data table (unified, already built by Agent 8)
- chrono24_dealers table (for dealer metadata)
- profiles table (for OpenWatch native dealers)

### API Routes needed
GET /api/dealers → list all dealers (chrono24_dealers + profiles with role=dealer)
GET /api/dealers/[slug] → dealer info + all their listings from market_data
GET /api/brand/[brand] → all refs for a brand with stats
GET /api/ref/[refNumber] → all listings for a ref (already exists, enhance it)
