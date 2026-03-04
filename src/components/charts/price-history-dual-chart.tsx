"use client"

import { useState, useMemo } from "react"
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { formatCurrency } from "@/lib/utils/currency"

export interface DualDataPoint {
  date: string
  label: string
  avg_asking: number | null
  floor: number | null
  listing_count?: number
}

type TimeRange = "7D" | "30D" | "90D" | "1Y" | "All"

const RANGE_DAYS: Record<TimeRange, number> = {
  "7D": 7,
  "30D": 30,
  "90D": 90,
  "1Y": 365,
  "All": Infinity,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg border p-3 text-sm shadow-xl"
      style={{ background: "var(--ow-bg-elevated)", borderColor: "var(--ow-border-light)" }}
    >
      <p className="text-xs mb-2" style={{ color: "var(--ow-text-dim)" }}>{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any, i: number) => {
        if (p.dataKey === "listing_count") {
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded" style={{ background: "rgba(32,129,226,0.5)" }} />
              <span className="text-xs" style={{ color: "var(--ow-text-muted)" }}>Listed:</span>
              <span className="font-bold font-mono text-white">{p.value}</span>
            </div>
          )
        }
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-xs" style={{ color: "var(--ow-text-muted)" }}>{p.name}:</span>
            <span className="font-bold font-mono text-white">{formatCurrency(p.value)}</span>
          </div>
        )
      })}
    </div>
  )
}

interface PriceHistoryDualChartProps {
  data: DualDataPoint[]
  height?: number
  showVolume?: boolean
}

export function PriceHistoryDualChart({
  data,
  height = 280,
  showVolume = false,
}: PriceHistoryDualChartProps) {
  const defaultRange: TimeRange = data.length > 30 ? "90D" : "All"
  const [range, setRange] = useState<TimeRange>(defaultRange)

  const filtered = useMemo(() => {
    const days = RANGE_DAYS[range]
    if (!isFinite(days)) return data
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    return data.filter((d) => new Date(d.date) >= cutoff)
  }, [data, range])

  if (!data.length) {
    return (
      <div
        className="rounded-2xl border p-8 mb-8 text-center"
        style={{ background: "var(--ow-bg-card)", borderColor: "var(--ow-border)" }}
      >
        <p className="text-sm" style={{ color: "var(--ow-text-dim)" }}>
          Price history builds over time.{" "}
          <code className="text-xs" style={{ color: "#60a5fa" }}>
            node scripts/snapshot-prices.mjs
          </code>{" "}
          seeds today&apos;s data.
        </p>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl border overflow-hidden mb-8"
      style={{ background: "var(--ow-bg-card)", borderColor: "var(--ow-border)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <p className="text-sm font-bold text-white">Price History</p>
          <p className="text-xs flex items-center gap-2 mt-0.5">
            <span style={{ color: "#2081E2" }}>● Avg Asking</span>
            <span style={{ color: "#22c55e" }}>● Floor</span>
            {showVolume && (
              <span style={{ color: "rgba(32,129,226,0.55)" }}>▐ Volume</span>
            )}
          </p>
        </div>
        <div className="flex gap-1">
          {(["7D", "30D", "90D", "1Y", "All"] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className="px-2.5 py-1 rounded text-xs font-bold transition-all"
              style={
                range === r
                  ? { background: "#2081E2", color: "#fff" }
                  : { color: "var(--ow-text-dim)", background: "transparent" }
              }
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ paddingBottom: 8 }}>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart
            data={filtered}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="avgGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2081E2" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#2081E2" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="floorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--ow-border)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--ow-text-faint)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: "var(--ow-text-faint)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              width={44}
            />
            {showVolume && (
              <YAxis
                yAxisId="volume"
                orientation="right"
                tick={false}
                axisLine={false}
                tickLine={false}
                width={0}
              />
            )}
            <Tooltip content={<CustomTooltip />} />
            {/* Floor — rendered first (bottom layer) */}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="floor"
              name="Floor"
              stroke="#22c55e"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              fill="url(#floorGradient)"
              dot={false}
              activeDot={{ r: 3, fill: "#22c55e", strokeWidth: 0 }}
              connectNulls
              isAnimationActive={true}
            />
            {/* Avg Asking — on top */}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="avg_asking"
              name="Avg Asking"
              stroke="#2081E2"
              strokeWidth={2}
              fill="url(#avgGradient)"
              dot={false}
              activeDot={{ r: 4, fill: "#2081E2", strokeWidth: 0 }}
              connectNulls
              isAnimationActive={true}
            />
            {showVolume && (
              <Bar
                yAxisId="volume"
                dataKey="listing_count"
                name="Listed"
                fill="rgba(32,129,226,0.25)"
                barSize={4}
                isAnimationActive={true}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
