import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export interface DataSource {
  id: string
  name: string
  category: "asking" | "confirmed_sales" | "auction" | "dealer_api"
  market: string
  currency: string
  flag: string
  status: "active" | "needs_key" | "inactive" | "error"
  listing_count: number
  last_sync: string | null
  last_sync_ago: string | null
  requires_key: string | null   // e.g. "EBAY_API_KEY"
  has_key: boolean
  notes: string | null
  run_cmd: string | null
}

function timeAgo(iso: string | null): string | null {
  if (!iso) return null
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return `${Math.floor(secs / 86400)}d ago`
}

const SOURCE_DEFS: Omit<DataSource, "listing_count" | "last_sync" | "last_sync_ago" | "status" | "has_key">[] = [
  // ── Asking prices ──────────────────────────────────────────────────────────
  {
    id: "chrono24_us",
    name: "Chrono24 US",
    category: "asking",
    market: "United States",
    currency: "USD",
    flag: "🇺🇸",
    requires_key: null,
    notes: "Largest watch marketplace globally",
    run_cmd: "python3 scripts/scrape-global-markets.py --ref 126610LN --markets US",
  },
  {
    id: "chrono24_de",
    name: "Chrono24 Germany",
    category: "asking",
    market: "Germany",
    currency: "EUR",
    flag: "🇩🇪",
    requires_key: null,
    notes: "Largest EU market — best arbitrage source",
    run_cmd: "python3 scripts/scrape-global-markets.py --markets DE",
  },
  {
    id: "chrono24_uk",
    name: "Chrono24 UK",
    category: "asking",
    market: "United Kingdom",
    currency: "GBP",
    flag: "🇬🇧",
    requires_key: null,
    notes: "Post-Brexit pricing opportunities",
    run_cmd: "python3 scripts/scrape-global-markets.py --markets UK",
  },
  {
    id: "chrono24_jp",
    name: "Chrono24 Japan",
    category: "asking",
    market: "Japan",
    currency: "JPY",
    flag: "🇯🇵",
    requires_key: null,
    notes: "Often 10-20% cheaper than US",
    run_cmd: "python3 scripts/scrape-global-markets.py --markets JP",
  },
  {
    id: "chrono24_ch",
    name: "Chrono24 Switzerland",
    category: "asking",
    market: "Switzerland",
    currency: "CHF",
    flag: "🇨🇭",
    requires_key: null,
    notes: "Close to manufacturer pricing",
    run_cmd: "python3 scripts/scrape-global-markets.py --markets CH",
  },
  {
    id: "chrono24_hk",
    name: "Chrono24 Hong Kong",
    category: "asking",
    market: "Hong Kong",
    currency: "HKD",
    flag: "🇭🇰",
    requires_key: null,
    notes: "Key Asian trading hub",
    run_cmd: "python3 scripts/scrape-global-markets.py --markets HK",
  },
  {
    id: "chrono24_sg",
    name: "Chrono24 Singapore",
    category: "asking",
    market: "Singapore",
    currency: "SGD",
    flag: "🇸🇬",
    requires_key: null,
    notes: "Southeast Asia hub",
    run_cmd: "python3 scripts/scrape-global-markets.py --markets SG",
  },
  {
    id: "chrono24_ae",
    name: "Chrono24 Dubai",
    category: "asking",
    market: "UAE",
    currency: "AED",
    flag: "🇦🇪",
    requires_key: null,
    notes: "Tax-free, luxury market",
    run_cmd: "python3 scripts/scrape-global-markets.py --markets AE",
  },
  {
    id: "watchbox",
    name: "WatchBox",
    category: "asking",
    market: "United States",
    currency: "USD",
    flag: "🇺🇸",
    requires_key: null,
    notes: "Premium US reseller — sets ceiling price",
    run_cmd: "python3 scripts/scrape-watchbox.py --ref 126610LN",
  },
  {
    id: "bobs_watches",
    name: "Bob's Watches",
    category: "asking",
    market: "United States",
    currency: "USD",
    flag: "🇺🇸",
    requires_key: null,
    notes: "Rolex specialist — strong benchmark",
    run_cmd: "python3 scripts/scrape-bobs-watches.py --ref 126610LN",
  },
  {
    id: "yahoo_japan",
    name: "Yahoo Auctions Japan",
    category: "asking",
    market: "Japan",
    currency: "JPY",
    flag: "🇯🇵",
    requires_key: null,
    notes: "Largest JP market — huge arbitrage potential",
    run_cmd: "python3 scripts/scrape-yahoo-japan.py --ref 126610LN",
  },
  // ── Dealer API ─────────────────────────────────────────────────────────────
  {
    id: "rccrown",
    name: "RC Crown (Live API)",
    category: "dealer_api",
    market: "United States",
    currency: "USD",
    flag: "👑",
    requires_key: null,
    notes: "Your primary dealer — live inventory sync",
    run_cmd: "node scripts/scrape-rccrown.mjs",
  },
  // ── Confirmed sales ────────────────────────────────────────────────────────
  {
    id: "ebay",
    name: "eBay Sold Listings",
    category: "confirmed_sales",
    market: "Global",
    currency: "USD",
    flag: "🌐",
    requires_key: "EBAY_CLIENT_ID",
    notes: "Largest confirmed sale volume — real transaction prices",
    run_cmd: "node scripts/scrape-ebay-api.mjs",
  },
  {
    id: "phillips",
    name: "Phillips Auctions",
    category: "auction",
    market: "Global",
    currency: "USD",
    flag: "🏛️",
    requires_key: null,
    notes: "#1 watch auction house — most authoritative hammer prices",
    run_cmd: "python3 scripts/scrape-phillips.py",
  },
  {
    id: "watchcharts",
    name: "WatchCharts API",
    category: "confirmed_sales",
    market: "Global",
    currency: "USD",
    flag: "📊",
    requires_key: "WATCHCHARTS_API_KEY",
    notes: "$99/mo — best aggregated confirmed sale data",
    run_cmd: null,
  },
  {
    id: "reddit",
    name: "Reddit r/WatchExchange",
    category: "confirmed_sales",
    market: "United States",
    currency: "USD",
    flag: "🔴",
    requires_key: "REDDIT_CLIENT_ID",
    notes: "Peer-to-peer SOLD posts — real transaction prices",
    run_cmd: null,
  },
]

