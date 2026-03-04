import { createClient } from "@/lib/supabase/server"
import AppLayout from "@/components/layout/app-layout"
import Link from "next/link"
import { TrendingUp, TrendingDown, Minus, Flame } from "lucide-react"
import { formatCurrency } from "@/lib/utils/currency"

// Known MSRP for premium/discount display
const MSRP_MAP: Record<string, number> = {
  "126610LN": 9100, "126610LV": 9100, "126710BLRO": 10800, "126710BLNR": 10800,
  "126720VTNR": 10800, "126500LN": 14800, "124060": 8100, "126333": 9750,
  "228238": 36100, "326938": 29500, "5711/1A-011": 31000, "5726/1A-001": 59500,
  "15510ST.OO.1320ST.06": 22100, "26240ST.OO.1320ST.02": 29900,
  "26331ST.OO.1220ST.03": 28900, "4500V/110A-B128": 22900,
}

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
            <div className="col-span-2">Reference</div>
            <div className="col-span-2">Brand / Model</div>
            <div className="col-span-2 text-right">Floor / Avg</div>
            <div className="col-span-1 text-right">vs MSRP</div>
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
              const changeRaw = row.price_change_30d
              const change = changeRaw !== null && changeRaw !== undefined ? parseFloat(String(changeRaw)) : null
              const heatRaw = row.heat_score
              const heat = heatRaw !== null && heatRaw !== undefined ? parseFloat(String(heatRaw)) : null
              const avgPrice = row.avg_price ? parseFloat(row.avg_price) : null
              const msrp = MSRP_MAP[row.ref_number]
              const premiumPct = msrp && msrp > 0 && avgPrice && avgPrice > 0
                ? ((avgPrice - msrp) / msrp) * 100
                : null
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
                  <div className="col-span-2">
                    <p className="text-sm font-bold font-mono text-white truncate">{row.ref_number}</p>
                    <span
                      className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5"
                      style={{ background: "rgba(32,129,226,0.1)", color: "#60a5fa" }}
                    >
                      {row.total_listings} listed
                    </span>
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
                    {avgPrice && (
                      <p className="text-[10px] font-mono" style={{ color: "var(--ow-text-dim)" }}>
                        avg {formatCurrency(avgPrice)}
                      </p>
                    )}
                  </div>
                  <div className="col-span-1 text-right">
                    {premiumPct !== null ? (
                      <span
                        className="text-[10px] font-bold"
                        style={{ color: premiumPct > 0 ? "#22c55e" : "#ef4444" }}
                      >
                        {premiumPct > 0 ? "+" : ""}{premiumPct.toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-[10px]" style={{ color: "var(--ow-text-faint)" }}>—</span>
                    )}
                  </div>
                  <div className="col-span-1 text-right">
                    {change !== null && (change > 0.5 || change < -0.5) ? (
                      <PriceChange change={change} />
                    ) : (
                      <span className="flex items-center justify-end gap-0.5 text-xs font-bold" style={{ color: "var(--ow-text-dim)" }}>
                        <Minus size={11} />—
                      </span>
                    )}
                  </div>
                  <div className="col-span-1 text-right">
                    <span className="text-sm font-mono text-white">{row.total_listings}</span>
                  </div>
                  <div className="col-span-1 text-right">
                    <span className="text-sm font-mono" style={{ color: row.total_sold_90d > 0 ? "var(--ow-text)" : "var(--ow-text-dim)" }}>
                      {row.total_sold_90d > 0 ? row.total_sold_90d : "—"}
                    </span>
                  </div>
                  <div className="col-span-1 text-right">
                    {heat !== null && heat > 0 ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{
                          background: heat > 20 ? "rgba(234,179,8,0.12)" : heat > 10 ? "rgba(34,197,94,0.12)" : "rgba(100,116,139,0.12)",
                          color: heat > 20 ? "#eab308" : heat > 10 ? "#22c55e" : "var(--ow-text-muted)",
                        }}
                      >
                        {heat > 20 && <Flame size={10} />}
                        {heat.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--ow-text-faint)" }}>—</span>
                    )}
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
