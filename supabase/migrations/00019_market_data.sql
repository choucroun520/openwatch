-- Unified market intelligence table — every listing from every source
CREATE TABLE IF NOT EXISTS market_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Watch identity
  ref_number TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT,

  -- Price
  price NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_sold BOOLEAN NOT NULL DEFAULT FALSE, -- false=asking, true=confirmed sold

  -- Condition
  condition TEXT,           -- 'unworn' | 'excellent' | 'very_good' | 'good' | 'fair'
  has_box BOOLEAN,
  has_papers BOOLEAN,
  year INTEGER,             -- production year of this specific watch

  -- Source
  source TEXT NOT NULL,     -- 'chrono24' | 'ebay' | 'watchbox' | 'bobswatches' | 'phillips' | 'sothebys'
  source_id TEXT,           -- original listing ID on source platform
  dealer_name TEXT,
  dealer_country TEXT,
  listing_url TEXT,

  -- Dates
  listed_at TIMESTAMPTZ,
  sold_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_md_ref ON market_data(ref_number);
CREATE INDEX IF NOT EXISTS idx_md_brand ON market_data(brand);
CREATE INDEX IF NOT EXISTS idx_md_source ON market_data(source);
CREATE INDEX IF NOT EXISTS idx_md_is_sold ON market_data(is_sold);
CREATE INDEX IF NOT EXISTS idx_md_price ON market_data(price);
CREATE INDEX IF NOT EXISTS idx_md_scraped ON market_data(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_md_listed ON market_data(listed_at DESC);
CREATE INDEX IF NOT EXISTS idx_md_source_id ON market_data(source, source_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_md_source_unique ON market_data(source, source_id) WHERE source_id IS NOT NULL;

-- RLS: public read
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read market_data" ON market_data FOR SELECT USING (true);
CREATE POLICY "Service write market_data" ON market_data FOR ALL USING (true);

-- ─── Analytics Views ─────────────────────────────────────────────────────────

-- Per-ref current market stats (asking prices only, last 30 days)
CREATE OR REPLACE VIEW ref_market_stats AS
SELECT
  ref_number,
  brand,
  model,
  COUNT(*) AS total_listings,
  MIN(price) AS floor_price,
  ROUND(AVG(price), 2) AS avg_price,
  MAX(price) AS ceiling_price,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) AS median_price,
  MAX(scraped_at) AS last_updated
FROM market_data
WHERE
  is_sold = FALSE
  AND price > 1000
  AND scraped_at >= NOW() - INTERVAL '30 days'
GROUP BY ref_number, brand, model;

-- Per-ref sold stats (actual transaction prices, last 90 days)
CREATE OR REPLACE VIEW ref_sold_stats AS
SELECT
  ref_number,
  brand,
  model,
  COUNT(*) AS total_sold,
  MIN(price) AS sold_floor,
  ROUND(AVG(price), 2) AS sold_avg,
  MAX(price) AS sold_ceiling,
  MAX(sold_at) AS last_sold_at
FROM market_data
WHERE
  is_sold = TRUE
  AND price > 1000
  AND scraped_at >= NOW() - INTERVAL '90 days'
GROUP BY ref_number, brand, model;

-- Price trend: 30-day change per ref
CREATE OR REPLACE VIEW ref_price_trend AS
WITH
  recent AS (
    SELECT ref_number, brand, ROUND(AVG(price),2) AS avg_price
    FROM market_data
    WHERE is_sold = FALSE AND price > 1000
      AND scraped_at >= NOW() - INTERVAL '7 days'
    GROUP BY ref_number, brand
  ),
  older AS (
    SELECT ref_number, brand, ROUND(AVG(price),2) AS avg_price
    FROM market_data
    WHERE is_sold = FALSE AND price > 1000
      AND scraped_at >= NOW() - INTERVAL '37 days'
      AND scraped_at < NOW() - INTERVAL '7 days'
    GROUP BY ref_number, brand
  )
SELECT
  r.ref_number,
  r.brand,
  r.avg_price AS current_avg,
  o.avg_price AS prior_avg,
  ROUND(((r.avg_price - o.avg_price) / NULLIF(o.avg_price, 0)) * 100, 2) AS change_pct_30d
FROM recent r
LEFT JOIN older o USING (ref_number, brand)
WHERE o.avg_price IS NOT NULL;

-- Heat index: combines listing volume + price trend + recency
CREATE OR REPLACE VIEW ref_heat_index AS
SELECT
  ms.ref_number,
  ms.brand,
  ms.model,
  ms.avg_price,
  ms.floor_price,
  ms.total_listings,
  COALESCE(ss.total_sold, 0) AS total_sold_90d,
  COALESCE(pt.change_pct_30d, 0) AS price_change_30d,
  -- Heat = weighted score (more listings + more sold + positive trend = hotter)
  ROUND(
    (LEAST(ms.total_listings, 100) * 0.3) +
    (LEAST(COALESCE(ss.total_sold, 0), 50) * 0.4) +
    (GREATEST(COALESCE(pt.change_pct_30d, 0), 0) * 0.3),
  2) AS heat_score
FROM ref_market_stats ms
LEFT JOIN ref_sold_stats ss USING (ref_number, brand)
LEFT JOIN ref_price_trend pt USING (ref_number, brand)
ORDER BY heat_score DESC;

-- ─── Price Snapshots (historical chart data) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS price_snapshots_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_number TEXT NOT NULL,
  brand TEXT NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  floor_price NUMERIC(14,2),
  avg_price NUMERIC(14,2),
  ceiling_price NUMERIC(14,2),
  listing_count INTEGER,
  sold_count INTEGER,
  source TEXT DEFAULT 'all',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ref_number, snapshot_date, source)
);
CREATE INDEX IF NOT EXISTS idx_snapshots_v2_ref ON price_snapshots_v2(ref_number, snapshot_date DESC);

-- RLS: public read
ALTER TABLE price_snapshots_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read price_snapshots_v2" ON price_snapshots_v2 FOR SELECT USING (true);
CREATE POLICY "Service write price_snapshots_v2" ON price_snapshots_v2 FOR ALL USING (true);
