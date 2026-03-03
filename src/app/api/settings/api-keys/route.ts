import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

// Keys we support — name, description, link to get one
export const KNOWN_KEYS = [
  {
    key: "EBAY_CLIENT_ID",
    label: "eBay Client ID",
    group: "eBay API",
    description: "Required for eBay sold listings — the highest volume confirmed sale source. Free.",
    link: "https://developer.ebay.com/api-docs/static/oauth-client-credentials-grant.html",
    sensitive: true,
  },
  {
    key: "EBAY_CLIENT_SECRET",
    label: "eBay Client Secret",
    group: "eBay API",
    description: "eBay API secret key — keep confidential.",
    link: "https://developer.ebay.com",
    sensitive: true,
  },
  {
    key: "WATCHCHARTS_API_KEY",
    label: "WatchCharts API Key",
    group: "WatchCharts",
    description: "$99/mo — best aggregated confirmed sale data. Unlocks accurate price history for 10,000+ refs.",
    link: "https://watchcharts.com/api",
    sensitive: true,
  },
  {
    key: "REDDIT_CLIENT_ID",
    label: "Reddit Client ID",
    group: "Reddit API",
    description: "Free — scrapes r/WatchExchange SOLD posts for peer-to-peer transaction prices.",
    link: "https://www.reddit.com/prefs/apps",
    sensitive: false,
  },
  {
    key: "REDDIT_CLIENT_SECRET",
    label: "Reddit Client Secret",
    group: "Reddit API",
    description: "Reddit API secret — required alongside Client ID.",
    link: "https://www.reddit.com/prefs/apps",
    sensitive: true,
  },
  {
    key: "OPENAI_API_KEY",
    label: "OpenAI API Key",
    group: "AI",
    description: "Powers AI negotiation messages, seller response analysis, and sentiment bot (gpt-4o).",
    link: "https://platform.openai.com/account/api-keys",
    sensitive: true,
  },
  {
    key: "ANTHROPIC_API_KEY",
    label: "Anthropic API Key",
    group: "AI",
    description: "Alternative AI provider — Claude models for sentiment analysis.",
    link: "https://console.anthropic.com",
    sensitive: true,
  },
]

// GET — return which keys are set (never return values)
export async function GET() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  let dbKeys: Record<string, string> = {}
  try {
    const { data } = await db.from("app_settings").select("key, updated_at")
    for (const row of data ?? []) dbKeys[row.key] = row.updated_at
  } catch {}

  const result = KNOWN_KEYS.map((def) => ({
    ...def,
    is_set: !!process.env[def.key] || !!dbKeys[def.key],
    updated_at: dbKeys[def.key] ?? null,
    source: process.env[def.key] ? "env" : dbKeys[def.key] ? "db" : null,
  }))

  return NextResponse.json({ keys: result })
}

// POST — save a key
export async function POST(req: NextRequest) {
  const { key, value } = await req.json()

  if (!key || !value) {
    return NextResponse.json({ error: "key and value required" }, { status: 400 })
  }

  const known = KNOWN_KEYS.find((k) => k.key === key)
  if (!known) {
    return NextResponse.json({ error: "Unknown key" }, { status: 400 })
  }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  try {
    await db.from("app_settings").upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    ).execute()

    return NextResponse.json({ ok: true, key })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// DELETE — remove a key
export async function DELETE(req: NextRequest) {
  const { key } = await req.json()
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 })

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  await db.from("app_settings").delete().eq("key", key)
  return NextResponse.json({ ok: true })
}
