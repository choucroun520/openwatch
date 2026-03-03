-- ============================================================
-- OpenWatch Market Sales Table
-- Run this in Supabase SQL Editor
-- ============================================================

-- Unified confirmed sales from ALL sources
create table if not exists market_sales (
  id uuid default gen_random_uuid() primary key,
  source text not null,            -- 'ebay','phillips','reddit','watchbox','rccrown'
  external_id text,                -- source-specific ID for deduplication
  ref_number text,
  brand text,
  model_name text,
  sale_price numeric not null,
  currency text default 'USD',
  sale_date date,
  condition text,
  has_box boolean,
  has_papers boolean,
  year_made integer,
  sale_url text,
  image_url text,
  lot_number text,                 -- for auctions (Phillips/Christie's/Sotheby's)
  auction_house text,              -- for auction data
  estimate_low numeric,            -- pre-sale estimate
  estimate_high numeric,
  raw_title text,
  seller_type text,                -- 'dealer','private','auction_house'
  buyer_premium_pct numeric,       -- auction buyer's premium %
  created_at timestamptz default now()
);

-- Indexes for fast queries
create index if not exists market_sales_ref_number_idx on market_sales(ref_number);
create index if not exists market_sales_brand_idx on market_sales(brand);
create index if not exists market_sales_sale_date_idx on market_sales(sale_date desc);
create index if not exists market_sales_source_idx on market_sales(source);
create index if not exists market_sales_external_id_idx on market_sales(source, external_id);

-- Unique constraint to prevent duplicate imports
create unique index if not exists market_sales_dedup_idx on market_sales(source, external_id) where external_id is not null;

-- ============================================================
-- Views for analytics
-- ============================================================

-- Ref sales summary (used by ref pages)
create or replace view ref_sold_stats as
select
  ref_number,
  brand,
  count(*) as total_sold,
  round(avg(sale_price)::numeric, 0) as sold_avg,
  min(sale_price) as sold_floor,
  max(sale_price) as sold_ceiling,
  round(percentile_cont(0.5) within group (order by sale_price)::numeric, 0) as sold_median,
  count(*) filter (where sale_date >= current_date - interval '90 days') as sold_90d,
  count(*) filter (where sale_date >= current_date - interval '30 days') as sold_30d,
  max(sale_date) as last_sold_at
from market_sales
where ref_number is not null and sale_price > 1000
group by ref_number, brand;

-- Recent sales feed (for analytics terminal)
create or replace view recent_market_sales as
select
  ms.*,
  mi.name as model_display_name
from market_sales ms
left join (
  values
    ('126710BLRO', 'GMT-Master II Pepsi'),
    ('126610LN', 'Submariner Date'),
    ('126500LN', 'Daytona Steel'),
    ('5711/1A-011', 'Nautilus'),
    ('15510ST.OO.1320ST.06', 'Royal Oak 41'),
    ('4500V/110A-B128', 'Overseas 41')
) as mi(ref, name) on ms.ref_number = mi.ref
order by sale_date desc nulls last;

-- ============================================================
-- Also create sentiment_reports if not exists
-- ============================================================
create table if not exists sentiment_reports (
  id uuid default gen_random_uuid() primary key,
  category text not null check (category in ('discontinued', 'new_release', 'market_news')),
  title text not null,
  summary text not null,
  sentiment text not null check (sentiment in ('bullish', 'bearish', 'neutral')),
  impact_score integer default 0,
  ref_numbers text[] default '{}',
  brand text,
  event_date date,
  source_url text,
  created_at timestamptz default now()
);

create index if not exists sentiment_reports_created_at_idx on sentiment_reports(created_at desc);
create index if not exists sentiment_reports_category_idx on sentiment_reports(category);

comment on table market_sales is 'Unified confirmed watch sales from all sources: eBay, Phillips, Reddit, WatchBox, etc.';
comment on table sentiment_reports is 'AI-generated daily market sentiment reports from Claude analysis of watch news.';
