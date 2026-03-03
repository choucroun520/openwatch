-- ============================================================
-- OpenWatch Deal Pipeline CRM — Database Setup
-- ============================================================
-- Run in Supabase SQL editor or via CLI:
--   supabase db push scripts/setup-deal-pipeline.sql
-- ============================================================

-- ── updated_at trigger function ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 1. deal_pipeline ──────────────────────────────────────────────────────────
-- Core CRM table: one row per watch deal we're pursuing

CREATE TABLE IF NOT EXISTS deal_pipeline (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Watch identification
  ref_number        TEXT NOT NULL,
  brand             TEXT,
  model             TEXT,

  -- Source (where we found it)
  source            TEXT NOT NULL,  -- chrono24_de, yahoo_japan, watchbox, bobs_watches, etc.
  listing_url       TEXT,

  -- Pricing
  asking_price_usd  NUMERIC(14,2) NOT NULL,
  our_offer_usd     NUMERIC(14,2),

  -- Deal status
  status            TEXT NOT NULL DEFAULT 'spotted'
                    CHECK (status IN (
                      'spotted',
                      'outreach_sent',
                      'negotiating',
                      'offer_accepted',
                      'purchased',
                      'passed',
                      'expired'
                    )),

  -- Seller intelligence
  seller_score      INTEGER DEFAULT 50 CHECK (seller_score >= 0 AND seller_score <= 100),
  motivation_score  INTEGER DEFAULT 50 CHECK (motivation_score >= 0 AND motivation_score <= 100),

  -- Outreach & negotiation
  outreach_message  TEXT,          -- AI-generated opening message
  seller_response   TEXT,          -- What the seller replied
  ai_analysis       TEXT,          -- AI analysis of seller response (JSON string)

  -- Notes
  notes             TEXT,

  -- Metadata
  market_code       TEXT,          -- US, DE, JP, etc.
  currency_local    TEXT,          -- Original currency before USD conversion
  price_local       NUMERIC(14,2), -- Original price in local currency

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_pipeline_status
  ON deal_pipeline(status);

CREATE INDEX IF NOT EXISTS idx_deal_pipeline_ref
  ON deal_pipeline(ref_number);

CREATE INDEX IF NOT EXISTS idx_deal_pipeline_created
  ON deal_pipeline(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deal_pipeline_brand
  ON deal_pipeline(brand);

DROP TRIGGER IF EXISTS trg_deal_pipeline_updated_at ON deal_pipeline;
CREATE TRIGGER trg_deal_pipeline_updated_at
  BEFORE UPDATE ON deal_pipeline
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── 2. seller_contacts ────────────────────────────────────────────────────────
-- Individual contact attempts per deal (email, chrono24 message, whatsapp, etc.)

CREATE TABLE IF NOT EXISTS seller_contacts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id           UUID NOT NULL REFERENCES deal_pipeline(id) ON DELETE CASCADE,

  -- Contact channel
  contact_type      TEXT NOT NULL
                    CHECK (contact_type IN ('email', 'chrono24', 'whatsapp', 'phone', 'other')),

  -- Message content
  message_sent      TEXT,
  response_received TEXT,

  -- Timing
  sent_at           TIMESTAMPTZ,
  responded_at      TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seller_contacts_deal
  ON seller_contacts(deal_id);

CREATE INDEX IF NOT EXISTS idx_seller_contacts_sent_at
  ON seller_contacts(sent_at DESC);

DROP TRIGGER IF EXISTS trg_seller_contacts_updated_at ON seller_contacts;
CREATE TRIGGER trg_seller_contacts_updated_at
  BEFORE UPDATE ON seller_contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── 3. price_history ──────────────────────────────────────────────────────────
-- Daily/periodic price snapshots per reference + source
-- Enables: "show me how Submariner floor price has moved over 90 days"

CREATE TABLE IF NOT EXISTS price_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_number      TEXT NOT NULL,
  source          TEXT NOT NULL,   -- chrono24_de, yahoo_japan, watchbox, bobs_watches, etc.
  market_code     TEXT,            -- US, DE, JP, etc.

  -- Price data for this snapshot
  price_usd       NUMERIC(14,2) NOT NULL,  -- Floor price (lowest listing) in USD
  avg_price_usd   NUMERIC(14,2),           -- Average price
  ceiling_usd     NUMERIC(14,2),           -- Highest price
  listing_count   INTEGER DEFAULT 0,       -- Number of active listings

  snapshot_date   DATE NOT NULL DEFAULT CURRENT_DATE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One row per (ref, source, market, date)
  UNIQUE (ref_number, source, market_code, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_price_history_ref
  ON price_history(ref_number, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_price_history_source
  ON price_history(source, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_price_history_date
  ON price_history(snapshot_date DESC);


-- ── Sample data (optional — comment out for production) ───────────────────────
-- INSERT INTO deal_pipeline (ref_number, brand, source, asking_price_usd, status, notes)
-- VALUES
--   ('126610LN', 'Rolex', 'chrono24_de', 12800, 'spotted', 'German listing, no box'),
--   ('5711/1A-011', 'Patek Philippe', 'yahoo_japan', 88000, 'outreach_sent', 'JP auction, BIN'),
--   ('26240ST.OO.1320ST.02', 'Audemars Piguet', 'chrono24_uk', 55000, 'negotiating', 'UK seller, papers only');

-- ── Done ──────────────────────────────────────────────────────────────────────
-- Tables created:
--   deal_pipeline    — CRM pipeline for watch deals
--   seller_contacts  — Contact history per deal
--   price_history    — Price trend snapshots per ref/source
