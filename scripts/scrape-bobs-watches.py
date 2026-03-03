#!/usr/bin/env python3
"""
OpenWatch — Bob's Watches Scraper

Bob's Watches is a major US Rolex specialist and one of the most trusted
pre-owned watch retailers. Their prices are an authoritative benchmark
for the US secondary market, especially for Rolex references.

URL: https://www.bobswatches.com/search?q={ref_number}

Usage:
  python3 scripts/scrape-bobs-watches.py --ref 126610LN
  python3 scripts/scrape-bobs-watches.py --ref 116500LN --no-save
"""

import os, sys, re, json, time, argparse
from pathlib import Path
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env.local")

from scrapling.fetchers import StealthyFetcher
from supabase import create_client

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

BASE_URL = "https://www.bobswatches.com"


# ── Helpers ───────────────────────────────────────────────────────────────────

def clean_price(text: str) -> float | None:
    """Extract USD price from strings like '$14,200' or '14,200.00'."""
    if not text:
        return None
    cleaned = re.sub(r"[^\d.,]", "", text.replace(",", ""))
    try:
        val = float(re.sub(r"\.(?=.*\.)", "", cleaned))
        return val if val > 500 else None
    except ValueError:
        return None


def extract_ref_from_text(text: str, fallback: str) -> str:
    """Extract Rolex reference number from card text."""
    # Rolex refs are typically 5-6 digits optionally followed by letters
    match = re.search(r"\b(1\d{5}[A-Z]{0,4}|[A-Z]?\d{5,6}[A-Z]{0,4})\b", text)
    if match:
        candidate = match.group(1)
        # Filter out years (e.g., 2023) and other numeric noise
        if len(candidate) >= 5 and not candidate.startswith("20"):
            return candidate
    return fallback


def extract_year(text: str) -> int | None:
    """Extract manufacture year from text."""
    match = re.search(r"\b(19[6-9]\d|20[0-2]\d)\b", text)
    return int(match.group(1)) if match else None


def extract_condition(text: str) -> str | None:
    lower = text.lower()
    if "unworn" in lower:
        return "Unworn"
    if "mint" in lower or "excellent" in lower:
        return "Mint"
    if "very good" in lower:
        return "Very Good"
    if "good" in lower:
        return "Good"
    if "fair" in lower:
        return "Fair"
    return None


# ── Main scraper ──────────────────────────────────────────────────────────────

def scrape_bobs_watches(ref: str) -> list[dict]:
    """Scrape Bob's Watches for a specific Rolex reference number."""
    url = f"{BASE_URL}/search?q={ref}"

    print(f"\n  🇺🇸 Bob's Watches (Rolex specialist)")
    print(f"  URL: {url}")

    results = []

    try:
        page = StealthyFetcher.fetch(
            url,
            headless=True,
            timeout=30000,
            block_images=True,
            block_webfonts=True,
        )

        # Bob's Watches product grid
        cards = (
            page.css("[class*='product']") or
            page.css("[class*='Product']") or
            page.css("[class*='watch-item']") or
            page.css("[class*='WatchItem']") or
            page.css("article") or
            page.css("[class*='grid-item']") or
            page.css("[data-id]")
        )

        if not cards:
            cards = page.css("li") or page.css("[class*='result']")

        print(f"  Found {len(cards)} cards")

        for card in cards[:40]:
            try:
                card_text = card.text or ""
                if len(card_text.strip()) < 10:
                    continue

                # Skip non-watch results (straps, accessories)
                lower_text = card_text.lower()
                if any(skip in lower_text for skip in ["bracelet only", "strap only", "band only", "bezel only"]):
                    continue

                # Model name / title
                title_el = (
                    card.css("h2, h3, h4") or
                    card.css("[class*='title']") or
                    card.css("[class*='name']") or
                    card.css("[class*='model']")
                )
                title = title_el.first.text.strip() if title_el else ""

                # Price
                price_el = (
                    card.css("[class*='price']") or
                    card.css("[class*='Price']") or
                    card.css("[class*='amount']") or
                    card.css("strong, b")
                )
                price_text = price_el.first.text.strip() if price_el else ""
                price_usd = clean_price(price_text)

                if not price_usd or price_usd < 1000 or price_usd > 5_000_000:
                    continue

                # Listing URL
                link_el = card.css("a[href]")
                href = link_el.first.attrib.get("href", "") if link_el else ""
                full_url = f"{BASE_URL}{href}" if href.startswith("/") else href

                # Extract ref from card if possible
                found_ref = extract_ref_from_text(card_text, ref)

                # Year, condition
                year = extract_year(card_text)
                condition = extract_condition(card_text)

                # Box & papers signals
                has_box = "box" in lower_text
                has_papers = "papers" in lower_text or "card" in lower_text or "warranty" in lower_text

                results.append({
                    "ref_number": found_ref,
                    "query_ref": ref,
                    "title": title[:200] if title else None,
                    "price_usd": price_usd,
                    "condition": condition,
                    "year": year,
                    "has_box": has_box or None,
                    "has_papers": has_papers or None,
                    "url": full_url[:500] if full_url else None,
                })

            except Exception:
                continue

        time.sleep(1.5)

    except Exception as e:
        print(f"  ❌ Scrape failed: {e}")

    return results


