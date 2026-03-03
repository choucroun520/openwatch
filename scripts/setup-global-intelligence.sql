-- ============================================================
-- OpenWatch Global Intelligence Tables
-- Run in Supabase SQL Editor
-- ============================================================

-- ── Upgrade market_comps with global market columns ──────────────────────────
-- (safe to run if columns already exist — uses IF NOT EXISTS)

ALTER TABLE market_comps ADD COLUMN IF NOT EXISTS price_local numeric;
ALTER TABLE market_comps ADD COLUMN IF NOT EXISTS currency_local text;
ALTER TABLE market_comps ADD COLUMN IF NOT EXISTS market_code text;    -- US,DE,FR,UK,JP,HK,SG,CH,AE
ALTER TABLE market_comps ADD COLUMN IF NOT EXISTS seller_score integer; -- 0-100 physical holder score
ALTER TABLE market_comps ADD COLUMN IF NOT EXISTS days_listed integer;  -- days since first seen
ALTER TABLE market_comps ADD COLUMN IF NOT EXISTS price_drop_count integer default 0;
ALTER TABLE market_comps ADD COLUMN IF NOT EXISTS listing_url text;
ALTER TABLE market_comps ADD COLUMN IF NOT EXISTS raw_title text;
ALTER TABLE market_comps ADD COLUMN IF NOT EXISTS external_id text;     -- source-specific listing ID

-- Index for market analysis
CREATE INDEX IF NOT EXISTS market_comps_market_code_idx ON market_comps(market_code);
CREATE INDEX IF NOT EXISTS market_comps_seller_score_idx ON market_comps(seller_score);
CREATE INDEX IF NOT EXISTS market_comps_ref_source_idx ON market_comps(ref_number, source);

-- ── FX Rates Table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fx_rates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  base_currency text NOT NULL DEFAULT 'USD',
  rates jsonb NOT NULL,             -- {"EUR": 0.92, "CHF": 0.89, ...}
  fetched_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fx_rates_fetched_at_idx ON fx_rates(fetched_at DESC);

