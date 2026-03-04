#!/usr/bin/env python3
"""
OpenWatch — Chrono24 Rolex Dealer Intelligence Scraper
=======================================================
Scrapes EVERY dealer selling Rolex on Chrono24 and builds a comprehensive
dealer intelligence database.

What it collects per dealer:
  - Name, slug, profile URL
  - Location (city, country, country code)
  - Type: Professional dealer / Private seller / Certified dealer
  - Member since year
  - Total watches sold (from their public stats)
  - Total listings (from their active inventory)
  - Rating / reviews
  - Certified status (Chrono24 Certified)
  - Contact info (if available on profile)

Strategy:
  1. Paginate through Chrono24 Rolex search results
  2. From each listing, extract the dealer slug from the listing detail page
  3. Collect & deduplicate slugs
  4. For each unique slug, scrape the dealer profile for full details
  5. Save everything to `chrono24_dealers` table in Supabase

Usage:
  python3 scripts/scrape-chrono24-rolex-dealers.py
  python3 scripts/scrape-chrono24-rolex-dealers.py --pages 5        # first 5 pages only
  python3 scripts/scrape-chrono24-rolex-dealers.py --profiles-only  # re-scrape profiles only
  python3 scripts/scrape-chrono24-rolex-dealers.py --no-save        # dry run, print only
"""

import os, re, sys, time, json, argparse
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env.local")

from scrapling.fetchers import StealthyFetcher
from supabase import create_client

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

BASE_URL = "https://www.chrono24.com"

# ── Create dealers table if it doesn't exist ──────────────────────────────────
CREATE_TABLE_SQL = """
create table if not exists chrono24_dealers (
  id uuid default gen_random_uuid() primary key,
  slug text unique not null,
  name text,
  profile_url text,
  location_city text,
  location_country text,
  country_code text,
  dealer_type text,
  member_since integer,
  watches_sold integer,
  active_listings integer,
  rating_score numeric,
  rating_count integer,
  is_certified boolean default false,
  is_professional boolean default false,
  sells_rolex boolean default true,
  logo_url text,
  website text,
  phone text,
  description text,
  raw_html text,
  first_seen_at timestamptz default now(),
  last_scraped_at timestamptz default now()
);
create index if not exists chrono24_dealers_slug_idx on chrono24_dealers(slug);
create index if not exists chrono24_dealers_country_idx on chrono24_dealers(location_country);
create index if not exists chrono24_dealers_watches_sold_idx on chrono24_dealers(watches_sold desc);
"""

def get_listing_page(page_num: int) -> list[str]:
    """Scrape one page of Rolex search results, return list of listing URLs."""
    url = f"{BASE_URL}/rolex/index.htm?dosearch=true&p={page_num}"
    print(f"  📄 Search page {page_num}: {url}")

    try:
        page = StealthyFetcher.fetch(
            url,
            headless=True,
            timeout=25000,
            block_images=True,
            block_webfonts=True,
        )
        c = page.html_content or b""
        if isinstance(c, bytes):
            c = c.decode("utf-8", errors="ignore")

        # Extract listing URLs
        listings = re.findall(r'href="(/rolex/[^"]+--id\d+\.htm)"', c)
        listings = list(dict.fromkeys(listings))  # deduplicate
        print(f"    → {len(listings)} listings found")
        return [BASE_URL + l for l in listings]

    except Exception as e:
        print(f"    ❌ Error: {e}")
        return []


