-- Market comparable sales from external sources (eBay, Chrono24, etc.)
CREATE TABLE IF NOT EXISTS market_comps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT NOT NULL,
  brand_name TEXT,
  source TEXT NOT NULL DEFAULT 'ebay', -- 'ebay' | 'chrono24' | 'watchcharts'
  title TEXT,
  price NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  condition TEXT, -- 'new', 'used', 'unworn', etc.
  has_box BOOLEAN,
  has_papers BOOLEAN,
  sale_date DATE,
  listing_url TEXT,
  seller_name TEXT,
  seller_country TEXT,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_market_comps_ref ON market_comps(reference_number);
CREATE INDEX idx_market_comps_source ON market_comps(source);
CREATE INDEX idx_market_comps_scraped_at ON market_comps(scraped_at DESC);

-- View for per-ref statistics
CREATE OR REPLACE VIEW market_comp_stats AS
SELECT
  reference_number,
  source,
  COUNT(*) as total_comps,
  MIN(price) as floor_price,
  ROUND(AVG(price), 2) as avg_price,
  MAX(price) as ceiling_price,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price) as median_price,
  COUNT(CASE WHEN sale_date >= NOW() - INTERVAL '30 days' THEN 1 END) as sold_30d,
  COUNT(CASE WHEN sale_date >= NOW() - INTERVAL '7 days' THEN 1 END) as sold_7d,
  MAX(scraped_at) as last_updated
FROM market_comps
WHERE price > 5000 -- filter out accessories/parts
GROUP BY reference_number, source;

-- RLS: anyone can read market comps (public market data)
ALTER TABLE market_comps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read market comps" ON market_comps FOR SELECT USING (true);
CREATE POLICY "Service role can insert market comps" ON market_comps FOR INSERT WITH CHECK (true);
