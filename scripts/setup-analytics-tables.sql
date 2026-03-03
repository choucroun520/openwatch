-- ============================================================
-- setup-analytics-tables.sql
-- Run once in Supabase SQL editor to create analytics tables.
-- Safe to re-run: all statements use IF NOT EXISTS / DO NOTHING.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. fx_rates
--    Stores snapshots of live FX rates from frankfurter.app.
--    Only a new row is inserted if the last is > 1 hour old.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fx_rates (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency TEXT         NOT NULL DEFAULT 'USD',
  rates         JSONB        NOT NULL,
  fetched_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fx_rates_fetched_at
  ON fx_rates (fetched_at DESC);

COMMENT ON TABLE fx_rates IS
  'Live FX rate snapshots from frankfurter.app. Polled at most once per hour.';
COMMENT ON COLUMN fx_rates.rates IS
  'JSON object: { "EUR": 0.92, "CHF": 0.89, "GBP": 0.78, "JPY": 149.5, "AED": 3.67, "SGD": 1.34, "HKD": 7.82 }';


-- ────────────────────────────────────────────────────────────
-- 2. arbitrage_signals
--    Caches computed cross-market arbitrage opportunities for
--    historical tracking and alerting.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS arbitrage_signals (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_number       TEXT         NOT NULL,
  brand            TEXT         NOT NULL,
  model_name       TEXT,
  buy_market       TEXT         NOT NULL,   -- e.g. 'EU', 'CH', 'UK'
  buy_currency     TEXT         NOT NULL,
  buy_price_local  NUMERIC(14,2) NOT NULL,
  buy_price_usd    NUMERIC(14,2) NOT NULL,
  sell_market      TEXT         NOT NULL,   -- typically 'US'
  sell_price_usd   NUMERIC(14,2) NOT NULL,
  gross_spread_pct NUMERIC(6,2) NOT NULL,
  import_costs_usd NUMERIC(14,2) NOT NULL,
  net_profit_usd   NUMERIC(14,2) NOT NULL,
  net_profit_pct   NUMERIC(6,2) NOT NULL,
  buy_listing_count  INTEGER     NOT NULL DEFAULT 0,
  sell_listing_count INTEGER     NOT NULL DEFAULT 0,
  computed_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arbitrage_ref_number
  ON arbitrage_signals (ref_number, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_arbitrage_computed_at
  ON arbitrage_signals (computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_arbitrage_net_profit
  ON arbitrage_signals (net_profit_pct DESC) WHERE net_profit_pct > 0;

COMMENT ON TABLE arbitrage_signals IS
  'Point-in-time arbitrage calculations for cross-market watch price discrepancies.';


-- ────────────────────────────────────────────────────────────
-- 3. ref_trends
--    Cached trend scores per reference number.
--    Updated by cron (daily or hourly).
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ref_trends (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_number      TEXT         NOT NULL,
  brand           TEXT         NOT NULL,
  model_name      TEXT,
  current_price   NUMERIC(14,2),
  price_7d_ago    NUMERIC(14,2),
  price_30d_ago   NUMERIC(14,2),
  price_90d_ago   NUMERIC(14,2),
  momentum_7d     NUMERIC(6,2),
  momentum_30d    NUMERIC(6,2),
  momentum_90d    NUMERIC(6,2),
  trend_label     TEXT CHECK (trend_label IN ('surging','rising','stable','cooling','dropping')),
  listing_count   INTEGER,
  velocity_30d    INTEGER,     -- listing count delta over 30 days (supply signal)
  computed_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (ref_number, computed_at)
);

CREATE INDEX IF NOT EXISTS idx_ref_trends_ref_number
  ON ref_trends (ref_number, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_ref_trends_momentum_30d
  ON ref_trends (momentum_30d DESC);

CREATE INDEX IF NOT EXISTS idx_ref_trends_computed_at
  ON ref_trends (computed_at DESC);

COMMENT ON TABLE ref_trends IS
  'Cached momentum and trend scores per reference number, updated by cron.';
COMMENT ON COLUMN ref_trends.velocity_30d IS
  'Change in listing_count over 30 days: positive = supply growing, negative = supply shrinking.';
COMMENT ON COLUMN ref_trends.trend_label IS
  'surging = mom_30d > 5%, rising = > 2%, stable = ±2%, cooling = < -2%, dropping = < -5%';
