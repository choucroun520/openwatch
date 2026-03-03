// POST /api/chrono24/scrape
// Body: { "slug": "jewelsintimeofboca" }
// NOTE: Scraping runs locally via `node scripts/scrape-chrono24-dealer.mjs <slug>`
// This endpoint is a no-op stub on Vercel — spawn-based scraping is local-only.

import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  let body: { slug?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const slug = body.slug?.trim()
  if (!slug || !/^[a-z0-9_-]+$/i.test(slug)) {
    return NextResponse.json({ error: "Invalid dealer slug" }, { status: 400 })
  }

  // Scraping is local-only — run manually:
  // node scripts/scrape-chrono24-dealer.mjs <slug>
  return NextResponse.json({
    ok: false,
    message: "Scraping runs locally only. Use: node scripts/scrape-chrono24-dealer.mjs " + slug,
  })
}
