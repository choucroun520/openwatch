import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const revalidate = 3600 // 1-hour cache

type TrendLabel = "surging" | "rising" | "stable" | "cooling" | "dropping"

interface SnapshotRow {
  ref_number: string
  brand: string
  model_name: string | null
  avg_price: number | null
  floor_price: number | null
  ceiling_price: number | null
  listing_count: number | null
  snapshot_date: string
  source: string
}

interface TrendResult {
  ref_number: string
  brand: string
  model_name: string | null
  current_price: number
  price_7d_ago: number | null
  price_30d_ago: number | null
  price_90d_ago: number | null
  momentum_7d: number | null
  momentum_30d: number | null
  momentum_90d: number | null
  trend_label: TrendLabel
  listing_count: number
  velocity_30d: number | null // listing count delta over 30 days (supply signal)
  floor_price: number | null
  last_snapshot: string
}

function classifyTrend(momentum30d: number | null): TrendLabel {
  if (momentum30d === null) return "stable"
  if (momentum30d > 5) return "surging"
  if (momentum30d > 2) return "rising"
  if (momentum30d < -5) return "dropping"
  if (momentum30d < -2) return "cooling"
  return "stable"
}

function pctChange(current: number, past: number | null): number | null {
  if (past === null || past === 0) return null
  return parseFloat((((current - past) / past) * 100).toFixed(2))
}

// Find the snapshot closest to N days ago
function closestSnapshot(
  snapshots: SnapshotRow[],
  targetDate: Date
): SnapshotRow | null {
  if (snapshots.length === 0) return null
  const targetMs = targetDate.getTime()
  let best: SnapshotRow | null = null
  let bestDiff = Infinity
  for (const s of snapshots) {
    const diff = Math.abs(new Date(s.snapshot_date).getTime() - targetMs)
    if (diff < bestDiff) {
      bestDiff = diff
      best = s
    }
  }
  return best
}

