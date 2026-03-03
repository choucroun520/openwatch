"use client"

import { useState, useEffect } from "react"
import AppLayout from "@/components/layout/app-layout"
import Link from "next/link"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
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
} from "lucide-react"
import { formatCurrency, formatCompact } from "@/lib/utils/currency"
import { shortTimeAgo } from "@/lib/utils/dates"

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

// MSRP display info (for grey market table)
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
    <span
      className="inline-flex items-center gap-1.5 text-xs font-bold font-mono"
      style={{ color }}
    >
      <span
        className="inline-block w-2 h-2 rounded-full"
        style={{ backgroundColor: color }}
      />
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
  field,
  label,
  sortField,
  sortDir,
  onSort,
  className = "",
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

// ─── Custom Recharts Tooltip ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DistributionTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg border p-3 text-xs shadow-xl"
      style={{ background: "#111119", borderColor: "#1c1c2a", minWidth: 160 }}
    >
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
  return (
    <div
      className="rounded-lg border p-3 text-xs shadow-xl"
      style={{ background: "#111119", borderColor: "#1c1c2a" }}
    >
      <p className="font-mono font-bold text-white">{d.ref_number}</p>
      <p className="mt-0.5" style={{ color: BRAND_COLORS[d.brand] ?? "#94a3b8" }}>{d.brand}</p>
      <p className="font-bold text-white mt-1">{d.count} listings</p>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type SortField = "heat_score" | "floor" | "avg" | "listings" | "spread"

export default function AnalyticsPage() {
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("All")
  const [sortField, setSortField] = useState<SortField>("heat_score")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [refreshing, setRefreshing] = useState(false)

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

  useEffect(() => {
    fetchData()
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

  // ── Derived data ────────────────────────────────────────────────────────────

  const brandMap = new Map<string, BrandStat>()
  for (const b of data?.brands ?? []) brandMap.set(b.brand, b)

  // Filtered + sorted top refs
  const filteredRefs = (data?.top_refs ?? []).filter(
    (r) => activeTab === "All" || r.brand === activeTab
  )
  const sortedRefs = [...filteredRefs].sort((a, b) => {
    const av = a[sortField] ?? 0
    const bv = b[sortField] ?? 0
    return sortDir === "desc" ? bv - av : av - bv
  })

  // Price distribution chart data (grouped bars)
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

  // Supply chart data
  const supplyChartData = data?.supply_by_ref ?? []

  // Market pulse metrics
  const mostListedRef = sortedRefs.length > 0
    ? [...(data?.top_refs ?? [])].sort((a, b) => b.listings - a.listings)[0]
    : null
  const highestFloorRef = sortedRefs.length > 0
    ? [...(data?.top_refs ?? [])].sort((a, b) => b.floor - a.floor)[0]
    : null
  const widestSpreadRef = sortedRefs.length > 0
    ? [...(data?.top_refs ?? [])].sort((a, b) => b.spread - a.spread)[0]
    : null
  const hottestBrand = (data?.brands ?? []).length > 0
    ? [...(data?.brands ?? [])].sort((a, b) => b.heat_score - a.heat_score)[0]
    : null

  // Grey market refs with known MSRP
  const greyMarketRefs = (data?.top_refs ?? [])
    .filter((r) => r.msrp !== null && r.grey_market_premium_pct !== null)
    .sort((a, b) => (b.grey_market_premium_pct ?? 0) - (a.grey_market_premium_pct ?? 0))

  // ── Loading / error state ───────────────────────────────────────────────────

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto space-y-8 animate-pulse">
          <div>
            <div className="h-9 w-72 rounded-lg mb-2" style={{ background: "#111119" }} />
            <div className="h-4 w-96 rounded" style={{ background: "#111119" }} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl p-5 h-44" style={{ background: "#111119" }} />
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
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
          <div
            className="rounded-xl border p-8 text-center"
            style={{ background: "#111119", borderColor: "#1c1c2a" }}
          >
            <AlertTriangle className="mx-auto mb-3" size={32} style={{ color: "#ef4444" }} />
            <p className="text-white font-bold mb-1">Failed to load analytics</p>
            <p className="text-sm mb-4" style={{ color: "#8A939B" }}>{error ?? "Unknown error"}</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white"
              style={{ background: "#2081E2" }}
            >
              Retry
            </button>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ── Section 1: Page Header ──────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight" style={{ color: "#e2e8f0" }}>
              MARKET INTELLIGENCE
            </h1>
            <p className="text-sm mt-1" style={{ color: "#8A939B" }}>
              Real-time watch market analytics · Bloomberg Terminal for luxury watches
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs" style={{ color: "#64748b" }}>
            <span className="font-mono">
              {data.overview.total_listings.toLocaleString()} listings ·{" "}
              {data.overview.refs_tracked} refs ·{" "}
              {data.overview.brands_covered} brands
            </span>
            <span className="px-2 py-1 rounded font-bold"
              style={{ background: "#111119", color: data.overview.data_freshness_hours < 24 ? "#22c55e" : "#eab308" }}>
              {data.overview.last_updated
                ? `Updated ${shortTimeAgo(data.overview.last_updated)}`
                : "No data yet"}
            </span>
          </div>
        </div>

        {/* ── Section 2: Brand Cards ──────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: "#64748b" }}>
            Brand Overview
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 overflow-x-auto">
            {ALL_BRANDS.map((brand) => {
              const stat = brandMap.get(brand)
              const color = BRAND_COLORS[brand] ?? "#94a3b8"
              const slug = BRAND_SLUGS[brand]
              if (!stat) {
                return (
                  <div
                    key={brand}
                    className="rounded-xl border p-4 flex flex-col min-h-[160px]"
                    style={{ background: "#111119", borderColor: "#1c1c2a" }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ backgroundColor: "#475569" }}
                      />
                      <span className="text-xs font-bold truncate" style={{ color: "#64748b" }}>
                        {brand}
                      </span>
                    </div>
                    <p className="text-[11px] mt-auto" style={{ color: "#475569" }}>
                      No data yet
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: "#1c1c2a" }}>
                      Add a dealer to populate
                    </p>
                  </div>
                )
              }
              const heatPct = Math.min(100, (stat.heat_score / 30) * 100)
              return (
                <Link
                  key={brand}
                  href={`/brands/${slug}`}
                  className="rounded-xl border p-4 flex flex-col min-h-[160px] transition-all hover:scale-[1.02]"
                  style={{
                    background: "#111119",
                    borderColor: "#1c1c2a",
                    boxShadow: "0 1px 3px rgba(0,0,0,.3)",
                  }}
                >
                  {/* Brand name + trend */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs font-black truncate text-white">{brand}</span>
                    </div>
                    <PriceChangeBadge change={stat.change_30d} />
                  </div>

                  {/* Floor / Avg / Ceiling */}
                  <div className="grid grid-cols-3 gap-1 mb-3">
                    {[
                      { label: "Floor", val: stat.floor_price },
                      { label: "Avg", val: stat.avg_price },
                      { label: "Ceil", val: stat.ceiling_price },
                    ].map(({ label, val }) => (
                      <div key={label}>
                        <p className="text-[9px] font-bold uppercase" style={{ color: "#475569" }}>
                          {label}
                        </p>
                        <p className="text-[11px] font-black font-mono text-white">
                          {formatCompact(val)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Listings + refs */}
                  <p className="text-[10px] mb-2" style={{ color: "#64748b" }}>
                    {stat.total_listings.toLocaleString()} listings · {stat.refs_count} refs
                  </p>

                  {/* Heat bar */}
                  <div className="mt-auto">
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1c1c2a" }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${heatPct}%`, backgroundColor: color }}
                      />
                    </div>
                    <p className="text-[9px] mt-1 font-mono" style={{ color }}>
                      Heat: {stat.heat_score.toFixed(1)}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        {/* ── Section 3: Market Pulse ─────────────────────────────────────── */}
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
                sub: mostListedRef
                  ? `${mostListedRef.listings} listings · ${mostListedRef.brand}`
                  : "No data",
                href: mostListedRef ? `/ref/${mostListedRef.ref_number}` : undefined,
              },
              {
                icon: <DollarSign size={18} style={{ color: "#22c55e" }} />,
                label: "Highest Floor",
                value: highestFloorRef ? formatCompact(highestFloorRef.floor) : "—",
                sub: highestFloorRef
                  ? `${highestFloorRef.ref_number} · ${highestFloorRef.brand}`
                  : "No data",
                href: highestFloorRef ? `/ref/${highestFloorRef.ref_number}` : undefined,
              },
              {
                icon: <ArrowUpDown size={18} style={{ color: "#f59e0b" }} />,
                label: "Widest Spread",
                value: widestSpreadRef ? formatCompact(widestSpreadRef.spread) : "—",
                sub: widestSpreadRef
                  ? `${widestSpreadRef.ref_number} · ${widestSpreadRef.spread_pct.toFixed(0)}% range`
                  : "No data",
                href: widestSpreadRef ? `/ref/${widestSpreadRef.ref_number}` : undefined,
              },
              {
                icon: <Flame size={18} style={{ color: "#ef4444" }} />,
                label: "Hottest Brand",
                value: hottestBrand ? hottestBrand.brand : "—",
                sub: hottestBrand
                  ? `Heat: ${hottestBrand.heat_score.toFixed(1)} · ${hottestBrand.total_listings} listings`
                  : "No data",
                href: hottestBrand ? `/brands/${BRAND_SLUGS[hottestBrand.brand]}` : undefined,
              },
            ].map((card) => (
              <div key={card.label}>
                {card.href ? (
                  <Link
                    href={card.href}
                    className="rounded-xl border p-4 flex flex-col gap-1 hover:border-opacity-100 transition-all block"
                    style={{ background: "#111119", borderColor: "#1c1c2a" }}
                  >
                    <div className="flex items-center gap-2 mb-1">{card.icon}
                      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>
                        {card.label}
                      </span>
                    </div>
                    <p className="text-xl font-black font-mono text-white truncate">{card.value}</p>
                    <p className="text-[11px] truncate" style={{ color: "#8A939B" }}>{card.sub}</p>
                  </Link>
                ) : (
                  <div
                    className="rounded-xl border p-4 flex flex-col gap-1"
                    style={{ background: "#111119", borderColor: "#1c1c2a" }}
                  >
                    <div className="flex items-center gap-2 mb-1">{card.icon}
                      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>
                        {card.label}
                      </span>
                    </div>
                    <p className="text-xl font-black font-mono text-white truncate">{card.value}</p>
                    <p className="text-[11px] truncate" style={{ color: "#8A939B" }}>{card.sub}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 4: Price Distribution Chart ────────────────────────── */}
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
                    <XAxis
                      dataKey="bucket"
                      stroke="#1c1c2a"
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#1c1c2a"
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={35}
                    />
                    <Tooltip content={<DistributionTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                    <Legend
                      wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
                      iconType="circle"
                      iconSize={8}
                    />
                    {TARGET_BRANDS.map((brand) => (
                      <Bar
                        key={brand}
                        dataKey={brand}
                        fill={BRAND_COLORS[brand]}
                        radius={[3, 3, 0, 0]}
                        maxBarSize={40}
                      />
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

        {/* ── Section 5: Top Refs Table ───────────────────────────────────── */}
        <section>
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
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={
                      activeTab === tab
                        ? { background: "#2081E2", color: "#fff" }
                        : { background: "#0b0b14", color: "#8A939B" }
                    }
                  >
                    {tab === "Audemars Piguet" ? "AP" : tab === "Vacheron Constantin" ? "VC" : tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Table header */}
            <div
              className="hidden md:grid px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider"
              style={{
                background: "#0b0b14",
                color: "#64748b",
                gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr 1fr 1.5fr 1fr 1fr 1fr",
              }}
            >
              <div>Ref</div>
              <div>Model</div>
              <SortHeader field="floor" label="Floor" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="justify-end" />
              <SortHeader field="avg" label="Avg" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="justify-end" />
              <div className="text-right">Ceiling</div>
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
                      gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr 1fr 1.5fr 1fr 1fr 1fr",
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
                      <span className="text-xs font-semibold text-white truncate">
                        {ref.model ?? "—"}
                      </span>
                      <span className="text-[10px]" style={{ color: brandColor }}>{ref.brand}</span>
                    </div>
                    <div className="hidden md:block text-right">
                      <span className="text-xs font-mono text-white">{formatCompact(ref.floor)}</span>
                    </div>
                    <div className="hidden md:block text-right">
                      <span className="text-xs font-black font-mono text-white">{formatCompact(ref.avg)}</span>
                    </div>
                    <div className="hidden md:block text-right">
                      <span className="text-xs font-mono" style={{ color: "#94a3b8" }}>{formatCompact(ref.ceiling)}</span>
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
        </section>

        {/* ── Section 6: Hot Deals Feed ───────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span className="text-lg">🔥</span> Potential Deals
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
                Listings priced below market average for their reference
              </p>
            </div>
          </div>

          {data.deals.length === 0 ? (
            <div
              className="rounded-xl border p-8 text-center"
              style={{ background: "#111119", borderColor: "#1c1c2a" }}
            >
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
                  <div
                    key={i}
                    className="rounded-xl border overflow-hidden"
                    style={{ background: "#111119", borderColor: "#1c1c2a" }}
                  >
                    <div
                      className="px-4 py-2 text-xs font-bold uppercase tracking-wider"
                      style={{ background: "rgba(34,197,94,0.08)", color: "#22c55e" }}
                    >
                      -{deal.discount_pct}% below market
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <p className="text-xs font-black font-mono text-white">
                            {deal.ref_number}
                          </p>
                          <p className="text-sm font-bold text-white mt-0.5">
                            {deal.model ?? msrpInfo?.name ?? deal.ref_number}
                          </p>
                          <p className="text-[11px] mt-0.5" style={{ color: brandColor }}>
                            {deal.brand}
                          </p>
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
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-bold capitalize"
                            style={{ background: "rgba(32,129,226,0.12)", color: "#60a5fa" }}
                          >
                            {deal.source}
                          </span>
                          <span className="text-[10px]" style={{ color: "#475569" }}>
                            {shortTimeAgo(deal.scraped_at)}
                          </span>
                        </div>
                        {deal.listing_url && (
                          <a
                            href={deal.listing_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs font-bold hover:opacity-80 transition-opacity"
                            style={{ color: "#2081E2" }}
                            onClick={(e) => e.stopPropagation()}
                          >
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
        </section>

        {/* ── Section 7: Supply Analysis Chart ───────────────────────────── */}
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
                  <BarChart
                    data={supplyChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1c1c2a" horizontal={false} />
                    <XAxis
                      type="number"
                      stroke="#1c1c2a"
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="ref_number"
                      width={120}
                      tick={{ fill: "#e2e8f0", fontSize: 11, fontFamily: "ui-monospace, monospace" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<SupplyTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
                      {supplyChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={BRAND_COLORS[entry.brand] ?? "#6b7280"}
                        />
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

        {/* ── Section 8: Grey Market Premium Table ───────────────────────── */}
        {greyMarketRefs.length > 0 && (
          <section>
            <div className="rounded-xl border overflow-hidden" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
              <div className="px-5 py-4 border-b" style={{ borderColor: "#1c1c2a" }}>
                <h2 className="text-base font-black text-white">Grey Market vs. Retail</h2>
                <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
                  Asking-price premium above manufacturer retail — sorted by highest premium
                </p>
              </div>

              <div
                className="hidden md:grid px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider"
                style={{
                  background: "#0b0b14",
                  color: "#64748b",
                  gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1.5fr 1fr",
                }}
              >
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
                  <Link
                    key={`${ref.ref_number}-gm-${i}`}
                    href={`/ref/${encodeURIComponent(ref.ref_number)}`}
                    className="border-t px-4 py-3 transition-colors flex flex-col md:grid gap-2 md:gap-0 md:items-center hover:opacity-90"
                    style={{
                      borderColor: "#1c1c2a",
                      background: i % 2 === 0 ? "#111119" : "#0d0d15",
                      gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1.5fr 1fr",
                    }}
                  >
                    <div>
                      <p className="text-sm font-bold text-white">
                        {info?.name ?? ref.model ?? ref.ref_number}
                      </p>
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
                      <span className="text-xs font-black font-mono text-white">
                        {formatCurrency(ref.avg)}
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

                    {/* Mobile summary */}
                    <div className="flex items-center justify-between md:hidden">
                      <span className="text-xs font-mono" style={{ color: "#64748b" }}>{ref.ref_number}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono" style={{ color: "#64748b" }}>
                          MSRP {ref.msrp ? formatCompact(ref.msrp) : "—"}
                        </span>
                        <span className="text-xs font-black font-mono text-white">
                          avg {formatCompact(ref.avg)}
                        </span>
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

        {/* ── Section 9: Data Coverage ────────────────────────────────────── */}
        <section>
          <div
            className="rounded-xl border p-5"
            style={{ background: "#111119", borderColor: "#1c1c2a" }}
          >
            <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: "#64748b" }}>
              Data Coverage
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
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
                  <p className="text-sm font-bold" style={{ color: item.color }}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition-opacity disabled:opacity-50"
              style={{ background: "#1c1c2a" }}
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Refreshing…" : "Refresh Data"}
            </button>
          </div>
        </section>

      </div>
    </AppLayout>
  )
}
