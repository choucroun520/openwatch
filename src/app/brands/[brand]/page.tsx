import { createClient } from "@/lib/supabase/server"
import AppLayout from "@/components/layout/app-layout"
import { BrandLogo } from "@/components/shared/brand-logo"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils/currency"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

const SLUG_TO_BRAND: Record<string, string> = {
  "rolex": "Rolex",
  "audemars-piguet": "Audemars Piguet",
  "patek-philippe": "Patek Philippe",
  "vacheron-constantin": "Vacheron Constantin",
  "richard-mille": "Richard Mille",
  "fp-journe": "F.P. Journe",
}

export async function generateMetadata({ params }: { params: Promise<{ brand: string }> }) {
  const { brand: slug } = await params
  const brandName = SLUG_TO_BRAND[slug]
  if (!brandName) return { title: "Brand not found — OpenWatch" }
  return { title: `${brandName} — OpenWatch` }
}

function PriceChange({ change }: { change: number | null }) {
  if (change === null) return null
  if (change > 0.5) return (
    <span className="flex items-center gap-0.5 text-[11px] font-bold" style={{ color: "#22c55e" }}>
      <TrendingUp size={11} />+{change.toFixed(1)}%
    </span>
  )
  if (change < -0.5) return (
    <span className="flex items-center gap-0.5 text-[11px] font-bold" style={{ color: "#ef4444" }}>
      <TrendingDown size={11} />{change.toFixed(1)}%
    </span>
  )
  return (
    <span className="flex items-center gap-0.5 text-[11px] font-bold" style={{ color: "var(--ow-text-dim)" }}>
      <Minus size={11} />—
    </span>
  )
}

