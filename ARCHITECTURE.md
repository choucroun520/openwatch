# OpenWatch — Unified Data Architecture
> The Bloomberg Terminal for the global luxury watch market.
> Version 1.0 — March 2026

---

## Overview

This document is the definitive design specification for how OpenWatch ingests, normalizes, deduplicates, and prices data from 10+ global sources. It supersedes ad-hoc table design and establishes a production-grade architecture that scales from our first dealer (RC Crown) to full global market coverage.

**The two problems we solve:**

1. **Unified Model** — A single table (`watch_market_events`) that every scraper writes to, replacing the fragmented `market_comps` / `market_sales` split.
2. **Deduplication** — A multi-tier signal system that detects when the same physical watch appears across multiple platforms and currencies, preventing inflated floor/avg price calculations.

---

## Section 1: Unified Data Model — `watch_market_events`

### Design Rationale

The current system has a critical split: asking prices go to `market_comps`, confirmed sales go to `market_sales`. Every query that needs a complete picture (e.g. "what is the true floor for ref 126610LN?") must JOIN across both tables, apply different schema conventions, and deal with different source-tracking conventions. The unified `watch_market_events` table eliminates this.

Each row represents **one price event for one watch** at one point in time. If the price changes, a new event is appended (the old row gets its `last_seen_at` updated but its original price is preserved in `price_history`). This gives us a complete audit trail.

### Full Schema

```sql
CREATE TABLE IF NOT EXISTS watch_market_events (
  -- ── Identity ──────────────────────────────────────────────────────────────
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Event classification ──────────────────────────────────────────────────
  -- asking         = listed for sale, not yet sold (Chrono24, WatchBox, Bob's, RC Crown)
  -- sold           = confirmed sale (eBay SOLD, Reddit SOLD, WatchCharts)
  -- auction_hammer = final hammer price (Phillips, Christie's, Sotheby's)
  -- auction_estimate = pre-sale estimate (Phillips lot page)
  -- dealer_asking  = from a dealer we have a direct API/feed with (RC Crown)
  event_type           TEXT NOT NULL CHECK (event_type IN (
                         'asking', 'sold', 'auction_hammer',
                         'auction_estimate', 'dealer_asking'
                       )),

  -- ── Source tracking ───────────────────────────────────────────────────────
  -- Values: chrono24_us, chrono24_de, chrono24_fr, chrono24_uk, chrono24_jp,
  --         chrono24_hk, chrono24_sg, chrono24_ch, chrono24_ae,
  --         watchbox, bobs_watches, yahoo_japan, ebay_sold,
  --         phillips, christies, sothebys, reddit_watchexchange,
  --         rccrown, watchcharts
  source               TEXT NOT NULL,
  source_listing_id    TEXT,  -- platform-native ID (prevents re-importing same listing)

  -- ── Watch identity ────────────────────────────────────────────────────────
  -- ref_number is ALWAYS normalized: uppercase, stripped of spaces,
  -- forward-slashes preserved (e.g. "5711/1A-011"), no trailing dashes.
  ref_number           TEXT NOT NULL,
  brand                TEXT,
  model_name           TEXT,
  serial_number        TEXT,  -- if available; enables Tier 1 definitive dedup

  -- ── Price ─────────────────────────────────────────────────────────────────
  price_usd            NUMERIC(12,2) NOT NULL,  -- always in USD, converted at scrape time
  price_local          NUMERIC(12,2),           -- original listed price
  currency_local       CHAR(3),                 -- ISO 4217 (USD, EUR, GBP, JPY, HKD, SGD, CHF, AED)
  fx_rate_used         NUMERIC(10,6),           -- the rate we used to convert to USD

  -- ── Market ────────────────────────────────────────────────────────────────
  market_code          CHAR(2),  -- US, DE, FR, UK, JP, HK, SG, CH, AE

  -- ── Condition (normalized — see Section 3) ───────────────────────────────
  -- Raw value from source is preserved in condition_raw; normalized in condition.
  condition            TEXT CHECK (condition IN (
                         'unworn', 'excellent', 'very_good', 'good', 'fair', NULL
                       )),
  condition_raw        TEXT,  -- original string from the platform ("Very good", "S", etc.)

  -- ── Physical details ─────────────────────────────────────────────────────
  has_box              BOOLEAN,
  has_papers           BOOLEAN,
  year_made            SMALLINT,

  -- ── Seller ────────────────────────────────────────────────────────────────
  -- seller_type: private = individual, dealer = business, broker = no physical stock,
  --              auction_house = Phillips/Christie's/Sotheby's
  seller_type          TEXT CHECK (seller_type IN (
                         'private', 'dealer', 'broker', 'auction_house', NULL
                       )),
  seller_platform_id   TEXT,   -- the seller's ID on the source platform
  seller_name          TEXT,
  dealer_id            UUID REFERENCES dealers(id),  -- if resolved to a known dealer entity

  -- ── Physical holder qualification (from qualify-and-outreach logic) ───────
  is_physical          BOOLEAN,  -- true = we believe they hold the watch
  seller_score         SMALLINT CHECK (seller_score BETWEEN 0 AND 100),

  -- ── Listing content ───────────────────────────────────────────────────────
  listing_url          TEXT,
  images               JSONB DEFAULT '[]'::jsonb,  -- array of image URLs

  -- ── Lifecycle ─────────────────────────────────────────────────────────────
  first_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at         TIMESTAMPTZ NOT NULL DEFAULT now(),  -- bumped each re-scrape
  sold_at              TIMESTAMPTZ,  -- only for sold/auction_hammer events
  days_on_market       INTEGER GENERATED ALWAYS AS (
                         CASE
                           WHEN sold_at IS NOT NULL
                           THEN EXTRACT(DAY FROM sold_at - first_seen_at)::INTEGER
                           ELSE EXTRACT(DAY FROM now() - first_seen_at)::INTEGER
                         END
                       ) STORED,

  -- ── Price history (tracks price reductions over time) ────────────────────
  -- Appended each time the price changes:  [{"price": 14500, "date": "2026-01-15"}, ...]
  price_history        JSONB DEFAULT '[]'::jsonb,
  price_drop_count     SMALLINT NOT NULL DEFAULT 0,

  -- ── Trust / weighting ────────────────────────────────────────────────────
  trust_weight         NUMERIC(3,2),  -- 0.0–1.0, set by source + seller_score (see Section 4)

  -- ── Deduplication (see Section 2) ────────────────────────────────────────
  canonical_id         UUID REFERENCES watch_market_events(id),
  -- canonical_id IS NULL + is_canonical IS TRUE  → this IS the master record
  -- canonical_id IS NOT NULL + is_canonical IS FALSE → this is a duplicate of canonical_id
  -- canonical_id IS NULL + is_canonical IS NULL  → not yet processed by dedup job
  is_canonical         BOOLEAN,
  dedup_confidence     NUMERIC(3,2) CHECK (dedup_confidence BETWEEN 0 AND 1),
  dedup_method         TEXT,  -- which tier/method flagged this as a dup

  -- ── Audit ─────────────────────────────────────────────────────────────────
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ── Constraints ───────────────────────────────────────────────────────────
  -- Prevent importing the exact same platform listing twice:
  CONSTRAINT uq_source_listing UNIQUE (source, source_listing_id)
    DEFERRABLE INITIALLY DEFERRED
);
```

