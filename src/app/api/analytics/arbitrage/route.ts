import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const revalidate = 1800 // 30-min cache

// Currency → market region mapping
const CURRENCY_TO_MARKET: Record<string, string> = {
  USD: "US",
  EUR: "EU",
  CHF: "CH",
  GBP: "UK",
  SGD: "SG",
  JPY: "JP",
  HKD: "HK",
  AED: "AE",
}

// Import cost constants (EU → US as primary arbitrage route)
const SHIPPING_FLAT_USD = 350
const US_IMPORT_DUTY_PCT = 0.065 // 6.5%
const US_MPF_PCT = 0.033 // 3.3% merchandise processing fee
const AUTH_FEE_USD = 200
const TOTAL_IMPORT_COST_PCT = US_IMPORT_DUTY_PCT + US_MPF_PCT // 9.8%

interface MarketCompRow {
  ref_number: string
  brand: string
  model_name: string | null
  price: number
  currency: string
  source: string
  scraped_at: string
}

interface FxRatesRow {
  rates: Record<string, number>
  fetched_at: string
}

interface ArbitrageResult {
  ref_number: string
  brand: string
  model_name: string | null
  buy_market: string
  buy_price_local: number
  buy_currency: string
  buy_price_usd: number
  sell_market: string
  sell_price_usd: number
  gross_spread_pct: number
  import_costs_usd: number
  net_profit_usd: number
  net_profit_pct: number
  buy_listing_count: number
  sell_listing_count: number
  last_updated: string
}


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100)
  const minProfitPct = parseFloat(searchParams.get("min_profit_pct") ?? "5")

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Fetch FX rates (latest row, any age — we just need conversion factors)
  const { data: fxRow } = await db
    .from("fx_rates")
    .select("rates, fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle() as { data: FxRatesRow | null }

  // Default fallback rates if fx_rates table is empty
  const fxRates: Record<string, number> = fxRow?.rates ?? {
    EUR: 0.9217,
    CHF: 0.8943,
    GBP: 0.7891,
    JPY: 149.52,
    AED: 3.6725,
    SGD: 1.3412,
    HKD: 7.8241,
  }

  // Convert any currency to USD
  function toUsd(amount: number, currency: string): number {
    if (currency === "USD") return amount
    const rate = fxRates[currency]
    if (!rate) return amount
    return amount / rate
  }

  // Fetch market comps data
  const { data: compsData, error: compsErr } = await db
    .from("market_comps")
    .select("ref_number, brand, model_name, price, currency, source, scraped_at")
    .gt("price", 0) as { data: MarketCompRow[] | null; error: { message: string } | null }

  if (compsErr) {
    // Table doesn't exist or error — return empty array
    return NextResponse.json([])
  }

  const rows: MarketCompRow[] = compsData ?? []

  if (rows.length === 0) {
    return NextResponse.json([])
  }

  // Group by ref_number, track prices by currency
  interface RefEntry {
    ref_number: string
    brand: string
    model_name: string | null
    byCurrency: Map<string, { pricesUsd: number[]; pricesLocal: number[]; currency: string; last_scraped: string }>
  }

  const refMap = new Map<string, RefEntry>()
  for (const row of rows) {
    const key = row.ref_number
    if (!refMap.has(key)) {
      refMap.set(key, {
        ref_number: row.ref_number,
        brand: row.brand,
        model_name: row.model_name ?? null,
        byCurrency: new Map(),
      })
    }
    const entry = refMap.get(key)!
    const cur = row.currency ?? "USD"
    if (!entry.byCurrency.has(cur)) {
      entry.byCurrency.set(cur, { pricesUsd: [], pricesLocal: [], currency: cur, last_scraped: row.scraped_at })
    }
    const bucket = entry.byCurrency.get(cur)!
    bucket.pricesUsd.push(toUsd(Number(row.price), cur))
    bucket.pricesLocal.push(Number(row.price))
    // Track latest scraped_at
    if (row.scraped_at > bucket.last_scraped) {
      bucket.last_scraped = row.scraped_at
    }
  }

  // Compute arbitrage for each ref
  const results: ArbitrageResult[] = []

  for (const [, entry] of refMap) {
    if (entry.byCurrency.size < 2) continue // need at least 2 currencies

    // Find cheapest and most expensive buckets (by floor price in USD)
    let minBucket: { currency: string; floorUsd: number; floorLocal: number; count: number; last_scraped: string } | null = null
    let maxBucket: { currency: string; floorUsd: number; count: number; last_scraped: string } | null = null

    for (const [cur, bucket] of entry.byCurrency) {
      const sortedUsd = [...bucket.pricesUsd].sort((a, b) => a - b)
      const sortedLocal = [...bucket.pricesLocal].sort((a, b) => a - b)
      const floorUsd = sortedUsd[0]
      const floorLocal = sortedLocal[0]

      if (!minBucket || floorUsd < minBucket.floorUsd) {
        minBucket = { currency: cur, floorUsd, floorLocal, count: bucket.pricesUsd.length, last_scraped: bucket.last_scraped }
      }
      if (!maxBucket || floorUsd > maxBucket.floorUsd) {
        maxBucket = { currency: cur, floorUsd, count: bucket.pricesUsd.length, last_scraped: bucket.last_scraped }
      }
    }

    if (!minBucket || !maxBucket || minBucket.currency === maxBucket.currency) continue

    const buyPriceUsd = minBucket.floorUsd
    const sellPriceUsd = maxBucket.floorUsd

    if (buyPriceUsd <= 0) continue

    const grossSpreadPct = ((sellPriceUsd - buyPriceUsd) / buyPriceUsd) * 100
    const importCostsUsd = SHIPPING_FLAT_USD + buyPriceUsd * TOTAL_IMPORT_COST_PCT + AUTH_FEE_USD
    const netProfitUsd = sellPriceUsd - buyPriceUsd - importCostsUsd
    const netProfitPct = (netProfitUsd / buyPriceUsd) * 100

    if (netProfitPct < minProfitPct) continue

    const lastUpdated = [minBucket.last_scraped, maxBucket.last_scraped].sort().reverse()[0]

    results.push({
      ref_number: entry.ref_number,
      brand: entry.brand,
      model_name: entry.model_name,
      buy_market: CURRENCY_TO_MARKET[minBucket.currency] ?? minBucket.currency,
      buy_price_local: Math.round(minBucket.floorLocal),
      buy_currency: minBucket.currency,
      buy_price_usd: Math.round(buyPriceUsd),
      sell_market: CURRENCY_TO_MARKET[maxBucket.currency] ?? maxBucket.currency,
      sell_price_usd: Math.round(sellPriceUsd),
      gross_spread_pct: parseFloat(grossSpreadPct.toFixed(2)),
      import_costs_usd: Math.round(importCostsUsd),
      net_profit_usd: Math.round(netProfitUsd),
      net_profit_pct: parseFloat(netProfitPct.toFixed(2)),
      buy_listing_count: minBucket.count,
      sell_listing_count: maxBucket.count,
      last_updated: lastUpdated,
    })
  }

  // Sort by net_profit descending
  results.sort((a, b) => b.net_profit_usd - a.net_profit_usd)

  // Return plain array — no cross-currency pairs found means empty []
  return NextResponse.json(results.slice(0, limit))
}
