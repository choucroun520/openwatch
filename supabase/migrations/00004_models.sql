-- ─── Models table + seed data ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  year_introduced INTEGER,
  annual_production INTEGER,
  reference_numbers TEXT[] DEFAULT '{}',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(brand_id, slug)
);

CREATE TRIGGER models_updated_at
  BEFORE UPDATE ON models
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed models for all 10 brands
-- Rolex models
WITH rolex AS (SELECT id FROM brands WHERE slug = 'rolex')
INSERT INTO models (brand_id, slug, name, category, year_introduced, annual_production, reference_numbers)
SELECT
  rolex.id,
  m.slug,
  m.name,
  m.category,
  m.year_introduced,
  m.annual_production,
  m.reference_numbers
FROM rolex,
(VALUES
  ('submariner',   'Submariner',   'Dive',         1953, 95000,  ARRAY['124060','126610LN','126610LV','126613LB','126618LB','126619LB']),
  ('daytona',      'Daytona',      'Chronograph',  1963, 45000,  ARRAY['126500LN','126509','126506','126518LN','116500LN']),
  ('gmt-master-ii','GMT-Master II','Travel',       1955, 80000,  ARRAY['126710BLRO','126710BLNR','126720VTNR','126711CHNR']),
  ('datejust',     'Datejust',     'Dress',        1945, 250000, ARRAY['126334','126300','126234','126200','126233','126331']),
  ('day-date',     'Day-Date',     'Dress',        1956, 35000,  ARRAY['228235','228238','228206','228349RBR']),
  ('explorer',     'Explorer',     'Sport',        1953, 60000,  ARRAY['224270','226570']),
  ('sky-dweller',  'Sky-Dweller',  'Complication', 2012, 30000,  ARRAY['336934','336935','326238']),
  ('yacht-master', 'Yacht-Master', 'Sport',        1992, 40000,  ARRAY['226659','126622','126621'])
) AS m(slug, name, category, year_introduced, annual_production, reference_numbers)
ON CONFLICT (brand_id, slug) DO NOTHING;

-- Patek Philippe models
WITH brand AS (SELECT id FROM brands WHERE slug = 'patek-philippe')
INSERT INTO models (brand_id, slug, name, category, year_introduced, annual_production, reference_numbers)
SELECT
  brand.id, m.slug, m.name, m.category, m.year_introduced, m.annual_production, m.reference_numbers
FROM brand,
(VALUES
  ('nautilus',          'Nautilus',           'Luxury Sport',      1976, 8000,  ARRAY['5711/1A','5712/1A','5726/1A','5990/1A','6711/1A']),
  ('aquanaut',          'Aquanaut',           'Sport Luxury',      1997, 12000, ARRAY['5167A','5168G','5968A','5269R']),
  ('calatrava',         'Calatrava',          'Dress',             1932, 15000, ARRAY['5227G','5227R','6119G','5297G']),
  ('grand-complications','Grand Complications','Haute Horlogerie',  1925, 2000,  ARRAY['5270P','6300G','5204R','5370P']),
  ('twenty-4',          'Twenty~4',           'Ladies',            1999, 7000,  ARRAY['4910/1200A','7300/1200A'])
) AS m(slug, name, category, year_introduced, annual_production, reference_numbers)
ON CONFLICT (brand_id, slug) DO NOTHING;

-- Audemars Piguet models
WITH brand AS (SELECT id FROM brands WHERE slug = 'audemars-piguet')
INSERT INTO models (brand_id, slug, name, category, year_introduced, annual_production, reference_numbers)
SELECT
  brand.id, m.slug, m.name, m.category, m.year_introduced, m.annual_production, m.reference_numbers
FROM brand,
(VALUES
  ('royal-oak',         'Royal Oak',         'Luxury Sport',  1972, 25000, ARRAY['15500ST','15510ST','26240ST','15202ST','26331ST','77451ST']),
  ('royal-oak-offshore','Royal Oak Offshore', 'Sport',        1993, 15000, ARRAY['26405CE','26470ST','26238CE','26420SO']),
  ('code-1159',         'CODE 11.59',         'Contemporary', 2019, 8000,  ARRAY['15210CR','26393CR','26396OR'])
) AS m(slug, name, category, year_introduced, annual_production, reference_numbers)
ON CONFLICT (brand_id, slug) DO NOTHING;

-- Omega models
WITH brand AS (SELECT id FROM brands WHERE slug = 'omega')
INSERT INTO models (brand_id, slug, name, category, year_introduced, annual_production, reference_numbers)
SELECT
  brand.id, m.slug, m.name, m.category, m.year_introduced, m.annual_production, m.reference_numbers
FROM brand,
(VALUES
  ('speedmaster',      'Speedmaster Professional', 'Chronograph', 1957, 120000, ARRAY['310.30.42.50.01.001','310.30.42.50.01.002','311.30.42.30.01.005']),
  ('seamaster-300m',   'Seamaster 300M',           'Dive',        1993, 180000, ARRAY['210.30.42.20.01.001','210.30.42.20.03.001','210.32.42.20.01.001']),
  ('planet-ocean',     'Seamaster Planet Ocean',   'Dive',        2005, 60000,  ARRAY['215.30.44.21.01.001','215.30.44.21.03.001']),
  ('aqua-terra',       'Aqua Terra',               'Dress Sport', 2002, 90000,  ARRAY['220.10.41.21.01.001','220.10.41.21.03.001'])
) AS m(slug, name, category, year_introduced, annual_production, reference_numbers)
ON CONFLICT (brand_id, slug) DO NOTHING;