### Indexes

```sql
-- Primary query patterns
CREATE INDEX IF NOT EXISTS idx_wme_ref_number
  ON watch_market_events (ref_number);

CREATE INDEX IF NOT EXISTS idx_wme_ref_event_type
  ON watch_market_events (ref_number, event_type);

CREATE INDEX IF NOT EXISTS idx_wme_source
  ON watch_market_events (source);

CREATE INDEX IF NOT EXISTS idx_wme_brand
  ON watch_market_events (brand);

-- Dedup job scans
CREATE INDEX IF NOT EXISTS idx_wme_serial
  ON watch_market_events (serial_number)
  WHERE serial_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wme_canonical_null
  ON watch_market_events (id)
  WHERE canonical_id IS NULL AND is_canonical IS NULL;

CREATE INDEX IF NOT EXISTS idx_wme_seller_platform
  ON watch_market_events (seller_platform_id, ref_number)
  WHERE seller_platform_id IS NOT NULL;

-- Price calculations (only non-duplicates, non-brokers)
CREATE INDEX IF NOT EXISTS idx_wme_canonical_active
  ON watch_market_events (ref_number, price_usd, event_type)
  WHERE is_canonical = TRUE OR (canonical_id IS NULL AND is_canonical IS NULL);

-- Time-series
CREATE INDEX IF NOT EXISTS idx_wme_first_seen
  ON watch_market_events (first_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_wme_sold_at
  ON watch_market_events (sold_at DESC)
  WHERE sold_at IS NOT NULL;

-- Dealer resolution
CREATE INDEX IF NOT EXISTS idx_wme_dealer_id
  ON watch_market_events (dealer_id)
  WHERE dealer_id IS NOT NULL;

-- Full-text search on seller_name for fuzzy matching
CREATE INDEX IF NOT EXISTS idx_wme_seller_name_trgm
  ON watch_market_events USING gin (seller_name gin_trgm_ops)
  WHERE seller_name IS NOT NULL;
```

---

## Section 2: Deduplication Algorithm

### The Problem

A WatchBox-listed Rolex Sub 126610LN exists as:
- `source=chrono24_us`, `price_usd=14500`, `seller_name="WatchBox"`
- `source=chrono24_de`, `price_usd=14300`, `seller_name="WatchBox Germany"`
- `source=watchbox`, `price_usd=14500`, `seller_name="WatchBox"`

Without deduplication, the floor price is `$14,300` when the "true" floor is really `$14,300` (the cheapest non-duplicate). The avg goes from 1 data point to 3 — artificially narrowing spread. The listing count inflates the demand signal.

### Canonical Record Selection

When a duplicate group is resolved, the **canonical record** is determined by this priority:
1. Highest `trust_weight` source (confirmed sale > dealer with API > marketplace)
2. If tied: oldest `first_seen_at` (the original post)
3. If tied: most complete data (has serial > has condition > has images)

All duplicate records get `canonical_id` set to the master record's UUID. The master gets `is_canonical = TRUE`.

**Price queries MUST filter:** `WHERE is_canonical = TRUE OR (canonical_id IS NULL AND is_canonical IS NULL)` (i.e. "canonical records + unprocessed records").

---

### Tier 1 — Definitive Match (confidence: 1.0)

