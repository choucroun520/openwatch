"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatCompact } from "@/lib/utils/currency"
import { shortTimeAgo } from "@/lib/utils/dates"

interface MarketDataSummary {
  totalComps: number
  refsCovered: number
  avgCompsPerRef: number
  lastScraped: string | null
}

interface AnalyticsClientProps {
  listings: any[]
  brands: any[]
  events: any[]
  marketData: MarketDataSummary
}

function EventBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; className: string }> = {
    listing_created: {
      label: "Listed",
      className: "bg-green-500/15 text-green-400 border-green-500/30",
    },
    listing_sold: {
      label: "Sold",
      className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    },
    listing_delisted: {
      label: "Delisted",
      className: "bg-gray-500/15 text-gray-400 border-gray-500/30",
    },
    price_changed: {
      label: "Price",
      className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    },
    inquiry_sent: {
      label: "Inquiry",
      className: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    },
  }
  const c = config[type] || {
    label: type,
    className: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  }
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${c.className}`}
    >
      {c.label}
    </span>
  )
}

function formatEventType(type: string): string {
  const map: Record<string, string> = {
    listing_created: "New listing added",
    listing_sold: "Watch sold",
    listing_delisted: "Listing removed",
    price_changed: "Price updated",
    inquiry_sent: "Inquiry sent",
    inquiry_responded: "Inquiry responded",
    listing_updated: "Listing updated",
  }
  return map[type] || type.replace(/_/g, " ")
}

export default function AnalyticsClient({
  listings,
  brands,
  events,
  marketData,
}: AnalyticsClientProps) {
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null)

  async function handleRefresh() {
    setRefreshing(true)
    setRefreshMsg(null)
    try {
      const res = await fetch("/api/market/refresh", { method: "POST" })
      const data = await res.json()
      setRefreshMsg(data.message ?? "Done")
    } catch {
      setRefreshMsg("Error — check console")
    } finally {
      setRefreshing(false)
    }
  }
  // --- KPI Computation ---
  const activeListings = listings.filter((l) => l.status === "active")
  const soldListings = listings.filter((l) => l.status === "sold")
  const uniqueDealers = new Set(listings.map((l) => l.dealer_id)).size
  const totalVolume = soldListings.reduce(
    (sum, l) => sum + parseFloat(l.wholesale_price || "0"),
    0
  )
  const soldWithDates = soldListings.filter((l) => l.sold_at && l.listed_at)
  const avgDaysToSell =
    soldWithDates.length > 0
      ? soldWithDates.reduce((sum, l) => {
          const days =
            (new Date(l.sold_at).getTime() - new Date(l.listed_at).getTime()) /
            (1000 * 60 * 60 * 24)
          return sum + days
        }, 0) / soldWithDates.length
      : 0

  const kpis = [
    { label: "Network Listings", value: activeListings.length.toString() },
    { label: "Active Dealers", value: uniqueDealers.toString() },
    {
      label: "Brands Tracked",
      value: new Set(listings.map((l) => l.brand_id)).size.toString(),
    },
    { label: "Total Volume", value: formatCompact(totalVolume) },
    { label: "Avg Days to Sell", value: `${Math.round(avgDaysToSell)}d` },
  ]

  // --- Brand Rankings ---
  const brandStats = brands
    .map((brand) => {
      const bListings = activeListings.filter((l) => l.brand_id === brand.id)
      const prices = bListings
        .map((l) => parseFloat(l.wholesale_price || "0"))
        .filter(Boolean)
      return {
        brand,
        floor: prices.length ? Math.min(...prices) : 0,
        avg: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
        ceiling: prices.length ? Math.max(...prices) : 0,
        listed: bListings.length,
      }
    })
    .filter((b) => b.listed > 0)
    .sort((a, b) => b.listed - a.listed)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-foreground">Market Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Real-time intelligence across the dealer network.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-bg-card border border-border rounded-xl p-5"
          >
            <p className="text-xs text-[#475569] uppercase tracking-wider">
              {kpi.label}
            </p>
            <p className="text-2xl font-black font-mono text-foreground mt-1">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Brand Rankings Table */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Brand Rankings</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            By active inventory
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              {["#", "Brand", "Floor", "Avg Price", "Ceiling", "Listed"].map(
                (h) => (
                  <TableHead
                    key={h}
                    className="text-xs text-[#475569] uppercase tracking-wider"
                  >
                    {h}
                  </TableHead>
                )
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {brandStats.map((stat, idx) => (
              <TableRow
                key={stat.brand.id}
                className="hover:bg-bg-elevated border-b border-border cursor-pointer"
                onClick={() =>
                  (window.location.href = `/network?brand=${stat.brand.slug}`)
                }
              >
                <TableCell className="text-muted-foreground font-mono text-sm">
                  {idx + 1}
                </TableCell>
                <TableCell className="font-semibold text-foreground">
                  {stat.brand.name}
                </TableCell>
                <TableCell className="font-mono font-bold text-foreground">
                  {stat.floor > 0 ? formatCurrency(stat.floor) : "—"}
                </TableCell>
                <TableCell className="font-mono text-muted-foreground">
                  {stat.avg > 0 ? formatCurrency(stat.avg) : "—"}
                </TableCell>
                <TableCell className="font-mono text-muted-foreground">
                  {stat.ceiling > 0 ? formatCurrency(stat.ceiling) : "—"}
                </TableCell>
                <TableCell className="text-foreground">{stat.listed}</TableCell>
              </TableRow>
            ))}
            {brandStats.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  No data yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Recent Activity */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Recent Activity</h2>
        </div>
        <div className="divide-y divide-border">
          {events.map((event) => (
            <div
              key={event.id}
              className="p-4 flex items-center justify-between hover:bg-bg-elevated"
            >
              <div className="flex items-center gap-3">
                <EventBadge type={event.event_type} />
                <div>
                  <p className="text-sm text-foreground">
                    {formatEventType(event.event_type)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {event.listing_id
                      ? `Listing ${event.listing_id.slice(0, 8)}...`
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {event.price && (
                  <p className="text-sm font-mono font-bold text-foreground">
                    {formatCurrency(event.price)}
                  </p>
                )}
                <p className="text-xs text-[#475569]">
                  {shortTimeAgo(event.created_at)}
                </p>
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <p className="p-8 text-center text-muted-foreground text-sm">
              No activity yet
            </p>
          )}
        </div>
      </div>

      {/* Market Data */}
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-foreground">Market Data</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {marketData.lastScraped
                ? `Last updated ${shortTimeAgo(marketData.lastScraped)}`
                : "Not scraped yet"}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: "#2081E2" }}
          >
            {refreshing ? "Checking..." : "Refresh Market Data"}
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Comps", value: marketData.totalComps.toLocaleString() },
              { label: "Refs Covered", value: marketData.refsCovered.toString() },
              { label: "Avg / Ref", value: marketData.avgCompsPerRef.toString() },
            ].map((s) => (
              <div key={s.label} className="bg-bg-elevated rounded-xl p-4 border border-border">
                <p className="text-xs text-[#475569] uppercase tracking-wider">{s.label}</p>
                <p className="text-2xl font-black font-mono text-foreground mt-1">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Refresh message */}
          {refreshMsg && (
            <div
              className="rounded-lg p-3 text-xs text-muted-foreground border"
              style={{ background: "#161622", borderColor: "#22222e" }}
            >
              <code>{refreshMsg}</code>
            </div>
          )}

          {/* Instructions */}
          {marketData.totalComps === 0 && (
            <div
              className="rounded-lg p-4 text-sm border"
              style={{ background: "rgba(32,129,226,0.05)", borderColor: "rgba(32,129,226,0.2)" }}
            >
              <p className="text-blue-400 font-semibold mb-1">No market data yet</p>
              <p className="text-muted-foreground text-xs">
                Run the scraper to populate eBay sold comps for all refs:
              </p>
              <code
                className="block mt-2 px-3 py-2 rounded text-xs text-blue-300"
                style={{ background: "#161622" }}
              >
                node scripts/scrape-ebay.mjs
              </code>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
