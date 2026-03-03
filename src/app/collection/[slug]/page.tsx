import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import AppLayout from "@/components/layout/app-layout"
import NetworkGrid from "@/components/network/network-grid"
import { BrandAvatar, getBrandGradientBySlug } from "@/components/shared/brand-avatar"
import { ActivityRow } from "@/components/shared/activity-row"
import { VerifiedBadge } from "@/components/shared/verified-badge"
import { formatCurrency } from "@/lib/utils/currency"
import type { ListingWithRelations, Brand } from "@/lib/types"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: brand } = await (supabase as any)
    .from("brands")
    .select("name")
    .eq("slug", slug)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { title: `${(brand as any)?.name ?? "Brand"} — OpenWatch` }
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Fetch brand
  const { data: brand } = await db
    .from("brands")
    .select("*")
    .eq("slug", slug)
    .is("deleted_at", null)
    .single()

  if (!brand) notFound()

  // Fetch brand listings with relations
  const { data: listings } = await db
    .from("listings")
    .select(`
      *,
      brand:brands(*),
      model:models(*),
      dealer:profiles!dealer_id(id, full_name, company_name, avatar_url, verified, seller_rating, total_sales)
    `)
    .eq("brand_id", brand.id)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("listed_at", { ascending: false })

  // Fetch all brands for sidebar (to allow switching)
  const { data: allBrands } = await db
    .from("brands")
    .select("*")
    .is("deleted_at", null)
    .order("name")

  // Fetch recent activity for this brand
  const { data: recentEvents } = await db
    .from("market_events")
    .select(`
      *,
      listing:listings(
        reference_number,
        wholesale_price,
        model:models(name),
        dealer:profiles!dealer_id(company_name, full_name)
      )
    `)
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false })
    .limit(10)

  const typedListings = (listings ?? []) as unknown as ListingWithRelations[]

  // Compute brand stats
  const prices = typedListings
    .map((l) => parseFloat(l.wholesale_price))
    .filter((p) => p > 0)

  const floorPrice = prices.length ? Math.min(...prices) : 0
  const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0
  const totalListings = typedListings.length
  const uniqueDealers = new Set(typedListings.map((l) => l.dealer_id)).size

  const gradient = brand.banner_gradient ?? getBrandGradientBySlug(brand.slug)

  return (
    <AppLayout>
      {/* ── BANNER ── */}
      <div className="relative" style={{ height: 200, background: gradient }}>
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, transparent 50%, rgba(11,11,20,0.8) 100%)" }}
        />
      </div>

      {/* ── BRAND HEADER ── */}
      <div className="max-w-[1400px] mx-auto px-4">
        <div className="relative -mt-10 flex items-end gap-4 mb-4">
          <div
            className="rounded-full border-4 shrink-0 z-10"
            style={{ borderColor: "#0b0b14" }}
          >
            <BrandAvatar brandName={brand.name} size="xl" />
          </div>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-black text-foreground">{brand.name}</h1>
              {brand.verified && <VerifiedBadge size="lg" />}
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-lg">
              {brand.description ??
                `${brand.name} luxury timepieces — ${totalListings} listings available through OpenWatch's dealer network.`}
            </p>
          </div>

          {/* Brand details */}
          {brand.founded && (
            <div className="text-right hidden sm:block">
              <p className="text-xs text-muted-foreground">Founded {brand.founded}</p>
              {brand.headquarters && (
                <p className="text-xs text-muted-foreground">{brand.headquarters}</p>
              )}
            </div>
          )}
        </div>

        {/* Stats bar */}
        <div
          className="grid grid-cols-2 sm:grid-cols-5 gap-px rounded-xl overflow-hidden border mb-6"
          style={{ borderColor: "#1c1c2a" }}
        >
          {[
            { label: "Floor Price", value: floorPrice > 0 ? formatCurrency(floorPrice) : "—" },
            { label: "Avg Price", value: avgPrice > 0 ? formatCurrency(avgPrice) : "—" },
            { label: "Total Listed", value: totalListings.toString() },
            { label: "Dealers", value: uniqueDealers.toString() },
            { label: "Est. Production", value: brand.annual_production ? `${(brand.annual_production / 1000).toFixed(0)}k/yr` : "—" },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className="px-4 py-3 text-center"
              style={{ background: i % 2 === 0 ? "#111119" : "#111119" }}
            >
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                {stat.label}
              </p>
              <p className="text-base font-black font-mono text-foreground mt-0.5">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── TABS: Items / Activity ── */}
        <div className="flex gap-0 border-b mb-0" style={{ borderColor: "#1c1c2a" }}>
          <button className="px-4 py-2.5 text-sm font-semibold text-foreground border-b-2 border-blue-500">
            Items
          </button>
          <button className="px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Activity
          </button>
        </div>
      </div>

      {/* ── ITEMS GRID (reuse NetworkGrid pre-filtered to this brand) ── */}
      <div className="max-w-[1400px] mx-auto">
        <NetworkGrid
          listings={typedListings}
          brands={(allBrands ?? []) as Brand[]}
          initialBrand={brand.slug}
        />
      </div>

      {/* ── RECENT ACTIVITY ── */}
      {(recentEvents ?? []).length > 0 && (
        <div className="max-w-[1400px] mx-auto px-4 pb-12 mt-8">
          <h2 className="text-lg font-black text-foreground mb-4">Recent Activity</h2>
          <div className="rounded-xl border overflow-hidden" style={{ background: "#111119", borderColor: "#1c1c2a" }}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {((recentEvents ?? []) as any[]).map((event: any) => {
              const ev = event
              const listing = ev.listing
              return (
                <ActivityRow
                  key={event.id}
                  eventType={event.event_type}
                  brandName={brand.name}
                  modelName={listing?.model?.name}
                  referenceNumber={listing?.reference_number}
                  price={event.price ?? listing?.wholesale_price}
                  dealerName={listing?.dealer?.company_name ?? listing?.dealer?.full_name}
                  createdAt={event.created_at}
                />
              )
            })}
          </div>
        </div>
      )}
    </AppLayout>
  )
}