**Block at insert time — never even write a duplicate row.**

#### Tier 1A: Exact source + listing ID
```
source = X AND source_listing_id = Y
```
Enforced by `UNIQUE (source, source_listing_id)` constraint. If the scraper tries to upsert the same Chrono24 listing ID again, it just updates `last_seen_at` and `price_usd` (if changed), recording the price change in `price_history`.

**Action:** `ON CONFLICT (source, source_listing_id) DO UPDATE SET last_seen_at = now(), price_usd = EXCLUDED.price_usd, ...`
**Manual confirmation:** No.

#### Tier 1B: Serial number + ref number
```
serial_number = X AND ref_number = Y AND serial_number IS NOT NULL
```
Two listings with the same serial number on the same reference are definitively the same watch. This is cross-platform (e.g. RC Crown API + Chrono24).

**Action:** Set `canonical_id` on the newer/lower-trust record. Set `is_canonical = TRUE` on the older/higher-trust one.
**Manual confirmation:** No — serial numbers are unique to a single watch.

---

### Tier 2 — Very Likely Match (confidence: 0.9)

**Auto-merge with confidence flag, no manual review needed.**

#### Tier 2A: Same dealer, same ref, same price across platforms
```
seller_platform_id = X  (or seller_name exact match)
AND ref_number = Y
AND ABS(price_usd - candidate.price_usd) / price_usd < 0.03   -- within 3%
AND event_type IN ('asking', 'dealer_asking')
AND source != candidate.source   -- different platforms
```
Same dealer listing the same watch on Chrono24.com and Chrono24.de simultaneously.

**Action:** Set canonical to the higher-trust source record. Set `dedup_confidence = 0.9`.
**Manual confirmation:** No.

#### Tier 2B: Same ref, same price, same condition, freshly re-posted
```
ref_number = X
AND ABS(price_usd - candidate.price_usd) / price_usd < 0.01   -- within 1%
AND condition = candidate.condition
AND ABS(EXTRACT(EPOCH FROM (first_seen_at - candidate.first_seen_at))) < 172800  -- 48 hours
AND source = candidate.source   -- same platform (e.g. a listing was re-posted)
```
A seller deleted and re-listed the same watch on Chrono24 (common tactic to "refresh" listing age).

**Action:** Set canonical to the older record. Set `dedup_confidence = 0.9`.
**Manual confirmation:** No.

---

### Tier 3 — Probable Match (confidence: 0.7)

**Auto-flag but exclude from price calculations; include in a "review queue" in the admin UI.**

#### Tier 3A: Same seller name (fuzzy) + same ref + approximate price across platforms
```
similarity(seller_name, candidate.seller_name) > 0.7  -- pg_trgm
AND ref_number = X
AND ABS(price_usd - candidate.price_usd) / price_usd < 0.05   -- within 5%
AND source != candidate.source
```
"WatchBox USA" vs "WatchBox" vs "The Watch Box" — same dealer, different platform naming conventions.

**Action:** Set `dedup_confidence = 0.7`, set `canonical_id` pointing to the preferred record. Exclude from aggregations.
**Manual confirmation:** Optional — surface in admin review queue.

#### Tier 3B: Same ref, same condition, same year, same market, price within 5%
```
ref_number = X
AND condition = Y
AND year_made = Z
AND market_code = W
AND ABS(price_usd - candidate.price_usd) / price_usd < 0.05
AND first_seen_at BETWEEN candidate.first_seen_at - INTERVAL '14 days'
                      AND candidate.first_seen_at + INTERVAL '14 days'
AND seller_type IN ('private', 'dealer')  -- not auction houses
```
Same private seller listing the same watch on Chrono24.com and Chrono24.de.

**Action:** Set `dedup_confidence = 0.7`. Treat as probable duplicate.
**Manual confirmation:** Recommended.

---

### Tier 4 — Possible Match (confidence: 0.5)

**Flag for human review only. Never auto-exclude from price calculations.**

#### Tier 4A: Image hash match
```
images[0] hash = candidate.images[0] hash
AND ref_number = X
```
Same primary image = almost certainly the same listing. (Requires image download + perceptual hashing in the scraper pipeline, implemented as P2 work.)

**Action:** Set `dedup_confidence = 0.5`, surface in review queue.
**Manual confirmation:** Required before excluding from calculations.

#### Tier 4B: Loose signal combination
```
ref_number = X
AND price_usd within 5% of candidate.price_usd
AND has_box = candidate.has_box
AND has_papers = candidate.has_papers
AND market_code = candidate.market_code
AND first_seen_at within 7 days of candidate.first_seen_at
```
**Action:** Set `dedup_confidence = 0.5`. Surface in review queue.
**Manual confirmation:** Required.

---

### Dedup Job Pseudocode

See `scripts/dedup-job.mjs` for the full implementation. Conceptual flow:

