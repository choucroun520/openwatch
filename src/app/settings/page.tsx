"use client"

import { useState, useEffect, useCallback } from "react"
import AppLayout from "@/components/layout/app-layout"
import {
  Database, Key, RefreshCw, CheckCircle2, AlertCircle,
  XCircle, Clock, ExternalLink, Eye, EyeOff, Copy,
  ChevronDown, ChevronUp, Zap, Globe, TrendingUp,
  ShoppingCart, Gavel, Bot, Save, Trash2, Activity
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { DataSource } from "@/app/api/settings/data-sources/route"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApiKey {
  key: string
  label: string
  group: string
  description: string
  link: string
  sensitive: boolean
  is_set: boolean
  updated_at: string | null
  source: "env" | "db" | null
}

type SettingsTab = "sources" | "keys"

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  active:     { label: "Active",      color: "#10b981", icon: CheckCircle2 },
  needs_key:  { label: "Needs Key",   color: "#f59e0b", icon: Key },
  inactive:   { label: "Inactive",    color: "#64748b", icon: Clock },
  error:      { label: "Error",       color: "#ef4444", icon: XCircle },
}

const CATEGORY_CONFIG = {
  asking:          { label: "Asking Prices",    icon: TrendingUp,   color: "#2081E2" },
  confirmed_sales: { label: "Confirmed Sales",  icon: ShoppingCart, color: "#10b981" },
  auction:         { label: "Auction",          icon: Gavel,        color: "#f59e0b" },
  dealer_api:      { label: "Dealer API",       color: "#006039",   icon: Zap },
}

const KEY_GROUP_ICON: Record<string, typeof Bot> = {
  "eBay API": ShoppingCart,
  "WatchCharts": TrendingUp,
  "Reddit API": Globe,
  "AI": Bot,
}

