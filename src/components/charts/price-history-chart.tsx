"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { formatCurrency } from "@/lib/utils/currency"

interface PriceDataPoint {
  date: string
  price: number
  label?: string
}

interface PriceHistoryChartProps {
  data: PriceDataPoint[]
  height?: number
  color?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg border p-3 text-sm shadow-xl"
      style={{ background: "#161622", borderColor: "#22222e" }}
    >
      <p className="text-muted-foreground text-xs mb-1">{label}</p>
      <p className="font-bold font-mono text-foreground">
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  )
}

export function PriceHistoryChart({ data, height = 200, color = "#2563eb" }: PriceHistoryChartProps) {
  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground rounded-lg border"
        style={{ height, background: "#111119", borderColor: "#1c1c2a" }}
      >
        No price history yet
      </div>
    )
  }

  const gradientId = `price-grad-${Math.random().toString(36).slice(2)}`

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1c1c2a" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "#475569", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#475569", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          width={48}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="price"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
