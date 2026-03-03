// GET /api/market/comps?ref=126710BLRO&limit=20
// Returns array of market_comps for a reference number

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get("ref")
  if (!ref) return NextResponse.json([])

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "20"), 100)

  const supabase = await createClient()

  const { data } = await supabase
    .from("market_comps")
    .select("*")
    .eq("reference_number", ref)
    .gt("price", 5000)
    .order("sale_date", { ascending: false })
    .limit(limit)

  return NextResponse.json(data ?? [])
}
