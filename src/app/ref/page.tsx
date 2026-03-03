"use client"

import AppLayout from "@/components/layout/app-layout"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"

export default function RefSearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const ref = query.trim()
    if (ref) router.push(`/ref/${encodeURIComponent(ref)}`)
  }

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto pt-16 px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white mb-2">Search References</h1>
          <p className="text-sm" style={{ color: "#8A939B" }}>
            Enter a watch reference number to see floor prices, sold comps, and market trends.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="e.g. 126610LN, 5711/1A, 15202ST"
            className="flex-1 px-4 py-3 rounded-xl text-sm font-mono text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ background: "#111119", border: "1px solid #1c1c2a" }}
            autoFocus
          />
          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-white transition-opacity hover:opacity-80"
            style={{ background: "#2081E2" }}
          >
            <Search size={16} />
            Search
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-xs mb-3" style={{ color: "#64748b" }}>Popular references</p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              "126610LN", "126600", "116500LN", "126710BLRO",
              "5711/1A-011", "5726A", "15202ST.OO",
              "26240CE.OO", "26240ST.OO", "25600TN.OO",
              "RM 011", "RM 055",
            ].map(ref => (
              <button
                key={ref}
                onClick={() => router.push(`/ref/${encodeURIComponent(ref)}`)}
                className="px-3 py-1 rounded-lg text-xs font-mono font-bold transition-colors hover:opacity-80"
                style={{ background: "#111119", color: "#94a3b8", border: "1px solid #1c1c2a" }}
              >
                {ref}
              </button>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
