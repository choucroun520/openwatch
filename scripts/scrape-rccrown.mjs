#!/usr/bin/env node
/**
 * RC Crown Inventory Scraper
 * Fetches all inventory from RC Crown's live API and upserts into Supabase.
 *
 * Usage: node scripts/scrape-rccrown.mjs
 *
 * RC Crown API: https://rccrown-backoffic-eapi.azurewebsites.net/api/v1/public/inventario/C2B4ED9487A04F0585FDF036F975C29B
 */

import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, "../.env.local") })

const RC_CROWN_API = "https://rccrown-backoffic-eapi.azurewebsites.net/api/v1/public/inventario/C2B4ED9487A04F0585FDF036F975C29B"
const RC_CROWN_WEBSITE = "https://www.rccrown.com/#/public/C2B4ED9487A04F0585FDF036F975C29B"

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Brand name normalization ──────────────────────────────────────────────────
function normalizeBrand(raw) {
  const map = {
    "audemars piguet": "Audemars Piguet",
    "patek philippe": "Patek Philippe",
    "rolex": "Rolex",
    "vacheron constanti": "Vacheron Constantin",
    "vacheron constantin": "Vacheron Constantin",
    "richard mille": "Richard Mille",
    "f.p. journe": "F.P. Journe",
    "fp journe": "F.P. Journe",
    "cartier": "Cartier",
    "iwc": "IWC",
    "omega": "Omega",
    "breitling": "Breitling",
    "a. lange": "A. Lange & Söhne",
    "a. lange & sohne": "A. Lange & Söhne",
  }
  return map[raw?.toLowerCase()?.trim()] ?? raw
}

// ── Extract reference number from description ─────────────────────────────────
function extractRef(description) {
  if (!description) return null

  // Patterns to try in order of specificity:
  // 1. "Ref XXXXX" or "Ref. XXXXX"
  const refMatch = description.match(/\bRef\.?\s+([A-Z0-9]{4,}[-/A-Z0-9]*)/i)
  if (refMatch) return refMatch[1].trim()

  // 2. Last token that looks like a reference (alphanumeric + dashes, 5+ chars)
  const tokens = description.split(/\s+/)
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i].replace(/['"",]/g, "")
    if (/^[A-Z0-9]{3,}[-./][A-Z0-9-./]+$/i.test(t) || /^[0-9]{5,}[A-Z]*(-[0-9A-Z]+)?$/i.test(t)) {
      return t
    }
  }

  // 3. Pattern: 6+ digit number (Rolex refs like 126710BLRO)
  const rolexMatch = description.match(/\b(\d{5,6}[A-Z]{0,6}(?:-\d+)?)\b/)
  if (rolexMatch) return rolexMatch[1]

  return null
}

// ── Normalize condition ───────────────────────────────────────────────────────
function normalizeCondition(raw) {
  if (!raw || raw.trim() === "") return null
  const map = {
    "new": "Unworn",
    "unworn": "Unworn",
    "mint": "Mint",
    "excellent": "Excellent",
    "very good": "Very Good",
    "good condition": "Good",
    "good": "Good",
    "fair": "Fair",
    "slider": "Excellent",        // RC Crown uses "Slider" for slider-adjusted
    "like new": "Mint",
  }
  return map[raw.toLowerCase().trim()] ?? "Excellent"
}

// ── Map RC Crown status to our listing status ─────────────────────────────────
function mapStatus(stock) {
  if (!stock) return "active"
  switch (stock.toLowerCase().trim()) {
    case "yes": return "active"
    case "no":  return "delisted"
    case "incoming": return "pending"
    default: return "active"
  }
}

// ── Get or create brand in DB ─────────────────────────────────────────────────
const brandCache = new Map()

async function getBrandId(brandName) {
  if (brandCache.has(brandName)) return brandCache.get(brandName)

  const slug = brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

  const { data, error } = await sb
    .from("brands")
    .select("id")
    .eq("name", brandName)
    .maybeSingle()

  if (error) { console.warn("brand lookup error:", error.message); return null }

  if (data) {
    brandCache.set(brandName, data.id)
    return data.id
  }

  // Create if missing
  const { data: created, error: ce } = await sb
    .from("brands")
    .insert({ name: brandName, slug, verified: true })
    .select("id")
    .single()

  if (ce) { console.warn("brand create error:", ce.message); return null }

  console.log(`  Created brand: ${brandName}`)
  brandCache.set(brandName, created.id)
  return created.id
}

