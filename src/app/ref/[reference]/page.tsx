import { createClient } from "@/lib/supabase/server"
import AppLayout from "@/components/layout/app-layout"
import Link from "next/link"
import { ExternalLink, TrendingUp, TrendingDown } from "lucide-react"
import { formatCurrency } from "@/lib/utils/currency"
import { shortTimeAgo } from "@/lib/utils/dates"
import { PriceHistoryDualChart } from "@/components/charts/price-history-dual-chart"
import { MarketListingCard, dealerNameToSlug, type MarketDataRow } from "@/components/analytics/market-listing-card"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ reference: string }>
}) {
  const { reference } = await params
  return { title: `${reference} — Market Intelligence — OpenWatch` }
}

interface SaleRecord {
  id: string
  price: string
  condition: string | null
  source: string
  dealer_name: string | null
  listing_url: string | null
  sold_at: string | null
  scraped_at: string
}

interface Snapshot {
  snapshot_date: string
  floor_price: string | null
  avg_price: string | null
  ceiling_price: string | null
  listing_count: number
  sold_count: number
}

export default async function RefDeepDivePage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>
  searchParams: Promise<{ view?: string; source?: string; condition?: string; sort?: string }>
}) {
  const { reference } = await params
  const { view = "grid", source: srcFilter, condition: condFilter, sort = "price_asc" } = await searchParams
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Build listings query with optional filters
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let listingsQuery: any = db
    .from("market_data")
    .select("id, ref_number, brand, model, price, condition, has_box, has_papers, source, dealer_name, dealer_country, listing_url, listed_at, scraped_at, image_url")
    .eq("ref_number", reference)
    .eq("is_sold", false)
    .gt("price", 1000)

  if (srcFilter) listingsQuery = listingsQuery.eq("source", srcFilter)
  if (condFilter) listingsQuery = listingsQuery.eq("condition", condFilter)

  if (sort === "price_asc") listingsQuery = listingsQuery.order("price", { ascending: true })
  else if (sort === "price_desc") listingsQuery = listingsQuery.order("price", { ascending: false })
  else if (sort === "newest") listingsQuery = listingsQuery.order("scraped_at", { ascending: false })
  else listingsQuery = listingsQuery.order("price", { ascending: true })

  listingsQuery = listingsQuery.limit(60)

  const [
    marketStatsResult,
    soldStatsResult,
    listingsResult,
    salesResult,
    snapshotsResult,
    trendResult,
  ] = await Promise.all([
    db.from("ref_market_stats").select("*").eq("ref_number", reference).maybeSingle(),
    db.from("ref_sold_stats").select("*").eq("ref_number", reference).maybeSingle(),
    listingsQuery,
    db.from("market_data")
      .select("id, price, condition, source, dealer_name, listing_url, sold_at, scraped_at")
      .eq("ref_number", reference)
      .eq("is_sold", true)
      .gt("price", 1000)
      .order("sold_at", { ascending: false, nullsFirst: false })
      .order("scraped_at", { ascending: false })
      .limit(30),
    db.from("price_snapshots_v2")
      .select("snapshot_date, floor_price, avg_price, ceiling_price, listing_count, sold_count")
      .eq("ref_number", reference)
      .order("snapshot_date", { ascending: true })
      .limit(90),
    db.from("ref_price_trend")
      .select("current_avg, prior_avg, change_pct_30d")
      .eq("ref_number", reference)
      .maybeSingle(),
  ])

  const marketStats = marketStatsResult.data
  const soldStats = soldStatsResult.data
  const listings: MarketDataRow[] = listingsResult.data ?? []
  const sales: SaleRecord[] = salesResult.data ?? []
  const snapshots: Snapshot[] = snapshotsResult.data ?? []
  const trend = trendResult.data

  const brandName = marketStats?.brand ?? null
  const modelName = marketStats?.model ?? null
  const change30d = trend ? parseFloat(trend.change_pct_30d) : null

  const chartData = snapshots
    .filter((s: Snapshot) => s.avg_price)
    .map((s: Snapshot) => ({
      date: s.snapshot_date,
      label: new Date(s.snapshot_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      avg_asking: s.avg_price ? parseFloat(s.avg_price) : null,
      floor: s.floor_price ? parseFloat(s.floor_price) : null,
    }))

  const hasChartData = chartData.length > 1

  // Build filter URL helper
  function filterUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams()
    if (view !== "grid") p.set("view", view)
    if (srcFilter) p.set("source", srcFilter)
    if (condFilter) p.set("condition", condFilter)
    if (sort !== "price_asc") p.set("sort", sort)
    Object.entries(overrides).forEach(([k, v]) => { if (v) p.set(k, v); else p.delete(k) })
    const qs = p.toString()
    return `/ref/${encodeURIComponent(reference)}${qs ? `?${qs}` : ""}`
  }

  const sources = [...new Set(listings.map(l => l.source).filter(Boolean))]
  const conditions = [...new Set(listings.map(l => l.condition).filter(Boolean))]

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <nav className="text-sm mb-6 flex items-center gap-2" style={{ color: "#64748b" }}>
          <Link href="/analytics" className="hover:text-white transition-colors">Analytics</Link>
          <span>/</span>
          <Link href="/trending" className="hover:text-white transition-colors">Trending</Link>
          {brandName && (
            <>
              <span>/</span>
              <Link
                href={`/brands/${brandNameToSlug(brandName)}`}
                className="hover:text-white transition-colors"
              >
                {brandName}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-white font-mono">{reference}</span>
        </nav>

        <div className="mb-6">
          {brandName && (
            <p className="text-sm font-bold mb-1" style={{ color: "#60a5fa" }}>{brandName}</p>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-black text-white font-mono">{reference}</h1>
            {modelName && (
              <span className="text-xl font-semibold" style={{ color: "#8A939B" }}>{modelName}</span>
            )}
            {change30d !== null && (
              <span
                className="flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded-full"
                style={{
                  background: change30d > 0 ? "rgba(34,197,94,0.12)" : change30d < 0 ? "rgba(239,68,68,0.12)" : "rgba(100,116,139,0.12)",
                  color: change30d > 0 ? "#22c55e" : change30d < 0 ? "#ef4444" : "#94a3b8",
                }}
              >
                {change30d > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {change30d > 0 ? "+" : ""}{change30d.toFixed(1)}% 30d
              </span>
            )}
          </div>
          <p className="text-sm mt-1" style={{ color: "#64748b" }}>
            Market intelligence · asking prices + confirmed sales
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {[
            { label: "Floor (Asking)", value: marketStats?.floor_price ? formatCurrency(parseFloat(marketStats.floor_price)) : "—" },
            { label: "Avg (Asking)", value: marketStats?.avg_price ? formatCurrency(parseFloat(marketStats.avg_price)) : "—" },
            { label: "Ceiling", value: marketStats?.ceiling_price ? formatCurrency(parseFloat(marketStats.ceiling_price)) : "—" },
            { label: "Sold Avg (90d)", value: soldStats?.sold_avg ? formatCurrency(parseFloat(soldStats.sold_avg)) : "—" },
            { label: "Listed Now", value: (marketStats?.total_listings ?? 0).toString() },
            { label: "Sales (90d)", value: (soldStats?.total_sold ?? 0).toString() },
          ].map(s => (
            <div key={s.label} className="rounded-xl border p-3" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>{s.label}</p>
              <p className="text-xl font-black font-mono text-white mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {hasChartData ? (
          <div className="rounded-2xl border p-5 mb-8" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
            <p className="text-sm font-semibold text-white mb-1">Price History</p>
            <p className="text-xs mb-4" style={{ color: "#64748b" }}>Daily floor + avg asking price snapshots</p>
            <PriceHistoryDualChart data={chartData} height={220} />
          </div>
        ) : (
          <div className="rounded-2xl border p-5 mb-8 text-center" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
            <p className="text-sm" style={{ color: "#64748b" }}>
              Price history builds over time.{" "}
              <code className="text-blue-400 text-xs">node scripts/snapshot-prices.mjs</code> seeds today&apos;s data.
            </p>
          </div>
        )}

        {/* ── All Listings — OpenSea-style grid ── */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-lg font-black text-white">All Listings ({listings.length})</h2>

            {/* Filter + sort row */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Source filter */}
              {sources.length > 1 && (
                <div className="flex gap-1">
                  <Link
                    href={filterUrl({ source: "" })}
                    className="px-2 py-1 rounded text-[11px] font-semibold transition-colors"
                    style={{
                      background: !srcFilter ? "#2081E2" : "#111119",
                      color: !srcFilter ? "#fff" : "#8A939B",
                      border: `1px solid ${!srcFilter ? "#2081E2" : "#1c1c2a"}`,
                    }}
                  >All</Link>
                  {sources.map(s => (
                    <Link
                      key={s}
                      href={filterUrl({ source: s ?? "" })}
                      className="px-2 py-1 rounded text-[11px] font-semibold transition-colors capitalize"
                      style={{
                        background: srcFilter === s ? "#2081E2" : "#111119",
                        color: srcFilter === s ? "#fff" : "#8A939B",
                        border: `1px solid ${srcFilter === s ? "#2081E2" : "#1c1c2a"}`,
                      }}
                    >
                      {s}
                    </Link>
                  ))}
                </div>
              )}

              {/* Sort */}
              {(["price_asc", "price_desc", "newest"] as const).map(s => {
                const label = s === "price_asc" ? "Price ↑" : s === "price_desc" ? "Price ↓" : "Newest"
                return (
                  <Link
                    key={s}
                    href={filterUrl({ sort: s })}
                    className="px-2 py-1 rounded text-[11px] font-semibold transition-colors"
                    style={{
                      background: sort === s ? "#1c1c2a" : "transparent",
                      color: sort === s ? "#ffffff" : "#64748b",
                      border: `1px solid ${sort === s ? "#333333" : "transparent"}`,
                    }}
                  >
                    {label}
                  </Link>
                )
              })}
            </div>
          </div>

          {listings.length === 0 ? (
            <div className="rounded-xl border py-12 text-center" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
              <p className="text-sm" style={{ color: "#64748b" }}>No active listings for this reference.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {listings.map(listing => (
                <MarketListingCard
                  key={listing.id}
                  listing={listing}
                  showDealer={true}
                  showSource={true}
                  showRef={false}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Recent Sales ── */}
        <section className="mb-8">
          <h2 className="text-lg font-black text-white mb-4">Recent Sales ({sales.length})</h2>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#1c1c2a" }}>
            <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[11px] font-bold uppercase tracking-wider" style={{ background: "#0b0b14", color: "#64748b" }}>
              <div className="col-span-3">Price</div>
              <div className="col-span-3">Condition</div>
              <div className="col-span-3">Source / Dealer</div>
              <div className="col-span-3 text-right">Date</div>
            </div>
            {sales.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm" style={{ background: "#111119", color: "#64748b" }}>No confirmed sales.</div>
            ) : sales.map((s, i) => {
              const dealerSlug = s.dealer_name ? dealerNameToSlug(s.dealer_name) : null
              return (
                <div
                  key={s.id}
                  className="grid grid-cols-12 gap-2 px-4 py-2.5 border-t items-center"
                  style={{ borderColor: "#1c1c2a", background: i % 2 === 0 ? "#111119" : "#0d0d15" }}
                >
                  <div className="col-span-3 flex items-center gap-1.5">
                    <p className="text-sm font-black font-mono text-white">{formatCurrency(parseFloat(s.price))}</p>
                    {s.listing_url && (
                      <a href={s.listing_url} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-blue-400 shrink-0" style={{ color: "#64748b" }}>
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                  <div className="col-span-3">
                    <span className="text-[11px] capitalize" style={{ color: "#94a3b8" }}>{s.condition ?? "—"}</span>
                  </div>
                  <div className="col-span-3">
                    <span className="text-[11px] px-1.5 py-0.5 rounded font-medium capitalize" style={{ background: "rgba(32,129,226,0.1)", color: "#60a5fa" }}>{s.source}</span>
                    {s.dealer_name && dealerSlug && (
                      <Link
                        href={`/dealers/${dealerSlug}`}
                        className="block text-[10px] mt-0.5 hover:underline truncate"
                        style={{ color: "#64748b" }}
                      >
                        {s.dealer_name}
                      </Link>
                    )}
                  </div>
                  <div className="col-span-3 text-right">
                    <p className="text-[11px]" style={{ color: "#64748b" }}>{s.sold_at ? shortTimeAgo(s.sold_at) : shortTimeAgo(s.scraped_at)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {marketStats && (
          <div className="rounded-xl border p-5" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
            <h3 className="text-sm font-black text-white mb-3">Market Intelligence</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: "#64748b" }}>Asking vs Sold</p>
                <p className="font-mono font-bold text-white">
                  {soldStats?.sold_avg && marketStats.avg_price
                    ? `${((parseFloat(marketStats.avg_price) - parseFloat(soldStats.sold_avg)) / parseFloat(soldStats.sold_avg) * 100).toFixed(1)}% above sold avg`
                    : "Insufficient data"}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: "#64748b" }}>Price Spread</p>
                <p className="font-mono font-bold text-white">
                  {marketStats.floor_price && marketStats.ceiling_price
                    ? `${formatCurrency(parseFloat(marketStats.floor_price))} → ${formatCurrency(parseFloat(marketStats.ceiling_price))}`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: "#64748b" }}>Buy Signal</p>
                {marketStats.floor_price && marketStats.avg_price ? (
                  parseFloat(marketStats.floor_price) < parseFloat(marketStats.avg_price) * 0.9 ? (
                    <span className="font-bold" style={{ color: "#22c55e" }}>🟢 Below avg — potential value</span>
                  ) : parseFloat(marketStats.floor_price) > parseFloat(marketStats.avg_price) * 1.1 ? (
                    <span className="font-bold" style={{ color: "#ef4444" }}>🔴 Above avg — overpriced</span>
                  ) : (
                    <span className="font-bold" style={{ color: "#94a3b8" }}>🟡 At market rate</span>
                  )
                ) : (
                  <span style={{ color: "#64748b" }}>Insufficient data</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function brandNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}
