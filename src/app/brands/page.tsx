import { createClient } from "@/lib/supabase/server"
import AppLayout from "@/components/layout/app-layout"
import { BrandLogo } from "@/components/shared/brand-logo"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils/currency"

export const metadata = { title: "Brands — OpenWatch" }
export const dynamic = "force-dynamic"

const TARGET_BRANDS = [
  "Rolex",
  "Audemars Piguet",
  "Patek Philippe",
  "Vacheron Constantin",
  "Richard Mille",
  "F.P. Journe",
]

function brandToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function PriceChange({ change }: { change: number | null }) {
  if (change === null) return <span className="text-xs" style={{ color: "#64748b" }}>—</span>
  if (change > 0.5) return (
    <span className="flex items-center gap-0.5 text-sm font-bold" style={{ color: "#22c55e" }}>
      <TrendingUp size={13} />+{change.toFixed(1)}%
    </span>
  )
  if (change < -0.5) return (
    <span className="flex items-center gap-0.5 text-sm font-bold" style={{ color: "#ef4444" }}>
      <TrendingDown size={13} />{change.toFixed(1)}%
    </span>
  )
  return (
    <span className="flex items-center gap-0.5 text-sm font-bold" style={{ color: "#64748b" }}>
      <Minus size={13} />—
    </span>
  )
}

export default async function BrandsPage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Fetch aggregated stats for each brand from market_data
  const { data: rows } = await db
    .from("market_data")
    .select("brand, ref_number, price, is_sold, price_change_30d")
    .in("brand", TARGET_BRANDS)
    .gt("price", 1000)

  // Group by brand
  const brandMap = new Map<string, {
    prices: number[]
    refs: Set<string>
    total_listings: number
    floor: number
    changes: number[]
  }>()

  for (const row of rows ?? []) {
    const brand = row.brand as string
    if (!brand) continue
    if (!brandMap.has(brand)) {
      brandMap.set(brand, { prices: [], refs: new Set(), total_listings: 0, floor: Infinity, changes: [] })
    }
    const e = brandMap.get(brand)!
    if (row.ref_number) e.refs.add(row.ref_number as string)
    const price = parseFloat(row.price as string)
    if (!row.is_sold) {
      e.total_listings++
      e.prices.push(price)
      if (price < e.floor) e.floor = price
    }
    if (row.price_change_30d !== null) {
      e.changes.push(parseFloat(row.price_change_30d as string))
    }
  }

  const brands = TARGET_BRANDS.map(name => {
    const e = brandMap.get(name) ?? { prices: [], refs: new Set(), total_listings: 0, floor: Infinity, changes: [] }
    const avg = e.prices.length ? e.prices.reduce((a, v) => a + v, 0) / e.prices.length : null
    const change = e.changes.length ? e.changes.reduce((a, v) => a + v, 0) / e.changes.length : null
    return {
      name,
      slug: brandToSlug(name),
      refs_count: e.refs.size,
      total_listings: e.total_listings,
      avg_price: avg,
      floor_price: e.floor !== Infinity ? e.floor : null,
      change_30d: change,
    }
  })

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-black text-white">Brands</h1>
          <p className="text-sm mt-1" style={{ color: "#8A939B" }}>
            Browse luxury watch brands — floor prices, market data, and tracked references.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {brands.map(brand => (
            <Link
              key={brand.slug}
              href={`/brands/${brand.slug}`}
              className="rounded-2xl border p-6 flex flex-col gap-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-[#2081E2]"
              style={{
                background: "#111119",
                borderColor: "#1c1c2a",
                boxShadow: "0 1px 3px rgba(0,0,0,.3)",
              }}
            >
              {/* Header: logo + name */}
              <div className="flex items-center gap-3">
                <BrandLogo brandName={brand.name} size="lg" />
                <div className="min-w-0">
                  <h2 className="text-lg font-black text-white leading-tight">{brand.name}</h2>
                  <p className="text-sm" style={{ color: "#8A939B" }}>
                    {brand.refs_count} refs tracked
                  </p>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "#64748b" }}>Floor</p>
                  <p className="text-sm font-black font-mono text-white">
                    {brand.floor_price ? formatCurrency(brand.floor_price) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "#64748b" }}>Avg</p>
                  <p className="text-sm font-black font-mono text-white">
                    {brand.avg_price ? formatCurrency(brand.avg_price) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "#64748b" }}>Listed</p>
                  <p className="text-sm font-black font-mono text-white">
                    {brand.total_listings.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Footer: trend badge + CTA */}
              <div className="flex items-center justify-between mt-auto pt-2 border-t" style={{ borderColor: "#1c1c2a" }}>
                <div className="flex items-center gap-1">
                  <span className="text-[11px]" style={{ color: "#64748b" }}>30d</span>
                  <PriceChange change={brand.change_30d} />
                </div>
                <span className="text-sm font-semibold" style={{ color: "#2081E2" }}>
                  View Collection →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
