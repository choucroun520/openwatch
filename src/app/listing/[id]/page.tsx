import { notFound } from "next/navigation"
import Link from "next/link"
import { Watch, Star, Share2, RefreshCw, MoreHorizontal, Eye, Bookmark, ExternalLink } from "lucide-react"
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

  // Fetch model avg price (skip if no model_id — e.g. imported C24 listings)
  const { data: modelListings } = listing.model_id
    ? await supabase
        .from("listings")
        .select("wholesale_price")
        .eq("model_id", listing.model_id)
        .eq("status", "active")
        .is("deleted_at", null)
        .neq("id", id)
    : { data: [] }

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

  // RC Crown detection
  const isRCCrown =
    listing.source === "rccrown" ||
    listing.dealer.company_name?.toLowerCase().includes("rc crown") ||
    listing.dealer.company_name?.toLowerCase().includes("rccrown")

  // Market comps stats for price summary card
  const compPrices = ((marketComps ?? []) as MarketComp[])
    .map((c) => parseFloat(String(c.price)))
    .filter((p) => p > 0)
  const marketFloor = compPrices.length ? Math.min(...compPrices) : 0
  const marketAvg = compPrices.length
    ? compPrices.reduce((a, b) => a + b, 0) / compPrices.length
    : 0
  const vsMarketAvg =
    marketAvg > 0 && currentPrice > 0
      ? ((currentPrice - marketAvg) / marketAvg) * 100
      : null

  // External search links
  const refEncoded = encodeURIComponent(listing.reference_number ?? "")
  const searchLinks = listing.reference_number
    ? [
        {
          name: "Chrono24",
          emoji: "🔵",
          url: `https://www.chrono24.com/search/index.htm?query=${refEncoded}`,
        },
        {
          name: "eBay Sold",
          emoji: "📦",
          url: `https://www.ebay.com/sch/i.html?_nkw=${refEncoded}&LH_Sold=1&LH_Complete=1`,
        },
        {
          name: "WatchBox",
          emoji: "⌚",
          url: `https://www.watchbox.com/search?q=${refEncoded}`,
        },
        {
          name: "Bob's Watches",
          emoji: "🏆",
          url: `https://www.bobswatches.com/rolex-watches.html?q=${refEncoded}`,
        },
        {
          name: "Subdial",
          emoji: "🔮",
          url: `https://subdial.com/search?query=${refEncoded}`,
        },
        {
          name: "Watchfinder",
          emoji: "🔍",
          url: `https://www.watchfinder.com/search?q=${refEncoded}`,
        },
        {
          name: "WatchCharts",
          emoji: "📊",
          url: `https://watchcharts.com/watches/search?query=${refEncoded}`,
        },
      ]
    : []

  // Build specs rows — only show fields with values
  const specRows: { label: string; value: string; mono?: boolean }[] = [
    listing.reference_number ? { label: "Reference", value: listing.reference_number, mono: true } : null,
    listing.brand?.name ? { label: "Brand", value: listing.brand.name } : null,
    listing.model?.name ? { label: "Model", value: listing.model.name } : null,
    listing.year ? { label: "Year", value: listing.year.toString() } : null,
    listing.material ? { label: "Material", value: listing.material } : null,
    listing.dial_color ? { label: "Dial Color", value: listing.dial_color } : null,
    listing.case_size ? { label: "Case Size", value: listing.case_size } : null,
    listing.movement ? { label: "Movement", value: listing.movement } : null,
    { label: "Serial Number", value: listing.serial_number || "N/A" },
    listing.has_warranty && listing.warranty_date
      ? { label: "Warranty", value: `Included · ${new Date(listing.warranty_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}` }
      : listing.has_warranty
      ? { label: "Warranty", value: "Included" }
      : null,
    listing.service_history ? { label: "Service History", value: listing.service_history } : null,
    listing.condition_score
      ? { label: "Condition Score", value: `${listing.condition_score}/10` }
      : null,
    { label: "Listed", value: timeAgo(listing.listed_at) },
    { label: "Views", value: `${listing.views + 1}` },
  ].filter((r): r is { label: string; value: string; mono?: boolean } => r !== null)

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
              {/* Source badge on image */}
              {isRCCrown && (
                <div
                  className="absolute top-3 right-3 text-xs px-2.5 py-1 rounded-full font-black"
                  style={{ background: "rgba(0,96,57,0.85)", color: "#4ade80", border: "1px solid rgba(0,96,57,0.5)" }}
                >
                  👑 RC Crown
                </div>
              )}
              {listing.source === "chrono24" && !isRCCrown && (
                <div
                  className="absolute top-3 right-3 text-xs px-2.5 py-1 rounded-full font-black"
                  style={{ background: "rgba(32,129,226,0.85)", color: "#fff", border: "1px solid rgba(32,129,226,0.4)" }}
                >
                  Chrono24
                </div>
              )}
              {listing.condition && (
                <div className="absolute bottom-3 left-3">
                  <ConditionBadge condition={listing.condition} />
                </div>
              )}
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2 mt-3 px-1">
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-bg-elevated border transition-colors"
                style={{ borderColor: "#1c1c2a" }}
              >
                <Share2 size={12} />
                Share
              </button>
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-bg-elevated border transition-colors"
                style={{ borderColor: "#1c1c2a" }}
              >
                <RefreshCw size={12} />
                Refresh
              </button>
              <button
                className="ml-auto p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-bg-elevated border transition-colors"
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
                    item.value ? "bg-green-500/10 border-green-500/20" : ""
                  )}
                  style={!item.value ? { background: "#111119", borderColor: "#1c1c2a" } : undefined}
                >
                  <p
                    className={cn(
                      "text-xs font-semibold",
                      item.value ? "text-green-400" : "text-muted-foreground"
                    )}
                  >
                    {item.value ? "✓ " : "— "}
                    {item.label}
                  </p>
                  <p
                    className={cn(
                      "text-[11px] mt-0.5",
                      item.value ? "text-green-400/80" : "text-muted-foreground/60"
                    )}
                  >
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

            {/* ── DEALER CARD ── */}
            <div
              className="flex items-center gap-3 rounded-xl border p-3.5"
              style={{
                background: isRCCrown ? "rgba(0,96,57,0.08)" : "#111119",
                borderColor: isRCCrown ? "rgba(0,96,57,0.3)" : "#1c1c2a",
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0"
                style={{
                  background: isRCCrown
                    ? "linear-gradient(135deg, #006039, #00a86b)"
                    : "linear-gradient(135deg, #2563eb, #7c3aed)",
                }}
              >
                {isRCCrown
                  ? "👑"
                  : (listing.dealer.company_name || listing.dealer.full_name || "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Link
                    href={`/dealers/${listing.dealer.id}`}
                    className="font-semibold text-sm text-foreground hover:underline"
                  >
                    {listing.dealer.company_name || listing.dealer.full_name}
                  </Link>
                  {listing.dealer.verified && <VerifiedBadge />}
                  {isRCCrown && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-black"
                      style={{
                        background: "rgba(0,96,57,0.2)",
                        color: "#4ade80",
                        border: "1px solid rgba(0,96,57,0.3)",
                      }}
                    >
                      RC Crown
                    </span>
                  )}
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

            {/* ── SPECS GRID ── */}
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-2.5">
                Watch Details
              </p>
              <div
                className="rounded-xl border divide-y overflow-hidden"
                style={{ borderColor: "#1c1c2a" }}
              >
                {specRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-start px-3 py-2 gap-3"
                    style={{ borderColor: "#1c1c2a" }}
                  >
                    <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">
                      {row.label}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-semibold text-foreground flex-1 break-words",
                        row.mono && "font-mono"
                      )}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}

                {/* Has Box row */}
                <div
                  className="flex items-start px-3 py-2 gap-3"
                  style={{ borderColor: "#1c1c2a" }}
                >
                  <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">Has Box</span>
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      listing.has_box ? "text-green-400" : "text-red-400"
                    )}
                  >
                    {listing.has_box ? "✓ Yes" : "✗ No"}
                  </span>
                </div>

                {/* Has Papers row */}
                <div
                  className="flex items-start px-3 py-2 gap-3"
                  style={{ borderColor: "#1c1c2a" }}
                >
                  <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">Has Papers</span>
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      listing.has_papers ? "text-green-400" : "text-red-400"
                    )}
                  >
                    {listing.has_papers ? "✓ Yes" : "✗ No"}
                  </span>
                </div>

                {/* Source row */}
                {listing.source && listing.source !== "openwatch" && (
                  <div
                    className="flex items-start px-3 py-2 gap-3"
                    style={{ borderColor: "#1c1c2a" }}
                  >
                    <span className="text-xs text-muted-foreground w-28 shrink-0 pt-0.5">Source</span>
                    <span className="text-xs font-semibold">
                      {isRCCrown ? (
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-black"
                          style={{
                            background: "rgba(0,96,57,0.15)",
                            color: "#4ade80",
                            border: "1px solid rgba(0,96,57,0.3)",
                          }}
                        >
                          👑 RC Crown
                        </span>
                      ) : listing.source === "chrono24" ? (
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-black"
                          style={{
                            background: "rgba(32,129,226,0.15)",
                            color: "#2081E2",
                            border: "1px solid rgba(32,129,226,0.25)",
                          }}
                        >
                          Chrono24
                        </span>
                      ) : (
                        <span className="text-foreground">{listing.source}</span>
                      )}
                    </span>
                  </div>
                )}
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

            {/* ── PRICE CARD ── */}
            <div
              className="rounded-2xl border p-5"
              style={{
                background: isRCCrown ? "rgba(0,96,57,0.06)" : "#111119",
                borderColor: isRCCrown ? "rgba(0,96,57,0.25)" : "#1c1c2a",
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
                  {isRCCrown
                    ? "RC Crown Price"
                    : listing.source === "chrono24"
                    ? "Asking Price"
                    : "Wholesale Price"}
                </p>
                {isRCCrown && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded font-black"
                    style={{
                      background: "rgba(0,96,57,0.2)",
                      color: "#4ade80",
                      border: "1px solid rgba(0,96,57,0.3)",
                    }}
                  >
                    👑 RC Crown
                  </span>
                )}
                {listing.source === "chrono24" && !isRCCrown && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded font-black"
                    style={{
                      background: "rgba(32,129,226,0.15)",
                      color: "#2081E2",
                      border: "1px solid rgba(32,129,226,0.2)",
                    }}
                  >
                    Chrono24
                  </span>
                )}
              </div>
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
                {isRCCrown ? (
                  <>
                    <a
                      href={listing.external_url ?? "https://www.rccrown.com"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 h-10 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90"
                      style={{ background: "#006039" }}
                    >
                      👑 View on RC Crown ↗
                    </a>
                    <div>
                      <InquiryDialog listing={listing} />
                    </div>
                  </>
                ) : listing.source === "chrono24" && listing.external_url ? (
                  <a
                    href={listing.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 h-10 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90"
                    style={{ background: "#e67e00" }}
                  >
                    View on Chrono24 ↗
                  </a>
                ) : (
                  <div className="flex-1">
                    <InquiryDialog listing={listing} />
                  </div>
                )}
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

        {/* ── FIND THIS WATCH EVERYWHERE ── */}
        {listing.reference_number && (
          <section className="mt-10">
            <div
              className="rounded-2xl border p-6"
              style={{ background: "#0d1117", borderColor: "#1c1c2a" }}
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-black text-foreground">
                    🔍 Find This Watch Everywhere
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Search for{" "}
                    <span className="font-mono font-bold text-foreground">
                      {listing.reference_number}
                    </span>{" "}
                    across every major marketplace
                  </p>
                </div>
                <a
                  href={`/ref/${encodeURIComponent(listing.reference_number)}`}
                  className="text-sm text-blue-400 hover:text-blue-300 font-semibold transition-colors flex items-center gap-1"
                >
                  Market deep dive →
                </a>
              </div>

              {/* Price Summary Card — if comps exist */}
              {compPrices.length > 0 && !hasPriceOnRequest && (
                <div
                  className="rounded-xl border p-4 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-4"
                  style={{ background: "#111119", borderColor: "#1c1c2a" }}
                >
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                      {isRCCrown ? "RC Crown Asks" : "This Listing"}
                    </p>
                    <p
                      className="text-base font-black font-mono mt-0.5"
                      style={{ color: isRCCrown ? "#4ade80" : "#e2e8f0" }}
                    >
                      {formatCurrency(currentPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                      Market Floor
                    </p>
                    <p className="text-base font-black font-mono text-foreground mt-0.5">
                      {formatCurrency(marketFloor)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                      Market Avg
                    </p>
                    <p className="text-base font-black font-mono text-foreground mt-0.5">
                      {formatCurrency(marketAvg)}
                    </p>
                  </div>
                  {vsMarketAvg !== null && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        vs Market Avg
                      </p>
                      <p
                        className={cn(
                          "text-base font-black font-mono mt-0.5",
                          vsMarketAvg <= 0 ? "text-green-400" : "text-red-400"
                        )}
                      >
                        {vsMarketAvg <= 0 ? "▼" : "▲"}{" "}
                        {Math.abs(vsMarketAvg).toFixed(1)}%{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          {vsMarketAvg <= 0 ? "below avg" : "above avg"}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* External search links grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {searchLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all hover:border-blue-500/40 hover:bg-blue-500/5"
                    style={{ background: "#111119", borderColor: "#1c1c2a" }}
                  >
                    <span className="text-lg leading-none">{link.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{link.name}</p>
                      <p className="text-[10px] text-muted-foreground group-hover:text-blue-400 transition-colors">
                        Search →
                      </p>
                    </div>
                    <ExternalLink size={10} className="text-muted-foreground/40 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}

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
