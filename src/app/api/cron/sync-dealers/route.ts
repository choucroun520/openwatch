// GET /api/cron/sync-dealers
// Called by Vercel Cron every 6 hours.
// Re-scrapes all tracked Chrono24 dealers to detect sold listings.
// Protected by CRON_SECRET header.

import { NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import path from "path"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"
export const maxDuration = 10 // just spawns child processes, returns fast

// Dealers blocked from auto-sync — inaccurate/inflated pricing
const DEALER_BLOCKLIST = ['jewelsintimeofboca']

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sb = getServiceClient()

  // Get all tracked dealers
  const { data: dealers, error } = await sb
    .from("chrono24_dealers")
    .select("slug, name, last_scraped_at")
    .order("last_scraped_at", { ascending: true, nullsFirst: true })

  if (error || !dealers) {
    return NextResponse.json({ error: "Failed to fetch dealers" }, { status: 500 })
  }

  const scriptPath = path.join(process.cwd(), "scripts", "scrape-chrono24-dealer.mjs")
  const started: string[] = []

  for (const dealer of dealers) {
    // Skip blocklisted dealers
    if (DEALER_BLOCKLIST.includes(dealer.slug)) continue

    // Skip if scraped less than 5 hours ago
    if (dealer.last_scraped_at) {
      const lastScrape = new Date(dealer.last_scraped_at).getTime()
      const hoursSince = (Date.now() - lastScrape) / (1000 * 60 * 60)
      if (hoursSince < 5) {
        console.log(`Skipping ${dealer.slug} — scraped ${hoursSince.toFixed(1)}h ago`)
        continue
      }
    }

    // Spawn scraper as background process
    const child = spawn("node", [scriptPath, dealer.slug], {
      detached: true,
      stdio: "ignore",
      env: { ...process.env },
    })
    child.unref()
    started.push(dealer.slug)
    console.log(`Started scrape for ${dealer.slug}`)
  }

  // Log the sync run
  const timestamp = new Date().toISOString()
  await sb.from("chrono24_dealers")
    .update({ updated_at: timestamp })
    .in("slug", started)

  return NextResponse.json({
    ok: true,
    timestamp,
    dealers_checked: dealers.length,
    scrapers_started: started.length,
    started,
  })
}
