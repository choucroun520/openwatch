#!/usr/bin/env python3
"""Test Scrapling on Chrono24 — trying different fetch modes."""
from scrapling.fetchers import StealthyFetcher, DynamicFetcher
import re

# Test with a Chrono24 search URL (more reliable than dealer pages)
test_url = "https://www.chrono24.com/search/index.htm?dosearch=true&query=rolex+submariner&p=1&pageSize=10"

print("=== Test 1: StealthyFetcher (headless=False) ===")
try:
    page = StealthyFetcher.fetch(test_url, headless=False, timeout=45000, block_images=True)
    print(f"URL: {page.url}")
    print(f"Length: {len(page.html_content):,}")
    cards = page.css('[class*="js-article-item-container"]')
    print(f"Cards found: {len(cards)}")
    if cards:
        first = cards[0]
        link = first.css('a[href*="--id"]')
        if link:
            print(f"First listing href: {link.first.attrib.get('href','')[:80]}")
except Exception as e:
    print(f"Error: {e}")

print("\n=== Test 2: StealthyFetcher (headless=True, no network_idle) ===")
try:
    page2 = StealthyFetcher.fetch(test_url, headless=True, timeout=45000, block_images=True)
    print(f"URL: {page2.url}")
    print(f"Length: {len(page2.html_content):,}")
    cards2 = page2.css('[class*="js-article-item-container"]')
    print(f"Cards found: {len(cards2)}")
    # Check for numResult
    m = re.search(r'"numResult":\s*(\d+)', page2.html_content)
    print(f"numResult: {m.group(1) if m else 'not found'}")
except Exception as e:
    print(f"Error: {e}")
