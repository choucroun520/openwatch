"use client"

import { useState, useCallback } from "react"
import { Plus, Package, Eye, TrendingUp, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils/currency"
import InventoryTable from "./inventory-table"
import AddWatchDialog from "./add-watch-dialog"
import type { Listing, Brand, Model } from "@/lib/types"
import { parseISO } from "date-fns"

interface InventoryClientProps {
  initialListings: (Listing & { brand: Brand; model: Model })[]
  brands: Brand[]
  userId: string
}

function computeAvgDaysListed(
  listings: (Listing & { brand: Brand; model: Model })[]
): number {
  const active = listings.filter((l) => l.status === "active")
  if (active.length === 0) return 0
  const now = Date.now()
  const total = active.reduce((sum, l) => {
    const listed = parseISO(l.listed_at).getTime()
    return sum + Math.floor((now - listed) / 86_400_000)
  }, 0)
  return Math.round(total / active.length)
}

export default function InventoryClient({
  initialListings,
  brands,
  userId,
}: InventoryClientProps) {
  const [listings, setListings] = useState(initialListings)
  const [showAddDialog, setShowAddDialog] = useState(false)

  const active = listings.filter((l) => l.status === "active").length
  const sold = listings.filter((l) => l.status === "sold").length
  const totalViews = listings.reduce((sum, l) => sum + l.views, 0)
  const avgDays = computeAvgDaysListed(listings)

  const totalWholesaleValue = listings
    .filter((l) => l.status === "active")
    .reduce((sum, l) => sum + parseFloat(l.wholesale_price), 0)

  const onRefresh = useCallback(async () => {
    try {
      const res = await fetch("/api/inventory")
      if (!res.ok) return
      const { data } = await res.json()
      if (data) setListings(data)
    } catch {
      // silent
    }
  }, [])

  const statsCards = [
    {
      label: "Active Listings",
      value: active.toString(),
      icon: Package,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Sold",
      value: sold.toString(),
      icon: TrendingUp,
      color: "text-green-400",
      bg: "bg-green-500/10",
    },
    {
      label: "Total Views",
      value: totalViews.toLocaleString(),
      icon: Eye,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      label: "Avg Days Listed",
      value: avgDays === 0 ? "—" : `${avgDays}d`,
      icon: Clock,
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">My Inventory</h1>
          {active > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {active} active {active === 1 ? "listing" : "listings"} ·{" "}
              <span className="font-mono font-semibold text-foreground">
                {formatCurrency(totalWholesaleValue)}
              </span>{" "}
              wholesale value
            </p>
          )}
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:opacity-90 border-0 gap-2"
          size="sm"
        >
          <Plus size={15} />
          Add Watch
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsCards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className="bg-bg-card border border-border rounded-lg p-4 flex items-center gap-3"
            >
              <div
                className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}
              >
                <Icon size={16} className={card.color} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[var(--ow-text-faint)] uppercase tracking-wider leading-none mb-1">
                  {card.label}
                </p>
                <p className="text-lg font-bold font-mono text-foreground leading-none">
                  {card.value}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Table */}
      <InventoryTable listings={listings} onRefresh={onRefresh} />

      {/* Add Watch Dialog */}
      <AddWatchDialog
        brands={brands}
        userId={userId}
        onSuccess={onRefresh}
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
      />
    </div>
  )
}
