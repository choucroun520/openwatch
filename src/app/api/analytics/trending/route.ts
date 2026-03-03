import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100)
  const brand = searchParams.get("brand") ?? ""

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  let query = db
    .from("ref_heat_index")
    .select("ref_number, brand, model, avg_price, floor_price, total_listings, total_sold_90d, price_change_30d, heat_score")
    .order("heat_score", { ascending: false })
    .limit(limit)

  if (brand) {
    query = query.ilike("brand", `%${brand}%`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ trending: data ?? [] })
}
