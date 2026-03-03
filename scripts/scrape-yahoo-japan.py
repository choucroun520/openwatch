#!/usr/bin/env python3
"""
OpenWatch — Yahoo Auctions Japan Scraper

Yahoo Auctions Japan is the biggest secondhand watch market in Asia.
Prices are often 10-20% cheaper than US market before import costs.

URL pattern:
  https://auctions.yahoo.co.jp/search/search?p={query}&auccat=&tab_ex=commerce
    &ei=utf-8&aq=-1&oq=&sc_i=&exflg=1&b=1&n=100&s1=bids&o1=d

Strategy:
  - Listings sorted by bid count descending
  - 0 bids = Buy It Now / fixed price = motivated seller
  - Listings ending soon + 0 bids = maximum motivation signal

Usage:
  python3 scripts/scrape-yahoo-japan.py --ref 126610LN
  python3 scripts/scrape-yahoo-japan.py --ref 5711
  python3 scripts/scrape-yahoo-japan.py --ref 26240 --no-save
"""

import os, sys, re, json, time, argparse
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlencode, quote

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env.local")

from scrapling.fetchers import StealthyFetcher
from supabase import create_client

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Reference number → Japanese query mapping ────────────────────────────────

REF_TO_JAPANESE: dict[str, str] = {
    # Rolex Submariner
    "126610LN": "ロレックス 126610LN",
    "126610LV": "ロレックス 126610LV",
    "124060":   "ロレックス 124060",
    # Rolex GMT-Master II
    "126710BLRO": "ロレックス 126710BLRO",
    "126710BLNR": "ロレックス 126710BLNR",
    "126720VTNR": "ロレックス 126720VTNR",
    # Rolex Daytona
    "116500LN": "ロレックス デイトナ 116500LN",
    "126500LN": "ロレックス デイトナ 126500LN",
    # Patek Philippe Nautilus
    "5711":        "パテックフィリップ ノーチラス 5711",
    "5711/1A-011": "パテックフィリップ ノーチラス 5711",
    "5712":        "パテックフィリップ ノーチラス 5712",
    "5712/1A-001": "パテックフィリップ ノーチラス 5712",
    # AP Royal Oak
    "15500":           "オーデマピゲ ロイヤルオーク 15500",
    "15510ST.OO.1320ST.06": "オーデマピゲ ロイヤルオーク 15510",
    "26240":           "オーデマピゲ ロイヤルオーク 26240",
    "26240ST.OO.1320ST.02": "オーデマピゲ ロイヤルオーク 26240",
    # Vacheron
    "4500V/110A-B128": "ヴァシュロン フィフティーシックス 4500V",
}


def ref_to_query(ref: str) -> str:
    """Map an English ref number to the best Japanese search query."""
    if ref in REF_TO_JAPANESE:
        return REF_TO_JAPANESE[ref]
    # Check prefix matches (e.g. "5711" matches "5711/1A-011")
    for key, val in REF_TO_JAPANESE.items():
        if ref in key or key in ref:
            return val
    # Default: ref number + 腕時計 (watch)
    return f"{ref} 腕時計"


# ── FX rates ─────────────────────────────────────────────────────────────────

FALLBACK_JPY_TO_USD = 0.0067  # approximate

def get_jpy_to_usd() -> float:
    """Fetch live JPY→USD rate from frankfurter.app."""
    try:
        import urllib.request, ssl
        ctx = ssl.create_default_context()
        url = "https://api.frankfurter.app/latest?from=USD&to=JPY"
        with urllib.request.urlopen(url, context=ctx, timeout=5) as r:
            data = json.loads(r.read())
            jpy_per_usd = data["rates"]["JPY"]
            return round(1.0 / jpy_per_usd, 8)
    except Exception as e:
        print(f"  ⚠️  FX API unavailable, using fallback rate: {e}")
        return FALLBACK_JPY_TO_USD


# ── Price parsing ─────────────────────────────────────────────────────────────

def parse_jpy(text: str) -> float | None:
    """Extract numeric JPY price from Japanese price strings like '¥1,234,567'."""
    if not text:
        return None
    # Remove yen sign, commas, spaces, Japanese chars
    cleaned = re.sub(r"[¥￥,\s円]", "", text)
    cleaned = re.sub(r"[^\d.]", "", cleaned)
    try:
        val = float(cleaned)
        return val if val >= 1000 else None
    except ValueError:
        return None


