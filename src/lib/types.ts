import type {
  MATERIALS,
  DIAL_COLORS,
  CONDITIONS,
  CATEGORIES,
  MOVEMENTS,
  COMPLICATIONS,
  LISTING_STATUSES,
  DEALER_ROLES,
} from "./constants";

// ─── Const array element types ───────────────────────────────────────────────
export type Material = (typeof MATERIALS)[number];
export type DialColor = (typeof DIAL_COLORS)[number];
export type Condition = (typeof CONDITIONS)[number];
export type Category = (typeof CATEGORIES)[number];
export type Movement = (typeof MOVEMENTS)[number];
export type Complication = (typeof COMPLICATIONS)[number];
export type ListingStatus = (typeof LISTING_STATUSES)[number];
export type DealerRole = (typeof DEALER_ROLES)[number];

// ─── Database Row Types ───────────────────────────────────────────────────────

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: DealerRole;
  company_name: string | null;
  bio: string | null;
  website: string | null;
  location: string | null;
  specialties: string[] | null;
  verified: boolean;
  seller_rating: string; // NUMERIC stored as string on frontend
  total_sales: number;
  total_listings: number;
  joined_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface InviteCode {
  id: string;
  code: string;
  used_by: string | null;
  used_at: string | null;
  max_uses: number;
  use_count: number;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface Brand {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  banner_gradient: string | null;
  icon: string | null;
  founded: number | null;
  headquarters: string | null;
  website: string | null;
  annual_production: number | null;
  market_share: string | null; // NUMERIC as string
  verified: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Model {
  id: string;
  brand_id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  year_introduced: number | null;
  annual_production: number | null;
  reference_numbers: string[] | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Listing {
  id: string;
  dealer_id: string;
  brand_id: string;
  model_id: string | null;
  // Source tracking (migration 00017)
  source: string; // 'openwatch' | 'chrono24'
  external_id: string | null; // chrono24 listing ID, eBay ID, etc.
  external_url: string | null; // link to original listing
  reference_number: string | null; // nullable for imported data
  serial_number: string | null;
  year: number | null;
  material: string | null;
  dial_color: string | null;
  case_size: string | null;
  movement: string | null;
  complications: string[] | null;
  condition: string | null; // nullable for imported data
  condition_score: string | null; // NUMERIC as string
  has_box: boolean;
  has_papers: boolean;
  has_warranty: boolean;
  warranty_date: string | null;
  service_history: string | null;
  wholesale_price: string; // NUMERIC as string — dealer cost
  retail_price: string | null; // NUMERIC as string — public price (Phase 2)
  currency: string;
  accepts_inquiries: boolean;
  status: ListingStatus;
  featured: boolean;
  views: number;
  images: string[] | null;
  notes: string | null;
  listed_at: string;
  sold_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DealInquiry {
  id: string;
  listing_id: string;
  from_dealer_id: string;
  to_dealer_id: string;
  message: string;
  offer_price: string | null; // NUMERIC as string
  status: "open" | "responded" | "closed";
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MarketEvent {
  id: string;
  event_type: string;
  listing_id: string | null;
  brand_id: string | null;
  model_id: string | null;
  actor_id: string | null;
  price: string | null; // NUMERIC as string
  previous_price: string | null; // NUMERIC as string
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PriceSnapshot {
  id: string;
  model_id: string;
  brand_id: string;
  snapshot_date: string;
  floor_price: string | null;
  avg_price: string | null;
  ceiling_price: string | null;
  total_listed: number | null;
  total_sold: number | null;
  volume: string | null;
  created_at: string;
}

// ─── Joined / Enriched types (used in UI) ────────────────────────────────────

export interface ListingWithRelations extends Listing {
  brand: Brand;
  model: Model;
  dealer: Pick<Profile, "id" | "full_name" | "company_name" | "avatar_url" | "verified" | "seller_rating" | "total_sales">;
}

export interface BrandWithStats extends Brand {
  models: ModelWithStats[];
  total_listings: number;
  floor_price: string | null;
  avg_price: string | null;
  ceiling_price: string | null;
  total_volume: string | null;
}

export interface ModelWithStats extends Model {
  brand: Pick<Brand, "id" | "name" | "slug" | "icon" | "verified">;
  total_listings: number;
  floor_price: string | null;
  avg_price: string | null;
  ceiling_price: string | null;
}

// ─── Market Intelligence types ───────────────────────────────────────────────

export interface MarketComp {
  id: string;
  reference_number: string;
  brand_name: string | null;
  source: string;
  title: string | null;
  price: string; // NUMERIC as string
  currency: string;
  condition: string | null;
  has_box: boolean | null;
  has_papers: boolean | null;
  sale_date: string | null;
  listing_url: string | null;
  seller_name: string | null;
  seller_country: string | null;
  scraped_at: string;
  created_at: string;
}

export interface MarketStats {
  floor: number;
  avg: number;
  ceiling: number;
  sold_30d: number;
  total: number;
}

// ─── Chrono24 tracking types ─────────────────────────────────────────────────

export interface Chrono24Dealer {
  id: string;
  merchant_id: number;
  slug: string;
  name: string;
  country: string | null;
  total_listings: number;
  last_scraped_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Chrono24Listing {
  id: string;
  chrono24_id: string;
  dealer_id: string | null;
  merchant_id: number | null;
  title: string;
  reference_number: string | null;
  brand_name: string | null;
  price: string | null; // NUMERIC as string
  currency: string;
  image_url: string | null;
  listing_url: string | null;
  condition: string | null;
  is_sold: boolean;
  first_seen_at: string;
  last_seen_at: string;
  sold_detected_at: string | null;
  scraped_at: string;
  created_at: string;
}

// ─── Supabase Database type (used for typed clients) ─────────────────────────

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string; email: string };
        Update: Partial<Profile>;
      };
      invite_codes: {
        Row: InviteCode;
        Insert: Partial<InviteCode> & { code: string };
        Update: Partial<InviteCode>;
      };
      brands: {
        Row: Brand;
        Insert: Partial<Brand> & { slug: string; name: string };
        Update: Partial<Brand>;
      };
      models: {
        Row: Model;
        Insert: Partial<Model> & { brand_id: string; slug: string; name: string; category: string };
        Update: Partial<Model>;
      };
      listings: {
        Row: Listing;
        Insert: Partial<Listing> & {
          dealer_id: string;
          brand_id: string;
          wholesale_price: string;
        };
        Update: Partial<Listing>;
      };
      deal_inquiries: {
        Row: DealInquiry;
        Insert: Partial<DealInquiry> & {
          listing_id: string;
          from_dealer_id: string;
          to_dealer_id: string;
          message: string;
        };
        Update: Partial<DealInquiry>;
      };
      market_events: {
        Row: MarketEvent;
        Insert: Partial<MarketEvent> & { event_type: string };
        Update: Partial<MarketEvent>;
      };
      price_snapshots: {
        Row: PriceSnapshot;
        Insert: Partial<PriceSnapshot> & {
          model_id: string;
          brand_id: string;
          snapshot_date: string;
        };
        Update: Partial<PriceSnapshot>;
      };
      market_comps: {
        Row: MarketComp;
        Insert: Partial<MarketComp> & {
          reference_number: string;
          price: string;
          source: string;
          currency: string;
        };
        Update: Partial<MarketComp>;
      };
      chrono24_dealers: {
        Row: Chrono24Dealer;
        Insert: Partial<Chrono24Dealer> & { merchant_id: number; slug: string; name: string };
        Update: Partial<Chrono24Dealer>;
      };
      chrono24_listings: {
        Row: Chrono24Listing;
        Insert: Partial<Chrono24Listing> & { chrono24_id: string; title: string };
        Update: Partial<Chrono24Listing>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      validate_invite_code: {
        Args: { code: string };
        Returns: boolean;
      };
      use_invite_code: {
        Args: { code: string; user_id: string };
        Returns: boolean;
      };
      compute_model_stats: {
        Args: { model_id: string };
        Returns: {
          floor: number;
          avg: number;
          ceiling: number;
          total_listed: number;
        };
      };
      record_market_event: {
        Args: {
          event_type: string;
          listing_id: string | null;
          brand_id: string | null;
          model_id: string | null;
          actor_id: string | null;
          price: number | null;
          prev_price: number | null;
          metadata: Record<string, unknown>;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
  };
};
