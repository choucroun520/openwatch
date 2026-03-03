import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [
    totalListingsResult,
    totalSoldResult,
    refsResult,
    lastUpdatedResult,
    heatResult,
  ] = await Promise.all([
    // Total active listings
    db.from("market_data")
      .select("id", { count: "exact", head: true })
      .eq("is_sold", false),

    // Total confirmed sales (90d)
    db.from("market_data")
      .select("id", { count: "exact", head: true })
      .eq("is_sold", true)
      .gte("scraped_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()),

    // Distinct refs tracked
    db.from("market_data")
      .select("ref_number"),

    // Last data update
    db.from("market_data")
      .select("scraped_at")
      .order("scraped_at", { ascending: false })
      .limit(1),

    // Top brands from heat index
    db.from("ref_heat_index")
      .select("brand, avg_price, price_change_30d, heat_score, total_listings, total_sold_90d"),
  ])

  const refsTracked = new Set(
    (refsResult.data ?? []).map((r: { ref_number: string }) => r.ref_number)
  ).size

  // Aggregate brand stats
  const brandMap = new Map<string, {
    brand: string
    avg_prices: number[]
    price_changes: number[]
    heat_scores: number[]
    listings: number
    sold: number
  }>()

  for (const row of heatResult.data ?? []) {
    if (!row.brand) continue
    if (!brandMap.has(row.brand)) {
      brandMap.set(row.brand, {
        brand: row.brand,
        avg_prices: [],
        price_changes: [],
        heat_scores: [],
        listings: 0,
        sold: 0,
      })
    }
    const entry = brandMap.get(row.brand)!
    if (row.avg_price) entry.avg_prices.push(parseFloat(row.avg_price))
    if (row.price_change_30d !== null) entry.price_changes.push(parseFloat(row.price_change_30d))
    if (row.heat_score !== null) entry.heat_scores.push(parseFloat(row.heat_score))
    entry.listings += row.total_listings ?? 0
    entry.sold += row.total_sold_90d ?? 0
  }

  const brands = Array.from(brandMap.values()).map(b => ({
    brand: b.brand,
    avg_price: b.avg_prices.length
      ? Math.round(b.avg_prices.reduce((a, v) => a + v, 0) / b.avg_prices.length)
      : 0,
    change_30d: b.price_changes.length
      ? parseFloat((b.price_changes.reduce((a, v) => a + v, 0) / b.price_changes.length).toFixed(2))
      : 0,
    heat_score: b.heat_scores.length
      ? parseFloat((b.heat_scores.reduce((a, v) => a + v, 0) / b.heat_scores.length).toFixed(2))
      : 0,
    listings: b.listings,
    sold_90d: b.sold,
  })).sort((a, b) => b.heat_score - a.heat_score)

  return NextResponse.json({
    total_listings: totalListingsResult.count ?? 0,
    total_sold_90d: totalSoldResult.count ?? 0,
    refs_tracked: refsTracked,
    last_updated: lastUpdatedResult.data?.[0]?.scraped_at ?? null,
    brands,
  })
}