```
FOR EACH unprocessed row (canonical_id IS NULL AND is_canonical IS NULL):

  // Tier 1B — serial number
  IF serial_number IS NOT NULL:
    candidate = find row WHERE serial_number = this.serial_number
                           AND ref_number = this.ref_number
                           AND id != this.id
    IF found:
      resolve_group(this, candidate, confidence=1.0, method='serial_match')
      CONTINUE

  // Tier 2A — same dealer, same ref, price within 3%
  candidates = find rows WHERE seller_platform_id = this.seller_platform_id
                           AND ref_number = this.ref_number
                           AND price within 3% of this.price_usd
                           AND source != this.source
                           AND seller_platform_id IS NOT NULL
  IF candidates.length > 0:
    resolve_group(this, best_candidate, confidence=0.9, method='same_dealer_cross_platform')
    CONTINUE

  // Tier 2B — same platform re-post
  candidates = find rows WHERE source = this.source
                           AND ref_number = this.ref_number
                           AND price within 1%
                           AND condition = this.condition
                           AND first_seen within 48h
  IF found: resolve_group(..., confidence=0.9, method='repost')

  // Tier 3A — fuzzy seller name
  candidates = find rows WHERE ref_number = this.ref_number
                           AND similarity(seller_name, this.seller_name) > 0.7
                           AND price within 5%
                           AND source != this.source
  IF found: resolve_group(..., confidence=0.7, method='fuzzy_seller')

  // Tier 3B — same watch, same market
  candidates = find rows WHERE ref_number = this.ref_number
                           AND condition = this.condition
                           AND year_made = this.year_made
                           AND market_code = this.market_code
                           AND price within 5%
                           AND first_seen within 14 days
  IF found: resolve_group(..., confidence=0.7, method='same_market_same_watch')

  // No duplicate found — mark as canonical
  UPDATE row SET is_canonical = TRUE

FUNCTION resolve_group(rowA, rowB, confidence, method):
  canonical = pick_canonical(rowA, rowB)   // higher trust_weight, then older
  duplicate = the other one
  UPDATE canonical SET is_canonical = TRUE
  UPDATE duplicate SET canonical_id = canonical.id,
                       is_canonical = FALSE,
                       dedup_confidence = confidence,
                       dedup_method = method
```

---

## Section 3: Condition Normalization

### The 5 Canonical Values

| Value      | Meaning |
|------------|---------|
| `unworn`   | Brand new, never worn. Stickers may be present. |
| `excellent`| Worn very few times. No visible marks under normal light. |
| `very_good`| Light wear. Normal micro-scratches. No deep marks. |
| `good`     | Visible wear, scratches. May have been polished. |
| `fair`     | Heavy wear, deep scratches. May need service. |

### Platform Mapping

#### Chrono24 (all regional domains)
| Chrono24 Raw | Canonical |
|---|---|
| `Unworn` | `unworn` |
| `Very good` | `very_good` |
| `Good` | `good` |
| `Fair` | `fair` |
| `Poor` | `fair` |
| `New` | `unworn` |
| `Mint` | `excellent` |
| `Like new` | `excellent` |

#### eBay
| eBay Raw | Canonical |
|---|---|
| `New with tags` | `unworn` |
| `New without tags` | `excellent` |
| `Brand New` | `unworn` |
| `Pre-owned` | `very_good` (default; refine via description) |
| `For parts or not working` | `fair` |

#### WatchBox
| WatchBox Raw | Canonical |
|---|---|
| `Unworn` | `unworn` |
| `Excellent+` | `excellent` |
| `Excellent` | `excellent` |
| `Very Good` | `very_good` |
| `Good` | `good` |

#### Bob's Watches
| Bob's Raw | Canonical |
|---|---|
| `Unworn` | `unworn` |
| `Mint` | `excellent` |
| `Excellent` | `excellent` |
| `Very Good` | `very_good` |
| `Good` | `good` |

#### Yahoo Auctions Japan (numeric grades)
| Yahoo Japan Grade | Canonical |
|---|---|
| `N` (新品 — new) | `unworn` |
| `S` (未使用 — unused) | `unworn` |
| `A` (美品 — beautiful) | `excellent` |
| `B` (良品 — good quality) | `very_good` |
| `C` (可 — acceptable) | `good` |
| `D` (不良 — poor) | `fair` |

#### RC Crown (our API)
| RC Crown Raw | Canonical |
|---|---|
| `New` / `Unworn` | `unworn` |
| `Mint` / `Like new` | `excellent` |
| `Excellent` | `excellent` |
| `Slider` (their term for lightly adjusted) | `excellent` |
| `Very Good` / `Very good condition` | `very_good` |
| `Good` / `Good condition` | `good` |
| `Fair` | `fair` |

#### Auction Houses (Phillips, Christie's, Sotheby's)
| Auction Raw | Canonical |
|---|---|
| `Excellent condition` | `excellent` |
| `Very good condition` | `very_good` |
| `Good condition` | `good` |
| *(no grade given)* | `very_good` (default for auction lots) |
| `Some wear` / `signs of wear` | `good` |

#### Reddit r/WatchExchange
Condition grades in Reddit SOLD posts are free-form. Apply this heuristic:
- Post says "mint", "like new", "never worn": → `excellent`
- Post says "lightly used", "minimal wear": → `very_good`
- Post says "some scratches", "light scratches": → `good`
- Post says "heavily worn", "needs service": → `fair`
- Default (no condition stated): → `very_good`

### SQL normalize_condition() Function

See `scripts/setup-unified-schema.sql` for the full `normalize_condition(TEXT)` SQL function.

---

## Section 4: Source Trust Hierarchy

### Rationale

Not all price data is equally trustworthy. A confirmed sale price ($14,200 hammer at Phillips) tells us what a watch **actually sold for**. An asking price from a broker who doesn't hold the watch tells us nothing — it could be wish-pricing or an impossible sourcing promise.