function fmt(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DataSource["status"] }) {
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
      style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}33` }}
    >
      <Icon size={10} />
      {cfg.label}
    </span>
  )
}

function CategoryBadge({ category }: { category: DataSource["category"] }) {
  const cfg = CATEGORY_CONFIG[category]
  const Icon = cfg.icon
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: `${cfg.color}14`, color: cfg.color }}
    >
      <Icon size={9} />
      {cfg.label}
    </span>
  )
}

function SourceCard({ src }: { src: DataSource }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{ background: "#111119", border: "1px solid #1c1c2a" }}
    >
      {/* Header row */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#161622] transition-colors"
      >
        {/* Flag */}
        <span className="text-xl shrink-0 w-7">{src.flag}</span>

        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>{src.name}</span>
            <CategoryBadge category={src.category} />
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[11px]" style={{ color: "#64748b" }}>{src.market} · {src.currency}</span>
            {src.last_sync_ago && (
              <span className="text-[11px]" style={{ color: "#64748b" }}>Last sync: {src.last_sync_ago}</span>
            )}
          </div>
        </div>

        {/* Stats */}
        {src.listing_count > 0 && (
          <div className="shrink-0 text-right mr-2">
            <div className="text-sm font-bold" style={{ color: "#e2e8f0" }}>{fmt(src.listing_count)}</div>
            <div className="text-[10px]" style={{ color: "#64748b" }}>listings</div>
          </div>
        )}

        {/* Status */}
        <StatusBadge status={src.status} />
        {open ? <ChevronUp size={14} style={{ color: "#64748b" }} /> : <ChevronDown size={14} style={{ color: "#64748b" }} />}
      </button>

      {/* Expandable detail */}
      {open && (
        <div className="px-4 pb-4 pt-1" style={{ borderTop: "1px solid #1c1c2a" }}>
          {src.notes && (
            <p className="text-xs mb-3 mt-2" style={{ color: "#94a3b8" }}>{src.notes}</p>
          )}

          {src.requires_key && !src.has_key && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3 text-xs"
              style={{ background: "#f59e0b14", border: "1px solid #f59e0b33", color: "#f59e0b" }}
            >
              <Key size={12} />
              Requires <strong>{src.requires_key}</strong> — add it in the API Keys tab to activate
            </div>
          )}

          {src.run_cmd && (
            <div className="mt-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#64748b" }}>Run manually</p>
              <div
                className="flex items-center justify-between px-3 py-2 rounded-lg font-mono text-xs"
                style={{ background: "#0b0b14", border: "1px solid #1c1c2a", color: "#94a3b8" }}
              >
                <span className="truncate">{src.run_cmd}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(src.run_cmd!)}
                  className="ml-2 shrink-0 hover:text-white transition-colors"
                >
                  <Copy size={11} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function KeyCard({ apiKey, onSave, onDelete }: {
  apiKey: ApiKey
  onSave: (key: string, value: string) => Promise<void>
  onDelete: (key: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState("")
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)

  const Icon = KEY_GROUP_ICON[apiKey.group] ?? Key

  async function handleSave() {
    if (!value.trim()) return
    setSaving(true)
    await onSave(apiKey.key, value.trim())
    setSaving(false)
    setEditing(false)
    setValue("")
  }

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "#111119", border: `1px solid ${apiKey.is_set ? "#10b98133" : "#1c1c2a"}` }}
    >
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
          style={{ background: apiKey.is_set ? "#10b98118" : "#1c1c2a" }}
        >
          <Icon size={15} style={{ color: apiKey.is_set ? "#10b981" : "#64748b" }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>{apiKey.label}</span>
            {apiKey.is_set ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: "#10b98118", color: "#10b981" }}>
                <CheckCircle2 size={9} /> SET
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: "#f59e0b18", color: "#f59e0b" }}>
                <AlertCircle size={9} /> NOT SET
              </span>
            )}
            {apiKey.source === "env" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#2081E218", color: "#2081E2" }}>
                from env
              </span>
            )}
          </div>

          <p className="text-xs mt-1 mb-2" style={{ color: "#64748b" }}>{apiKey.description}</p>

          {apiKey.updated_at && (
            <p className="text-[10px] mb-2" style={{ color: "#475569" }}>
              Last updated: {new Date(apiKey.updated_at).toLocaleDateString()}
            </p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {!editing ? (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors hover:opacity-90"
                  style={{ background: "#2081E2", color: "#fff" }}
                >
                  {apiKey.is_set ? "Update Key" : "Add Key"}
                </button>
                {apiKey.is_set && apiKey.source === "db" && (
                  <button
                    onClick={() => onDelete(apiKey.key)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                    style={{ background: "#ef444418", color: "#ef4444", border: "1px solid #ef444433" }}
                  >
                    <Trash2 size={11} className="inline mr-1" />Remove
                  </button>
                )}
                <a
                  href={apiKey.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1"
                  style={{ background: "#1c1c2a", color: "#94a3b8" }}
                >
                  <ExternalLink size={11} /> Get key
                </a>
              </>
            ) : (
              <div className="flex items-center gap-2 w-full max-w-lg">
                <div className="relative flex-1">
                  <input
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSave()}
                    placeholder={`Enter ${apiKey.label}...`}
                    autoFocus
                    className="w-full h-9 px-3 pr-9 rounded-lg text-xs font-mono focus:outline-none"
                    style={{
                      background: "#0b0b14",
                      border: "1px solid #2081E2",
                      color: "#e2e8f0",
                    }}
                  />
                  <button
                    onClick={() => setShow(s => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: "#64748b" }}
                  >
                    {show ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving || !value.trim()}
                  className="h-9 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 disabled:opacity-50"
                  style={{ background: "#10b981", color: "#fff" }}
                >
                  {saving ? <RefreshCw size={11} className="animate-spin" /> : <Save size={11} />}
                  Save
                </button>
                <button
                  onClick={() => { setEditing(false); setValue("") }}
                  className="h-9 px-3 rounded-lg text-xs transition-colors"
                  style={{ background: "#1c1c2a", color: "#94a3b8" }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("sources")
  const [sources, setSources] = useState<DataSource[]>([])
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>("all")
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchData = useCallback(async () => {
    setRefreshing(true)
    try {
      const [srcRes, keyRes] = await Promise.all([
        fetch("/api/settings/data-sources"),
        fetch("/api/settings/api-keys"),
      ])
      const [srcData, keyData] = await Promise.all([srcRes.json(), keyRes.json()])
      setSources(srcData.sources ?? [])
      setApiKeys(keyData.keys ?? [])
    } catch {}
    setRefreshing(false)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleSaveKey(key: string, value: string) {
    const res = await fetch("/api/settings/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    })
    if (res.ok) {
      showToast(`✅ ${key} saved`)
      fetchData()
    } else {
      showToast("❌ Failed to save key")
    }
  }

  async function handleDeleteKey(key: string) {
    await fetch("/api/settings/api-keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    })
    showToast(`🗑️ ${key} removed`)
    fetchData()
  }

  // Stats
  const activeSources = sources.filter(s => s.status === "active").length
  const needsKey = sources.filter(s => s.status === "needs_key").length
  const keysSet = apiKeys.filter(k => k.is_set).length
  const totalListings = sources.reduce((sum, s) => sum + s.listing_count, 0)

  const filteredSources = filterCategory === "all"
    ? sources
    : sources.filter(s => s.category === filterCategory)

  // Group keys
  const keyGroups = Array.from(new Set(apiKeys.map(k => k.group)))

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* ── Header ── */}
        <div className="mb-6">
          <h1 className="text-2xl font-black text-white mb-1">Settings</h1>
          <p className="text-sm" style={{ color: "#64748b" }}>Manage data sources, API keys, and integrations</p>
        </div>

        {/* ── Stats bar ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Active Sources", value: activeSources, color: "#10b981", icon: Activity },
            { label: "Need API Key", value: needsKey, color: "#f59e0b", icon: Key },
            { label: "API Keys Set", value: `${keysSet}/${apiKeys.length}`, color: "#2081E2", icon: CheckCircle2 },
            { label: "Total Datapoints", value: fmt(totalListings), color: "#a78bfa", icon: Database },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="rounded-xl px-4 py-3" style={{ background: "#111119", border: "1px solid #1c1c2a" }}>
              <div className="flex items-center gap-2 mb-1">
                <Icon size={13} style={{ color }} />
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#64748b" }}>{label}</span>
              </div>
              <div className="text-xl font-black" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* ── Tab bar ── */}
        <div className="flex items-center gap-1 mb-6 p-1 rounded-xl" style={{ background: "#111119", border: "1px solid #1c1c2a" }}>
          {(["sources", "keys"] as SettingsTab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all",
                tab === t ? "text-white" : "hover:text-white"
              )}
              style={{
                background: tab === t ? "#1c1c2a" : "transparent",
                color: tab === t ? "#fff" : "#64748b",
              }}
            >
              {t === "sources" ? <><Database size={14} /> Data Sources</> : <><Key size={14} /> API Keys</>}
            </button>
          ))}
          <button
            onClick={fetchData}
            disabled={refreshing}
            className="p-2 rounded-lg transition-colors hover:bg-[#1c1c2a]"
            style={{ color: "#64748b" }}
            title="Refresh"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>

        {/* ── Data Sources Tab ── */}
        {tab === "sources" && (
          <div>
            {/* Category filter */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {["all", "asking", "confirmed_sales", "auction", "dealer_api"].map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className="text-xs px-3 py-1.5 rounded-full font-semibold transition-colors"
                  style={{
                    background: filterCategory === cat ? "#2081E2" : "#1c1c2a",
                    color: filterCategory === cat ? "#fff" : "#94a3b8",
                  }}
                >
                  {cat === "all" ? "All Sources" :
                   cat === "asking" ? "🌍 Asking Prices" :
                   cat === "confirmed_sales" ? "✅ Confirmed Sales" :
                   cat === "auction" ? "🏛️ Auctions" :
                   "👑 Dealer API"}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw size={20} className="animate-spin" style={{ color: "#64748b" }} />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filteredSources.map(src => (
                  <SourceCard key={src.id} src={src} />
                ))}
              </div>
            )}

            {/* Help footer */}
            <div
              className="mt-6 rounded-xl px-4 py-4 text-xs"
              style={{ background: "#111119", border: "1px solid #1c1c2a", color: "#64748b" }}
            >
              <p className="font-semibold mb-1" style={{ color: "#94a3b8" }}>💡 How to populate data</p>
              <p>Run the global market scanner to populate price data across all 9 markets:</p>
              <code
                className="block mt-2 px-3 py-2 rounded-lg font-mono text-xs"
                style={{ background: "#0b0b14", color: "#10b981" }}
              >
                node scripts/run-global-scan.mjs --quick
              </code>
            </div>
          </div>
        )}

        {/* ── API Keys Tab ── */}
        {tab === "keys" && (
          <div>
            <p className="text-sm mb-4" style={{ color: "#64748b" }}>
              API keys are stored securely in your database. They unlock additional data sources and AI features.
            </p>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw size={20} className="animate-spin" style={{ color: "#64748b" }} />
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {keyGroups.map(group => (
                  <div key={group}>
                    <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#64748b" }}>
                      {group}
                    </h3>
                    <div className="flex flex-col gap-2">
                      {apiKeys.filter(k => k.group === group).map(apiKey => (
                        <KeyCard
                          key={apiKey.key}
                          apiKey={apiKey}
                          onSave={handleSaveKey}
                          onDelete={handleDeleteKey}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl z-50 transition-all"
          style={{ background: "#111119", border: "1px solid #1c1c2a", color: "#e2e8f0" }}
        >
          {toast}
        </div>
      )}
    </AppLayout>
  )
}
