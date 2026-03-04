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
    return NextResponse.json([])
  }

  const snapshots: SnapshotRow[] = snapshotData ?? []

  if (snapshots.length === 0) {
    return NextResponse.json([])
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

  return NextResponse.json(results.slice(0, limit))
}
