-- ─── Market events (analytics engine feed) ───────────────────────────────────
-- Every listing action creates a record here.
-- Event types: listing_created, listing_updated, listing_sold, listing_delisted,
--              price_changed, inquiry_sent, inquiry_responded
CREATE TABLE IF NOT EXISTS market_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  listing_id UUID REFERENCES listings(id),
  brand_id UUID REFERENCES brands(id),
  model_id UUID REFERENCES models(id),
  actor_id UUID REFERENCES profiles(id),
  price NUMERIC(14,2),
  previous_price NUMERIC(14,2),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
