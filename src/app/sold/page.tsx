import { createClient } from "@/lib/supabase/server"
import AppLayout from "@/components/layout/app-layout"
import Link from "next/link"
import { ExternalLink, Package } from "lucide-react"
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

interface MarketCompRow {
  id: string
  reference_number: string
  brand_name: string | null
  price: string
  source: string
  seller_name: string | null
  listing_url: string | null
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

  // Try to get confirmed sold rows from market_data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let soldQuery = db
    .from("market_data")
    .select("id, ref_number, brand, model, price, condition, has_box, has_papers, source, dealer_name, listing_url, sold_at, scraped_at")
    .eq("is_sold", true)
    .gt("price", 1000)
    .order("sold_at", { ascending: false, nullsFirst: false })
    .order("scraped_at", { ascending: false })
    .limit(100)

  if (brandFilter && brandFilter !== "All") {
    soldQuery = soldQuery.ilike("brand", `%${brandFilter}%`)
  }

  const { data: soldRows } = await soldQuery
  const sales: SaleRow[] = soldRows ?? []

  // If no confirmed sales, fall back to market_comps (current listings)
  let isFallback = false
  let compsRows: MarketCompRow[] = []

  if (sales.length === 0) {
    isFallback = true

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let compsQuery = db
      .from("market_comps")
      .select("id, reference_number, brand_name, price, source, seller_name, listing_url, scraped_at")
      .gt("price", 1000)
      .order("scraped_at", { ascending: false })
      .limit(100)

    if (brandFilter && brandFilter !== "All") {
      compsQuery = compsQuery.ilike("brand_name", `%${brandFilter}%`)
    }

    const { data: comps } = await compsQuery
    compsRows = comps ?? []
  }

  const displayRows = isFallback ? compsRows : sales

  // Summary stats
  const prices = isFallback
    ? compsRows.map(r => parseFloat(r.price))
    : sales.map(s => parseFloat(s.price))
  const totalCount = displayRows.length
  const avgPrice = prices.length ? prices.reduce((a, v) => a + v, 0) / prices.length : 0
  const minPrice = prices.length ? Math.min(...prices) : 0
  const maxPrice = prices.length ? Math.max(...prices) : 0

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">

        <div>
          <h1 className="text-2xl font-black text-white">Recent Sales</h1>
          <p className="text-sm mt-1" style={{ color: "#8A939B" }}>
            {isFallback
              ? "Market listings from tracked dealers"
              : "Confirmed sold transactions from eBay and other sources. Real transaction prices."}
          </p>
        </div>

        {/* Fallback banner */}
        {isFallback && (
          <div
            className="rounded-xl border px-4 py-3 text-sm flex items-center gap-2"
            style={{ background: "rgba(32,129,226,0.08)", borderColor: "rgba(32,129,226,0.2)", color: "#60a5fa" }}
          >
            <Package size={14} />
            Confirmed sale records coming soon — showing current market listings
          </div>
        )}

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Showing", value: totalCount.toString() },
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

        {/* Table */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--ow-border)" }}>
          <div
            className="grid grid-cols-12 gap-3 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider"
            style={{ background: "var(--ow-bg)", color: "var(--ow-text-dim)" }}
          >
            <div className="col-span-2">Ref</div>
            <div className="col-span-2">Brand</div>
            <div className="col-span-2 text-right">Price</div>
            <div className="col-span-2">{isFallback ? "Seller" : "Condition"}</div>
            <div className="col-span-1">{isFallback ? "" : "B/P"}</div>
            <div className="col-span-1">Source</div>
            <div className="col-span-1">Dealer</div>
            <div className="col-span-1 text-right">Date</div>
          </div>

