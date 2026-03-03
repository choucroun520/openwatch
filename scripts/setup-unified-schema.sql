-- =============================================================================
-- OpenWatch Unified Schema — setup-unified-schema.sql
-- Run this in your Supabase SQL editor (or via psql).
-- IDEMPOTENT: safe to run multiple times (IF NOT EXISTS, CREATE OR REPLACE).
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- fuzzy text search (seller name matching)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- uuid_generate_v4() fallback

-- =============================================================================
-- 1. DEALERS TABLE
-- Must be created before watch_market_events (FK reference).
-- =============================================================================

CREATE TABLE IF NOT EXISTS dealers (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name              TEXT NOT NULL,
  verified                    BOOLEAN NOT NULL DEFAULT FALSE,

  -- JSON map of platform → platform-specific ID
  -- Example: {"chrono24_com": "watchbox-usa", "website": "thewatchbox.com"}
  platform_identifiers        JSONB NOT NULL DEFAULT '{}'::jsonb,

  country                     CHAR(2),       -- ISO 3166-1 alpha-2
  dealer_type                 TEXT CHECK (dealer_type IN ('broker', 'physical', 'auction_house')),

  -- 0-100, updated from confirmed transaction ratio
  reliability_score           SMALLINT NOT NULL DEFAULT 50
                                CHECK (reliability_score BETWEEN 0 AND 100),

  total_listings              INTEGER NOT NULL DEFAULT 0,
  confirmed_physical_listings INTEGER NOT NULL DEFAULT 0,

  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT dealers_canonical_name_unique UNIQUE (canonical_name)
);

CREATE INDEX IF NOT EXISTS idx_dealers_canonical_name
  ON dealers (canonical_name);

