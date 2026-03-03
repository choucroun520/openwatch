import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const revalidate = 1800 // 30-min cache

interface MarketCompRow {
  ref_number: string
  brand: string
  model_name: string | null
  price: number
  currency: string
  scraped_at: string
}

interface HeatIndexRow {
  ref_number: string
  brand: string
  model: string | null
  avg_price: string | null
  floor_price: string | null
  total_listings: number
  price_change_30d: string | null
  heat_score: string | null
}

interface TopRef {
  ref_number: string
  model_name: string | null
  floor_price: number
  avg_price: number
  listing_count: number
  trend: "up" | "flat" | "down"
}

interface BrandHeat {
  brand: string
  total_listings: number
  avg_price: number
  heat_score: number
  top_refs: TopRef[]
}

function normalizeTo100(values: number[]): number[] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min
  if (range === 0) return values.map(() => 50)
  return values.map((v) => parseFloat(((((v - min) / range) * 100)).toFixed(1)))
}

function getMockMarketHeat(): BrandHeat[] {
  return [
    {
      brand: "Rolex",
      total_listings: 320,
      avg_price: 18400,
      heat_score: 92,
      top_refs: [
        { ref_number: "126710BLRO", model_name: "GMT-Master II Pepsi", floor_price: 18200, avg_price: 19500, listing_count: 22, trend: "up" },
        { ref_number: "116500LN", model_name: "Daytona", floor_price: 38000, avg_price: 40000, listing_count: 15, trend: "up" },
        { ref_number: "126610LN", model_name: "Submariner Date", floor_price: 14800, avg_price: 15600, listing_count: 34, trend: "flat" },
        { ref_number: "126710BLNR", model_name: "GMT-Master II Batman", floor_price: 17400, avg_price: 18200, listing_count: 25, trend: "up" },
      ],
    },
    {
      brand: "Patek Philippe",
      total_listings: 42,
      avg_price: 98500,
      heat_score: 88,
      top_refs: [
        { ref_number: "5711/1A-011", model_name: "Nautilus", floor_price: 180000, avg_price: 185000, listing_count: 8, trend: "up" },
        { ref_number: "5712/1A-001", model_name: "Calatrava Pilot", floor_price: 70000, avg_price: 72000, listing_count: 7, trend: "up" },
        { ref_number: "5726/1A-014", model_name: "Annual Calendar", floor_price: 75000, avg_price: 78000, listing_count: 6, trend: "down" },
      ],
    },
    {
      brand: "Audemars Piguet",
      total_listings: 78,
      avg_price: 51200,
      heat_score: 85,
      top_refs: [
        { ref_number: "15510ST.OO.1320ST.06", model_name: "Royal Oak 37mm", floor_price: 47000, avg_price: 49500, listing_count: 19, trend: "up" },
        { ref_number: "26240ST.OO.1320ST.02", model_name: "Royal Oak Chrono 41mm", floor_price: 50000, avg_price: 52000, listing_count: 11, trend: "up" },
      ],
    },
    {
      brand: "Vacheron Constantin",
      total_listings: 31,
      avg_price: 34800,
      heat_score: 62,
      top_refs: [
        { ref_number: "4500V/110A-B128", model_name: "Overseas", floor_price: 29000, avg_price: 30000, listing_count: 14, trend: "down" },
      ],
    },
    {
      brand: "Richard Mille",
      total_listings: 18,
      avg_price: 287000,
      heat_score: 71,
      top_refs: [
        { ref_number: "RM 011", model_name: "RM 011 Felipe Massa", floor_price: 210000, avg_price: 240000, listing_count: 5, trend: "flat" },
        { ref_number: "RM 035", model_name: "RM 035 Americas", floor_price: 160000, avg_price: 185000, listing_count: 4, trend: "up" },
      ],
    },
    {
      brand: "A. Lange & Söhne",
      total_listings: 22,
      avg_price: 62400,
      heat_score: 58,
      top_refs: [
        { ref_number: "401.035", model_name: "Datograph", floor_price: 55000, avg_price: 62000, listing_count: 6, trend: "flat" },
        { ref_number: "110.021", model_name: "Lange 1", floor_price: 28000, avg_price: 32000, listing_count: 8, trend: "flat" },
      ],
    },
    {
      brand: "Omega",
      total_listings: 145,
      avg_price: 8900,
      heat_score: 55,
      top_refs: [
        { ref_number: "310.30.42.50.01.001", model_name: "Speedmaster Moonwatch", floor_price: 7200, avg_price: 7800, listing_count: 38, trend: "flat" },
        { ref_number: "220.10.41.21.01.001", model_name: "Seamaster Diver 300M", floor_price: 4800, avg_price: 5200, listing_count: 42, trend: "down" },
      ],
    },
    {
      brand: "IWC",
      total_listings: 67,
      avg_price: 12400,
      heat_score: 48,
      top_refs: [
        { ref_number: "IW327001", model_name: "Pilot's Watch", floor_price: 7200, avg_price: 7800, listing_count: 18, trend: "flat" },
        { ref_number: "IW503702", model_name: "Portugieser Chrono", floor_price: 14000, avg_price: 15500, listing_count: 12, trend: "up" },
      ],
    },
  ]
}

