import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const revalidate = 300 // 5-minute cache

// Brand-specific minimum prices to exclude accessories/straps/parts
const BRAND_MIN_PRICE: Record<string, number> = {
  Rolex: 4000,
  "Patek Philippe": 10000,
  "Vacheron Constantin": 5000,
  "Audemars Piguet": 50000,
}

function getMinPrice(brand: string): number {
  return BRAND_MIN_PRICE[brand] ?? 1000
}

// Hardcoded MSRP reference table for grey market premium calculation
const MSRP: Record<string, number> = {
  "126710BLRO": 10800,
  "126710BLNR": 10800,
  "126720VTNR": 10800,
  "126610LN": 9100,
  "126610LV": 9100,
  "126613LN": 12550,
  "124060": 8100,
  "126234": 7150,
  "126333": 9750,
  "126334": 8950,
  "116500LN": 14550,
  "126500LN": 14800,
  "228395TBR": 485350,
  "5711/1A-011": 31000,
  "5712/1A-001": 56900,
  "5726/1A-014": 59500,
  "15510ST.OO.1320ST.06": 22100,
  "26240ST.OO.1320ST.02": 29900,
  "4500V/110A-B128": 22900,
}

const PRICE_BUCKETS = [
  { bucket: "$0-10K", min: 0, max: 10000 },
  { bucket: "$10-25K", min: 10000, max: 25000 },
  { bucket: "$25-50K", min: 25000, max: 50000 },
  { bucket: "$50-100K", min: 50000, max: 100000 },
  { bucket: "$100K+", min: 100000, max: 99_999_999 },
]

const TARGET_BRANDS = ["Rolex", "Patek Philippe", "Audemars Piguet", "Vacheron Constantin"]

interface RawRow {
  id: string
  ref_number: string
  brand: string
  model: string | null
  price: number
  listing_url: string | null
  source: string
  scraped_at: string
  dealer_name: string | null
}

interface HeatRow {
  ref_number: string
  brand: string
  model: string | null
  avg_price: string | null
  floor_price: string | null
  total_listings: number
  total_sold_90d: number
  price_change_30d: string | null
  heat_score: string | null
}

