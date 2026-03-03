-- ─── Listings table ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES profiles(id),
  brand_id UUID NOT NULL REFERENCES brands(id),
  model_id UUID NOT NULL REFERENCES models(id),

  -- Watch details (traits)
  reference_number TEXT NOT NULL,
  serial_number TEXT,
  year INTEGER NOT NULL,
  material TEXT NOT NULL,
  dial_color TEXT NOT NULL,
  case_size TEXT,
  movement TEXT,
  complications TEXT[] DEFAULT '{}',
  condition TEXT NOT NULL,
  condition_score NUMERIC(3,1),

  -- Completeness
  has_box BOOLEAN NOT NULL DEFAULT false,
  has_papers BOOLEAN NOT NULL DEFAULT false,
  has_warranty BOOLEAN NOT NULL DEFAULT false,
  warranty_date DATE,
  service_history TEXT,

  -- Pricing (dealer-only wholesale, retail for Phase 2)
  wholesale_price NUMERIC(14,2) NOT NULL,
  retail_price NUMERIC(14,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  accepts_inquiries BOOLEAN NOT NULL DEFAULT true,

  -- Status
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pending', 'sold', 'delisted')),
  featured BOOLEAN NOT NULL DEFAULT false,
  views INTEGER NOT NULL DEFAULT 0,

  -- Images (array of Supabase Storage URLs; first = primary)
  images TEXT[] DEFAULT '{}',

  -- Notes (internal dealer notes)
  notes TEXT,

  -- Timestamps
  listed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sold_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TRIGGER listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
