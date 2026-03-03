import Link from "next/link"
import { ArrowRight, TrendingUp, Activity, BarChart3 } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import TopNav from "@/components/layout/top-nav"
import ListingCard from "@/components/network/listing-card"
import { ActivityRow } from "@/components/shared/activity-row"
import { BrandAvatar, getBrandGradientBySlug } from "@/components/shared/brand-avatar"
import { formatCurrency } from "@/lib/utils/currency"
import type { ListingWithRelations, Brand } from "@/lib/types"

export const metadata = { title: "OpenWatch — Dealer Network for Luxury Watches" }

export const dynamic = "force-dynamic"

interface BrandStat {
  brand: Brand
  listingCount: number
  floorPrice: number
  avgPrice: number
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

  // Fetch recent market events with listing details
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

  // Fetch all active listings to compute brand stats
  const { data: allListings } = await db
    .from("listings")
    .select("brand_id, wholesale_price, brand:brands(name, slug)")
    .eq("status", "active")
    .is("deleted_at", null)

  // Compute brand stats
  const brandStatsMap = new Map<string, { count: number; prices: number[]; brand: { name: string; slug: string } }>()
  for (const l of allListings ?? []) {
    const b = l.brand as unknown as { name: string; slug: string } | null
    if (!b) continue
    if (!brandStatsMap.has(l.brand_id)) {
      brandStatsMap.set(l.brand_id, { count: 0, prices: [], brand: b })
    }
    const entry = brandStatsMap.get(l.brand_id)!
    entry.count++
    const p = parseFloat(l.wholesale_price)
    if (p > 0) entry.prices.push(p)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brandStats: BrandStat[] = ((brands ?? []) as any[])
    .map((brand: any) => {
      const stats = brandStatsMap.get(brand.id)
      const prices = stats?.prices ?? []
      return {
        brand: brand as Brand,
        listingCount: stats?.count ?? 0,
        floorPrice: prices.length ? Math.min(...prices) : 0,
        avgPrice: prices.length ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length : 0,
      }
    })
    .filter((b: BrandStat) => b.listingCount > 0)
    .sort((a: BrandStat, b: BrandStat) => b.listingCount - a.listingCount)

  const topBrands = brandStats.slice(0, 5)
  const totalListings = allListings?.length ?? 0
  const totalDealers = new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((recentListings ?? []) as any[]).map((l: any) => l.dealer_id)
  ).size
  const uniqueBrands = brandStats.length
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalVolume = ((allListings ?? []) as any[]).reduce(
    (sum: number, l: any) => sum + parseFloat(l.wholesale_price || "0"),
    0
  )

