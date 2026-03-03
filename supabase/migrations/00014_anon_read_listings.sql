-- Allow anyone (including unauthenticated/dev) to read active listings
-- This is correct behavior for a marketplace (active stock is public to all dealers)
CREATE POLICY "Anyone can view active listings"
  ON listings FOR SELECT
  USING (status = 'active' AND deleted_at IS NULL);

-- Also allow anon to read brands and models (needed for filters)
CREATE POLICY "Anyone can view brands"
  ON brands FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view models"
  ON models FOR SELECT
  USING (true);

-- Allow anon to read profiles for dealer info on listings
CREATE POLICY "Anyone can view dealer profiles"
  ON profiles FOR SELECT
  USING (true);
