import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import TopNav from "@/components/layout/top-nav"
import { BrandAvatar } from "@/components/shared/brand-avatar"
import { VerifiedBadge } from "@/components/shared/verified-badge"
import { Sparkline } from "@/components/charts/sparkline"
import { formatCurrency } from "@/lib/utils/currency"
import type { Brand } from "@/lib/types"

export const metadata = { title: "Rankings — OpenWatch" }

export const dynamic = "force-dynamic"

export default async function RankingsPage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Fetch all brands
  const { data: brands } = await db
    .from("brands")
    .select("*")
    .is("deleted_at", null)
    .order("name")

  // Fetch active listings (price + brand_id + dealer_id)
  const { data: allListings } = await db
    .from("listings")
    .select("brand_id, wholesale_price, dealer_id, listed_at")
    .eq("status", "active")
    .is("deleted_at", null)

  // Fetch sold listings for volume
  const { data: soldListings } = await db
    .from("listings")
    .select("brand_id, wholesale_price, sold_at")
    .eq("status", "sold")
    .is("deleted_at", null)

  // Compute stats per brand
  type BrandStats = {
    brand: Brand
    rank: number
    floorPrice: number
    avgPrice: number
    ceilPrice: number
    listedCount: number
    dealerCount: number
    soldVolume: number
    sparkData: number[]
  }

  const brandMap = new Map<string, Brand>()
  for (const b of brands ?? []) {
    brandMap.set(b.id, b as Brand)
  }

  const statsMap = new Map<
    string,
    {
      prices: number[]
      dealerIds: Set<string>
      soldPrices: number[]
      dailyPrices: Map<string, number[]>
    }
  >()

  for (const l of allListings ?? []) {
    if (!statsMap.has(l.brand_id)) {
      statsMap.set(l.brand_id, {
        prices: [],
        dealerIds: new Set(),
        soldPrices: [],
        dailyPrices: new Map(),
      })
    }
    const s = statsMap.get(l.brand_id)!
    const p = parseFloat(l.wholesale_price)
    if (p > 0) s.prices.push(p)
    if (l.dealer_id) s.dealerIds.add(l.dealer_id)

    // Group by week for sparkline
    const week = new Date(l.listed_at).toISOString().slice(0, 10)
    if (!s.dailyPrices.has(week)) s.dailyPrices.set(week, [])
    if (p > 0) s.dailyPrices.get(week)!.push(p)
  }

  for (const l of soldListings ?? []) {
    if (!statsMap.has(l.brand_id)) continue
    const p = parseFloat(l.wholesale_price)
    if (p > 0) statsMap.get(l.brand_id)!.soldPrices.push(p)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brandStats: BrandStats[] = ((brands ?? []) as any[])
    .map((brand: any, i: number) => {
      const s = statsMap.get(brand.id)
      const prices = s?.prices ?? []
      const soldPrices = s?.soldPrices ?? []
      const dailyPrices = s?.dailyPrices ?? new Map()

      // Sparkline: last 7 data points (floor prices by day)
      const sparkData = Array.from(dailyPrices.values())
        .slice(-7)
        .map((pts) => Math.min(...pts))

      return {
        brand: brand as Brand,
        rank: i + 1,
        floorPrice: prices.length ? Math.min(...prices) : 0,
        avgPrice: prices.length ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length : 0,
        ceilPrice: prices.length ? Math.max(...prices) : 0,
        listedCount: prices.length > 0 ? s?.prices.length ?? 0 : (s ? s.prices.length + s.soldPrices.length : 0),
        dealerCount: s?.dealerIds.size ?? 0,
        soldVolume: soldPrices.reduce((a: number, b: number) => a + b, 0),
        sparkData,
      }
    })
    .filter((b: BrandStats) => {
      const s = statsMap.get(b.brand.id)
      return (s?.prices.length ?? 0) > 0 || (s?.soldPrices.length ?? 0) > 0
    })
    .sort((a: BrandStats, b: BrandStats) => b.listedCount - a.listedCount)
    .map((b: BrandStats, i: number) => ({ ...b, rank: i + 1 }))

  return (
    <div className="min-h-screen" style={{ background: "#0b0b14" }}>
      <TopNav />

      <div className="max-w-[1400px] mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-foreground">Brand Rankings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ranked by active listings · Updated in real time
          </p>
        </div>

        {/* Rankings table */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#1c1c2a" }}>
          {/* Header */}
          <div
            className="grid items-center gap-4 px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground"
            style={{
              background: "#0b0b14",
              gridTemplateColumns: "40px 1fr 120px 120px 100px 80px 80px 80px",
            }}
          >
            <div className="text-center">#</div>
            <div>Brand</div>
            <div className="text-right">Floor Price</div>
            <div className="text-right">Avg Price</div>
            <div className="text-right">Volume</div>
            <div className="text-right">Listed</div>
            <div className="text-right">Dealers</div>
            <div className="text-right">Trend</div>
          </div>

          {brandStats.length === 0 && (
            <div
              className="px-4 py-12 text-center text-sm text-muted-foreground border-t"
              style={{ borderColor: "#1c1c2a" }}
            >
              No brand data available yet.
            </div>
          )}

          {brandStats.map((bs) => (
            <Link
              key={bs.brand.id}
              href={`/collection/${bs.brand.slug}`}
              className="grid items-center gap-4 px-4 py-4 border-t hover:bg-bg-elevated transition-colors group"
              style={{
                borderColor: "#1c1c2a",
                gridTemplateColumns: "40px 1fr 120px 120px 100px 80px 80px 80px",
              }}
            >
              {/* Rank */}
              <div className="text-center">
                <span
                  className="text-sm font-black"
                  style={{ color: bs.rank <= 3 ? "#eab308" : "#475569" }}
                >
                  {bs.rank}
                </span>
              </div>

              {/* Brand */}
              <div className="flex items-center gap-3 min-w-0">
                <BrandAvatar brandName={bs.brand.name} size="md" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-sm text-foreground group-hover:text-blue-400 transition-colors truncate">
                      {bs.brand.name}
                    </span>
                    {bs.brand.verified && <VerifiedBadge size="sm" />}
                  </div>
                  {bs.brand.headquarters && (
                    <p className="text-xs text-muted-foreground">{bs.brand.headquarters}</p>
                  )}
                </div>
              </div>

              {/* Floor */}
              <div className="text-right">
                <span className="text-sm font-bold font-mono text-foreground">
                  {bs.floorPrice > 0 ? formatCurrency(bs.floorPrice) : "—"}
                </span>
              </div>

              {/* Avg */}
              <div className="text-right">
                <span className="text-sm font-mono text-muted-foreground">
                  {bs.avgPrice > 0 ? formatCurrency(bs.avgPrice) : "—"}
                </span>
              </div>

              {/* Volume */}
              <div className="text-right">
                <span className="text-sm font-mono text-muted-foreground">
                  {bs.soldVolume > 0 ? formatCurrency(bs.soldVolume, "USD", true) : "—"}
                </span>
              </div>

              {/* Listed */}
              <div className="text-right">
                <span className="text-sm font-bold text-foreground">{bs.listedCount}</span>
              </div>

              {/* Dealers */}
              <div className="text-right">
                <span className="text-sm text-muted-foreground">{bs.dealerCount}</span>
              </div>

              {/* Sparkline */}
              <div className="flex justify-end">
                {bs.sparkData.length >= 2 ? (
                  <Sparkline data={bs.sparkData} width={64} height={28} />
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            </Link>
          ))}
        </div>

        {/* Summary stats */}
        {brandStats.length > 0 && (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: "Total Brands",
                value: brandStats.length.toString(),
              },
              {
                label: "Total Listings",
                value: brandStats.reduce((a, b) => a + b.listedCount, 0).toString(),
              },
              {
                label: "Total Dealers",
                value: brandStats.reduce((a, b) => a + b.dealerCount, 0).toString(),
              },
              {
                label: "Total Volume",
                value: formatCurrency(brandStats.reduce((a, b) => a + b.soldVolume, 0), "USD", true),
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border p-4 text-center"
                style={{ background: "#111119", borderColor: "#1c1c2a" }}
              >
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{s.label}</p>
                <p className="text-xl font-black font-mono text-foreground mt-1">{s.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