-- Richard Mille models
WITH brand AS (SELECT id FROM brands WHERE slug = 'richard-mille')
INSERT INTO models (brand_id, slug, name, category, year_introduced, annual_production, reference_numbers)
SELECT
  brand.id, m.slug, m.name, m.category, m.year_introduced, m.annual_production, m.reference_numbers
FROM brand,
(VALUES
  ('rm-011', 'RM 011', 'Flyback Chronograph', 2007, 800, ARRAY['RM011-FM','RM011-03','RM011-Ti']),
  ('rm-035', 'RM 035', 'Ultra-Light',         2011, 600, ARRAY['RM035-02','RM035-01']),
  ('rm-067', 'RM 067', 'Extra Flat',          2016, 500, ARRAY['RM067-01'])
) AS m(slug, name, category, year_introduced, annual_production, reference_numbers)
ON CONFLICT (brand_id, slug) DO NOTHING;

-- Vacheron Constantin models
WITH brand AS (SELECT id FROM brands WHERE slug = 'vacheron-constantin')
INSERT INTO models (brand_id, slug, name, category, year_introduced, annual_production, reference_numbers)
SELECT
  brand.id, m.slug, m.name, m.category, m.year_introduced, m.annual_production, m.reference_numbers
FROM brand,
(VALUES
  ('overseas',    'Overseas',    'Travel',   1996, 6000, ARRAY['4500V','5500V','7900V']),
  ('patrimony',   'Patrimony',   'Dress',    2004, 5000, ARRAY['85180','81180','85290']),
  ('historiques', 'Historiques', 'Heritage', 2009, 2000, ARRAY['86122','82035'])
) AS m(slug, name, category, year_introduced, annual_production, reference_numbers)
ON CONFLICT (brand_id, slug) DO NOTHING;

-- Cartier models
WITH brand AS (SELECT id FROM brands WHERE slug = 'cartier')
INSERT INTO models (brand_id, slug, name, category, year_introduced, annual_production, reference_numbers)
SELECT
  brand.id, m.slug, m.name, m.category, m.year_introduced, m.annual_production, m.reference_numbers
FROM brand,
(VALUES
  ('santos',      'Santos',      'Pilot',   1904, 80000,  ARRAY['WSSA0018','WSSA0029','WSSA0048']),
  ('tank',        'Tank',        'Dress',   1917, 120000, ARRAY['WSTA0065','WSTA0053','W5200027']),
  ('ballon-bleu', 'Ballon Bleu', 'Classic', 2007, 60000,  ARRAY['WSBB0046','W69016Z4'])
) AS m(slug, name, category, year_introduced, annual_production, reference_numbers)
ON CONFLICT (brand_id, slug) DO NOTHING;

-- A. Lange & Söhne models
WITH brand AS (SELECT id FROM brands WHERE slug = 'a-lange-sohne')
INSERT INTO models (brand_id, slug, name, category, year_introduced, annual_production, reference_numbers)
SELECT
  brand.id, m.slug, m.name, m.category, m.year_introduced, m.annual_production, m.reference_numbers
FROM brand,
(VALUES
  ('lange-1', 'Lange 1',  'Signature', 1994, 1500, ARRAY['191.032','101.032']),
  ('saxonia',  'Saxonia',  'Dress',     1994, 2000, ARRAY['205.086','380.044'])
) AS m(slug, name, category, year_introduced, annual_production, reference_numbers)
ON CONFLICT (brand_id, slug) DO NOTHING;

-- IWC models
WITH brand AS (SELECT id FROM brands WHERE slug = 'iwc')
INSERT INTO models (brand_id, slug, name, category, year_introduced, annual_production, reference_numbers)
SELECT
  brand.id, m.slug, m.name, m.category, m.year_introduced, m.annual_production, m.reference_numbers
FROM brand,
(VALUES
  ('big-pilot',      'Big Pilot''s Watch',    'Pilot',        1940, 20000, ARRAY['IW501001','IW501002','IW500912']),
  ('portugieser',    'Portugieser',           'Dress',        1939, 25000, ARRAY['IW500705','IW500114','IW371605']),
  ('aquatimer',      'Aquatimer',             'Dive',         1967, 15000, ARRAY['IW329005','IW356802']),
  ('pilot-mark-xx',  'Pilot''s Watch Mark XX','Pilot',        2022, 20000, ARRAY['IW328201','IW328204'])
) AS m(slug, name, category, year_introduced, annual_production, reference_numbers)
ON CONFLICT (brand_id, slug) DO NOTHING;

-- Breitling models
WITH brand AS (SELECT id FROM brands WHERE slug = 'breitling')
INSERT INTO models (brand_id, slug, name, category, year_introduced, annual_production, reference_numbers)
SELECT
  brand.id, m.slug, m.name, m.category, m.year_introduced, m.annual_production, m.reference_numbers
FROM brand,
(VALUES
  ('navitimer',         'Navitimer',          'Pilot',        1952, 40000, ARRAY['AB0138241B1P1','A17326211B1X2']),
  ('superocean',        'Superocean',         'Dive',         1957, 35000, ARRAY['A17376211C1A1','A17376A71C1A1']),
  ('chronomat',         'Chronomat',          'Sport',        1984, 30000, ARRAY['AB0134101B1A1','CB0134101C1A1']),
  ('avenger',           'Avenger',            'Pilot',        2001, 25000, ARRAY['A17318101B1X2','A17382101C1X1'])
) AS m(slug, name, category, year_introduced, annual_production, reference_numbers)
ON CONFLICT (brand_id, slug) DO NOTHING;
