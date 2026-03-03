// POST /api/chrono24/scrape
// Body: { "slug": "jewelsintimeofboca" }
// Spawns scrape-chrono24-dealer.mjs as a child process.
// Returns immediately with { started: true, dealer: slug }.

import { NextRequest, NextResponse } from "next/server"
import { spawn } from "child_process"
import path from "path"

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

  const scriptPath = path.join(process.cwd(), "scripts", "scrape-chrono24-dealer.mjs")

  const child = spawn("node", [scriptPath, slug], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env },
  })
  child.unref()

  return NextResponse.json({ started: true, dealer: slug })
}
