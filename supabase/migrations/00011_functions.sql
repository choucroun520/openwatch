-- ─── Database functions ───────────────────────────────────────────────────────

-- 1. validate_invite_code: check if a code is valid and not exhausted
CREATE OR REPLACE FUNCTION validate_invite_code(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code invite_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_code FROM invite_codes WHERE code = p_code LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check not exhausted
  IF v_code.use_count >= v_code.max_uses THEN
    RETURN false;
  END IF;

  -- Check not expired
  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- 2. use_invite_code: atomically consume an invite code
CREATE OR REPLACE FUNCTION use_invite_code(p_code TEXT, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_valid BOOLEAN;
BEGIN
  -- Validate first
  SELECT validate_invite_code(p_code) INTO v_valid;
  IF NOT v_valid THEN
    RETURN false;
  END IF;

  -- Atomically increment use_count
  UPDATE invite_codes
  SET
    use_count = use_count + 1,
    used_by = CASE WHEN use_count = 0 THEN p_user_id ELSE used_by END,
    used_at = CASE WHEN use_count = 0 THEN now() ELSE used_at END
  WHERE code = p_code
    AND use_count < max_uses;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- 3. compute_model_stats: real-time stats for a model
CREATE OR REPLACE FUNCTION compute_model_stats(p_model_id UUID)
RETURNS TABLE(
  floor_price NUMERIC,
  avg_price NUMERIC,
  ceiling_price NUMERIC,
  total_listed INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    MIN(wholesale_price)::NUMERIC AS floor_price,
    AVG(wholesale_price)::NUMERIC AS avg_price,
    MAX(wholesale_price)::NUMERIC AS ceiling_price,
    COUNT(*)::INTEGER AS total_listed
  FROM listings
  WHERE
    model_id = p_model_id
    AND status = 'active'
    AND deleted_at IS NULL;
$$;

-- 4. record_market_event: insert an event and return its id
CREATE OR REPLACE FUNCTION record_market_event(
  p_event_type TEXT,
  p_listing_id UUID DEFAULT NULL,
  p_brand_id UUID DEFAULT NULL,
  p_model_id UUID DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_price NUMERIC DEFAULT NULL,
  p_prev_price NUMERIC DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO market_events (
    event_type, listing_id, brand_id, model_id,
    actor_id, price, previous_price, metadata
  ) VALUES (
    p_event_type, p_listing_id, p_brand_id, p_model_id,
    p_actor_id, p_price, p_prev_price, p_metadata
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 5. get_brand_stats: aggregated stats for a brand's active listings
CREATE OR REPLACE FUNCTION get_brand_stats(p_brand_id UUID)
RETURNS TABLE(
  floor_price NUMERIC,
  avg_price NUMERIC,
  ceiling_price NUMERIC,
  total_listed BIGINT,
  unique_dealers BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    MIN(wholesale_price)::NUMERIC AS floor_price,
    AVG(wholesale_price)::NUMERIC AS avg_price,
    MAX(wholesale_price)::NUMERIC AS ceiling_price,
    COUNT(*)::BIGINT AS total_listed,
    COUNT(DISTINCT dealer_id)::BIGINT AS unique_dealers
  FROM listings
  WHERE
    brand_id = p_brand_id
    AND status = 'active'
    AND deleted_at IS NULL;
$$;
