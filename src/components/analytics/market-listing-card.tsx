import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { formatCurrency } from "@/lib/utils/currency"
import { shortTimeAgo } from "@/lib/utils/dates"

export interface MarketDataRow {
  id: string
  ref_number: string
  brand: string | null
  model: string | null
  price: string
  condition: string | null
  has_box: boolean | null
  has_papers: boolean | null
  source: string
  source_id?: string | null
  dealer_name: string | null
  dealer_country?: string | null
  listing_url: string | null
  listed_at?: string | null
  scraped_at: string
  sold_at?: string | null
  image_url?: string | null
}

interface MarketListingCardProps {
  listing: MarketDataRow
  showDealer?: boolean
  showSource?: boolean
  showRef?: boolean
}

// Source badge config
const SOURCE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  chrono24: { bg: "rgba(32,129,226,0.15)", color: "#2081E2", label: "C24" },
  ebay: { bg: "rgba(234,179,8,0.15)", color: "#eab308", label: "eBay" },
  watchbox: { bg: "rgba(34,197,94,0.15)", color: "#22c55e", label: "WatchBox" },
  chrono24_dealer: { bg: "rgba(32,129,226,0.15)", color: "#2081E2", label: "C24" },
}

function getSourceStyle(source: string) {
  const key = source.toLowerCase().replace(/[^a-z0-9]/g, "")
  return SOURCE_STYLES[key] ?? SOURCE_STYLES[source] ?? {
    bg: "rgba(100,116,139,0.15)",
    color: "#94a3b8",
    label: source.slice(0, 4).toUpperCase(),
  }
}

// Generate dealer slug from name for linking
export function dealerNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function ConditionBadge({ condition }: { condition: string | null }) {
  if (!condition) return null
  const color =
    condition === "unworn" ? "#22c55e"
    : condition === "excellent" ? "#60a5fa"
    : condition === "very_good" ? "#94a3b8"
    : condition === "good" ? "#fbbf24"
    : "#64748b"
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize"
      style={{ background: `${color}18`, color }}
    >
      {condition.replace("_", " ")}
    </span>
  )
}

export function MarketListingCard({
  listing,
  showDealer = true,
  showSource = true,
  showRef = false,
}: MarketListingCardProps) {
  const sourceSty = getSourceStyle(listing.source)
  const price = parseFloat(listing.price)
  const timeLabel = listing.listed_at
    ? shortTimeAgo(listing.listed_at)
    : shortTimeAgo(listing.scraped_at)
  const dealerSlug = listing.dealer_name ? dealerNameToSlug(listing.dealer_name) : null

  return (
    <div
      className="rounded-xl border flex flex-col overflow-hidden transition-all duration-150 hover:-translate-y-0.5"
      style={{
        background: "#111119",
        borderColor: "#1c1c2a",
        boxShadow: "0 1px 3px rgba(0,0,0,.3)",
      }}
    >
      {/* Image area */}
      <div
        className="relative w-full aspect-square flex items-center justify-center"
        style={{ background: "#ffffff10" }}
      >
        {listing.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.image_url}
            alt={listing.ref_number}
            className="w-full h-full object-contain p-2"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 opacity-30">
            <span className="text-3xl font-black font-mono text-white">{listing.ref_number?.slice(0, 6)}</span>
            {listing.brand && (
              <span className="text-[10px] font-semibold text-white uppercase tracking-wider">{listing.brand}</span>
            )}
          </div>
        )}

        {/* Source badge top-right */}
        {showSource && (
          <span
            className="absolute top-2 right-2 text-[10px] font-black px-1.5 py-0.5 rounded"
            style={{ background: sourceSty.bg, color: sourceSty.color }}
          >
            {sourceSty.label}
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        {showRef && (
          <p className="text-[11px] font-bold font-mono text-white truncate">{listing.ref_number}</p>
        )}
        {listing.brand && !showRef && (
          <p className="text-[10px] font-semibold uppercase tracking-wide truncate" style={{ color: "#60a5fa" }}>
            {listing.brand}
          </p>
        )}
        {listing.model && (
          <p className="text-[11px] font-semibold text-white truncate">{listing.model}</p>
        )}

        {/* Price */}
        <p className="text-base font-black font-mono text-white mt-0.5">
          {formatCurrency(price)}
        </p>

        {/* Condition + box/papers */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <ConditionBadge condition={listing.condition} />
          {listing.has_box && listing.has_papers && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>
              Full Set
            </span>
          )}
          {listing.has_box && !listing.has_papers && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(100,116,139,0.12)", color: "#94a3b8" }}>
              Box
            </span>
          )}
          {!listing.has_box && listing.has_papers && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(100,116,139,0.12)", color: "#94a3b8" }}>
              Papers
            </span>
          )}
        </div>

        {/* Dealer + time */}
        <div className="flex items-center justify-between mt-auto pt-1 gap-1">
          {showDealer && listing.dealer_name ? (
            dealerSlug ? (
              <Link
                href={`/dealers/${dealerSlug}`}
                className="text-[11px] font-medium truncate hover:underline transition-colors"
                style={{ color: "#8A939B" }}
                onClick={e => e.stopPropagation()}
              >
                {listing.dealer_name}
              </Link>
            ) : (
              <span className="text-[11px] font-medium truncate" style={{ color: "#8A939B" }}>
                {listing.dealer_name}
              </span>
            )
          ) : (
            <span className="text-[10px]" style={{ color: "#64748b" }}>{timeLabel}</span>
          )}

          {listing.listing_url ? (
            <a
              href={listing.listing_url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded transition-opacity hover:opacity-80"
              style={{ background: "rgba(32,129,226,0.12)", color: "#2081E2" }}
              onClick={e => e.stopPropagation()}
            >
              View <ExternalLink size={10} />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}
