"use client"

import { ExternalLink } from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts"
import { formatCurrency } from "@/lib/utils/currency"
import { MarketBadge } from "@/components/shared/market-badge"
import type { MarketComp, MarketStats } from "@/lib/types"

interface MarketCompsSectionProps {
  comps: MarketComp[]
  askingPrice: number
  referenceNumber: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg border p-3 text-sm shadow-xl"
      style={{ background: "var(--ow-bg-elevated)", borderColor: "var(--ow-border-light)" }}
    >
      <p className="text-muted-foreground text-xs mb-1">{label}</p>
      <p className="font-bold font-mono text-foreground">
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  )
}

export default function MarketCompsSection({
  comps,
  askingPrice,
  referenceNumber,
}: MarketCompsSectionProps) {
  if (comps.length === 0) {
    return (
      <div
        className="rounded-2xl border p-5"
        style={{ background: "var(--ow-bg-card)", borderColor: "var(--ow-border)" }}
      >
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">
          eBay Recent Sales
        </p>
        <p className="text-sm text-muted-foreground">
          No market data yet for {referenceNumber}.{" "}
          <span className="text-blue-400">Run the scraper to populate.</span>
        </p>
      </div>
    )
  }

  // Compute stats
  const prices = comps.map((c) => parseFloat(String(c.price)))
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const sold30d = comps.filter(
    (c) => c.sale_date && new Date(c.sale_date) >= thirtyDaysAgo
  ).length

  const stats: MarketStats = {
    floor: Math.min(...prices),
    avg: prices.reduce((a, b) => a + b, 0) / prices.length,
    ceiling: Math.max(...prices),
    sold_30d: sold30d,
    total: comps.length,
  }

  // Build chart data from comps with sale_date, sorted oldest→newest
  const chartData = [...comps]
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

  // Recent 10 comps for table
  const tableComps = comps.slice(0, 10)

  return (
    <div
      className="rounded-2xl border p-5 space-y-4"
      style={{ background: "var(--ow-bg-card)", borderColor: "var(--ow-border)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
            eBay Recent Sales
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {sold30d > 0 ? `${sold30d} sold in last 30 days` : `${comps.length} total comps`}
          </p>
        </div>
        <a
          href={`/ref/${encodeURIComponent(referenceNumber)}`}
          className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
        >
          Deep dive →
        </a>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Floor", value: formatCurrency(stats.floor) },
          { label: "Avg", value: formatCurrency(stats.avg) },
          { label: "Ceiling", value: formatCurrency(stats.ceiling) },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl p-3 text-center border"
            style={{ background: "var(--ow-bg-elevated)", borderColor: "var(--ow-border-light)" }}
          >
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              {s.label}
            </p>
            <p className="text-sm font-black font-mono text-foreground mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Market badge vs asking price */}
      {askingPrice > 0 && (
        <MarketBadge askingPrice={askingPrice} marketStats={stats} />
      )}

      {/* Price history chart */}
      {chartData.length > 1 && (
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-2">
            Price History
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="comp-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--ow-border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--ow-text-faint)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "var(--ow-text-faint)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                width={44}
              />
              <Tooltip content={<ChartTooltip />} />
              {askingPrice > 0 && (
                <ReferenceLine
                  y={askingPrice}
                  stroke="var(--ow-text-muted)"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: "Ask",
                    fill: "var(--ow-text-muted)",
                    fontSize: 10,
                    position: "insideTopRight",
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey="price"
                stroke="#2563eb"
                strokeWidth={2}
                fill="url(#comp-grad)"
                dot={false}
                activeDot={{ r: 4, fill: "#2563eb", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent comps table */}
      <div>
        <p className="text-xs text-muted-foreground font-medium mb-2">Recent Sales</p>
        <div className="space-y-0 rounded-xl overflow-hidden border" style={{ borderColor: "var(--ow-border-light)" }}>
          {tableComps.map((comp) => (
            <div
              key={comp.id}
              className="flex items-center justify-between px-3 py-2 border-b last:border-b-0 hover:bg-bg-elevated transition-colors"
              style={{ borderColor: "var(--ow-border-light)" }}
            >
              <div className="flex-1 min-w-0 mr-3">
                <p className="text-xs text-foreground truncate">
                  {comp.title ? comp.title.substring(0, 50) : comp.reference_number}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {comp.sale_date
                    ? new Date(comp.sale_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Date unknown"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-black font-mono text-foreground">
                  {formatCurrency(comp.price)}
                </span>
                {comp.listing_url && (
                  <a
                    href={comp.listing_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted-foreground hover:text-blue-400 transition-colors"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
