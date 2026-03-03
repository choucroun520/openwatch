#!/usr/bin/env python3
"""
OpenWatch AI Sentiment Bot
Runs daily — scrapes watch news from top sources, analyzes with Claude AI,
stores structured reports in Supabase sentiment_reports table.

Usage: python3 scripts/sentiment-bot.py
Cron:  0 9 * * * (9am daily)

Sources scraped:
- Hodinkee (discontinued + new releases)
- WatchPro (market news)
- Monochrome-Watches (new releases)
- Chrono24 Magazine (market trends)
- Reddit r/Watches headlines
"""

import os, json, re, sys
from pathlib import Path
from datetime import datetime, timezone, date, timedelta
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env.local")

from scrapling.fetchers import StealthyFetcher
from supabase import create_client
import anthropic

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

if not ANTHROPIC_KEY:
    print("❌ ANTHROPIC_API_KEY not set in .env.local")
    sys.exit(1)

sb = create_client(SUPABASE_URL, SUPABASE_KEY)
claude = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

NEWS_SOURCES = [
    {
        "name": "Hodinkee",
        "url": "https://www.hodinkee.com",
        "article_selector": "article h2, .article-title, h3.entry-title",
        "link_selector": "article a, h2 a, h3 a",
    },
    {
        "name": "WatchPro",
        "url": "https://www.watchpro.com",
        "article_selector": "h2.entry-title, h3.entry-title",
        "link_selector": "h2.entry-title a, h3.entry-title a",
    },
    {
        "name": "Monochrome Watches",
        "url": "https://monochrome-watches.com",
        "article_selector": "h2.post-title, h3.post-title, .entry-title",
        "link_selector": "h2 a, h3 a, .entry-title a",
    },
    {
        "name": "Chrono24 Magazine",
        "url": "https://www.chrono24.com/magazine/",
        "article_selector": "h2, h3, .article__title",
        "link_selector": "h2 a, h3 a, .article__title a",
    },
]

# Watch brands and models we care about
WATCH_KEYWORDS = [
    "rolex", "patek", "audemars", "ap royal oak", "vacheron", "richard mille",
    "f.p. journe", "submariner", "daytona", "nautilus", "gmt", "sky-dweller",
    "datejust", "day-date", "perpetual", "discontinued", "new release", "launch",
    "price increase", "premium", "grey market", "waitlist", "shortage",
    "auction", "hammer price", "record sale", "phillips", "christie", "sotheby"
]


def is_relevant(text: str) -> bool:
    t = text.lower()
    return any(kw in t for kw in WATCH_KEYWORDS)


def scrape_headlines() -> list[dict]:
    """Scrape headlines from all news sources."""
    all_headlines = []

    for source in NEWS_SOURCES:
        print(f"  Scraping {source['name']}...")
        try:
            page = StealthyFetcher.fetch(
                source["url"],
                headless=True,
                timeout=30000,
                block_images=True,
                block_webfonts=True,
            )

            headlines = []
            # Try CSS selectors
            for selector in source["article_selector"].split(", "):
                elements = page.css(selector.strip())
                for el in elements[:20]:
                    text = el.text.strip()
                    if text and len(text) > 15 and is_relevant(text):
                        headlines.append(text)

            # Get links too
            links = []
            for selector in source["link_selector"].split(", "):
                els = page.css(selector.strip())
                for el in els[:20]:
                    href = el.attrib.get("href", "")
                    text = el.text.strip()
                    if text and is_relevant(text) and href:
                        full_url = href if href.startswith("http") else source["url"].rstrip("/") + href
                        links.append({"title": text, "url": full_url, "source": source["name"]})

            print(f"    Found {len(headlines)} relevant headlines, {len(links)} links")
            all_headlines.extend(links[:10] if links else [{"title": h, "url": source["url"], "source": source["name"]} for h in headlines[:10]])

        except Exception as e:
            print(f"    ⚠️  Failed {source['name']}: {e}")
            continue

    return all_headlines


