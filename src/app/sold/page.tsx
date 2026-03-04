import { createClient } from "@/lib/supabase/server"
import AppLayout from "@/components/layout/app-layout"
import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { formatCurrency } from "@/lib/utils/currency"
import { shortTimeAgo } from "@/lib/utils/dates"

export const metadata = { title: "Recent Sales — OpenWatch" }
export const dynamic = "force-dynamic"

const TARGET_BRANDS = [
  "All",
  "Rolex",
  "Patek Philippe",
  "Audemars Piguet",
  "Vacheron Constantin",
  "Richard Mille",
  "F.P. Journe",
]

interface SaleRow {
  id: string
  ref_number: string
  brand: string
  model: string | null
  price: string
  condition: string | null
  has_box: boolean | null
  has_papers: boolean | null
  source: string
  dealer_name: string | null
  listing_url: string | null
  sold_at: string | null
  scraped_at: string
}

export default async function SoldPage({
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
    .from("market_data")
    .select("id, ref_number, brand, model, price, condition, has_box, has_papers, source, dealer_name, listing_url, sold_at, scraped_at")
    .eq("is_sold", true)
    .gt("price", 1000)
    .order("sold_at", { ascending: false, nullsFirst: false })
    .order("scraped_at", { ascending: false })
    .limit(100)

  if (brandFilter && brandFilter !== "All") {
    query = query.ilike("brand", `%${brandFilter}%`)
  }

  const { data: rows, error } = await query
  const sales: SaleRow[] = rows ?? []

  // Summary stats
  const totalSales = sales.length
  const prices = sales.map(s => parseFloat(s.price))
  const avgPrice = prices.length ? prices.reduce((a, v) => a + v, 0) / prices.length : 0
  const minPrice = prices.length ? Math.min(...prices) : 0
  const maxPrice = prices.length ? Math.max(...prices) : 0

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">

        <div>
          <h1 className="text-2xl font-black text-white">Recent Sales</h1>
          <p className="text-sm mt-1" style={{ color: "#8A939B" }}>
            Confirmed sold transactions from eBay and other sources. Real transaction prices.
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Showing", value: totalSales.toString() },
            { label: "Avg Price", value: avgPrice > 0 ? formatCurrency(avgPrice) : "—" },
            { label: "Low", value: minPrice > 0 ? formatCurrency(minPrice) : "—" },
            { label: "High", value: maxPrice > 0 ? formatCurrency(maxPrice) : "—" },
          ].map(s => (
            <div key={s.label} className="rounded-xl border p-4" style={{ background: "var(--ow-bg-card)", borderColor: "var(--ow-border)" }}>
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--ow-text-dim)" }}>{s.label}</p>
              <p className="text-xl font-black font-mono text-white mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Brand filter tabs */}
        <div className="flex flex-wrap gap-2">
          {TARGET_BRANDS.map(b => {
            const active = (!brandFilter && b === "All") || brandFilter === b
            return (
              <Link
                key={b}
                href={b === "All" ? "/sold" : `/sold?brand=${encodeURIComponent(b)}`}
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

        {/* Sales table */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--ow-border)" }}>
          <div
            className="grid grid-cols-12 gap-3 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider"
            style={{ background: "var(--ow-bg)", color: "var(--ow-text-dim)" }}
          >
            <div className="col-span-2">Ref</div>
            <div className="col-span-2">Brand</div>
            <div className="col-span-2 text-right">Price</div>
            <div className="col-span-2">Condition</div>
            <div className="col-span-1">B/P</div>
            <div className="col-span-1">Source</div>
            <div className="col-span-1">Dealer</div>
            <div className="col-span-1 text-right">Date</div>
          </div>

          {error ? (
            <div className="px-4 py-8 text-center text-sm" style={{ background: "var(--ow-bg-card)", color: "#ef4444" }}>
              Error loading sales data.
            </div>
          ) : sales.length === 0 ? (
            <div className="px-4 py-12 text-center" style={{ background: "var(--ow-bg-card)" }}>
              <p className="text-sm" style={{ color: "var(--ow-text-dim)" }}>
                No confirmed sales data yet.{" "}
                <code className="text-blue-400 text-xs">node scripts/scrape-ebay.mjs</code>
              </p>
            </div>
          ) : (
            sales.map((sale, i) => (
              <div
                key={sale.id}
                className="grid grid-cols-12 gap-3 px-4 py-3 border-t items-center"
                style={{ borderColor: "var(--ow-border)", background: i % 2 === 0 ? "var(--ow-bg-card)" : "#0d0d15" }}
              >
                <div className="col-span-2">
                  <Link
                    href={`/ref/${encodeURIComponent(sale.ref_number)}`}
                    className="text-xs font-bold font-mono truncate block hover:text-blue-400 transition-colors text-white"
                  >
                    {sale.ref_number}
                  </Link>
                </div>
                <div className="col-span-2">
                  <p className="text-[11px] font-semibold truncate" style={{ color: "#60a5fa" }}>{sale.brand}</p>
                  {sale.model && (
                    <p className="text-[10px] truncate" style={{ color: "var(--ow-text-dim)" }}>{sale.model}</p>
                  )}
                </div>
                <div className="col-span-2 text-right">
                  <p className="text-sm font-black font-mono text-white">{formatCurrency(parseFloat(sale.price))}</p>
                </div>
                <div className="col-span-2">
                  <span
                    className="text-[11px] capitalize"
                    style={{ color: sale.condition === "unworn" ? "#22c55e" : sale.condition === "excellent" ? "#60a5fa" : "var(--ow-text-muted)" }}
                  >
                    {sale.condition ?? "—"}
                  </span>
                </div>
                <div className="col-span-1">
                  <span className="text-[11px]" style={{ color: "var(--ow-text-dim)" }}>
                    {sale.has_box && sale.has_papers ? "B+P" : sale.has_box ? "B" : sale.has_papers ? "P" : "—"}
                  </span>
                </div>
                <div className="col-span-1">
                  <span
                    className="text-[11px] px-1.5 py-0.5 rounded font-medium capitalize"
                    style={{ background: "rgba(32,129,226,0.1)", color: "#60a5fa" }}
                  >
                    {sale.source}
                  </span>
                </div>
                <div className="col-span-1">
                  <p className="text-[10px] truncate" style={{ color: "var(--ow-text-dim)" }}>
                    {sale.dealer_name ?? "—"}
                  </p>
                </div>
                <div className="col-span-1 text-right flex items-center justify-end gap-1.5">
                  <p className="text-[10px]" style={{ color: "var(--ow-text-dim)" }}>
                    {sale.sold_at ? shortTimeAgo(sale.sold_at) : shortTimeAgo(sale.scraped_at)}
                  </p>
                  {sale.listing_url && (
                    <a
                      href={sale.listing_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors hover:text-blue-400 shrink-0"
                      style={{ color: "var(--ow-text-dim)" }}
                    >
                      <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </AppLayout>
  )
}
