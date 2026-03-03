-- Add external source tracking to listings
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'openwatch',
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS external_url TEXT;

-- Make reference_number and condition nullable for scraped/imported data
ALTER TABLE listings ALTER COLUMN reference_number DROP NOT NULL;
ALTER TABLE listings ALTER COLUMN condition DROP NOT NULL;

-- Index for fast lookup by source
CREATE INDEX IF NOT EXISTS idx_listings_source ON listings(source);
CREATE INDEX IF NOT EXISTS idx_listings_external_id ON listings(external_id);

-- Unique constraint: one listing per external ID per source
CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_external_unique
  ON listings(source, external_id)
  WHERE external_id IS NOT NULL;
