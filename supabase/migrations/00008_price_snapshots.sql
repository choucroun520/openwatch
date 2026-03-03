-- ─── Price snapshots (hourly/daily aggregates per model) ─────────────────────
CREATE TABLE IF NOT EXISTS price_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES models(id),
  brand_id UUID NOT NULL REFERENCES brands(id),
  snapshot_date DATE NOT NULL,
  floor_price NUMERIC(14,2),
  avg_price NUMERIC(14,2),
  ceiling_price NUMERIC(14,2),
  total_listed INTEGER NOT NULL DEFAULT 0,
  total_sold INTEGER NOT NULL DEFAULT 0,
  volume NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(model_id, snapshot_date)
);