We assign `trust_weight` (0.0 to 1.0) to each event. Price calculations use this weight.

### Trust Tiers

**Tier 1 — Confirmed Sale (event_type = 'sold' or 'auction_hammer')**
*The watch changed hands at this price. Highest signal.*

| Source | trust_weight | Notes |
|---|---|---|
| `phillips` | 1.0 | Auction hammer price = confirmed transaction |
| `christies` | 1.0 | Same |
| `sothebys` | 1.0 | Same |
| `ebay_sold` | 0.9 | eBay completed/sold — buyer paid this |
| `reddit_watchexchange` (SOLD flair) | 0.8 | Self-reported, but community-verified |
| `watchcharts` | 0.85 | Aggregated confirmed sales API |

**Tier 2 — Reputable Dealer Asking (event_type = 'dealer_asking' or 'asking')**
*These dealers hold physical inventory and price accurately.*

| Source | trust_weight | Notes |
|---|---|---|
| `rccrown` | 0.9 | We have direct API access; they hold the watch |
| `watchbox` | 0.85 | Major US dealer, authenticated, holds inventory |
| `bobs_watches` | 0.85 | Rolex specialist, accurate prices |

**Tier 3 — Marketplace Asking (physical holder, verified)**
*Listed on open marketplace, but seller signals indicate they hold the watch.*

| Condition | trust_weight | Notes |
|---|---|---|
| Any Chrono24 source + `seller_score > 70` | 0.7 | High confidence physical holder |
| `yahoo_japan` (Buy-It-Now, 0 bids) | 0.65 | Japanese market BIN is usually physical |

**Tier 4 — Marketplace Asking (uncertain)**
*Listed on open marketplace, seller status unclear.*

| Condition | trust_weight | Notes |
|---|---|---|
| Any Chrono24 source + `seller_score 40–70` | 0.5 | Uncertain holder status |
| `yahoo_japan` (active auction, bids > 0) | 0.6 | Active bids = real demand signal |

**Tier 5 — Broker / Not Holding (EXCLUDE from price calculations)**
*These listings do not represent real available inventory.*

| Condition | trust_weight | Notes |
|---|---|---|
| Any source + `seller_score < 40` | 0.0 | Broker signals detected |
| Any source + condition text contains "available to order" / "on request" | 0.0 | No physical stock |

### Trust Weight Assignment at Ingest

The `trust_weight` is computed and stored at insert time using this logic:

```javascript
function computeTrustWeight(event) {
  // Tier 1 — confirmed sales
  if (['phillips','christies','sothebys'].includes(event.source)) return 1.0;
  if (event.source === 'ebay_sold') return 0.9;
  if (event.source === 'watchcharts') return 0.85;
  if (event.source === 'reddit_watchexchange' && event.event_type === 'sold') return 0.8;

  // Tier 2 — reputable dealers
  if (event.source === 'rccrown') return 0.9;
  if (['watchbox','bobs_watches'].includes(event.source)) return 0.85;

  // Tier 5 — broker exclusions (check before Tier 3/4)
  if (event.seller_score !== null && event.seller_score < 40) return 0.0;

  // Tier 3 — marketplace physical holders
  if (event.seller_score > 70) return 0.7;
  if (event.source === 'yahoo_japan' && event.event_type === 'asking') return 0.65;

  // Tier 4 — marketplace uncertain
  if (event.seller_score >= 40 && event.seller_score <= 70) return 0.5;
  if (event.source === 'yahoo_japan') return 0.6;

  // Default
  return 0.5;
}
```

### Weighted Average Price Formula

Given a set of canonical (non-duplicate) listings for a ref number, the **weighted average price** is:

```
weighted_avg = SUM(price_usd * trust_weight) / SUM(trust_weight)
```

Where the eligible set is:
```sql
WHERE ref_number = $ref
  AND trust_weight > 0
  AND (is_canonical = TRUE OR (canonical_id IS NULL AND is_canonical IS NULL))
  AND last_seen_at > now() - INTERVAL '90 days'
```

### True Floor vs Asking Floor

**`true_floor_price`** — The minimum price from Tier 1 + Tier 2 sources only (confirmed sales and reputable dealers). This is the most reliable signal for what you could actually buy a watch for today:
```sql
SELECT MIN(price_usd) AS true_floor
FROM watch_market_events
WHERE ref_number = $ref
  AND trust_weight >= 0.85
  AND (is_canonical = TRUE OR (canonical_id IS NULL AND is_canonical IS NULL))
  AND last_seen_at > now() - INTERVAL '90 days'
```

**`asking_floor_price`** — The minimum price from all non-broker sources. Lower than true_floor because it includes unverified marketplace listings:
```sql
SELECT MIN(price_usd) AS asking_floor
FROM watch_market_events
WHERE ref_number = $ref
  AND trust_weight > 0
  AND (is_canonical = TRUE OR (canonical_id IS NULL AND is_canonical IS NULL))
  AND last_seen_at > now() - INTERVAL '90 days'
```

The UI should display `asking_floor` to show the cheapest available listing, with a note that `true_floor` from verified sources is higher. This creates the "you can find one for $X but trusted dealers have it at $Y" insight.

---

## Section 5: Dealer Entity Resolution

