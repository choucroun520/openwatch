import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const revalidate = 3600 // 1-hour cache

const FX_API_URL =
  "https://api.frankfurter.app/latest?from=USD&to=EUR,CHF,GBP,JPY,AED,SGD,HKD"
const TWO_HOURS_MS = 2 * 60 * 60 * 1000

interface FxRatesRow {
  id: string
  base_currency: string
  rates: Record<string, number>
  fetched_at: string
}

async function fetchLiveRates(): Promise<Record<string, number>> {
  const res = await fetch(FX_API_URL, { cache: "no-store" })
  if (!res.ok) {
    throw new Error(`Frankfurter API error: ${res.status}`)
  }
  const json = await res.json()
  return json.rates as Record<string, number>
}

export async function GET() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Try cached rates first
  const { data: lastRow } = await db
    .from("fx_rates")
    .select("id, base_currency, rates, fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle() as { data: FxRatesRow | null }

  if (lastRow) {
    const age = Date.now() - new Date(lastRow.fetched_at).getTime()
    if (age < TWO_HOURS_MS) {
      return NextResponse.json({
        rates: lastRow.rates,
        base_currency: lastRow.base_currency,
        fetched_at: lastRow.fetched_at,
        source: "cache",
      })
    }
  }

  // Stale or missing — fetch live
  let rates: Record<string, number>
  try {
    rates = await fetchLiveRates()
  } catch (err) {
    // If live fetch fails but we have stale data, return it with a warning
    if (lastRow) {
      return NextResponse.json({
        rates: lastRow.rates,
        base_currency: lastRow.base_currency,
        fetched_at: lastRow.fetched_at,
        source: "stale_cache",
        warning: "Live fetch failed; returning cached rates",
      })
    }
    const message = err instanceof Error ? err.message : "FX fetch failed"
    return NextResponse.json({ error: message }, { status: 503 })
  }

  const fetchedAt = new Date().toISOString()

  // Persist to cache (best-effort — don't fail the request if this fails)
  await db.from("fx_rates").insert({
    base_currency: "USD",
    rates,
    fetched_at: fetchedAt,
  })

  return NextResponse.json({
    rates,
    base_currency: "USD",
    fetched_at: fetchedAt,
    source: "live",
  })
}