// ── Get or create RC Crown dealer profile ────────────────────────────────────
async function getRcCrownDealerId() {
  const RC_CROWN_EMAIL = "inventory@rccrown.com"

  // Check if profile already exists
  const { data: existing } = await sb
    .from("profiles")
    .select("id")
    .eq("email", RC_CROWN_EMAIL)
    .maybeSingle()

  if (existing) return existing.id

  // Create auth user first (required by profiles FK → auth.users)
  const { data: authData, error: authError } = await sb.auth.admin.createUser({
    email: RC_CROWN_EMAIL,
    password: crypto.randomUUID(),   // random password — login not needed
    email_confirm: true,
    user_metadata: { company_name: "RC Crown", role: "dealer" },
  })

  if (authError && !authError.message.includes("already registered")) {
    throw new Error("Could not create RC Crown auth user: " + authError.message)
  }

  const userId = authData?.user?.id

  // If user already existed in auth but not profiles, fetch their id
  let finalId = userId
  if (!finalId) {
    const { data: { users } } = await sb.auth.admin.listUsers()
    const found = users.find(u => u.email === RC_CROWN_EMAIL)
    if (found) finalId = found.id
    else throw new Error("Cannot find RC Crown auth user after creation")
  }

  // Upsert profile
  const { error: profileError } = await sb
    .from("profiles")
    .upsert({
      id: finalId,
      email: RC_CROWN_EMAIL,
      full_name: "RC Crown Watches",
      company_name: "RC Crown",
      bio: "Luxury pre-owned watch dealer. Live inventory synced directly from RC Crown.",
      website: "https://www.rccrown.com",
      location: "Miami, FL",
      role: "dealer",
      verified: true,
      specialties: ["Rolex", "Patek Philippe", "Audemars Piguet", "Vacheron Constantin"],
    }, { onConflict: "id" })

  if (profileError) throw new Error("Could not upsert RC Crown profile: " + profileError.message)

  console.log(`  ✅ Created RC Crown dealer profile (id: ${finalId})`)
  return finalId
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 RC Crown Scraper starting...")
  console.log("   Fetching inventory from RC Crown API...")

  const res = await fetch(RC_CROWN_API)
  if (!res.ok) throw new Error(`API error: ${res.status}`)

  const json = await res.json()
  const items = json.result ?? []

  console.log(`   Found ${items.length} items in RC Crown inventory`)

  const dealerId = await getRcCrownDealerId()
  console.log(`   RC Crown dealer ID: ${dealerId}`)

  let inserted = 0, updated = 0, skipped = 0

  for (const item of items) {
    const brand = normalizeBrand(item.brand)
    const brandId = await getBrandId(brand)
    if (!brandId) { skipped++; continue }

    const refNumber = extractRef(item.description)
    const status = mapStatus(item.stock)
    const condition = normalizeCondition(item.condition)
    const hasPapers = item.papper?.toLowerCase() === "yes"
    const hasBox = item.box?.toLowerCase() === "yes"
    const year = item.ano ? parseInt(item.ano, 10) : null
    const price = item.salePrice ?? 0

    // Extract model name from description (strip brand name prefix)
    const modelName = item.description
      ?.replace(new RegExp(`^${brand}\\s*`, "i"), "")
      .trim() ?? null

    // Build notes with links info
    const linksInfo = item.links === "Full" ? "Complete bracelet/links" :
                      item.links === "-1" ? "No bracelet" : null

    const listingData = {
      dealer_id: dealerId,
      brand_id: brandId,
      source: "rccrown",
      external_id: item.id,
      external_url: RC_CROWN_WEBSITE,
      reference_number: refNumber,
      serial_number: item.serial || null,
      year: isNaN(year) ? null : year,
      condition: condition,
      has_box: hasBox,
      has_papers: hasPapers,
      has_warranty: false,
      wholesale_price: String(price),
      retail_price: null,
      currency: "USD",
      status: status,
      images: item.image ? [item.image] : [],
      notes: [modelName, linksInfo].filter(Boolean).join(" · ") || null,
      accepts_inquiries: true,
      featured: false,
      listed_at: new Date().toISOString(),
    }

    // Upsert by external_id
    const { data: existing } = await sb
      .from("listings")
      .select("id, status")
      .eq("external_id", item.id)
      .eq("source", "rccrown")
      .maybeSingle()

    if (existing) {
      const { error } = await sb
        .from("listings")
        .update({
          ...listingData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)

      if (error) {
        console.warn(`  ⚠️  Update failed for ${refNumber ?? item.id}: ${error.message}`)
        skipped++
      } else {
        updated++
        console.log(`  ✅ Updated: ${brand} ${refNumber ?? "(no ref)"} — $${price.toLocaleString()} [${status}]`)
      }
    } else {
      const { error } = await sb.from("listings").insert(listingData)

      if (error) {
        console.warn(`  ⚠️  Insert failed for ${refNumber ?? item.id}: ${error.message}`)
        skipped++
      } else {
        inserted++
        console.log(`  ✨ Inserted: ${brand} ${refNumber ?? "(no ref)"} — $${price.toLocaleString()} [${status}]`)
      }
    }
  }

  // Mark any RC Crown listings NOT in current API response as delisted
  const currentIds = items.map(i => i.id)
  if (currentIds.length > 0) {
    const { data: staleListings } = await sb
      .from("listings")
      .select("id, reference_number")
      .eq("dealer_id", dealerId)
      .eq("source", "rccrown")
      .eq("status", "active")
      .not("external_id", "in", `(${currentIds.map(id => `"${id}"`).join(",")})`)

    if (staleListings?.length) {
      await sb
        .from("listings")
        .update({ status: "delisted", updated_at: new Date().toISOString() })
        .in("id", staleListings.map(l => l.id))

      console.log(`  🗑️  Marked ${staleListings.length} stale listings as delisted`)
    }
  }

  console.log(`\n✅ Done! ${inserted} inserted · ${updated} updated · ${skipped} skipped`)
  console.log(`   Total active RC Crown listings: ${inserted + updated - skipped}`)
}

main().catch(err => {
  console.error("❌ Fatal error:", err)
  process.exit(1)
})
