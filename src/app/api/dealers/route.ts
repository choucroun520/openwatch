import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Get all Chrono24 dealers
  const { data: c24Dealers, error: dealerErr } = await db
    .from("chrono24_dealers")
    .select("id, merchant_id, slug, name, country, total_listings, last_scraped_at, created_at")
    .order("total_listings", { ascending: false })

  if (dealerErr) {
    return NextResponse.json({ error: dealerErr.message }, { status: 500 })
  }

  // For each dealer, get market_data count and brands
  const dealers = await Promise.all(
    (c24Dealers ?? []).map(async (dealer: {
      id: string; merchant_id: number; slug: string; name: string;
      country: string; total_listings: number; last_scraped_at: string; created_at: string
    }) => {
      const { data: mdRows } = await db
        .from("market_data")
        .select("brand, price")
        .ilike("dealer_name", `%${dealer.name}%`)
        .eq("is_sold", false)
        .gt("price", 1000)

      const rows = mdRows ?? []
      const brands = [...new Set(rows.map((r: { brand: string }) => r.brand).filter(Boolean))]
      const prices = rows.map((r: { price: string }) => parseFloat(r.price)).filter((p: number) => p > 0)
      const avg_price = prices.length ? prices.reduce((a: number, v: number) => a + v, 0) / prices.length : null

      return {
        ...dealer,
        market_listing_count: rows.length,
        brands_carried: brands.slice(0, 6),
        avg_price,
      }
    })
  )

  return NextResponse.json({ dealers })
}