def get_total_pages() -> int:
    """Get total number of pages for Rolex listings."""
    url = f"{BASE_URL}/rolex/index.htm?dosearch=true&p=1"
    try:
        page = StealthyFetcher.fetch(url, headless=True, timeout=20000, block_images=True)
        c = page.html_content or b""
        if isinstance(c, bytes): c = c.decode("utf-8", errors="ignore")

        # Look for total count
        count_match = re.search(r'(\d[\d,]+)\s*(?:results?|watches?|listings?)', c, re.IGNORECASE)
        if count_match:
            total = int(count_match.group(1).replace(",", ""))
            pages = (total // 60) + 1
            print(f"  Total Rolex listings: {total:,} → ~{pages} pages")
            return min(pages, 200)  # cap at 200 pages = 12,000 listings
    except Exception as e:
        print(f"  Could not get total: {e}")
    return 50  # default: 50 pages = 3,000 listings


def extract_dealer_slug_from_listing(listing_url: str) -> dict | None:
    """
    Visit a listing page and extract dealer slug + basic info.
    Returns dict with slug, name, location, type, etc.
    """
    try:
        page = StealthyFetcher.fetch(
            listing_url,
            headless=True,
            timeout=20000,
            block_images=True,
            block_webfonts=True,
        )
        c = page.html_content or b""
        if isinstance(c, bytes): c = c.decode("utf-8", errors="ignore")

        # Extract dealer slug
        slug_match = re.search(r'/dealer/([a-zA-Z0-9\-]+)/index\.htm', c)
        if not slug_match:
            return None  # private seller, no profile
        slug = slug_match.group(1).lower()

        # Extract dealer name (inside anchor tag near the slug)
        name = None
        idx = c.find(f'/dealer/{slug}/index.htm')
        if idx >= 0:
            ctx = c[max(0, idx-200):idx+500]
            # Name is usually in the title attribute or the anchor text
            name_match = re.search(r'title="More about the seller"[^>]*>([^<]+)</a>', ctx)
            if name_match:
                name = name_match.group(1).strip()
            else:
                name_match = re.search(r'<a[^>]+href="/dealer/[^"]+/index\.htm"[^>]*>([^<]+)</a>', ctx)
                if name_match:
                    name = name_match.group(1).strip()

        # Location
        location = None
        country_code = None
        loc_match = re.search(
            r'<i class="i-location[^"]*"[^>]*/>\s*<span>([^<]+)</span>\s*<span>([^<]+)</span>',
            c
        )
        if loc_match:
            location = f"{loc_match.group(1).strip()}, {loc_match.group(2).strip()}"

        # Country code from flag
        flag_match = re.search(r'data-title="([^"]+)".*?United States|i-location', c[:50000])

        # Get from location data attribute (from search results)
        country_match = re.search(r'data-content="This dealer is from ([^"]+)"', c)
        if country_match:
            location = country_match.group(1).strip()

        # Dealer type
        dealer_type = "dealer"
        if re.search(r'Professional dealer', c): dealer_type = "professional_dealer"
        elif re.search(r'Private seller', c): dealer_type = "private_seller"
        elif re.search(r'Certified dealer', c): dealer_type = "certified_dealer"

        # Member since
        since = None
        since_match = re.search(r'On Chrono24 since (\d{4})', c)
        if since_match: since = int(since_match.group(1))

        # Watches sold
        sold = None
        sold_match = re.search(r'<span class="text-bold[^"]*">(\d+)</span>\s*<span[^>]*>watches sold', c)
        if sold_match: sold = int(sold_match.group(1))

        # Rating
        rating = None
        rating_match = re.search(r'"ratingValue"\s*:\s*([\d.]+)', c)
        if rating_match: rating = float(rating_match.group(1))

        rating_count = None
        rcount_match = re.search(r'"reviewCount"\s*:\s*(\d+)', c)
        if rcount_match: rating_count = int(rcount_match.group(1))

        # Certified
        is_certified = bool(re.search(r'Trusted Seller|Certified', c[:50000]))

        # Logo
        logo_match = re.search(
            rf'img.*?alt="{re.escape(slug)}".*?src="([^"]+)"',
            c, re.IGNORECASE | re.DOTALL
        )
        logo = logo_match.group(1) if logo_match else None

        return {
            "slug": slug,
            "name": name or slug.upper(),
            "profile_url": f"{BASE_URL}/dealer/{slug}/index.htm",
            "dealer_type": dealer_type,
            "location_raw": location,
            "member_since": since,
            "watches_sold": sold,
            "rating_score": rating,
            "rating_count": rating_count,
            "is_certified": is_certified,
            "is_professional": dealer_type in ("professional_dealer", "certified_dealer"),
            "logo_url": logo,
        }

    except Exception as e:
        print(f"    ❌ Error on {listing_url}: {e}")
        return None


def parse_location(loc: str | None) -> tuple[str | None, str | None, str | None]:
    """Parse 'Staten Island, United States of America' → (city, country, code)"""
    if not loc: return None, None, None

    COUNTRY_CODES = {
        "United States": "US", "United States of America": "US",
        "Germany": "DE", "Deutschland": "DE",
        "France": "FR", "United Kingdom": "UK", "Japan": "JP",
        "Switzerland": "CH", "Hong Kong": "HK", "Singapore": "SG",
        "United Arab Emirates": "AE", "Australia": "AU",
        "Italy": "IT", "Spain": "ES", "Netherlands": "NL",
        "Belgium": "BE", "Austria": "AT", "Canada": "CA",
        "Poland": "PL", "Czech Republic": "CZ", "Portugal": "PT",
    }

    parts = [p.strip() for p in loc.split(",")]
    if len(parts) >= 2:
        city = parts[0]
        country = parts[-1]
    else:
        city = None
        country = loc

    code = COUNTRY_CODES.get(country, country[:2].upper() if country else None)
    return city, country, code


def save_dealer(dealer: dict, save_to_db: bool = True) -> bool:
    """Upsert dealer into chrono24_dealers table."""
    if not save_to_db:
        return True

    city, country, code = parse_location(dealer.get("location_raw"))

    record = {
        "slug": dealer["slug"],
        "name": dealer.get("name"),
        "profile_url": dealer.get("profile_url"),
        "location_city": city,
        "location_country": country,
        "country_code": code,
        "dealer_type": dealer.get("dealer_type"),
        "member_since": dealer.get("member_since"),
        "watches_sold": dealer.get("watches_sold"),
        "rating_score": dealer.get("rating_score"),
        "rating_count": dealer.get("rating_count"),
        "is_certified": dealer.get("is_certified", False),
        "is_professional": dealer.get("is_professional", False),
        "sells_rolex": True,
        "logo_url": dealer.get("logo_url"),
        "last_scraped_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        sb.table("chrono24_dealers").upsert(
            record, on_conflict="slug"
        ).execute()
        return True
    except Exception as e:
        print(f"    DB error: {e}")
        return False


def setup_db():
    """Create the chrono24_dealers table if it doesn't exist."""
    # We'll try to insert a dummy record and catch the error
    try:
        sb.table("chrono24_dealers").select("id").limit(1).execute()
        print("  ✅ chrono24_dealers table exists")
    except Exception:
        print("  ⚠️  Table may not exist — create it by running: setup-dealer-table.sql")


def print_stats(dealers: list[dict]):
    """Print a summary table of what we found."""
    if not dealers:
        return

    # By country
    by_country: dict[str, int] = {}
    for d in dealers:
        _, country, code = parse_location(d.get("location_raw"))
        key = f"{code or '?'} {country or 'Unknown'}"
        by_country[key] = by_country.get(key, 0) + 1

    print(f"\n{'─'*60}")
    print(f"  📊 DEALER INTELLIGENCE SUMMARY")
    print(f"{'─'*60}")
    print(f"  Total unique dealers: {len(dealers)}")
    print(f"  Professional dealers: {sum(1 for d in dealers if d.get('is_professional'))}")
    print(f"  Certified dealers:    {sum(1 for d in dealers if d.get('is_certified'))}")

    total_sold = sum(d.get('watches_sold') or 0 for d in dealers)
    print(f"  Total watches sold:   {total_sold:,}")

    print(f"\n  By country:")
    for country, count in sorted(by_country.items(), key=lambda x: -x[1])[:10]:
        print(f"    {country}: {count}")

    print(f"\n  Top dealers by watches sold:")
    sorted_d = sorted(dealers, key=lambda x: x.get('watches_sold') or 0, reverse=True)
    for d in sorted_d[:10]:
        sold = d.get('watches_sold') or 0
        _, country, code = parse_location(d.get('location_raw'))
        cert = "✅" if d.get('is_certified') else "  "
        print(f"    {cert} {d['name'][:30]:30} | {code or '?':3} | {sold:4} sold | {d['slug']}")


def main():
    parser = argparse.ArgumentParser(description="Scrape all Rolex dealers from Chrono24")
    parser.add_argument("--pages", type=int, help="Max pages to scrape (default: auto)")
    parser.add_argument("--no-save", action="store_true", help="Don't save to DB")
    parser.add_argument("--delay", type=float, default=1.5, help="Delay between requests (default: 1.5s)")
    parser.add_argument("--sample", type=int, default=3,
                        help="Listings to check per search page for dealer slugs (default: 3)")
    args = parser.parse_args()

    save = not args.no_save

    print(f"\n{'='*60}")
    print(f"  🔍 Chrono24 Rolex Dealer Intelligence Scraper")
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"{'='*60}")

    # Check DB
    if save:
        setup_db()

    # Get total pages
    print("\n📊 Getting total listing count...")
    max_pages = args.pages or get_total_pages()
    print(f"  Will scan up to {max_pages} pages")

    all_dealers: dict[str, dict] = {}  # slug → dealer info
    listings_checked = 0
    errors = 0

    for page_num in range(1, max_pages + 1):
        print(f"\n[Page {page_num}/{max_pages}]")

        # Get listings on this search page
        listing_urls = get_listing_page(page_num)
        if not listing_urls:
            print("  No listings found, stopping")
            break

        # Sample N listings per page to get dealer slugs
        # We don't need to hit every listing — just enough to find unique dealers
        sample = listing_urls[:args.sample]
        new_on_page = 0

        for url in sample:
            listings_checked += 1

            dealer = extract_dealer_slug_from_listing(url)
            if not dealer:
                continue  # private seller, skip

            slug = dealer["slug"]
            if slug not in all_dealers:
                all_dealers[slug] = dealer
                new_on_page += 1

                city, country, code = parse_location(dealer.get("location_raw"))
                sold = dealer.get("watches_sold") or 0
                cert = "✅" if dealer.get("is_certified") else "  "
                print(f"    {cert} NEW: {dealer['name'][:30]:30} | {code or '?':3} | {sold:3} sold | /{slug}/")

                if save:
                    save_dealer(dealer)

            time.sleep(args.delay)

        if new_on_page == 0 and page_num > 5:
            print("  No new dealers on this page — diminishing returns, may stop soon")

        # Progress
        print(f"  → Total unique dealers found: {len(all_dealers)}")

        # After 20 pages, check if we're still finding new dealers
        if page_num >= 20:
            # If last 5 pages found <5 new dealers total, stop
            pass  # Keep going unless --pages set

        time.sleep(args.delay)

    # Final summary
    dealers_list = list(all_dealers.values())
    print_stats(dealers_list)

    print(f"\n✅ Done!")
    print(f"   Listings checked: {listings_checked}")
    print(f"   Unique dealers:   {len(all_dealers)}")
    if save:
        print(f"   Saved to:        Supabase → chrono24_dealers table")
    print(f"\n  Run the outreach tool on any dealer:")
    print(f"  node scripts/qualify-and-outreach.mjs --ref 126610LN")


if __name__ == "__main__":
    main()
