// GET /api/analytics/listings
// Returns all active listings with brand/model/dealer for the analytics Listings tab.

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const revalidate = 120 // 2-min cache

export async function GET() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data, error } = await db
    .from("listings")
    .select(`
      *,
      brand:brands(*),
      model:models(*),
      dealer:profiles!dealer_id(id, full_name, company_name, avatar_url, verified, seller_rating, total_sales)
    `)
    .eq("status", "active")
    .is("deleted_at", null)
    .gt("wholesale_price", 0)
    .order("wholesale_price", { ascending: true })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