function getMockTrends(limit: number, brand: string): TrendResult[] {
  const now = new Date()
  const mock: TrendResult[] = [
    { ref_number: "126710BLRO", brand: "Rolex", model_name: "GMT-Master II Pepsi", current_price: 19500, price_7d_ago: 18900, price_30d_ago: 17800, price_90d_ago: 16200, momentum_7d: 3.2, momentum_30d: 9.6, momentum_90d: 20.4, trend_label: "surging", listing_count: 22, velocity_30d: -3, floor_price: 18200, last_snapshot: now.toISOString() },
    { ref_number: "116500LN", brand: "Rolex", model_name: "Daytona Panda", current_price: 40000, price_7d_ago: 39200, price_30d_ago: 37500, price_90d_ago: 35000, momentum_7d: 2.0, momentum_30d: 6.7, momentum_90d: 14.3, trend_label: "surging", listing_count: 15, velocity_30d: -2, floor_price: 38000, last_snapshot: now.toISOString() },
    { ref_number: "5711/1A-011", brand: "Patek Philippe", model_name: "Nautilus", current_price: 185000, price_7d_ago: 183000, price_30d_ago: 178000, price_90d_ago: 170000, momentum_7d: 1.1, momentum_30d: 3.9, momentum_90d: 8.8, trend_label: "rising", listing_count: 8, velocity_30d: -1, floor_price: 180000, last_snapshot: now.toISOString() },
    { ref_number: "15510ST.OO.1320ST.06", brand: "Audemars Piguet", model_name: "Royal Oak 37mm", current_price: 49500, price_7d_ago: 48800, price_30d_ago: 47200, price_90d_ago: 44000, momentum_7d: 1.4, momentum_30d: 4.9, momentum_90d: 12.5, trend_label: "rising", listing_count: 19, velocity_30d: 2, floor_price: 47000, last_snapshot: now.toISOString() },
    { ref_number: "126610LN", brand: "Rolex", model_name: "Submariner Date", current_price: 15600, price_7d_ago: 15500, price_30d_ago: 15400, price_90d_ago: 15100, momentum_7d: 0.6, momentum_30d: 1.3, momentum_90d: 3.3, trend_label: "stable", listing_count: 34, velocity_30d: 1, floor_price: 14800, last_snapshot: now.toISOString() },
    { ref_number: "126234", brand: "Rolex", model_name: "Datejust 36", current_price: 9200, price_7d_ago: 9300, price_30d_ago: 9600, price_90d_ago: 9800, momentum_7d: -1.1, momentum_30d: -4.2, momentum_90d: -6.1, trend_label: "cooling", listing_count: 56, velocity_30d: 8, floor_price: 8900, last_snapshot: now.toISOString() },
    { ref_number: "126710BLNR", brand: "Rolex", model_name: "GMT-Master II Batman", current_price: 18200, price_7d_ago: 18000, price_30d_ago: 17600, price_90d_ago: 16900, momentum_7d: 1.1, momentum_30d: 3.4, momentum_90d: 7.7, trend_label: "rising", listing_count: 25, velocity_30d: -2, floor_price: 17400, last_snapshot: now.toISOString() },
    { ref_number: "5726/1A-014", brand: "Patek Philippe", model_name: "Annual Calendar", current_price: 78000, price_7d_ago: 79200, price_30d_ago: 82000, price_90d_ago: 88000, momentum_7d: -1.5, momentum_30d: -4.9, momentum_90d: -11.4, trend_label: "cooling", listing_count: 6, velocity_30d: 3, floor_price: 75000, last_snapshot: now.toISOString() },
    { ref_number: "26240ST.OO.1320ST.02", brand: "Audemars Piguet", model_name: "Royal Oak Chrono 41mm", current_price: 52000, price_7d_ago: 51200, price_30d_ago: 50500, price_90d_ago: 49000, momentum_7d: 1.6, momentum_30d: 3.0, momentum_90d: 6.1, trend_label: "rising", listing_count: 11, velocity_30d: 0, floor_price: 50000, last_snapshot: now.toISOString() },
    { ref_number: "228395TBR", brand: "Rolex", model_name: "Sky-Dweller Yellow Gold", current_price: 80000, price_7d_ago: 81000, price_30d_ago: 83500, price_90d_ago: 87000, momentum_7d: -1.2, momentum_30d: -4.2, momentum_90d: -8.0, trend_label: "cooling", listing_count: 9, velocity_30d: 2, floor_price: 77000, last_snapshot: now.toISOString() },
    { ref_number: "124060", brand: "Rolex", model_name: "Explorer 36mm", current_price: 10400, price_7d_ago: 10200, price_30d_ago: 9900, price_90d_ago: 9500, momentum_7d: 2.0, momentum_30d: 5.1, momentum_90d: 9.5, trend_label: "surging", listing_count: 41, velocity_30d: -4, floor_price: 9800, last_snapshot: now.toISOString() },
    { ref_number: "4500V/110A-B128", brand: "Vacheron Constantin", model_name: "Overseas", current_price: 30000, price_7d_ago: 30200, price_30d_ago: 30800, price_90d_ago: 31500, momentum_7d: -0.7, momentum_30d: -2.6, momentum_90d: -4.8, trend_label: "cooling", listing_count: 14, velocity_30d: 1, floor_price: 29000, last_snapshot: now.toISOString() },
    { ref_number: "126333", brand: "Rolex", model_name: "Datejust 41", current_price: 10800, price_7d_ago: 10850, price_30d_ago: 11000, price_90d_ago: 11500, momentum_7d: -0.5, momentum_30d: -1.8, momentum_90d: -6.1, trend_label: "stable", listing_count: 48, velocity_30d: 5, floor_price: 10200, last_snapshot: now.toISOString() },
    { ref_number: "5712/1A-001", brand: "Patek Philippe", model_name: "Calatrava Pilot", current_price: 72000, price_7d_ago: 70000, price_30d_ago: 67000, price_90d_ago: 63000, momentum_7d: 2.9, momentum_30d: 7.5, momentum_90d: 14.3, trend_label: "surging", listing_count: 7, velocity_30d: -1, floor_price: 70000, last_snapshot: now.toISOString() },
    { ref_number: "126334", brand: "Rolex", model_name: "Datejust 41 Rolesor", current_price: 10200, price_7d_ago: 10100, price_30d_ago: 10000, price_90d_ago: 9800, momentum_7d: 1.0, momentum_30d: 2.0, momentum_90d: 4.1, trend_label: "stable", listing_count: 31, velocity_30d: 2, floor_price: 9700, last_snapshot: now.toISOString() },
    { ref_number: "126613LN", brand: "Rolex", model_name: "Submariner Two-Tone", current_price: 17500, price_7d_ago: 17300, price_30d_ago: 16800, price_90d_ago: 15900, momentum_7d: 1.2, momentum_30d: 4.2, momentum_90d: 10.1, trend_label: "rising", listing_count: 18, velocity_30d: -1, floor_price: 16800, last_snapshot: now.toISOString() },
    { ref_number: "126720VTNR", brand: "Rolex", model_name: "GMT-Master II Sprite", current_price: 20500, price_7d_ago: 21200, price_30d_ago: 22000, price_90d_ago: 23500, momentum_7d: -3.3, momentum_30d: -6.8, momentum_90d: -12.8, trend_label: "dropping", listing_count: 28, velocity_30d: 6, floor_price: 19800, last_snapshot: now.toISOString() },
    { ref_number: "126500LN", brand: "Rolex", model_name: "Daytona Black", current_price: 38500, price_7d_ago: 37800, price_30d_ago: 36500, price_90d_ago: 34200, momentum_7d: 1.9, momentum_30d: 5.5, momentum_90d: 12.6, trend_label: "surging", listing_count: 12, velocity_30d: -2, floor_price: 37000, last_snapshot: now.toISOString() },
    { ref_number: "126610LV", brand: "Rolex", model_name: "Submariner Hulk", current_price: 16800, price_7d_ago: 16500, price_30d_ago: 15900, price_90d_ago: 15200, momentum_7d: 1.8, momentum_30d: 5.7, momentum_90d: 10.5, trend_label: "surging", listing_count: 21, velocity_30d: -2, floor_price: 16000, last_snapshot: now.toISOString() },
    { ref_number: "10800", brand: "Rolex", model_name: "Air-King", current_price: 8800, price_7d_ago: 8900, price_30d_ago: 9200, price_90d_ago: 9600, momentum_7d: -1.1, momentum_30d: -4.3, momentum_90d: -8.3, trend_label: "cooling", listing_count: 33, velocity_30d: 4, floor_price: 8400, last_snapshot: now.toISOString() },
  ]

  let filtered = brand
    ? mock.filter((m) => m.brand.toLowerCase().includes(brand.toLowerCase()))
    : mock

  // Sort by absolute momentum_30d descending
  filtered = filtered
    .sort((a, b) => Math.abs(b.momentum_30d ?? 0) - Math.abs(a.momentum_30d ?? 0))
    .slice(0, limit)

  return filtered
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100)
  const brand = searchParams.get("brand") ?? ""

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Fetch price_snapshots_v2 — all snapshots from last 90 days
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  let snapshotQuery = db
    .from("price_snapshots_v2")
    .select("ref_number, brand, model_name, avg_price, floor_price, ceiling_price, listing_count, snapshot_date, source")
    .gte("snapshot_date", ninetyDaysAgo)
    .order("snapshot_date", { ascending: false })

  if (brand) {
    snapshotQuery = snapshotQuery.ilike("brand", `%${brand}%`)
  }

  const { data: snapshotData, error: snapshotErr } = await snapshotQuery

  if (snapshotErr) {
    return NextResponse.json({
      trends: getMockTrends(limit, brand),
      meta: { source: "mock", reason: snapshotErr.message },
    })
  }

  const snapshots: SnapshotRow[] = snapshotData ?? []

  if (snapshots.length === 0) {
    return NextResponse.json({
      trends: getMockTrends(limit, brand),
      meta: { source: "mock", reason: "price_snapshots_v2 table is empty" },
    })
  }

  // Group snapshots by ref_number
  const byRef = new Map<string, SnapshotRow[]>()
  for (const s of snapshots) {
    const key = s.ref_number
    if (!byRef.has(key)) byRef.set(key, [])
    byRef.get(key)!.push(s)
  }

  const now = new Date()
  const ago7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const ago30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const ago90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  const results: TrendResult[] = []

  for (const [ref, refSnaps] of byRef) {
    // Sort: newest first
    const sorted = [...refSnaps].sort(
      (a, b) => new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime()
    )

    const latest = sorted[0]
    const currentPrice = latest.avg_price ? Number(latest.avg_price) : null
    if (!currentPrice || currentPrice <= 0) continue

    const snap7 = closestSnapshot(sorted, ago7)
    const snap30 = closestSnapshot(sorted, ago30)
    const snap90 = closestSnapshot(sorted, ago90)

    const price7 = snap7?.avg_price ? Number(snap7.avg_price) : null
    const price30 = snap30?.avg_price ? Number(snap30.avg_price) : null
    const price90 = snap90?.avg_price ? Number(snap90.avg_price) : null

    const mom7 = pctChange(currentPrice, price7)
    const mom30 = pctChange(currentPrice, price30)
    const mom90 = pctChange(currentPrice, price90)

    // Velocity: listing count delta over 30 days
    const currentCount = latest.listing_count ?? 0
    const count30 = snap30?.listing_count ?? null
    const velocity30 = count30 !== null ? currentCount - count30 : null

    results.push({
      ref_number: ref,
      brand: latest.brand,
      model_name: latest.model_name ?? null,
      current_price: Math.round(currentPrice),
      price_7d_ago: price7 ? Math.round(price7) : null,
      price_30d_ago: price30 ? Math.round(price30) : null,
      price_90d_ago: price90 ? Math.round(price90) : null,
      momentum_7d: mom7,
      momentum_30d: mom30,
      momentum_90d: mom90,
      trend_label: classifyTrend(mom30),
      listing_count: currentCount,
      velocity_30d: velocity30,
      floor_price: latest.floor_price ? Math.round(Number(latest.floor_price)) : null,
      last_snapshot: latest.snapshot_date,
    })
  }

  // Sort by |momentum_30d| descending (biggest movers first)
  results.sort(
    (a, b) => Math.abs(b.momentum_30d ?? 0) - Math.abs(a.momentum_30d ?? 0)
  )

  return NextResponse.json({
    trends: results.slice(0, limit),
    meta: {
      source: "live",
      refs_analyzed: byRef.size,
      period: "90d",
    },
  })
}
