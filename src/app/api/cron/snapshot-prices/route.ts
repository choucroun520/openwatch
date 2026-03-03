import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const today = new Date().toISOString().slice(0, 10)

  const [askingResult, soldResult] = await Promise.all([
    db.from("ref_market_stats").select(
      "ref_number, brand, total_listings, floor_price, avg_price, ceiling_price"
    ),
    db.from("ref_sold_stats").select("ref_number, brand, total_sold"),
  ])

  if (askingResult.error) {
    return NextResponse.json({ error: askingResult.error.message }, { status: 500 })
  }

  const soldMap = new Map<string, number>(
    (soldResult.data ?? []).map((s: { ref_number: string; brand: string; total_sold: number }) => [
      `${s.ref_number}::${s.brand}`,
      s.total_sold,
    ])
  )

  const rows = (askingResult.data ?? []).map((s: {
    ref_number: string
    brand: string
    total_listings: number
    floor_price: string | null
    avg_price: string | null
    ceiling_price: string | null
  }) => ({
    ref_number: s.ref_number,
    brand: s.brand,
    snapshot_date: today,
    floor_price: s.floor_price ? parseFloat(s.floor_price) : null,
    avg_price: s.avg_price ? parseFloat(s.avg_price) : null,
    ceiling_price: s.ceiling_price ? parseFloat(s.ceiling_price) : null,
    listing_count: s.total_listings,
    sold_count: soldMap.get(`${s.ref_number}::${s.brand}`) ?? 0,
    source: "all",
  }))

  const { error: upsertErr } = await db
    .from("price_snapshots_v2")
    .upsert(rows, { onConflict: "ref_number,snapshot_date,source" })

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, snapshots: rows.length, date: today })
}