def parse_bids(text: str) -> int:
    """Extract bid count from text like '5件' or '0件'."""
    if not text:
        return 0
    match = re.search(r"(\d+)", text)
    return int(match.group(1)) if match else 0


# ── Main scraper ──────────────────────────────────────────────────────────────

def scrape_yahoo_japan(ref: str, jpy_to_usd: float) -> list[dict]:
    """Scrape Yahoo Auctions Japan for the given reference number."""
    query = ref_to_query(ref)
    params = {
        "p": query,
        "auccat": "",
        "tab_ex": "commerce",
        "ei": "utf-8",
        "aq": "-1",
        "oq": "",
        "sc_i": "",
        "exflg": "1",
        "b": "1",
        "n": "100",
        "s1": "bids",
        "o1": "d",
    }
    url = f"https://auctions.yahoo.co.jp/search/search?{urlencode(params)}"

    print(f"\n  🇯🇵 Yahoo Auctions Japan")
    print(f"  Query: {query}")
    print(f"  URL: {url[:80]}...")

    results = []

    try:
        page = StealthyFetcher.fetch(
            url,
            headless=True,
            timeout=30000,
            block_images=True,
            block_webfonts=True,
        )

        # Yahoo Auctions Japan listing containers
        cards = (
            page.css("li.Product") or
            page.css("[class*='Product']") or
            page.css("li[class*='Item']") or
            page.css(".auctions-item") or
            page.css("[data-auction-id]")
        )

        if not cards:
            # Fallback: look for any list items with price
            cards = page.css("li") or page.css("article")

        print(f"  Found {len(cards)} listings")

        for card in cards[:50]:
            try:
                card_text = card.text or ""

                # Title (Japanese — keep as-is)
                title_el = (
                    card.css(".Product__title") or
                    card.css("[class*='title']") or
                    card.css("h2, h3, a")
                )
                title = title_el.first.text.strip() if title_el else ""

                # Skip non-watch items (accessories, parts)
                if any(skip in card_text for skip in ["ベルト only", "バンド only", "ストラップ only"]):
                    continue

                # Price
                price_el = (
                    card.css(".Product__price") or
                    card.css("[class*='price']") or
                    card.css("[class*='Price']") or
                    card.css("em, strong")
                )
                price_text = price_el.first.text.strip() if price_el else ""
                price_jpy = parse_jpy(price_text)

                if not price_jpy or price_jpy < 50_000:  # Under ~$330 = not a real watch
                    continue

                price_usd = round(price_jpy * jpy_to_usd, 2)

                # Sanity check
                if price_usd < 500 or price_usd > 2_000_000:
                    continue

                # Bid count
                bids_el = (
                    card.css(".Product__bid") or
                    card.css("[class*='bid']") or
                    card.css("[class*='Bid']")
                )
                bids_text = bids_el.first.text.strip() if bids_el else ""
                num_bids = parse_bids(bids_text)

                # Listing URL
                link_el = card.css("a[href]")
                href = link_el.first.attrib.get("href", "") if link_el else ""
                if href.startswith("/"):
                    full_url = f"https://auctions.yahoo.co.jp{href}"
                elif href.startswith("http"):
                    full_url = href
                else:
                    full_url = ""

                # End time (look for time-related elements)
                end_el = (
                    card.css("[class*='end']") or
                    card.css("[class*='time']") or
                    card.css("time")
                )
                end_text = end_el.first.text.strip() if end_el else ""

                # Motivation analysis
                is_buy_it_now = num_bids == 0
                ends_soon = any(s in end_text for s in ["残り", "時間", "分", "秒"]) and any(
                    c.isdigit() for c in end_text[:10]
                )
                # "motivated" = BIN price (no bids) + ending soon
                motivation_score = 50
                if is_buy_it_now:
                    motivation_score += 20  # Fixed price, no competition
                if ends_soon:
                    motivation_score += 20  # Ending soon = pressure to sell
                # Long listing with no bids = even more motivated
                if is_buy_it_now and "日" in end_text:
                    motivation_score += 10

                results.append({
                    "ref_number": ref,
                    "title": title[:200] if title else None,
                    "price_jpy": price_jpy,
                    "price_usd": price_usd,
                    "num_bids": num_bids,
                    "is_buy_it_now": is_buy_it_now,
                    "end_time_text": end_text[:100] if end_text else None,
                    "ends_soon": ends_soon,
                    "url": full_url[:500] if full_url else None,
                    "motivation_score": min(100, motivation_score),
                })

            except Exception as e:
                continue

        time.sleep(1.5)

    except Exception as e:
        print(f"  ❌ Scrape failed: {e}")

    return results


