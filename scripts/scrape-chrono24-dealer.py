#!/usr/bin/env python3
"""
Chrono24 Dealer Scraper — powered by Scrapling (replaces FlareSolverr)
Usage: python3 scripts/scrape-chrono24-dealer.py <dealer-slug>
Example: python3 scripts/scrape-chrono24-dealer.py rccrown

Scrapling's StealthyFetcher bypasses Cloudflare automatically.
No Docker, no FlareSolverr needed.
"""

import sys
import re
import os
import time
from pathlib import Path
from dotenv import load_dotenv

# Load .env.local
load_dotenv(Path(__file__).parent.parent / ".env.local")

from scrapling.fetchers import StealthyFetcher
from supabase import create_client

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
PAGE_SIZE = 60

DEALER_BLOCKLIST = ["jewelsintimeofboca"]

ALLOWED_BRANDS = [
    "rolex", "richard mille", "patek philippe", "patek",
    "vacheron constantin", "vacheron", "f.p. journe", "fp journe",
    "audemars piguet", "audemars",
]

sb = create_client(SUPABASE_URL, SUPABASE_KEY)


# ── Helpers ───────────────────────────────────────────────────────────────────

def is_allowed_brand(title: str) -> bool:
    if not title:
        return False
    t = title.lower()
    return any(t.startswith(b) for b in ALLOWED_BRANDS)


def parse_price(text: str) -> int | None:
    match = re.search(r"\$([\d,]+)", text)
    return int(match.group(1).replace(",", "")) if match else None


def fetch_page(url: str) -> object:
    """Fetch a page using Scrapling's StealthyFetcher (bypasses Cloudflare)."""
    print(f"  → Fetching: {url}")
    page = StealthyFetcher.fetch(
        url,
        headless=True,
        network_idle=True,
        timeout=45000,
        block_images=True,   # faster — we don't need images rendered
        block_webfonts=True,
    )
    return page


def get_merchant_id(slug: str) -> int:
    """Get merchant ID from Chrono24. Works with headless=True (no FlareSolverr needed)."""
    # Try search page with dealer slug — more reliable than /dealer/ URL
    search_url = f"https://www.chrono24.com/search/index.htm?dosearch=true&dealer={slug}&p=1&pageSize=1"
    page = fetch_page(search_url)
    html = page.html_content

    for pattern in [
        r'"contactDealerLayerMerchantId":\s*(\d+)',
        r'merchantId["\s:=]+(\d{5,})',
        r'"merchant_id":\s*(\d+)',
        r'data-merchant-id=["\'](\d+)',
    ]:
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            return int(match.group(1))

    # Fallback: try the /dealer/ page
    page2 = fetch_page(f"https://www.chrono24.com/dealer/{slug}/index.htm")
    html2 = page2.html_content
    for pattern in [
        r'"contactDealerLayerMerchantId":\s*(\d+)',
        r'merchantId["\s:=]+(\d{5,})',
    ]:
        match = re.search(pattern, html2, re.IGNORECASE)
        if match:
            return int(match.group(1))

    raise ValueError(f"Could not find merchantId for dealer: {slug}")


def get_dealer_name(slug: str) -> str:
    try:
        page = fetch_page(f"https://www.chrono24.com/dealer/{slug}/index.htm")
        html = page.html_content

        # Try h1
        h1 = page.css("h1")
        if h1:
            return h1.first.text.strip()

        match = re.search(r'"dealerName":\s*"([^"]+)"', html)
        if match:
            return match.group(1).strip()
    except Exception:
        pass
    return slug


def parse_cards(page) -> list[dict]:
    """Parse listing cards from a Chrono24 search results page."""
    results = []

    # Primary selector — Chrono24 article cards
    cards = page.css('[class*="js-article-item-container"]')

    if not cards:
        # Fallback: try alternative selectors (Scrapling adaptive)
        cards = page.css('[data-article-id]') or page.css('.article-item')

    for card in cards:
        try:
            link = card.css('a[href*="--id"]')
            if not link:
                continue

            href = link.first.attrib.get("href", "")
            id_match = re.search(r"--id(\d+)\.htm", href)
            if not id_match:
                continue

            chrono24_id = id_match.group(1)

            # Title from img alt or link text
            img = card.css("img[alt]")
            title = ""
            img_url = ""
            if img:
                title = img.first.attrib.get("alt", "").strip()
                img_url = (
                    img.first.attrib.get("data-lazy-sweet-spot-master-src", "")
                    .replace("_SIZE_", "280")
                    or img.first.attrib.get("src", "")
                )

            if not title:
                title = link.first.text.strip()

            price = parse_price(card.text or "")
            url = href if href.startswith("http") else f"https://www.chrono24.com{href}"

            results.append({
                "chrono24Id": chrono24_id,
                "title": title,
                "price": price,
                "imgUrl": img_url,
                "url": url,
            })
        except Exception:
            continue

    return results


