/**
 * create-chrono24-dealer-profiles.mjs
 *
 * Creates Supabase auth users + profile rows for each Chrono24 dealer
 * that doesn't already have a profile. Run once before import-chrono24-to-listings.mjs.
 *
 * Usage:
 *   node scripts/create-chrono24-dealer-profiles.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  const { data: c24Dealers, error: dealersErr } = await sb.from('chrono24_dealers').select('*')
  if (dealersErr) { console.error('Failed to fetch chrono24_dealers:', dealersErr.message); process.exit(1) }
  if (!c24Dealers || c24Dealers.length === 0) {
    console.log('No Chrono24 dealers found. Run scrape-chrono24-dealer.mjs first.')
    return
  }

  console.log(`Found ${c24Dealers.length} Chrono24 dealer(s).\n`)

  for (const dealer of c24Dealers) {
    const email = `chrono24-${dealer.slug}@openwatch.internal`

    // Check if profile already exists by email in auth
    const { data: existingAuth } = await sb.auth.admin.listUsers()
    const existingUser = existingAuth?.users?.find(u => u.email === email)

    if (existingUser) {
      // Ensure profile row exists
      const { data: existingProfile } = await sb
        .from('profiles')
        .select('id')
        .eq('id', existingUser.id)
        .single()

      if (existingProfile) {
        console.log(`✓ Already exists: ${dealer.name} (${existingUser.id})`)
        continue
      }

      // Profile row missing — create it
      const { error: profileErr } = await sb.from('profiles').insert({
        id: existingUser.id,
        email,
        full_name: dealer.name,
        company_name: dealer.name,
        role: 'dealer',
        verified: true,
        bio: `Luxury watch dealer on Chrono24 with ${dealer.total_listings.toLocaleString()} listings.`,
        location: dealer.country ?? null,
        total_listings: dealer.total_listings,
      })
      if (profileErr) {
        console.error(`  Profile insert error for ${dealer.name}:`, profileErr.message)
        continue
      }
      console.log(`✓ Created profile (existing auth) for ${dealer.name}: ${existingUser.id}`)
      continue
    }

    // Create new auth user
    const { data: authData, error: authErr } = await sb.auth.admin.createUser({
      email,
      password: `C24-${dealer.slug}-${Date.now()}`,
      email_confirm: true,
    })
    if (authErr) { console.error(`  Auth error for ${dealer.name}:`, authErr.message); continue }

    const userId = authData.user.id

    // Create profile row
    const { error: profileErr } = await sb.from('profiles').insert({
      id: userId,
      email,
      full_name: dealer.name,
      company_name: dealer.name,
      role: 'dealer',
      verified: true,
      bio: `Luxury watch dealer on Chrono24 with ${dealer.total_listings.toLocaleString()} listings.`,
      location: dealer.country ?? null,
      total_listings: dealer.total_listings,
    })
    if (profileErr) {
      console.error(`  Profile error for ${dealer.name}:`, profileErr.message)
      continue
    }

    console.log(`✅ Created profile for ${dealer.name}`)
    console.log(`   ID:    ${userId}`)
    console.log(`   Email: ${email}`)
  }

  console.log('\n✅ Done.')
}

main().catch(console.error)
