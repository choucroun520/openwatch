#!/usr/bin/env python3
"""
Phillips Watches Auction Scraper
Scrapes confirmed hammer prices from Phillips auction results.
Phillips is the #1 watch auction house — most authoritative sale data.

Usage: python3 scripts/scrape-phillips.py
Data goes into: market_sales table (source='phillips')
"""

import os, re, json, time
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env.local")

from scrapling.fetchers import StealthyFetcher
from supabase import create_client

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

WATCH_BRANDS = [
    "Rolex", "Patek Philippe", "Audemars Piguet", "Vacheron Constantin",
    "Richard Mille", "F.P. Journe", "A. Lange", "Cartier", "IWC",
    "Omega", "Breitling"
]

BRAND_KEYWORDS = [b.lower() for b in WATCH_BRANDS]

def is_watch(title: str) -> bool:
    if not title: return False
    t = title.lower()
    return any(k in t for k in BRAND_KEYWORDS)

def extract_ref(title: str) -> str | None:
    if not title: return None
    # Pattern: "Ref. XXXX" or "Reference XXXX"
    m = re.search(r'[Rr]ef\.?\s*([A-Z0-9]{4,}[-/.][A-Z0-9-/.]*)', title)
    if m: return m.group(1)
    # Pattern: standalone ref at end of description
    m = re.search(r'\b([0-9]{5,6}[A-Z]{0,6}(?:[/-][0-9A-Z]+)?)\b', title)
    if m: return m.group(1)
    return None

def extract_brand(title: str) -> str | None:
    if not title: return None
    t = title.lower()
    for brand in WATCH_BRANDS:
        if brand.lower() in t:
            return brand
    return None

def parse_price(text: str) -> float | None:
    if not text: return None
    # Remove currency symbols and commas
    cleaned = re.sub(r'[,$€£CHF\s]', '', text.replace(',', ''))
    m = re.search(r'(\d+(?:\.\d+)?)', cleaned)
    if m:
        val = float(m.group(1))
        return val if val > 100 else None
    return None

def scrape_phillips_results(max_pages: int = 5) -> list[dict]:
    """Scrape Phillips auction results pages."""
    all_lots = []

    # Phillips results page
    base_url = "https://www.phillips.com/auctions/past?categories=Watches"

    print(f"  Fetching Phillips auction index...")
    try:
        page = StealthyFetcher.fetch(
            base_url,
            headless=True,
            timeout=45000,
            block_images=True,
            block_webfonts=True,
        )

        # Find auction sale links
        sale_links = []
        for a in page.css('a[href*="/auctions/"]'):
            href = a.attrib.get("href", "")
            if href and "/auctions/" in href and "past" not in href:
                full = href if href.startswith("http") else f"https://www.phillips.com{href}"
                sale_links.append(full)

        # Deduplicate
        sale_links = list(dict.fromkeys(sale_links))[:10]
        print(f"  Found {len(sale_links)} auction sales")

        # Scrape each sale's lot list
        for sale_url in sale_links[:max_pages]:
            print(f"  Scraping: {sale_url}")
            try:
                sale_page = StealthyFetcher.fetch(
                    sale_url + "/lots",
                    headless=True,
                    timeout=30000,
                    block_images=True,
                )

                # Parse lots
                lots = sale_page.css('[class*="lot"], [class*="Lot"], article')
                print(f"    Found {len(lots)} lots")

                for lot in lots:
                    try:
                        title_el = lot.css('h2, h3, [class*="title"], [class*="Title"]')
                        title = title_el.first.text.strip() if title_el else ""

                        if not is_watch(title):
                            continue

                        price_el = lot.css('[class*="price"], [class*="Price"], [class*="hammer"], [class*="result"]')
                        price_text = price_el.first.text.strip() if price_el else ""
                        price = parse_price(price_text)

                        if not price or price < 1000:
                            continue

                        lot_num_el = lot.css('[class*="lot-number"], [class*="lotNumber"]')
                        lot_number = lot_num_el.first.text.strip() if lot_num_el else None

                        img_el = lot.css('img')
                        img_url = img_el.first.attrib.get("src", "") if img_el else None

                        link_el = lot.css('a[href]')
                        lot_url = ""
                        if link_el:
                            href = link_el.first.attrib.get("href", "")
                            lot_url = href if href.startswith("http") else f"https://www.phillips.com{href}"

                        all_lots.append({
                            "title": title,
                            "price": price,
                            "lot_number": lot_number,
                            "image_url": img_url,
                            "url": lot_url or sale_url,
                            "sale_url": sale_url,
                        })
                    except Exception:
                        continue

                time.sleep(1.5)

            except Exception as e:
                print(f"    ⚠️  Error scraping {sale_url}: {e}")
                continue

    except Exception as e:
        print(f"  ⚠️  Error fetching Phillips index: {e}")

    return all_lots


def save_lots(lots: list[dict]) -> int:
    """Save auction lots to market_sales table."""
    if not lots:
        return 0

    now = datetime.now(timezone.utc).isoformat()
    saved = 0

    for lot in lots:
        try:
            ref = extract_ref(lot["title"])
            brand = extract_brand(lot["title"])

            # Use URL as external_id for deduplication
            external_id = lot.get("url", "").split("/")[-1] or None
            if lot.get("lot_number"):
                external_id = f"phillips-{lot['lot_number']}"

            record = {
                "source": "phillips",
                "external_id": external_id,
                "ref_number": ref,
                "brand": brand,
                "model_name": lot["title"][:255],
                "sale_price": lot["price"],
                "currency": "USD",
                "sale_date": None,  # Would need to parse from sale page
                "condition": None,
                "auction_house": "Phillips",
                "lot_number": lot.get("lot_number"),
                "sale_url": lot.get("url"),
                "image_url": lot.get("image_url"),
                "raw_title": lot["title"][:500],
                "seller_type": "auction_house",
                "buyer_premium_pct": 26.0,  # Phillips standard premium
                "created_at": now,
            }

            # Upsert by external_id
            sb.table("market_sales").upsert(
                record,
                on_conflict="source,external_id"
            ).execute()
            saved += 1
            print(f"  ✅ {brand} {ref or '?'} — ${lot['price']:,.0f}")

        except Exception as e:
            if "duplicate" not in str(e).lower():
                print(f"  ⚠️  Save error: {e}")

    return saved


def main():
    print("\n🏛️  Phillips Auction Scraper")
    print(f"   {datetime.now().strftime('%Y-%m-%d %H:%M')}")

    print("\nScraping auction results...")
    lots = scrape_phillips_results(max_pages=5)
    print(f"\nFound {len(lots)} watch lots")

    if lots:
        print("\nSaving to market_sales...")
        saved = save_lots(lots)
        print(f"\n✅ Done! {saved} auction results saved")
    else:
        print("No lots found — Phillips may have changed their layout")
        print("Try running with Scrapling headless=False to debug")


if __name__ == "__main__":
    main()
