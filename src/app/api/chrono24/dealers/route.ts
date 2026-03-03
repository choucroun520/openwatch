// GET /api/chrono24/dealers
// Returns all Chrono24 dealers with listing counts.

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data, error } = await db
    .from("chrono24_dealers")
    .select("id, merchant_id, slug, name, country, total_listings, last_scraped_at, created_at")
    .order("total_listings", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ dealers: data ?? [] })
}