          {displayRows.length === 0 ? (
            <div
              style={{ border: "1px dashed var(--ow-border)", borderRadius: 12, padding: "48px 24px", textAlign: "center", margin: 16 }}
            >
              <Package size={32} style={{ color: "var(--ow-text-dim)", margin: "0 auto 12px" }} />
              <p style={{ color: "var(--ow-text-muted)", fontWeight: 600, marginBottom: 4 }}>No data yet</p>
              <p style={{ color: "var(--ow-text-dim)", fontSize: 13 }}>Run the market scraper to populate listings.</p>
            </div>
          ) : isFallback ? (
            compsRows.map((row, i) => (
              <div
                key={row.id}
                className="grid grid-cols-12 gap-3 px-4 py-3 border-t items-center"
                style={{ borderColor: "var(--ow-border)", background: i % 2 === 0 ? "var(--ow-bg-card)" : "#0d0d15" }}
              >
                <div className="col-span-2">
                  <Link
                    href={`/ref/${encodeURIComponent(row.reference_number)}`}
                    className="text-xs font-bold font-mono truncate block hover:text-blue-400 transition-colors text-white"
                  >
                    {row.reference_number}
                  </Link>
                </div>
                <div className="col-span-2">
                  <p className="text-[11px] font-semibold truncate" style={{ color: "#60a5fa" }}>{row.brand_name ?? "—"}</p>
                </div>
                <div className="col-span-2 text-right">
                  <p className="text-sm font-black font-mono text-white">{formatCurrency(parseFloat(row.price))}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[11px] truncate" style={{ color: "var(--ow-text-muted)" }}>{row.seller_name ?? "—"}</p>
                </div>
                <div className="col-span-1" />
                <div className="col-span-1">
                  <span className="text-[11px] px-1.5 py-0.5 rounded font-medium capitalize" style={{ background: "rgba(32,129,226,0.1)", color: "#60a5fa" }}>
                    {row.source}
                  </span>
                </div>
                <div className="col-span-1">
                  <p className="text-[10px] truncate" style={{ color: "var(--ow-text-dim)" }}>
                    {row.seller_name ?? "—"}
                  </p>
                </div>
                <div className="col-span-1 text-right flex items-center justify-end gap-1.5">
                  <p className="text-[10px]" style={{ color: "var(--ow-text-dim)" }}>
                    {shortTimeAgo(row.scraped_at)}
                  </p>
                  {row.listing_url && (
                    <a href={row.listing_url} target="_blank" rel="noopener noreferrer"
                      className="transition-colors hover:text-blue-400 shrink-0" style={{ color: "var(--ow-text-dim)" }}>
                      <ExternalLink size={11} />
                    </a>
                  )}
                </div>
              </div>
            ))
          ) : (
            sales.map((sale, i) => (
              <div
                key={sale.id}
                className="grid grid-cols-12 gap-3 px-4 py-3 border-t items-center"
                style={{ borderColor: "var(--ow-border)", background: i % 2 === 0 ? "var(--ow-bg-card)" : "#0d0d15" }}
              >
                <div className="col-span-2">
                  <Link href={`/ref/${encodeURIComponent(sale.ref_number)}`}
                    className="text-xs font-bold font-mono truncate block hover:text-blue-400 transition-colors text-white">
                    {sale.ref_number}
                  </Link>
                </div>
                <div className="col-span-2">
                  <p className="text-[11px] font-semibold truncate" style={{ color: "#60a5fa" }}>{sale.brand}</p>
                  {sale.model && <p className="text-[10px] truncate" style={{ color: "var(--ow-text-dim)" }}>{sale.model}</p>}
                </div>
                <div className="col-span-2 text-right">
                  <p className="text-sm font-black font-mono text-white">{formatCurrency(parseFloat(sale.price))}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-[11px] capitalize"
                    style={{ color: sale.condition === "unworn" ? "#22c55e" : sale.condition === "excellent" ? "#60a5fa" : "var(--ow-text-muted)" }}>
                    {sale.condition ?? "—"}
                  </span>
                </div>
                <div className="col-span-1">
                  <span className="text-[11px]" style={{ color: "var(--ow-text-dim)" }}>
                    {sale.has_box && sale.has_papers ? "B+P" : sale.has_box ? "B" : sale.has_papers ? "P" : "—"}
                  </span>
                </div>
                <div className="col-span-1">
                  <span className="text-[11px] px-1.5 py-0.5 rounded font-medium capitalize" style={{ background: "rgba(32,129,226,0.1)", color: "#60a5fa" }}>
                    {sale.source}
                  </span>
                </div>
                <div className="col-span-1">
                  <p className="text-[10px] truncate" style={{ color: "var(--ow-text-dim)" }}>{sale.dealer_name ?? "—"}</p>
                </div>
                <div className="col-span-1 text-right flex items-center justify-end gap-1.5">
                  <p className="text-[10px]" style={{ color: "var(--ow-text-dim)" }}>
                    {sale.sold_at ? shortTimeAgo(sale.sold_at) : shortTimeAgo(sale.scraped_at)}
                  </p>
                  {sale.listing_url && (
                    <a href={sale.listing_url} target="_blank" rel="noopener noreferrer"
                      className="transition-colors hover:text-blue-400 shrink-0" style={{ color: "var(--ow-text-dim)" }}>
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
