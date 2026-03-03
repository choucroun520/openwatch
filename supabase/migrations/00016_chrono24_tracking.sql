-- Chrono24 dealer profiles we track
CREATE TABLE IF NOT EXISTS chrono24_dealers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id INTEGER UNIQUE NOT NULL,        -- Chrono24's merchantId (e.g. 5132)
  slug TEXT UNIQUE NOT NULL,                   -- URL slug (e.g. jewelsintimeofboca)
  name TEXT NOT NULL,
  country TEXT,
  total_listings INTEGER DEFAULT 0,
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- All Chrono24 listings we track (current + sold)
CREATE TABLE IF NOT EXISTS chrono24_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chrono24_id TEXT UNIQUE NOT NULL,            -- Chrono24's listing ID (e.g. 41498331)
  dealer_id UUID REFERENCES chrono24_dealers(id),
  merchant_id INTEGER,                          -- Denormalized for fast lookup
  title TEXT NOT NULL,
  reference_number TEXT,
  brand_name TEXT,
  price NUMERIC(14,2),
  currency TEXT DEFAULT 'USD',
  image_url TEXT,
  listing_url TEXT,
  condition TEXT,
  is_sold BOOLEAN DEFAULT FALSE,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  sold_detected_at TIMESTAMPTZ,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_c24_listings_dealer ON chrono24_listings(dealer_id);
CREATE INDEX idx_c24_listings_ref ON chrono24_listings(reference_number);
CREATE INDEX idx_c24_listings_sold ON chrono24_listings(is_sold);
CREATE INDEX idx_c24_listings_merchant ON chrono24_listings(merchant_id);

-- RLS: public read
ALTER TABLE chrono24_dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE chrono24_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read chrono24_dealers" ON chrono24_dealers FOR SELECT USING (true);
CREATE POLICY "Public read chrono24_listings" ON chrono24_listings FOR SELECT USING (true);
CREATE POLICY "Service insert chrono24_dealers" ON chrono24_dealers FOR INSERT WITH CHECK (true);
CREATE POLICY "Service insert chrono24_listings" ON chrono24_listings FOR INSERT WITH CHECK (true);
CREATE POLICY "Service update chrono24_dealers" ON chrono24_dealers FOR UPDATE USING (true);
CREATE POLICY "Service update chrono24_listings" ON chrono24_listings FOR UPDATE USING (true);
