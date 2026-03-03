import { createClient } from "@/lib/supabase/server"
import AppLayout from "@/components/layout/app-layout"
import Link from "next/link"
import { ExternalLink } from "lucide-react"
import ListingCard from "@/components/network/listing-card"
import { PriceHistoryChart } from "@/components/charts/price-history-chart"
import { formatCurrency } from "@/lib/utils/currency"
import type { ListingWithRelations, MarketComp } from "@/lib/types"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ reference: string }>
}) {
  const { reference } = await params
  return { title: `${reference} — Market Data — OpenWatch` }
}

export default async function RefDeepDivePage({
  params,
}: {
  params: Promise<{ reference: string }>
}) {
  const { reference } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Fetch all active listings for this reference
  const { data: listings } = await db
    .from("listings")
    .select(
      `*, brand:brands(*), model:models(*), dealer:profiles!dealer_id(id, full_name, company_name, avatar_url, verified, seller_rating, total_sales)`
    )
    .eq("reference_number", reference)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("listed_at", { ascending: false })

  // Fetch all market comps for this reference
  const { data: comps } = await db
    .from("market_comps")
    .select("*")
    .eq("reference_number", reference)
    .gt("price", 5000)
    .order("sale_date", { ascending: false })

  const activeListings = (listings ?? []) as ListingWithRelations[]
  const marketComps = (comps ?? []) as MarketComp[]

  // Compute market stats
  const prices = marketComps.map((c) => parseFloat(String(c.price)))
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const sold30d = marketComps.filter(
    (c) => c.sale_date && new Date(c.sale_date) >= thirtyDaysAgo
  ).length
  const floor = prices.length ? Math.min(...prices) : 0
  const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0
  const ceiling = prices.length ? Math.max(...prices) : 0

  // Brand/model info from listings or comps
  const brandName =
    activeListings[0]?.brand?.name ?? marketComps[0]?.brand_name ?? null
  const modelName = activeListings[0]?.model?.name ?? null

  // Chart data — comps over time
  const chartData = [...marketComps]
    .filter((c) => c.sale_date)
    .sort((a, b) => new Date(a.sale_date!).getTime() - new Date(b.sale_date!).getTime())
    .map((c) => ({
      date: c.sale_date!,
      price: parseFloat(String(c.price)),
      label: new Date(c.sale_date!).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    }))

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-6 flex items-center gap-2 flex-wrap">
          <Link href="/network" className="hover:text-foreground transition-colors">
            Network
          </Link>
          <span>/</span>
          <span className="text-foreground font-mono">{reference}</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          {brandName && (
            <p className="text-sm text-blue-400 font-semibold mb-1">{brandName}</p>
          )}
          <h1 className="text-3xl font-black text-foreground">
            {modelName ? `${modelName} · ` : ""}
            <span className="font-mono">{reference}</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Market intelligence · eBay sold comps
          </p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "On Network", value: activeListings.length.toString() },
            { label: "eBay Floor", value: floor > 0 ? formatCurrency(floor) : "—" },
            { label: "eBay Avg", value: avg > 0 ? formatCurrency(avg) : "—" },
            { label: "Sold / 30d", value: sold30d.toString() },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border p-4"
              style={{ background: "#111119", borderColor: "#1c1c2a" }}
            >
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
                {s.label}
              </p>
              <p className="text-2xl font-black font-mono text-foreground mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Price history chart */}
        {chartData.length > 1 && (
          <div
            className="rounded-2xl border p-5 mb-8"
            style={{ background: "#111119", borderColor: "#1c1c2a" }}
          >
            <p className="text-sm font-semibold text-foreground mb-4">
              eBay Price History
            </p>
            <PriceHistoryChart data={chartData} height={220} />
          </div>
        )}

        {/* OpenWatch listings */}
        {activeListings.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-black text-foreground mb-4">
              On OpenWatch ({activeListings.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {activeListings.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          </section>
        )}

        {/* eBay comps table */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-foreground">
              eBay Sold Comps ({marketComps.length})
            </h2>
            {ceiling > 0 && (
              <p className="text-xs text-muted-foreground">
                Ceiling: <span className="font-mono font-bold text-foreground">{formatCurrency(ceiling)}</span>
              </p>
            )}
          </div>

          {marketComps.length === 0 ? (
            <div
              className="rounded-xl border p-8 text-center"
              style={{ background: "#111119", borderColor: "#1c1c2a" }}
            >
              <p className="text-muted-foreground text-sm">
                No eBay comps yet for <span className="font-mono">{reference}</span>.
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                Run <code className="bg-bg-elevated px-1 rounded text-blue-400">node scripts/scrape-ebay.mjs</code> to populate.
              </p>
            </div>
          ) : (
            <div
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: "#1c1c2a" }}
            >
              {/* Table header */}
              <div
                className="grid grid-cols-12 gap-3 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground"
                style={{ background: "#0b0b14" }}
              >
                <div className="col-span-6">Title</div>
                <div className="col-span-2">Source</div>
                <div className="col-span-2">Date</div>
                <div className="col-span-2 text-right">Price</div>
              </div>

              {marketComps.map((comp) => (
                <div
                  key={comp.id}
                  className="grid grid-cols-12 gap-3 px-4 py-3 border-t items-center hover:bg-bg-elevated transition-colors"
                  style={{ borderColor: "#1c1c2a" }}
                >
                  {/* Title */}
                  <div className="col-span-6 min-w-0">
                    <p className="text-sm text-foreground truncate">
                      {comp.title ?? comp.reference_number}
                    </p>
                  </div>

                  {/* Source */}
                  <div className="col-span-2">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                      style={{
                        background: "rgba(32,129,226,0.1)",
                        color: "#2081E2",
                        border: "1px solid rgba(32,129,226,0.2)",
                      }}
                    >
                      {comp.source}
                    </span>
                  </div>

                  {/* Date */}
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">
                      {comp.sale_date
                        ? new Date(comp.sale_date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </p>
                  </div>

                  {/* Price + Link */}
                  <div className="col-span-2 text-right flex items-center justify-end gap-2">
                    <span className="text-sm font-black font-mono text-foreground">
                      {formatCurrency(comp.price)}
                    </span>
                    {comp.listing_url && (
                      <a
                        href={comp.listing_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-blue-400 transition-colors"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  )
}