def scrape_all_pages(merchant_id: int) -> list[dict]:
    all_listings = []
    page_num = 1
    total_expected = None

    while True:
        url = (
            f"https://www.chrono24.com/search/index.htm"
            f"?dosearch=true&merchantId={merchant_id}"
            f"&p=1&pageSize={PAGE_SIZE}&showpage={page_num}&sortorder=1"
        )

        label = f"~{(total_expected // PAGE_SIZE) + 1}" if total_expected else "?"
        print(f"  Scraping page {page_num} of {label}...")

        page = fetch_page(url)

        # Parse total count on first page
        if page_num == 1:
            match = re.search(r'"numResult":\s*(\d+)', page.html_content)
            if match:
                total_expected = int(match.group(1))
                print(f"  Total listings found: {total_expected}")

        cards = parse_cards(page)
        print(f"  Page {page_num}: {len(cards)} cards parsed")

        if not cards:
            break

        all_listings.extend(cards)

        if total_expected and len(all_listings) >= total_expected:
            break
        if len(cards) < PAGE_SIZE:
            break

        page_num += 1
        time.sleep(2)  # respectful rate limit

    return all_listings


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/scrape-chrono24-dealer.py <dealer-slug>")
        sys.exit(1)

    slug = sys.argv[1].lower().strip()

    if slug in DEALER_BLOCKLIST:
        print(f"❌ Dealer '{slug}' is blocklisted — skipping.")
        sys.exit(0)

    print(f"\n🕷️  Scrapling — Chrono24 dealer: {slug}")
    print("   (No FlareSolverr needed — Scrapling handles Cloudflare bypass)")

    # Get merchant ID
    print("\nGetting merchant ID...")
    merchant_id = get_merchant_id(slug)
    print(f"Merchant ID: {merchant_id}")

    dealer_name = get_dealer_name(slug)
    print(f"Dealer name: {dealer_name}")

    # Upsert dealer record
    resp = sb.table("chrono24_dealers").upsert(
        {"merchant_id": merchant_id, "slug": slug, "name": dealer_name},
        on_conflict="merchant_id"
    ).execute()

    dealer_id = resp.data[0]["id"]
    print(f"Dealer DB ID: {dealer_id}")

    # Scrape all pages
    print("\nScraping inventory...")
    raw = scrape_all_pages(merchant_id)

    # Deduplicate
    seen = set()
    listings = []
    for l in raw:
        if l["chrono24Id"] not in seen:
            seen.add(l["chrono24Id"])
            listings.append(l)

    print(f"\nUnique listings: {len(listings)} ({len(raw) - len(listings)} duplicates removed)")

    # Detect sold listings
    existing = sb.table("chrono24_listings").select("chrono24_id").eq("merchant_id", merchant_id).eq("is_sold", False).execute()
    existing_ids = {r["chrono24_id"] for r in (existing.data or [])}
    scraped_ids = {l["chrono24Id"] for l in listings}
    sold_ids = list(existing_ids - scraped_ids)

    if sold_ids:
        print(f"\n🔴 Marking {len(sold_ids)} listings as sold...")
        from datetime import datetime, timezone
        sb.table("chrono24_listings").update({
            "is_sold": True,
            "sold_detected_at": datetime.now(timezone.utc).isoformat()
        }).in_("chrono24_id", sold_ids).execute()

    # Upsert current listings
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()

    to_upsert = [
        {
            "chrono24_id": l["chrono24Id"],
            "dealer_id": dealer_id,
            "merchant_id": merchant_id,
            "title": (l["title"] or "")[:255],
            "price": l["price"],
            "currency": "USD",
            "image_url": (l["imgUrl"] or "")[:500] or None,
            "listing_url": (l["url"] or "")[:500] or None,
            "is_sold": False,
            "last_seen_at": now,
            "scraped_at": now,
        }
        for l in listings
        if l["chrono24Id"] and l["title"] and is_allowed_brand(l["title"])
    ]

    print(f"Upserting {len(to_upsert)} brand-filtered listings...")
    upserted = 0
    for i in range(0, len(to_upsert), 100):
        chunk = to_upsert[i:i+100]
        sb.table("chrono24_listings").upsert(chunk, on_conflict="chrono24_id").execute()
        upserted += len(chunk)
        print(f"  Upserted {upserted}/{len(to_upsert)}")

    # Update dealer metadata
    sb.table("chrono24_dealers").update({
        "total_listings": len(listings),
        "last_scraped_at": now,
        "updated_at": now,
    }).eq("id", dealer_id).execute()

    print(f"\n✅ Done!")
    print(f"   {len(listings)} listings scraped")
    print(f"   {len(to_upsert)} upserted (brand-filtered)")
    print(f"   {len(sold_ids)} marked as sold")


if __name__ == "__main__":
    main()
