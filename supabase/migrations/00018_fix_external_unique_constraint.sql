-- Replace partial unique index with full unique index
-- Supabase upsert with onConflict requires a non-partial constraint.
-- NULL values don't conflict in PostgreSQL unique indexes (NULL != NULL),
-- so multiple rows with external_id IS NULL are allowed.
DROP INDEX IF EXISTS idx_listings_external_unique;

CREATE UNIQUE INDEX idx_listings_external_unique
  ON listings(source, external_id)
  WHERE external_id IS NOT NULL;

-- Also add a proper unique constraint that Supabase client can use
-- We use a generated column approach: coalesce external_id to the row uuid for null cases
-- Simplest fix: just use regular INSERT for new records, UPDATE for existing
-- Actually, add a proper non-partial constraint on (source, external_id) for non-null external_ids
-- This is done via a unique index on a filtered subset, which Postgres supports for ON CONFLICT
-- BUT Supabase PostgREST needs the index to be listed as a constraint.

-- The actual fix: create a UNIQUE constraint (not partial index) so PostgREST can use it
-- Since NULL != NULL in Postgres, this is safe with nullable external_id
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_source_external_id_unique;
ALTER TABLE listings ADD CONSTRAINT listings_source_external_id_unique
  UNIQUE (source, external_id);
