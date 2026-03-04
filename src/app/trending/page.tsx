import { createClient } from "@/lib/supabase/server"
import AppLayout from "@/components/layout/app-layout"
import Link from "next/link"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { formatCurrency } from "@/lib/utils/currency"

export const metadata = { title: "Trending References — OpenWatch" }
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

const TARGET_BRANDS = [
  "All",
  "Rolex",
  "Patek Philippe",
  "Audemars Piguet",
  "Vacheron Constantin",
  "Richard Mille",
  "F.P. Journe",
]

function PriceChange({ change }: { change: number }) {
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
    <span className="flex items-center gap-0.5 text-xs font-bold" style={{ color: "var(--ow-text-dim)" }}>
      <Minus size={11} />—
    </span>
  )
}

export default async function TrendingPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>
}) {
  const { brand: brandFilter } = await searchParams
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = db
    .from("ref_heat_index")
    .select("ref_number, brand, model, avg_price, floor_price, total_listings, total_sold_90d, price_change_30d, heat_score")
    .order("heat_score", { ascending: false })
    .limit(100)

  if (brandFilter && brandFilter !== "All") {
    query = query.ilike("brand", `%${brandFilter}%`)
  }

  const { data: rows, error } = await query
  const heatRows: HeatRow[] = rows ?? []

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">

        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <TrendingUp size={22} style={{ color: "#2081E2" }} />
            Trending References
          </h1>
          <p className="text-sm mt-1" style={{ color: "#8A939B" }}>
            Ranked by heat score — combines listing volume, confirmed sales, and 30d price trend.
          </p>
        </div>

        {/* Brand filter tabs */}
        <div className="flex flex-wrap gap-2">
          {TARGET_BRANDS.map(b => {
            const active = (!brandFilter && b === "All") || brandFilter === b
            return (
              <Link
                key={b}
                href={b === "All" ? "/trending" : `/trending?brand=${encodeURIComponent(b)}`}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                style={{
                  background: active ? "#2081E2" : "var(--ow-bg-card)",
                  color: active ? "#ffffff" : "#8A939B",
                  border: `1px solid ${active ? "#2081E2" : "var(--ow-border)"}`,
                }}
              >
                {b}
              </Link>
            )
          })}
        </div>

        {/* Table */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--ow-border)" }}>
          <div
            className="grid grid-cols-12 gap-3 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider"
            style={{ background: "var(--ow-bg)", color: "var(--ow-text-dim)" }}
          >
            <div className="col-span-1 text-center">#</div>
            <div className="col-span-3">Reference</div>
            <div className="col-span-2">Brand / Model</div>
            <div className="col-span-2 text-right">Floor</div>
            <div className="col-span-1 text-right">30d %</div>
            <div className="col-span-1 text-right">Listed</div>
            <div className="col-span-1 text-right">Sold 90d</div>
            <div className="col-span-1 text-right">Heat</div>
          </div>

          {error ? (
            <div className="px-4 py-8 text-center text-sm" style={{ background: "var(--ow-bg-card)", color: "#ef4444" }}>
              Error loading trending data.
            </div>
          ) : heatRows.length === 0 ? (
            <div className="px-4 py-12 text-center" style={{ background: "var(--ow-bg-card)" }}>
              <p className="text-sm" style={{ color: "var(--ow-text-dim)" }}>
                No trending data yet.{" "}
                <code className="text-blue-400 text-xs">node scripts/migrate-to-market-data.mjs</code>
              </p>
            </div>
          ) : (
            heatRows.map((row, i) => {
              const change = parseFloat(row.price_change_30d ?? "0")
              const heat = parseFloat(row.heat_score ?? "0")
              return (
                <Link
                  key={`${row.ref_number}-${i}`}
                  href={`/ref/${encodeURIComponent(row.ref_number)}`}
                  className="grid grid-cols-12 gap-3 px-4 py-3 border-t items-center hover:opacity-80 transition-opacity"
                  style={{ borderColor: "var(--ow-border)", background: i % 2 === 0 ? "var(--ow-bg-card)" : "#0d0d15" }}
                >
                  <div className="col-span-1 text-center">
                    <span className="text-sm font-mono" style={{ color: "var(--ow-text-dim)" }}>{i + 1}</span>
                  </div>
                  <div className="col-span-3">
                    <p className="text-sm font-bold font-mono text-white truncate">{row.ref_number}</p>
                  </div>
                  <div className="col-span-2 min-w-0">
                    <p className="text-[11px] font-semibold truncate" style={{ color: "#60a5fa" }}>{row.brand}</p>
                    {row.model && (
                      <p className="text-[10px] truncate" style={{ color: "var(--ow-text-dim)" }}>{row.model}</p>
                    )}
                  </div>
                  <div className="col-span-2 text-right">
                    <p className="text-sm font-mono font-bold text-white">
                      {row.floor_price ? formatCurrency(parseFloat(row.floor_price)) : "—"}
                    </p>
                    {row.avg_price && (
                      <p className="text-[10px] font-mono" style={{ color: "var(--ow-text-dim)" }}>
                        avg {formatCurrency(parseFloat(row.avg_price))}
                      </p>
                    )}
                  </div>
                  <div className="col-span-1 text-right">
                    <PriceChange change={change} />
                  </div>
                  <div className="col-span-1 text-right">
                    <span className="text-sm font-mono text-white">{row.total_listings}</span>
                  </div>
                  <div className="col-span-1 text-right">
                    <span className="text-sm font-mono text-white">{row.total_sold_90d}</span>
                  </div>
                  <div className="col-span-1 text-right">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
                      style={{
                        background: heat > 20 ? "rgba(234,179,8,0.12)" : heat > 10 ? "rgba(34,197,94,0.12)" : "rgba(100,116,139,0.12)",
                        color: heat > 20 ? "#eab308" : heat > 10 ? "#22c55e" : "var(--ow-text-muted)",
                      }}
                    >
                      {heat.toFixed(1)}
                    </span>
                  </div>
                </Link>
              )
            })
          )}
        </div>

        <p className="text-xs text-center" style={{ color: "var(--ow-text-faint)" }}>
          Heat score = (listings × 0.3) + (sales × 0.4) + (price trend × 0.3) · Asking data: last 30d · Sales: last 90d
        </p>
      </div>
    </AppLayout>
  )
}
