"use client"

import { useState } from "react"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
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
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils/currency"
import { timeAgo } from "@/lib/utils/dates"

interface InquiriesClientProps {
  inquiries: any[]
  userId: string
}

const statusConfig: Record<string, string> = {
  open: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  responded: "bg-green-500/15 text-green-400 border border-green-500/30",
  closed: "bg-gray-500/15 text-gray-400 border border-gray-500/30",
}

function StatusBadge({ status }: { status: string }) {
  const cls = statusConfig[status] || statusConfig.closed
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${cls}`}>
      {status}
    </span>
  )
}

function WatchLabel({ listing }: { listing: any }) {
  if (!listing) return <span className="text-muted-foreground text-sm">—</span>
  const brand = listing.brand?.name ?? ""
  const model = listing.model?.name ?? ""
  const ref = listing.reference_number ?? ""
  return (
    <div>
      <p className="text-sm font-semibold text-foreground">
        {brand} {model}
      </p>
      {ref && <p className="text-xs text-muted-foreground">{ref}</p>}
    </div>
  )
}

export default function InquiriesClient({
  inquiries,
  userId,
}: InquiriesClientProps) {
  const [localInquiries, setLocalInquiries] = useState<any[]>(inquiries)
  const [replyInquiry, setReplyInquiry] = useState<any | null>(null)
  const [replyMessage, setReplyMessage] = useState("")
  const [isReplying, setIsReplying] = useState(false)

  const received = localInquiries.filter((i) => i.to_dealer_id === userId)
  const sent = localInquiries.filter((i) => i.from_dealer_id === userId)

  async function handleClose(id: string) {
    const res = await fetch(`/api/inquiries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed" }),
    })
    if (res.ok) {
      toast.success("Inquiry closed")
      setLocalInquiries((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: "closed" } : i))
      )
    } else {
      toast.error("Failed to close inquiry")
    }
  }

  async function handleReply() {
    if (!replyInquiry || !replyMessage.trim()) return
    setIsReplying(true)
    try {
      const res = await fetch(`/api/inquiries/${replyInquiry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reply_message: replyMessage.trim(),
          status: "responded",
        }),
      })
      if (res.ok) {
        toast.success("Reply sent")
        setLocalInquiries((prev) =>
          prev.map((i) =>
            i.id === replyInquiry.id ? { ...i, status: "responded" } : i
          )
        )
        setReplyInquiry(null)
        setReplyMessage("")
      } else {
        toast.error("Failed to send reply")
      }
    } finally {
      setIsReplying(false)
    }
  }

  function renderTable(rows: any[], isReceived: boolean) {
    return (
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              {["Watch", isReceived ? "From" : "To", "Message", "Offer", "Status", "Time", ...(isReceived ? ["Actions"] : [])].map(
                (h) => (
                  <TableHead
                    key={h}
                    className="text-xs text-[var(--ow-text-faint)] uppercase tracking-wider"
                  >
                    {h}
                  </TableHead>
                )
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={isReceived ? 7 : 6}
                  className="h-24 text-center text-muted-foreground text-sm"
                >
                  No inquiries yet
                </TableCell>
              </TableRow>
            )}
            {rows.map((inquiry) => {
              const counterParty = isReceived
                ? inquiry.from_dealer
                : inquiry.to_dealer
              const counterPartyName =
                counterParty?.company_name ||
                counterParty?.full_name ||
                "Unknown"
              const truncatedMessage =
                inquiry.message.length > 60
                  ? `${inquiry.message.slice(0, 60)}...`
                  : inquiry.message

              return (
                <TableRow
                  key={inquiry.id}
                  className="hover:bg-bg-elevated border-b border-border"
                >
                  <TableCell>
                    <WatchLabel listing={inquiry.listing} />
                  </TableCell>
                  <TableCell className="text-sm text-foreground font-medium">
                    {counterPartyName}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs">
                    {truncatedMessage}
                  </TableCell>
                  <TableCell className="font-mono font-bold text-sm text-foreground">
                    {inquiry.offer_price
                      ? formatCurrency(inquiry.offer_price)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={inquiry.status} />
                  </TableCell>
                  <TableCell className="text-xs text-[var(--ow-text-faint)] whitespace-nowrap">
                    {timeAgo(inquiry.created_at)}
                  </TableCell>
                  {isReceived && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {inquiry.status !== "closed" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs border-border text-foreground hover:bg-bg-elevated"
                              onClick={() => {
                                setReplyInquiry(inquiry)
                                setReplyMessage("")
                              }}
                            >
                              Reply
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-bg-elevated"
                              onClick={() => handleClose(inquiry.id)}
                            >
                              Close
                            </Button>
                          </>
                        )}
                        {inquiry.status === "closed" && (
                          <span className="text-xs text-[var(--ow-text-faint)]">Closed</span>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-black text-foreground">Inquiries</h1>
        <p className="text-muted-foreground mt-1">
          Manage deal inquiries from other dealers.
        </p>
      </div>

      <Tabs defaultValue="received">
        <TabsList className="mb-4 bg-bg-card border border-border">
          <TabsTrigger value="received" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Received ({received.length})
          </TabsTrigger>
          <TabsTrigger value="sent" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            Sent ({sent.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received">
          {renderTable(received, true)}
        </TabsContent>

        <TabsContent value="sent">
          {renderTable(sent, false)}
        </TabsContent>
      </Tabs>

      {/* Reply Dialog */}
      <Dialog
        open={!!replyInquiry}
        onOpenChange={(open) => {
          if (!open) {
            setReplyInquiry(null)
            setReplyMessage("")
          }
        }}
      >
        <DialogContent className="bg-bg-card border-border text-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">Reply to Inquiry</DialogTitle>
          </DialogHeader>

          {replyInquiry && (
            <div className="space-y-4">
              {/* Watch info */}
              <div className="text-sm text-muted-foreground">
                <WatchLabel listing={replyInquiry.listing} />
              </div>

              {/* Original message */}
              <div className="rounded-lg bg-bg-elevated border border-border p-3">
                <p className="text-xs text-[var(--ow-text-faint)] uppercase tracking-wider mb-1">
                  Original Message
                </p>
                <p className="text-sm text-muted-foreground">
                  {replyInquiry.message}
                </p>
                {replyInquiry.offer_price && (
                  <p className="text-sm font-mono font-bold text-foreground mt-1">
                    Offer: {formatCurrency(replyInquiry.offer_price)}
                  </p>
                )}
              </div>

              {/* Reply textarea */}
              <div className="space-y-2">
                <label className="text-xs text-[var(--ow-text-faint)] uppercase tracking-wider">
                  Your Reply
                </label>
                <Textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type your reply..."
                  className="bg-bg-elevated border-border text-foreground placeholder:text-muted-foreground resize-none min-h-[100px]"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setReplyInquiry(null)
                    setReplyMessage("")
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:opacity-90"
                  onClick={handleReply}
                  disabled={isReplying || !replyMessage.trim()}
                >
                  {isReplying ? "Sending..." : "Send Reply"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
