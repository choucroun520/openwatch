/**
 * import-chrono24-to-listings.mjs
 *
 * Imports all active Chrono24 dealer listings into the main `listings` table
 * so they appear in the OpenWatch network UI.
 *
 * Prerequisites:
 *   1. Migration 00017 applied (source, external_id, external_url columns)
 *   2. Dealer profiles created: node scripts/create-chrono24-dealer-profiles.mjs
 *
 * Usage:
 *   node scripts/import-chrono24-to-listings.mjs
 *
 * Re-run at any time — uses upsert on (source, external_id), so it's idempotent.
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ─── Brand name → DB UUID lookup ────────────────────────────────────────────

/** Build a case-insensitive map from brand name aliases → brand UUID */
async function buildBrandMap() {
  const { data: brands, error } = await sb.from('brands').select('id, name, slug').is('deleted_at', null)
  if (error) throw new Error('Failed to fetch brands: ' + error.message)

  const map = new Map() // lower name → { id, name, slug }

  // Primary names
  for (const b of brands) {
    map.set(b.name.toLowerCase(), b)
    map.set(b.slug.toLowerCase(), b)
  }

  // Common aliases used by Chrono24
  const aliases = [
    ['rolex', 'rolex'],
    ['patek', 'patek-philippe'],
    ['patek philippe', 'patek-philippe'],
    ['audemars piguet', 'audemars-piguet'],
    ['ap', 'audemars-piguet'],
    ['omega', 'omega'],
    ['richard mille', 'richard-mille'],
    ['rm', 'richard-mille'],
    ['vacheron', 'vacheron-constantin'],
    ['vacheron constantin', 'vacheron-constantin'],
    ['cartier', 'cartier'],
    ['a. lange & sohne', 'a-lange-sohne'],
    ['a. lange & söhne', 'a-lange-sohne'],
    ['a. lange & sohne', 'a-lange-sohne'],
    ['lange', 'a-lange-sohne'],
    ['a lange sohne', 'a-lange-sohne'],
    ['iwc', 'iwc'],
    ['iwc schaffhausen', 'iwc'],
    ['breitling', 'breitling'],
  ]

  for (const [alias, slug] of aliases) {
    const brand = brands.find(b => b.slug === slug)
    if (brand && !map.has(alias)) map.set(alias, brand)
  }

  return map
}

/** Look up a brand by its name string (exact or prefix) */
function lookupBrandByName(brandName, brandMap) {
  if (!brandName) return null
  const lower = brandName.toLowerCase().trim()
  if (brandMap.has(lower)) return brandMap.get(lower)
  for (const [key, val] of brandMap) {
    if (lower.startsWith(key) || key.startsWith(lower)) return val
  }
  return null
}

/**
 * Extract brand from listing title by trying each known brand name as a prefix.
 * Titles from Chrono24 typically start with the brand name:
 *   "Rolex Daytona ..."
 *   "Patek Philippe Nautilus ..."
 *   "A. Lange & Söhne Zeitwerk ..."
 */
function extractBrandFromTitle(title, brandMap) {
  if (!title) return null
  const lower = title.toLowerCase().trim()
  let best = null
  let bestLen = 0
  for (const [key, val] of brandMap) {
    if (lower.startsWith(key) && key.length > bestLen) {
      best = val
      bestLen = key.length
    }
  }
  return best
}

/** Look up brand: first try brandName field, then title prefix */
function lookupBrand(brandName, title, brandMap) {
  return lookupBrandByName(brandName, brandMap) ?? extractBrandFromTitle(title, brandMap)
}

// ─── Condition normalisation ─────────────────────────────────────────────────

const CONDITION_MAP = {
  'unworn': 'Unworn',
  'new': 'Unworn',
  'brand new': 'Unworn',
  'new / unworn': 'Unworn',
  'mint': 'Mint',
  'like new': 'Mint',
  'excellent': 'Excellent',
  'very good': 'Very Good',
  'good': 'Good',
  'fair': 'Fair',
  'acceptable': 'Fair',
  'pre-owned': 'Very Good',
  'pre owned': 'Very Good',
  'used': 'Good',
  'worn': 'Good',
}

function normalizeCondition(raw) {
  if (!raw) return null
  const lower = raw.toLowerCase().trim()
  return CONDITION_MAP[lower] ?? raw // keep original if no mapping
}

// ─── Ref extraction from title ───────────────────────────────────────────────

