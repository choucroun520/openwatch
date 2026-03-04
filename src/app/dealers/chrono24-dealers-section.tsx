"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ExternalLink } from "lucide-react"
import type { Chrono24Dealer } from "@/lib/types"

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "never"
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return "just now"
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

interface DealerWithStats extends Chrono24Dealer {
  market_listing_count?: number
  brands_carried?: string[]
  avg_price?: number | null
}

export default function Chrono24DealersSection() {
  const [dealers, setDealers] = useState<DealerWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [slugInput, setSlugInput] = useState("")
  const [scraping, setScraping] = useState<string | null>(null)
  const [scrapeMsg, setScrapeMsg] = useState("")

  async function fetchDealers() {
    try {
      // Try the new /api/dealers endpoint first (includes market stats)
      const res = await fetch("/api/dealers")
      if (res.ok) {
        const json = await res.json()
        setDealers(json.dealers ?? [])
        return
      }
      // Fall back to chrono24/dealers
      const res2 = await fetch("/api/chrono24/dealers")
      const json2 = await res2.json()
      setDealers(json2.dealers ?? [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDealers()
  }, [])

  async function handleAddDealer(e: React.FormEvent) {
    e.preventDefault()
    const slug = slugInput.trim()
    if (!slug) return
    setScraping(slug)
    setScrapeMsg("")

    try {
      const res = await fetch("/api/chrono24/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      })
      const json = await res.json()
      if (json.started) {
        setScrapeMsg(`Scrape started for "${slug}". Refresh in ~2 min to see results.`)
        setSlugInput("")
        setTimeout(() => fetchDealers(), 5000)
      } else {
        setScrapeMsg(json.error ?? "Unknown error")
      }
    } catch (err) {
      setScrapeMsg(err instanceof Error ? err.message : "Network error")
    } finally {
      setScraping(null)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-black text-white">Tracked Market Dealers</h2>
          <p className="text-sm mt-1" style={{ color: "#8A939B" }}>
            Chrono24 dealer inventories tracked for market intelligence
          </p>
        </div>

        {/* Add Dealer form */}
        <form onSubmit={handleAddDealer} className="flex items-center gap-2">
          <input
            type="text"
            value={slugInput}
            onChange={e => setSlugInput(e.target.value)}
            placeholder="Chrono24 dealer slug"
            className="px-3 py-2 rounded-lg text-sm text-white placeholder-gray-500 outline-none focus:ring-1"
            style={{ background: "#1E1E2E", border: "1px solid #333333", minWidth: 200 }}
            disabled={!!scraping}
          />
          <button
            type="submit"
            disabled={!slugInput.trim() || !!scraping}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: "#2081E2" }}
          >
            {scraping ? "Starting…" : "Add Dealer"}
          </button>
        </form>
      </div>

      {scrapeMsg && (
        <p
          className="mb-4 text-sm px-4 py-2 rounded-lg"
          style={{
            background: scrapeMsg.includes("started") ? "rgba(34,197,94,0.1)" : "rgba(235,87,87,0.1)",
            color: scrapeMsg.includes("started") ? "#34C759" : "#EB5757",
            border: `1px solid ${scrapeMsg.includes("started") ? "rgba(34,197,94,0.2)" : "rgba(235,87,87,0.2)"}`,
          }}
        >
          {scrapeMsg}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-2xl h-52 animate-pulse" style={{ background: "#1E1E2E" }} />
          ))}
        </div>
      ) : dealers.length === 0 ? (
        <div style={{ border: "1px dashed #333333", borderRadius: 12, padding: "48px 24px", textAlign: "center" }}>
          <p style={{ color: "#8A939B", fontWeight: 600, marginBottom: 4, fontSize: 14 }}>
            Dealer intelligence database is being built
          </p>
          <p style={{ color: "#555", fontSize: 13 }}>
            Run the Chrono24 dealer scraper to populate. Example:{" "}
            <code className="font-mono" style={{ color: "#2081E2" }}>jewelsintimeofboca</code>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dealers.map(dealer => (
            <div
              key={dealer.id}
              className="rounded-2xl p-6"
              style={{ background: "#1E1E2E", border: "1px solid #333333" }}
            >
              <div className="flex items-start gap-3 mb-4">
                {/* Chrono24 "C24" avatar */}
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-xs shrink-0"
                  style={{ background: "linear-gradient(135deg, #e67e00, #b35a00)" }}
                >
                  C24
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-white leading-tight truncate">{dealer.name}</h3>
                  {dealer.country && (
                    <p className="text-xs mt-0.5" style={{ color: "#8A939B" }}>{dealer.country}</p>
                  )}
                  <p className="text-xs mt-0.5 font-mono" style={{ color: "#555" }}>
                    ID: {dealer.merchant_id}
                  </p>
                </div>
              </div>

              <div className="flex gap-4 mb-3">
                <div>
                  <p className="text-lg font-black font-mono text-white">
                    {(dealer.market_listing_count ?? dealer.total_listings).toLocaleString()}
                  </p>
                  <p className="text-[11px]" style={{ color: "#8A939B" }}>
                    {dealer.market_listing_count !== undefined ? "In market data" : "Listings"}
                  </p>
                </div>
                <div>
                  <p className="text-lg font-black font-mono" style={{ color: "#8A939B" }}>
                    {timeAgo(dealer.last_scraped_at)}
                  </p>
                  <p className="text-[11px]" style={{ color: "#8A939B" }}>Last scraped</p>
                </div>
              </div>

              {/* Brands carried */}
              {dealer.brands_carried && dealer.brands_carried.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {dealer.brands_carried.slice(0, 4).map(b => (
                    <span
                      key={b}
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(32,129,226,0.1)", color: "#2081E2" }}
                    >
                      {b}
                    </span>
                  ))}
                  {dealer.brands_carried.length > 4 && (
                    <span className="text-[10px]" style={{ color: "var(--ow-text-dim)" }}>
                      +{dealer.brands_carried.length - 4} more
                    </span>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Link
                  href={`/dealers/${dealer.slug}`}
                  className="block w-full text-center py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: "#2081E2" }}
                >
                  View Inventory
                </Link>
                <div className="flex gap-2">
                  <a
                    href={`https://www.chrono24.com/dealer/${dealer.slug}/index.htm`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
                    style={{ background: "rgba(32,129,226,0.15)", color: "#2081E2", border: "1px solid rgba(32,129,226,0.2)" }}
                  >
                    C24 <ExternalLink size={12} />
                  </a>
                  <button
                    onClick={() => {
                      setScraping(dealer.slug)
                      setScrapeMsg("")
                      fetch("/api/chrono24/scrape", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ slug: dealer.slug }),
                      })
                        .then(r => r.json())
                        .then(json => {
                          if (json.started) setScrapeMsg(`Re-scrape started for "${dealer.slug}".`)
                          else setScrapeMsg(json.error ?? "Error")
                        })
                        .catch(err => setScrapeMsg(err.message))
                        .finally(() => setScraping(null))
                    }}
                    disabled={scraping === dealer.slug}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50 hover:opacity-80"
                    style={{ background: "#1a1a1a", border: "1px solid #333333" }}
                  >
                    {scraping === dealer.slug ? "…" : "↻"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
