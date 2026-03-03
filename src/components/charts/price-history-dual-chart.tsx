"use client"

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { formatCurrency } from "@/lib/utils/currency"

interface DualDataPoint {
  date: string
  label: string
  avg_asking: number | null
  floor: number | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg border p-3 text-sm shadow-xl"
      style={{ background: "#161622", borderColor: "#22222e" }}
    >
      <p className="text-xs mb-2" style={{ color: "#64748b" }}>{label}</p>
      {payload.map((p: { name: string; value: number; color: string }, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-xs" style={{ color: "#94a3b8" }}>{p.name}:</span>
          <span className="font-bold font-mono text-white">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

interface PriceHistoryDualChartProps {
  data: DualDataPoint[]
  height?: number
}

export function PriceHistoryDualChart({ data, height = 200 }: PriceHistoryDualChartProps) {
  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center text-sm rounded-lg border"
        style={{ height, background: "#111119", borderColor: "#1c1c2a", color: "#64748b" }}
      >
        No price history yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1c1c2a" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "#475569", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: "#475569", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          width={48}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "#94a3b8", paddingTop: 8 }}
        />
        <Line
          type="monotone"
          dataKey="avg_asking"
          name="Avg Asking"
          stroke="#2563eb"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#2563eb", strokeWidth: 0 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="floor"
          name="Floor"
          stroke="#22c55e"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
          activeDot={{ r: 3, fill: "#22c55e", strokeWidth: 0 }}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