function extractRef(title) {
  if (!title) return null
  // Match ref patterns: 6–15 alphanumeric chars, may include dashes
  const match = title.match(/\b([A-Z0-9]{2}[A-Z0-9\-]{4,13})\b/)
  return match ? match[1] : null
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Building brand map…')
  const brandMap = await buildBrandMap()
  console.log(`  Loaded ${brandMap.size} brand aliases\n`)

  // Get all Chrono24 dealers
  const { data: c24Dealers, error: dealersErr } = await sb.from('chrono24_dealers').select('*')
  if (dealersErr) { console.error('Failed to fetch chrono24_dealers:', dealersErr.message); process.exit(1) }
  if (!c24Dealers || c24Dealers.length === 0) {
    console.log('No Chrono24 dealers found. Run scrape-chrono24-dealer.mjs first.')
    return
  }

  for (const c24Dealer of c24Dealers) {
    console.log(`\n── ${c24Dealer.name} (merchant_id: ${c24Dealer.merchant_id}) ──`)

    // Find matching profile by email convention
    const email = `chrono24-${c24Dealer.slug}@openwatch.internal`
    const { data: authUsers } = await sb.auth.admin.listUsers()
    const authUser = authUsers?.users?.find(u => u.email === email)

    if (!authUser) {
      console.log(`  No profile found — run create-chrono24-dealer-profiles.mjs first`)
      continue
    }
    const dealerProfileId = authUser.id
    console.log(`  Profile: ${dealerProfileId}`)

    // Fetch all active chrono24 listings for this dealer (paginated)
    let allListings = []
    let from = 0
    const pageSize = 1000
    while (true) {
      const { data, error } = await sb
        .from('chrono24_listings')
        .select('*')
        .eq('merchant_id', c24Dealer.merchant_id)
        .eq('is_sold', false)
        .range(from, from + pageSize - 1)
      if (error) { console.error('  Fetch error:', error.message); break }
      if (!data || data.length === 0) break
      allListings.push(...data)
      if (data.length < pageSize) break
      from += pageSize
    }
    console.log(`  Active C24 listings: ${allListings.length}`)

    // Filter: skip items below $500 (accessories, straps, etc.)
    const pricedListings = allListings.filter(l => l.price && parseFloat(l.price) > 500)
    console.log(`  After price filter (>$500): ${pricedListings.length}`)

    // Map to listings table format
    let skippedNoBrand = 0
    const toUpsert = []

    for (const l of pricedListings) {
      // Brand lookup: try brand_name field first, then extract from title prefix
      const brand = lookupBrand(l.brand_name, l.title, brandMap)
      if (!brand) {
        skippedNoBrand++
        continue
      }

      const price = parseFloat(l.price)
      const ref = l.reference_number || extractRef(l.title) || null

      toUpsert.push({
        dealer_id: dealerProfileId,
        brand_id: brand.id,
        model_id: null,  // no model matching for imported data
        source: 'chrono24',
        external_id: l.chrono24_id,
        external_url: l.listing_url,
        reference_number: ref,
        wholesale_price: price.toFixed(2),  // use C24 asking price as wholesale_price
        retail_price: price.toFixed(2),     // same price shown publicly
        currency: l.currency || 'USD',
        images: l.image_url ? [l.image_url] : [],
        status: 'active',
        condition: normalizeCondition(l.condition),
        notes: l.title,
        accepts_inquiries: false,  // C24 listings go through Chrono24
        listed_at: l.first_seen_at || l.created_at,
      })
    }

    if (skippedNoBrand > 0) {
      console.log(`  Skipped (no brand match): ${skippedNoBrand}`)
    }
    console.log(`  Upserting: ${toUpsert.length} listings…`)

    // Upsert in batches of 100
    let inserted = 0
    let errors = 0
    for (let i = 0; i < toUpsert.length; i += 100) {
      const chunk = toUpsert.slice(i, i + 100)
      const { error } = await sb
        .from('listings')
        .upsert(chunk, { onConflict: 'source,external_id' })
      if (error) {
        console.error(`\n  Batch error at ${i}:`, error.message)
        errors++
      } else {
        inserted += chunk.length
        process.stdout.write(`  Progress: ${inserted}/${toUpsert.length}\r`)
      }
    }
    console.log(`\n  ✅ Upserted: ${inserted} | Errors: ${errors}`)

    // Mark sold listings in the main listings table
    const { data: soldC24 } = await sb
      .from('chrono24_listings')
      .select('chrono24_id')
      .eq('merchant_id', c24Dealer.merchant_id)
      .eq('is_sold', true)

    if (soldC24 && soldC24.length > 0) {
      const soldIds = soldC24.map(l => l.chrono24_id)
      // Process in chunks to avoid IN clause limits
      for (let i = 0; i < soldIds.length; i += 500) {
        const chunk = soldIds.slice(i, i + 500)
        await sb
          .from('listings')
          .update({ status: 'sold', sold_at: new Date().toISOString() })
          .eq('source', 'chrono24')
          .in('external_id', chunk)
      }
      console.log(`  Marked ${soldIds.length} as sold`)
    }

    // Update dealer's total_listings count in profiles
    await sb
      .from('profiles')
      .update({ total_listings: inserted })
      .eq('id', dealerProfileId)
  }

  // Final summary
  console.log('\n── Summary ──')
  const { count: total } = await sb.from('listings').select('*', { count: 'exact', head: true }).is('deleted_at', null)
  const { count: c24Count } = await sb.from('listings').select('*', { count: 'exact', head: true }).eq('source', 'chrono24').is('deleted_at', null)
  const { count: owCount } = await sb.from('listings').select('*', { count: 'exact', head: true }).eq('source', 'openwatch').is('deleted_at', null)
  console.log(`Total listings: ${total}`)
  console.log(`  OpenWatch:  ${owCount}`)
  console.log(`  Chrono24:   ${c24Count}`)
  console.log('\n✅ Import complete!')
}

main().catch(console.error)
