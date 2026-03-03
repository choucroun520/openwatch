-- ─── Performance indexes ──────────────────────────────────────────────────────

-- Listings indexes
CREATE INDEX IF NOT EXISTS idx_listings_brand
  ON listings(brand_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_listings_model
  ON listings(model_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_listings_dealer
  ON listings(dealer_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_listings_status
  ON listings(status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_listings_wholesale_price
  ON listings(wholesale_price)
  WHERE deleted_at IS NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_listings_listed_at
  ON listings(listed_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_listings_featured
  ON listings(featured)
  WHERE deleted_at IS NULL AND status = 'active';

-- Market events indexes
CREATE INDEX IF NOT EXISTS idx_market_events_type
  ON market_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_events_brand
  ON market_events(brand_id, created_at DESC)
  WHERE brand_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_market_events_model
  ON market_events(model_id, created_at DESC)
  WHERE model_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_market_events_listing
  ON market_events(listing_id, created_at DESC)
  WHERE listing_id IS NOT NULL;

-- Price snapshots indexes
CREATE INDEX IF NOT EXISTS idx_price_snapshots_model
  ON price_snapshots(model_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_price_snapshots_brand
  ON price_snapshots(brand_id, snapshot_date DESC);

-- Deal inquiries indexes
CREATE INDEX IF NOT EXISTS idx_deal_inquiries_listing
  ON deal_inquiries(listing_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_deal_inquiries_from_dealer
  ON deal_inquiries(from_dealer_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_deal_inquiries_to_dealer
  ON deal_inquiries(to_dealer_id)
  WHERE deleted_at IS NULL;

-- Invite codes
CREATE INDEX IF NOT EXISTS idx_invite_codes_code
  ON invite_codes(code);

-- Brands and models
CREATE INDEX IF NOT EXISTS idx_brands_slug
  ON brands(slug)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_models_brand
  ON models(brand_id)
  WHERE deleted_at IS NULL;
