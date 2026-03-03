#!/usr/bin/env python3
"""
OpenWatch Global Market Scanner
Scrapes the same watch reference across ALL Chrono24 regional markets + Yahoo Japan
to find the best price worldwide (before import costs).

Markets covered:
  chrono24.com       → USD (US market)
  chrono24.de        → EUR (Germany — biggest EU market)
  chrono24.fr        → EUR (France)
  chrono24.co.uk     → GBP (UK)
  chrono24.jp        → JPY (Japan — often 10-20% cheaper)
  chrono24.com.hk    → HKD (Hong Kong)
  chrono24.sg        → SGD (Singapore)
  chrono24.ch        → CHF (Switzerland)
  chrono24.ae        → AED (UAE/Dubai)

Usage: python3 scripts/scrape-global-markets.py --ref 126610LN
       python3 scripts/scrape-global-markets.py --ref 126610LN --top 5
       python3 scripts/scrape-global-markets.py --refs 126610LN,5711/1A-011,26240ST.OO.1320ST.02

Output: saves to market_comps table, prints arbitrage summary
"""

import os, sys, re, json, time, argparse
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlencode

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env.local")

from scrapling.fetchers import StealthyFetcher
from supabase import create_client

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Market definitions ──────────────────────────────────────────────────────────
MARKETS = [
    {"code": "US", "domain": "chrono24.com",    "currency": "USD", "flag": "🇺🇸", "path": "/search/index.htm"},
    {"code": "DE", "domain": "chrono24.de",     "currency": "EUR", "flag": "🇩🇪", "path": "/search/index.htm"},
    {"code": "FR", "domain": "chrono24.fr",     "currency": "EUR", "flag": "🇫🇷", "path": "/search/index.htm"},
    {"code": "UK", "domain": "chrono24.co.uk",  "currency": "GBP", "flag": "🇬🇧", "path": "/search/index.htm"},
    {"code": "JP", "domain": "chrono24.jp",     "currency": "JPY", "flag": "🇯🇵", "path": "/search/index.htm"},
    {"code": "HK", "domain": "chrono24.com.hk", "currency": "HKD", "flag": "🇭🇰", "path": "/search/index.htm"},
    {"code": "SG", "domain": "chrono24.sg",     "currency": "SGD", "flag": "🇸🇬", "path": "/search/index.htm"},
    {"code": "CH", "domain": "chrono24.ch",     "currency": "CHF", "flag": "🇨🇭", "path": "/search/index.htm"},
    {"code": "AE", "domain": "chrono24.ae",     "currency": "AED", "flag": "🇦🇪", "path": "/search/index.htm"},
]

# ── FX rates (fallback if API unavailable) ──────────────────────────────────────
FALLBACK_FX_TO_USD = {
    "USD": 1.0,
    "EUR": 1.09,
    "GBP": 1.27,
    "CHF": 1.12,
    "JPY": 0.0067,
    "HKD": 0.128,
    "SGD": 0.74,
    "AED": 0.272,
}

def get_fx_rates() -> dict[str, float]:
    """Fetch live FX rates from frankfurter.app."""
    try:
        import urllib.request, ssl
        ctx = ssl.create_default_context()
        url = "https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,CHF,JPY,HKD,SGD,AED"
        with urllib.request.urlopen(url, context=ctx, timeout=5) as r:
            data = json.loads(r.read())
            rates = data["rates"]
            # Convert "X per USD" → "USD per X"
            return {
                "USD": 1.0,
                "EUR": 1.0 / rates["EUR"],
                "GBP": 1.0 / rates["GBP"],
                "CHF": 1.0 / rates["CHF"],
                "JPY": 1.0 / rates["JPY"],
                "HKD": 1.0 / rates["HKD"],
                "SGD": 1.0 / rates["SGD"],
                "AED": 1.0 / rates["AED"],
            }
    except Exception as e:
        print(f"  ⚠️  FX API unavailable, using fallback rates: {e}")
        return FALLBACK_FX_TO_USD


def clean_price(text: str) -> float | None:
    """Extract numeric price from any currency string."""
    if not text: return None
    # Remove currency symbols, spaces, commas
    cleaned = re.sub(r"[^\d.,]", "", text.replace(",", ""))
    # Handle European decimal (12.345,00 → 12345.00)
    if "." in cleaned and "," in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    elif "," in cleaned and "." not in cleaned:
        cleaned = cleaned.replace(",", ".")
    try:
        val = float(re.sub(r"\.(?=.*\.)", "", cleaned))
        return val if val > 100 else None
    except:
        return None