def save_to_market_comps(results: list[dict], jpy_to_usd: float) -> int:
    """Save Yahoo Japan results to market_comps table."""
    if not results:
        return 0

    now = datetime.now(timezone.utc).isoformat()
    saved = 0

    for r in results:
        try:
            record = {
                "ref_number": r["ref_number"],
                "source": "yahoo_japan",
                "price": str(round(r["price_usd"], 2)),
                "currency": "USD",
                "price_local": r["price_jpy"],
                "currency_local": "JPY",
                "market_code": "JP",
                "raw_title": r.get("title"),
                "listing_url": r.get("url"),
                "seller_score": r.get("motivation_score", 50),
                "scraped_at": now,
            }
            sb.table("market_comps").insert(record).execute()
            saved += 1
        except Exception:
            # Minimal insert fallback
            try:
                sb.table("market_comps").insert({
                    "ref_number": r["ref_number"],
                    "source": "yahoo_japan",
                    "price": str(round(r["price_usd"], 2)),
                    "currency": "USD",
                    "scraped_at": now,
                }).execute()
                saved += 1
            except Exception:
                pass

    return saved


def print_summary(ref: str, results: list[dict]):
    """Print Yahoo Japan results summary."""
    if not results:
        print(f"\n  No results found for {ref} on Yahoo Japan")
        return

    sorted_results = sorted(results, key=lambda x: x["price_usd"])
    bin_results = [r for r in results if r["is_buy_it_now"]]
    auction_results = [r for r in results if not r["is_buy_it_now"]]

    print(f"\n{'='*60}")
    print(f"  YAHOO JAPAN: {ref}")
    print(f"{'='*60}")
    print(f"  Total listings: {len(results)}")
    print(f"  Buy It Now (fixed): {len(bin_results)}")
    print(f"  Auctions (bids):    {len(auction_results)}")

    if sorted_results:
        cheapest = sorted_results[0]
        print(f"\n  Cheapest:  ¥{cheapest['price_jpy']:,.0f} (≈ ${cheapest['price_usd']:,.0f} USD)")
        if len(sorted_results) > 1:
            avg_usd = sum(r["price_usd"] for r in results) / len(results)
            print(f"  Average:   ≈ ${avg_usd:,.0f} USD")

    # Top 5 Buy It Now listings (best targets for negotiation)
    if bin_results:
        top_bin = sorted(bin_results, key=lambda x: x["price_usd"])[:5]
        print(f"\n  TOP BUY IT NOW TARGETS (fixed price = negotiable):")
        for i, r in enumerate(top_bin):
            motivation_label = "🔥 Very motivated" if r["motivation_score"] >= 80 else "⚡ Motivated" if r["motivation_score"] >= 60 else "💤 Standard"
            print(f"  {i+1}. ¥{r['price_jpy']:,.0f} ≈ ${r['price_usd']:,.0f}  {motivation_label}")
            if r.get("title"):
                print(f"     {r['title'][:80]}")
            if r.get("url"):
                print(f"     {r['url'][:80]}")


def main():
    parser = argparse.ArgumentParser(description="OpenWatch Yahoo Auctions Japan Scraper")
    parser.add_argument("--ref", required=True, help="Reference number, e.g. 126610LN or 5711")
    parser.add_argument("--no-save", action="store_true", help="Print only, don't save to DB")
    args = parser.parse_args()

    print(f"\n🇯🇵 OpenWatch — Yahoo Auctions Japan")
    print(f"   Ref: {args.ref}")

    print("\n💱 Fetching live JPY rate...")
    jpy_to_usd = get_jpy_to_usd()
    print(f"  1 JPY = ${jpy_to_usd:.6f} USD")

    results = scrape_yahoo_japan(args.ref, jpy_to_usd)

    print_summary(args.ref, results)

    if not args.no_save and results:
        saved = save_to_market_comps(results, jpy_to_usd)
        print(f"\n✅ Saved {saved}/{len(results)} listings to market_comps (source=yahoo_japan, market_code=JP)")
    elif not results:
        print(f"\n  ℹ️  No data to save")
    else:
        print(f"\n  ℹ️  --no-save flag set, skipped DB write")


if __name__ == "__main__":
    main()
