-- ─── Deal inquiries (dealer-to-dealer communication) ─────────────────────────
CREATE TABLE IF NOT EXISTS deal_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id),
  from_dealer_id UUID NOT NULL REFERENCES profiles(id),
  to_dealer_id UUID NOT NULL REFERENCES profiles(id),
  message TEXT NOT NULL,
  offer_price NUMERIC(14,2),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'responded', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- Prevent duplicate open inquiries from same dealer on same listing
  CONSTRAINT unique_open_inquiry UNIQUE NULLS NOT DISTINCT (listing_id, from_dealer_id, deleted_at)
);

CREATE TRIGGER deal_inquiries_updated_at
  BEFORE UPDATE ON deal_inquiries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
