import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const refNumber = searchParams.get("ref")

  if (!refNumber) {
    return NextResponse.json({ error: "ref is required" }, { status: 400 })
  }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [
    marketStatsResult,
    soldStatsResult,
    listingsResult,
    salesResult,
    snapshotsResult,
  ] = await Promise.all([
    db.from("ref_market_stats")
      .select("*")
      .eq("ref_number", refNumber)
      .single(),

    db.from("ref_sold_stats")
      .select("*")
      .eq("ref_number", refNumber)
      .single(),

    db.from("market_data")
      .select("id, price, condition, has_box, has_papers, source, dealer_name, dealer_country, listing_url, listed_at, scraped_at")
      .eq("ref_number", refNumber)
      .eq("is_sold", false)
      .gt("price", 1000)
      .order("price", { ascending: true })
      .limit(50),

    db.from("market_data")
      .select("id, price, condition, source, dealer_name, listing_url, sold_at, scraped_at")
      .eq("ref_number", refNumber)
      .eq("is_sold", true)
      .gt("price", 1000)
      .order("sold_at", { ascending: false, nullsFirst: false })
      .order("scraped_at", { ascending: false })
      .limit(30),

    db.from("price_snapshots_v2")
      .select("snapshot_date, floor_price, avg_price, ceiling_price, listing_count, sold_count")
      .eq("ref_number", refNumber)
      .order("snapshot_date", { ascending: true })
      .limit(90),
  ])

  return NextResponse.json({
    market_stats: marketStatsResult.data ?? null,
    sold_stats: soldStatsResult.data ?? null,
    listings: listingsResult.data ?? [],
    sales: salesResult.data ?? [],
    price_history: snapshotsResult.data ?? [],
  })
}
