"use client"

import Link from "next/link"
import { Watch, MessageSquare } from "lucide-react"
import { VerifiedBadge } from "@/components/shared/verified-badge"
import { ConditionBadge } from "@/components/shared/condition-badge"
import { getBrandGradientBySlug } from "@/components/shared/brand-avatar"
import { formatCurrency } from "@/lib/utils/currency"
import { shortTimeAgo } from "@/lib/utils/dates"
import type { ListingWithRelations } from "@/lib/types"

interface ListingCardProps {
  listing: ListingWithRelations
}

export default function ListingCard({ listing }: ListingCardProps) {
  const price = parseFloat(listing.wholesale_price)
  const hasPriceOnRequest = price === 0

  return (
    <Link href={`/listing/${listing.id}`} className="group block">
      <div className="relative rounded-xl border overflow-hidden cursor-pointer transition-all duration-150 hover:-translate-y-1 group-hover:border-blue-500 group-hover:shadow-[0_8px_30px_rgba(37,99,235,0.12)]"
        style={{ background: "#111119", borderColor: "#1c1c2a" }}
      >
        {/* Image area */}
        <div
          className="relative h-56 flex items-center justify-center overflow-hidden"
          style={{
            background:
              listing.brand.banner_gradient ??
              getBrandGradientBySlug(listing.brand.slug),
          }}
        >
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
            <Watch className="w-16 h-16 text-white/20" />
          )}

          {/* Top-left rarity badge */}
          {hasPriceOnRequest ? (
            <div className="absolute top-2 left-2 bg-gray-500/20 text-gray-400 border border-gray-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold">
              No Price
            </div>
          ) : null}

          {/* Top-right Full Set badge */}
          {listing.has_box && listing.has_papers && (
            <div className="absolute top-2 right-2 bg-green-500/20 text-green-400 border border-green-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold">
              Full Set
            </div>
          )}

          {/* Hover Quick View overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white border"
              style={{ background: "rgba(37,99,235,0.9)", borderColor: "rgba(37,99,235,0.5)" }}
            >
              <MessageSquare size={12} />
              Quick View
            </div>
          </div>
        </div>

        {/* Card footer */}
        <div className="p-3 space-y-1.5">
          {/* Dealer row */}
          <div className="flex items-center gap-1.5">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}
            >
              {(
                listing.dealer.company_name ||
                listing.dealer.full_name ||
                "?"
              )[0].toUpperCase()}
            </div>
            <span className="text-[11px] text-muted-foreground truncate flex-1">
              {listing.dealer.company_name || listing.dealer.full_name}
            </span>
            {listing.dealer.verified && <VerifiedBadge size="sm" />}
          </div>

          {/* Brand name */}
          <p className="text-[11px] text-blue-400 font-medium">
            {listing.brand.name}
          </p>

          {/* Model name */}
          <p className="text-[13px] font-bold text-foreground leading-tight">
            {listing.model.name || listing.notes?.slice(0, 40) || "Watch"}
          </p>

          {/* Ref · Year */}
          <p className="text-[11px] text-muted-foreground">
            {listing.reference_number}
            {listing.year ? ` · ${listing.year}` : ""}
            {listing.material ? ` · ${listing.material.replace("Stainless Steel", "SS")}` : ""}
          </p>

          {/* Condition badge */}
          <div>
            <ConditionBadge condition={listing.condition} />
          </div>

          {/* Price + time row */}
          <div className="flex items-end justify-between pt-1">
            <p className="text-base font-black font-mono text-foreground">
              {hasPriceOnRequest ? (
                <span className="text-muted-foreground text-xs font-semibold font-sans">
                  Price on Request
                </span>
              ) : (
                formatCurrency(listing.wholesale_price)
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {shortTimeAgo(listing.listed_at)}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}
