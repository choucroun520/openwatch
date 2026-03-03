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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ConditionBadge } from "@/components/shared/condition-badge"
import { CurrencyInput } from "@/components/shared/currency-input"
import { formatCurrency } from "@/lib/utils/currency"
import { shortTimeAgo } from "@/lib/utils/dates"
import { cn } from "@/lib/utils"
import { Pencil, CheckCircle2, Trash2 } from "lucide-react"
import type { Listing, Brand, Model } from "@/lib/types"

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className:
      "bg-green-500/15 text-green-400 border border-green-500/30",
  },
  sold: {
    label: "Sold",
    className: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  },
  delisted: {
    label: "Delisted",
    className:
      "bg-gray-500/15 text-gray-400 border border-gray-500/30",
  },
  pending: {
    label: "Pending",
    className:
      "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  },
}

interface InventoryTableProps {
  listings: (Listing & { brand: Brand; model: Model })[]
  onRefresh: () => void
}

interface InventoryTableRowProps {
  listing: Listing & { brand: Brand; model: Model }
  onRefresh: () => void
}

function BrandIcon({ icon, name }: { icon: string | null; name: string }) {
  if (icon) {
    return (
      <span className="text-lg leading-none w-9 h-9 flex items-center justify-center">
        {icon}
      </span>
    )
  }
  return (
    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600/30 to-purple-600/30 border border-border flex items-center justify-center">
      <span className="text-xs font-bold text-muted-foreground">
        {name.slice(0, 2).toUpperCase()}
      </span>
    </div>
  )
}

function InventoryTableRow({ listing, onRefresh }: InventoryTableRowProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editPrice, setEditPrice] = useState(listing.wholesale_price)
  const [editLoading, setEditLoading] = useState(false)

  const status = statusConfig[listing.status] ?? statusConfig.pending

  async function handleStatusChange(newStatus: "sold" | "delisted") {
    setLoadingAction(newStatus)
    try {
      const res = await fetch(`/api/inventory/${listing.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) onRefresh()
    } finally {
      setLoadingAction(null)
    }
  }

  async function handleEditPrice() {
    if (!editPrice) return
    setEditLoading(true)
    try {
      const res = await fetch(`/api/inventory/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wholesale_price: editPrice }),
      })
      if (res.ok) {
        setEditOpen(false)
        onRefresh()
      }
    } finally {
      setEditLoading(false)
    }
  }

  const isActionable =
    listing.status === "active" || listing.status === "pending"

  return (
    <>
      <TableRow className="hover:bg-bg-elevated border-b border-border transition-colors">
        {/* Watch */}
        <TableCell className="py-3">
          <div className="flex items-center gap-3 min-w-0">
            <BrandIcon
              icon={listing.brand?.icon ?? null}
              name={listing.brand?.name ?? ""}
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight truncate max-w-[200px]">
                {listing.brand?.name} {listing.model?.name}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">
                {listing.reference_number} · {listing.year}
              </p>
            </div>
          </div>
        </TableCell>

        {/* Condition */}
        <TableCell className="py-3">
          <ConditionBadge condition={listing.condition} />
        </TableCell>

        {/* Price */}
        <TableCell className="py-3">
          <span className="font-mono font-bold text-sm text-foreground">
            {formatCurrency(listing.wholesale_price)}
          </span>
        </TableCell>

        {/* Status */}
        <TableCell className="py-3">
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
              status.className
            )}
          >
            {status.label}
          </span>
        </TableCell>

        {/* Views */}
        <TableCell className="py-3">
          <span className="text-sm text-muted-foreground">
            {listing.views.toLocaleString()}
          </span>
        </TableCell>

        {/* Listed */}
        <TableCell className="py-3">
          <span className="text-sm text-muted-foreground">
            {shortTimeAgo(listing.listed_at)}
          </span>
        </TableCell>

        {/* Actions */}
        <TableCell className="py-3">
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center gap-1">
              {/* Edit price */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      setEditPrice(listing.wholesale_price)
                      setEditOpen(true)
                    }}
                    disabled={!!loadingAction}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-bg-elevated transition-colors disabled:opacity-40"
                  >
                    <Pencil size={14} />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="bg-bg-elevated border-border text-foreground text-xs"
                >
                  Edit price
                </TooltipContent>
              </Tooltip>

              {/* Mark Sold */}
              {isActionable && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleStatusChange("sold")}
                      disabled={!!loadingAction}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-green-400 hover:bg-green-500/10 transition-colors disabled:opacity-40"
                    >
                      {loadingAction === "sold" ? (
                        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin block" />
                      ) : (
                        <CheckCircle2 size={14} />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="bg-bg-elevated border-border text-foreground text-xs"
                  >
                    Mark as sold
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Delist */}
              {isActionable && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleStatusChange("delisted")}
                      disabled={!!loadingAction}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                    >
                      {loadingAction === "delisted" ? (
                        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin block" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="bg-bg-elevated border-border text-foreground text-xs"
                  >
                    Delist
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </TooltipProvider>
        </TableCell>
      </TableRow>

      {/* Edit Price Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-sm bg-bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Update Price</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="space-y-1.5">
              <p className="text-sm text-muted-foreground">
                {listing.brand?.name} {listing.model?.name} ·{" "}
                {listing.reference_number}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-foreground">
                Wholesale Price
              </Label>
              <CurrencyInput
                value={editPrice}
                onChange={setEditPrice}
                placeholder="Enter new price"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(false)}
              className="border-border text-foreground hover:bg-bg-elevated"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleEditPrice}
              disabled={editLoading || !editPrice}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:opacity-90 border-0"
            >
              {editLoading ? "Saving…" : "Save Price"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function InventoryTable({
  listings,
  onRefresh,
}: InventoryTableProps) {
  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b border-border">
            {[
              "Watch",
              "Condition",
              "Price",
              "Status",
              "Views",
              "Listed",
              "Actions",
            ].map((h) => (
              <TableHead
                key={h}
                className="text-xs text-[#475569] uppercase tracking-wider"
              >
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {listings.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="h-32 text-center text-muted-foreground"
              >
                No listings yet. Add your first watch.
              </TableCell>
            </TableRow>
          ) : (
            listings.map((listing) => (
              <InventoryTableRow
                key={listing.id}
                listing={listing}
                onRefresh={onRefresh}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
