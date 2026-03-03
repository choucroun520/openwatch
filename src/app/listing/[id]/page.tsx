import { notFound } from "next/navigation"
import Link from "next/link"
import { Watch, Star, Share2, RefreshCw, MoreHorizontal, Eye, Bookmark } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import AppLayout from "@/components/layout/app-layout"
import { VerifiedBadge } from "@/components/shared/verified-badge"
import { ConditionBadge } from "@/components/shared/condition-badge"
import { BrandAvatar, getBrandGradientBySlug } from "@/components/shared/brand-avatar"
import InquiryDialog from "./_inquiry-dialog"
import MarketCompsSection from "./_market-comps"
import ListingCard from "@/components/network/listing-card"
import { formatCurrency } from "@/lib/utils/currency"
import { timeAgo } from "@/lib/utils/dates"
import { cn } from "@/lib/utils"
import type { ListingWithRelations, MarketComp } from "@/lib/types"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from("listings")
    .select("reference_number, brand:brands(name), model:models(name)")
    .eq("id", id)
    .single()

  if (!data) return { title: "Listing — OpenWatch" }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any
  return {
    title: `${d.brand?.name ?? ""} ${d.model?.name ?? ""} ${d.reference_number} — OpenWatch`,
  }
}

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch listing with all relations
  const { data: rawListing } = await supabase
    .from("listings")
    .select(
      `
      *,
      brand:brands(*),
      model:models(*),
      dealer:profiles!dealer_id(id, full_name, company_name, avatar_url, verified, seller_rating, total_sales)
    `
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single()

  if (!rawListing) notFound()

  const listing = rawListing as unknown as ListingWithRelations

  // Increment views (fire and forget)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  void (supabase as any)
    .from("listings")
    .update({ views: listing.views + 1 })
    .eq("id", id)

  // Fetch model avg price
  const { data: modelListings } = await supabase
    .from("listings")
    .select("wholesale_price")
    .eq("model_id", listing.model_id)
    .eq("status", "active")
    .is("deleted_at", null)
    .neq("id", id)

  const modelPrices = (modelListings ?? [])
    .map((l: { wholesale_price: string }) => parseFloat(l.wholesale_price))
    .filter(Boolean)

  const avgPrice = modelPrices.length
    ? modelPrices.reduce((a: number, b: number) => a + b, 0) / modelPrices.length
    : 0

  const currentPrice = parseFloat(listing.wholesale_price)
  const priceDiff =
    avgPrice > 0 && currentPrice > 0
      ? ((currentPrice - avgPrice) / avgPrice) * 100
      : 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Fetch similar listings (same brand)
  const { data: similarListings } = await db
    .from("listings")
    .select(
      `
      *,
      brand:brands(*),
      model:models(*),
      dealer:profiles!dealer_id(id, full_name, company_name, avatar_url, verified, seller_rating, total_sales)
    `
    )
    .eq("brand_id", listing.brand_id)
    .eq("status", "active")
    .is("deleted_at", null)
    .neq("id", id)
    .order("listed_at", { ascending: false })
    .limit(5)

  // Fetch market comps for this reference number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: marketComps } = listing.reference_number
    ? await (supabase as any)
        .from("market_comps")
        .select("*")
        .eq("reference_number", listing.reference_number)
        .order("sale_date", { ascending: false })
        .limit(20)
    : { data: [] }

  // Fetch more from same dealer
  const { data: dealerListings } = await db
    .from("listings")
    .select(
      `
      *,
      brand:brands(*),
      model:models(*),
      dealer:profiles!dealer_id(id, full_name, company_name, avatar_url, verified, seller_rating, total_sales)
    `
    )
    .eq("dealer_id", listing.dealer_id)
    .eq("status", "active")
    .is("deleted_at", null)
    .neq("id", id)
    .order("listed_at", { ascending: false })
    .limit(5)

  const sellerRating = parseFloat(listing.dealer.seller_rating as string) || 0
  const hasPriceOnRequest = currentPrice === 0

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* ── BREADCRUMB ── */}
        <nav className="text-sm text-muted-foreground mb-6 flex items-center gap-2 flex-wrap">
          <Link href="/network" className="hover:text-foreground transition-colors">
            Network
          </Link>
          <span>/</span>
          <Link
            href={`/collection/${listing.brand.slug}`}
            className="hover:text-foreground transition-colors"
          >
            {listing.brand.name}
          </Link>
          <span>/</span>
          <span className="text-foreground">
            {listing.model?.name} {listing.reference_number}
          </span>
        </nav>

        {/* ── TWO-COLUMN LAYOUT ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ── LEFT: Image ── */}
          <div>
            {/* Main image card */}
            <div
              className="relative rounded-2xl overflow-hidden border min-h-[420px] flex items-center justify-center"
              style={{
                background: listing.brand.banner_gradient ?? getBrandGradientBySlug(listing.brand.slug),
                borderColor: "#1c1c2a",
              }}
            >
              {listing.images && listing.images.length > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={listing.images[0]}
                  alt={listing.reference_number ?? "Watch"}
                  className="w-full h-full object-contain p-8 min-h-[420px]"
                />
              ) : (
                <Watch className="w-36 h-36 text-white/15" />
              )}

              {/* Badges */}
              {listing.has_box && listing.has_papers && (
                <div className="absolute top-3 left-3 bg-green-500/20 text-green-400 border border-green-500/30 text-xs px-2.5 py-1 rounded-full font-semibold">
                  Full Set
                </div>
              )}
              <div className="absolute bottom-3 left-3">
                <ConditionBadge condition={listing.condition} />
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2 mt-3 px-1">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-bg-elevated border transition-colors"
                style={{ borderColor: "#1c1c2a" }}
              >
                <Share2 size={12} />
                Share
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-bg-elevated border transition-colors"
                style={{ borderColor: "#1c1c2a" }}
              >
                <RefreshCw size={12} />
                Refresh
              </button>
              <button className="ml-auto p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-bg-elevated border transition-colors"
                style={{ borderColor: "#1c1c2a" }}
              >
                <MoreHorizontal size={16} />
              </button>
            </div>

            {/* Completeness cards */}
            <div className="grid grid-cols-3 gap-2 mt-3">
              {[
                { label: "Box", value: listing.has_box },
                { label: "Papers", value: listing.has_papers },
                { label: "Warranty", value: listing.has_warranty },
              ].map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    "rounded-xl p-3 text-center border",
                    item.value
                      ? "bg-green-500/10 border-green-500/20"
                      : ""
                  )}
                  style={!item.value ? { background: "#111119", borderColor: "#1c1c2a" } : undefined}
                >
                  <p className={cn("text-xs font-semibold", item.value ? "text-green-400" : "text-muted-foreground")}>
                    {item.value ? "✓ " : "— "}{item.label}
                  </p>
                  <p className={cn("text-[11px] mt-0.5", item.value ? "text-green-400/80" : "text-muted-foreground/60")}>
                    {item.value ? "Included" : "Not Included"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Info ── */}
          <div className="space-y-5">
            {/* Brand link */}
            <Link
              href={`/collection/${listing.brand.slug}`}
              className="text-sm text-blue-400 font-semibold hover:underline flex items-center gap-1.5"
            >
              <BrandAvatar brandName={listing.brand.name} size="sm" />
              {listing.brand.name}
            </Link>

            {/* Title */}
            <div>
              <h1 className="text-2xl font-black text-foreground leading-tight">
                {listing.model?.name} · {listing.reference_number}
              </h1>
              <p className="text-muted-foreground text-sm mt-1 flex items-center gap-2 flex-wrap">
                {listing.year && <span>{listing.year}</span>}
                {listing.year && listing.material && <span>·</span>}
                {listing.material && <span>{listing.material}</span>}
                {listing.case_size && <span>· {listing.case_size}</span>}
              </p>
            </div>

            {/* Dealer */}
            <div
              className="flex items-center gap-3 rounded-xl border p-3.5"
              style={{ background: "#111119", borderColor: "#1c1c2a" }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0"
                style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}
              >
                {(listing.dealer.company_name || listing.dealer.full_name || "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-sm text-foreground">
                    {listing.dealer.company_name || listing.dealer.full_name}
                  </span>
                  {listing.dealer.verified && <VerifiedBadge />}
                </div>
                <div className="flex items-center gap-0.5 mt-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "w-3 h-3",
                        i < Math.round(sellerRating)
                          ? "text-yellow-400 fill-yellow-400"
                          : "text-muted-foreground"
                      )}
                    />
                  ))}
                  <span className="text-xs text-muted-foreground ml-1.5">
                    {listing.dealer.total_sales} sales
                  </span>
                </div>
              </div>
            </div>

            {/* Traits grid */}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-2.5">
                Watch Details
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Brand", value: listing.brand.name },
                  { label: "Model", value: listing.model?.name },
                  { label: "Reference", value: listing.reference_number },
                  { label: "Material", value: listing.material },
                  { label: "Dial Color", value: listing.dial_color },
                  { label: "Case Size", value: listing.case_size || "—" },
                  { label: "Year", value: listing.year.toString() },
                  { label: "Movement", value: listing.movement || "—" },
                  { label: "Listed", value: timeAgo(listing.listed_at) },
                ].map((trait) => (
                  <div
                    key={trait.label}
                    className="rounded-xl p-2.5 text-center border"
                    style={{ background: "rgba(37,99,235,0.05)", borderColor: "rgba(37,99,235,0.15)" }}
                  >
                    <p className="text-[10px] text-blue-400 uppercase font-black tracking-wider">
                      {trait.label}
                    </p>
                    <p
                      className="text-xs font-semibold text-foreground mt-0.5 truncate"
                      title={trait.value}
                    >
                      {trait.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Complications */}
            {listing.complications && listing.complications.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-2">
                  Complications
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {listing.complications.map((c) => (
                    <span
                      key={c}
                      className="text-xs px-2 py-1 rounded-lg border font-medium"
                      style={{ background: "#161622", borderColor: "#22222e", color: "#94a3b8" }}
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Price card */}
            <div
              className="rounded-2xl border p-5"
              style={{ background: "#111119", borderColor: "#1c1c2a" }}
            >
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
                Wholesale Price
              </p>
              <div className="flex items-end gap-3 mt-1.5">
                <p className="text-4xl font-black font-mono text-foreground">
                  {hasPriceOnRequest ? (
                    <span className="text-2xl text-muted-foreground font-bold font-sans">
                      Price on Request
                    </span>
                  ) : (
                    formatCurrency(listing.wholesale_price)
                  )}
                </p>
              </div>

              {avgPrice > 0 && !hasPriceOnRequest && (
                <p
                  className={cn(
                    "text-sm mt-1.5 font-medium",
                    priceDiff < 0 ? "text-green-400" : "text-red-400"
                  )}
                >
                  {Math.abs(priceDiff).toFixed(1)}%{" "}
                  {priceDiff < 0 ? "below" : "above"} model avg ({formatCurrency(avgPrice)})
                </p>
              )}

              {/* Views */}
              <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                <Eye size={12} />
                {listing.views + 1} views
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mt-4">
                <div className="flex-1">
                  <InquiryDialog listing={listing} />
                </div>
                <button
                  className="px-4 h-10 rounded-lg border text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-bg-elevated transition-colors flex items-center gap-1.5"
                  style={{ borderColor: "#1c1c2a" }}
                >
                  <Bookmark size={14} />
                  Save
                </button>
              </div>
            </div>

            {/* Market Comps */}
            {listing.reference_number && (
              <MarketCompsSection
                comps={(marketComps ?? []) as MarketComp[]}
                askingPrice={currentPrice}
                referenceNumber={listing.reference_number}
              />
            )}

            {/* Dealer Notes */}
            {listing.notes && (
              <div
                className="rounded-xl border p-4"
                style={{ background: "#111119", borderColor: "#1c1c2a" }}
              >
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-2">
                  Dealer Notes
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">{listing.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── MORE FROM DEALER ── */}
        {(dealerListings ?? []).length > 0 && (
          <section className="mt-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-foreground">
                More from {listing.dealer.company_name || listing.dealer.full_name}
              </h2>
              <Link
                href={`/network`}
                className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                See all →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {((dealerListings ?? []) as any[]).map((l: any) => (
                <ListingCard key={l.id} listing={l as unknown as ListingWithRelations} />
              ))}
            </div>
          </section>
        )}

        {/* ── SIMILAR WATCHES ── */}
        {(similarListings ?? []).length > 0 && (
          <section className="mt-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-foreground">
                More {listing.brand.name} Watches
              </h2>
              <Link
                href={`/collection/${listing.brand.slug}`}
                className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                See collection →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {((similarListings ?? []) as any[]).map((l: any) => (
                <ListingCard key={l.id} listing={l as unknown as ListingWithRelations} />
              ))}
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  )
}