export default async function BrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ brand: string }>
  searchParams: Promise<{ sort?: string; min?: string; max?: string }>
}) {
  const { brand: slug } = await params
  const { sort = "listings", min, max } = await searchParams

  const brandName = SLUG_TO_BRAND[slug]
  if (!brandName) notFound()

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: rows } = await db
    .from("market_data")
    .select("ref_number, model, price, is_sold, price_change_30d")
    .ilike("brand", brandName)
    .gt("price", 1000)

  // Group by ref_number
  const refMap = new Map<string, {
    model: string | null
    prices: number[]
    listing_count: number
    floor: number
    changes: number[]
  }>()

  for (const row of rows ?? []) {
    const ref = row.ref_number as string
    if (!ref) continue
    if (!refMap.has(ref)) {
      refMap.set(ref, { model: row.model ?? null, prices: [], listing_count: 0, floor: Infinity, changes: [] })
    }
    const e = refMap.get(ref)!
    if (!e.model && row.model) e.model = row.model as string
    if (!row.is_sold) {
      const price = parseFloat(row.price as string)
      if (min && price < parseFloat(min)) {
        // skip
      } else if (max && price > parseFloat(max)) {
        // skip
      } else {
        e.prices.push(price)
        e.listing_count++
        if (price < e.floor) e.floor = price
      }
    }
    if (row.price_change_30d !== null) {
      e.changes.push(parseFloat(row.price_change_30d as string))
    }
  }

  let refs = Array.from(refMap.entries()).map(([ref_number, e]) => ({
    ref_number,
    model: e.model,
    listing_count: e.listing_count,
    floor_price: e.floor !== Infinity ? e.floor : null,
    avg_price: e.prices.length ? e.prices.reduce((a, v) => a + v, 0) / e.prices.length : null,
    change_30d: e.changes.length ? e.changes.reduce((a, v) => a + v, 0) / e.changes.length : null,
  }))

  // Sort
  if (sort === "price_asc") refs = refs.sort((a, b) => (a.floor_price ?? 9999999) - (b.floor_price ?? 9999999))
  else if (sort === "price_desc") refs = refs.sort((a, b) => (b.floor_price ?? 0) - (a.floor_price ?? 0))
  else if (sort === "trending") refs = refs.sort((a, b) => (b.change_30d ?? -999) - (a.change_30d ?? -999))
  else refs = refs.sort((a, b) => b.listing_count - a.listing_count) // default: most listed

  // Summary stats
  const totalListings = refs.reduce((sum, r) => sum + r.listing_count, 0)
  const allFloors = refs.filter(r => r.floor_price !== null).map(r => r.floor_price!)
  const brandFloor = allFloors.length ? Math.min(...allFloors) : null
  const allAvgs = refs.filter(r => r.avg_price !== null).map(r => r.avg_price!)
  const brandAvg = allAvgs.length ? allAvgs.reduce((a, v) => a + v, 0) / allAvgs.length : null

  const SORT_OPTIONS = [
    { value: "listings", label: "Most Listed" },
    { value: "price_asc", label: "Price ↑" },
    { value: "price_desc", label: "Price ↓" },
    { value: "trending", label: "Trending" },
  ]

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm" style={{ color: "var(--ow-text-dim)" }}>
          <Link href="/brands" className="hover:text-white transition-colors">Brands</Link>
          <span>/</span>
          <span className="text-white font-semibold">{brandName}</span>
        </nav>

        {/* Brand header */}
        <div className="rounded-2xl border p-6" style={{ background: "var(--ow-bg-card)", borderColor: "var(--ow-border)" }}>
          <div className="flex items-center gap-4 mb-4">
            <BrandLogo brandName={brandName} size="lg" />
            <div>
              <h1 className="text-2xl font-black text-white">{brandName}</h1>
              <p className="text-sm mt-0.5" style={{ color: "#8A939B" }}>
                {refs.length} references · {totalListings.toLocaleString()} active listings
              </p>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex flex-wrap gap-6 pt-4 border-t" style={{ borderColor: "var(--ow-border)" }}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--ow-text-dim)" }}>Floor Price</p>
              <p className="text-lg font-black font-mono text-white mt-0.5">
                {brandFloor ? formatCurrency(brandFloor) : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--ow-text-dim)" }}>Avg Price</p>
              <p className="text-lg font-black font-mono text-white mt-0.5">
                {brandAvg ? formatCurrency(brandAvg) : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--ow-text-dim)" }}>Refs Tracked</p>
              <p className="text-lg font-black font-mono text-white mt-0.5">{refs.length}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--ow-text-dim)" }}>Total Listed</p>
              <p className="text-lg font-black font-mono text-white mt-0.5">{totalListings.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Sort + filter bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm font-semibold text-white">
            {refs.length} references
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--ow-text-dim)" }}>Sort by</span>
            <div className="flex gap-1">
              {SORT_OPTIONS.map(opt => (
                <Link
                  key={opt.value}
                  href={`/brands/${slug}?sort=${opt.value}${min ? `&min=${min}` : ""}${max ? `&max=${max}` : ""}`}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{
                    background: sort === opt.value ? "#2081E2" : "var(--ow-bg-card)",
                    color: sort === opt.value ? "#ffffff" : "#8A939B",
                    border: `1px solid ${sort === opt.value ? "#2081E2" : "var(--ow-border)"}`,
                  }}
                >
                  {opt.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Reference grid */}
        {refs.length === 0 ? (
          <div className="rounded-xl border py-16 text-center" style={{ background: "var(--ow-bg-card)", borderColor: "var(--ow-border)" }}>
            <p className="text-sm" style={{ color: "var(--ow-text-dim)" }}>
              No references found for {brandName}.{" "}
              <code className="text-blue-400 text-xs">node scripts/scrape-chrono24-market.mjs</code>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {refs.map(ref => (
              <Link
                key={ref.ref_number}
                href={`/ref/${encodeURIComponent(ref.ref_number)}`}
                className="rounded-xl border flex flex-col overflow-hidden transition-all duration-150 hover:-translate-y-0.5 hover:border-[#2081E2]"
                style={{
                  background: "var(--ow-bg-card)",
                  borderColor: "var(--ow-border)",
                  boxShadow: "0 1px 3px rgba(0,0,0,.3)",
                }}
              >
                {/* Image placeholder */}
                <div
                  className="w-full aspect-square flex flex-col items-center justify-center gap-1"
                  style={{ background: "var(--ow-bg)" }}
                >
                  <span className="text-lg font-black font-mono text-white opacity-50 px-2 text-center leading-tight">
                    {ref.ref_number}
                  </span>
                  {ref.model && (
                    <span className="text-[9px] uppercase tracking-wider px-2 text-center" style={{ color: "var(--ow-text-dim)" }}>
                      {ref.model}
                    </span>
                  )}
                </div>

                {/* Card body */}
                <div className="p-2.5 flex flex-col gap-1">
                  <p className="text-[11px] font-bold font-mono text-white truncate">{ref.ref_number}</p>
                  {ref.model && (
                    <p className="text-[10px] truncate" style={{ color: "#8A939B" }}>{ref.model}</p>
                  )}
                  <p className="text-sm font-black font-mono text-white mt-0.5">
                    {ref.floor_price ? formatCurrency(ref.floor_price) : "—"}
                  </p>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[10px]" style={{ color: "var(--ow-text-dim)" }}>
                      {ref.listing_count} listed
                    </span>
                    <PriceChange change={ref.change_30d} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
