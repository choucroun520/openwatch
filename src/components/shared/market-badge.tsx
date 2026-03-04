"use client"

import { formatCurrency } from "@/lib/utils/currency"
import type { MarketStats } from "@/lib/types"

interface MarketBadgeProps {
  askingPrice: number
  marketStats: MarketStats
}

export function MarketBadge({ askingPrice, marketStats }: MarketBadgeProps) {
  if (!marketStats || marketStats.avg <= 0 || askingPrice <= 0) return null

  const pctDiff = ((askingPrice - marketStats.avg) / marketStats.avg) * 100
  const absDiff = Math.abs(pctDiff)

  let badge: { label: string; bg: string; color: string; border: string } | null = null

  if (pctDiff > 5) {
    badge = {
      label: `${absDiff.toFixed(0)}% above market`,
      bg: "rgba(239,68,68,0.1)",
      color: "#ef4444",
      border: "rgba(239,68,68,0.3)",
    }
  } else if (pctDiff < -5) {
    badge = {
      label: `${absDiff.toFixed(0)}% below market`,
      bg: "rgba(34,197,94,0.1)",
      color: "#22c55e",
      border: "rgba(34,197,94,0.3)",
    }
  } else {
    badge = {
      label: "At market",
      bg: "rgba(148,163,184,0.1)",
      color: "var(--ow-text-muted)",
      border: "rgba(148,163,184,0.2)",
    }
  }

  return (
    <div className="space-y-0.5">
      <span
        className="inline-block text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
        style={{
          background: badge.bg,
          color: badge.color,
          border: `1px solid ${badge.border}`,
        }}
      >
        {badge.label}
      </span>
      <p className="text-[10px]" style={{ color: "var(--ow-text-dim)" }}>
        eBay: {formatCurrency(marketStats.avg)} avg &middot; {marketStats.sold_30d} sold/30d
      </p>
    </div>
  )
}
