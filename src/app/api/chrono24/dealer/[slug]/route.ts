// GET /api/chrono24/dealer/[slug]
// Returns dealer info + paginated listings from chrono24_listings table.

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const pageParam = req.nextUrl.searchParams.get("page")
  const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1
  const pageSize = 60
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // Get dealer
  const { data: dealer, error: dealerErr } = await db
    .from("chrono24_dealers")
    .select("id, merchant_id, slug, name, country, total_listings, last_scraped_at, created_at")
    .eq("slug", slug)
    .single()

  if (dealerErr || !dealer) {
    return NextResponse.json({ error: "Dealer not found" }, { status: 404 })
  }

  // Get paginated listings
  const { data: listings, error: listingsErr, count } = await db
    .from("chrono24_listings")
    .select("id, chrono24_id, title, reference_number, brand_name, price, currency, image_url, listing_url, condition, is_sold, first_seen_at, last_seen_at, sold_detected_at", { count: "exact" })
    .eq("dealer_id", dealer.id)
    .order("is_sold", { ascending: true })
    .order("last_seen_at", { ascending: false })
    .range(from, to)

  if (listingsErr) {
    return NextResponse.json({ error: listingsErr.message }, { status: 500 })
  }

  return NextResponse.json({
    dealer,
    listings: listings ?? [],
    pagination: {
      page,
      pageSize,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    },
  })
}
