"use client"

import { useState, useEffect } from "react"
import AppLayout from "@/components/layout/app-layout"
import Link from "next/link"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
  CartesianGrid,
} from "recharts"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  RefreshCw,
  Flame,
  DollarSign,
  ArrowUpDown,
  BarChart2,
  AlertTriangle,
  Package,
  Zap,
  Tag,
  Brain,
  Globe,
} from "lucide-react"
import { formatCurrency, formatCompact } from "@/lib/utils/currency"
import { shortTimeAgo } from "@/lib/utils/dates"
import { Sparkline } from "@/components/charts/sparkline"
import ListingCard from "@/components/network/listing-card"
import type { ListingWithRelations } from "@/lib/types"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrandStat {
  brand: string
  total_listings: number
  refs_count: number
  floor_price: number
  avg_price: number
  ceiling_price: number
  price_range: number
  change_30d: number
  heat_score: number
}

interface TopRef {
  ref_number: string
  brand: string
  model: string | null
  floor: number
  avg: number
  ceiling: number
  listings: number
  spread: number
  spread_pct: number
  change_30d: number
  heat_score: number
  msrp: number | null
  grey_market_premium_pct: number | null
  sparkline_data?: number[]
}

interface Deal {
  ref_number: string
  brand: string
  model: string | null
  price: number
  ref_avg: number
  discount_pct: number
  listing_url: string | null
  source: string
  scraped_at: string
}

interface PriceDist {
  brand: string
  bucket: string
  count: number
}

interface SupplyItem {
  ref_number: string
  brand: string
  count: number
}

interface SummaryData {
  overview: {
    total_listings: number
    refs_tracked: number
    brands_covered: number
    last_updated: string | null
    data_freshness_hours: number
  }
  brands: BrandStat[]
  top_refs: TopRef[]
  deals: Deal[]
  price_distribution: PriceDist[]
  supply_by_ref: SupplyItem[]
}

interface SentimentReport {
  id: string
  category: "discontinued" | "new_release" | "market_news"
  title: string
  summary: string
  sentiment: "bullish" | "bearish" | "neutral"
  impact_score: number
  ref_numbers: string[]
  brand: string | null
  event_date: string | null
  source_url: string | null
  created_at: string
}

interface ArbitrageOpportunity {
  ref_number: string
  brand: string
  model_name: string | null
  buy_market: string
  buy_price_local: number
  buy_currency: string
  buy_price_usd: number
  sell_market: string
  sell_price_usd: number
  gross_spread_pct: number
  import_costs_usd: number
  net_profit_usd: number
  net_profit_pct: number
  buy_listing_count: number
  sell_listing_count: number
  last_updated: string
}

interface TrendRef {
  ref_number: string
  brand: string
  model_name: string | null
  current_price: number
  momentum_7d: number
  momentum_30d: number
  momentum_90d: number
  trend_label: "surging" | "rising" | "stable" | "cooling" | "dropping"
  listing_count: number
  velocity_signal: number
}

interface FxRate {
  pair: string
  rate: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND_COLORS: Record<string, string> = {
  Rolex: "#10b981",
  "Patek Philippe": "#6366f1",
  "Audemars Piguet": "#f59e0b",
  "Vacheron Constantin": "#ec4899",
  "Richard Mille": "#ef4444",
  "F.P. Journe": "#8b5cf6",
}

const ALL_BRANDS = [
  "Rolex",
  "Patek Philippe",
  "Audemars Piguet",
  "Vacheron Constantin",
  "Richard Mille",
  "F.P. Journe",
]

const TARGET_BRANDS = ["Rolex", "Patek Philippe", "Audemars Piguet", "Vacheron Constantin"]

const BRAND_SLUGS: Record<string, string> = {
  Rolex: "rolex",
  "Patek Philippe": "patek-philippe",
  "Audemars Piguet": "audemars-piguet",
  "Vacheron Constantin": "vacheron-constantin",
  "Richard Mille": "richard-mille",
  "F.P. Journe": "fp-journe",
}

const PRICE_BUCKETS = ["$0-10K", "$10-25K", "$25-50K", "$50-100K", "$100K+"]

const MSRP_INFO: Record<string, { name: string; brand: string; msrp: number }> = {
  "126710BLRO": { name: "GMT-Master II Pepsi", brand: "Rolex", msrp: 10800 },
  "126710BLNR": { name: "GMT-Master II Batman", brand: "Rolex", msrp: 10800 },
  "126720VTNR": { name: "GMT-Master II Sprite", brand: "Rolex", msrp: 10800 },
  "126610LN": { name: "Submariner Date", brand: "Rolex", msrp: 9100 },
  "126610LV": { name: "Submariner Hulk", brand: "Rolex", msrp: 9100 },
  "126613LN": { name: "Submariner Two-Tone", brand: "Rolex", msrp: 12550 },
  "124060": { name: "Submariner No Date", brand: "Rolex", msrp: 8100 },
  "126234": { name: "Datejust 36", brand: "Rolex", msrp: 7150 },
  "126333": { name: "Datejust 41 Two-Tone", brand: "Rolex", msrp: 9750 },
  "126334": { name: "Datejust 41 Steel", brand: "Rolex", msrp: 8950 },
  "116500LN": { name: "Daytona Steel (prev)", brand: "Rolex", msrp: 14550 },
  "126500LN": { name: "Daytona Steel", brand: "Rolex", msrp: 14800 },
  "228395TBR": { name: "Day-Date 40 Meteorite", brand: "Rolex", msrp: 485350 },
  "5711/1A-011": { name: "Nautilus 5711", brand: "Patek Philippe", msrp: 31000 },
  "5712/1A-001": { name: "Nautilus Moonphase", brand: "Patek Philippe", msrp: 56900 },
  "5726/1A-014": { name: "Annual Calendar", brand: "Patek Philippe", msrp: 59500 },
  "15510ST.OO.1320ST.06": { name: "Royal Oak 41", brand: "Audemars Piguet", msrp: 22100 },
  "26240ST.OO.1320ST.02": { name: "Royal Oak Chrono", brand: "Audemars Piguet", msrp: 29900 },
  "4500V/110A-B128": { name: "Overseas 41", brand: "Vacheron Constantin", msrp: 22900 },
  // Rolex additional
  "126600": { name: "Sea-Dweller 43", brand: "Rolex", msrp: 11400 },
  "126660": { name: "Deepsea", brand: "Rolex", msrp: 13150 },
  "126655": { name: "Daytona Everose", brand: "Rolex", msrp: 28150 },
  "126715CHNR": { name: "GMT-Master II RootBeer", brand: "Rolex", msrp: 39650 },
  "126711CHNR": { name: "GMT-Master II RootBeer Steel", brand: "Rolex", msrp: 14550 },
  "228235": { name: "Day-Date 40 RG", brand: "Rolex", msrp: 46950 },
  "228238": { name: "Day-Date 40 YG", brand: "Rolex", msrp: 46450 },
  "228206": { name: "Day-Date 40 PT", brand: "Rolex", msrp: 52950 },
  "228396TBR": { name: "Day-Date 40 PT Diamonds", brand: "Rolex", msrp: 0 },
  "128235": { name: "Day-Date 36 RG", brand: "Rolex", msrp: 39100 },
  "336235": { name: "Day-Date 40 RG 2024", brand: "Rolex", msrp: 47550 },
  "336238": { name: "Day-Date 40 YG 2024", brand: "Rolex", msrp: 47050 },
  "336935": { name: "Day-Date 40 WG 2024", brand: "Rolex", msrp: 49750 },
  "336938": { name: "Day-Date 40 PT 2024", brand: "Rolex", msrp: 57950 },
  "126505": { name: "Day-Date 40 YG Oyster", brand: "Rolex", msrp: 46450 },
  "226627": { name: "Sky-Dweller Oysterflex", brand: "Rolex", msrp: 48650 },
  "326935": { name: "Sky-Dweller RG", brand: "Rolex", msrp: 54050 },
  "126334-0010": { name: "Datejust 41 TT", brand: "Rolex", msrp: 11650 },
  "126334-0022": { name: "Datejust 41 TT Blue", brand: "Rolex", msrp: 11650 },
  "126334-0028": { name: "Datejust 41 TT", brand: "Rolex", msrp: 11650 },
  "126333-oyster": { name: "Datejust 41 Two-Tone Oyster", brand: "Rolex", msrp: 9750 },
  "126610LN-0001": { name: "Submariner Date", brand: "Rolex", msrp: 9100 },
  "126610LV-0002": { name: "Submariner Hulk", brand: "Rolex", msrp: 9100 },
  "116610LN-0001": { name: "Submariner Date (prev)", brand: "Rolex", msrp: 0 },
  "16610LV": { name: "Submariner Kermit", brand: "Rolex", msrp: 0 },
  "126710BLRO-0001": { name: "GMT-Master II Pepsi", brand: "Rolex", msrp: 10800 },
  "126710BLNR-0002": { name: "GMT-Master II Batman", brand: "Rolex", msrp: 10800 },
  "126720VTNR-0001": { name: "GMT-Master II Sprite LH", brand: "Rolex", msrp: 10800 },
  "126720VTNR-0002": { name: "GMT-Master II Sprite", brand: "Rolex", msrp: 10800 },
  "116519LN-0038": { name: "Daytona WG Meteorite", brand: "Rolex", msrp: 0 },
  "126613LB-0002": { name: "Submariner TT Blue", brand: "Rolex", msrp: 12550 },
  // Patek Philippe additional
  "5711/1A-011-olive": { name: "Nautilus Olive Green", brand: "Patek Philippe", msrp: 31000 },
  "5711-1R-001": { name: "Nautilus 5711 Rose Gold", brand: "Patek Philippe", msrp: 0 },
  "5712R-001": { name: "Nautilus Moonphase RG", brand: "Patek Philippe", msrp: 0 },
  "5726A-001": { name: "Annual Calendar 5726", brand: "Patek Philippe", msrp: 59500 },
  "5740/1G-001": { name: "Perpetual Calendar Ultra-Thin", brand: "Patek Philippe", msrp: 0 },
  "5740-1G-001": { name: "Perpetual Calendar Ultra-Thin", brand: "Patek Philippe", msrp: 0 },
  "5968G-010": { name: "Aquanaut Chrono WG", brand: "Patek Philippe", msrp: 0 },
  "5980-1R-001": { name: "Aquanaut Chrono RG", brand: "Patek Philippe", msrp: 0 },
  "5269R-001": { name: "Aquanaut Travel Time RG", brand: "Patek Philippe", msrp: 0 },
  "5261R-001": { name: "Aquanaut Annual Cal RG", brand: "Patek Philippe", msrp: 0 },
  // Audemars Piguet additional
  "15510ST.OO.1320ST.07": { name: "Royal Oak 41 Black", brand: "Audemars Piguet", msrp: 22100 },
  "15510ST": { name: "Royal Oak 41", brand: "Audemars Piguet", msrp: 22100 },
  "15407ST.OO.1220ST.02": { name: "Royal Oak Skeleton 41", brand: "Audemars Piguet", msrp: 0 },
  "15407ST": { name: "Royal Oak Skeleton", brand: "Audemars Piguet", msrp: 0 },
  "15407OR.OO.1220OR.01": { name: "Royal Oak Skeleton RG", brand: "Audemars Piguet", msrp: 0 },
  "15407OR": { name: "Royal Oak Skeleton RG", brand: "Audemars Piguet", msrp: 0 },
  "26574BC.OO.1220BC.01": { name: "Royal Oak Perp Cal WG", brand: "Audemars Piguet", msrp: 0 },
  "26240ST-alt": { name: "Royal Oak Chrono 41", brand: "Audemars Piguet", msrp: 29900 },
  "26240ST": { name: "Royal Oak Chrono 41", brand: "Audemars Piguet", msrp: 29900 },
  "16202BC.OO.1240BC.02": { name: "Royal Oak Jumbo Extra-Thin WG", brand: "Audemars Piguet", msrp: 0 },
  "16204OR.OO.1240OR.01": { name: "Royal Oak Jumbo Extra-Thin RG", brand: "Audemars Piguet", msrp: 0 },
  // Vacheron Constantin additional
  "4200H-222J-B935": { name: "Historiques 222 YG", brand: "Vacheron Constantin", msrp: 0 },
  "4500V-110A-B128": { name: "Overseas 41 Steel", brand: "Vacheron Constantin", msrp: 22900 },
}

// ─── Helper components ─────────────────────────────────────────────────────────

function PriceChangeBadge({ change }: { change: number }) {
  if (change > 0.5)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-bold" style={{ color: "#22c55e" }}>
        <TrendingUp size={11} />+{change.toFixed(1)}%
      </span>
    )
  if (change < -0.5)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-bold" style={{ color: "#ef4444" }}>
        <TrendingDown size={11} />
        {change.toFixed(1)}%
      </span>
    )
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-bold" style={{ color: "#64748b" }}>
      <Minus size={11} />—
    </span>
  )
}