-- ── Deal Pipeline CRM ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deal_pipeline (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ref_number text NOT NULL,
  brand text,
  model_name text,
  source text NOT NULL,             -- chrono24_de, yahoo_japan, watchbox, etc.
  market_code text,                 -- DE, JP, UK, US, etc.
  listing_url text,
  asking_price_usd numeric NOT NULL,
  asking_price_local numeric,
  asking_currency text,
  our_offer_usd numeric,
  status text NOT NULL DEFAULT 'spotted'
    CHECK (status IN ('spotted','outreach_sent','negotiating','offer_accepted','purchased','passed','expired')),
  seller_score integer CHECK (seller_score BETWEEN 0 AND 100),
  motivation_score integer CHECK (motivation_score BETWEEN 0 AND 100),
  outreach_message text,            -- AI-generated first message
  seller_response text,             -- Their reply
  ai_analysis text,                 -- AI analysis of their response
  ai_recommendation text,           -- PUSH_HARDER / ACCEPT / WALK_AWAY
  next_message text,                -- AI-generated next counter-offer message
  notes text,
  image_url text,
  days_listed_when_found integer,
  price_drop_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deal_pipeline_status_idx ON deal_pipeline(status);
CREATE INDEX IF NOT EXISTS deal_pipeline_ref_idx ON deal_pipeline(ref_number);
CREATE INDEX IF NOT EXISTS deal_pipeline_created_at_idx ON deal_pipeline(created_at DESC);

-- ── Seller Contacts Log ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seller_contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id uuid REFERENCES deal_pipeline(id) ON DELETE CASCADE,
  contact_type text CHECK (contact_type IN ('chrono24','email','whatsapp','instagram','phone')),
  message_sent text,
  response_received text,
  sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seller_contacts_deal_id_idx ON seller_contacts(deal_id);

-- ── Price History Tracker ─────────────────────────────────────────────────────
-- Tracks price movements per ref over time (different from price_snapshots_v2 which is aggregate)
CREATE TABLE IF NOT EXISTS price_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ref_number text NOT NULL,
  brand text,
  source text NOT NULL,
  market_code text,
  price_usd numeric NOT NULL,
  price_local numeric,
  currency_local text,
  listing_count integer,
  floor_price_usd numeric,
  avg_price_usd numeric,
  ceiling_price_usd numeric,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS price_history_dedup_idx
  ON price_history(ref_number, source, market_code, snapshot_date);

CREATE INDEX IF NOT EXISTS price_history_ref_date_idx ON price_history(ref_number, snapshot_date DESC);

-- ── Updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS deal_pipeline_updated_at ON deal_pipeline;
CREATE TRIGGER deal_pipeline_updated_at
  BEFORE UPDATE ON deal_pipeline
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Arbitrage View ────────────────────────────────────────────────────────────
-- Computes real-time arbitrage from market_comps
CREATE OR REPLACE VIEW arbitrage_opportunities AS
WITH latest_prices AS (
  SELECT DISTINCT ON (ref_number, market_code)
    ref_number, brand, market_code, source,
    price as price_usd,
    price_local, currency_local,
    scraped_at
  FROM market_comps
  WHERE price > 1000
    AND scraped_at > now() - interval '7 days'
  ORDER BY ref_number, market_code, scraped_at DESC
),
us_prices AS (
  SELECT ref_number, price_usd as us_price
  FROM latest_prices
  WHERE market_code = 'US'
),
foreign_prices AS (
  SELECT
    lp.ref_number,
    lp.brand,
    lp.market_code as buy_market,
    lp.currency_local as buy_currency,
    lp.price_local as buy_price_local,
    lp.price_usd as buy_price_usd,
    up.us_price as sell_price_usd,
    (up.us_price - lp.price_usd) as gross_spread_usd,
    ROUND(((up.us_price - lp.price_usd) / lp.price_usd * 100)::numeric, 1) as gross_spread_pct,
    -- Import costs: $350 shipping + 9.8% duty + $200 auth
    (350 + (lp.price_usd * 0.098) + 200) as import_costs_usd,
    -- Net profit
    (up.us_price - lp.price_usd - 350 - (lp.price_usd * 0.098) - 200) as net_profit_usd,
    ROUND(((up.us_price - lp.price_usd - 350 - (lp.price_usd * 0.098) - 200) / lp.price_usd * 100)::numeric, 1) as net_profit_pct
  FROM latest_prices lp
  JOIN us_prices up ON lp.ref_number = up.ref_number
  WHERE lp.market_code != 'US'
)
SELECT *
FROM foreign_prices
WHERE net_profit_usd > 0
ORDER BY net_profit_pct DESC;

-- ── Market Price Spread View ──────────────────────────────────────────────────
CREATE OR REPLACE VIEW market_price_spread AS
SELECT
  ref_number,
  brand,
  COUNT(DISTINCT market_code) as market_count,
  MIN(price) as global_floor_usd,
  MAX(price) as global_ceiling_usd,
  ROUND(AVG(price)::numeric, 0) as global_avg_usd,
  MAX(price) - MIN(price) as spread_usd,
  ROUND(((MAX(price) - MIN(price)) / MIN(price) * 100)::numeric, 1) as spread_pct,
  COUNT(*) as total_listings,
  MAX(scraped_at) as last_updated
FROM market_comps
WHERE price > 1000
  AND scraped_at > now() - interval '7 days'
GROUP BY ref_number, brand
HAVING COUNT(DISTINCT market_code) >= 2
ORDER BY spread_pct DESC;

COMMENT ON TABLE deal_pipeline IS 'AI-assisted deal tracking — from spotted listing to closed deal';
COMMENT ON TABLE seller_contacts IS 'History of all outreach attempts and seller responses';
COMMENT ON TABLE price_history IS 'Daily price snapshots per ref per market for trend analysis';
COMMENT ON VIEW arbitrage_opportunities IS 'Real-time buy-low/sell-high opportunities across global markets';
