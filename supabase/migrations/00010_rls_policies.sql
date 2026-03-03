-- ─── Row Level Security policies ─────────────────────────────────────────────
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_snapshots ENABLE ROW LEVEL SECURITY;

-- ─── Helper function: get current user role ───────────────────────────────────
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT current_user_role() IN ('admin', 'super_admin');
$$;

-- ─── profiles ─────────────────────────────────────────────────────────────────
-- All authenticated dealers can read all profiles
CREATE POLICY "Dealers can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ─── invite_codes ─────────────────────────────────────────────────────────────
-- Only admins can view invite codes
CREATE POLICY "Admins can view invite codes"
  ON invite_codes FOR SELECT
  TO authenticated
  USING (is_admin());

-- Only admins can insert/update invite codes
CREATE POLICY "Admins can manage invite codes"
  ON invite_codes FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── brands ───────────────────────────────────────────────────────────────────
-- All authenticated users can view brands
CREATE POLICY "All can view brands"
  ON brands FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Only admins can manage brands
CREATE POLICY "Admins can manage brands"
  ON brands FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── models ───────────────────────────────────────────────────────────────────
-- All authenticated users can view models
CREATE POLICY "All can view models"
  ON models FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Only admins can manage models
CREATE POLICY "Admins can manage models"
  ON models FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── listings ─────────────────────────────────────────────────────────────────
-- All authenticated dealers can view active listings (except deleted ones)
CREATE POLICY "Dealers can view active listings"
  ON listings FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- Dealers can insert their own listings
CREATE POLICY "Dealers can create listings"
  ON listings FOR INSERT
  TO authenticated
  WITH CHECK (dealer_id = auth.uid());

-- Dealers can only update/delete their own listings; admins can update any
CREATE POLICY "Dealers can update own listings"
  ON listings FOR UPDATE
  TO authenticated
  USING (dealer_id = auth.uid() OR is_admin())
  WITH CHECK (dealer_id = auth.uid() OR is_admin());

CREATE POLICY "Dealers can delete own listings"
  ON listings FOR DELETE
  TO authenticated
  USING (dealer_id = auth.uid() OR is_admin());

-- ─── deal_inquiries ───────────────────────────────────────────────────────────
-- Dealers can only see inquiries they sent or received
CREATE POLICY "Dealers can view own inquiries"
  ON deal_inquiries FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL AND (
      from_dealer_id = auth.uid() OR
      to_dealer_id = auth.uid() OR
      is_admin()
    )
  );

-- Dealers can send inquiries
CREATE POLICY "Dealers can send inquiries"
  ON deal_inquiries FOR INSERT
  TO authenticated
  WITH CHECK (from_dealer_id = auth.uid());

-- Dealers can update inquiries they're part of
CREATE POLICY "Dealers can update own inquiries"
  ON deal_inquiries FOR UPDATE
  TO authenticated
  USING (
    from_dealer_id = auth.uid() OR
    to_dealer_id = auth.uid() OR
    is_admin()
  );

-- ─── market_events ────────────────────────────────────────────────────────────
-- All authenticated can view market events (analytics feed)
CREATE POLICY "All can view market events"
  ON market_events FOR SELECT
  TO authenticated
  USING (true);

-- Only authenticated users can insert events (via API routes)
CREATE POLICY "Authenticated can insert market events"
  ON market_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ─── price_snapshots ──────────────────────────────────────────────────────────
-- All authenticated can view price history
CREATE POLICY "All can view price snapshots"
  ON price_snapshots FOR SELECT
  TO authenticated
  USING (true);

-- Only service role (cron) can manage snapshots — enforced via admin client
CREATE POLICY "Admins can manage price snapshots"
  ON price_snapshots FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
