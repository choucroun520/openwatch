"use client";

import Link from "next/link";
import { Watch } from "lucide-react";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { ConditionBadge } from "@/components/shared/condition-badge";
import { formatCurrency } from "@/lib/utils/currency";
import { shortTimeAgo } from "@/lib/utils/dates";
import type { ListingWithRelations } from "@/lib/types";

interface ListingCardProps {
  listing: ListingWithRelations;
}

export default function ListingCard({ listing }: ListingCardProps) {
  return (
    <Link href={`/listing/${listing.id}`}>
      <div className="bg-bg-card border border-border rounded-lg overflow-hidden card-hover cursor-pointer">
        {/* Image area */}
        <div
          className="relative h-48 flex items-center justify-center"
          style={{
            background:
              listing.brand.banner_gradient ||
              "linear-gradient(135deg, #1e3a5f 0%, #111119 100%)",
          }}
        >
          <Watch className="w-16 h-16 text-white/20" />
          {listing.has_box && listing.has_papers && (
            <div className="absolute top-2 right-2 bg-green-500/20 text-green-400 border border-green-500/30 text-xs px-2 py-0.5 rounded-full font-medium">
              Full Set
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="p-3 space-y-1.5">
          {/* Dealer row */}
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">
              {(
                listing.dealer.company_name ||
                listing.dealer.full_name ||
                "?"
              )[0].toUpperCase()}
            </div>
            <span className="text-xs text-muted-foreground truncate">
              {listing.dealer.company_name || listing.dealer.full_name}
            </span>
            {listing.dealer.verified && <VerifiedBadge size="sm" />}
          </div>

          {/* Model name */}
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">
              {listing.brand.name} {listing.model.name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {listing.reference_number} · {listing.year} · {listing.material}
            </p>
          </div>

          {/* Condition + price row */}
          <div className="flex items-center justify-between pt-1">
            <ConditionBadge condition={listing.condition} />
            <div className="text-right">
              <p className="text-sm font-bold font-mono text-foreground">
                {formatCurrency(listing.wholesale_price)}
              </p>
              <p className="text-xs text-[#475569]">
                {shortTimeAgo(listing.listed_at)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
