import { createClient } from "@/lib/supabase/server"
import AppLayout from "@/components/layout/app-layout"
import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { formatCurrency } from "@/lib/utils/currency"
import { shortTimeAgo } from "@/lib/utils/dates"
import { MarketListingCard, type MarketDataRow } from "@/components/analytics/market-listing-card"

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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return { title: `${slugToTitle(slug)} — Dealer — OpenWatch` }
}

function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

export default async function DealerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ brand?: string; sort?: string; page?: string }>
}) {
  const { slug } = await params
  const { brand: brandFilter = "All", sort = "price_asc", page: pageStr = "1" } = await searchParams
  const page = parseInt(pageStr)
  const pageSize = 48

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Look up dealer by slug in chrono24_dealers
  const { data: c24Dealer } = await db
    .from("chrono24_dealers")
    .select("*")
    .eq("slug", slug)
    .maybeSingle()

  const dealerName = c24Dealer?.name ?? slugToTitle(slug)

  // Build listings query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let listingsQuery: any = db
    .from("market_data")
    .select(
      "id, ref_number, brand, model, price, condition, has_box, has_papers, source, dealer_name, dealer_country, listing_url, listed_at, scraped_at, image_url",
      { count: "exact" }
    )
    .ilike("dealer_name", `%${dealerName}%`)
    .eq("is_sold", false)
    .gt("price", 1000)

  if (brandFilter && brandFilter !== "All") {
    listingsQuery = listingsQuery.ilike("brand", `%${brandFilter}%`)
  }

  if (sort === "price_asc") listingsQuery = listingsQuery.order("price", { ascending: true })
  else if (sort === "price_desc") listingsQuery = listingsQuery.order("price", { ascending: false })
  else if (sort === "newest") listingsQuery = listingsQuery.order("scraped_at", { ascending: false })
  else listingsQuery = listingsQuery.order("price", { ascending: true })

  const from = (page - 1) * pageSize
  listingsQuery = listingsQuery.range(from, from + pageSize - 1)

  const { data: listings, count: totalCount } = await listingsQuery
  const allListings: MarketDataRow[] = listings ?? []
  const total = totalCount ?? 0

  // Get summary stats (all listings, no brand filter)
  const { data: allRows } = await db
    .from("market_data")
    .select("brand, price, ref_number")
    .ilike("dealer_name", `%${dealerName}%`)
    .eq("is_sold", false)
    .gt("price", 1000)

  const allBrands = [...new Set((allRows ?? []).map((r: { brand: string }) => r.brand).filter(Boolean))] as string[]
  const allPrices = (allRows ?? []).map((r: { price: string }) => parseFloat(r.price)).filter((p: number) => p > 0)
  const avgPrice = allPrices.length ? allPrices.reduce((a: number, v: number) => a + v, 0) / allPrices.length : null
  const minPrice = allPrices.length ? Math.min(...allPrices) : null
  const maxPrice = allPrices.length ? Math.max(...allPrices) : null
  const allRefs = [...new Set((allRows ?? []).map((r: { ref_number: string }) => r.ref_number).filter(Boolean))]

  const totalPages = Math.ceil(total / pageSize)

  function pageUrl(p: number) {
    const params = new URLSearchParams()
    if (brandFilter !== "All") params.set("brand", brandFilter)
    if (sort !== "price_asc") params.set("sort", sort)
    if (p > 1) params.set("page", p.toString())
    const qs = params.toString()
    return `/dealers/${slug}${qs ? `?${qs}` : ""}`
  }

  function filterUrl(overrides: Record<string, string>) {
    const params = new URLSearchParams()
    if (brandFilter !== "All") params.set("brand", brandFilter)
    if (sort !== "price_asc") params.set("sort", sort)
    Object.entries(overrides).forEach(([k, v]) => { if (v && v !== "All") params.set(k, v); else params.delete(k) })
    const qs = params.toString()
    return `/dealers/${slug}${qs ? `?${qs}` : ""}`
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm" style={{ color: "#64748b" }}>
          <Link href="/dealers" className="hover:text-white transition-colors">Dealers</Link>
          <span>/</span>
          <span className="text-white font-semibold">{dealerName}</span>
        </nav>

        {/* Dealer header */}
        <div className="rounded-2xl border p-6" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-white font-black text-lg shrink-0"
                style={{ background: "linear-gradient(135deg, #e67e00, #b35a00)" }}
              >
                C24
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-black text-white">{dealerName}</h1>
                  {c24Dealer && (
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(32,129,226,0.12)", color: "#2081E2", border: "1px solid rgba(32,129,226,0.2)" }}
                    >
                      Tracked Dealer
                    </span>
                  )}
                </div>
                {c24Dealer?.country && (
                  <p className="text-sm mt-0.5" style={{ color: "#8A939B" }}>{c24Dealer.country}</p>
                )}
                {c24Dealer?.last_scraped_at && (
                  <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>
                    Last synced {shortTimeAgo(c24Dealer.last_scraped_at)}
                  </p>
                )}
              </div>
            </div>

            {c24Dealer && (
              <a
                href={`https://www.chrono24.com/dealer/${c24Dealer.slug}/index.htm`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ background: "rgba(32,129,226,0.12)", color: "#2081E2", border: "1px solid rgba(32,129,226,0.2)" }}
              >
                View on Chrono24 <ExternalLink size={14} />
              </a>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t" style={{ borderColor: "#1c1c2a" }}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Total Listed</p>
              <p className="text-xl font-black font-mono text-white mt-0.5">{(allRows?.length ?? 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Brands</p>
              <p className="text-xl font-black font-mono text-white mt-0.5">{allBrands.length}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Avg Price</p>
              <p className="text-xl font-black font-mono text-white mt-0.5">
                {avgPrice ? formatCurrency(avgPrice) : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>Price Range</p>
              <p className="text-sm font-black font-mono text-white mt-0.5">
                {minPrice && maxPrice
                  ? `${formatCurrency(minPrice)} – ${formatCurrency(maxPrice)}`
                  : "—"}
              </p>
            </div>
          </div>

          {/* Brand tags */}
          {allBrands.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {allBrands.map(b => (
                <Link
                  key={b}
                  href={filterUrl({ brand: b })}
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors hover:opacity-80"
                  style={{
                    background: "rgba(32,129,226,0.1)",
                    color: "#2081E2",
                    border: "1px solid rgba(32,129,226,0.15)",
                  }}
                >
                  {b}
                </Link>
              ))}
              {allRefs.length > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ color: "#64748b" }}>
                  {allRefs.length} references
                </span>
              )}
            </div>
          )}
        </div>

        {/* Brand filter tabs */}
        <div className="flex flex-wrap gap-2">
          {TARGET_BRANDS.filter(b => b === "All" || allBrands.some(ab => ab?.toLowerCase().includes(b.toLowerCase()))).map(b => {
            const active = brandFilter === b || (b === "All" && brandFilter === "All")
            return (
              <Link
                key={b}
                href={filterUrl({ brand: b === "All" ? "All" : b })}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                style={{
                  background: active ? "#2081E2" : "#111119",
                  color: active ? "#ffffff" : "#8A939B",
                  border: `1px solid ${active ? "#2081E2" : "#1c1c2a"}`,
                }}
              >
                {b}
              </Link>
            )
          })}
        </div>

        {/* Sort + count bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm font-semibold text-white">
            {total.toLocaleString()} listing{total !== 1 ? "s" : ""}
            {brandFilter !== "All" ? ` · ${brandFilter}` : ""}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "#64748b" }}>Sort</span>
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

        {/* Inventory grid */}
        {allListings.length === 0 ? (
          <div className="rounded-xl border py-16 text-center" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
            <p className="text-sm" style={{ color: "#64748b" }}>
              {brandFilter !== "All"
                ? `No listings found for ${dealerName} in ${brandFilter}.`
                : `No active listings found for ${dealerName}.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {allListings.map(listing => (
              <MarketListingCard
                key={listing.id}
                listing={listing}
                showDealer={false}
                showSource={true}
                showRef={true}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            {page > 1 && (
              <Link
                href={pageUrl(page - 1)}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ background: "#111119", color: "#8A939B", border: "1px solid #1c1c2a" }}
              >
                ← Prev
              </Link>
            )}
            <span className="text-sm" style={{ color: "#64748b" }}>
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={pageUrl(page + 1)}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ background: "#111119", color: "#8A939B", border: "1px solid #1c1c2a" }}
              >
                Next →
              </Link>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
