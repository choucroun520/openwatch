// GET /api/cron/sync-dealers
// Called by Vercel Cron daily.
// NOTE: spawn-based scraping is local-only. This cron logs a ping + returns dealer status.
// To run a real scrape locally: node scripts/scrape-chrono24-dealer.mjs <slug>

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"
export const maxDuration = 10

const DEALER_BLOCKLIST = ['jewelsintimeofboca']

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sb = getServiceClient()

  const { data: dealers, error } = await sb
    .from("chrono24_dealers")
    .select("slug, name, last_scraped_at")
    .order("last_scraped_at", { ascending: true, nullsFirst: true })

  if (error || !dealers) {
    return NextResponse.json({ error: "Failed to fetch dealers" }, { status: 500 })
  }

  const active = dealers.filter((d) => !DEALER_BLOCKLIST.includes(d.slug))
  const needsScrape = active.filter((d) => {
    if (!d.last_scraped_at) return true
    const hoursSince = (Date.now() - new Date(d.last_scraped_at).getTime()) / (1000 * 60 * 60)
    return hoursSince >= 20
  })

  return NextResponse.json({
    ok: true,
    note: "Scraping is local-only. Run: node scripts/scrape-chrono24-dealer.mjs <slug>",
    timestamp: new Date().toISOString(),
    dealers_tracked: dealers.length,
    dealers_needing_scrape: needsScrape.map((d) => d.slug),
  })
}
