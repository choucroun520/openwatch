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
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { timeAgo } from "@/lib/utils/dates"
import { Check, Clock, Plus, Shield } from "lucide-react"

interface AdminClientProps {
  dealers: any[]
  inviteCodes: any[]
}

const roleConfig: Record<string, string> = {
  dealer: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  admin: "bg-purple-500/15 text-purple-400 border border-purple-500/30",
  super_admin: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
}

function RoleBadge({ role }: { role: string }) {
  const cls =
    roleConfig[role] || "bg-gray-500/15 text-gray-400 border border-gray-500/30"
  const label =
    role === "super_admin" ? "Super Admin" : role.charAt(0).toUpperCase() + role.slice(1)
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {label}
    </span>
  )
}

function VerifiedIndicator({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-400">
        <Check size={12} />
        Verified
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-[#475569]">
      <Clock size={12} />
      Pending
    </span>
  )
}

function InviteCodeStatus({ code }: { code: any }) {
  const isUsed = code.use_count >= code.max_uses
  const isExpired = code.expires_at && new Date(code.expires_at) < new Date()

  if (isExpired) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-500/15 text-red-400 border border-red-500/30">
        Expired
      </span>
    )
  }
  if (isUsed) {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-500/15 text-gray-400 border border-gray-500/30">
        Used
      </span>
    )
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-500/15 text-green-400 border border-green-500/30">
      Active
    </span>
  )
}

export default function AdminClient({
  dealers,
  inviteCodes,
}: AdminClientProps) {
  const [localDealers, setLocalDealers] = useState<any[]>(dealers)
  const [localCodes, setLocalCodes] = useState<any[]>(inviteCodes)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)

  async function handleVerify(id: string) {
    setVerifyingId(id)
    try {
      const res = await fetch(`/api/admin/verify-dealer/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      })
      if (res.ok) {
        toast.success("Dealer verified")
        setLocalDealers((prev) =>
          prev.map((d) => (d.id === id ? { ...d, verified: true } : d))
        )
      } else {
        const err = await res.json()
        toast.error(err.error || "Failed to verify dealer")
      }
    } finally {
      setVerifyingId(null)
    }
  }

  async function handleGenerateCode() {
    setGeneratingCode(true)
    try {
      const res = await fetch("/api/admin/invite-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      if (res.ok) {
        const { data } = await res.json()
        toast.success(`Invite code created: ${data.code}`)
        setLocalCodes((prev) => [data, ...prev])
      } else {
        const err = await res.json()
        toast.error(err.error || "Failed to generate invite code")
      }
    } finally {
      setGeneratingCode(false)
    }
  }

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Shield size={20} className="text-blue-500" />
          <h1 className="text-3xl font-black text-foreground">Admin</h1>
        </div>
        <p className="text-muted-foreground">
          Manage dealers, verify accounts, and control network access.
        </p>
      </div>

      {/* Dealer Management */}
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-foreground">Dealer Management</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {localDealers.length} dealers in the network
          </p>
        </div>
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border">
                {["Name", "Company", "Email", "Role", "Verified", "Joined", "Actions"].map(
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
              {localDealers.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-muted-foreground text-sm"
                  >
                    No dealers yet
                  </TableCell>
                </TableRow>
              )}
              {localDealers.map((dealer) => (
                <TableRow
                  key={dealer.id}
                  className="hover:bg-bg-elevated border-b border-border"
                >
                  <TableCell className="font-medium text-foreground text-sm">
                    {dealer.full_name || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {dealer.company_name || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">
                    {dealer.email}
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={dealer.role} />
                  </TableCell>
                  <TableCell>
                    <VerifiedIndicator verified={dealer.verified} />
                  </TableCell>
                  <TableCell className="text-xs text-[#475569] whitespace-nowrap">
                    {dealer.joined_at ? timeAgo(dealer.joined_at) : "—"}
                  </TableCell>
                  <TableCell>
                    {!dealer.verified && (
                      <Button
                        size="sm"
                        className="h-7 px-3 text-xs bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:opacity-90 border-0"
                        onClick={() => handleVerify(dealer.id)}
                        disabled={verifyingId === dealer.id}
                      >
                        {verifyingId === dealer.id ? "Verifying..." : "Verify"}
                      </Button>
                    )}
                    {dealer.verified && (
                      <span className="text-xs text-[#475569]">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Invite Codes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">Invite Codes</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {localCodes.length} codes generated
            </p>
          </div>
          <Button
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:opacity-90 border-0 gap-2"
            onClick={handleGenerateCode}
            disabled={generatingCode}
          >
            <Plus size={14} />
            {generatingCode ? "Generating..." : "Generate Invite Code"}
          </Button>
        </div>
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border">
                {["Code", "Status", "Used By", "Uses", "Created"].map((h) => (
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
              {localCodes.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground text-sm"
                  >
                    No invite codes yet
                  </TableCell>
                </TableRow>
              )}
              {localCodes.map((code) => (
                <TableRow
                  key={code.id}
                  className="hover:bg-bg-elevated border-b border-border"
                >
                  <TableCell className="font-mono font-bold text-foreground text-sm tracking-widest">
                    {code.code}
                  </TableCell>
                  <TableCell>
                    <InviteCodeStatus code={code} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">
                    {code.used_by ? code.used_by.slice(0, 8) + "..." : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">
                    {code.use_count}/{code.max_uses}
                  </TableCell>
                  <TableCell className="text-xs text-[#475569] whitespace-nowrap">
                    {code.created_at ? timeAgo(code.created_at) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