export async function GET() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Try heat index view first (computed, fast)
  const { data: heatData, error: heatErr } = await db
    .from("ref_heat_index")
    .select("ref_number, brand, model, avg_price, floor_price, total_listings, price_change_30d, heat_score")
    .order("total_listings", { ascending: false }) as {
    data: HeatIndexRow[] | null
    error: { message: string } | null
  }

  // Fall back to market_comps if heat index is unavailable
  let rawRows: MarketCompRow[] | null = null
  if (heatErr || !heatData || heatData.length === 0) {
    const { data: compsData, error: compsErr } = await db
      .from("market_comps")
      .select("ref_number, brand, model_name, price, currency, scraped_at")
      .gt("price", 0) as { data: MarketCompRow[] | null; error: { message: string } | null }

    if (compsErr || !compsData || compsData.length === 0) {
      return NextResponse.json({
        market_heat: getMockMarketHeat(),
        meta: { source: "mock" },
      })
    }
    rawRows = compsData
  }

  // ── Path A: compute from ref_heat_index ──────────────────────────────────
  if (heatData && heatData.length > 0) {
    interface BrandAgg {
      brand: string
      refs: HeatIndexRow[]
      totalListings: number
      allAvgPrices: number[]
      heatScores: number[]
    }
    const brandMap = new Map<string, BrandAgg>()

    for (const row of heatData) {
      if (!brandMap.has(row.brand)) {
        brandMap.set(row.brand, { brand: row.brand, refs: [], totalListings: 0, allAvgPrices: [], heatScores: [] })
      }
      const b = brandMap.get(row.brand)!
      b.refs.push(row)
      b.totalListings += row.total_listings ?? 0
      if (row.avg_price) b.allAvgPrices.push(parseFloat(row.avg_price))
      if (row.heat_score) b.heatScores.push(parseFloat(row.heat_score))
    }

    // Raw heat scores for normalization
    const brandEntries = Array.from(brandMap.values())
    const rawHeatScores = brandEntries.map((b) =>
      b.heatScores.length > 0
        ? b.heatScores.reduce((a, v) => a + v, 0) / b.heatScores.length
        : b.totalListings // fallback: use listing count
    )
    const normalizedScores = normalizeTo100(rawHeatScores)

    const result: BrandHeat[] = brandEntries.map((b, i) => {
      const avgPrice =
        b.allAvgPrices.length > 0
          ? b.allAvgPrices.reduce((a, v) => a + v, 0) / b.allAvgPrices.length
          : 0

      const topRefs: TopRef[] = b.refs
        .sort((a, z) => (z.total_listings ?? 0) - (a.total_listings ?? 0))
        .slice(0, 4)
        .map((r) => {
          const change = r.price_change_30d ? parseFloat(r.price_change_30d) : 0
          const trend: "up" | "flat" | "down" = change > 1 ? "up" : change < -1 ? "down" : "flat"
          return {
            ref_number: r.ref_number,
            model_name: r.model ?? null,
            floor_price: r.floor_price ? Math.round(parseFloat(r.floor_price)) : 0,
            avg_price: r.avg_price ? Math.round(parseFloat(r.avg_price)) : 0,
            listing_count: r.total_listings ?? 0,
            trend,
          }
        })

      return {
        brand: b.brand,
        total_listings: b.totalListings,
        avg_price: Math.round(avgPrice),
        heat_score: normalizedScores[i],
        top_refs: topRefs,
      }
    })

    result.sort((a, z) => z.heat_score - a.heat_score)

    return NextResponse.json({
      market_heat: result,
      meta: { source: "ref_heat_index" },
    })
  }

  // ── Path B: compute from market_comps raw rows ────────────────────────────
  if (!rawRows) {
    return NextResponse.json({ market_heat: getMockMarketHeat(), meta: { source: "mock" } })
  }

  interface BrandAgg2 {
    brand: string
    refs: Map<string, { model_name: string | null; prices: number[]; last_scraped: string }>
    allPrices: number[]
  }
  const brandMap2 = new Map<string, BrandAgg2>()

  for (const row of rawRows) {
    if (!brandMap2.has(row.brand)) {
      brandMap2.set(row.brand, { brand: row.brand, refs: new Map(), allPrices: [] })
    }
    const b = brandMap2.get(row.brand)!
    b.allPrices.push(Number(row.price))

    if (!b.refs.has(row.ref_number)) {
      b.refs.set(row.ref_number, { model_name: row.model_name ?? null, prices: [], last_scraped: row.scraped_at })
    }
    const r = b.refs.get(row.ref_number)!
    r.prices.push(Number(row.price))
    if (row.scraped_at > r.last_scraped) r.last_scraped = row.scraped_at
  }

  const brandEntries2 = Array.from(brandMap2.values())
  const rawCounts = brandEntries2.map((b) => b.allPrices.length)
  const normalizedScores2 = normalizeTo100(rawCounts)

  const result2: BrandHeat[] = brandEntries2.map((b, i) => {
    const avgPrice =
      b.allPrices.length > 0
        ? b.allPrices.reduce((a, v) => a + v, 0) / b.allPrices.length
        : 0

    // Top refs by listing count
    const topRefs: TopRef[] = Array.from(b.refs.entries())
      .map(([ref, data]) => {
        const sorted = [...data.prices].sort((a, z) => a - z)
        return {
          ref_number: ref,
          model_name: data.model_name,
          floor_price: Math.round(sorted[0] ?? 0),
          avg_price: Math.round(sorted.reduce((a, v) => a + v, 0) / sorted.length),
          listing_count: data.prices.length,
          trend: "flat" as const, // no historical data available from raw comps
        }
      })
      .sort((a, z) => z.listing_count - a.listing_count)
      .slice(0, 4)

    return {
      brand: b.brand,
      total_listings: b.allPrices.length,
      avg_price: Math.round(avgPrice),
      heat_score: normalizedScores2[i],
      top_refs: topRefs,
    }
  })

  result2.sort((a, z) => z.heat_score - a.heat_score)

  return NextResponse.json({
    market_heat: result2,
    meta: { source: "market_comps" },
  })
}
