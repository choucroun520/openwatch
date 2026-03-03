import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ refNumber: string }> }
) {
  const { refNumber } = await params
  const { searchParams } = new URL(req.url)
  const source = searchParams.get("source") ?? ""
  const condition = searchParams.get("condition") ?? ""
  const isSold = searchParams.get("is_sold") === "true"
  const sortBy = searchParams.get("sort") ?? "price_asc"
  const page = parseInt(searchParams.get("page") ?? "1")
  const pageSize = parseInt(searchParams.get("pageSize") ?? "50")

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = db
    .from("market_data")
    .select(
      "id, ref_number, brand, model, price, condition, has_box, has_papers, source, source_id, dealer_name, dealer_country, listing_url, listed_at, scraped_at, sold_at, image_url",
      { count: "exact" }
    )
    .eq("ref_number", refNumber)
    .eq("is_sold", isSold)
    .gt("price", 1000)

  if (source) query = query.eq("source", source)
  if (condition) query = query.eq("condition", condition)

  if (sortBy === "price_asc") query = query.order("price", { ascending: true })
  else if (sortBy === "price_desc") query = query.order("price", { ascending: false })
  else if (sortBy === "newest") query = query.order("scraped_at", { ascending: false })
  else query = query.order("price", { ascending: true })

  const from = (page - 1) * pageSize
  query = query.range(from, from + pageSize - 1)

  const { data: listings, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ref_number: refNumber,
    listings: listings ?? [],
    total: count ?? 0,
    page,
    pageSize,
    is_sold: isSold,
  })
}
