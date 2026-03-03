import { cn } from "@/lib/utils"
import { timeAgo } from "@/lib/utils/dates"
import { formatCurrency } from "@/lib/utils/currency"

type EventType = "listing_created" | "listing_sold" | "price_changed" | "inquiry_sent" | string

interface ActivityRowProps {
  eventType: EventType
  brandName?: string | null
  modelName?: string | null
  referenceNumber?: string | null
  price?: string | null
  dealerName?: string | null
  createdAt: string
  compact?: boolean
}

const EVENT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  listing_created: { label: "Listed", color: "#60a5fa", bg: "rgba(37,99,235,0.12)" },
  listing_sold: { label: "Sold", color: "#4ade80", bg: "rgba(34,197,94,0.12)" },
  price_changed: { label: "Price Change", color: "#facc15", bg: "rgba(234,179,8,0.12)" },
  inquiry_sent: { label: "Inquiry", color: "#c084fc", bg: "rgba(139,92,246,0.12)" },
  listing_delisted: { label: "Delisted", color: "#f87171", bg: "rgba(239,68,68,0.12)" },
}

function getEventConfig(type: string) {
  return EVENT_CONFIG[type] ?? { label: type.replace(/_/g, " "), color: "#94a3b8", bg: "rgba(148,163,184,0.1)" }
}

export function ActivityRow({
  eventType,
  brandName,
  modelName,
  referenceNumber,
  price,
  dealerName,
  createdAt,
  compact = false,
}: ActivityRowProps) {
  const cfg = getEventConfig(eventType)

  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b last:border-0 hover:bg-bg-elevated transition-colors",
        compact ? "py-2 px-3" : "py-3 px-4"
      )}
      style={{ borderColor: "#1c1c2a" }}
    >
      {/* Event badge */}
      <span
        className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap"
        style={{ color: cfg.color, background: cfg.bg }}
      >
        {cfg.label}
      </span>

      {/* Watch info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {brandName ?? "Unknown Brand"}{modelName ? ` ${modelName}` : ""}
        </p>
        {referenceNumber && (
          <p className="text-xs text-muted-foreground truncate">{referenceNumber}</p>
        )}
      </div>

      {/* Price */}
      {price && parseFloat(price) > 0 && (
        <span className="text-sm font-bold font-mono text-foreground shrink-0">
          {formatCurrency(price)}
        </span>
      )}

      {/* Dealer */}
      {dealerName && !compact && (
        <span className="text-xs text-muted-foreground shrink-0 hidden lg:block max-w-[120px] truncate">
          {dealerName}
        </span>
      )}

      {/* Time */}
      <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
        {timeAgo(createdAt)}
      </span>
    </div>
  )
}