  return (
    <div className="min-h-screen" style={{ background: "#0b0b14" }}>
      <TopNav />

      {/* ── HERO ── */}
      <section
        className="relative overflow-hidden flex flex-col items-center justify-center text-center px-4"
        style={{ minHeight: 500 }}
      >
        {/* Animated gradient background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(37,99,235,0.14) 0%, rgba(124,58,237,0.08) 50%, transparent 100%)",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(to bottom, transparent 60%, #0b0b14 100%)",
          }}
        />

        <div className="relative z-10 max-w-3xl mx-auto py-20">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6 border"
            style={{ background: "rgba(37,99,235,0.1)", borderColor: "rgba(37,99,235,0.3)", color: "#60a5fa" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Invite-Only Dealer Network
          </div>

          <h1 className="text-5xl sm:text-6xl font-black text-white leading-tight tracking-tight mb-5">
            The Dealer Network for{" "}
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Luxury Watches
            </span>
          </h1>

          <p className="text-xl text-muted-foreground mb-8 max-w-xl mx-auto leading-relaxed">
            Invite-only. Wholesale prices. No middlemen.
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/network"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 transition-all"
            >
              Explore Network
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/rankings"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold border transition-all hover:bg-bg-elevated"
              style={{ borderColor: "#1c1c2a", color: "#e2e8f0" }}
            >
              View Rankings
            </Link>
          </div>

          {/* Animated stat counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-14">
            {[
              { label: "Total Watches", value: totalListings.toString() },
              { label: "Active Dealers", value: totalDealers.toString() },
              { label: "Brands", value: uniqueBrands.toString() },
              { label: "Network Volume", value: totalVolume > 0 ? formatCurrency(totalVolume) : "—" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl p-4 border text-center"
                style={{ background: "rgba(17,17,25,0.8)", borderColor: "#1c1c2a" }}
              >
                <p className="text-2xl font-black font-mono text-white">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-[1400px] mx-auto px-4 pb-20 space-y-16">
        {/* ── TRENDING BRANDS ── */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-black text-foreground">Trending Brands</h2>
            <Link href="/rankings" className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors">
              View all <ArrowRight size={14} />
            </Link>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide">
            {topBrands.map(({ brand, listingCount, floorPrice }) => (
              <Link
                key={brand.id}
                href={`/collection/${brand.slug}`}
                className="shrink-0 w-48 rounded-xl border overflow-hidden card-hover cursor-pointer"
                style={{ background: "#111119", borderColor: "#1c1c2a" }}
              >
                {/* Top gradient area */}
                <div
                  className="h-32 flex items-center justify-center relative"
                  style={{ background: brand.banner_gradient ?? getBrandGradientBySlug(brand.slug) }}
                >
                  <BrandAvatar brandName={brand.name} size="lg" />
                  {brand.verified && (
                    <div
                      className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: "#2563eb" }}
                    >
                      <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 fill-white">
                        <path d="M10.3 3.3L5 8.6 1.7 5.3 0.3 6.7 5 11.4l6.7-6.7-1.4-1.4z" />
                      </svg>
                    </div>
                  )}
                </div>
                {/* Bottom info */}
                <div className="p-3">
                  <p className="font-bold text-sm text-foreground truncate">{brand.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{listingCount} listings</p>
                  {floorPrice > 0 && (
                    <p className="text-xs font-bold font-mono text-foreground mt-1">
                      Floor: {formatCurrency(floorPrice)}
                    </p>
                  )}
                </div>
              </Link>
            ))}

            {topBrands.length === 0 && (
              <p className="text-sm text-muted-foreground py-4">No brand data yet.</p>
            )}
          </div>
        </section>

        {/* ── RECENTLY LISTED + LIVE ACTIVITY (side by side) ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Recently Listed — 2/3 width */}
          <section className="xl:col-span-2">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-black text-foreground">Recently Listed</h2>
              <Link href="/network" className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors">
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
                <div className="col-span-full text-sm text-muted-foreground py-8 text-center">
                  No listings yet.
                </div>
              )}
            </div>
          </section>

          {/* Live Activity — 1/3 width */}
          <section className="xl:col-span-1">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-black text-foreground flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Live Activity
              </h2>
              <Link href="/activity" className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors">
                See all <ArrowRight size={14} />
              </Link>
            </div>

            <div className="rounded-xl border overflow-hidden" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
              {(recentEvents ?? []).length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No activity yet.
                </div>
              ) : (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ((recentEvents ?? []) as any[]).map((event: any) => {
                  const ev = event
                  const listing = ev.listing
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
              <div
                className="p-3 text-center border-t"
                style={{ borderColor: "#1c1c2a" }}
              >
                <Link href="/activity" className="text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors">
                  See full activity →
                </Link>
              </div>
            </div>
          </section>
        </div>

        {/* ── TOP BRANDS BY VOLUME ── */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-black text-foreground flex items-center gap-2">
              <TrendingUp size={20} className="text-blue-400" />
              Top Brands by Listings
            </h2>
            <Link href="/rankings" className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors">
              Full rankings <ArrowRight size={14} />
            </Link>
          </div>

          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#1c1c2a" }}>
            {/* Table header */}
            <div
              className="grid grid-cols-12 gap-4 px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground"
              style={{ background: "#0b0b14" }}
            >
              <div className="col-span-1">#</div>
              <div className="col-span-5">Brand</div>
              <div className="col-span-2 text-right">Floor</div>
              <div className="col-span-2 text-right">Avg Price</div>
              <div className="col-span-2 text-right">Listed</div>
            </div>

            {brandStats.slice(0, 5).map((bs, i) => (
              <Link
                key={bs.brand.id}
                href={`/collection/${bs.brand.slug}`}
                className="grid grid-cols-12 gap-4 px-4 py-3.5 border-t items-center hover:bg-bg-elevated transition-colors group"
                style={{ borderColor: "#1c1c2a" }}
              >
                <div className="col-span-1 text-sm font-bold text-muted-foreground">
                  {i + 1}
                </div>
                <div className="col-span-5 flex items-center gap-3 min-w-0">
                  <BrandAvatar brandName={bs.brand.name} size="sm" />
                  <span className="font-semibold text-sm text-foreground truncate group-hover:text-blue-400 transition-colors">
                    {bs.brand.name}
                  </span>
                  {bs.brand.verified && (
                    <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 12 12" className="w-2 h-2 fill-white">
                        <path d="M10.3 3.3L5 8.6 1.7 5.3 0.3 6.7 5 11.4l6.7-6.7-1.4-1.4z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="col-span-2 text-right text-sm font-mono font-bold text-foreground">
                  {bs.floorPrice > 0 ? formatCurrency(bs.floorPrice) : "—"}
                </div>
                <div className="col-span-2 text-right text-sm font-mono text-muted-foreground">
                  {bs.avgPrice > 0 ? formatCurrency(bs.avgPrice) : "—"}
                </div>
                <div className="col-span-2 text-right text-sm font-semibold text-foreground">
                  {bs.listingCount}
                </div>
              </Link>
            ))}

            {brandStats.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No brand data available yet.
              </div>
            )}
          </div>
        </section>

        {/* ── QUICK LINKS ── */}
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: <Activity size={24} className="text-purple-400" />,
                title: "Activity Feed",
                desc: "Live deal feed — listings, inquiries, and price changes as they happen.",
                href: "/activity",
                color: "rgba(139,92,246,0.1)",
                border: "rgba(139,92,246,0.2)",
              },
              {
                icon: <TrendingUp size={24} className="text-green-400" />,
                title: "Rankings",
                desc: "Brand leaderboard ranked by floor price, volume, and listing count.",
                href: "/rankings",
                color: "rgba(34,197,94,0.1)",
                border: "rgba(34,197,94,0.2)",
              },
              {
                icon: <BarChart3 size={24} className="text-yellow-400" />,
                title: "Analytics",
                desc: "Market intelligence, supply risk matrix, and ROI signals.",
                href: "/analytics",
                color: "rgba(234,179,8,0.1)",
                border: "rgba(234,179,8,0.2)",
              },
            ].map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="rounded-xl border p-5 flex flex-col gap-3 hover:scale-[1.02] transition-all group"
                style={{ background: card.color, borderColor: card.border }}
              >
                {card.icon}
                <div>
                  <p className="font-bold text-foreground">{card.title}</p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{card.desc}</p>
                </div>
                <span className="text-xs font-semibold text-blue-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                  Explore <ArrowRight size={12} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
