"use client"

import { useState, useEffect, useCallback } from "react"
import AppLayout from "@/components/layout/app-layout"
import {
  Search,
  Plus,
  X,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  Loader2,
  Clock,
  DollarSign,
  TrendingDown,
  MessageSquare,
  AlertCircle,
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────

type DealStatus =
  | "spotted"
  | "outreach_sent"
  | "negotiating"
  | "offer_accepted"
  | "purchased"
  | "passed"
  | "expired"

interface Deal {
  id: string
  ref_number: string
  brand: string | null
  model: string | null
  source: string
  listing_url: string | null
  asking_price_usd: string
  our_offer_usd: string | null
  status: DealStatus
  seller_score: number | null
  motivation_score: number | null
  outreach_message: string | null
  seller_response: string | null
  ai_analysis: string | null
  notes: string | null
  market_code: string | null
  currency_local: string | null
  price_local: string | null
  created_at: string
  updated_at: string
}

// ── Constants ──────────────────────────────────────────────────────────────

const COLUMNS: {
  status: DealStatus
  label: string
  icon: string
  color: string
}[] = [
  { status: "spotted",       label: "Spotted",        icon: "🔍", color: "#2563eb" },
  { status: "outreach_sent", label: "Outreach Sent",  icon: "📩", color: "#7c3aed" },
  { status: "negotiating",   label: "Negotiating",    icon: "💬", color: "#eab308" },
  { status: "offer_accepted",label: "Offer Accepted", icon: "✅", color: "#22c55e" },
  { status: "passed",        label: "Passed",         icon: "❌", color: "#ef4444" },
]

const MARKET_FLAGS: Record<string, string> = {
  US: "🇺🇸", DE: "🇩🇪", FR: "🇫🇷", UK: "🇬🇧",
  JP: "🇯🇵", HK: "🇭🇰", SG: "🇸🇬", CH: "🇨🇭", AE: "🇦🇪",
}

const SOURCE_LABELS: Record<string, string> = {
  chrono24_us: "Chrono24 US",
  chrono24_de: "Chrono24 DE",
  chrono24_fr: "Chrono24 FR",
  chrono24_uk: "Chrono24 UK",
  chrono24_jp: "Chrono24 JP",
  chrono24_hk: "Chrono24 HK",
  chrono24_sg: "Chrono24 SG",
  chrono24_ch: "Chrono24 CH",
  chrono24_ae: "Chrono24 AE",
  yahoo_japan: "Yahoo Japan",
  watchbox: "WatchBox",
  bobs_watches: "Bob's Watches",
  ebay: "eBay",
  rccrown: "RC Crown",
  phillips: "Phillips",
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatUSD(val: string | null | undefined): string {
  if (!val) return "—"
  const n = parseFloat(val)
  if (isNaN(n)) return "—"
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function discountPct(asking: string, offer: string | null): string | null {
  if (!offer) return null
  const a = parseFloat(asking)
  const o = parseFloat(offer)
  if (!a || !o) return null
  const pct = ((a - o) / a) * 100
  return pct.toFixed(1) + "%"
}

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function sellerScoreColor(score: number | null): string {
  if (score === null) return "#64748b"
  if (score >= 70) return "#22c55e"
  if (score >= 40) return "#eab308"
  return "#ef4444"
}

function marketFlag(code: string | null, source: string): string {
  if (code && MARKET_FLAGS[code]) return MARKET_FLAGS[code]
  // Infer from source
  const match = source.match(/chrono24_([a-z]+)/)
  if (match) {
    const code2 = match[1].toUpperCase()
    return MARKET_FLAGS[code2] ?? "🌐"
  }
  if (source === "yahoo_japan") return "🇯🇵"
  if (source === "watchbox" || source === "bobs_watches" || source === "ebay") return "🇺🇸"
  return "🌐"
}

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source
}

// ── Deal Card ──────────────────────────────────────────────────────────────

function DealCard({
  deal,
  onStatusChange,
  onCopyMessage,
}: {
  deal: Deal
  onStatusChange: (id: string, status: DealStatus) => void
  onCopyMessage: (msg: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const days = daysAgo(deal.created_at)
  const discount = discountPct(deal.asking_price_usd, deal.our_offer_usd)
  const flag = marketFlag(deal.market_code, deal.source)
  const scoreColor = sellerScoreColor(deal.seller_score)

  const handleCopy = () => {
    const msg = deal.outreach_message ?? deal.notes ?? ""
    if (!msg) return
    navigator.clipboard.writeText(msg).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      onCopyMessage(msg)
    })
  }

  return (
    <div
      style={{
        backgroundColor: "#111119",
        border: "1px solid #1c1c2a",
        borderRadius: "10px",
        padding: "14px",
        marginBottom: "10px",
        transition: "border-color 0.15s",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor = "#2563eb"
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLDivElement).style.borderColor = "#1c1c2a"
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "13px" }}>{flag}</span>
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "13px",
                fontWeight: 700,
                color: "#e2e8f0",
              }}
            >
              {deal.ref_number}
            </span>
            {deal.brand && (
              <span style={{ fontSize: "11px", color: "#64748b" }}>· {deal.brand}</span>
            )}
          </div>
          {deal.model && (
            <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>{deal.model}</div>
          )}
        </div>

        {/* Seller score badge */}
        {deal.seller_score !== null && (
          <div
            style={{
              backgroundColor: scoreColor + "22",
              border: `1px solid ${scoreColor}55`,
              color: scoreColor,
              borderRadius: "999px",
              padding: "2px 8px",
              fontSize: "11px",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {deal.seller_score}/100
          </div>
        )}
      </div>

      {/* Price row */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
        <span
          style={{
            fontFamily: "ui-monospace, monospace",
            fontSize: "16px",
            fontWeight: 700,
            color: "#e2e8f0",
          }}
        >
          {formatUSD(deal.asking_price_usd)}
        </span>
        {deal.our_offer_usd && (
          <>
            <span style={{ color: "#475569", fontSize: "12px" }}>→ offer</span>
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "14px",
                fontWeight: 700,
                color: "#22c55e",
              }}
            >
              {formatUSD(deal.our_offer_usd)}
            </span>
            {discount && (
              <span
                style={{
                  fontSize: "11px",
                  color: "#22c55e",
                  backgroundColor: "#22c55e18",
                  borderRadius: "4px",
                  padding: "1px 5px",
                }}
              >
                -{discount}
              </span>
            )}
          </>
        )}
      </div>

      {/* Meta row */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: "11px",
            color: "#94a3b8",
            backgroundColor: "#1c1c2a",
            borderRadius: "4px",
            padding: "2px 6px",
          }}
        >
          {sourceLabel(deal.source)}
        </span>
        <span
          style={{
            fontSize: "11px",
            color: days > 7 ? "#eab308" : "#94a3b8",
            display: "flex",
            alignItems: "center",
            gap: "3px",
          }}
        >
          <Clock size={11} />
          {days === 0 ? "Today" : days === 1 ? "1d ago" : `${days}d ago`}
        </span>
        {deal.seller_response && (
          <span
            style={{
              fontSize: "11px",
              color: "#22c55e",
              backgroundColor: "#22c55e18",
              borderRadius: "4px",
              padding: "2px 6px",
              display: "flex",
              alignItems: "center",
              gap: "3px",
            }}
          >
            <MessageSquare size={10} />
            Response
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {deal.listing_url && (
          <a
            href={deal.listing_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: "11px",
              color: "#94a3b8",
              backgroundColor: "#161622",
              border: "1px solid #1c1c2a",
              borderRadius: "6px",
              padding: "4px 8px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              textDecoration: "none",
            }}
          >
            <ExternalLink size={11} />
            View
          </a>
        )}

        {deal.outreach_message && (
          <button
            onClick={handleCopy}
            style={{
              fontSize: "11px",
              color: copied ? "#22c55e" : "#94a3b8",
              backgroundColor: "#161622",
              border: `1px solid ${copied ? "#22c55e44" : "#1c1c2a"}`,
              borderRadius: "6px",
              padding: "4px 8px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              cursor: "pointer",
            }}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? "Copied!" : "Copy Message"}
          </button>
        )}

        <StatusDropdown
          currentStatus={deal.status}
          onSelect={(s) => onStatusChange(deal.id, s)}
        />

        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            fontSize: "11px",
            color: "#94a3b8",
            backgroundColor: "#161622",
            border: "1px solid #1c1c2a",
            borderRadius: "6px",
            padding: "4px 8px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            cursor: "pointer",
          }}
        >
          <ChevronDown
            size={11}
            style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
          />
          Details
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          style={{
            marginTop: "12px",
            paddingTop: "12px",
            borderTop: "1px solid #1c1c2a",
          }}
        >
          {deal.outreach_message && (
            <div style={{ marginBottom: "10px" }}>
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Outreach Message
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#94a3b8",
                  backgroundColor: "#161622",
                  border: "1px solid #1c1c2a",
                  borderRadius: "6px",
                  padding: "8px 10px",
                  lineHeight: "1.5",
                  whiteSpace: "pre-wrap",
                }}
              >
                {deal.outreach_message}
              </div>
            </div>
          )}

          {deal.seller_response && (
            <div style={{ marginBottom: "10px" }}>
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Seller Response
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#e2e8f0",
                  backgroundColor: "#161622",
                  border: "1px solid #22c55e44",
                  borderRadius: "6px",
                  padding: "8px 10px",
                  lineHeight: "1.5",
                  whiteSpace: "pre-wrap",
                }}
              >
                {deal.seller_response}
              </div>
            </div>
          )}

          {deal.ai_analysis && (() => {
            try {
              const analysis = typeof deal.ai_analysis === "string"
                ? JSON.parse(deal.ai_analysis)
                : deal.ai_analysis
              return (
                <div>
                  <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    AI Analysis
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#94a3b8",
                      backgroundColor: "#0b0b14",
                      border: "1px solid #2563eb44",
                      borderRadius: "6px",
                      padding: "8px 10px",
                    }}
                  >
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "6px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: analysis.classification === "SERIOUS" ? "#22c55e"
                            : analysis.classification === "BROKER" ? "#ef4444"
                            : analysis.classification === "FIRM_PRICE" ? "#eab308"
                            : "#94a3b8",
                          backgroundColor: "#1c1c2a",
                          borderRadius: "4px",
                          padding: "2px 6px",
                        }}
                      >
                        {analysis.classification}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: analysis.recommendation === "ACCEPT" ? "#22c55e"
                            : analysis.recommendation === "WALK_AWAY" ? "#ef4444"
                            : "#2563eb",
                          backgroundColor: "#1c1c2a",
                          borderRadius: "4px",
                          padding: "2px 6px",
                        }}
                      >
                        → {analysis.recommendation}
                      </span>
                      {analysis.counter_offer_price && (
                        <span style={{ fontSize: "11px", color: "#94a3b8", backgroundColor: "#1c1c2a", borderRadius: "4px", padding: "2px 6px" }}>
                          Counter: ${Number(analysis.counter_offer_price).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {analysis.red_flags?.length > 0 && (
                      <div style={{ color: "#ef4444", fontSize: "11px", marginBottom: "4px" }}>
                        ⚠️ {analysis.red_flags.join(" · ")}
                      </div>
                    )}
                    {analysis.our_next_message && (
                      <div style={{ fontSize: "12px", color: "#94a3b8", lineHeight: "1.5", fontStyle: "italic" }}>
                        &ldquo;{analysis.our_next_message}&rdquo;
                      </div>
                    )}
                  </div>
                </div>
              )
            } catch {
              return null
            }
          })()}

          {deal.notes && (
            <div style={{ marginTop: "8px", fontSize: "12px", color: "#64748b", fontStyle: "italic" }}>
              📝 {deal.notes}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Status Dropdown ────────────────────────────────────────────────────────

function StatusDropdown({
  currentStatus,
  onSelect,
}: {
  currentStatus: DealStatus
  onSelect: (s: DealStatus) => void
}) {
  const [open, setOpen] = useState(false)

  const statuses: { value: DealStatus; label: string }[] = [
    { value: "spotted", label: "🔍 Spotted" },
    { value: "outreach_sent", label: "📩 Outreach Sent" },
    { value: "negotiating", label: "💬 Negotiating" },
    { value: "offer_accepted", label: "✅ Offer Accepted" },
    { value: "purchased", label: "🎯 Purchased" },
    { value: "passed", label: "❌ Passed" },
    { value: "expired", label: "⏰ Expired" },
  ]

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          fontSize: "11px",
          color: "#94a3b8",
          backgroundColor: "#161622",
          border: "1px solid #1c1c2a",
          borderRadius: "6px",
          padding: "4px 8px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        Mark Status
        <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 10,
            }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: "4px",
              backgroundColor: "#111119",
              border: "1px solid #1c1c2a",
              borderRadius: "8px",
              padding: "4px",
              zIndex: 20,
              minWidth: "160px",
              boxShadow: "0 8px 30px rgba(0,0,0,.5)",
            }}
          >
            {statuses.map((s) => (
              <button
                key={s.value}
                onClick={() => {
                  onSelect(s.value)
                  setOpen(false)
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  fontSize: "12px",
                  color: s.value === currentStatus ? "#e2e8f0" : "#94a3b8",
                  backgroundColor: s.value === currentStatus ? "#1c1c2a" : "transparent",
                  border: "none",
                  borderRadius: "4px",
                  padding: "6px 10px",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  if (s.value !== currentStatus) {
                    ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = "#161622"
                  }
                }}
                onMouseLeave={(e) => {
                  if (s.value !== currentStatus) {
                    ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"
                  }
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── New Deal Modal ─────────────────────────────────────────────────────────

function NewDealModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    ref_number: "",
    brand: "",
    model: "",
    source: "chrono24_de",
    listing_url: "",
    asking_price_usd: "",
    our_offer_usd: "",
    notes: "",
    market_code: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sources = [
    "chrono24_us", "chrono24_de", "chrono24_fr", "chrono24_uk",
    "chrono24_jp", "chrono24_hk", "chrono24_sg", "chrono24_ch", "chrono24_ae",
    "yahoo_japan", "watchbox", "bobs_watches", "ebay", "rccrown", "other",
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.ref_number.trim() || !form.asking_price_usd) {
      setError("Reference number and asking price are required")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/deals/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ref_number: form.ref_number.trim(),
          brand: form.brand.trim() || undefined,
          model: form.model.trim() || undefined,
          source: form.source,
          listing_url: form.listing_url.trim() || undefined,
          asking_price_usd: form.asking_price_usd,
          our_offer_usd: form.our_offer_usd || undefined,
          notes: form.notes.trim() || undefined,
          market_code: form.market_code.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Failed to create deal")
      }
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    backgroundColor: "#0b0b14",
    border: "1px solid #1c1c2a",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "13px",
    color: "#e2e8f0",
    outline: "none",
    boxSizing: "border-box",
  }

  const labelStyle: React.CSSProperties = {
    fontSize: "12px",
    color: "#94a3b8",
    marginBottom: "4px",
    display: "block",
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,.7)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          backgroundColor: "#111119",
          border: "1px solid #1c1c2a",
          borderRadius: "14px",
          padding: "24px",
          width: "100%",
          maxWidth: "520px",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
            Add New Deal
          </h2>
          <button
            onClick={onClose}
            style={{
              backgroundColor: "transparent",
              border: "none",
              color: "#64748b",
              cursor: "pointer",
              padding: "4px",
              borderRadius: "4px",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: "#ef444418",
              border: "1px solid #ef444444",
              borderRadius: "8px",
              padding: "10px 12px",
              marginBottom: "16px",
              fontSize: "13px",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Reference Number *</label>
              <input
                style={inputStyle}
                placeholder="e.g. 126610LN"
                value={form.ref_number}
                onChange={(e) => setForm((f) => ({ ...f, ref_number: e.target.value }))}
                required
              />
            </div>

            <div>
              <label style={labelStyle}>Brand</label>
              <input
                style={inputStyle}
                placeholder="e.g. Rolex"
                value={form.brand}
                onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
              />
            </div>

            <div>
              <label style={labelStyle}>Model</label>
              <input
                style={inputStyle}
                placeholder="e.g. Submariner"
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              />
            </div>

            <div>
              <label style={labelStyle}>Source</label>
              <select
                style={{ ...inputStyle, cursor: "pointer" }}
                value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
              >
                {sources.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABELS[s] ?? s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Market</label>
              <select
                style={{ ...inputStyle, cursor: "pointer" }}
                value={form.market_code}
                onChange={(e) => setForm((f) => ({ ...f, market_code: e.target.value }))}
              >
                <option value="">Auto-detect</option>
                {Object.entries(MARKET_FLAGS).map(([code, flag]) => (
                  <option key={code} value={code}>
                    {flag} {code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Asking Price (USD) *</label>
              <input
                style={inputStyle}
                type="number"
                step="0.01"
                min="0"
                placeholder="14200"
                value={form.asking_price_usd}
                onChange={(e) => setForm((f) => ({ ...f, asking_price_usd: e.target.value }))}
                required
              />
            </div>

            <div>
              <label style={labelStyle}>Our Offer (USD)</label>
              <input
                style={inputStyle}
                type="number"
                step="0.01"
                min="0"
                placeholder="13000"
                value={form.our_offer_usd}
                onChange={(e) => setForm((f) => ({ ...f, our_offer_usd: e.target.value }))}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Listing URL</label>
              <input
                style={inputStyle}
                type="url"
                placeholder="https://..."
                value={form.listing_url}
                onChange={(e) => setForm((f) => ({ ...f, listing_url: e.target.value }))}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Notes</label>
              <textarea
                style={{ ...inputStyle, minHeight: "70px", resize: "vertical" }}
                placeholder="Private seller, has box only, ending soon..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: "10px",
                backgroundColor: "#161622",
                border: "1px solid #1c1c2a",
                borderRadius: "8px",
                color: "#94a3b8",
                fontSize: "13px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 2,
                padding: "10px",
                background: "linear-gradient(to right, #2563eb, #7c3aed)",
                border: "none",
                borderRadius: "8px",
                color: "#fff",
                fontSize: "13px",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {loading ? "Creating..." : "Add Deal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [showNewDeal, setShowNewDeal] = useState(false)

  const fetchDeals = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch("/api/deals/pipeline?limit=200")
      if (!res.ok) throw new Error("Failed to fetch deals")
      const json = await res.json()
      setDeals(json.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDeals()
  }, [fetchDeals])

  const handleStatusChange = async (id: string, status: DealStatus) => {
    try {
      const res = await fetch(`/api/deals/pipeline/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) return
      setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)))
    } catch {
      // ignore
    }
  }

  const handleCopyMessage = (_msg: string) => {
    // Could trigger a toast here
  }

  // Filter deals by search query
  const filteredDeals = deals.filter((d) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      d.ref_number.toLowerCase().includes(q) ||
      (d.brand?.toLowerCase().includes(q) ?? false) ||
      (d.model?.toLowerCase().includes(q) ?? false) ||
      d.source.toLowerCase().includes(q)
    )
  })

  // Group by status (excluding purchased/expired from main board)
  const boardStatuses: DealStatus[] = ["spotted", "outreach_sent", "negotiating", "offer_accepted", "passed"]
  const dealsByStatus = boardStatuses.reduce<Record<DealStatus, Deal[]>>(
    (acc, s) => {
      acc[s] = filteredDeals.filter((d) => d.status === s)
      return acc
    },
    {} as Record<DealStatus, Deal[]>
  )

  // Stats
  const totalActive = deals.filter((d) => !["passed", "expired", "purchased"].includes(d.status)).length
  const totalNegotiating = deals.filter((d) => d.status === "negotiating").length
  const totalPurchased = deals.filter((d) => d.status === "purchased").length
  const totalValue = deals
    .filter((d) => d.status === "negotiating" || d.status === "offer_accepted")
    .reduce((sum, d) => sum + parseFloat(d.asking_price_usd || "0"), 0)

  return (
    <AppLayout>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#e2e8f0", margin: 0 }}>
              Deal Pipeline
            </h1>
            <p style={{ fontSize: "14px", color: "#64748b", margin: "4px 0 0" }}>
              Track watch acquisition deals from spotted → purchased
            </p>
          </div>
          <button
            onClick={() => setShowNewDeal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              background: "linear-gradient(to right, #2563eb, #7c3aed)",
              border: "none",
              borderRadius: "10px",
              color: "#fff",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Plus size={16} />
            New Deal
          </button>
        </div>

        {/* Stats bar */}
        <div
          style={{
            display: "flex",
            gap: "24px",
            marginTop: "20px",
            flexWrap: "wrap",
          }}
        >
          {[
            { label: "Active Deals", value: totalActive, icon: <TrendingDown size={14} />, color: "#2563eb" },
            { label: "Negotiating", value: totalNegotiating, icon: <MessageSquare size={14} />, color: "#eab308" },
            { label: "Purchased", value: totalPurchased, icon: <Check size={14} />, color: "#22c55e" },
            {
              label: "Pipeline Value",
              value: `$${(totalValue / 1000).toFixed(0)}K`,
              icon: <DollarSign size={14} />,
              color: "#8b5cf6",
            },
          ].map((stat) => (
            <div key={stat.label} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <div style={{ fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ color: stat.color }}>{stat.icon}</span>
                {stat.label}
              </div>
              <div
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "#e2e8f0",
                }}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div
        style={{
          position: "relative",
          maxWidth: "360px",
          marginBottom: "20px",
        }}
      >
        <Search
          size={15}
          style={{
            position: "absolute",
            left: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "#64748b",
          }}
        />
        <input
          type="text"
          placeholder="Search ref, brand, source..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            backgroundColor: "#111119",
            border: "1px solid #1c1c2a",
            borderRadius: "10px",
            padding: "9px 12px 9px 36px",
            fontSize: "13px",
            color: "#e2e8f0",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            backgroundColor: "#ef444418",
            border: "1px solid #ef444444",
            borderRadius: "10px",
            padding: "16px",
            marginBottom: "20px",
            color: "#ef4444",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#64748b", padding: "40px 0" }}>
          <Loader2 size={18} className="animate-spin" />
          Loading deals...
        </div>
      )}

      {/* Kanban board */}
      {!loading && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            gap: "14px",
            overflowX: "auto",
          }}
        >
          {COLUMNS.map((col) => {
            const colDeals = dealsByStatus[col.status] ?? []
            return (
              <div
                key={col.status}
                style={{
                  minWidth: "240px",
                }}
              >
                {/* Column header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "12px",
                    padding: "10px 14px",
                    backgroundColor: "#111119",
                    border: "1px solid #1c1c2a",
                    borderRadius: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>{col.icon}</span>
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#e2e8f0",
                      }}
                    >
                      {col.label}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: col.color,
                      backgroundColor: col.color + "22",
                      borderRadius: "999px",
                      padding: "2px 8px",
                      minWidth: "24px",
                      textAlign: "center",
                    }}
                  >
                    {colDeals.length}
                  </span>
                </div>

                {/* Cards */}
                <div>
                  {colDeals.length === 0 ? (
                    <div
                      style={{
                        border: "1px dashed #1c1c2a",
                        borderRadius: "10px",
                        padding: "24px",
                        textAlign: "center",
                        color: "#475569",
                        fontSize: "12px",
                      }}
                    >
                      No deals
                    </div>
                  ) : (
                    colDeals.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        onStatusChange={handleStatusChange}
                        onCopyMessage={handleCopyMessage}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state when no deals at all */}
      {!loading && deals.length === 0 && !error && (
        <div
          style={{
            textAlign: "center",
            padding: "80px 20px",
            color: "#64748b",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔍</div>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "#94a3b8", marginBottom: "8px" }}>
            No deals yet
          </div>
          <p style={{ fontSize: "14px", marginBottom: "24px" }}>
            Run the scrapers to find listings, or add a deal manually.
          </p>
          <button
            onClick={() => setShowNewDeal(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              background: "linear-gradient(to right, #2563eb, #7c3aed)",
              border: "none",
              borderRadius: "10px",
              color: "#fff",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Plus size={16} />
            Add First Deal
          </button>
        </div>
      )}

      {/* New Deal Modal */}
      {showNewDeal && (
        <NewDealModal
          onClose={() => setShowNewDeal(false)}
          onCreated={() => {
            fetchDeals()
          }}
        />
      )}
    </AppLayout>
  )
}
