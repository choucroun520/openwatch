import { createClient } from "@/lib/supabase/server"
import AppLayout from "@/components/layout/app-layout"
import Link from "next/link"
import { ExternalLink, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { formatCurrency } from "@/lib/utils/currency"
import { shortTimeAgo } from "@/lib/utils/dates"

export const metadata = { title: "Analytics — OpenWatch" }
export const dynamic = "force-dynamic"

interface HeatRow {
  ref_number: string
  brand: string
  model: string | null
  avg_price: string | null
  floor_price: string | null
  total_listings: number
  total_sold_90d: number
  price_change_30d: string | null
  heat_score: string | null
}

interface RecentSale {
  id: string
  ref_number: string
  brand: string
  price: string
  condition: string | null
  source: string
  sold_at: string | null
  scraped_at: string
  listing_url: string | null
}

function PriceChangeBadge({ change }: { change: number }) {
  if (change > 0.5) return (
    <span className="flex items-center gap-0.5 text-xs font-bold" style={{ color: "#22c55e" }}>
      <TrendingUp size={11} />+{change.toFixed(1)}%
    </span>
  )
  if (change < -0.5) return (
    <span className="flex items-center gap-0.5 text-xs font-bold" style={{ color: "#ef4444" }}>
      <TrendingDown size={11} />{change.toFixed(1)}%
    </span>
  )
  return (
    <span className="flex items-center gap-0.5 text-xs font-bold" style={{ color: "#64748b" }}>
      <Minus size={11} />—
    </span>
  )
}

const TARGET_BRANDS = ["Rolex", "Audemars Piguet", "Patek Philippe", "Vacheron Constantin", "Richard Mille", "F.P. Journe"]

export default async function AnalyticsPage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [
    totalListingsResult,
    totalSoldResult,
    refsResult,
    lastUpdatedResult,
    trendingResult,
    recentSalesResult,
    brandStatsResult,
  ] = await Promise.all([
    db.from("market_data").select("id", { count: "exact", head: true }).eq("is_sold", false),
    db.from("market_data").select("id", { count: "exact", head: true }).eq("is_sold", true)
      .gte("scraped_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()),
    db.from("market_data").select("ref_number"),
    db.from("market_data").select("scraped_at").order("scraped_at", { ascending: false }).limit(1),
    db.from("ref_heat_index")
      .select("ref_number, brand, model, avg_price, floor_price, total_listings, total_sold_90d, price_change_30d, heat_score")
      .order("heat_score", { ascending: false })
      .limit(20),
    db.from("market_data")
      .select("id, ref_number, brand, price, condition, source, sold_at, scraped_at, listing_url")
      .eq("is_sold", true)
      .gt("price", 1000)
      .order("sold_at", { ascending: false, nullsFirst: false })
      .order("scraped_at", { ascending: false })
      .limit(10),
    db.from("ref_heat_index")
      .select("brand, avg_price, total_listings, heat_score, price_change_30d"),
  ])

  const refsTracked = new Set(
    (refsResult.data ?? []).map((r: { ref_number: string }) => r.ref_number)
  ).size

  const trendingRefs: HeatRow[] = trendingResult.data ?? []
  const recentSales: RecentSale[] = recentSalesResult.data ?? []

  // Build per-brand summary
  const brandMap = new Map<string, {
    avg_prices: number[]; heat_scores: number[]; changes: number[]; listings: number
  }>()
  for (const row of brandStatsResult.data ?? []) {
    if (!row.brand) continue
    if (!brandMap.has(row.brand)) brandMap.set(row.brand, { avg_prices: [], heat_scores: [], changes: [], listings: 0 })
    const e = brandMap.get(row.brand)!
    if (row.avg_price) e.avg_prices.push(parseFloat(row.avg_price))
    if (row.heat_score) e.heat_scores.push(parseFloat(row.heat_score))
    if (row.price_change_30d !== null) e.changes.push(parseFloat(row.price_change_30d))
    e.listings += row.total_listings ?? 0
  }

  const brandRows = TARGET_BRANDS.map(name => {
    const e = brandMap.get(name) ?? { avg_prices: [], heat_scores: [], changes: [], listings: 0 }
    return {
      brand: name,
      avg_price: e.avg_prices.length ? e.avg_prices.reduce((a, v) => a + v, 0) / e.avg_prices.length : 0,
      heat_score: e.heat_scores.length ? e.heat_scores.reduce((a, v) => a + v, 0) / e.heat_scores.length : 0,
      change_30d: e.changes.length ? e.changes.reduce((a, v) => a + v, 0) / e.changes.length : 0,
      listings: e.listings,
    }
  }).sort((a, b) => b.heat_score - a.heat_score)

  const lastUpdated = lastUpdatedResult.data?.[0]?.scraped_at

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ── Page header ── */}
        <div>
          <h1 className="text-2xl font-black text-white">Market Analytics</h1>
          <p className="text-sm mt-1" style={{ color: "#8A939B" }}>
            Real-time floor prices, trends, and market intelligence for luxury watches.
          </p>
        </div>

        {/* ── Top stats bar ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Active Listings", value: (totalListingsResult.count ?? 0).toLocaleString() },
            { label: "Confirmed Sales (90d)", value: (totalSoldResult.count ?? 0).toLocaleString() },
            { label: "Refs Tracked", value: refsTracked.toLocaleString() },
            { label: "Last Updated", value: lastUpdated ? shortTimeAgo(lastUpdated) : "—" },
          ].map(stat => (
            <div
              key={stat.label}
              className="rounded-xl border p-4"
              style={{ background: "#111119", borderColor: "#1c1c2a" }}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>
                {stat.label}
              </p>
              <p className="text-2xl font-black font-mono text-white mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* ── Brand Performance Table ── */}
        <section>
          <h2 className="text-lg font-black text-white mb-4">Brand Performance</h2>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#1c1c2a" }}>
            <div
              className="grid grid-cols-12 gap-3 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider"
              style={{ background: "#0b0b14", color: "#64748b" }}
            >
              <div className="col-span-4">Brand</div>
              <div className="col-span-2 text-right">Avg Price</div>
              <div className="col-span-2 text-right">30d Change</div>
              <div className="col-span-2 text-right">Heat Score</div>
              <div className="col-span-2 text-right">Listings</div>
            </div>
            {brandRows.map((row, i) => (
              <Link
                key={row.brand}
                href={`/trending?brand=${encodeURIComponent(row.brand)}`}
                className="grid grid-cols-12 gap-3 px-4 py-3 border-t items-center hover:opacity-80 transition-opacity"
                style={{ borderColor: "#1c1c2a", background: i % 2 === 0 ? "#111119" : "#0d0d15" }}
              >
                <div className="col-span-4">
                  <p className="text-sm font-bold text-white">{row.brand}</p>
                </div>
                <div className="col-span-2 text-right">
                  <p className="text-sm font-mono font-bold text-white">
                    {row.avg_price > 0 ? formatCurrency(row.avg_price) : "—"}
                  </p>
                </div>
                <div className="col-span-2 text-right">
                  <PriceChangeBadge change={row.change_30d} />
                </div>
                <div className="col-span-2 text-right">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{
                      background: row.heat_score > 10 ? "rgba(34,197,94,0.12)" : "rgba(100,116,139,0.12)",
                      color: row.heat_score > 10 ? "#22c55e" : "#94a3b8",
                    }}
                  >
                    {row.heat_score.toFixed(1)}
                  </span>
                </div>
                <div className="col-span-2 text-right">
                  <p className="text-sm font-mono text-white">{row.listings.toLocaleString()}</p>
                </div>
              </Link>
            ))}
            {brandRows.length === 0 && (
              <div className="px-4 py-8 text-center text-sm" style={{ color: "#8A939B", background: "#111119" }}>
                No brand data yet. Run the scraper to populate market_data.
              </div>
            )}
          </div>
        </section>

        {/* ── Trending Refs + Recent Sales (2 columns) ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Trending refs — 2/3 */}
          <div className="xl:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <TrendingUp size={18} style={{ color: "#2081E2" }} />
                Top Trending References
              </h2>
              <Link
                href="/trending"
                className="text-sm font-semibold hover:opacity-80 transition-opacity"
                style={{ color: "#2081E2" }}
              >
                See all →
              </Link>
            </div>

            <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#1c1c2a" }}>
              <div
                className="grid grid-cols-12 gap-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider"
                style={{ background: "#0b0b14", color: "#64748b" }}
              >
                <div className="col-span-3">Ref</div>
                <div className="col-span-3">Brand / Model</div>
                <div className="col-span-2 text-right">Floor</div>
                <div className="col-span-2 text-right">30d %</div>
                <div className="col-span-2 text-right">Listings</div>
              </div>

              {trendingRefs.map((row, i) => (
                <Link
                  key={`${row.ref_number}-${i}`}
                  href={`/ref/${encodeURIComponent(row.ref_number)}`}
                  className="grid grid-cols-12 gap-2 px-4 py-3 border-t items-center hover:opacity-80 transition-opacity"
                  style={{ borderColor: "#1c1c2a", background: i % 2 === 0 ? "#111119" : "#0d0d15" }}
                >
                  <div className="col-span-3">
                    <p className="text-xs font-bold font-mono text-white truncate">{row.ref_number}</p>
                  </div>
                  <div className="col-span-3 min-w-0">
                    <p className="text-[11px] font-semibold truncate" style={{ color: "#60a5fa" }}>{row.brand}</p>
                    {row.model && (
                      <p className="text-[10px] truncate" style={{ color: "#64748b" }}>{row.model}</p>
                    )}
                  </div>
                  <div className="col-span-2 text-right">
                    <p className="text-xs font-mono font-bold text-white">
                      {row.floor_price ? formatCurrency(parseFloat(row.floor_price)) : "—"}
                    </p>
                  </div>
                  <div className="col-span-2 text-right">
                    <PriceChangeBadge change={parseFloat(row.price_change_30d ?? "0")} />
                  </div>
                  <div className="col-span-2 text-right">
                    <p className="text-xs font-mono text-white">{row.total_listings}</p>
                  </div>
                </Link>
              ))}

              {trendingRefs.length === 0 && (
                <div className="px-4 py-8 text-center text-sm" style={{ color: "#8A939B", background: "#111119" }}>
                  No trending data yet. Run <code className="text-blue-400">node scripts/migrate-to-market-data.mjs</code>
                </div>
              )}
            </div>
          </div>

          {/* Recent sales — 1/3 */}
          <div className="xl:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-white">Recent Sales</h2>
              <Link
                href="/sold"
                className="text-sm font-semibold hover:opacity-80 transition-opacity"
                style={{ color: "#2081E2" }}
              >
                See all →
              </Link>
            </div>

            <div
              className="rounded-xl border overflow-hidden"
              style={{ background: "#111119", borderColor: "#1c1c2a" }}
            >
              {recentSales.map((sale, i) => (
                <div
                  key={sale.id}
                  className="px-4 py-3 border-t"
                  style={{ borderColor: i === 0 ? "transparent" : "#1c1c2a" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold font-mono text-white truncate">{sale.ref_number}</p>
                      <p className="text-[11px] truncate" style={{ color: "#60a5fa" }}>{sale.brand}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-medium capitalize"
                          style={{ background: "rgba(32,129,226,0.1)", color: "#60a5fa" }}
                        >
                          {sale.source}
                        </span>
                        {sale.condition && (
                          <span className="text-[10px]" style={{ color: "#64748b" }}>{sale.condition}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black font-mono text-white">
                        {formatCurrency(parseFloat(sale.price))}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: "#64748b" }}>
                        {sale.sold_at
                          ? shortTimeAgo(sale.sold_at)
                          : shortTimeAgo(sale.scraped_at)}
                      </p>
                      {sale.listing_url && (
                        <a
                          href={sale.listing_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] hover:text-blue-400 transition-colors"
                          style={{ color: "#64748b" }}
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink size={10} className="inline" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {recentSales.length === 0 && (
                <div className="px-4 py-8 text-center text-sm" style={{ color: "#8A939B" }}>
                  No sales data yet.
                </div>
              )}

              <div className="p-3 text-center border-t" style={{ borderColor: "#1c1c2a" }}>
                <Link
                  href="/sold"
                  className="text-xs font-semibold hover:opacity-80 transition-opacity"
                  style={{ color: "#2081E2" }}
                >
                  View all sales →
                </Link>
              </div>
            </div>
          </div>
        </div>

      </div>
    </AppLayout>
  )
}
