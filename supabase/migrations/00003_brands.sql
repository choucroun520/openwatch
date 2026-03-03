-- ─── Brands table + seed data ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  banner_url TEXT,
  banner_gradient TEXT,
  icon TEXT,
  founded INTEGER,
  headquarters TEXT,
  website TEXT,
  annual_production INTEGER,
  market_share NUMERIC(5,2),
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TRIGGER brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed 10 real luxury watch brands
INSERT INTO brands (slug, name, description, icon, banner_gradient, founded, headquarters, website, annual_production, market_share, verified) VALUES
(
  'rolex',
  'Rolex',
  'Crown jewel of Swiss horology. Founded 1905 in London, now headquartered in Geneva. The world''s most recognized luxury watch brand with ~29% market share.',
  '👑',
  'linear-gradient(135deg, #0a3d1a 0%, #1a5c2e 40%, #0d4720 100%)',
  1905,
  'Geneva, Switzerland',
  'rolex.com',
  1240000,
  29.2,
  true
),
(
  'patek-philippe',
  'Patek Philippe',
  'You never actually own a Patek Philippe. You merely look after it for the next generation. The pinnacle of haute horlogerie since 1839.',
  '⚜️',
  'linear-gradient(135deg, #1a1040 0%, #2d1b69 40%, #1a1040 100%)',
  1839,
  'Geneva, Switzerland',
  'patek.com',
  72000,
  5.1,
  true
),
(
  'audemars-piguet',
  'Audemars Piguet',
  'To break the rules, you must first master them. Masters of the Royal Oak since 1875. Le Brassus, Vallée de Joux.',
  '🛡️',
  'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)',
  1875,
  'Le Brassus, Switzerland',
  'audemarspiguet.com',
  50000,
  7.0,
  true
),
(
  'omega',
  'Omega',
  'First watch on the Moon. Official Olympic timekeeper since 1932. Master Chronometer certified precision.',
  'Ω',
  'linear-gradient(135deg, #0c1220 0%, #1a2744 40%, #0c1220 100%)',
  1848,
  'Biel/Bienne, Switzerland',
  'omegawatches.com',
  570000,
  7.7,
  true
),
(
  'richard-mille',
  'Richard Mille',
  'A racing machine on the wrist. The most disruptive force in modern horology. Each piece is an engineering marvel.',
  '💎',
  'linear-gradient(135deg, #2d1b00 0%, #5c3a0e 40%, #2d1b00 100%)',
  2001,
  'Les Breuleux, Switzerland',
  'richardmille.com',
  5500,
  2.7,
  true
),
(
  'vacheron-constantin',
  'Vacheron Constantin',
  'The oldest continuously operating watch manufacturer. 269 years of unbroken tradition since 1755.',
  '✧',
  'linear-gradient(135deg, #1a0a1e 0%, #3a1a4e 40%, #1a0a1e 100%)',
  1755,
  'Geneva, Switzerland',
  'vacheron-constantin.com',
  25000,
  2.2,
  true
),
(
  'cartier',
  'Cartier',
  'The jeweler of kings, the king of jewelers. Where horology meets haute joaillerie since 1847.',
  '🔴',
  'linear-gradient(135deg, #3d0c0c 0%, #6e1a1a 40%, #3d0c0c 100%)',
  1847,
  'Paris, France',
  'cartier.com',
  450000,
  7.0,
  true
),
(
  'a-lange-sohne',
  'A. Lange & Söhne',
  'The pinnacle of German watchmaking. Glashütte''s finest. Every movement hand-assembled and hand-engraved.',
  '🦅',
  'linear-gradient(135deg, #1a1a1a 0%, #333333 40%, #1a1a1a 100%)',
  1845,
  'Glashütte, Germany',
  'alange-soehne.com',
  5500,
  1.2,
  true
),
(
  'iwc',
  'IWC Schaffhausen',
  'International Watch Company. Engineering precision since 1868. Pilots, divers, and complications crafted in Schaffhausen.',
  '✈️',
  'linear-gradient(135deg, #0a1628 0%, #1a2a4e 40%, #0a1628 100%)',
  1868,
  'Schaffhausen, Switzerland',
  'iwc.com',
  80000,
  2.6,
  true
),
(
  'breitling',
  'Breitling',
  'Instruments for professionals. Born 1884. The preferred timepiece of pilots, divers, and adventurers worldwide.',
  '⚙️',
  'linear-gradient(135deg, #1a1000 0%, #3d2800 40%, #1a1000 100%)',
  1884,
  'Grenchen, Switzerland',
  'breitling.com',
  170000,
  2.6,
  true
)
ON CONFLICT (slug) DO NOTHING;