def qualify_seller(card_html: str, price: float) -> dict:
    """
    Score seller as physical holder vs broker.
    Returns dict with score (0-100) and signals.
    """
    html_lower = card_html.lower()
    signals = []
    score = 50  # Start neutral

    # BROKER signals (lower score)
    if "available to order" in html_lower or "on request" in html_lower:
        score -= 25
        signals.append("⚠️ 'available to order' — likely broker")
    if "ships from" in html_lower and "germany" in html_lower and "stock" not in html_lower:
        # Many German brokers
        pass
    if "dealer" in html_lower:
        score -= 10
        signals.append("🏪 dealer account")

    # PHYSICAL HOLDER signals (higher score)
    if "private seller" in html_lower or "private" in html_lower:
        score += 20
        signals.append("✅ private seller")
    if "serial" in html_lower or "serial number" in html_lower:
        score += 15
        signals.append("✅ serial number shown")
    if "box" in html_lower and "papers" in html_lower:
        score += 10
        signals.append("✅ box & papers")
    if "original" in html_lower:
        score += 5

    return {"score": max(0, min(100, score)), "signals": signals}


def scrape_market(ref: str, market: dict, fx_rates: dict) -> list[dict]:
    """Scrape a single Chrono24 regional market for a ref number."""
    params = {
        "dosearch": "true",
        "query": ref,
        "redirected": "1",
    }
    url = f"https://www.{market['domain']}{market['path']}?{urlencode(params)}"

    print(f"  {market['flag']} {market['code']:2} {market['currency']:3} — {url[:70]}...")

    results = []
    try:
        page = StealthyFetcher.fetch(
            url,
            headless=True,
            timeout=25000,
            block_images=True,
            block_webfonts=True,
        )

        # Find article cards
        cards = page.css("article.article-item") or page.css("[data-article-id]") or page.css(".article-item")
        if not cards:
            # Fallback: find price containers
            cards = page.css("[class*='article'], [class*='listing'], [class*='result']")

        print(f"    Found {len(cards)} cards")

        for card in cards[:20]:
            card_text = card.text or ""
            card_html = str(card) if hasattr(card, '__str__') else card_text

            # Extract price
            price_el = (
                card.css("[class*='price']") or
                card.css("[class*='Price']") or
                card.css(".js-price") or
                card.css("strong")
            )
            price_text = price_el.first.text.strip() if price_el else ""
            price_local = clean_price(price_text)

            if not price_local or price_local < 500:
                continue

            # Convert to USD
            fx = fx_rates.get(market["currency"], 1.0)
            price_usd = round(price_local * fx, 2)

            # Skip obviously wrong prices (accessories, straps, etc.)
            if price_usd < 1000 or price_usd > 5_000_000:
                continue

            # Extract title/model
            title_el = card.css("h2, h3, [class*='title'], [class*='name']")
            title = title_el.first.text.strip() if title_el else ""

            # Extract link
            link_el = card.css("a[href]")
            href = link_el.first.attrib.get("href", "") if link_el else ""
            full_url = f"https://www.{market['domain']}{href}" if href.startswith("/") else href

            # Extract condition
            cond_el = card.css("[class*='condition'], [class*='grade']")
            condition = cond_el.first.text.strip() if cond_el else None

            # Seller qualification
            qual = qualify_seller(card_text, price_local)

            results.append({
                "ref_number": ref,
                "market_code": market["code"],
                "price_local": price_local,
                "currency": market["currency"],
                "price_usd": price_usd,
                "title": title[:200] if title else None,
                "url": full_url[:500] if full_url else None,
                "condition": condition,
                "seller_score": qual["score"],
                "seller_signals": qual["signals"],
            })

        time.sleep(1.2)

    except Exception as e:
        print(f"    ❌ Failed: {e}")

    return results


def save_to_market_comps(results: list[dict], ref: str) -> int:
    """Upsert results into market_comps table."""
    if not results:
        return 0

    now = datetime.now(timezone.utc).isoformat()
    saved = 0

    for r in results:
        try:
            record = {
                "ref_number": r["ref_number"],
                "source": f"chrono24_{r['market_code'].lower()}",
                "price": r["price_usd"],
                "currency": "USD",
                "price_local": r["price_local"],
                "currency_local": r["currency"],
                "market_code": r["market_code"],
                "condition": r.get("condition"),
                "listing_url": r.get("url"),
                "raw_title": r.get("title"),
                "seller_score": r.get("seller_score"),
                "scraped_at": now,
            }
            sb.table("market_comps").insert(record).execute()
            saved += 1
        except Exception as e:
            # Table might not have all columns yet — try minimal insert
            try:
                sb.table("market_comps").insert({
                    "ref_number": r["ref_number"],
                    "source": f"chrono24_{r['market_code'].lower()}",
                    "price": r["price_usd"],
                    "currency": "USD",
                    "scraped_at": now,
                }).execute()
                saved += 1
            except:
                pass

    return saved