### The Problem

The same dealer appears under different names across platforms:
- Chrono24.com: `"WatchBox"`
- Chrono24.de: `"WatchBox Germany GmbH"`
- Their website: `thewatchbox.com`
- Reddit: `u/watchbox_official`

Without entity resolution, our seller_score and trust calculations operate on anonymous strings. With it, we can say "WatchBox has $42M in verified transactions, reliability_score=95, confirmed physical holder."

### The `dealers` Table

```sql
CREATE TABLE IF NOT EXISTS dealers (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name              TEXT NOT NULL UNIQUE,
  verified                    BOOLEAN NOT NULL DEFAULT FALSE,

  -- JSON map of platform → platform-specific identifier
  -- {"chrono24_com": "watchbox-usa", "chrono24_de": "watchbox-de",
  --  "website": "thewatchbox.com", "reddit": "watchbox_official"}
  platform_identifiers        JSONB NOT NULL DEFAULT '{}'::jsonb,

  country                     CHAR(2),  -- ISO 3166-1 alpha-2
  -- broker = no physical stock, physical = holds inventory,
  -- auction_house = Phillips/Christie's/Sotheby's
  dealer_type                 TEXT CHECK (dealer_type IN (
                                'broker', 'physical', 'auction_house'
                              )),

  reliability_score           SMALLINT DEFAULT 50 CHECK (reliability_score BETWEEN 0 AND 100),
  -- Updated from transaction history: % of listings that resulted in confirmed sales
  -- 100 = every listing sold as described, 0 = all disputes/chargebacks

  total_listings              INTEGER NOT NULL DEFAULT 0,
  confirmed_physical_listings INTEGER NOT NULL DEFAULT 0,
  -- confirmed_physical_listings / total_listings = physical_ratio
  -- physical_ratio > 0.7 → likely physical dealer

  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dealers_canonical_name
  ON dealers (canonical_name);

CREATE INDEX IF NOT EXISTS idx_dealers_platform_ids
  ON dealers USING gin (platform_identifiers);

-- Allow fast lookup by website domain
CREATE INDEX IF NOT EXISTS idx_dealers_website
  ON dealers ((platform_identifiers->>'website'));
```

### Resolution Algorithm

When a scraper produces a `seller_name` string, we resolve it to a `dealers.id` via:

**Step 1 — Platform ID exact match**
```sql
SELECT id FROM dealers
WHERE platform_identifiers->>$source = $seller_platform_id
LIMIT 1
```
If `seller_platform_id` from the scraper matches a known platform identifier → resolved.

**Step 2 — Canonical name exact match**
```sql
SELECT id FROM dealers
WHERE canonical_name ILIKE $seller_name
LIMIT 1
```

**Step 3 — Fuzzy name match (Levenshtein distance)**
```sql
SELECT id, canonical_name
FROM dealers
WHERE similarity(canonical_name, $seller_name) > 0.6
ORDER BY similarity(canonical_name, $seller_name) DESC
LIMIT 1
```
Only accept if distance ≤ 3 characters AND similarity > 0.6.

**Step 4 — URL domain match**
```sql
SELECT id FROM dealers
WHERE platform_identifiers->>'website' = $extracted_domain
LIMIT 1
```
Extract domain from `listing_url` (e.g. `thewatchbox.com`), match against `platform_identifiers.website`.

**Step 5 — Create new dealer record (unverified)**
If no match found, create a new `dealers` row with `verified=FALSE`. Admin reviews and merges.

**Step 6 — Manual tagging**
Admin UI allows: "mark dealer A and dealer B as the same entity" → merges their records, updates all `watch_market_events.dealer_id` references.

### Pre-seeded Known Dealers

```sql
INSERT INTO dealers (canonical_name, verified, dealer_type, country, reliability_score, platform_identifiers) VALUES
  ('WatchBox',        TRUE, 'physical',     'US', 90, '{"chrono24_com":"watchbox-usa","chrono24_de":"watchbox-de","website":"thewatchbox.com"}'),
  ("Bob's Watches",   TRUE, 'physical',     'US', 88, '{"website":"bobswatches.com","source_direct":"bobs_watches"}'),
  ('RC Crown',        TRUE, 'physical',     'US', 92, '{"website":"rccrown.com","source_direct":"rccrown"}'),
  ('Phillips',        TRUE, 'auction_house','CH', 99, '{"website":"phillips.com","source_direct":"phillips"}'),
  ('Christie''s',     TRUE, 'auction_house','UK', 99, '{"website":"christies.com","source_direct":"christies"}'),
  ('Sotheby''s',      TRUE, 'auction_house','UK', 99, '{"website":"sothebys.com","source_direct":"sothebys"}')
ON CONFLICT (canonical_name) DO NOTHING;
```

---

## Section 6: Migration Plan

### Current State

| Table | Rows (approx) | Action |
|---|---|---|
| `market_comps` | asking prices from Chrono24 | Migrate → `watch_market_events` |
| `market_sales` | eBay/Phillips/Reddit confirmed sales | Migrate → `watch_market_events` |
| `listings` | RC Crown + internal dealer inventory | Keep as-is; add feed into `watch_market_events` |
| `price_snapshots_v2` | daily price aggregates | Keep; update to use new table |
| `chrono24_listings` | raw Chrono24 tracking | Migrate into `watch_market_events` |
| `deal_pipeline` | negotiation tracking | Keep; reference `watch_market_events.id` |

