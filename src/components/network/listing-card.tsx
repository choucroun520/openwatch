"use client"
import Link from "next/link"
import { Watch } from "lucide-react"
import { VerifiedBadge } from "@/components/shared/verified-badge"
import { formatCurrency } from "@/lib/utils/currency"
import { shortTimeAgo } from "@/lib/utils/dates"
import type { ListingWithRelations } from "@/lib/types"

interface ListingCardProps {
  listing: ListingWithRelations
}

export default function ListingCard({ listing }: ListingCardProps) {
  const price = parseFloat(listing.wholesale_price)
  const hasPriceOnRequest = price === 0
  const companyName = listing.dealer.company_name ?? listing.dealer.full_name ?? "?"
  const isRcCrown = companyName.toUpperCase().startsWith("RC")
  const dealerInitial = isRcCrown ? "RC" : companyName[0]?.toUpperCase() ?? "?"
  const dealerBg = isRcCrown ? "#006039" : "linear-gradient(135deg, #2563eb, #7c3aed)"

  return (
    <Link href={`/listing/${listing.id}`} className="group block">
      <div
        className="relative overflow-hidden cursor-pointer transition-all duration-150"
        style={{
          background: "#1E1E2E",
          borderRadius: 12,
          border: "1px solid transparent",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#333333"
          e.currentTarget.style.transform = "translateY(-2px)"
          e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.4)"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "transparent"
          e.currentTarget.style.transform = "translateY(0)"
          e.currentTarget.style.boxShadow = "none"
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
            {listing.brand.name}
          </p>

          {/* Model name */}
          <p className="text-[13px] font-bold text-white leading-tight line-clamp-1">
            {listing.model?.name ?? listing.notes?.slice(0, 35) ?? "Watch"}
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

          {/* Hover: Make Inquiry button */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
            <button
              className="w-full py-1.5 rounded-lg text-[12px] font-semibold text-white transition-colors"
              style={{ background: "#2081E2" }}
              onClick={(e) => e.preventDefault()}
            >
              Make Inquiry
            </button>
          </div>
        </div>
      </div>
    </Link>
  )
}
