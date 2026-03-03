import Link from "next/link"
import { ArrowRight, TrendingUp } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import AppLayout from "@/components/layout/app-layout"
import ListingCard from "@/components/network/listing-card"
import { ActivityRow } from "@/components/shared/activity-row"
import { BrandLogo } from "@/components/shared/brand-logo"
import { VerifiedBadge } from "@/components/shared/verified-badge"
import { Sparkline } from "@/components/charts/sparkline"
import { formatCurrency } from "@/lib/utils/currency"
import type { ListingWithRelations, Brand } from "@/lib/types"

export const metadata = { title: "OpenWatch — Dealer Network for Luxury Watches" }

export const dynamic = "force-dynamic"

interface BrandStat {
  brand: Brand
  listingCount: number
  floorPrice: number
  avgPrice: number
  sparkData: number[]
}

export default async function HomePage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Fetch recent listings
  const { data: recentListings } = await db
    .from("listings")
    .select(`
      *,
      brand:brands(*),
      model:models(*),
      dealer:profiles!dealer_id(id, full_name, company_name, avatar_url, verified, seller_rating, total_sales)
    `)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("listed_at", { ascending: false })
    .limit(10)

  // Fetch all brands
  const { data: brands } = await db
    .from("brands")
    .select("*")
    .is("deleted_at", null)
    .order("name")

  // Fetch recent market events
  const { data: recentEvents } = await db
    .from("market_events")
    .select(`
      *,
      listing:listings(
        reference_number,
        wholesale_price,
        brand:brands(name),
        model:models(name),
        dealer:profiles!dealer_id(company_name, full_name)
      )
    `)
    .order("created_at", { ascending: false })
    .limit(8)

  // Fetch all active listings for brand stats
  const { data: allListings } = await db
    .from("listings")
    .select("brand_id, wholesale_price, listed_at, brand:brands(name, slug)")
    .eq("status", "active")
    .is("deleted_at", null)

  // Compute brand stats
  const brandStatsMap = new Map<string, { count: number; prices: number[]; brand: { name: string; slug: string }; dates: string[] }>()
  for (const l of allListings ?? []) {
    const b = l.brand as unknown as { name: string; slug: string } | null
    if (!b) continue
    if (!brandStatsMap.has(l.brand_id)) {
      brandStatsMap.set(l.brand_id, { count: 0, prices: [], brand: b, dates: [] })
    }
    const entry = brandStatsMap.get(l.brand_id)!
    entry.count++
    const p = parseFloat(l.wholesale_price)
    if (p > 0) {
      entry.prices.push(p)
      entry.dates.push(l.listed_at)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brandStats: BrandStat[] = ((brands ?? []) as any[])
    .map((brand: any) => {
      const stats = brandStatsMap.get(brand.id)
      const prices = stats?.prices ?? []
      // Build sparkline from recent prices (last 7 groups)
      const sparkData = prices.slice(-7)
      return {
        brand: brand as Brand,
        listingCount: stats?.count ?? 0,
        floorPrice: prices.length ? Math.min(...prices) : 0,
        avgPrice: prices.length ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length : 0,
        sparkData,
      }
    })
    .filter((b: BrandStat) => b.listingCount > 0)
    .sort((a: BrandStat, b: BrandStat) => b.listingCount - a.listingCount)

  const topBrands = brandStats.slice(0, 8)
  const totalListings = allListings?.length ?? 0
  const uniqueBrands = brandStats.length

  // Featured listing (first RC Crown or first listing)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const featuredListing = ((recentListings ?? []) as any[]).find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (l: any) => (l.dealer?.company_name ?? "").toUpperCase().startsWith("RC")
  ) ?? recentListings?.[0]

  const featuredPrice = featuredListing ? parseFloat(featuredListing.wholesale_price) : 0
  const featuredMinPrice = brandStats.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (b) => b.brand.id === (featuredListing as any)?.brand_id
  )?.floorPrice ?? 0

  return (
    <AppLayout>
      <div className="max-w-[1400px] mx-auto space-y-8">

        {/* ── HERO CAROUSEL (featured listing) ── */}
        <section
          className="relative rounded-2xl overflow-hidden"
          style={{ height: 280, background: "linear-gradient(135deg, #1a1a3e 0%, #0d1b3e 50%, #0a0a1e 100%)" }}
        >
          {/* Background gradient overlay */}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to right, rgba(32,129,226,0.15) 0%, transparent 60%)" }}
          />

          {/* Watch image (if available) */}
          {featuredListing?.images?.[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={featuredListing.images[0]}
              alt="Featured watch"
              className="absolute right-0 top-0 h-full object-contain opacity-60"
              style={{ maxWidth: "40%" }}
            />
          )}

          {/* Content overlay */}
          <div className="absolute inset-0 flex flex-col justify-end p-6">
            <div className="max-w-md">
              {/* Network badge */}
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mb-3"
                style={{ background: "rgba(32,129,226,0.2)", color: "#60a5fa", border: "1px solid rgba(32,129,226,0.3)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Invite-Only Dealer Network
              </div>

              <h1 className="text-3xl font-black text-white leading-tight mb-2">
                {featuredListing
                  ? `${featuredListing.brand?.name ?? ""} ${featuredListing.model?.name ?? ""}`
                  : "Luxury Watch Market"}
              </h1>

              {/* Stats row */}
              <div className="flex items-center gap-5 mt-3">
                <div>
                  <p className="text-[11px] uppercase font-bold" style={{ color: "#8A939B" }}>WATCHES</p>
                  <p className="text-sm font-black font-mono text-white">{totalListings}</p>
                </div>
                {featuredMinPrice > 0 && (
                  <div>
                    <p className="text-[11px] uppercase font-bold" style={{ color: "#8A939B" }}>FLOOR PRICE</p>
                    <p className="text-sm font-black font-mono text-white">{formatCurrency(featuredMinPrice)}</p>
                  </div>
                )}
                {featuredListing?.dealer && (
                  <div>
                    <p className="text-[11px] uppercase font-bold" style={{ color: "#8A939B" }}>DEALER</p>
                    <p className="text-sm font-black text-white flex items-center gap-1">
                      {featuredListing.dealer.company_name ?? featuredListing.dealer.full_name}
                      {featuredListing.dealer.verified && (
                        <svg viewBox="0 0 12 12" className="w-3 h-3 fill-blue-400">
                          <path d="M10.3 3.3L5 8.6 1.7 5.3 0.3 6.7 5 11.4l6.7-6.7-1.4-1.4z" />
                        </svg>
                      )}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-[11px] uppercase font-bold" style={{ color: "#8A939B" }}>BRANDS</p>
                  <p className="text-sm font-black font-mono text-white">{uniqueBrands}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Carousel dots */}
          <div className="absolute bottom-4 right-6 flex gap-1.5">
            <span className="w-2 h-2 rounded-full bg-white" />
            <span className="w-2 h-2 rounded-full opacity-40" style={{ background: "#fff" }} />
            <span className="w-2 h-2 rounded-full opacity-40" style={{ background: "#fff" }} />
          </div>
        </section>

        {/* ── MAIN CONTENT: Recently Listed + Right Panel ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* LEFT: Recently Listed (2/3 width) */}
          <div className="xl:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-white">
                Recently Listed
              </h2>
              <Link
                href="/network"
                className="flex items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ color: "#2081E2" }}
              >
                See all <ArrowRight size={14} />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-3 gap-3">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {((recentListings ?? []) as any[]).slice(0, 9).map((listing: any) => (
                <ListingCard
                  key={listing.id}
                  listing={listing as unknown as ListingWithRelations}
                />
              ))}
              {!recentListings?.length && (
                <div className="col-span-full text-sm py-8 text-center" style={{ color: "#8A939B" }}>
                  No listings yet.
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Rankings panel (1/3 width) */}
          <div className="xl:col-span-1 space-y-4">
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: "#1E1E2E", border: "1px solid #333333" }}
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #333333" }}>
                <div className="flex gap-3">
                  <button className="text-sm font-bold text-white">Brands</button>
                </div>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#333333", color: "#8A939B" }}>
                  All time
                </span>
              </div>

              {/* Column headers */}
              <div
                className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2 text-[11px] font-bold uppercase tracking-wider"
                style={{ color: "#8A939B", borderBottom: "1px solid #333333" }}
              >
                <span>BRAND</span>
                <span className="text-right">PRICE</span>
                <span className="w-14 text-right">TREND</span>
              </div>

              {/* Brand rows */}
              {topBrands.slice(0, 10).map((bs, i) => {
                const priceDiff =
                  bs.avgPrice > 0 && bs.floorPrice > 0
                    ? ((bs.floorPrice - bs.avgPrice) / bs.avgPrice) * 100
                    : 0
                return (
                  <Link
                    key={bs.brand.id}
                    href={`/collection/${bs.brand.slug}`}
                    className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-3 items-center hover:opacity-80 transition-opacity"
                    style={{ borderBottom: i < topBrands.length - 1 ? "1px solid #222222" : undefined }}
                  >
                    {/* Brand info */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <BrandLogo brandName={bs.brand.name} size="sm" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-semibold text-white truncate">{bs.brand.name}</span>
                          {bs.brand.verified && (
                            <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 fill-blue-400 shrink-0">
                              <path d="M10.3 3.3L5 8.6 1.7 5.3 0.3 6.7 5 11.4l6.7-6.7-1.4-1.4z" />
                            </svg>
                          )}
                        </div>
                        <p className="text-[11px]" style={{ color: "#8A939B" }}>{bs.listingCount} listings</p>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="text-right">
                      <p className="text-sm font-bold font-mono text-white">
                        {bs.floorPrice > 0 ? formatCurrency(bs.floorPrice) : "—"}
                      </p>
                      {priceDiff !== 0 && (
                        <p
                          className="text-[11px] font-semibold"
                          style={{ color: priceDiff <= 0 ? "#34C759" : "#EB5757" }}
                        >
                          {priceDiff <= 0 ? "" : "+"}{priceDiff.toFixed(1)}%
                        </p>
                      )}
                    </div>

                    {/* Sparkline */}
                    <div className="w-14 flex justify-end">
                      {bs.sparkData.length >= 2 ? (
                        <Sparkline data={bs.sparkData} width={56} height={24} />
                      ) : (
                        <span className="text-xs" style={{ color: "#8A939B" }}>—</span>
                      )}
                    </div>
                  </Link>
                )
              })}

              {topBrands.length === 0 && (
                <div className="px-4 py-6 text-center text-sm" style={{ color: "#8A939B" }}>
                  No brand data yet.
                </div>
              )}

              <Link
                href="/rankings"
                className="flex items-center justify-center gap-1 py-3 text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ borderTop: "1px solid #333333", color: "#2081E2" }}
              >
                View full rankings <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>

        {/* ── TRENDING BRANDS — horizontal scroll ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <TrendingUp size={20} style={{ color: "#2081E2" }} />
              Trending Brands
            </h2>
            <Link
              href="/rankings"
              className="flex items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ color: "#2081E2" }}
            >
              View all <ArrowRight size={14} />
            </Link>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2">
            {topBrands.map(({ brand, listingCount, floorPrice }) => (
              <Link
                key={brand.id}
                href={`/collection/${brand.slug}`}
                className="shrink-0 rounded-xl border overflow-hidden transition-all hover:border-[#2081E2] hover:-translate-y-1"
                style={{ background: "#1E1E2E", borderColor: "#333333", width: 160 }}
              >
                {/* Brand gradient top */}
                <div
                  className="h-24 flex items-center justify-center relative"
                  style={{ background: brand.banner_gradient ?? "linear-gradient(135deg, #1a1a3e, #0d1b3e)" }}
                >
                  <BrandLogo brandName={brand.name} size="lg" />
                  {brand.verified && (
                    <div
                      className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: "#2081E2" }}
                    >
                      <svg viewBox="0 0 12 12" className="w-2 h-2 fill-white">
                        <path d="M10.3 3.3L5 8.6 1.7 5.3 0.3 6.7 5 11.4l6.7-6.7-1.4-1.4z" />
                      </svg>
                    </div>
                  )}
                </div>
                {/* Brand info */}
                <div className="p-3">
                  <p className="font-bold text-sm text-white truncate">{brand.name}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "#8A939B" }}>{listingCount} listings</p>
                  {floorPrice > 0 && (
                    <p className="text-xs font-bold font-mono text-white mt-1">
                      {formatCurrency(floorPrice)}
                    </p>
                  )}
                </div>
              </Link>
            ))}

            {topBrands.length === 0 && (
              <p className="text-sm py-4" style={{ color: "#8A939B" }}>No brand data yet.</p>
            )}
          </div>
        </section>

        {/* ── LIVE ACTIVITY ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Live Activity
            </h2>
            <Link
              href="/activity"
              className="flex items-center gap-1 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ color: "#2081E2" }}
            >
              See all <ArrowRight size={14} />
            </Link>
          </div>

          <div className="rounded-xl border overflow-hidden" style={{ background: "#1E1E2E", borderColor: "#333333" }}>
            {(recentEvents ?? []).length === 0 ? (
              <div className="p-6 text-center text-sm" style={{ color: "#8A939B" }}>
                No activity yet.
              </div>
            ) : (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ((recentEvents ?? []) as any[]).map((event: any) => {
                const listing = event.listing
                return (
                  <ActivityRow
                    key={event.id}
                    eventType={event.event_type}
                    brandName={listing?.brand?.name}
                    modelName={listing?.model?.name}
                    referenceNumber={listing?.reference_number}
                    price={event.price ?? listing?.wholesale_price}
                    dealerName={listing?.dealer?.company_name ?? listing?.dealer?.full_name}
                    createdAt={event.created_at}
                    compact
                  />
                )
              })
            )}
            <div className="p-3 text-center" style={{ borderTop: "1px solid #333333" }}>
              <Link
                href="/activity"
                className="text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ color: "#2081E2" }}
              >
                See full activity →
              </Link>
            </div>
          </div>
        </section>

      </div>
    </AppLayout>
  )
}