### Step 1: Create Tables

Run `scripts/setup-unified-schema.sql`.

### Step 2: Migrate `market_comps` → `watch_market_events`

```sql
INSERT INTO watch_market_events (
  event_type, source, source_listing_id,
  ref_number, brand,
  price_usd, price_local, currency_local, market_code,
  condition, condition_raw,
  has_box, has_papers,
  seller_name, seller_score, is_physical,
  listing_url,
  first_seen_at, last_seen_at,
  trust_weight,
  is_canonical
)
SELECT
  'asking'                                      AS event_type,
  COALESCE(source, 'chrono24_us')               AS source,
  -- market_comps has no listing ID — generate a stable pseudo-ID from url hash
  md5(COALESCE(listing_url, id::text))          AS source_listing_id,
  LOWER(REGEXP_REPLACE(ref_number, '\s+', '', 'g')) AS ref_number,
  brand_name                                    AS brand,
  price::NUMERIC                                AS price_usd,
  price_local::NUMERIC                          AS price_local,
  currency_local                                AS currency_local,
  market_code                                   AS market_code,
  normalize_condition(condition)                AS condition,
  condition                                     AS condition_raw,
  has_box,
  has_papers,
  seller_name,
  seller_score::SMALLINT                        AS seller_score,
  CASE WHEN seller_score > 60 THEN TRUE ELSE FALSE END AS is_physical,
  listing_url,
  COALESCE(scraped_at::TIMESTAMPTZ, created_at) AS first_seen_at,
  COALESCE(scraped_at::TIMESTAMPTZ, created_at) AS last_seen_at,
  -- Trust weight: use seller_score to determine tier
  CASE
    WHEN seller_score < 40                           THEN 0.0
    WHEN seller_score > 70                           THEN 0.7
    WHEN seller_score BETWEEN 40 AND 70              THEN 0.5
    ELSE 0.5
  END                                           AS trust_weight,
  NULL                                          AS is_canonical  -- dedup job will process
FROM market_comps
ON CONFLICT (source, source_listing_id) DO NOTHING;
```

### Step 3: Migrate `market_sales` → `watch_market_events`

```sql
INSERT INTO watch_market_events (
  event_type, source, source_listing_id,
  ref_number, brand,
  price_usd, currency_local,
  condition, condition_raw,
  has_box, has_papers,
  seller_name,
  listing_url,
  first_seen_at, last_seen_at, sold_at,
  trust_weight,
  is_canonical
)
SELECT
  CASE
    WHEN source IN ('phillips','christies','sothebys') THEN 'auction_hammer'
    WHEN source = 'ebay_sold'                          THEN 'sold'
    WHEN source = 'reddit_watchexchange'               THEN 'sold'
    ELSE 'sold'
  END                                               AS event_type,
  source,
  md5(COALESCE(listing_url, id::text))              AS source_listing_id,
  LOWER(REGEXP_REPLACE(ref_number, '\s+', '', 'g')) AS ref_number,
  brand_name                                        AS brand,
  price_usd::NUMERIC                                AS price_usd,
  currency                                          AS currency_local,
  normalize_condition(condition)                    AS condition,
  condition                                         AS condition_raw,
  has_box,
  has_papers,
  seller_name,
  listing_url,
  COALESCE(sale_date::TIMESTAMPTZ, created_at)      AS first_seen_at,
  COALESCE(sale_date::TIMESTAMPTZ, created_at)      AS last_seen_at,
  COALESCE(sale_date::TIMESTAMPTZ, sold_at)         AS sold_at,
  CASE source
    WHEN 'phillips'             THEN 1.0
    WHEN 'christies'            THEN 1.0
    WHEN 'sothebys'             THEN 1.0
    WHEN 'ebay_sold'            THEN 0.9
    WHEN 'reddit_watchexchange' THEN 0.8
    ELSE 0.85
  END                                               AS trust_weight,
  TRUE                                              AS is_canonical  -- sales are always canonical
FROM market_sales
ON CONFLICT (source, source_listing_id) DO NOTHING;
```

### Step 4: Create Backward-Compatibility Views

```sql
-- market_comps_v2: drop-in replacement for old market_comps queries
CREATE OR REPLACE VIEW market_comps_v2 AS
SELECT
  id,
  ref_number,
  brand                 AS brand_name,
  source,
  model_name            AS title,
  price_usd             AS price,
  'USD'                 AS currency,
  price_local,
  currency_local,
  market_code,
  condition,
  condition_raw,
  has_box,
  has_papers,
  seller_name,
  listing_url,
  seller_score,
  trust_weight,
  first_seen_at         AS scraped_at,
  created_at
FROM watch_market_events
WHERE event_type IN ('asking', 'dealer_asking')
  AND trust_weight > 0;

-- confirmed_sales: drop-in replacement for market_sales queries
CREATE OR REPLACE VIEW confirmed_sales AS
SELECT
  id,
  ref_number,
  brand                 AS brand_name,
  source,
  price_usd,
  currency_local        AS currency,
  condition,
  has_box,
  has_papers,
  seller_name,
  listing_url,
  sold_at               AS sale_date,
  trust_weight,
  created_at
FROM watch_market_events
WHERE event_type IN ('sold', 'auction_hammer', 'auction_estimate');
```

