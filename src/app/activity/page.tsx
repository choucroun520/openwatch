import { createClient } from "@/lib/supabase/server"
import AppLayout from "@/components/layout/app-layout"
import { timeAgo } from "@/lib/utils/dates"
import { formatCurrency } from "@/lib/utils/currency"
import { Activity } from "lucide-react"

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
  return EVENT_CONFIG[type] ?? { label: type.replace(/_/g, " "), color: "var(--ow-text-muted)", bg: "rgba(148,163,184,0.1)" }
}

interface SynthEvent {
  id: string
  event_type: string
  price: string | null
  created_at: string
  brand_name: string | null
  ref_number: string | null
  dealer_name: string | null
  listing_id: string | null
}

export default async function ActivityPage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Try real market_events first
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

  const hasRealEvents = (events ?? []).length > 0
  let isFallback = false
  let synthEvents: SynthEvent[] = []

  if (!hasRealEvents) {
    isFallback = true

    // Synthesize events from listings table
    const { data: listings } = await db
      .from("listings")
      .select(`
        id, reference_number, wholesale_price, status, listed_at, sold_at,
        brand:brands(name),
        model:models(name),
        dealer:profiles!dealer_id(company_name, full_name)
      `)
      .in("status", ["active", "sold"])
      .order("listed_at", { ascending: false })
      .limit(50)

    for (const listing of (listings ?? [])) {
      if (listing.status === "sold" && listing.sold_at) {
        synthEvents.push({
          id: `sold-${listing.id}`,
          event_type: "listing_sold",
          price: listing.wholesale_price,
          created_at: listing.sold_at,
          brand_name: listing.brand?.name ?? null,
          ref_number: listing.reference_number ?? null,
          dealer_name: listing.dealer?.company_name ?? listing.dealer?.full_name ?? null,
          listing_id: listing.id,
        })
      }
      synthEvents.push({
        id: `listed-${listing.id}`,
        event_type: "listing_created",
        price: listing.wholesale_price,
        created_at: listing.listed_at ?? listing.sold_at ?? new Date().toISOString(),
        brand_name: listing.brand?.name ?? null,
        ref_number: listing.reference_number ?? null,
        dealer_name: listing.dealer?.company_name ?? listing.dealer?.full_name ?? null,
        listing_id: listing.id,
      })
    }

    // Sort by created_at desc
    synthEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    synthEvents = synthEvents.slice(0, 50)
  }

  const eventTypes = [
    "all",
    "listing_created",
    "listing_sold",
    "price_changed",
    "inquiry_sent",
    "listing_delisted",
  ]

  return (
    <AppLayout>
      <div className="max-w-[1400px] mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black text-foreground flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
              Activity Feed
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isFallback
                ? "Recent listing activity across the OpenWatch dealer network"
                : "Live deal activity across the OpenWatch dealer network"}
            </p>
          </div>
        </div>

        {/* Fallback banner */}
        {isFallback && (
          <div
            className="mb-6 rounded-xl border px-4 py-3 text-sm flex items-center gap-2"
            style={{ background: "rgba(32,129,226,0.08)", borderColor: "rgba(32,129,226,0.2)", color: "#60a5fa" }}
          >
            <Activity size={14} />
            Live market events coming soon — showing recent listing activity
          </div>
        )}

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          {eventTypes.map((type) => {
            const cfg = type === "all"
              ? { label: "All Events", color: "var(--ow-text)", bg: "rgba(255,255,255,0.06)" }
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
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--ow-border)" }}>
          {/* Table header */}
          <div
            className="grid gap-4 px-5 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground"
            style={{
              background: "var(--ow-bg)",
              gridTemplateColumns: "100px 1fr 140px 140px 100px",
            }}
          >
            <div>Event</div>
            <div>Item</div>
            <div className="text-right">Price</div>
            <div>Dealer</div>
            <div className="text-right">Time</div>
          </div>

          {!hasRealEvents && synthEvents.length === 0 && (
            <div
              style={{ border: "1px dashed var(--ow-border)", borderRadius: 12, padding: "48px 24px", textAlign: "center", margin: 16 }}
            >
              <Activity size={32} style={{ color: "var(--ow-text-dim)", margin: "0 auto 12px" }} />
              <p style={{ color: "var(--ow-text-muted)", fontWeight: 600, marginBottom: 4 }}>No activity yet</p>
              <p style={{ color: "var(--ow-text-dim)", fontSize: 13 }}>Listings, inquiries, and price changes will appear here.</p>
            </div>
          )}

          {/* Real market_events */}
          {hasRealEvents && (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((events ?? []) as any[]).map((event: any) => {
              const listing = event.listing
              const brand = event.brand
              const cfg = getEventConfig(event.event_type as EventType)

              return (
                <div
                  key={event.id}
                  className="grid gap-4 px-5 py-4 border-t hover:bg-bg-elevated transition-colors items-center"
                  style={{
                    borderColor: "var(--ow-border)",
                    gridTemplateColumns: "100px 1fr 140px 140px 100px",
                  }}
                >
                  <div>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap"
                      style={{ color: cfg.color, background: cfg.bg }}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="min-w-0">
                    {listing ? (
                      <div>
                        <p className="text-sm font-semibold text-foreground truncate">
                          {brand?.name ?? "Unknown Brand"}{listing.model?.name ? ` ${listing.model.name}` : ""}
                        </p>
                        {listing.reference_number && (
                          <p className="text-xs text-muted-foreground font-mono truncate">{listing.reference_number}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{brand?.name ?? "—"}</p>
                    )}
                  </div>
                  <div className="text-right">
                    {event.price && parseFloat(String(event.price)) > 0 ? (
                      <span className="text-sm font-bold font-mono text-foreground">{formatCurrency(String(event.price))}</span>
                    ) : listing?.wholesale_price && parseFloat(listing.wholesale_price) > 0 ? (
                      <span className="text-sm font-bold font-mono text-foreground">{formatCurrency(listing.wholesale_price)}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    {listing?.dealer ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0"
                          style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}>
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
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(event.created_at)}</span>
                  </div>
                </div>
              )
            })
          )}

          {/* Synthesized events from listings */}
          {isFallback && synthEvents.map((ev) => {
            const cfg = getEventConfig(ev.event_type)
            return (
              <div
                key={ev.id}
                className="grid gap-4 px-5 py-4 border-t hover:bg-bg-elevated transition-colors items-center"
                style={{
                  borderColor: "var(--ow-border)",
                  gridTemplateColumns: "100px 1fr 140px 140px 100px",
                }}
              >
                <div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap"
                    style={{ color: cfg.color, background: cfg.bg }}>
                    {cfg.label}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {ev.brand_name ?? "Unknown Brand"}
                  </p>
                  {ev.ref_number && (
                    <p className="text-xs text-muted-foreground font-mono truncate">{ev.ref_number}</p>
                  )}
                </div>
                <div className="text-right">
                  {ev.price && parseFloat(String(ev.price)) > 0 ? (
                    <span className="text-sm font-bold font-mono text-foreground">{formatCurrency(String(ev.price))}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
                <div className="min-w-0">
                  {ev.dealer_name ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0"
                        style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}>
                        {ev.dealer_name[0].toUpperCase()}
                      </div>
                      <span className="text-xs text-muted-foreground truncate">{ev.dealer_name}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(ev.created_at)}</span>
                </div>
              </div>
            )
          })}
        </div>

        {(hasRealEvents ? (events ?? []) : synthEvents).length >= 50 && (
          <p className="text-center text-sm text-muted-foreground mt-6">
            Showing last 50 events.
          </p>
        )}
      </div>
    </AppLayout>
  )
}
