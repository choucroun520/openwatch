"use client"
import Link from "next/link"
import { Watch } from "lucide-react"
import { VerifiedBadge } from "@/components/shared/verified-badge"
import { MarketBadge } from "@/components/shared/market-badge"
import { formatCurrency } from "@/lib/utils/currency"
import { shortTimeAgo } from "@/lib/utils/dates"
import type { ListingWithRelations, MarketStats } from "@/lib/types"

interface ListingCardProps {
  listing: ListingWithRelations
  marketStats?: MarketStats
  isSoldOnChrono24?: boolean
}

const BRAND_TOP_COLORS: Record<string, string> = {
  "Rolex": "#006039",
  "Patek Philippe": "#1e3a5f",
  "Audemars Piguet": "#1a1a8c",
  "Vacheron Constantin": "#0e7490",
}

export default function ListingCard({ listing, marketStats, isSoldOnChrono24 }: ListingCardProps) {
  const price = parseFloat(listing.wholesale_price)
  const hasPriceOnRequest = price === 0
  const companyName = listing.dealer?.company_name ?? listing.dealer?.full_name ?? "Unknown Dealer"
  const isRcCrown = companyName.toUpperCase().startsWith("RC")
  const dealerInitial = isRcCrown ? "RC" : companyName[0]?.toUpperCase() ?? "?"
  const dealerBg = isRcCrown ? "#006039" : "linear-gradient(135deg, #2563eb, #7c3aed)"
  const isC24 = listing.source === 'chrono24'
  const brandTopColor = BRAND_TOP_COLORS[listing.brand?.name ?? ""] ?? "#475569"

  // C24 listings open on Chrono24; OpenWatch listings open internal detail page
  const CardWrapper = ({ children }: { children: React.ReactNode }) =>
    isC24 && listing.external_url ? (
      <a href={listing.external_url} target="_blank" rel="noopener noreferrer" className="group block">
        {children}
      </a>
    ) : (
      <Link href={`/listing/${listing.id}`} className="group block">
        {children}
      </Link>
    )

  return (
    <CardWrapper>
      <div
        className="relative overflow-hidden cursor-pointer"
        style={{
          background: "#1E1E2E",
          borderRadius: 12,
          borderTop: `3px solid ${brandTopColor}`,
          borderRight: "1px solid transparent",
          borderBottom: "1px solid transparent",
          borderLeft: "1px solid transparent",
          transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderRightColor = "#333333"
          el.style.borderBottomColor = "#333333"
          el.style.borderLeftColor = "#333333"
          el.style.transform = "scale(1.02)"
          el.style.boxShadow = `0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px ${brandTopColor}40`
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement
          el.style.borderRightColor = "transparent"
          el.style.borderBottomColor = "transparent"
          el.style.borderLeftColor = "transparent"
          el.style.transform = "scale(1.0)"
          el.style.boxShadow = "none"
        }}
      >
        {/* Image area — WHITE background */}
        <div className="relative aspect-square" style={{ background: "#FFFFFF" }}>
          {listing.images && listing.images.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.images[0]}
              alt={listing.reference_number ?? "Watch"}
              className="w-full h-full object-contain p-2"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none"
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Watch className="w-12 h-12" style={{ color: "#d1d5db" }} />
            </div>
          )}

          {/* Full Set badge top-left */}
          {listing.has_box && listing.has_papers && (
            <div
              className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full font-bold"
              style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}
            >
              Full Set
            </div>
          )}

          {/* Sold on Chrono24 badge — bottom-left */}
          {isSoldOnChrono24 && (
            <div
              className="absolute bottom-2 left-2 text-[10px] px-2 py-0.5 rounded-full font-bold"
              style={{ background: "rgba(230,126,0,0.15)", color: "#e67e00", border: "1px solid rgba(230,126,0,0.3)" }}
            >
              Sold on C24
            </div>
          )}

          {/* C24 source badge — top-right corner (below the + save button) */}
          {isC24 && (
            <div
              className="absolute top-2 left-2 text-[9px] px-1.5 py-0.5 rounded font-black"
              style={{ background: "rgba(32,129,226,0.85)", color: "#fff" }}
            >
              C24
            </div>
          )}

          {/* + save button top-right on hover */}
          <button
            className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: "rgba(32,129,226,0.9)" }}
            onClick={(e) => e.preventDefault()}
          >
            +
          </button>
        </div>

        {/* Card info */}
        <div className="p-3 space-y-1.5">
          {/* Dealer row */}
          <div className="flex items-center gap-1.5">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-white flex-shrink-0 font-bold"
              style={{
                background: dealerBg,
                fontSize: isRcCrown ? 7 : 9,
              }}
            >
              {dealerInitial}
            </div>
            <span className="text-[11px] truncate flex-1" style={{ color: "#8A939B" }}>
              {companyName}
            </span>
            {listing.dealer.verified && <VerifiedBadge size="sm" />}
          </div>

          {/* Brand */}
          <p className="text-[11px] font-medium" style={{ color: "#2081E2" }}>
            {listing.brand?.name ?? ""}
          </p>

          {/* Model name / title */}
          <p className="text-[13px] font-bold text-white leading-tight line-clamp-1">
            {listing.model?.name ?? listing.notes?.slice(0, 40) ?? listing.reference_number ?? "Watch"}
          </p>

          {/* Ref · Year · Material */}
          <p className="text-[11px]" style={{ color: "#8A939B" }}>
            {[
              listing.reference_number,
              listing.year?.toString(),
              listing.material?.replace("Stainless Steel", "SS"),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {/* Price row */}
          <div className="flex items-center justify-between pt-0.5">
            <p className="text-[14px] font-bold font-mono text-white">
              {hasPriceOnRequest ? (
                <span className="text-[12px] italic font-normal" style={{ color: "#8A939B" }}>
                  Price on Request
                </span>
              ) : (
                formatCurrency(listing.wholesale_price)
              )}
            </p>
            <p className="text-[11px]" style={{ color: "#8A939B" }}>
              {shortTimeAgo(listing.listed_at)}
            </p>
          </div>

          {/* Market badge */}
          {marketStats && !hasPriceOnRequest && (
            <MarketBadge askingPrice={price} marketStats={marketStats} />
          )}

          {/* Hover: CTA button */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
            <button
              className="w-full py-1.5 rounded-lg text-[12px] font-semibold text-white transition-colors"
              style={{ background: isC24 ? "#e67e00" : "#2081E2" }}
              onClick={(e) => e.preventDefault()}
            >
              {isC24 ? "View on Chrono24" : "Make Inquiry"}
            </button>
          </div>
        </div>
      </div>
    </CardWrapper>
  )
}
