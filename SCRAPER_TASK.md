# Task: eBay Sold Listings + Auction House Scrapers

## Goal
Populate `market_sales` table with real confirmed transaction data from eBay sold listings, Phillips, and Christie's auctions. This is the highest-trust data in the system.

## ENV vars available in .env.local
- NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- EBAY_CLIENT_ID (may be empty — handle gracefully)
- EBAY_CLIENT_SECRET (may be empty — handle gracefully)

## Target refs to scrape (priority order)
126610LN, 126610LV, 126710BLRO, 126710BLNR, 126500LN, 126720VTNR, 124060, 126333, 228238, 5711/1A-011, 5726/1A-001, 15510ST.OO.1320ST.06, 26240ST.OO.1320ST.02, 4500V/110A-B128

---

## SCRAPER 1 — eBay Sold Listings (`scripts/scrape-ebay-sold.mjs`)

### Auth strategy
eBay Browse API requires OAuth. Use Client Credentials flow:
```
POST https://api.ebay.com/identity/v1/oauth2/token
Authorization: Basic base64(CLIENT_ID:CLIENT_SECRET)
Content-Type: application/x-www-form-urlencoded
Body: grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope
```

If EBAY_CLIENT_ID is empty, skip eBay scraper and log "EBAY_CLIENT_ID not set — skipping".

### Search endpoint
```
GET https://api.ebay.com/buy/browse/v1/item_summary/search
  ?q={ref_number}+watch+rolex
  &filter=buyingOptions:{AUCTION|FIXED_PRICE},conditions:{USED},priceCurrency:USD
  &sort=newlyListed
  &limit=50
```

For sold listings use:
```
GET https://api.ebay.com/buy/browse/v1/item_summary/search
  ?q={ref_number}+watch
  &filter=soldItems:true,priceCurrency:USD
  &sort=newlyListed
  &limit=50
```

### Map to market_sales schema
```js
{
  ref_number: extracted from title/description,
  brand: detected from ref (Rolex/Patek/AP/VC),
  model: item title cleaned,
  price: item.price.value (as float),
  currency: 'USD',
  condition: item.condition,
  has_box: title.toLowerCase().includes('box'),
  has_papers: title.toLowerCase().includes('papers') || title.toLowerCase().includes('card'),
  source: 'ebay',
  dealer_name: item.seller?.username,
  listing_url: item.itemWebUrl,
  sold_at: item.itemEndDate || new Date().toISOString(),
  scraped_at: new Date().toISOString(),
  trust_score: 0.9
}
```

---

## SCRAPER 2 — Phillips Auctions (`scripts/scrape-phillips.mjs`)

Phillips publishes results at: `https://www.phillips.com/auctions/auction/SALE_ID/lot/LOT_NUM`
And listings at: `https://www.phillips.com/watches`

Use their search API (no auth required):
```
GET https://www.phillips.com/api/search/lots?department=watches&query={ref_number}&page=1&perPage=24&auctionStatus=past
```

If that 404s, try scraping:
```
https://www.phillips.com/search#department=Watches&query={ref_number}&status=sold
```

Use `node-fetch` (already in package.json) with headers:
```js
{ 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
```

Map to market_sales:
```js
{
  ref_number: ref,
  brand: detected,
  model: lot.title,
  price: lot.priceRealized?.amount || lot.estimate?.high,
  currency: lot.priceRealized?.currency || 'USD',
  source: 'phillips',
  dealer_name: 'Phillips Auction House',
  listing_url: `https://www.phillips.com${lot.url}`,
  sold_at: lot.saleDate,
  scraped_at: new Date().toISOString(),
  trust_score: 1.0
}
```

---

## SCRAPER 3 — Christie's Auctions (`scripts/scrape-christies.mjs`)

Christie's search:
```
GET https://www.christies.com/api/discoverywebsite/lotfinderweb/search
  ?keyword={ref_number}&department=watches&resultsperpage=20&searchtype=lot&isarchive=true
```

Headers: `{ 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }`

Map to market_sales same as Phillips with `source: 'christies'`, `trust_score: 1.0`.

---

## market_sales table schema

Check if it exists. If not, create via Supabase JS:
```sql
create table if not exists market_sales (
  id uuid default gen_random_uuid() primary key,
  ref_number text not null,
  brand text,
  model text,
  price numeric not null,
  currency text default 'USD',
  condition text,
  has_box boolean default false,
  has_papers boolean default false,
  source text not null,
  dealer_name text,
  listing_url text,
  sold_at timestamptz,
  scraped_at timestamptz default now(),
  trust_score numeric default 0.5,
  created_at timestamptz default now()
);
create index if not exists market_sales_ref_idx on market_sales(ref_number);
create index if not exists market_sales_source_idx on market_sales(source);
```

---

## Execution order
1. Create all 3 scripts
2. Run: `node scripts/scrape-ebay-sold.mjs` (skip gracefully if no key)
3. Run: `node scripts/scrape-phillips.mjs`
4. Run: `node scripts/scrape-christies.mjs`
5. Log total rows inserted per source
6. Run: `npx tsc --noEmit`
7. Commit + push + PR

## Commit message
`feat(scrapers): eBay sold listings + Phillips + Christie's auction scrapers → market_sales`