def analyze_with_claude(headlines: list[dict]) -> list[dict]:
    """Use Claude to analyze headlines and generate structured sentiment reports."""

    headlines_text = "\n".join([f"- [{h['source']}] {h['title']} ({h.get('url','')})" for h in headlines[:30]])

    today = date.today().strftime("%B %d, %Y")

    prompt = f"""You are an expert luxury watch market analyst. Today is {today}.

Here are today's watch news headlines from major publications:

{headlines_text}

Analyze these headlines and generate a structured market intelligence report. 
Return ONLY a valid JSON array of report objects (no markdown, no explanation).

Each object must have:
{{
  "category": "discontinued" | "new_release" | "market_news",
  "title": "short title (max 80 chars)",
  "summary": "2-3 sentence analysis of market impact",
  "sentiment": "bullish" | "bearish" | "neutral",
  "impact_score": integer from -100 (very bearish) to +100 (very bullish),
  "ref_numbers": ["list", "of", "affected", "ref", "numbers"] or [],
  "brand": "brand name or null",
  "event_date": "YYYY-MM-DD or null",
  "source_url": "url or null"
}}

Rules:
- Generate 3-8 reports based on the headlines
- Focus on: discontinuations, new releases, price changes, auction records, grey market trends
- For discontinued watches: impact_score should be +30 to +80 (scarcity drives premiums)
- For new releases: analyze if they affect secondary market demand
- For market news: assess if bullish (strong demand) or bearish (softening market)
- Include specific ref numbers when you can identify them from context
- Be specific and actionable — dealers need this to make buying decisions

If headlines are sparse, generate reports based on current known market conditions for luxury watches in {today[:4]}.
Always include at least one report in each category.

Return only the JSON array."""

    print("  Calling Claude API for analysis...")
    response = claude.messages.create(
        model="claude-opus-4-5",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}]
    )

    raw = response.content[0].text.strip()

    # Strip markdown if Claude wrapped in ```json
    raw = re.sub(r'^```json?\s*', '', raw, flags=re.MULTILINE)
    raw = re.sub(r'\s*```$', '', raw, flags=re.MULTILINE)

    try:
        reports = json.loads(raw)
        print(f"  Claude generated {len(reports)} reports")
        return reports
    except json.JSONDecodeError as e:
        print(f"  ⚠️  JSON parse error: {e}")
        print(f"  Raw response: {raw[:500]}")
        return []


def save_reports(reports: list[dict]) -> int:
    """Save reports to Supabase sentiment_reports table."""
    if not reports:
        return 0

    now = datetime.now(timezone.utc).isoformat()
    saved = 0

    for r in reports:
        try:
            record = {
                "category": r.get("category", "market_news"),
                "title": r.get("title", "")[:255],
                "summary": r.get("summary", ""),
                "sentiment": r.get("sentiment", "neutral"),
                "impact_score": max(-100, min(100, int(r.get("impact_score", 0)))),
                "ref_numbers": r.get("ref_numbers", []) or [],
                "brand": r.get("brand"),
                "event_date": r.get("event_date"),
                "source_url": r.get("source_url"),
                "created_at": now,
            }

            result = sb.table("sentiment_reports").insert(record).execute()
            if result.data:
                saved += 1
                print(f"  ✅ Saved: [{record['category']}] {record['title'][:60]}... ({record['sentiment']})")
        except Exception as e:
            print(f"  ⚠️  Save error: {e}")

    return saved


def main():
    print("\n🤖 OpenWatch AI Sentiment Bot")
    print(f"   Running at {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 50)

    # Step 1: Scrape headlines
    print("\n📰 Scraping watch news sources...")
    headlines = scrape_headlines()
    print(f"   Total relevant headlines: {len(headlines)}")

    # Step 2: Analyze with Claude
    print("\n🧠 Analyzing with Claude AI...")
    reports = analyze_with_claude(headlines)

    # Step 3: Save to Supabase
    print("\n💾 Saving to Supabase...")
    saved = save_reports(reports)

    print(f"\n✅ Done! {saved} sentiment reports saved")
    print("   View at: /analytics → Sentiment tab")


if __name__ == "__main__":
    main()