export async function GET() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [rawDataResult, heatResult, lastUpdatedResult] = await Promise.all([
    // All active asking-price listings (broad filter — we'll apply brand-specific minimums in JS)
    db
      .from("market_data")
      .select("id, ref_number, brand, model, price, listing_url, source, scraped_at, dealer_name")
      .eq("is_sold", false)
      .gt("price", 1000),

    // Heat index view — price changes + heat scores (computed from historical comparison)
    db
      .from("ref_heat_index")
      .select(
        "ref_number, brand, model, avg_price, floor_price, total_listings, total_sold_90d, price_change_30d, heat_score"
      ),

    // Most recent scrape timestamp
    db
      .from("market_data")
      .select("scraped_at")
      .order("scraped_at", { ascending: false })
      .limit(1),
  ])

  const allData: RawRow[] = rawDataResult.data ?? []
  const heatRows: HeatRow[] = heatResult.data ?? []

  // Apply brand-specific price minimums
  const filteredData = allData.filter((row) => Number(row.price) >= getMinPrice(row.brand))

  // Build heat index lookup
  const heatByRef = new Map<string, HeatRow>()
  for (const h of heatRows) {
    heatByRef.set(h.ref_number, h)
  }

  // ── Per-ref grouping from filtered data ────────────────────────────────────
  interface RefGroup {
    ref_number: string
    brand: string
    model: string | null
    prices: number[]
    rows: RawRow[]
  }

  const refGroups = new Map<string, RefGroup>()
  for (const row of filteredData) {
    if (!refGroups.has(row.ref_number)) {
      refGroups.set(row.ref_number, {
        ref_number: row.ref_number,
        brand: row.brand,
        model: row.model,
        prices: [],
        rows: [],
      })
    }
    const g = refGroups.get(row.ref_number)!
    g.prices.push(Number(row.price))
    g.rows.push(row)
  }

  // ── Per-brand aggregations ─────────────────────────────────────────────────
  interface BrandGroup {
    brand: string
    refs: Set<string>
    all_prices: number[]
    change_30d_vals: number[]
    heat_vals: number[]
  }

  const brandGroups = new Map<string, BrandGroup>()

  for (const [ref, g] of refGroups) {
    const brand = g.brand
    if (!brandGroups.has(brand)) {
      brandGroups.set(brand, {
        brand,
        refs: new Set(),
        all_prices: [],
        change_30d_vals: [],
        heat_vals: [],
      })
    }
    const b = brandGroups.get(brand)!
    b.refs.add(ref)
    b.all_prices.push(...g.prices)

    const heat = heatByRef.get(ref)
    if (heat?.price_change_30d !== null && heat?.price_change_30d !== undefined) {
      b.change_30d_vals.push(parseFloat(heat.price_change_30d))
    }
    if (heat?.heat_score !== null && heat?.heat_score !== undefined) {
      b.heat_vals.push(parseFloat(heat.heat_score))
    }
  }

  const brands = Array.from(brandGroups.values())
    .map((b) => {
      const sorted = [...b.all_prices].sort((x, y) => x - y)
      const avg = sorted.reduce((a, v) => a + v, 0) / (sorted.length || 1)
      const floor = sorted[0] ?? 0
      const ceiling = sorted[sorted.length - 1] ?? 0
      const change_30d = b.change_30d_vals.length
        ? b.change_30d_vals.reduce((a, v) => a + v, 0) / b.change_30d_vals.length
        : 0
      const heat_score = b.heat_vals.length
        ? b.heat_vals.reduce((a, v) => a + v, 0) / b.heat_vals.length
        : 0
      return {
        brand: b.brand,
        total_listings: b.all_prices.length,
        refs_count: b.refs.size,
        floor_price: Math.round(floor),
        avg_price: Math.round(avg),
        ceiling_price: Math.round(ceiling),
        price_range: Math.round(ceiling - floor),
        change_30d: parseFloat(change_30d.toFixed(2)),
        heat_score: parseFloat(heat_score.toFixed(2)),
      }
    })
    .sort((a, b) => b.heat_score - a.heat_score)

  // ── Top refs (top 15 by listing count) ────────────────────────────────────
  const topRefs = Array.from(refGroups.values())
    .map((g) => {
      const sorted = [...g.prices].sort((a, b) => a - b)
      const floor = sorted[0] ?? 0
      const ceiling = sorted[sorted.length - 1] ?? 0
      const avg = sorted.reduce((a, v) => a + v, 0) / (sorted.length || 1)
      const spread = ceiling - floor
      const spread_pct = avg > 0 ? (spread / avg) * 100 : 0

      const heat = heatByRef.get(g.ref_number)
      const change_30d =
        heat?.price_change_30d !== null && heat?.price_change_30d !== undefined
          ? parseFloat(heat.price_change_30d)
          : 0
      const heat_score =
        heat?.heat_score !== null && heat?.heat_score !== undefined
          ? parseFloat(heat.heat_score)
          : 0

      const msrp = MSRP[g.ref_number] ?? null
      const grey_market_premium_pct =
        msrp !== null ? parseFloat(((avg - msrp) / msrp * 100).toFixed(1)) : null

      return {
        ref_number: g.ref_number,
        brand: g.brand,
        model: g.model,
        floor: Math.round(floor),
        avg: Math.round(avg),
        ceiling: Math.round(ceiling),
        listings: g.prices.length,
        spread: Math.round(spread),
        spread_pct: parseFloat(spread_pct.toFixed(1)),
        change_30d,
        heat_score,
        msrp,
        grey_market_premium_pct,
      }
    })
    .sort((a, b) => b.listings - a.listings)
    .slice(0, 15)

  // ── Deals: listings priced >8% below their ref average ────────────────────
  const refAvgMap = new Map<string, number>()
  for (const [ref, g] of refGroups) {
    const avg = g.prices.reduce((a, v) => a + v, 0) / (g.prices.length || 1)
    refAvgMap.set(ref, avg)
  }

  const deals = filteredData
    .filter((row) => {
      const avg = refAvgMap.get(row.ref_number)
      if (!avg || !row.listing_url) return false
      return Number(row.price) < avg * 0.92
    })
    .map((row) => {
      const avg = refAvgMap.get(row.ref_number)!
      const price = Number(row.price)
      const discount_pct = parseFloat(((avg - price) / avg * 100).toFixed(1))
      return {
        ref_number: row.ref_number,
        brand: row.brand,
        model: row.model,
        price: Math.round(price),
        ref_avg: Math.round(avg),
        discount_pct,
        listing_url: row.listing_url,
        source: row.source,
        scraped_at: row.scraped_at,
      }
    })
    .sort((a, b) => b.discount_pct - a.discount_pct)
    .slice(0, 10)

  // ── Price distribution (for grouped bar chart) ────────────────────────────
  const price_distribution: Array<{ brand: string; bucket: string; count: number }> = []
  for (const brand of TARGET_BRANDS) {
    const brandPrices = filteredData
      .filter((r) => r.brand === brand)
      .map((r) => Number(r.price))
    for (const { bucket, min, max } of PRICE_BUCKETS) {
      const count = brandPrices.filter((p) => p >= min && p < max).length
      if (count > 0) {
        price_distribution.push({ brand, bucket, count })
      }
    }
  }

  // ── Supply by ref (top 15) ─────────────────────────────────────────────────
  const supply_by_ref = Array.from(refGroups.values())
    .map((g) => ({ ref_number: g.ref_number, brand: g.brand, count: g.prices.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  // ── Overview ──────────────────────────────────────────────────────────────
  const lastUpdatedAt: string | null = lastUpdatedResult.data?.[0]?.scraped_at ?? null
  const data_freshness_hours = lastUpdatedAt
    ? Math.round((Date.now() - new Date(lastUpdatedAt).getTime()) / 3_600_000)
    : 0

  return NextResponse.json({
    overview: {
      total_listings: filteredData.length,
      refs_tracked: refGroups.size,
      brands_covered: brandGroups.size,
      last_updated: lastUpdatedAt,
      data_freshness_hours,
    },
    brands,
    top_refs: topRefs,
    deals,
    price_distribution,
    supply_by_ref,
  })
}