CREATE INDEX IF NOT EXISTS idx_dealers_canonical_name_trgm
  ON dealers USING gin (canonical_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_dealers_platform_ids
  ON dealers USING gin (platform_identifiers);

CREATE INDEX IF NOT EXISTS idx_dealers_website
  ON dealers ((platform_identifiers->>'website'))
  WHERE platform_identifiers->>'website' IS NOT NULL;

-- Seed known dealers
INSERT INTO dealers (canonical_name, verified, dealer_type, country, reliability_score, platform_identifiers)
VALUES
  ('WatchBox',          TRUE, 'physical',     'US', 90,
   '{"chrono24_com":"watchbox-usa","chrono24_de":"watchbox-de","website":"thewatchbox.com"}'),
  ('Bob''s Watches',    TRUE, 'physical',     'US', 88,
   '{"website":"bobswatches.com","source_direct":"bobs_watches"}'),
  ('RC Crown',          TRUE, 'physical',     'US', 92,
   '{"website":"rccrown.com","source_direct":"rccrown"}'),
  ('Phillips',          TRUE, 'auction_house','CH', 99,
   '{"website":"phillips.com","source_direct":"phillips"}'),
  ('Christie''s',       TRUE, 'auction_house','UK', 99,
   '{"website":"christies.com","source_direct":"christies"}'),
  ('Sotheby''s',        TRUE, 'auction_house','UK', 99,
   '{"website":"sothebys.com","source_direct":"sothebys"}')
ON CONFLICT (canonical_name) DO NOTHING;


-- =============================================================================
-- 2. WATCH MARKET EVENTS TABLE
-- The single unified table that replaces market_comps + market_sales.
-- =============================================================================

CREATE TABLE IF NOT EXISTS watch_market_events (

  -- ── Identity ──────────────────────────────────────────────────────────────
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Event classification ──────────────────────────────────────────────────
  -- asking         = listed for sale, not yet sold
  -- sold           = confirmed sale (eBay, Reddit SOLD flair)
  -- auction_hammer = hammer price at auction (Phillips, Christie's, Sotheby's)
  -- auction_estimate = pre-sale estimate
  -- dealer_asking  = from a dealer we have direct API access to (RC Crown)
  event_type           TEXT NOT NULL CHECK (event_type IN (
                         'asking', 'sold', 'auction_hammer',
                         'auction_estimate', 'dealer_asking'
                       )),

  -- ── Source tracking ───────────────────────────────────────────────────────
  source               TEXT NOT NULL,
  source_listing_id    TEXT,  -- platform-native listing ID

  -- ── Watch identity ────────────────────────────────────────────────────────
  -- ref_number is always UPPER + stripped of spaces (e.g. "126610LN", "5711/1A-011")
  ref_number           TEXT NOT NULL,
  brand                TEXT,
  model_name           TEXT,
  serial_number        TEXT,

  -- ── Price ─────────────────────────────────────────────────────────────────
  price_usd            NUMERIC(12, 2) NOT NULL,
  price_local          NUMERIC(12, 2),
  currency_local       CHAR(3),
  fx_rate_used         NUMERIC(10, 6),

  -- ── Market ────────────────────────────────────────────────────────────────
  market_code          CHAR(2),

  -- ── Condition ─────────────────────────────────────────────────────────────
  condition            TEXT CHECK (condition IN (
                         'unworn', 'excellent', 'very_good', 'good', 'fair', NULL
                       )),
  condition_raw        TEXT,  -- original string from the platform

  -- ── Physical details ─────────────────────────────────────────────────────
  has_box              BOOLEAN,
  has_papers           BOOLEAN,
  year_made            SMALLINT,

  -- ── Seller ────────────────────────────────────────────────────────────────
  seller_type          TEXT CHECK (seller_type IN (
                         'private', 'dealer', 'broker', 'auction_house', NULL
                       )),
  seller_platform_id   TEXT,
  seller_name          TEXT,
  dealer_id            UUID REFERENCES dealers(id) ON DELETE SET NULL,

  -- ── Physical holder qualification ────────────────────────────────────────
  is_physical          BOOLEAN,
  seller_score         SMALLINT CHECK (seller_score BETWEEN 0 AND 100),

  -- ── Listing content ───────────────────────────────────────────────────────
  listing_url          TEXT,
  images               JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- ── Lifecycle ─────────────────────────────────────────────────────────────
  first_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  sold_at              TIMESTAMPTZ,
  days_on_market       INTEGER GENERATED ALWAYS AS (
                         CASE
                           WHEN sold_at IS NOT NULL
                           THEN EXTRACT(DAY FROM sold_at - first_seen_at)::INTEGER
                           ELSE EXTRACT(DAY FROM now() - first_seen_at)::INTEGER
                         END
                       ) STORED,

  -- ── Price history ─────────────────────────────────────────────────────────
  -- Array of {price_usd, date} objects, appended when price changes
  price_history        JSONB NOT NULL DEFAULT '[]'::jsonb,
  price_drop_count     SMALLINT NOT NULL DEFAULT 0,

  -- ── Trust weight ──────────────────────────────────────────────────────────
  trust_weight         NUMERIC(3, 2) CHECK (trust_weight BETWEEN 0 AND 1),

  -- ── Deduplication ─────────────────────────────────────────────────────────
  -- canonical_id IS NULL AND is_canonical IS TRUE   = this is the master record
  -- canonical_id IS NOT NULL AND is_canonical FALSE = this is a duplicate
  -- canonical_id IS NULL AND is_canonical IS NULL   = not yet processed
  canonical_id         UUID REFERENCES watch_market_events(id) ON DELETE SET NULL,
  is_canonical         BOOLEAN,
  dedup_confidence     NUMERIC(3, 2) CHECK (dedup_confidence BETWEEN 0 AND 1),
  dedup_method         TEXT,

  -- ── Audit ─────────────────────────────────────────────────────────────────
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ── Constraints ───────────────────────────────────────────────────────────
  -- Prevent re-importing the same platform listing (when source_listing_id is available)
  CONSTRAINT uq_source_listing UNIQUE (source, source_listing_id)
    DEFERRABLE INITIALLY DEFERRED
);


-- =============================================================================
-- 3. INDEXES
-- =============================================================================

-- Core ref number lookups
CREATE INDEX IF NOT EXISTS idx_wme_ref_number
  ON watch_market_events (ref_number);

CREATE INDEX IF NOT EXISTS idx_wme_ref_event_type
  ON watch_market_events (ref_number, event_type);

CREATE INDEX IF NOT EXISTS idx_wme_brand
  ON watch_market_events (brand)
  WHERE brand IS NOT NULL;

-- Source tracking
CREATE INDEX IF NOT EXISTS idx_wme_source
  ON watch_market_events (source);

-- Dedup job: find unprocessed rows quickly
CREATE INDEX IF NOT EXISTS idx_wme_dedup_unprocessed
  ON watch_market_events (ref_number, first_seen_at)
  WHERE canonical_id IS NULL AND is_canonical IS NULL;

-- Dedup job: serial number matching
CREATE INDEX IF NOT EXISTS idx_wme_serial
  ON watch_market_events (serial_number, ref_number)
  WHERE serial_number IS NOT NULL;

-- Dedup job: seller platform ID cross-platform matching
CREATE INDEX IF NOT EXISTS idx_wme_seller_platform
  ON watch_market_events (seller_platform_id, ref_number)
  WHERE seller_platform_id IS NOT NULL;

-- Price queries on canonical (non-duplicate) records only
CREATE INDEX IF NOT EXISTS idx_wme_canonical_price
  ON watch_market_events (ref_number, price_usd, trust_weight)
  WHERE is_canonical = TRUE OR (canonical_id IS NULL AND is_canonical IS NULL);

-- Time-series
CREATE INDEX IF NOT EXISTS idx_wme_first_seen
  ON watch_market_events (first_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_wme_last_seen
  ON watch_market_events (last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_wme_sold_at
  ON watch_market_events (sold_at DESC)
  WHERE sold_at IS NOT NULL;

-- Dealer resolution
CREATE INDEX IF NOT EXISTS idx_wme_dealer_id
  ON watch_market_events (dealer_id)
  WHERE dealer_id IS NOT NULL;

-- Fuzzy seller name matching for dedup
CREATE INDEX IF NOT EXISTS idx_wme_seller_name_trgm
  ON watch_market_events USING gin (seller_name gin_trgm_ops)
  WHERE seller_name IS NOT NULL;

-- Canonical chain lookups (find all duplicates of a canonical record)
CREATE INDEX IF NOT EXISTS idx_wme_canonical_id
  ON watch_market_events (canonical_id)
  WHERE canonical_id IS NOT NULL;


-- =============================================================================
-- 4. NORMALIZE_CONDITION FUNCTION
-- Maps any raw condition string from any platform to one of 5 canonical values.
-- Returns NULL if the input is unrecognizable.
-- =============================================================================

CREATE OR REPLACE FUNCTION normalize_condition(raw TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  lower_raw TEXT := LOWER(TRIM(COALESCE(raw, '')));
BEGIN
  -- Handle empty / null
  IF lower_raw = '' THEN
    RETURN NULL;
  END IF;

  -- ── Unworn ────────────────────────────────────────────────────────────────
  IF lower_raw IN (
    'unworn', 'new', 'new with tags', 'new without tags', 'brand new',
    'n', '新品',  -- Yahoo Japan
    'never worn', 'ungetragen', 'neuf'  -- DE/FR variants
  ) THEN
    RETURN 'unworn';
  END IF;

  -- ── Excellent ─────────────────────────────────────────────────────────────
  IF lower_raw IN (
    'excellent', 'excellent+', 'mint', 'like new', 's',
    '未使用',  -- Yahoo Japan "unused"
    'neuwertig', 'sehr gut', 'comme neuf',
    'slider'  -- RC Crown's term for a lightly slider-adjusted watch
  ) THEN
    RETURN 'excellent';
  END IF;

  -- ── Very Good ─────────────────────────────────────────────────────────────
  IF lower_raw IN (
    'very good', 'very_good', 'a', '美品',  -- Yahoo Japan
    'gut', 'très bon état', 'pre-owned'  -- eBay default
  ) THEN
    RETURN 'very_good';
  END IF;

  -- ── Good ──────────────────────────────────────────────────────────────────
  IF lower_raw IN (
    'good', 'good condition', 'b', '良品',  -- Yahoo Japan
    'gebraucht', 'bon état', 'worn', 'used'
  ) THEN
    RETURN 'good';
  END IF;

  -- ── Fair ──────────────────────────────────────────────────────────────────
  IF lower_raw IN (
    'fair', 'poor', 'c', 'd', '可', '不良',  -- Yahoo Japan
    'stark getragen', 'très usé', 'heavily worn',
    'for parts or not working', 'needs service'
  ) THEN
    RETURN 'fair';
  END IF;

  -- ── Fuzzy fallback: partial matches ──────────────────────────────────────
  IF lower_raw LIKE '%unworn%' OR lower_raw LIKE '%never worn%' THEN
    RETURN 'unworn';
  END IF;
  IF lower_raw LIKE '%excellent%' OR lower_raw LIKE '%mint%' THEN
    RETURN 'excellent';
  END IF;
  IF lower_raw LIKE '%very good%' THEN
    RETURN 'very_good';
  END IF;
  IF lower_raw LIKE '%good%' THEN
    RETURN 'good';
  END IF;
  IF lower_raw LIKE '%fair%' OR lower_raw LIKE '%poor%' OR lower_raw LIKE '%heavy%' THEN
    RETURN 'fair';
  END IF;

  -- If we can't recognize it, return NULL (caller decides on a default)
  RETURN NULL;
END;
$$;


-- =============================================================================
-- 5. CALCULATE_TRUE_PRICE FUNCTION
-- Returns trust-weighted price statistics for a given ref number.
-- Operates only on canonical (non-duplicate) records with trust_weight > 0.
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_true_price(
  p_ref_number   TEXT,
  p_days_back    INTEGER DEFAULT 90
)
RETURNS TABLE (
  weighted_avg_price  NUMERIC,
  true_floor_price    NUMERIC,   -- min from Tier 1+2 sources only (trust >= 0.85)
  asking_floor_price  NUMERIC,   -- min from all non-broker sources (trust > 0)
  total_data_points   INTEGER,
  confirmed_sales     INTEGER,
  dealer_asking       INTEGER,
  market_asking       INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  cutoff TIMESTAMPTZ := now() - (p_days_back || ' days')::INTERVAL;
BEGIN
  RETURN QUERY
  SELECT
    -- Trust-weighted average:  SUM(price * weight) / SUM(weight)
    ROUND(
      SUM(price_usd * trust_weight) / NULLIF(SUM(trust_weight), 0),
    2)::NUMERIC                                                      AS weighted_avg_price,

    -- True floor: only from auction hammer + reputable dealers (trust >= 0.85)
    MIN(CASE WHEN trust_weight >= 0.85 THEN price_usd END)::NUMERIC AS true_floor_price,

    -- Asking floor: any non-broker source (trust > 0)
    MIN(CASE WHEN trust_weight > 0 THEN price_usd END)::NUMERIC     AS asking_floor_price,

    COUNT(*)::INTEGER                                                AS total_data_points,

    COUNT(CASE WHEN event_type IN ('sold', 'auction_hammer') THEN 1 END)::INTEGER
                                                                     AS confirmed_sales,

    COUNT(CASE WHEN event_type = 'dealer_asking' THEN 1 END)::INTEGER
                                                                     AS dealer_asking,

    COUNT(CASE WHEN event_type = 'asking' THEN 1 END)::INTEGER      AS market_asking

  FROM watch_market_events
  WHERE ref_number = UPPER(TRIM(REGEXP_REPLACE(p_ref_number, '\s+', '', 'g')))
    AND trust_weight > 0
    AND (
      is_canonical = TRUE
      OR (canonical_id IS NULL AND is_canonical IS NULL)
    )
    AND last_seen_at >= cutoff;
END;
$$;


-- =============================================================================
-- 6. BACKWARD-COMPATIBILITY VIEWS
-- These allow existing code that queries market_comps or market_sales to
-- continue working while we migrate scrapers to write directly to
-- watch_market_events.
-- =============================================================================

-- market_comps_v2: replaces the original market_comps for reading
CREATE OR REPLACE VIEW market_comps_v2 AS
SELECT
  id,
  ref_number,
  brand                   AS brand_name,
  source,
  model_name              AS title,
  price_usd               AS price,
  'USD'::TEXT             AS currency,
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
  first_seen_at           AS scraped_at,
  last_seen_at,
  created_at
FROM watch_market_events
WHERE event_type IN ('asking', 'dealer_asking')
  AND trust_weight > 0;

-- confirmed_sales: replaces the original market_sales for reading
CREATE OR REPLACE VIEW confirmed_sales AS
SELECT
  id,
  ref_number,
  brand                   AS brand_name,
  source,
  price_usd,
  currency_local          AS currency,
  condition,
  condition_raw,
  has_box,
  has_papers,
  seller_name,
  listing_url,
  sold_at                 AS sale_date,
  trust_weight,
  created_at
FROM watch_market_events
WHERE event_type IN ('sold', 'auction_hammer', 'auction_estimate');


-- =============================================================================
-- 7. MIGRATION: market_comps → watch_market_events
-- Only runs if market_comps table exists and has rows.
-- =============================================================================

DO $$
BEGIN
  -- Check if market_comps table exists
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'market_comps'
  ) THEN
    RAISE NOTICE 'Migrating market_comps → watch_market_events...';

    INSERT INTO watch_market_events (
      event_type,
      source,
      source_listing_id,
      ref_number,
      brand,
      price_usd,
      price_local,
      currency_local,
      market_code,
      condition,
      condition_raw,
      has_box,
      has_papers,
      seller_name,
      seller_score,
      is_physical,
      listing_url,
      trust_weight,
      first_seen_at,
      last_seen_at,
      is_canonical
    )
    SELECT
      'asking'                                                     AS event_type,
      COALESCE(mc.source, 'chrono24_us')                          AS source,
      -- Stable pseudo-ID from URL or PK (market_comps has no listing-level ID)
      MD5(COALESCE(mc.listing_url, mc.id::TEXT))                  AS source_listing_id,
      UPPER(TRIM(REGEXP_REPLACE(mc.ref_number, '\s+', '', 'g')))  AS ref_number,
      mc.brand_name                                               AS brand,
      mc.price::NUMERIC                                           AS price_usd,
      mc.price_local::NUMERIC                                     AS price_local,
      mc.currency_local                                           AS currency_local,
      mc.market_code                                              AS market_code,
      normalize_condition(mc.condition)                           AS condition,
      mc.condition                                                AS condition_raw,
      mc.has_box                                                  AS has_box,
      mc.has_papers                                               AS has_papers,
      mc.seller_name                                              AS seller_name,
      mc.seller_score::SMALLINT                                   AS seller_score,
      CASE WHEN mc.seller_score > 60 THEN TRUE ELSE FALSE END     AS is_physical,
      mc.listing_url                                              AS listing_url,
      CASE
        WHEN mc.seller_score < 40          THEN 0.0
        WHEN mc.seller_score > 70          THEN 0.7
        WHEN mc.seller_score BETWEEN 40 AND 70 THEN 0.5
        ELSE 0.5
      END                                                         AS trust_weight,
      COALESCE(mc.scraped_at::TIMESTAMPTZ, mc.created_at)         AS first_seen_at,
      COALESCE(mc.scraped_at::TIMESTAMPTZ, mc.created_at)         AS last_seen_at,
      NULL                                                        AS is_canonical
    FROM market_comps mc
    -- Only migrate rows that don't already exist (idempotent)
    WHERE NOT EXISTS (
      SELECT 1 FROM watch_market_events wme
      WHERE wme.source = COALESCE(mc.source, 'chrono24_us')
        AND wme.source_listing_id = MD5(COALESCE(mc.listing_url, mc.id::TEXT))
    );

    RAISE NOTICE 'market_comps migration complete.';
  ELSE
    RAISE NOTICE 'market_comps table not found — skipping migration.';
  END IF;
END;
$$;


-- =============================================================================
-- 8. MIGRATION: market_sales → watch_market_events
-- Only runs if market_sales table exists.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'market_sales'
  ) THEN
    RAISE NOTICE 'Migrating market_sales → watch_market_events...';

    INSERT INTO watch_market_events (
      event_type,
      source,
      source_listing_id,
      ref_number,
      brand,
      price_usd,
      currency_local,
      condition,
      condition_raw,
      has_box,
      has_papers,
      seller_name,
      listing_url,
      trust_weight,
      sold_at,
      first_seen_at,
      last_seen_at,
      is_canonical
    )
    SELECT
      CASE
        WHEN ms.source IN ('phillips', 'christies', 'sothebys') THEN 'auction_hammer'
        WHEN ms.source IN ('ebay_sold', 'reddit_watchexchange')  THEN 'sold'
        ELSE 'sold'
      END::TEXT                                                   AS event_type,
      ms.source                                                   AS source,
      MD5(COALESCE(ms.listing_url, ms.id::TEXT))                  AS source_listing_id,
      UPPER(TRIM(REGEXP_REPLACE(ms.ref_number, '\s+', '', 'g')))  AS ref_number,
      ms.brand_name                                               AS brand,
      ms.price_usd::NUMERIC                                       AS price_usd,
      ms.currency                                                 AS currency_local,
      normalize_condition(ms.condition)                           AS condition,
      ms.condition                                                AS condition_raw,
      ms.has_box                                                  AS has_box,
      ms.has_papers                                               AS has_papers,
      ms.seller_name                                              AS seller_name,
      ms.listing_url                                              AS listing_url,
      CASE ms.source
        WHEN 'phillips'             THEN 1.0
        WHEN 'christies'            THEN 1.0
        WHEN 'sothebys'             THEN 1.0
        WHEN 'ebay_sold'            THEN 0.9
        WHEN 'watchcharts'          THEN 0.85
        WHEN 'reddit_watchexchange' THEN 0.8
        ELSE 0.85
      END                                                         AS trust_weight,
      COALESCE(ms.sale_date::TIMESTAMPTZ, ms.sold_at)             AS sold_at,
      COALESCE(ms.sale_date::TIMESTAMPTZ, ms.created_at)          AS first_seen_at,
      COALESCE(ms.sale_date::TIMESTAMPTZ, ms.created_at)          AS last_seen_at,
      -- Confirmed sales are always canonical (a sale is a unique event)
      TRUE                                                        AS is_canonical
    FROM market_sales ms
    WHERE NOT EXISTS (
      SELECT 1 FROM watch_market_events wme
      WHERE wme.source = ms.source
        AND wme.source_listing_id = MD5(COALESCE(ms.listing_url, ms.id::TEXT))
    );

    RAISE NOTICE 'market_sales migration complete.';
  ELSE
    RAISE NOTICE 'market_sales table not found — skipping migration.';
  END IF;
END;
$$;


-- =============================================================================
-- 9. UPDATE TRIGGER: auto-set updated_at on watch_market_events + dealers
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wme_updated_at ON watch_market_events;
CREATE TRIGGER trg_wme_updated_at
  BEFORE UPDATE ON watch_market_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_dealers_updated_at ON dealers;
CREATE TRIGGER trg_dealers_updated_at
  BEFORE UPDATE ON dealers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =============================================================================
-- 10. ROW-LEVEL SECURITY
-- Lock down watch_market_events: anyone can read, only service role can write.
-- =============================================================================

ALTER TABLE watch_market_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealers              ENABLE ROW LEVEL SECURITY;

-- Public read access (authenticated users can see market data)
DROP POLICY IF EXISTS "wme_public_read" ON watch_market_events;
CREATE POLICY "wme_public_read"
  ON watch_market_events
  FOR SELECT
  TO authenticated
  USING (TRUE);

-- Service role gets full access (scrapers run as service role)
DROP POLICY IF EXISTS "wme_service_write" ON watch_market_events;
CREATE POLICY "wme_service_write"
  ON watch_market_events
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- Dealers: public read, service role write
DROP POLICY IF EXISTS "dealers_public_read" ON dealers;
CREATE POLICY "dealers_public_read"
  ON dealers
  FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "dealers_service_write" ON dealers;
CREATE POLICY "dealers_service_write"
  ON dealers
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);


-- =============================================================================
-- VERIFICATION
-- Run these queries to confirm everything was created:
-- =============================================================================

-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--   AND table_name IN ('watch_market_events', 'dealers');

-- SELECT COUNT(*) FROM watch_market_events;

-- SELECT normalize_condition('Very good');          -- → very_good
-- SELECT normalize_condition('S');                  -- → unworn (Yahoo Japan N/S)
-- SELECT normalize_condition('Excellent+');         -- → excellent
-- SELECT normalize_condition('for parts or not working');  -- → fair

-- SELECT * FROM calculate_true_price('126610LN');
-- SELECT * FROM calculate_true_price('126610LN', 30);  -- last 30 days only
