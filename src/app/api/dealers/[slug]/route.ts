import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get("page") ?? "1")
  const pageSize = parseInt(searchParams.get("pageSize") ?? "48")
  const brand = searchParams.get("brand") ?? ""
  const source = searchParams.get("source") ?? ""
  const sortBy = searchParams.get("sort") ?? "price_asc"

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Look up dealer by slug in chrono24_dealers
  const { data: c24Dealer } = await db
    .from("chrono24_dealers")
    .select("*")
    .eq("slug", slug)
    .maybeSingle()

  // Determine the dealer name to filter market_data
  const dealerName = c24Dealer?.name ?? slugToDealerName(slug)

  // Build query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = db
    .from("market_data")
    .select("id, ref_number, brand, model, price, condition, has_box, has_papers, source, dealer_name, dealer_country, listing_url, listed_at, scraped_at, image_url")
    .ilike("dealer_name", `%${dealerName}%`)
    .eq("is_sold", false)
    .gt("price", 1000)

  if (brand) query = query.ilike("brand", `%${brand}%`)
  if (source) query = query.eq("source", source)

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

  // Get distinct brands for filter tabs
  const { data: brandRows } = await db
    .from("market_data")
    .select("brand")
    .ilike("dealer_name", `%${dealerName}%`)
    .eq("is_sold", false)
    .gt("price", 1000)

  const brands = [...new Set((brandRows ?? []).map((r: { brand: string }) => r.brand).filter(Boolean))]

  return NextResponse.json({
    dealer: c24Dealer ?? { name: dealerName, slug },
    listings: listings ?? [],
    brands,
    total: count ?? 0,
    page,
    pageSize,
  })
}

function slugToDealerName(slug: string): string {
  return slug
    .split("-")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}
