// GET /api/market/stats?refs=126710BLRO,126610LN-0001,...
// Returns floor/avg/ceiling/count for each ref

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const refs = req.nextUrl.searchParams.get("refs")
  if (!refs) return NextResponse.json({})

  const refList = refs
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean)
  if (refList.length === 0) return NextResponse.json({})

  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("market_comps")
    .select("reference_number, price, sale_date")
    .in("reference_number", refList)
    .gt("price", 5000)

  const rows = (data ?? []) as Array<{ reference_number: string; price: string; sale_date: string | null }>
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const result: Record<
    string,
    { floor: number; avg: number; ceiling: number; sold_30d: number; total: number }
  > = {}

  for (const ref of refList) {
    const comps = rows.filter((c) => c.reference_number === ref)
    if (comps.length === 0) continue

    const prices = comps.map((c) => parseFloat(String(c.price)))
    const sold30d = comps.filter(
      (c) => c.sale_date && new Date(c.sale_date) >= thirtyDaysAgo
    ).length

    result[ref] = {
      floor: Math.min(...prices),
      avg: prices.reduce((a, b) => a + b, 0) / prices.length,
      ceiling: Math.max(...prices),
      sold_30d: sold30d,
      total: comps.length,
    }
  }

  return NextResponse.json(result)
}
