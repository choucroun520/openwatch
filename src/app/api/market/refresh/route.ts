// POST /api/market/refresh
// Returns status and ref count. Run node scripts/scrape-ebay.mjs for actual scraping.

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST() {
  const supabase = createAdminClient()

  // Get unique ref count from listings
  const { data: listings } = await supabase
    .from("listings")
    .select("reference_number")
    .not("reference_number", "is", null)
    .is("deleted_at", null)

  const refs = [
    ...new Set(
      (listings ?? [])
        .map((l: { reference_number: string | null }) => l.reference_number)
        .filter(Boolean)
    ),
  ]

  // Get current market comps stats
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { count: totalComps } = await db
    .from("market_comps")
    .select("*", { count: "exact", head: true })

  const { data: lastScrapeRaw } = await db
    .from("market_comps")
    .select("scraped_at")
    .order("scraped_at", { ascending: false })
    .limit(1)
    .single()

  const lastScrape = lastScrapeRaw as { scraped_at: string } | null

  return NextResponse.json({
    started: true,
    refs: refs.length,
    totalComps: totalComps ?? 0,
    lastScraped: lastScrape?.scraped_at ?? null,
    message: `Run \`node scripts/scrape-ebay.mjs\` to scrape eBay data for all ${refs.length} refs`,
  })
}