def save_to_market_comps(results: list[dict]) -> int:
    """Save Bob's Watches results to market_comps."""
    if not results:
        return 0

    now = datetime.now(timezone.utc).isoformat()
    saved = 0

    for r in results:
        try:
            record = {
                "ref_number": r["ref_number"],
                "source": "bobs_watches",
                "price": str(round(r["price_usd"], 2)),
                "currency": "USD",
                "market_code": "US",
                "raw_title": r.get("title"),
                "condition": r.get("condition"),
                "has_box": r.get("has_box"),
                "has_papers": r.get("has_papers"),
                "listing_url": r.get("url"),
                "scraped_at": now,
            }
            sb.table("market_comps").insert(record).execute()
            saved += 1
        except Exception:
            try:
                sb.table("market_comps").insert({
                    "ref_number": r["ref_number"],
                    "source": "bobs_watches",
                    "price": str(round(r["price_usd"], 2)),
                    "currency": "USD",
                    "scraped_at": now,
                }).execute()
                saved += 1
            except Exception:
                pass

    return saved


def print_summary(ref: str, results: list[dict]):
    """Print Bob's Watches results summary."""
    if not results:
        print(f"\n  No results found for {ref} on Bob's Watches")
        return

    sorted_results = sorted(results, key=lambda x: x["price_usd"])
    prices = [r["price_usd"] for r in results]

    print(f"\n{'='*60}")
    print(f"  BOB'S WATCHES (ROLEX US): {ref}")
    print(f"{'='*60}")
    print(f"  Total listings: {len(results)}")
    print(f"  Floor:   ${min(prices):,.0f}")
    print(f"  Average: ${sum(prices)/len(prices):,.0f}")
    print(f"  Ceiling: ${max(prices):,.0f}")

    print(f"\n  Top listings (cheapest first):")
    for i, r in enumerate(sorted_results[:5]):
        box_papers = ""
        if r.get("has_box") and r.get("has_papers"):
            box_papers = " [Box+Papers]"
        elif r.get("has_box"):
            box_papers = " [Box]"
        elif r.get("has_papers"):
            box_papers = " [Papers]"

        year_str = f" ({r['year']})" if r.get("year") else ""
        cond_str = f" • {r['condition']}" if r.get("condition") else ""
        print(f"  {i+1}. ${r['price_usd']:,.0f}{year_str}{cond_str}{box_papers}")
        if r.get("title"):
            print(f"     {r['title'][:70]}")
        if r.get("url"):
            print(f"     {r['url'][:70]}")


def main():
    parser = argparse.ArgumentParser(description="OpenWatch Bob's Watches Scraper (Rolex US market)")
    parser.add_argument("--ref", required=True, help="Rolex reference number, e.g. 126610LN")
    parser.add_argument("--no-save", action="store_true", help="Print only, don't save to DB")
    args = parser.parse_args()

    print(f"\n🇺🇸 OpenWatch — Bob's Watches (Rolex Specialist)")
    print(f"   Ref: {args.ref}")

    results = scrape_bobs_watches(args.ref)

    print_summary(args.ref, results)

    if not args.no_save and results:
        saved = save_to_market_comps(results)
        print(f"\n✅ Saved {saved}/{len(results)} listings to market_comps (source=bobs_watches, market_code=US)")
    elif not results:
        print(f"\n  ℹ️  No data to save")
    else:
        print(f"\n  ℹ️  --no-save flag set, skipped DB write")


if __name__ == "__main__":
    main()
