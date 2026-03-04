"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, Clock, TrendingUp, Hash, Store, ArrowRight, Loader2, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SearchResult } from "@/app/api/search/route"

// Extended type for enriched search results (optional market context fields from API)
interface EnrichedResult extends SearchResult {
  trend?: "surging" | "rising" | "stable" | "cooling" | "dropping"
  trend_pct?: number
  has_arbitrage?: boolean
}

const POPULAR = [
  { label: "Rolex Submariner", q: "Submariner" },
  { label: "Patek 5711", q: "5711" },
  { label: "AP Royal Oak", q: "Royal Oak" },
  { label: "Rolex Daytona", q: "Daytona" },
  { label: "GMT-Master II", q: "GMT" },
]

function formatPrice(price: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(price)
}

function ResultIcon({ type }: { type: SearchResult["type"] }) {
  const cls = "shrink-0 w-4 h-4"
  if (type === "ref") return <Hash className={cls} style={{ color: "#10b981" }} />
  if (type === "brand") return <Store className={cls} style={{ color: "#2081E2" }} />
  if (type === "dealer") return <Store className={cls} style={{ color: "#f59e0b" }} />
  return <TrendingUp className={cls} style={{ color: "var(--ow-text-dim)" }} />
}

export default function CommandSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<EnrichedResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("ow_recent_searches") ?? "[]")
      setRecentSearches(stored.slice(0, 4))
    } catch {}
  }, [])

  // ⌘K global shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      if (e.key === "Escape") {
        setOpen(false)
        setQuery("")
        setResults([])
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults((data.results ?? []) as EnrichedResult[])
      setActiveIdx(-1)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(() => doSearch(query), 200)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, doSearch])

  function saveRecent(q: string) {
    try {
      const prev = JSON.parse(localStorage.getItem("ow_recent_searches") ?? "[]") as string[]
      const updated = [q, ...prev.filter((x) => x !== q)].slice(0, 6)
      localStorage.setItem("ow_recent_searches", JSON.stringify(updated))
      setRecentSearches(updated.slice(0, 4))
    } catch {}
  }

  function navigate(href: string, label?: string) {
    if (label) saveRecent(label)
    setOpen(false)
    setQuery("")
    setResults([])
    router.push(href)
  }

  // Keyboard navigation
  function onKeyDown(e: React.KeyboardEvent) {
    const total = results.length
    if (!total) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, total - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, -1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (activeIdx >= 0 && results[activeIdx]) {
        navigate(results[activeIdx].href, results[activeIdx].title)
      } else if (query.trim()) {
        navigate(`/network?q=${encodeURIComponent(query.trim())}`, query.trim())
      }
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return
    const item = listRef.current.querySelector(`[data-idx="${activeIdx}"]`) as HTMLElement | null
    item?.scrollIntoView({ block: "nearest" })
  }, [activeIdx])

  const showDropdown = open && (query.length > 0 || recentSearches.length > 0)

  return (
    <div className="relative flex-1 max-w-[520px]">
      {/* ── Input ── */}
      <div
        className={cn(
          "relative transition-all duration-150",
          open && "ring-2 ring-[#2081E2]/40 rounded-lg"
        )}
      >
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10"
          style={{ color: open ? "#2081E2" : "#8A939B" }}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search watches, refs, brands… (⌘K)"
          className="w-full h-9 pl-9 pr-16 rounded-lg text-sm focus:outline-none transition-all duration-150"
          style={{
            backgroundColor: "#1E1E2E",
            border: `1px solid ${open ? "#2081E2" : "#333333"}`,
            color: "var(--foreground)",
          }}
        />
        {/* Loading / shortcut hint */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {loading ? (
            <Loader2 size={12} className="animate-spin" style={{ color: "var(--ow-text-dim)" }} />
          ) : !open ? (
            <kbd
              className="text-[10px] px-1.5 py-0.5 rounded font-mono"
              style={{ background: "#2a2a3a", color: "var(--ow-text-dim)", border: "1px solid #333" }}
            >
              ⌘K
            </kbd>
          ) : null}
        </div>
      </div>

      {/* ── Backdrop ── */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => { setOpen(false); setQuery(""); setResults([]) }}
        />
      )}

      {/* ── Dropdown ── */}
      {showDropdown && (
        <div
          className="absolute top-full left-0 right-0 mt-1.5 rounded-xl overflow-hidden z-50 shadow-2xl"
          style={{
            background: "var(--ow-bg-card)",
            border: "1px solid var(--ow-border)",
            maxHeight: "480px",
            overflowY: "auto",
          }}
          ref={listRef}
        >
          {/* Results */}
          {results.length > 0 && (
            <div className="p-1">
              {results.map((r, i) => (
                <button
                  key={r.id}
                  data-idx={i}
                  onClick={() => navigate(r.href, r.title)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                    activeIdx === i ? "bg-[var(--ow-border)]" : "hover:bg-[var(--ow-bg-elevated)]"
                  )}
                >
                  {/* Thumbnail or icon */}
                  {r.image ? (
                    <img
                      src={r.image}
                      alt=""
                      className="w-9 h-9 rounded-md object-cover shrink-0"
                      style={{ background: "var(--ow-bg)" }}
                    />
                  ) : (
                    <div
                      className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
                      style={{ background: "var(--ow-bg-elevated)" }}
                    >
                      <ResultIcon type={r.type} />
                    </div>
                  )}

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium truncate" style={{ color: "var(--ow-text)" }}>
                        {r.title}
                      </span>
                      {r.badge && (
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                          style={{
                            background: `${r.badgeColor}22`,
                            color: r.badgeColor,
                            border: `1px solid ${r.badgeColor}44`,
                          }}
                        >
                          {r.badge}
                        </span>
                      )}
                      {/* Trend badge */}
                      {r.trend_pct !== undefined && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                          style={{
                            background: r.trend_pct >= 0 ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                            color: r.trend_pct >= 0 ? "#10b981" : "#ef4444",
                          }}
                        >
                          {r.trend_pct >= 0 ? "↑" : "↓"} {Math.abs(r.trend_pct).toFixed(1)}%
                        </span>
                      )}
                      {/* ARB badge */}
                      {r.has_arbitrage && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}
                        >
                          <Zap size={9} />ARB
                        </span>
                      )}
                    </div>
                    <div className="text-xs truncate mt-0.5" style={{ color: "var(--ow-text-dim)" }}>
                      {r.subtitle}
                    </div>
                  </div>

                  {/* Price */}
                  {r.price && (
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold" style={{ color: "#10b981" }}>
                        {formatPrice(r.price, r.currency)}
                      </div>
                    </div>
                  )}

                  <ArrowRight size={12} className="shrink-0 opacity-0 group-hover:opacity-100" style={{ color: "var(--ow-text-dim)" }} />
                </button>
              ))}
            </div>
          )}

          {/* Empty state */}
          {query.length >= 2 && !loading && results.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm" style={{ color: "var(--ow-text-dim)" }}>No results for &ldquo;{query}&rdquo;</p>
              <button
                onClick={() => navigate(`/network?q=${encodeURIComponent(query)}`, query)}
                className="mt-2 text-xs underline transition-colors"
                style={{ color: "#2081E2" }}
              >
                Search all listings →
              </button>
            </div>
          )}

          {/* Recent searches (shown when input is empty) */}
          {query.length === 0 && recentSearches.length > 0 && (
            <div className="p-1">
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--ow-text-dim)" }}>
                Recent
              </div>
              {recentSearches.map((s) => (
                <button
                  key={s}
                  onClick={() => { setQuery(s); inputRef.current?.focus() }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--ow-bg-elevated)] text-left transition-colors"
                >
                  <Clock size={13} className="shrink-0" style={{ color: "var(--ow-text-dim)" }} />
                  <span className="text-sm" style={{ color: "var(--ow-text-muted)" }}>{s}</span>
                </button>
              ))}
            </div>
          )}

          {/* Popular searches (shown when input is empty and no recent) */}
          {query.length === 0 && recentSearches.length === 0 && (
            <div className="p-1">
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--ow-text-dim)" }}>
                Popular
              </div>
              {POPULAR.map((p) => (
                <button
                  key={p.q}
                  onClick={() => { setQuery(p.q); inputRef.current?.focus() }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--ow-bg-elevated)] text-left transition-colors"
                >
                  <TrendingUp size={13} className="shrink-0" style={{ color: "var(--ow-text-dim)" }} />
                  <span className="text-sm" style={{ color: "var(--ow-text-muted)" }}>{p.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Quick-action shortcuts */}
          <div
            className="flex items-center gap-2 px-3 py-2"
            style={{ borderTop: "1px solid var(--ow-border)" }}
          >
            <button
              onClick={() => navigate("/analytics")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors hover:opacity-80"
              style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}
            >
              🔥 View Hot Trends
            </button>
            <button
              onClick={() => navigate("/analytics?tab=arbitrage")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors hover:opacity-80"
              style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}
            >
              <Zap size={11} /> Arbitrage Opportunities
            </button>
          </div>

          {/* Footer hint */}
          {results.length > 0 && (
            <div
              className="flex items-center gap-3 px-3 py-2 text-[10px]"
              style={{ borderTop: "1px solid var(--ow-border)", color: "var(--ow-text-dim)" }}
            >
              <span><kbd className="font-mono">↑↓</kbd> navigate</span>
              <span><kbd className="font-mono">↵</kbd> open</span>
              <span><kbd className="font-mono">esc</kbd> close</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
