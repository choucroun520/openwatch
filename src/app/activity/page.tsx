import { createClient } from "@/lib/supabase/server"
import TopNav from "@/components/layout/top-nav"
import { timeAgo } from "@/lib/utils/dates"
import { formatCurrency } from "@/lib/utils/currency"

export const metadata = { title: "Activity — OpenWatch" }

export const dynamic = "force-dynamic"

type EventType = "listing_created" | "listing_sold" | "price_changed" | "inquiry_sent" | "listing_delisted" | string

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

export default async function ActivityPage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Fetch market events with listing + brand + model + dealer
  const { data: events } = await db
    .from("market_events")
    .select(`
      *,
      brand:brands(name, slug),
      listing:listings(
        id,
        reference_number,
        wholesale_price,
        model:models(name),
        dealer:profiles!dealer_id(company_name, full_name, verified)
      )
    `)
    .order("created_at", { ascending: false })
    .limit(50)

  const eventTypes = [
    "all",
    "listing_created",
    "listing_sold",
    "price_changed",
    "inquiry_sent",
    "listing_delisted",
  ]

  return (
    <div className="min-h-screen" style={{ background: "#0b0b14" }}>
      <TopNav />

      <div className="max-w-[1400px] mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black text-foreground flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
              Activity Feed
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Live deal activity across the OpenWatch dealer network
            </p>
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          {eventTypes.map((type) => {
            const cfg = type === "all"
              ? { label: "All Events", color: "#e2e8f0", bg: "rgba(255,255,255,0.06)" }
              : getEventConfig(type)
            return (
              <span
                key={type}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer hover:opacity-90 transition-opacity"
                style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30` }}
              >
                {type === "all" ? "All Events" : cfg.label}
              </span>
            )
          })}
        </div>

        {/* Activity table */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#1c1c2a" }}>
          {/* Table header */}
          <div
            className="grid gap-4 px-5 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground"
            style={{
              background: "#0b0b14",
              gridTemplateColumns: "100px 1fr 140px 140px 100px",
            }}
          >
            <div>Event</div>
            <div>Item</div>
            <div className="text-right">Price</div>
            <div>Dealer</div>
            <div className="text-right">Time</div>
          </div>

          {(events ?? []).length === 0 && (
            <div
              className="px-5 py-12 text-center text-sm text-muted-foreground border-t"
              style={{ borderColor: "#1c1c2a" }}
            >
              No activity yet. Listings, inquiries, and price changes will appear here.
            </div>
          )}

          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {((events ?? []) as any[]).map((event: any) => {
            const ev = event
            const listing = ev.listing
            const brand = ev.brand
            const cfg = getEventConfig(event.event_type as EventType)

            return (
              <div
                key={event.id}
                className="grid gap-4 px-5 py-4 border-t hover:bg-bg-elevated transition-colors items-center"
                style={{
                  borderColor: "#1c1c2a",
                  gridTemplateColumns: "100px 1fr 140px 140px 100px",
                }}
              >
                {/* Event badge */}
                <div>
                  <span
                    className="px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap"
                    style={{ color: cfg.color, background: cfg.bg }}
                  >
                    {cfg.label}
                  </span>
                </div>

                {/* Item */}
                <div className="min-w-0">
                  {listing ? (
                    <div>
                      <p className="text-sm font-semibold text-foreground truncate">
                        {brand?.name ?? "Unknown Brand"}{listing.model?.name ? ` ${listing.model.name}` : ""}
                      </p>
                      {listing.reference_number && (
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {listing.reference_number}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{brand?.name ?? "—"}</p>
                  )}
                </div>

                {/* Price */}
                <div className="text-right">
                  {event.price && parseFloat(String(event.price)) > 0 ? (
                    <span className="text-sm font-bold font-mono text-foreground">
                      {formatCurrency(String(event.price))}
                    </span>
                  ) : listing?.wholesale_price && parseFloat(listing.wholesale_price) > 0 ? (
                    <span className="text-sm font-bold font-mono text-foreground">
                      {formatCurrency(listing.wholesale_price)}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>

                {/* Dealer */}
                <div className="min-w-0">
                  {listing?.dealer ? (
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0"
                        style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}
                      >
                        {(listing.dealer.company_name ?? listing.dealer.full_name ?? "?")[0].toUpperCase()}
                      </div>
                      <span className="text-xs text-muted-foreground truncate">
                        {listing.dealer.company_name ?? listing.dealer.full_name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>

                {/* Time */}
                <div className="text-right">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {timeAgo(event.created_at)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Load more notice */}
        {(events ?? []).length >= 50 && (
          <p className="text-center text-sm text-muted-foreground mt-6">
            Showing last 50 events.
          </p>
        )}
      </div>
    </div>
  )
}