export async function GET() {
  const supabase = await createClient()

  // Get per-source stats from market_comps
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [compsRes, salesRes, settingsRes] = await Promise.all([
    db.from("market_comps")
      .select("source, scraped_at")
      .order("scraped_at", { ascending: false }),

    db.from("market_sales")
      .select("source, created_at")
      .order("created_at", { ascending: false }),

    db.from("app_settings")
      .select("key, updated_at")
      .like("key", "%_API_KEY%"),
  ])

  // Build lookup: source → { count, last_sync }
  const statsMap: Record<string, { count: number; last_sync: string }> = {}

  for (const row of compsRes.data ?? []) {
    const src = (row.source as string).replace("chrono24_", "chrono24_")
    if (!statsMap[src]) statsMap[src] = { count: 0, last_sync: row.scraped_at }
    statsMap[src].count++
  }

  for (const row of salesRes.data ?? []) {
    const src = row.source as string
    if (!statsMap[src]) statsMap[src] = { count: 0, last_sync: row.created_at }
    statsMap[src].count++
    if (row.created_at > statsMap[src].last_sync) statsMap[src].last_sync = row.created_at
  }

  // Keys that have been set
  const setKeys = new Set<string>((settingsRes.data ?? []).map((r: { key: string }) => r.key))

  // Check env vars too
  const envKeys = [
    "EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET",
    "WATCHCHARTS_API_KEY",
    "REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET",
    "OPENAI_API_KEY", "ANTHROPIC_API_KEY",
  ]
  for (const k of envKeys) {
    if (process.env[k]) setKeys.add(k)
  }

  const sources: DataSource[] = SOURCE_DEFS.map((def) => {
    // Match stats — chrono24 is stored as just "chrono24" in current DB
    const stats = statsMap[def.id] ?? statsMap["chrono24"] ?? null
    const hasKey = def.requires_key ? setKeys.has(def.requires_key) : true

    let status: DataSource["status"] = "inactive"
    if (def.requires_key && !hasKey) {
      status = "needs_key"
    } else if (stats && stats.count > 0) {
      const hoursOld = (Date.now() - new Date(stats.last_sync).getTime()) / 3600000
      status = hoursOld < 48 ? "active" : "inactive"
    } else if (!def.requires_key) {
      status = "inactive" // ready to run, just hasn't been run yet
    }

    // RC Crown is always active if we have listings
    if (def.id === "rccrown") {
      status = "active"
    }

    return {
      ...def,
      listing_count: def.id.startsWith("chrono24") ? (statsMap["chrono24"]?.count ?? 0) : (stats?.count ?? 0),
      last_sync: stats?.last_sync ?? null,
      last_sync_ago: timeAgo(stats?.last_sync ?? null),
      status,
      has_key: hasKey,
    }
  })

  return NextResponse.json({ sources })
}