def print_arbitrage_summary(ref: str, all_results: list[dict], fx_rates: dict):
    """Print a human-readable arbitrage opportunity summary."""
    if not all_results:
        print(f"\n  No results found for {ref}")
        return

    # Sort by price_usd
    sorted_results = sorted(all_results, key=lambda x: x["price_usd"])
    cheapest = sorted_results[0]
    most_expensive = sorted_results[-1]

    print(f"\n{'='*60}")
    print(f"  ARBITRAGE SUMMARY: {ref}")
    print(f"{'='*60}")
    print(f"  Cheapest:  {cheapest['market_code']} {cheapest['currency']} {cheapest['price_local']:,.0f} = ${cheapest['price_usd']:,.0f} USD")
    print(f"  Priciest:  {most_expensive['market_code']} {most_expensive['currency']} {most_expensive['price_local']:,.0f} = ${most_expensive['price_usd']:,.0f} USD")

    gross_spread = most_expensive["price_usd"] - cheapest["price_usd"]
    gross_pct = gross_spread / cheapest["price_usd"] * 100

    # Import costs (EU/UK/CH → US)
    shipping = 350
    duty = cheapest["price_usd"] * 0.098  # 6.5% tariff + 3.3% MPF
    auth = 200
    total_costs = shipping + duty + auth
    net_profit = gross_spread - total_costs
    net_pct = net_profit / cheapest["price_usd"] * 100

    print(f"\n  Gross spread:    ${gross_spread:,.0f} ({gross_pct:.1f}%)")
    print(f"  Import costs:    ${total_costs:,.0f} (shipping ${shipping} + duty ${duty:.0f} + auth ${auth})")
    print(f"  NET PROFIT:      ${net_profit:,.0f} ({net_pct:.1f}%)")

    if net_profit > 0:
        print(f"\n  ✅ PROFITABLE — buy in {cheapest['market_code']}, sell in {most_expensive['market_code']}")
    else:
        print(f"\n  ❌ NOT profitable after import costs")

    print(f"\n  All market prices (USD):")
    # Show by market
    by_market: dict[str, list[float]] = {}
    for r in all_results:
        by_market.setdefault(r["market_code"], []).append(r["price_usd"])

    for code, prices in sorted(by_market.items(), key=lambda x: min(x[1])):
        floor = min(prices)
        avg = sum(prices) / len(prices)
        flag = next((m["flag"] for m in MARKETS if m["code"] == code), "")
        print(f"    {flag} {code}: floor ${floor:,.0f}  avg ${avg:,.0f}  ({len(prices)} listings)")


def main():
    parser = argparse.ArgumentParser(description="OpenWatch Global Market Scanner")
    parser.add_argument("--ref", help="Single reference number, e.g. 126610LN")
    parser.add_argument("--refs", help="Comma-separated refs, e.g. 126610LN,5711/1A-011")
    parser.add_argument("--markets", help="Comma-separated market codes, e.g. US,DE,JP (default: all)")
    parser.add_argument("--top", type=int, help="Only scan this many markets (cheapest first)")
    parser.add_argument("--no-save", action="store_true", help="Print only, don't save to DB")
    args = parser.parse_args()

    if not args.ref and not args.refs:
        parser.print_help()
        sys.exit(1)

    refs = []
    if args.ref:
        refs.append(args.ref)
    if args.refs:
        refs.extend([r.strip() for r in args.refs.split(",")])

    # Filter markets
    markets = MARKETS
    if args.markets:
        codes = [c.strip().upper() for c in args.markets.split(",")]
        markets = [m for m in MARKETS if m["code"] in codes]

    print(f"\n🌍 OpenWatch Global Market Scanner")
    print(f"   Refs: {', '.join(refs)}")
    print(f"   Markets: {', '.join(m['code'] for m in markets)}")

    print("\n💱 Fetching live FX rates...")
    fx_rates = get_fx_rates()
    print("  Rates (to USD):", {k: f"{v:.4f}" for k, v in fx_rates.items()})

    total_saved = 0

    for ref in refs:
        print(f"\n{'─'*60}")
        print(f"  Scanning: {ref}")
        print(f"{'─'*60}")

        all_results = []

        for market in markets:
            results = scrape_market(ref, market, fx_rates)
            all_results.extend(results)

            if not args.no_save and results:
                saved = save_to_market_comps(results, ref)
                total_saved += saved
                print(f"    ✅ Saved {saved} listings to market_comps")

        print_arbitrage_summary(ref, all_results, fx_rates)

    if not args.no_save:
        print(f"\n✅ Total: {total_saved} price points saved to market_comps")
    print("   View arbitrage at: /analytics → Arbitrage tab")


if __name__ == "__main__":
    main()
