"use client"

import { useState, useMemo, useEffect } from "react"
import { Filter, LayoutGrid, List, X, SlidersHorizontal, ChevronRight, ChevronDown } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { EmptyState } from "@/components/shared/empty-state"
import ListingCard from "./listing-card"
import { ConditionBadge } from "@/components/shared/condition-badge"
import { VerifiedBadge } from "@/components/shared/verified-badge"
import { formatCurrency } from "@/lib/utils/currency"
import { shortTimeAgo } from "@/lib/utils/dates"
import { cn } from "@/lib/utils"
import { CONDITIONS } from "@/lib/constants"
import type { ListingWithRelations, Brand, MarketStats } from "@/lib/types"
import Link from "next/link"

interface NetworkGridProps {
  listings: ListingWithRelations[]
  brands: Brand[]
  initialBrand?: string | null
}

function FilterSidebar({
  listings,
  brands,
  activeBrand,
  setActiveBrand,
  activeModel,
  setActiveModel,
  activeDealerId,
  setActiveDealerId,
  conditionFilters,
  toggleCondition,
  hasBox,
  setHasBox,
  hasPapers,
  setHasPapers,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
  brandCounts,
  clearAll,
}: {
  listings: ListingWithRelations[]
  brands: Brand[]
  activeBrand: string | null
  setActiveBrand: (v: string | null) => void
  activeModel: string | null
  setActiveModel: (v: string | null) => void
  activeDealerId: string | null
  setActiveDealerId: (v: string | null) => void
  conditionFilters: string[]
  toggleCondition: (c: string) => void
  hasBox: boolean
  setHasBox: (v: boolean) => void
  hasPapers: boolean
  setHasPapers: (v: boolean) => void
  minPrice: string
  setMinPrice: (v: string) => void
  maxPrice: string
  setMaxPrice: (v: string) => void
  brandCounts: Map<string, number>
  clearAll: () => void
}) {
  const [expandedBrand, setExpandedBrand] = useState<string | null>(activeBrand)

  // Sync expandedBrand when activeBrand changes externally (e.g., clearAll)
  useEffect(() => {
    setExpandedBrand(activeBrand)
  }, [activeBrand])

  // Models grouped per brand slug — key: model name or ref number, value: count
  const modelsByBrand = useMemo(() => {
    const map = new Map<string, Map<string, number>>()
    for (const l of listings) {
      const brandSlug = l.brand.slug
      const modelKey = l.model?.name ?? l.reference_number
      if (!modelKey) continue
      if (!map.has(brandSlug)) map.set(brandSlug, new Map())
      const brandMap = map.get(brandSlug)!
      brandMap.set(modelKey, (brandMap.get(modelKey) ?? 0) + 1)
    }
    return map
  }, [listings])

  // Unique dealers derived from listings — RC Crown sorted first
  const dealers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number; isRC: boolean }>()
    for (const l of listings) {
      const id = l.dealer.id
      if (!map.has(id)) {
        const name = l.dealer.company_name ?? l.dealer.full_name ?? "Unknown"
        const isRC = name.toUpperCase().includes("RC")
        map.set(id, { id, name, count: 0, isRC })
      }
      map.get(id)!.count++
    }
    return [...map.values()].sort((a, b) => {
      if (a.isRC && !b.isRC) return -1
      if (!a.isRC && b.isRC) return 1
      return a.name.localeCompare(b.name)
    })
  }, [listings])

  const hasFilters =
    activeBrand !== null ||
    activeModel !== null ||
    activeDealerId !== null ||
    conditionFilters.length > 0 ||
    hasBox ||
    hasPapers ||
    minPrice !== "" ||
    maxPrice !== ""

  function handleBrandClick(slug: string | null) {
    if (slug === null) {
      setActiveBrand(null)
      setActiveModel(null)
      setExpandedBrand(null)
    } else {
      setActiveBrand(slug)
      setActiveModel(null)
      setExpandedBrand(slug)
    }
  }

  function handleChevronClick(e: React.MouseEvent, slug: string) {
    e.stopPropagation()
    setExpandedBrand((prev) => (prev === slug ? null : slug))
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#1c1c2a" }}>
        <span className="text-sm font-bold text-foreground flex items-center gap-2">
          <Filter size={14} />
          Filter
        </span>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="text-xs text-blue-400 hover:text-blue-300 font-semibold transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Status section */}
      <div className="px-4 py-3 border-b" style={{ borderColor: "#1c1c2a" }}>
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-2.5">Status</p>
        <div className="flex gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white">
            Active
          </span>
        </div>
      </div>

      {/* Brand section */}
      <div className="px-4 py-3 border-b" style={{ borderColor: "#1c1c2a" }}>
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-2.5">Brand</p>
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {/* All Brands */}
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <input
              type="radio"
              name="brand"
              checked={activeBrand === null}
              onChange={() => handleBrandClick(null)}
              className="accent-blue-500"
            />
            <span className="text-sm text-foreground flex-1 group-hover:text-blue-400 transition-colors">
              All Brands
            </span>
            <span className="text-xs text-muted-foreground">
              {brands.reduce((acc, b) => acc + (brandCounts.get(b.id) ?? 0), 0)}
            </span>
          </label>

          {brands.map((brand) => {
            const count = brandCounts.get(brand.id) ?? 0
            if (count === 0) return null
            const isActive = activeBrand === brand.slug
            const isExpanded = expandedBrand === brand.slug
            const models = modelsByBrand.get(brand.slug)

            return (
              <div key={brand.id}>
                {/* Brand row */}
                <div className="flex items-center gap-1">
                  <label className="flex items-center gap-2.5 cursor-pointer group flex-1 min-w-0">
                    <input
                      type="radio"
                      name="brand"
                      checked={isActive}
                      onChange={() => handleBrandClick(brand.slug)}
                      className="accent-blue-500 shrink-0"
                    />
                    <span className={cn(
                      "text-sm flex-1 truncate transition-colors",
                      isActive ? "text-blue-400 font-semibold" : "text-foreground group-hover:text-blue-400"
                    )}>
                      {brand.name}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">{count}</span>
                  </label>
                  {/* Chevron toggle */}
                  {models && models.size > 0 && (
                    <button
                      onClick={(e) => handleChevronClick(e, brand.slug)}
                      className="shrink-0 p-0.5 rounded hover:bg-bg-elevated transition-colors text-muted-foreground hover:text-foreground"
                      aria-label={isExpanded ? "Collapse models" : "Expand models"}
                    >
                      {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                  )}
                </div>

                {/* Model sub-list */}
                {isExpanded && models && models.size > 0 && (
                  <div className="ml-4 pl-3 border-l mt-1 space-y-1" style={{ borderColor: "#1c1c2a" }}>
                    {[...models.entries()]
                      .sort((a, b) => b[1] - a[1])
                      .map(([modelKey, modelCount]) => {
                        const isActiveModel = activeModel === modelKey
                        return (
                          <button
                            key={modelKey}
                            onClick={() => setActiveModel(isActiveModel ? null : modelKey)}
                            className="flex items-center gap-1.5 w-full text-left group py-0.5"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0 transition-colors"
                              style={{ background: isActiveModel ? "#2563eb" : "#374151" }}
                            />
                            <span className={cn(
                              "text-xs flex-1 truncate transition-colors",
                              isActiveModel
                                ? "text-blue-400 font-semibold"
                                : "text-muted-foreground group-hover:text-foreground"
                            )}>
                              {modelKey}
                            </span>
                            <span className="text-[11px] shrink-0" style={{ color: "#475569" }}>
                              {modelCount}
                            </span>
                          </button>
                        )
                      })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Dealer section */}
      {dealers.length > 0 && (
        <div className="px-4 py-3 border-b" style={{ borderColor: "#1c1c2a" }}>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-2.5">Dealer</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {/* All Dealers */}
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="radio"
                name="dealer"
                checked={activeDealerId === null}
                onChange={() => setActiveDealerId(null)}
                className="accent-blue-500"
              />
              <span className="text-sm text-foreground flex-1 group-hover:text-blue-400 transition-colors">
                All Dealers
              </span>
              <span className="text-xs text-muted-foreground">{listings.length}</span>
            </label>

            {dealers.map((dealer) => (
              <label key={dealer.id} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="radio"
                  name="dealer"
                  checked={activeDealerId === dealer.id}
                  onChange={() => setActiveDealerId(dealer.id)}
                  className="accent-blue-500"
                />
                <span className={cn(
                  "text-sm flex-1 truncate transition-colors",
                  activeDealerId === dealer.id
                    ? "text-blue-400"
                    : "text-foreground group-hover:text-blue-400",
                  dealer.isRC && "font-semibold"
                )}>
                  {dealer.isRC && (
                    <span className="mr-1" style={{ color: "#006039" }}>●</span>
                  )}
                  {dealer.name}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">{dealer.count}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Condition section */}
      <div className="px-4 py-3 border-b" style={{ borderColor: "#1c1c2a" }}>
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-2.5">Condition</p>
        <div className="space-y-1.5">
          {CONDITIONS.map((c) => (
            <label key={c} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={conditionFilters.includes(c)}
                onChange={() => toggleCondition(c)}
                className="accent-blue-500"
              />
              <span className="text-sm text-foreground group-hover:text-blue-400 transition-colors">{c}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Has Box / Has Papers */}
      <div className="px-4 py-3 border-b" style={{ borderColor: "#1c1c2a" }}>
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-2.5">Completeness</p>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Has Box</span>
            <Switch checked={hasBox} onCheckedChange={setHasBox} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Has Papers</span>
            <Switch checked={hasPapers} onCheckedChange={setHasPapers} />
          </div>
        </div>
      </div>

      {/* Price Range */}
      <div className="px-4 py-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-2.5">Price Range</p>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Min $"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="w-full h-8 px-2 rounded-lg text-sm text-foreground border placeholder:text-muted-foreground focus:outline-none"
            style={{ background: "#161622", borderColor: "#22222e" }}
          />
          <input
            type="number"
            placeholder="Max $"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-full h-8 px-2 rounded-lg text-sm text-foreground border placeholder:text-muted-foreground focus:outline-none"
            style={{ background: "#161622", borderColor: "#22222e" }}
          />
        </div>
      </div>
    </div>
  )
}

export default function NetworkGrid({ listings, brands, initialBrand }: NetworkGridProps) {
  const [activeBrand, setActiveBrand] = useState<string | null>(initialBrand ?? null)
  const [activeModel, setActiveModel] = useState<string | null>(null)
  const [activeDealerId, setActiveDealerId] = useState<string | null>(null)
  const [conditionFilters, setConditionFilters] = useState<string[]>([])
  const [hasBox, setHasBox] = useState(false)
  const [hasPapers, setHasPapers] = useState(false)
  const [minPrice, setMinPrice] = useState<string>("")
  const [maxPrice, setMaxPrice] = useState<string>("")
  const [sort, setSort] = useState<string>("newest")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [marketStats, setMarketStats] = useState<Record<string, MarketStats>>({})

  // Fetch market stats for all listing refs
  useEffect(() => {
    const refs = [
      ...new Set(
        listings.map((l) => l.reference_number).filter(Boolean)
      ),
    ] as string[]
    if (refs.length === 0) return

    fetch(`/api/market/stats?refs=${refs.join(",")}`)
      .then((r) => r.json())
      .then((data) => setMarketStats(data))
      .catch(() => {}) // market stats are optional — fail silently
  }, [listings])

  // Brand count map (keyed by brand.id)
  const brandCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const l of listings) {
      map.set(l.brand_id, (map.get(l.brand_id) ?? 0) + 1)
    }
    return map
  }, [listings])

  function toggleCondition(c: string) {
    setConditionFilters((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    )
  }

  function clearAll() {
    setActiveBrand(null)
    setActiveModel(null)
    setActiveDealerId(null)
    setConditionFilters([])
    setHasBox(false)
    setHasPapers(false)
    setMinPrice("")
    setMaxPrice("")
  }

  // Active filter chips
  const activeChips: { label: string; onRemove: () => void }[] = []
  if (activeBrand) {
    const brandName = brands.find((b) => b.slug === activeBrand)?.name ?? activeBrand
    activeChips.push({
      label: brandName,
      onRemove: () => { setActiveBrand(null); setActiveModel(null) },
    })
  }
  if (activeModel) {
    activeChips.push({ label: activeModel, onRemove: () => setActiveModel(null) })
  }
  if (activeDealerId) {
    const dealerListing = listings.find((l) => l.dealer.id === activeDealerId)
    const dealerName = dealerListing
      ? (dealerListing.dealer.company_name ?? dealerListing.dealer.full_name ?? "Dealer")
      : "Dealer"
    activeChips.push({ label: dealerName, onRemove: () => setActiveDealerId(null) })
  }
  for (const c of conditionFilters) {
    const _c = c
    activeChips.push({ label: _c, onRemove: () => toggleCondition(_c) })
  }
  if (hasBox) activeChips.push({ label: "Has Box", onRemove: () => setHasBox(false) })
  if (hasPapers) activeChips.push({ label: "Has Papers", onRemove: () => setHasPapers(false) })

  // Filtering + sorting
  const filtered = useMemo(() => {
    let result = [...listings]

    if (activeBrand) {
      result = result.filter((l) => l.brand.slug === activeBrand)
    }
    if (activeModel) {
      result = result.filter(
        (l) => l.model?.name === activeModel || l.reference_number === activeModel
      )
    }
    if (activeDealerId) {
      result = result.filter((l) => l.dealer.id === activeDealerId)
    }
    if (conditionFilters.length > 0) {
      result = result.filter((l) => l.condition != null && conditionFilters.includes(l.condition))
    }
    if (hasBox) {
      result = result.filter((l) => l.has_box)
    }
    if (hasPapers) {
      result = result.filter((l) => l.has_papers)
    }
    if (minPrice) {
      const min = parseFloat(minPrice)
      if (!isNaN(min)) {
        result = result.filter((l) => parseFloat(l.wholesale_price) >= min)
      }
    }
    if (maxPrice) {
      const max = parseFloat(maxPrice)
      if (!isNaN(max)) {
        result = result.filter((l) => parseFloat(l.wholesale_price) <= max)
      }
    }

    switch (sort) {
      case "newest":
        result.sort(
          (a, b) =>
            new Date(b.listed_at).getTime() - new Date(a.listed_at).getTime()
        )
        break
      case "price-asc":
        result.sort(
          (a, b) => parseFloat(a.wholesale_price) - parseFloat(b.wholesale_price)
        )
        break
      case "price-desc":
        result.sort(
          (a, b) => parseFloat(b.wholesale_price) - parseFloat(a.wholesale_price)
        )
        break
      case "oldest":
        result.sort(
          (a, b) =>
            new Date(a.listed_at).getTime() - new Date(b.listed_at).getTime()
        )
        break
    }

    return result
  }, [listings, activeBrand, activeModel, activeDealerId, conditionFilters, hasBox, hasPapers, minPrice, maxPrice, sort])

  const sidebarProps = {
    listings,
    brands,
    activeBrand,
    setActiveBrand,
    activeModel,
    setActiveModel,
    activeDealerId,
    setActiveDealerId,
    conditionFilters,
    toggleCondition,
    hasBox,
    setHasBox,
    hasPapers,
    setHasPapers,
    minPrice,
    setMinPrice,
    maxPrice,
    setMaxPrice,
    brandCounts,
    clearAll,
  }

  return (
    <div className="flex gap-0 -mx-4">
      {/* ── DESKTOP SIDEBAR ── */}
      {sidebarOpen && (
        <aside
          className="hidden lg:block w-64 shrink-0 border-r self-start sticky top-[73px] max-h-[calc(100vh-73px)] overflow-y-auto"
          style={{ borderColor: "#1c1c2a" }}
        >
          <FilterSidebar {...sidebarProps} />
        </aside>
      )}

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 min-w-0 px-4 lg:px-6 py-5">
        {/* Top control bar */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          {/* Sidebar toggle (desktop) */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors hover:bg-bg-elevated"
            style={{ borderColor: "#1c1c2a", color: "#94a3b8" }}
          >
            <SlidersHorizontal size={14} />
            {sidebarOpen ? "Hide" : "Filters"}
          </button>

          {/* Mobile filter sheet */}
          <Sheet>
            <SheetTrigger asChild>
              <button
                className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors"
                style={{ borderColor: "#1c1c2a", color: "#94a3b8" }}
              >
                <Filter size={14} />
                Filters
                {activeChips.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {activeChips.length}
                  </span>
                )}
              </button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-72 p-0 overflow-y-auto"
              style={{ background: "#111119", borderColor: "#1c1c2a" }}
            >
              <FilterSidebar {...sidebarProps} />
            </SheetContent>
          </Sheet>

          {/* Item count */}
          <span className="text-sm font-bold text-foreground">
            {filtered.length} {filtered.length === 1 ? "watch" : "watches"}
          </span>

          {/* Active filter chips */}
          {activeChips.map((chip) => (
            <span
              key={chip.label}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border"
              style={{ background: "rgba(37,99,235,0.1)", borderColor: "rgba(37,99,235,0.3)", color: "#60a5fa" }}
            >
              {chip.label}
              <button onClick={chip.onRemove} className="hover:text-white transition-colors ml-0.5">
                <X size={10} />
              </button>
            </span>
          ))}

          {/* Sort + View toggle — right side */}
          <div className="flex items-center gap-2 ml-auto">
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-40 h-8 text-sm" style={{ background: "#161622", borderColor: "#22222e" }}>
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent style={{ background: "#111119", borderColor: "#1c1c2a" }}>
                <SelectItem value="newest">Recently Listed</SelectItem>
                <SelectItem value="price-asc">Price: Low → High</SelectItem>
                <SelectItem value="price-desc">Price: High → Low</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: "#22222e" }}>
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-1.5 transition-colors",
                  viewMode === "grid" ? "bg-blue-600 text-white" : "text-muted-foreground hover:text-foreground"
                )}
                style={viewMode !== "grid" ? { background: "#161622" } : undefined}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "p-1.5 transition-colors",
                  viewMode === "list" ? "bg-blue-600 text-white" : "text-muted-foreground hover:text-foreground"
                )}
                style={viewMode !== "list" ? { background: "#161622" } : undefined}
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Grid / List */}
        {filtered.length === 0 ? (
          <EmptyState
            heading="No watches found"
            subtext="Try adjusting your filters or check back later."
          />
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                marketStats={l.reference_number ? marketStats[l.reference_number] : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#1c1c2a" }}>
            {/* List header */}
            <div
              className="grid grid-cols-12 gap-3 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground"
              style={{ background: "#0b0b14" }}
            >
              <div className="col-span-1" />
              <div className="col-span-4">Watch</div>
              <div className="col-span-2">Ref</div>
              <div className="col-span-2">Condition</div>
              <div className="col-span-1 text-center">Box/Papers</div>
              <div className="col-span-2 text-right">Price</div>
            </div>

            {filtered.map((l) => (
              l.source === 'chrono24' && l.external_url ? (
              <a
                key={l.id}
                href={l.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="grid grid-cols-12 gap-3 px-4 py-3 border-t items-center hover:bg-bg-elevated transition-colors"
                style={{ borderColor: "#1c1c2a" }}
              >
                {/* Watch icon */}
                <div
                  className="col-span-1 w-10 h-10 rounded-lg flex items-center justify-center relative"
                  style={{ background: l.brand.banner_gradient ?? "linear-gradient(135deg, #1e3a5f, #111119)" }}
                >
                  <span className="text-base">⌚</span>
                  <span className="absolute -top-1 -right-1 text-[8px] px-1 rounded font-black text-white" style={{ background: "rgba(32,129,226,0.9)" }}>C24</span>
                </div>

                {/* Brand + Model */}
                <div className="col-span-4 min-w-0">
                  <p className="text-xs text-blue-400 font-medium">{l.brand.name}</p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {l.model?.name ?? l.notes?.slice(0, 40) ?? "Watch"}
                  </p>
                </div>

                {/* Ref */}
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground font-mono truncate">{l.reference_number ?? "—"}</p>
                  {l.year && <p className="text-xs text-muted-foreground">{l.year}</p>}
                </div>

                {/* Condition */}
                <div className="col-span-2">
                  {l.condition
                    ? <ConditionBadge condition={l.condition} />
                    : <span className="text-xs text-muted-foreground">—</span>
                  }
                </div>

                {/* Box/Papers */}
                <div className="col-span-1 text-center">
                  {l.has_box && l.has_papers ? (
                    <span className="text-green-400 text-xs font-bold">Full</span>
                  ) : l.has_box ? (
                    <span className="text-yellow-400 text-xs">Box</span>
                  ) : l.has_papers ? (
                    <span className="text-blue-400 text-xs">Papers</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </div>

                {/* Price */}
                <div className="col-span-2 text-right">
                  <p className="text-sm font-black font-mono text-foreground">
                    {parseFloat(l.wholesale_price) > 0 ? formatCurrency(l.wholesale_price) : "P.O.R."}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{shortTimeAgo(l.listed_at)}</p>
                </div>
              </a>
              ) : (
              <Link
                key={l.id}
                href={`/listing/${l.id}`}
                className="grid grid-cols-12 gap-3 px-4 py-3 border-t items-center hover:bg-bg-elevated transition-colors"
                style={{ borderColor: "#1c1c2a" }}
              >
                {/* Watch icon */}
                <div
                  className="col-span-1 w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: l.brand.banner_gradient ?? "linear-gradient(135deg, #1e3a5f, #111119)" }}
                >
                  <span className="text-base">⌚</span>
                </div>

                {/* Brand + Model */}
                <div className="col-span-4 min-w-0">
                  <p className="text-xs text-blue-400 font-medium">{l.brand.name}</p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {l.model?.name ?? l.notes?.slice(0, 40) ?? "Watch"}
                  </p>
                </div>

                {/* Ref */}
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground font-mono truncate">{l.reference_number ?? "—"}</p>
                  {l.year && <p className="text-xs text-muted-foreground">{l.year}</p>}
                </div>

                {/* Condition */}
                <div className="col-span-2">
                  {l.condition
                    ? <ConditionBadge condition={l.condition} />
                    : <span className="text-xs text-muted-foreground">—</span>
                  }
                </div>

                {/* Box/Papers */}
                <div className="col-span-1 text-center">
                  {l.has_box && l.has_papers ? (
                    <span className="text-green-400 text-xs font-bold">Full</span>
                  ) : l.has_box ? (
                    <span className="text-yellow-400 text-xs">Box</span>
                  ) : l.has_papers ? (
                    <span className="text-blue-400 text-xs">Papers</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </div>

                {/* Price */}
                <div className="col-span-2 text-right">
                  <p className="text-sm font-black font-mono text-foreground">
                    {parseFloat(l.wholesale_price) > 0 ? formatCurrency(l.wholesale_price) : "P.O.R."}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{shortTimeAgo(l.listed_at)}</p>
                </div>
              </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
