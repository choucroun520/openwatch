#!/usr/bin/env python3
"""
OpenWatch — WatchBox Scraper

WatchBox is a major US pre-owned luxury watch reseller.
Their prices represent the CEILING of the US retail market for pre-owned watches.
Use this data for arbitrage calculations: "how much can we sell for in the US?"

URL: https://www.thewatchbox.com/search?q={ref_number}

Usage:
  python3 scripts/scrape-watchbox.py --ref 126610LN
  python3 scripts/scrape-watchbox.py --ref 5711 --no-save
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

BASE_URL = "https://www.thewatchbox.com"


# ── Price parsing ─────────────────────────────────────────────────────────────

def clean_price(text: str) -> float | None:
    """Extract numeric USD price from strings like '$14,200' or '14,200.00'."""
    if not text:
        return None
    cleaned = re.sub(r"[^\d.,]", "", text.replace(",", ""))
    try:
        val = float(re.sub(r"\.(?=.*\.)", "", cleaned))
        return val if val > 500 else None
    except ValueError:
        return None


def has_box(text: str) -> bool | None:
    lower = text.lower()
    if "box" in lower:
        return True
    return None


def has_papers(text: str) -> bool | None:
    lower = text.lower()
    if "papers" in lower or "paper" in lower or "card" in lower:
        return True
    return None


def extract_condition(text: str) -> str | None:
    lower = text.lower()
    if "unworn" in lower or "new" in lower:
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

def scrape_watchbox(ref: str) -> list[dict]:
    """Scrape WatchBox search results for a reference number."""
    url = f"{BASE_URL}/search?q={ref}"

    print(f"\n  🇺🇸 WatchBox (US ceiling price)")
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

        # WatchBox uses React — look for product cards
        cards = (
            page.css("[class*='ProductCard']") or
            page.css("[class*='product-card']") or
            page.css("[class*='watch-card']") or
            page.css("[class*='WatchCard']") or
            page.css("article") or
            page.css("[data-product-id]") or
            page.css("[class*='item']")
        )

        if not cards:
            # Try broader selectors
            cards = page.css("li") or page.css("[class*='result']")

        print(f"  Found {len(cards)} cards")

        for card in cards[:30]:
            try:
                card_text = card.text or ""
                if len(card_text.strip()) < 10:
                    continue

                # Title / model name
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
                    card.css("[class*='cost']") or
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

                # Condition, box, papers from card text
                condition = extract_condition(card_text)
                box = has_box(card_text)
                papers = has_papers(card_text)

                # Reference number (try to extract from title/card)
                ref_el = card.css("[class*='ref']") or card.css("[class*='reference']")
                ref_text = ref_el.first.text.strip() if ref_el else ""
                # Try to find ref in card text (alphanumeric pattern)
                ref_match = re.search(r"\b(\d{5,6}[A-Z]{0,4})\b", card_text)
                found_ref = ref_match.group(1) if ref_match else ref

                results.append({
                    "ref_number": found_ref or ref,
                    "query_ref": ref,
                    "title": title[:200] if title else None,
                    "price_usd": price_usd,
                    "condition": condition,
                    "has_box": box,
                    "has_papers": papers,
                    "url": full_url[:500] if full_url else None,
                })

            except Exception:
                continue

        time.sleep(1.5)

    except Exception as e:
        print(f"  ❌ Scrape failed: {e}")

    return results


def save_to_market_comps(results: list[dict]) -> int:
    """Save WatchBox results to market_comps table."""
    if not results:
        return 0

    now = datetime.now(timezone.utc).isoformat()
    saved = 0

    for r in results:
        try:
            record = {
                "ref_number": r["ref_number"],
                "source": "watchbox",
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
                    "source": "watchbox",
                    "price": str(round(r["price_usd"], 2)),
                    "currency": "USD",
                    "scraped_at": now,
                }).execute()
                saved += 1
            except Exception:
                pass

    return saved


def print_summary(ref: str, results: list[dict]):
    """Print WatchBox results summary."""
    if not results:
        print(f"\n  No results found for {ref} on WatchBox")
        return

    sorted_results = sorted(results, key=lambda x: x["price_usd"])

    print(f"\n{'='*60}")
    print(f"  WATCHBOX (US CEILING): {ref}")
    print(f"{'='*60}")
    print(f"  Total listings: {len(results)}")

    prices = [r["price_usd"] for r in results]
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

        cond = f" • {r['condition']}" if r.get("condition") else ""
        print(f"  {i+1}. ${r['price_usd']:,.0f}{cond}{box_papers}")
        if r.get("title"):
            print(f"     {r['title'][:70]}")
        if r.get("url"):
            print(f"     {r['url'][:70]}")


def main():
    parser = argparse.ArgumentParser(description="OpenWatch WatchBox Scraper (US ceiling price)")
    parser.add_argument("--ref", required=True, help="Reference number, e.g. 126610LN")
    parser.add_argument("--no-save", action="store_true", help="Print only, don't save to DB")
    args = parser.parse_args()

    print(f"\n🇺🇸 OpenWatch — WatchBox (US Market Ceiling)")
    print(f"   Ref: {args.ref}")

    results = scrape_watchbox(args.ref)

    print_summary(args.ref, results)

    if not args.no_save and results:
        saved = save_to_market_comps(results)
        print(f"\n✅ Saved {saved}/{len(results)} listings to market_comps (source=watchbox, market_code=US)")
    elif not results:
        print(f"\n  ℹ️  No data to save")
    else:
        print(f"\n  ℹ️  --no-save flag set, skipped DB write")


if __name__ == "__main__":
    main()