### Step 5: Update Scrapers

Each scraper should be updated to:
1. Write to `watch_market_events` instead of `market_comps`
2. Use `ON CONFLICT (source, source_listing_id) DO UPDATE SET last_seen_at = now(), price_usd = EXCLUDED.price_usd`
3. Call `normalize_condition()` before inserting
4. Compute `trust_weight` using `computeTrustWeight()` from `scripts/dedup-job.mjs`
5. After each scrape batch, trigger `node scripts/dedup-job.mjs`

**Priority scraper updates:**
- `scripts/scrape-global-markets.py` — write to `watch_market_events` (currently writes to `market_comps`)
- `scripts/scrape-rccrown.mjs` — write to `watch_market_events` with `event_type='dealer_asking'` (currently writes to `listings`)

### Step 6: Update API Routes

`src/app/api/analytics/summary/route.ts` currently queries `market_data` (a view). Update to:

```typescript
// Instead of:
db.from("market_data").select(...)

// Use:
db.from("watch_market_events")
  .select("id, ref_number, brand, model_name, price_usd, listing_url, source, first_seen_at, seller_name")
  .in("event_type", ["asking", "dealer_asking"])
  .gt("trust_weight", 0)
  // Only canonical or unprocessed (not duplicates)
  .or("is_canonical.eq.true,and(canonical_id.is.null,is_canonical.is.null)")
  .gt("price_usd", 1000)
```

---

## Section 7: Implementation Checklist

### P0 — Must do BEFORE any more scraping

These prevent data quality from getting worse as we add more sources.

- [ ] **Create `watch_market_events` table** — run `scripts/setup-unified-schema.sql`
- [ ] **Create `dealers` table** — same SQL file
- [ ] **Build `dedup-job.mjs`** — runs after each scrape batch (`scripts/dedup-job.mjs`)
- [ ] **Add `normalize_condition()` calls** to `scrape-global-markets.py` before inserts
- [ ] **Update `scrape-global-markets.py`** to write to `watch_market_events` instead of `market_comps`
- [ ] **Set `trust_weight` at ingest** in all scrapers

### P1 — This Week

- [ ] **Migrate `market_comps` → `watch_market_events`** (Step 2 SQL)
- [ ] **Migrate `market_sales` → `watch_market_events`** (Step 3 SQL)
- [ ] **Create backward-compat views** (`market_comps_v2`, `confirmed_sales`)
- [ ] **Update `scrape-rccrown.mjs`** to write to `watch_market_events` (event_type='dealer_asking')
- [ ] **Dealer entity resolution (basic)** — exact + fuzzy name match in dedup job
- [ ] **Update `qualify-and-outreach.mjs`** to read from `watch_market_events` instead of `market_comps`
- [ ] **Update analytics API route** to query `watch_market_events`
- [ ] **Run dedup job** on all migrated data

### P2 — Next Week

- [ ] **Image hash deduplication** — download primary image, compute perceptual hash (pHash), store in new column `image_phash TEXT`; add Tier 4A dedup check
- [ ] **Weighted price calculation engine** — implement `calculate_true_price()` SQL function
- [ ] **Dealer trust scoring system** — update `reliability_score` from confirmed sales ratio
- [ ] **WatchBox scraper** — write directly to `watch_market_events` with `source='watchbox'`
- [ ] **Bob's Watches scraper** — write to `watch_market_events` with `source='bobs_watches'`
- [ ] **Yahoo Japan scraper** — write to `watch_market_events` with `source='yahoo_japan'`, map S/A/B/C/D grades

### P3 — This Month

- [ ] **WatchCharts API integration** ($99/mo) — highest quality confirmed sales data
- [ ] **Admin dedup review queue** — UI for reviewing Tier 3/4 probable duplicates
- [ ] **Price alert system** — notify when `true_floor_price` for a tracked ref drops
- [ ] **`price_snapshots_v2` migration** — update snapshot job to query `watch_market_events`
- [ ] **Reddit r/WatchExchange scraper** — parse SOLD posts into `event_type='sold'`
- [ ] **Phillips/Christie's scraper** — hammer prices into `event_type='auction_hammer'`

---

## Appendix: Reference Number Normalization Rules

All `ref_number` values stored in `watch_market_events` MUST be normalized:

1. **Strip all spaces** — `126 610 LN` → `126610LN`
2. **Uppercase** — `126610ln` → `126610LN`
3. **Preserve forward slashes** — `5711/1A-011` stays as-is
4. **Preserve hyphens** — `15510ST.OO.1320ST.06` stays as-is
5. **Strip trailing punctuation** — `126610LN.` → `126610LN`
6. **Strip leading/trailing whitespace**

SQL implementation:
```sql
UPPER(TRIM(REGEXP_REPLACE(ref_number, '\s+', '', 'g')))
```

---

## Appendix: FX Rate Freshness

All `price_usd` values must be converted using FX rates no older than 24 hours. The `fx_rates` table stores live rates. The `fx_rate_used` column in `watch_market_events` records which rate was used at conversion time.

When re-scraping and updating `last_seen_at`, also recalculate `price_usd` with fresh FX rates. Store the updated `price_usd` and new `fx_rate_used`. Add an entry to `price_history` only if the USD price changed by more than 0.5% (to avoid noise from FX fluctuations).