function HeatDot({ score }: { score: number }) {
  const color = score > 50 ? "#ef4444" : score > 20 ? "#eab308" : "#475569"
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold font-mono" style={{ color }}>
      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      {score.toFixed(1)}
    </span>
  )
}

function GreyMarketBadge({ pct }: { pct: number }) {
  if (pct < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold"
        style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>
        {pct.toFixed(0)}% below retail
      </span>
    )
  }
  if (pct <= 50) {
    return (
      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold"
        style={{ background: "rgba(234,179,8,0.12)", color: "#eab308" }}>
        +{pct.toFixed(0)}% above retail
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
      +{pct.toFixed(0)}% above retail
    </span>
  )
}

function SortHeader({
  field, label, sortField, sortDir, onSort, className = "",
}: {
  field: string
  label: string
  sortField: string
  sortDir: "asc" | "desc"
  onSort: (f: string) => void
  className?: string
}) {
  const active = sortField === field
  return (
    <button
      className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider hover:text-white transition-colors ${className}`}
      style={{ color: active ? "#e2e8f0" : "#64748b" }}
      onClick={() => onSort(field)}
    >
      {label}
      <ArrowUpDown size={9} style={{ opacity: active ? 1 : 0.4 }} />
      {active && (
        <span style={{ color: "#2081E2", fontSize: 9 }}>{sortDir === "desc" ? "↓" : "↑"}</span>
      )}
    </button>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DistributionTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border p-3 text-xs shadow-xl"
      style={{ background: "#1a1a2e", borderColor: "#1c1c2a", minWidth: 180 }}>
      <p className="font-bold text-white mb-2">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-4 mb-1">
          <span style={{ color: p.fill }}>{p.name}</span>
          <span className="font-mono font-bold text-white">{p.value} listings</span>
        </div>
      ))}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SupplyTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as SupplyItem
  if (!d) return null
  const info = MSRP_INFO[d.ref_number]
  return (
    <div className="rounded-lg border p-3 text-xs shadow-xl"
      style={{ background: "#1a1a2e", borderColor: "#1c1c2a" }}>
      <p className="font-mono font-bold text-white">{d.ref_number}</p>
      {info && <p className="text-[10px] mt-0.5" style={{ color: "#94a3b8" }}>{info.name}</p>}
      <p className="mt-0.5" style={{ color: BRAND_COLORS[d.brand] ?? "#94a3b8" }}>{d.brand}</p>
      <p className="font-bold text-white mt-1">{d.count} listings</p>
    </div>
  )
}

function SentimentBadge({ sentiment, lg = false }: { sentiment: "bullish" | "bearish" | "neutral"; lg?: boolean }) {
  const map = {
    bullish: { bg: "rgba(34,197,94,0.12)", color: "#22c55e", label: "BULLISH" },
    bearish: { bg: "rgba(239,68,68,0.12)", color: "#ef4444", label: "BEARISH" },
    neutral: { bg: "rgba(234,179,8,0.12)", color: "#eab308", label: "NEUTRAL" },
  }
  const c = map[sentiment]
  return (
    <span
      className={`inline-flex items-center rounded font-bold uppercase tracking-wider ${lg ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"}`}
      style={{ background: c.bg, color: c.color }}
    >
      {c.label}
    </span>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type MainTab = "market" | "sentiment" | "trending" | "deals" | "listings" | "arbitrage" | "trends"
type SortField = "heat_score" | "floor" | "avg" | "listings" | "spread"

const MAIN_TABS: MainTab[] = ["market", "sentiment", "trending", "deals", "listings", "arbitrage", "trends"]

const MARKET_FLAGS: Record<string, string> = {
  EU: "🇪🇺", CH: "🇨🇭", UK: "🇬🇧", SG: "🇸🇬", JP: "🇯🇵", US: "🇺🇸", DE: "🇩🇪", FR: "🇫🇷",
}

const FX_PAIRS = [
  { pair: "EUR/USD", code: "EUR" },
  { pair: "CHF/USD", code: "CHF" },
  { pair: "GBP/USD", code: "GBP" },
  { pair: "JPY/USD", code: "JPY" },
  { pair: "AED/USD", code: "AED" },
  { pair: "SGD/USD", code: "SGD" },
  { pair: "HKD/USD", code: "HKD" },
]

export default function AnalyticsPage() {
  // ── Core data state ──────────────────────────────────────────────────────────
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // ── Tab state ────────────────────────────────────────────────────────────────
  const [mainTab, setMainTab] = useState<MainTab>("market")
  const [activeBrandTab, setActiveBrandTab] = useState("All")
  const [sortField, setSortField] = useState<SortField>("heat_score")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  // ── Sentiment state ──────────────────────────────────────────────────────────
  const [sentimentData, setSentimentData] = useState<SentimentReport[] | null>(null)
  const [sentimentLoading, setSentimentLoading] = useState(false)
  const [sentimentError, setSentimentError] = useState<string | null>(null)
  const [sentimentRefreshing, setSentimentRefreshing] = useState(false)
  const [sentimentFetched, setSentimentFetched] = useState(false)

  // ── Listings state ───────────────────────────────────────────────────────────
  const [listings, setListings] = useState<ListingWithRelations[]>([])
  const [listingsLoading, setListingsLoading] = useState(false)
  const [listingsFetched, setListingsFetched] = useState(false)
  const [listingsBrand, setListingsBrand] = useState<string>("All")
  const [listingsSort, setListingsSort] = useState<"price-asc" | "price-desc" | "newest">("price-asc")

  // ── Arbitrage state ──────────────────────────────────────────────────────────
  const [arbData, setArbData] = useState<ArbitrageOpportunity[]>([])
  const [arbLoading, setArbLoading] = useState(false)
  const [arbFetched, setArbFetched] = useState(false)
  const [arbExplainerOpen, setArbExplainerOpen] = useState(false)

  // ── Trends state ─────────────────────────────────────────────────────────────
  const [trendsData, setTrendsData] = useState<TrendRef[]>([])
  const [trendsLoading, setTrendsLoading] = useState(false)
  const [trendsFetched, setTrendsFetched] = useState(false)

  // ── FX rates state ───────────────────────────────────────────────────────────
  const [fxRates, setFxRates] = useState<FxRate[]>([])
  const [fxLoading, setFxLoading] = useState(false)

  // ── Fetch functions ──────────────────────────────────────────────────────────

  async function fetchData() {
    try {
      const res = await fetch("/api/analytics/summary", { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as SummaryData
      setData(json)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  async function fetchSentiment() {
    setSentimentLoading(true)
    try {
      const res = await fetch("/api/analytics/sentiment", { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as SentimentReport[]
      setSentimentData(json)
      setSentimentError(null)
    } catch (e) {
      setSentimentError(e instanceof Error ? e.message : "Failed to load sentiment data")
    } finally {
      setSentimentLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchListings() {
    setListingsLoading(true)
    try {
      const res = await fetch("/api/analytics/listings", { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setListings(data as ListingWithRelations[])
    } catch { /* silent */ } finally {
      setListingsLoading(false)
    }
  }

  async function fetchArbitrage() {
    setArbLoading(true)
    try {
      const res = await fetch("/api/analytics/arbitrage", { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as ArbitrageOpportunity[]
      setArbData(Array.isArray(json) ? json : [])
    } catch { /* silent */ } finally {
      setArbLoading(false)
    }
  }

  async function fetchTrends() {
    setTrendsLoading(true)
    try {
      const res = await fetch("/api/analytics/trends", { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as TrendRef[]
      setTrendsData(Array.isArray(json) ? json : [])
    } catch { /* silent */ } finally {
      setTrendsLoading(false)
    }
  }

  async function fetchFxRates() {
    setFxLoading(true)
    try {
      const res = await fetch("/api/fx/rates", { cache: "no-store" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (Array.isArray(json)) {
        setFxRates(json as FxRate[])
      } else if (json && typeof json === "object") {
        const rates: FxRate[] = Object.entries(json).map(([pair, rate]) => ({
          pair,
          rate: rate as number,
        }))
        setFxRates(rates)
      }
    } catch { /* silent */ } finally {
      setFxLoading(false)
    }
  }

  // Lazy-load tabs when first visited
  useEffect(() => {
    if (mainTab === "sentiment" && !sentimentFetched) {
      setSentimentFetched(true)
      fetchSentiment()
    }
    if (mainTab === "listings" && !listingsFetched) {
      setListingsFetched(true)
      fetchListings()
    }
    if (mainTab === "arbitrage" && !arbFetched) {
      setArbFetched(true)
      fetchArbitrage()
    }
    if (mainTab === "trends" && !trendsFetched) {
      setTrendsFetched(true)
      fetchTrends()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTab])

  // FX rates: fetch on mount + refresh every 60s
  useEffect(() => {
    fetchFxRates()
    const interval = setInterval(fetchFxRates, 60_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"))
    } else {
      setSortField(field as SortField)
      setSortDir("desc")
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  async function handleSentimentRefresh() {
    setSentimentRefreshing(true)
    try {
      await fetch("/api/analytics/sentiment", { method: "POST", cache: "no-store" })
      await fetchSentiment()
    } catch (e) {
      setSentimentError(e instanceof Error ? e.message : "Failed to refresh")
    } finally {
      setSentimentRefreshing(false)
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const brandMap = new Map<string, BrandStat>()
  for (const b of data?.brands ?? []) brandMap.set(b.brand, b)

  // Trending tab: filtered + sorted refs
  const filteredRefs = (data?.top_refs ?? []).filter(
    (r) => activeBrandTab === "All" || r.brand === activeBrandTab
  )
  const sortedRefs = [...filteredRefs].sort((a, b) => {
    const av = a[sortField] ?? 0
    const bv = b[sortField] ?? 0
    return sortDir === "desc" ? bv - av : av - bv
  })

  // Price distribution chart data
  const distributionChartData = PRICE_BUCKETS.map((bucket) => {
    const item: Record<string, string | number> = { bucket }
    for (const brand of TARGET_BRANDS) {
      const match = data?.price_distribution.find(
        (d) => d.brand === brand && d.bucket === bucket
      )
      item[brand] = match?.count ?? 0
    }
    return item
  }).filter((row) => TARGET_BRANDS.some((b) => (row[b] as number) > 0))

  const supplyChartData = data?.supply_by_ref ?? []

  // Market pulse
  const mostListedRef = (data?.top_refs ?? []).length > 0
    ? [...(data?.top_refs ?? [])].sort((a, b) => b.listings - a.listings)[0]
    : null
  const highestFloorRef = (data?.top_refs ?? []).length > 0
    ? [...(data?.top_refs ?? [])].sort((a, b) => b.floor - a.floor)[0]
    : null
  const widestSpreadRef = (data?.top_refs ?? []).length > 0
    ? [...(data?.top_refs ?? [])].sort((a, b) => b.spread - a.spread)[0]
    : null
  const hottestBrand = (data?.brands ?? []).length > 0
    ? [...(data?.brands ?? [])].sort((a, b) => b.heat_score - a.heat_score)[0]
    : null

  // Grey market refs
  const greyMarketRefs = (data?.top_refs ?? [])
    .filter((r) => r.msrp !== null && r.grey_market_premium_pct !== null)
    .sort((a, b) => (b.grey_market_premium_pct ?? 0) - (a.grey_market_premium_pct ?? 0))

  // Global stats bar
  const avgPriceAll = (data?.top_refs ?? []).length > 0
    ? (data?.top_refs ?? []).reduce((s, r) => s + r.avg, 0) / (data?.top_refs ?? []).length
    : 0

  // Top collections ranked by heat
  const rankedBrands = [...(data?.brands ?? [])].sort((a, b) => b.heat_score - a.heat_score)

  // Deals stats
  const avgDiscount = (data?.deals ?? []).length > 0
    ? ((data?.deals ?? []).reduce((s, d) => s + d.discount_pct, 0) / (data?.deals ?? []).length).toFixed(1)
    : "0"
  const lastDealScraped = (data?.deals ?? []).length > 0
    ? (data?.deals ?? []).reduce(
        (latest, d) => (new Date(d.scraped_at) > new Date(latest) ? d.scraped_at : latest),
        data!.deals[0].scraped_at
      )
    : null

  // Sentiment derived
  const discontinuedReports = (sentimentData ?? []).filter((r) => r.category === "discontinued")
  const newReleaseReports = (sentimentData ?? []).filter((r) => r.category === "new_release")
  const newsReports = (sentimentData ?? []).filter((r) => r.category === "market_news")
  const overallSentiment = (() => {
    if (!sentimentData || sentimentData.length === 0) return "neutral" as const
    const avg = sentimentData.reduce((s, r) => s + r.impact_score, 0) / sentimentData.length
    if (avg > 10) return "bullish" as const
    if (avg < -10) return "bearish" as const
    return "neutral" as const
  })()
  const lastSentimentUpdate = sentimentData && sentimentData.length > 0
    ? sentimentData.reduce(
        (latest, r) => (r.created_at > latest ? r.created_at : latest),
        sentimentData[0].created_at
      )
    : null

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto space-y-8 animate-pulse">
          <div>
            <div className="h-9 w-72 rounded-lg mb-2" style={{ background: "#111119" }} />
            <div className="h-4 w-96 rounded" style={{ background: "#111119" }} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl p-5 h-24" style={{ background: "#111119" }} />
            ))}
          </div>
          <div className="rounded-xl h-64" style={{ background: "#111119" }} />
          <div className="rounded-xl h-80" style={{ background: "#111119" }} />
        </div>
      </AppLayout>
    )
  }

  if (error || !data) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto">
          <div className="rounded-xl border p-8 text-center"
            style={{ background: "#111119", borderColor: "#1c1c2a" }}>
            <AlertTriangle className="mx-auto mb-3" size={32} style={{ color: "#ef4444" }} />
            <p className="text-white font-bold mb-1">Failed to load analytics</p>
            <p className="text-sm mb-4" style={{ color: "#8A939B" }}>{error ?? "Unknown error"}</p>
            <button onClick={handleRefresh}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white"
              style={{ background: "#2081E2" }}>
              Retry
            </button>
          </div>
        </div>
      </AppLayout>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight" style={{ color: "#e2e8f0" }}>
              MARKET INTELLIGENCE
            </h1>
            <p className="text-sm mt-1" style={{ color: "#8A939B" }}>
              Real-time watch market analytics · Bloomberg Terminal for luxury watches
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition-opacity disabled:opacity-50 self-start sm:self-auto"
            style={{ background: "#1c1c2a" }}
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {/* ── Tab Bar ─────────────────────────────────────────────────────── */}
        <div className="flex gap-0 border-b mb-8" style={{ borderColor: "#1c1c2a" }}>
          {MAIN_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setMainTab(tab)}
              className="px-5 py-3 text-sm font-bold capitalize transition-colors relative"
              style={{ color: mainTab === tab ? "#fff" : "#64748b" }}
            >
              {tab}
              {mainTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
              )}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            TAB: MARKET
            ═══════════════════════════════════════════════════════════════════ */}
        {mainTab === "market" && (
          <div className="space-y-8">

            {/* ── FX Rates Widget ──────────────────────────────────────────── */}
            <div className="rounded-xl border p-4" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
              <div className="flex items-center gap-2 mb-3">
                <Globe size={13} style={{ color: "#2081E2" }} />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>
                  Live FX Rates
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#22c55e" }} />
                  <span className="text-[10px] font-bold" style={{ color: "#22c55e" }}>LIVE</span>
                </span>
                {fxLoading && <RefreshCw size={10} className="animate-spin ml-auto" style={{ color: "#64748b" }} />}
              </div>
              <div className="flex flex-wrap gap-5">
                {fxRates.length > 0
                  ? fxRates.map((r) => (
                    <div key={r.pair} className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>{r.pair}</span>
                      <span className="text-sm font-black font-mono" style={{ color: "#e2e8f0" }}>
                        {r.rate.toFixed(4)}
                      </span>
                    </div>
                  ))
                  : FX_PAIRS.map((p) => (
                    <div key={p.pair} className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>{p.pair}</span>
                      <span className="text-sm font-black font-mono" style={{ color: "#475569" }}>—</span>
                    </div>
                  ))
                }
              </div>
              <p className="text-[10px] mt-3" style={{ color: "#475569" }}>
                Prices across markets auto-converted using live rates · Refreshes every 60s
              </p>
            </div>

            {/* ── A: Global Stats Bar ─────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                {
                  icon: <Package size={13} style={{ color: "#2081E2" }} />,
                  label: "Total Listings",
                  value: data.overview.total_listings.toLocaleString(),
                  sub: null,
                },
                {
                  icon: <Tag size={13} style={{ color: "#6366f1" }} />,
                  label: "Refs Tracked",
                  value: data.overview.refs_tracked.toString(),
                  sub: null,
                },
                {
                  icon: <BarChart2 size={13} style={{ color: "#10b981" }} />,
                  label: "Brands",
                  value: data.overview.brands_covered.toString(),
                  sub: null,
                },
                {
                  icon: <DollarSign size={13} style={{ color: "#22c55e" }} />,
                  label: "Avg Price",
                  value: formatCompact(avgPriceAll),
                  sub: "across all refs",
                },
                {
                  icon: <Flame size={13} style={{ color: "#ef4444" }} />,
                  label: "Hottest Brand",
                  value: hottestBrand?.brand ?? "—",
                  sub: hottestBrand ? `Heat ${hottestBrand.heat_score.toFixed(1)}` : null,
                },
                {
                  icon: <Zap size={13} style={{
                    color: data.overview.data_freshness_hours < 24 ? "#22c55e" : "#eab308",
                  }} />,
                  label: "Freshness",
                  value: data.overview.data_freshness_hours < 1
                    ? "Live"
                    : `${data.overview.data_freshness_hours.toFixed(0)}h ago`,
                  valueColor: data.overview.data_freshness_hours < 24 ? "#22c55e" : "#eab308",
                  sub: data.overview.last_updated ? "last updated" : null,
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border p-4"
                  style={{ background: "#111119", borderColor: "#1c1c2a" }}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    {stat.icon}
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>
                      {stat.label}
                    </span>
                  </div>
                  <p
                    className="text-lg font-black font-mono truncate"
                    style={{ color: ("valueColor" in stat && stat.valueColor) ? stat.valueColor : "#fff" }}
                  >
                    {stat.value}
                  </p>
                  {stat.sub && (
                    <p className="text-[10px] mt-0.5 truncate" style={{ color: "#475569" }}>{stat.sub}</p>
                  )}
                </div>
              ))}
            </div>

            {/* ── B: Top Collections (OpenSea-style ranked table) ──────────── */}
            <section>
              <div className="rounded-xl border overflow-hidden" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
                <div className="px-5 py-4 border-b" style={{ borderColor: "#1c1c2a" }}>
                  <h2 className="text-base font-black text-white">Top Collections</h2>
                  <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
                    Ranked by market heat · click to explore brand
                  </p>
                </div>

                {/* Table header */}
                <div
                  className="hidden md:grid px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider"
                  style={{
                    background: "#0b0b14",
                    color: "#64748b",
                    gridTemplateColumns: "28px 2fr 1fr 1fr 1fr 80px 140px 1fr",
                  }}
                >
                  <div>#</div>
                  <div>Brand</div>
                  <div className="text-right">Floor</div>
                  <div className="text-right">Avg</div>
                  <div className="text-right">30d</div>
                  <div className="text-right"># Listed</div>
                  <div>Heat</div>
                  <div className="text-right">Volume</div>
                </div>

                {rankedBrands.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm" style={{ color: "#475569" }}>
                    No brand data yet.
                  </div>
                ) : (
                  rankedBrands.map((stat, i) => {
                    const color = BRAND_COLORS[stat.brand] ?? "#94a3b8"
                    const slug = BRAND_SLUGS[stat.brand]
                    const heatPct = Math.min(100, (stat.heat_score / 30) * 100)
                    const volume = stat.avg_price * stat.total_listings
                    return (
                      <Link
                        key={stat.brand}
                        href={`/brands/${slug}`}
                        className="border-t flex flex-col md:grid px-4 py-3 gap-2 md:gap-0 md:items-center transition-colors hover:opacity-90"
                        style={{
                          borderColor: "#1c1c2a",
                          background: i % 2 === 0 ? "#111119" : "#0d0d15",
                          gridTemplateColumns: "28px 2fr 1fr 1fr 1fr 80px 140px 1fr",
                        }}
                      >
                        {/* Rank */}
                        <div className="hidden md:block">
                          <span className="text-[11px] font-bold font-mono" style={{ color: "#475569" }}>
                            {i + 1}
                          </span>
                        </div>
                        {/* Brand name */}
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: color }} />
                          <span className="text-sm font-black text-white">{stat.brand}</span>
                          <span className="text-[10px] md:hidden" style={{ color: "#64748b" }}>
                            #{i + 1}
                          </span>
                        </div>
                        {/* Floor */}
                        <div className="hidden md:block text-right">
                          <span className="text-xs font-mono text-white">{formatCompact(stat.floor_price)}</span>
                        </div>
                        {/* Avg */}
                        <div className="hidden md:block text-right">
                          <span className="text-xs font-black font-mono text-white">{formatCompact(stat.avg_price)}</span>
                        </div>
                        {/* 30d */}
                        <div className="hidden md:block text-right">
                          <PriceChangeBadge change={stat.change_30d} />
                        </div>
                        {/* # Listed */}
                        <div className="hidden md:block text-right">
                          <span className="text-xs font-mono text-white">{stat.total_listings.toLocaleString()}</span>
                        </div>
                        {/* Heat bar */}
                        <div className="hidden md:flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#1c1c2a" }}>
                            <div className="h-full rounded-full" style={{ width: `${heatPct}%`, backgroundColor: color }} />
                          </div>
                          <span className="text-[10px] font-mono w-8 text-right" style={{ color }}>{stat.heat_score.toFixed(0)}</span>
                        </div>
                        {/* Volume */}
                        <div className="hidden md:block text-right">
                          <span className="text-xs font-mono" style={{ color: "#8A939B" }}>{formatCompact(volume)}</span>
                        </div>
                        {/* Mobile summary */}
                        <div className="flex items-center justify-between md:hidden">
                          <PriceChangeBadge change={stat.change_30d} />
                          <span className="text-xs font-mono text-white">{stat.total_listings} listed</span>
                          <span className="text-xs font-black font-mono text-white">avg {formatCompact(stat.avg_price)}</span>
                        </div>
                      </Link>
                    )
                  })
                )}
              </div>
            </section>

            {/* ── Market Pulse ─────────────────────────────────────────────── */}
            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: "#64748b" }}>
                Market Pulse
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    icon: <BarChart2 size={18} style={{ color: "#2081E2" }} />,
                    label: "Most Listed Ref",
                    value: mostListedRef ? mostListedRef.ref_number : "—",
                    sub: mostListedRef ? `${mostListedRef.listings} listings · ${mostListedRef.brand}` : "No data",
                    href: mostListedRef ? `/ref/${mostListedRef.ref_number}` : undefined,
                  },
                  {
                    icon: <DollarSign size={18} style={{ color: "#22c55e" }} />,
                    label: "Highest Floor",
                    value: highestFloorRef ? formatCompact(highestFloorRef.floor) : "—",
                    sub: highestFloorRef ? `${highestFloorRef.ref_number} · ${highestFloorRef.brand}` : "No data",
                    href: highestFloorRef ? `/ref/${highestFloorRef.ref_number}` : undefined,
                  },
                  {
                    icon: <ArrowUpDown size={18} style={{ color: "#f59e0b" }} />,
                    label: "Widest Spread",
                    value: widestSpreadRef ? formatCompact(widestSpreadRef.spread) : "—",
                    sub: widestSpreadRef ? `${widestSpreadRef.ref_number} · ${widestSpreadRef.spread_pct.toFixed(0)}% range` : "No data",
                    href: widestSpreadRef ? `/ref/${widestSpreadRef.ref_number}` : undefined,
                  },
                  {
                    icon: <Flame size={18} style={{ color: "#ef4444" }} />,
                    label: "Hottest Brand",
                    value: hottestBrand ? hottestBrand.brand : "—",
                    sub: hottestBrand ? `Heat: ${hottestBrand.heat_score.toFixed(1)} · ${hottestBrand.total_listings} listings` : "No data",
                    href: hottestBrand ? `/brands/${BRAND_SLUGS[hottestBrand.brand]}` : undefined,
                  },
                ].map((card) => {
                  const inner = (
                    <>
                      <div className="flex items-center gap-2 mb-1">{card.icon}
                        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>
                          {card.label}
                        </span>
                      </div>
                      <p className="text-xl font-black font-mono text-white truncate">{card.value}</p>
                      <p className="text-[11px] truncate" style={{ color: "#8A939B" }}>{card.sub}</p>
                    </>
                  )
                  return (
                    <div key={card.label}>
                      {card.href ? (
                        <Link href={card.href} className="rounded-xl border p-4 flex flex-col gap-1 transition-all block"
                          style={{ background: "#111119", borderColor: "#1c1c2a" }}>
                          {inner}
                        </Link>
                      ) : (
                        <div className="rounded-xl border p-4 flex flex-col gap-1"
                          style={{ background: "#111119", borderColor: "#1c1c2a" }}>
                          {inner}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>

            {/* ── C: Price Distribution Chart ──────────────────────────────── */}
            <section>
              <div className="rounded-xl border overflow-hidden" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
                <div className="px-5 py-4 border-b" style={{ borderColor: "#1c1c2a" }}>
                  <h2 className="text-base font-black text-white">Price Distribution by Brand</h2>
                  <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
                    Number of listings per price range
                  </p>
                </div>
                <div className="p-5">
                  {distributionChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={distributionChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1c1c2a" vertical={false} />
                        <XAxis dataKey="bucket" stroke="#1c1c2a"
                          tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis stroke="#1c1c2a" tick={{ fill: "#64748b", fontSize: 11 }}
                          axisLine={false} tickLine={false} width={35} />
                        <Tooltip content={<DistributionTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 16 }} iconType="circle" iconSize={8} />
                        {TARGET_BRANDS.map((brand) => (
                          <Bar key={brand} dataKey={brand} fill={BRAND_COLORS[brand]}
                            radius={[3, 3, 0, 0]} maxBarSize={40} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-64 flex items-center justify-center" style={{ color: "#475569" }}>
                      No distribution data available
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ── D: Supply Analysis Chart ─────────────────────────────────── */}
            <section>
              <div className="rounded-xl border overflow-hidden" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
                <div className="px-5 py-4 border-b" style={{ borderColor: "#1c1c2a" }}>
                  <h2 className="text-base font-black text-white">Supply by Reference (Top 15)</h2>
                  <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
                    Number of active listings per reference — higher = more liquid
                  </p>
                </div>
                <div className="p-5">
                  {supplyChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={Math.max(300, supplyChartData.length * 32)}>
                      <BarChart data={supplyChartData} layout="vertical"
                        margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1c1c2a" horizontal={false} />
                        <XAxis type="number" stroke="#1c1c2a"
                          tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="ref_number" width={120}
                          tick={{ fill: "#e2e8f0", fontSize: 11, fontFamily: "ui-monospace, monospace" }}
                          axisLine={false} tickLine={false} />
                        <Tooltip content={<SupplyTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
                          {supplyChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={BRAND_COLORS[entry.brand] ?? "#6b7280"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-64 flex items-center justify-center" style={{ color: "#475569" }}>
                      No supply data available
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ── Grey Market Premium Table ─────────────────────────────────── */}
            {greyMarketRefs.length > 0 && (
              <section>
                <div className="rounded-xl border overflow-hidden" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
                  <div className="px-5 py-4 border-b" style={{ borderColor: "#1c1c2a" }}>
                    <h2 className="text-base font-black text-white">Grey Market vs. Retail</h2>
                    <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
                      Asking-price premium above manufacturer retail — sorted by highest premium
                    </p>
                  </div>
                  <div className="hidden md:grid px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider"
                    style={{ background: "#0b0b14", color: "#64748b", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1.5fr 1fr" }}>
                    <div>Watch</div>
                    <div>Ref</div>
                    <div className="text-right">Retail MSRP</div>
                    <div className="text-right">Market Avg</div>
                    <div className="text-right">Premium</div>
                    <div className="text-right"># Listed</div>
                  </div>
                  {greyMarketRefs.map((ref, i) => {
                    const info = MSRP_INFO[ref.ref_number]
                    const brandColor = BRAND_COLORS[ref.brand] ?? "#94a3b8"
                    return (
                      <Link key={`${ref.ref_number}-gm-${i}`}
                        href={`/ref/${encodeURIComponent(ref.ref_number)}`}
                        className="border-t px-4 py-3 transition-colors flex flex-col md:grid gap-2 md:gap-0 md:items-center hover:opacity-90"
                        style={{
                          borderColor: "#1c1c2a",
                          background: i % 2 === 0 ? "#111119" : "#0d0d15",
                          gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1.5fr 1fr",
                        }}
                      >
                        <div>
                          <p className="text-sm font-bold text-white">{info?.name ?? ref.model ?? ref.ref_number}</p>
                          <p className="text-[11px]" style={{ color: brandColor }}>{ref.brand}</p>
                        </div>
                        <div className="hidden md:block">
                          <span className="text-xs font-mono font-bold text-white">{ref.ref_number}</span>
                        </div>
                        <div className="hidden md:block text-right">
                          <span className="text-xs font-mono" style={{ color: "#94a3b8" }}>
                            {ref.msrp ? formatCurrency(ref.msrp) : "—"}
                          </span>
                        </div>
                        <div className="hidden md:block text-right">
                          <span className="text-xs font-black font-mono text-white">{formatCurrency(ref.avg)}</span>
                        </div>
                        <div className="hidden md:block text-right">
                          {ref.grey_market_premium_pct !== null ? (
                            <GreyMarketBadge pct={ref.grey_market_premium_pct} />
                          ) : (
                            <span className="text-xs" style={{ color: "#475569" }}>—</span>
                          )}
                        </div>
                        <div className="hidden md:block text-right">
                          <span className="text-xs font-mono text-white">{ref.listings}</span>
                        </div>
                        <div className="flex items-center justify-between md:hidden">
                          <span className="text-xs font-mono" style={{ color: "#64748b" }}>{ref.ref_number}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono" style={{ color: "#64748b" }}>
                              MSRP {ref.msrp ? formatCompact(ref.msrp) : "—"}
                            </span>
                            <span className="text-xs font-black font-mono text-white">avg {formatCompact(ref.avg)}</span>
                            {ref.grey_market_premium_pct !== null && (
                              <GreyMarketBadge pct={ref.grey_market_premium_pct} />
                            )}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── Data Coverage ─────────────────────────────────────────────── */}
            <section>
              <div className="rounded-xl border p-5" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
                <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: "#64748b" }}>
                  Data Coverage
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      label: "Asking Prices",
                      value: `${data.overview.total_listings.toLocaleString()} Chrono24 listings`,
                      color: "#22c55e",
                    },
                    {
                      label: "Confirmed Sales",
                      value: "0 (eBay API key needed)",
                      color: "#ef4444",
                    },
                    {
                      label: "Last Sync",
                      value: data.overview.last_updated
                        ? `${data.overview.data_freshness_hours}h ago`
                        : "Never",
                      color: data.overview.data_freshness_hours < 24 ? "#22c55e" : "#eab308",
                    },
                    {
                      label: "Refs Tracked",
                      value: `${data.overview.refs_tracked} unique references`,
                      color: "#2081E2",
                    },
                  ].map((item) => (
                    <div key={item.label}>
                      <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: "#64748b" }}>
                        {item.label}
                      </p>
                      <p className="text-sm font-bold" style={{ color: item.color }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB: SENTIMENT
            ═══════════════════════════════════════════════════════════════════ */}
        {mainTab === "sentiment" && (
          <div className="space-y-6">

            {/* Header row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <Brain size={20} style={{ color: "#2081E2" }} />
                  Market Sentiment
                </h2>
                {sentimentData && sentimentData.length > 0 && (
                  <SentimentBadge sentiment={overallSentiment} lg />
                )}
                {lastSentimentUpdate && (
                  <span className="text-xs" style={{ color: "#64748b" }}>
                    Last updated {shortTimeAgo(lastSentimentUpdate)}
                  </span>
                )}
              </div>
              <button
                onClick={handleSentimentRefresh}
                disabled={sentimentRefreshing || sentimentLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition-opacity disabled:opacity-50 self-start sm:self-auto"
                style={{ background: "#1c1c2a" }}
              >
                <RefreshCw size={14} className={sentimentRefreshing ? "animate-spin" : ""} />
                {sentimentRefreshing ? "Generating…" : "Refresh"}
              </button>
            </div>

            {sentimentLoading && (
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-xl h-48" style={{ background: "#111119" }} />
                ))}
              </div>
            )}

            {sentimentError && !sentimentLoading && (
              <div className="rounded-xl border p-8 text-center" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
                <AlertTriangle className="mx-auto mb-3" size={28} style={{ color: "#ef4444" }} />
                <p className="text-white font-bold mb-1">Failed to load sentiment data</p>
                <p className="text-sm mb-4" style={{ color: "#8A939B" }}>{sentimentError}</p>
                <button onClick={fetchSentiment}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-white"
                  style={{ background: "#2081E2" }}>
                  Retry
                </button>
              </div>
            )}

            {!sentimentLoading && !sentimentError && sentimentData !== null && sentimentData.length === 0 && (
              <div className="rounded-xl border p-12 text-center" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
                <Brain className="mx-auto mb-4" size={36} style={{ color: "#64748b" }} />
                <p className="text-white font-bold text-lg mb-2">No sentiment data yet</p>
                <p className="text-sm mb-6" style={{ color: "#8A939B" }}>
                  Run the daily research script to populate market sentiment analysis.
                </p>
                <button
                  onClick={handleSentimentRefresh}
                  disabled={sentimentRefreshing}
                  className="px-5 py-2.5 rounded-lg text-sm font-bold text-white transition-opacity disabled:opacity-50"
                  style={{ background: "#2081E2" }}
                >
                  {sentimentRefreshing ? "Generating…" : "Generate Sentiment Report"}
                </button>
              </div>
            )}

            {!sentimentLoading && sentimentData && sentimentData.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Section A: Discontinued Watches */}
                <div className="rounded-xl border overflow-hidden" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
                  <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "#1c1c2a" }}>
                    <span className="text-base">🚫</span>
                    <h3 className="text-sm font-black text-white">Discontinued</h3>
                    <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded"
                      style={{ background: "#1c1c2a", color: "#64748b" }}>
                      {discontinuedReports.length}
                    </span>
                  </div>
                  <div className="divide-y" style={{ borderColor: "#1c1c2a" }}>
                    {discontinuedReports.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-center" style={{ color: "#475569" }}>
                        No discontinued watch data
                      </p>
                    ) : (
                      discontinuedReports.map((report) => (
                        <div key={report.id} className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white leading-tight">{report.title}</p>
                              {report.brand && (
                                <p className="text-[11px] mt-0.5" style={{ color: BRAND_COLORS[report.brand] ?? "#94a3b8" }}>
                                  {report.brand}
                                </p>
                              )}
                            </div>
                            <SentimentBadge sentiment={report.sentiment} />
                          </div>
                          <p className="text-xs leading-relaxed" style={{ color: "#8A939B" }}>{report.summary}</p>
                          {report.ref_numbers.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {report.ref_numbers.map((ref) => (
                                <Link key={ref} href={`/ref/${encodeURIComponent(ref)}`}
                                  className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded hover:opacity-80 transition-opacity"
                                  style={{ background: "rgba(32,129,226,0.12)", color: "#60a5fa" }}>
                                  {ref}
                                </Link>
                              ))}
                            </div>
                          )}
                          {report.event_date && (
                            <p className="text-[10px] mt-2" style={{ color: "#475569" }}>
                              {report.event_date}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Section B: New Releases */}
                <div className="rounded-xl border overflow-hidden" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
                  <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "#1c1c2a" }}>
                    <span className="text-base">🆕</span>
                    <h3 className="text-sm font-black text-white">New Releases</h3>
                    <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded"
                      style={{ background: "#1c1c2a", color: "#64748b" }}>
                      {newReleaseReports.length}
                    </span>
                  </div>
                  <div className="divide-y" style={{ borderColor: "#1c1c2a" }}>
                    {newReleaseReports.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-center" style={{ color: "#475569" }}>
                        No new release data
                      </p>
                    ) : (
                      newReleaseReports.map((report) => (
                        <div key={report.id} className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white leading-tight">{report.title}</p>
                              {report.brand && (
                                <p className="text-[11px] mt-0.5" style={{ color: BRAND_COLORS[report.brand] ?? "#94a3b8" }}>
                                  {report.brand}
                                </p>
                              )}
                            </div>
                            <SentimentBadge sentiment={report.sentiment} />
                          </div>
                          <p className="text-xs leading-relaxed" style={{ color: "#8A939B" }}>{report.summary}</p>
                          {report.ref_numbers.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {report.ref_numbers.map((ref) => (
                                <Link key={ref} href={`/ref/${encodeURIComponent(ref)}`}
                                  className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded hover:opacity-80 transition-opacity"
                                  style={{ background: "rgba(32,129,226,0.12)", color: "#60a5fa" }}>
                                  {ref}
                                </Link>
                              ))}
                            </div>
                          )}
                          {report.event_date && (
                            <p className="text-[10px] mt-2" style={{ color: "#475569" }}>
                              {report.event_date}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Section C: Market News */}
                <div className="rounded-xl border overflow-hidden" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
                  <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "#1c1c2a" }}>
                    <span className="text-base">📰</span>
                    <h3 className="text-sm font-black text-white">Market News</h3>
                    <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded"
                      style={{ background: "#1c1c2a", color: "#64748b" }}>
                      {newsReports.length}
                    </span>
                  </div>
                  <div className="divide-y" style={{ borderColor: "#1c1c2a" }}>
                    {newsReports.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-center" style={{ color: "#475569" }}>
                        No market news
                      </p>
                    ) : (
                      newsReports.map((report) => (
                        <div key={report.id} className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white leading-tight">{report.title}</p>
                            </div>
                            <SentimentBadge sentiment={report.sentiment} />
                          </div>
                          <p className="text-xs leading-relaxed" style={{ color: "#8A939B" }}>{report.summary}</p>
                          {report.ref_numbers.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {report.ref_numbers.map((ref) => (
                                <Link key={ref} href={`/ref/${encodeURIComponent(ref)}`}
                                  className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded hover:opacity-80 transition-opacity"
                                  style={{ background: "rgba(32,129,226,0.12)", color: "#60a5fa" }}>
                                  {ref}
                                </Link>
                              ))}
                            </div>
                          )}
                          {report.source_url && (
                            <a href={report.source_url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[10px] mt-2 hover:opacity-80 transition-opacity"
                              style={{ color: "#2081E2" }}>
                              Source <ExternalLink size={9} />
                            </a>
                          )}
                          {report.event_date && (
                            <p className="text-[10px] mt-1" style={{ color: "#475569" }}>
                              {report.event_date}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB: TRENDING
            ═══════════════════════════════════════════════════════════════════ */}
        {mainTab === "trending" && (
          <div>
            <div className="rounded-xl border overflow-hidden" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
              <div className="px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                style={{ borderColor: "#1c1c2a" }}>
                <div>
                  <h2 className="text-base font-black text-white">All Tracked References</h2>
                  <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
                    {sortedRefs.length} refs · sorted by {sortField.replace("_", " ")}
                  </p>
                </div>
                {/* Brand filter tabs */}
                <div className="flex gap-1 flex-wrap">
                  {["All", ...TARGET_BRANDS].map((tab) => (
                    <button key={tab} onClick={() => setActiveBrandTab(tab)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                      style={
                        activeBrandTab === tab
                          ? { background: "#2081E2", color: "#fff" }
                          : { background: "#0b0b14", color: "#8A939B" }
                      }>
                      {tab === "Audemars Piguet" ? "AP" : tab === "Vacheron Constantin" ? "VC" : tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table header — with sparkline column replacing ceiling */}
              <div
                className="hidden md:grid px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider"
                style={{
                  background: "#0b0b14",
                  color: "#64748b",
                  gridTemplateColumns: "2fr 2fr 70px 1fr 1fr 1fr 1.5fr 1fr 1fr 1fr",
                }}
              >
                <div>Ref</div>
                <div>Model</div>
                <div>7d</div>
                <SortHeader field="floor" label="Floor" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="justify-end" />
                <SortHeader field="avg" label="Avg" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="justify-end" />
                <SortHeader field="spread" label="Spread" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="justify-end" />
                <div className="text-right">Grey Mkt</div>
                <SortHeader field="listings" label="# Listed" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="justify-end" />
                <div className="text-right">30d</div>
                <SortHeader field="heat_score" label="Heat" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="justify-end" />
              </div>

              {sortedRefs.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm" style={{ color: "#475569" }}>
                  No references found for this filter.
                </div>
              ) : (
                sortedRefs.map((ref, i) => {
                  const brandColor = BRAND_COLORS[ref.brand] ?? "#94a3b8"
                  return (
                    <Link
                      key={`${ref.ref_number}-${i}`}
                      href={`/ref/${encodeURIComponent(ref.ref_number)}`}
                      className="border-t px-4 py-3 transition-colors flex flex-col md:grid gap-2 md:gap-0 md:items-center hover:opacity-90"
                      style={{
                        borderColor: "#1c1c2a",
                        background: i % 2 === 0 ? "#111119" : "#0d0d15",
                        gridTemplateColumns: "2fr 2fr 70px 1fr 1fr 1fr 1.5fr 1fr 1fr 1fr",
                      }}
                    >
                      {/* Mobile layout */}
                      <div className="flex items-start justify-between md:contents">
                        <div className="flex flex-col md:block">
                          <span className="text-xs font-black font-mono text-white">{ref.ref_number}</span>
                          <span className="text-[10px] md:hidden mt-0.5" style={{ color: brandColor }}>
                            {ref.brand}
                          </span>
                        </div>
                        <div className="md:hidden flex items-center gap-2">
                          <span className="text-sm font-black font-mono text-white">{formatCompact(ref.avg)}</span>
                          <PriceChangeBadge change={ref.change_30d} />
                        </div>
                      </div>

                      {/* Desktop cells */}
                      <div className="hidden md:flex flex-col">
                        <span className="text-xs font-semibold text-white truncate">{ref.model ?? "—"}</span>
                        <span className="text-[10px]" style={{ color: brandColor }}>{ref.brand}</span>
                      </div>
                      {/* Sparkline */}
                      <div className="hidden md:flex items-center">
                        {ref.sparkline_data && ref.sparkline_data.length >= 2 ? (
                          <Sparkline data={ref.sparkline_data} width={60} height={24} />
                        ) : (
                          <span style={{ color: "#475569", fontSize: 10 }}>—</span>
                        )}
                      </div>
                      <div className="hidden md:block text-right">
                        <span className="text-xs font-mono text-white">{formatCompact(ref.floor)}</span>
                      </div>
                      <div className="hidden md:block text-right">
                        <span className="text-xs font-black font-mono text-white">{formatCompact(ref.avg)}</span>
                      </div>
                      <div className="hidden md:block text-right">
                        <span className="text-xs font-mono" style={{ color: "#eab308" }}>
                          {formatCompact(ref.spread)}
                        </span>
                      </div>
                      <div className="hidden md:block text-right">
                        {ref.grey_market_premium_pct !== null ? (
                          <GreyMarketBadge pct={ref.grey_market_premium_pct} />
                        ) : (
                          <span className="text-xs" style={{ color: "#475569" }}>—</span>
                        )}
                      </div>
                      <div className="hidden md:block text-right">
                        <span className="text-xs font-mono text-white">{ref.listings}</span>
                      </div>
                      <div className="hidden md:block text-right">
                        <PriceChangeBadge change={ref.change_30d} />
                      </div>
                      <div className="hidden md:block text-right">
                        <HeatDot score={ref.heat_score} />
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB: DEALS
            ═══════════════════════════════════════════════════════════════════ */}
        {mainTab === "deals" && (
          <div className="space-y-6">

            {/* Stats header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <span className="text-xl">🔥</span> Potential Deals
                </h2>
                <span className="text-sm font-mono" style={{ color: "#64748b" }}>
                  {data.deals.length} deals detected
                  {data.deals.length > 0 && (
                    <> · avg <span style={{ color: "#22c55e" }}>{avgDiscount}%</span> below market</>
                  )}
                  {lastDealScraped && (
                    <> · last refreshed {shortTimeAgo(lastDealScraped)}</>
                  )}
                </span>
              </div>
            </div>

            <p className="text-xs" style={{ color: "#64748b" }}>
              Listings priced below market average for their reference
            </p>

            {data.deals.length === 0 ? (
              <div className="rounded-xl border p-8 text-center" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
                <p className="font-bold text-white mb-1">No deals detected</p>
                <p className="text-sm" style={{ color: "#64748b" }}>
                  Market is fairly priced right now — all listings are within 8% of their reference average.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {data.deals.map((deal, i) => {
                  const brandColor = BRAND_COLORS[deal.brand] ?? "#94a3b8"
                  const msrpInfo = MSRP_INFO[deal.ref_number]
                  return (
                    <div key={i} className="rounded-xl border overflow-hidden"
                      style={{ background: "#111119", borderColor: "#1c1c2a" }}>
                      <div className="px-4 py-2 text-xs font-bold uppercase tracking-wider"
                        style={{ background: "rgba(34,197,94,0.08)", color: "#22c55e" }}>
                        -{deal.discount_pct}% below market
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div>
                            <p className="text-xs font-black font-mono text-white">{deal.ref_number}</p>
                            <p className="text-sm font-bold text-white mt-0.5">
                              {deal.model ?? msrpInfo?.name ?? deal.ref_number}
                            </p>
                            <p className="text-[11px] mt-0.5" style={{ color: brandColor }}>{deal.brand}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-black font-mono" style={{ color: "#22c55e" }}>
                              {formatCurrency(deal.price)}
                            </p>
                            <p className="text-xs line-through" style={{ color: "#64748b" }}>
                              avg {formatCurrency(deal.ref_avg)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold capitalize"
                              style={{ background: "rgba(32,129,226,0.12)", color: "#60a5fa" }}>
                              {deal.source}
                            </span>
                            <span className="text-[10px]" style={{ color: "#475569" }}>
                              {shortTimeAgo(deal.scraped_at)}
                            </span>
                          </div>
                          {deal.listing_url && (
                            <a href={deal.listing_url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs font-bold hover:opacity-80 transition-opacity"
                              style={{ color: "#2081E2" }}
                              onClick={(e) => e.stopPropagation()}>
                              View listing <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB: LISTINGS
            ═══════════════════════════════════════════════════════════════════ */}
        {mainTab === "listings" && (() => {
          // Derive unique brands from listings
          const brandSet = new Map<string, string>() // slug → name
          for (const l of listings) {
            if (l.brand?.slug && l.brand?.name) brandSet.set(l.brand.slug, l.brand.name)
          }
          const brandTabs = ["All", ...Array.from(brandSet.values())]

          // Filter by brand
          const filtered = listings.filter(l =>
            listingsBrand === "All" || l.brand?.name === listingsBrand
          )

          // Sort
          const sorted = [...filtered].sort((a, b) => {
            const pa = parseFloat(a.wholesale_price)
            const pb = parseFloat(b.wholesale_price)
            if (listingsSort === "price-asc") return pa - pb
            if (listingsSort === "price-desc") return pb - pa
            return new Date(b.listed_at).getTime() - new Date(a.listed_at).getTime()
          })

          // Price ladder buckets
          const buckets = [
            { label: "Under $10K",   min: 0,      max: 10000 },
            { label: "$10K–$25K",    min: 10000,  max: 25000 },
            { label: "$25K–$50K",    min: 25000,  max: 50000 },
            { label: "$50K–$100K",   min: 50000,  max: 100000 },
            { label: "$100K–$250K",  min: 100000, max: 250000 },
            { label: "$250K+",       min: 250000, max: Infinity },
          ].map(b => ({
            ...b,
            count: filtered.filter(l => {
              const p = parseFloat(l.wholesale_price)
              return p >= b.min && p < b.max
            }).length,
            floor: Math.min(...filtered
              .filter(l => { const p = parseFloat(l.wholesale_price); return p >= b.min && p < b.max && p > 0 })
              .map(l => parseFloat(l.wholesale_price))
              .filter(p => isFinite(p))
            ),
          })).filter(b => b.count > 0)

          return (
            <div className="space-y-6">

              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-white">All Listings</h2>
                  <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
                    {filtered.length} watches · sorted by {listingsSort === "price-asc" ? "floor price" : listingsSort === "price-desc" ? "highest price" : "newest"}
                  </p>
                </div>
                <select
                  value={listingsSort}
                  onChange={e => setListingsSort(e.target.value as typeof listingsSort)}
                  className="h-8 px-3 rounded-lg text-sm font-bold text-white border"
                  style={{ background: "#161622", borderColor: "#22222e", color: "#e2e8f0" }}
                >
                  <option value="price-asc">Price: Low → High</option>
                  <option value="price-desc">Price: High → Low</option>
                  <option value="newest">Recently Listed</option>
                </select>
              </div>

              {/* Price Ladder */}
              {buckets.length > 0 && (
                <div className="rounded-xl border p-4" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
                  <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#64748b" }}>Price Ladder</p>
                  <div className="flex flex-wrap gap-2">
                    {buckets.map(b => (
                      <div key={b.label} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                        style={{ background: "#0b0b14", border: "1px solid #1c1c2a" }}>
                        <span className="text-xs font-bold text-white">{b.label}</span>
                        <span className="text-xs font-black font-mono" style={{ color: "#2081E2" }}>{b.count} watches</span>
                        {isFinite(b.floor) && b.floor > 0 && (
                          <span className="text-[10px] font-mono" style={{ color: "#22c55e" }}>
                            floor {formatCompact(b.floor)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Brand filter tabs */}
              <div className="flex gap-1.5 flex-wrap">
                {brandTabs.map(tab => (
                  <button key={tab} onClick={() => setListingsBrand(tab)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={listingsBrand === tab
                      ? { background: "#2081E2", color: "#fff" }
                      : { background: "#111119", color: "#8A939B", border: "1px solid #1c1c2a" }
                    }>
                    {tab}
                  </button>
                ))}
              </div>

              {/* Loading */}
              {listingsLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="rounded-xl animate-pulse" style={{ background: "#111119", aspectRatio: "3/4" }} />
                  ))}
                </div>
              ) : sorted.length === 0 ? (
                <div className="rounded-xl border p-10 text-center" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
                  <p className="text-white font-bold mb-1">No listings found</p>
                  <p className="text-sm" style={{ color: "#64748b" }}>No active listings for this filter.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {sorted.map(l => (
                    <ListingCard key={l.id} listing={l} />
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB: ARBITRAGE
            ═══════════════════════════════════════════════════════════════════ */}
        {mainTab === "arbitrage" && (() => {
          const bestOpp = arbData.length > 0
            ? arbData.reduce((best, opp) => opp.net_profit_pct > best.net_profit_pct ? opp : best, arbData[0])
            : null
          const avgEuDiscount = arbData.length > 0
            ? (arbData.reduce((sum, opp) => sum + (opp.sell_price_usd - opp.buy_price_usd) / opp.sell_price_usd, 0) / arbData.length) * 100
            : 0

          return (
            <div className="space-y-6">
              {/* Header */}
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <span>⚡</span> Arbitrage Opportunities
                </h2>
                <p className="text-xs mt-1" style={{ color: "#64748b" }}>
                  Buy cheaper in EU/CH markets, sell at US prices after import costs
                </p>
              </div>

              {arbLoading && (
                <div className="space-y-3 animate-pulse">
                  <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="rounded-xl h-20" style={{ background: "#111119" }} />
                    ))}
                  </div>
                  <div className="rounded-xl h-64" style={{ background: "#111119" }} />
                </div>
              )}

              {!arbLoading && (
                <>
                  {/* Hero Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {
                        label: "Best Opportunity",
                        value: bestOpp ? `${bestOpp.net_profit_pct.toFixed(1)}%` : "—",
                        sub: bestOpp ? `${bestOpp.ref_number} · ${bestOpp.brand}` : "No data",
                        color: "#10b981",
                      },
                      {
                        label: "Avg EU Discount",
                        value: arbData.length > 0 ? `${avgEuDiscount.toFixed(1)}%` : "—",
                        sub: "vs. US sell price",
                        color: "#f59e0b",
                      },
                      {
                        label: "Total Opportunities",
                        value: arbData.length.toString(),
                        sub: "active arb plays",
                        color: "#2081E2",
                      },
                    ].map((card) => (
                      <div key={card.label} className="rounded-xl border p-4"
                        style={{ background: "#111119", borderColor: "#1c1c2a" }}>
                        <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "#64748b" }}>
                          {card.label}
                        </p>
                        <p className="text-2xl font-black font-mono" style={{ color: card.color }}>{card.value}</p>
                        <p className="text-[11px] mt-0.5 truncate" style={{ color: "#475569" }}>{card.sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Main Table */}
                  {arbData.length === 0 ? (
                    <div className="rounded-xl border p-12 text-center" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
                      <p className="text-white font-bold text-lg mb-2">No arbitrage data</p>
                      <p className="text-sm" style={{ color: "#64748b" }}>
                        Run the arbitrage scanner to populate cross-market opportunities.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border overflow-hidden" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
                      <div className="px-5 py-4 border-b" style={{ borderColor: "#1c1c2a" }}>
                        <h3 className="text-base font-black text-white">Arbitrage Opportunities</h3>
                        <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
                          Import costs include: shipping $350 · 9.8% US duty · $200 authentication
                        </p>
                      </div>

                      {/* Table header */}
                      <div
                        className="hidden lg:grid px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider"
                        style={{
                          background: "#0b0b14",
                          color: "#64748b",
                          gridTemplateColumns: "2.5fr 2fr 1fr 1fr 1fr 1fr 1.2fr 100px",
                        }}
                      >
                        <div>Watch</div>
                        <div>Buy Market</div>
                        <div className="text-right">USD Equiv</div>
                        <div className="text-right">Sell (US)</div>
                        <div className="text-right">Import Costs</div>
                        <div className="text-right">Net Profit</div>
                        <div className="text-right">Net %</div>
                        <div className="text-right">Availability</div>
                      </div>

                      {arbData.map((opp, i) => {
                        const flag = MARKET_FLAGS[opp.buy_market] ?? "🌍"
                        const profitColor = opp.net_profit_pct > 10
                          ? "#10b981"
                          : opp.net_profit_pct >= 5
                            ? "#f59e0b"
                            : "#ef4444"
                        const profitBg = opp.net_profit_pct > 10
                          ? "rgba(16,185,129,0.1)"
                          : opp.net_profit_pct >= 5
                            ? "rgba(245,158,11,0.1)"
                            : "rgba(239,68,68,0.1)"
                        return (
                          <div
                            key={`${opp.ref_number}-${i}`}
                            className="border-t px-4 py-3 flex flex-col lg:grid gap-2 lg:gap-0 lg:items-center"
                            style={{
                              borderColor: "#1c1c2a",
                              background: i % 2 === 0 ? "#111119" : "#0d0d15",
                              gridTemplateColumns: "2.5fr 2fr 1fr 1fr 1fr 1fr 1.2fr 100px",
                            }}
                          >
                            {/* Watch */}
                            <div>
                              <p className="text-xs font-black font-mono text-white">{opp.ref_number}</p>
                              <p className="text-sm font-bold text-white mt-0.5">{opp.model_name ?? opp.brand}</p>
                              <p className="text-[11px]" style={{ color: BRAND_COLORS[opp.brand] ?? "#94a3b8" }}>{opp.brand}</p>
                            </div>
                            {/* Buy Market */}
                            <div className="flex items-start gap-1.5">
                              <span className="text-base leading-none mt-0.5">{flag}</span>
                              <div>
                                <p className="text-xs font-bold text-white">{opp.buy_market}</p>
                                <p className="text-xs font-mono" style={{ color: "#94a3b8" }}>
                                  {opp.buy_currency} {opp.buy_price_local.toLocaleString()}
                                </p>
                                <p className="text-[10px]" style={{ color: "#64748b" }}>
                                  {opp.buy_listing_count} listing{opp.buy_listing_count !== 1 ? "s" : ""}
                                </p>
                              </div>
                            </div>
                            {/* USD Equiv */}
                            <div className="hidden lg:block text-right">
                              <span className="text-xs font-mono text-white">{formatCurrency(opp.buy_price_usd)}</span>
                            </div>
                            {/* Sell US */}
                            <div className="hidden lg:block text-right">
                              <span className="text-xs font-black font-mono text-white">{formatCurrency(opp.sell_price_usd)}</span>
                              <p className="text-[10px]" style={{ color: "#64748b" }}>{opp.sell_listing_count} US listings</p>
                            </div>
                            {/* Import Costs */}
                            <div className="hidden lg:block text-right">
                              <span className="text-xs font-mono" style={{ color: "#ef4444" }}>
                                {formatCurrency(opp.import_costs_usd)}
                              </span>
                            </div>
                            {/* Net Profit $ */}
                            <div className="hidden lg:block text-right">
                              <span className="text-sm font-black font-mono" style={{ color: profitColor }}>
                                {opp.net_profit_usd >= 0 ? "+" : ""}{formatCurrency(opp.net_profit_usd)}
                              </span>
                            </div>
                            {/* Net % */}
                            <div className="hidden lg:flex justify-end">
                              <span
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold"
                                style={{ background: profitBg, color: profitColor }}
                              >
                                {opp.net_profit_pct > 0 ? "↑" : "↓"} {Math.abs(opp.net_profit_pct).toFixed(1)}%
                              </span>
                            </div>
                            {/* Action */}
                            <div className="hidden lg:flex justify-end">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                                style={{ background: "rgba(32,129,226,0.12)", color: "#60a5fa" }}>
                                {opp.sell_listing_count} US ask{opp.sell_listing_count !== 1 ? "s" : ""}
                              </span>
                            </div>
                            {/* Mobile summary */}
                            <div className="flex items-center justify-between lg:hidden">
                              <span className="text-xs font-mono" style={{ color: "#64748b" }}>
                                Buy {formatCurrency(opp.buy_price_usd)} · Sell {formatCurrency(opp.sell_price_usd)}
                              </span>
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                                style={{ background: profitBg, color: profitColor }}
                              >
                                {opp.net_profit_pct > 0 ? "↑" : "↓"} {Math.abs(opp.net_profit_pct).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Info note */}
                  <div className="rounded-lg border px-4 py-3 text-xs" style={{ background: "#0b0b14", borderColor: "#1c1c2a", color: "#64748b" }}>
                    ℹ️ Import costs include: shipping ($350) + US import duty (9.8%) + authentication ($200). Net profit is after all costs.
                  </div>

                  {/* Explainer (collapsible) */}
                  <div className="rounded-xl border overflow-hidden" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
                    <button
                      onClick={() => setArbExplainerOpen(o => !o)}
                      className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:opacity-90"
                    >
                      <span className="text-sm font-black text-white">How Arbitrage Works</span>
                      <span className="text-xs" style={{ color: "#64748b" }}>{arbExplainerOpen ? "▲ collapse" : "▼ expand"}</span>
                    </button>
                    {arbExplainerOpen && (
                      <div className="px-5 pb-5 border-t" style={{ borderColor: "#1c1c2a" }}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                          {[
                            { step: "1", title: "Find cheaper abroad", desc: "Identify watches listed in EU/CH markets below the US asking price" },
                            { step: "2", title: "Factor in costs", desc: "Add shipping ($350), 9.8% US import duty, and $200 authentication fee" },
                            { step: "3", title: "Sell in US market", desc: "List at the prevailing US market price after clearing customs" },
                            { step: "4", title: "Profit if spread > ~12%", desc: "The net spread must exceed ~12% to cover all costs and generate alpha" },
                          ].map((item) => (
                            <div key={item.step} className="flex gap-3">
                              <span
                                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
                                style={{ background: "rgba(32,129,226,0.15)", color: "#60a5fa" }}
                              >
                                {item.step}
                              </span>
                              <div>
                                <p className="text-sm font-bold text-white">{item.title}</p>
                                <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>{item.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })()}

        {/* ═══════════════════════════════════════════════════════════════════
            TAB: TRENDS
            ═══════════════════════════════════════════════════════════════════ */}
        {mainTab === "trends" && (() => {
          const surgingCount = trendsData.filter(r => r.trend_label === "surging").length
          const risingCount = trendsData.filter(r => r.trend_label === "rising").length
          const stableCount = trendsData.filter(r => r.trend_label === "stable").length
          const coolingCount = trendsData.filter(r => r.trend_label === "cooling").length
          const droppingCount = trendsData.filter(r => r.trend_label === "dropping").length

          const biggestMovers = [...trendsData]
            .sort((a, b) => Math.abs(b.momentum_30d) - Math.abs(a.momentum_30d))
            .slice(0, 10)

          const chartData = [...trendsData]
            .sort((a, b) => b.momentum_30d - a.momentum_30d)
            .slice(0, 15)
            .map(r => ({ ref_number: r.ref_number, momentum_30d: r.momentum_30d, brand: r.brand }))

          return (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <TrendingUp size={20} style={{ color: "#10b981" }} /> Price Trends
                </h2>
                <p className="text-xs mt-1" style={{ color: "#64748b" }}>
                  7d · 30d · 90d momentum across all tracked references
                </p>
              </div>

              {trendsLoading && (
                <div className="space-y-4 animate-pulse">
                  <div className="grid grid-cols-5 gap-3">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="rounded-xl h-20" style={{ background: "#111119" }} />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl h-80" style={{ background: "#111119" }} />
                    <div className="rounded-xl h-80" style={{ background: "#111119" }} />
                  </div>
                </div>
              )}

              {!trendsLoading && (
                <>
                  {/* 5 Trend Label Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {[
                      { label: "Surging", emoji: "🔥", desc: ">5% 30d", count: surgingCount, color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
                      { label: "Rising", emoji: "↑", desc: "2-5% 30d", count: risingCount, color: "#10b981", bg: "rgba(16,185,129,0.1)" },
                      { label: "Stable", emoji: "→", desc: "±2% 30d", count: stableCount, color: "#64748b", bg: "rgba(100,116,139,0.1)" },
                      { label: "Cooling", emoji: "↓", desc: "-2 to -5% 30d", count: coolingCount, color: "#eab308", bg: "rgba(234,179,8,0.1)" },
                      { label: "Dropping", emoji: "💀", desc: "<-5% 30d", count: droppingCount, color: "#dc2626", bg: "rgba(220,38,38,0.08)" },
                    ].map((card) => (
                      <div key={card.label} className="rounded-xl border p-4" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-base">{card.emoji}</span>
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: card.bg, color: card.color }}
                          >
                            {card.label}
                          </span>
                        </div>
                        <p className="text-2xl font-black font-mono" style={{ color: card.color }}>{card.count}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: "#475569" }}>{card.desc}</p>
                      </div>
                    ))}
                  </div>

                  {trendsData.length === 0 ? (
                    <div className="rounded-xl border p-12 text-center" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
                      <p className="text-white font-bold text-lg mb-2">No trend data</p>
                      <p className="text-sm" style={{ color: "#64748b" }}>Run the momentum tracker to populate trend analysis.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                      {/* LEFT: Biggest Movers */}
                      <div className="rounded-xl border overflow-hidden" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
                        <div className="px-4 py-3 border-b" style={{ borderColor: "#1c1c2a" }}>
                          <h3 className="text-sm font-black text-white">Biggest Movers (30d)</h3>
                          <p className="text-[11px] mt-0.5" style={{ color: "#64748b" }}>Gainers first, then losers</p>
                        </div>
                        <div className="divide-y" style={{ borderColor: "#1c1c2a" }}>
                          {biggestMovers.map((ref, i) => {
                            const isPositive = ref.momentum_30d >= 0
                            const color30d = isPositive ? "#10b981" : "#ef4444"
                            const trendConfig = {
                              surging: { color: "#ef4444", bg: "rgba(239,68,68,0.1)", label: "🔥 Surging" },
                              rising: { color: "#10b981", bg: "rgba(16,185,129,0.1)", label: "↑ Rising" },
                              stable: { color: "#64748b", bg: "rgba(100,116,139,0.1)", label: "→ Stable" },
                              cooling: { color: "#eab308", bg: "rgba(234,179,8,0.1)", label: "↓ Cooling" },
                              dropping: { color: "#dc2626", bg: "rgba(220,38,38,0.08)", label: "💀 Dropping" },
                            }[ref.trend_label] ?? { color: "#64748b", bg: "rgba(100,116,139,0.1)", label: ref.trend_label }
                            return (
                              <div key={`${ref.ref_number}-${i}`} className="px-4 py-3 flex items-center gap-3">
                                <span className="text-[11px] font-bold font-mono w-5 text-right shrink-0" style={{ color: "#475569" }}>
                                  {i + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-black font-mono text-white">{ref.ref_number}</p>
                                  <p className="text-[11px]" style={{ color: BRAND_COLORS[ref.brand] ?? "#94a3b8" }}>{ref.brand}</p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                                    style={{ background: "rgba(100,116,139,0.1)", color: "#64748b" }}>
                                    7d {ref.momentum_7d >= 0 ? "+" : ""}{ref.momentum_7d.toFixed(1)}%
                                  </span>
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold"
                                    style={{ background: isPositive ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: color30d }}>
                                    30d {ref.momentum_30d >= 0 ? "+" : ""}{ref.momentum_30d.toFixed(1)}%
                                  </span>
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                                    style={{ background: "rgba(100,116,139,0.1)", color: "#64748b" }}>
                                    90d {ref.momentum_90d >= 0 ? "+" : ""}{ref.momentum_90d.toFixed(1)}%
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                                  style={{ background: trendConfig.bg, color: trendConfig.color }}>
                                  {trendConfig.label}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* RIGHT: Price Momentum Chart */}
                      <div className="rounded-xl border overflow-hidden" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
                        <div className="px-4 py-3 border-b" style={{ borderColor: "#1c1c2a" }}>
                          <h3 className="text-sm font-black text-white">Price Momentum Chart</h3>
                          <p className="text-[11px] mt-0.5" style={{ color: "#64748b" }}>Top 15 by 30d momentum · green = up, red = down</p>
                        </div>
                        <div className="p-4">
                          {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 28)}>
                              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 50, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1c1c2a" horizontal={false} />
                                <XAxis
                                  type="number"
                                  stroke="#1c1c2a"
                                  tick={{ fill: "#64748b", fontSize: 10 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}%`}
                                />
                                <YAxis
                                  type="category"
                                  dataKey="ref_number"
                                  width={110}
                                  tick={{ fill: "#e2e8f0", fontSize: 10, fontFamily: "ui-monospace, monospace" }}
                                  axisLine={false}
                                  tickLine={false}
                                />
                                <Tooltip
                                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                content={({ active, payload }: any) => {
                                    if (!active || !payload?.length) return null
                                    const d = payload[0]?.payload as { ref_number: string; momentum_30d: number; brand: string }
                                    return (
                                      <div className="rounded-lg border p-2 text-xs shadow-xl"
                                        style={{ background: "#1a1a2e", borderColor: "#1c1c2a" }}>
                                        <p className="font-mono font-bold text-white">{d.ref_number}</p>
                                        <p className="text-[11px] mt-0.5" style={{ color: BRAND_COLORS[d.brand] ?? "#94a3b8" }}>{d.brand}</p>
                                        <p className="font-bold mt-1"
                                          style={{ color: d.momentum_30d >= 0 ? "#10b981" : "#ef4444" }}>
                                          {d.momentum_30d >= 0 ? "+" : ""}{d.momentum_30d.toFixed(1)}% (30d)
                                        </p>
                                      </div>
                                    )
                                  }}
                                />
                                <Bar dataKey="momentum_30d" radius={[0, 4, 4, 0]} maxBarSize={18}>
                                  {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`}
                                      fill={entry.momentum_30d >= 0 ? "#10b981" : "#ef4444"}
                                    />
                                  ))}
                                  <LabelList
                                    dataKey="momentum_30d"
                                    position="right"
                                    style={{ fill: "#94a3b8", fontSize: 9, fontFamily: "monospace" }}
                                    formatter={(v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`}
                                  />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-64 flex items-center justify-center" style={{ color: "#475569" }}>
                              No momentum data
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })()}

      </div>
    </AppLayout>
  )
}
