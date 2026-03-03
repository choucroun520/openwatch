import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// Map URL slug back to brand name
const SLUG_TO_BRAND: Record<string, string> = {
  "rolex": "Rolex",
  "audemars-piguet": "Audemars Piguet",
  "patek-philippe": "Patek Philippe",
  "vacheron-constantin": "Vacheron Constantin",
  "richard-mille": "Richard Mille",
  "fp-journe": "F.P. Journe",
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ brand: string }> }
) {
  const { brand: brandSlug } = await params
  const brandName = SLUG_TO_BRAND[brandSlug]

  if (!brandName) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 })
  }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: rows, error } = await db
    .from("market_data")
    .select("ref_number, model, price, is_sold, price_change_30d")
    .ilike("brand", brandName)
    .gt("price", 1000)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Group by ref_number
  const refMap = new Map<string, {
    model: string | null
    prices: number[]
    listing_count: number
    floor: number
    changes: number[]
  }>()

  for (const row of rows ?? []) {
    const ref = row.ref_number as string
    if (!ref) continue
    if (!refMap.has(ref)) {
      refMap.set(ref, { model: row.model ?? null, prices: [], listing_count: 0, floor: Infinity, changes: [] })
    }
    const e = refMap.get(ref)!
    if (!e.model && row.model) e.model = row.model as string
    if (!row.is_sold) {
      const price = parseFloat(row.price as string)
      e.prices.push(price)
      e.listing_count++
      if (price < e.floor) e.floor = price
    }
    if (row.price_change_30d !== null) e.changes.push(parseFloat(row.price_change_30d as string))
  }

  const refs = Array.from(refMap.entries())
    .map(([ref_number, e]) => ({
      ref_number,
      model: e.model,
      listing_count: e.listing_count,
      floor_price: e.floor !== Infinity ? e.floor : null,
      avg_price: e.prices.length ? e.prices.reduce((a, v) => a + v, 0) / e.prices.length : null,
      change_30d: e.changes.length ? e.changes.reduce((a, v) => a + v, 0) / e.changes.length : null,
    }))
    .sort((a, b) => (b.listing_count - a.listing_count) || (a.ref_number > b.ref_number ? 1 : -1))

  return NextResponse.json({ brand: brandName, slug: brandSlug, refs })
}
