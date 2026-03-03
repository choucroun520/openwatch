import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const TARGET_BRANDS = [
  "Rolex",
  "Audemars Piguet",
  "Patek Philippe",
  "Vacheron Constantin",
  "Richard Mille",
  "F.P. Journe",
]

export async function GET() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Fetch all active market_data rows for target brands
  const { data: rows, error } = await db
    .from("market_data")
    .select("brand, ref_number, price, is_sold, price_change_30d")
    .in("brand", TARGET_BRANDS)
    .gt("price", 1000)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Group by brand
  const brandMap = new Map<string, {
    prices: number[]
    refs: Set<string>
    total_listings: number
    floor: number
    sold_count: number
  }>()

  for (const row of rows ?? []) {
    const brand = row.brand as string
    if (!brand) continue
    if (!brandMap.has(brand)) {
      brandMap.set(brand, { prices: [], refs: new Set(), total_listings: 0, floor: Infinity, sold_count: 0 })
    }
    const e = brandMap.get(brand)!
    if (row.ref_number) e.refs.add(row.ref_number as string)
    const price = parseFloat(row.price as string)
    if (row.is_sold) {
      e.sold_count++
    } else {
      e.total_listings++
      e.prices.push(price)
      if (price < e.floor) e.floor = price
    }
  }

  const brands = TARGET_BRANDS.map(name => {
    const e = brandMap.get(name) ?? { prices: [], refs: new Set(), total_listings: 0, floor: Infinity, sold_count: 0 }
    const avg = e.prices.length ? e.prices.reduce((a, v) => a + v, 0) / e.prices.length : 0
    return {
      brand: name,
      slug: brandToSlug(name),
      refs_count: e.refs.size,
      total_listings: e.total_listings,
      avg_price: avg > 0 ? avg : null,
      floor_price: e.floor !== Infinity ? e.floor : null,
      sold_count_90d: e.sold_count,
    }
  })

  return NextResponse.json({ brands })
}

function brandToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}
