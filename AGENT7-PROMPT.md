Read CLAUDE.md, OPENWATCH-CONTEXT.md, and all existing src/ files before writing anything.

You are fixing the core data pipeline: Chrono24 scraped listings are in `chrono24_listings` but the UI reads from `listings`. You need to unify them so every scraped dealer appears in the main marketplace.

DO NOT touch: middleware.ts, auth logic.

## THE PROBLEM

- `listings` table = what the UI shows (currently 58 RC Crown watches)
- `chrono24_listings` table = 1,058 Jewels in Time watches (scraped, never shown)
- The network page, listing cards, rankings, activity feed all query `listings` only
- Fix: import chrono24_listings → listings, keep them in sync going forward

---

## STEP 1: Migration 00017 — add source columns to listings

File: `supabase/migrations/00017_listings_source.sql`

```sql
-- Add external source tracking to listings
ALTER TABLE listings 
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'openwatch',
  ADD COLUMN IF NOT EXISTS external_id TEXT,       -- chrono24 listing ID, eBay ID, etc.
  ADD COLUMN IF NOT EXISTS external_url TEXT;       -- link to original listing

-- Index for fast lookup by external source
CREATE INDEX IF NOT EXISTS idx_listings_source ON listings(source);
CREATE INDEX IF NOT EXISTS idx_listings_external_id ON listings(external_id);

-- Unique constraint: one listing per external ID per source
CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_external_unique 
  ON listings(source, external_id) 
  WHERE external_id IS NOT NULL;
```

Apply with: `npx supabase db push --local=false`

---

## STEP 2: Create Jewels in Time dealer profile

Run this script once to create the dealer profile and get the UUID:

```typescript
// scripts/create-chrono24-dealer-profiles.mjs
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get all chrono24_dealers that don't have a profile yet
const { data: c24Dealers } = await sb.from('chrono24_dealers').select('*');

for (const dealer of c24Dealers) {
  // Check if profile already exists
  const { data: existing } = await sb
    .from('profiles')
    .select('id')
    .eq('display_name', dealer.name)
    .single();
  
  if (existing) {
    console.log(`Profile already exists for ${dealer.name}: ${existing.id}`);
    // Update chrono24_dealers with profile_id
    // (add profile_id column if needed)
    continue;
  }

  // Create auth user for this dealer
  const email = `chrono24-${dealer.slug}@openwatch.internal`;
  const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
    email,
    password: `C24-${dealer.slug}-${Date.now()}`,
    email_confirm: true,
  });
  
  if (authErr) { console.error('Auth error:', authErr.message); continue; }
  
  // Create profile
  const { data: profile, error: profileErr } = await sb.from('profiles').insert({
    id: authUser.user.id,
    display_name: dealer.name,
    role: 'dealer',
    is_verified: true,
    bio: `Luxury watch dealer on Chrono24. ${dealer.total_listings} listings.`,
  }).select().single();
  
  if (profileErr) { console.error('Profile error:', profileErr.message); continue; }
  console.log(`✅ Created profile for ${dealer.name}: ${profile.id}`);
  console.log(`   Email: ${email}`);
}
```

---

## STEP 3: Import script — scripts/import-chrono24-to-listings.mjs

This is the critical script. It reads all active chrono24_listings and upserts them into the main listings table.

```javascript
// scripts/import-chrono24-to-listings.mjs
// Run after: create-chrono24-dealer-profiles.mjs

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config({ path: '.env.local' });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Get all chrono24 dealers with their profile IDs
  const { data: c24Dealers } = await sb
    .from('chrono24_dealers')
    .select('id, name, slug, merchant_id');

  // Find matching profile for each dealer by display_name
  for (const c24Dealer of c24Dealers) {
    const { data: profile } = await sb
      .from('profiles')
      .select('id')
      .eq('display_name', c24Dealer.name)
      .single();

    if (!profile) {
      console.log(`No profile for ${c24Dealer.name} — run create-chrono24-dealer-profiles.mjs first`);
      continue;
    }

    const dealerProfileId = profile.id;
    console.log(`\nImporting ${c24Dealer.name} (${dealerProfileId})...`);

    // Fetch all active chrono24 listings for this dealer
    let allListings = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await sb
        .from('chrono24_listings')
        .select('*')
        .eq('merchant_id', c24Dealer.merchant_id)
        .eq('is_sold', false)
        .range(from, from + pageSize - 1);
      if (error || !data || data.length === 0) break;
      allListings.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    console.log(`  Found ${allListings.length} active listings`);

    // Map to listings table format
    const toUpsert = allListings
      .filter(l => l.price && l.price > 500) // skip accessories
      .map(l => ({
        dealer_id: dealerProfileId,
        source: 'chrono24',
        external_id: l.chrono24_id,
        external_url: l.listing_url,
        reference_number: l.reference_number || extractRef(l.title),
        retail_price: l.price.toString(),  // IMPORTANT: money as strings per CLAUDE.md
        currency: l.currency || 'USD',
        images: l.image_url ? [l.image_url] : [],
        status: 'active',
        condition: l.condition || 'used',
        notes: l.title,
        listed_at: l.first_seen_at || l.created_at,
        updated_at: new Date().toISOString(),
      }));

    console.log(`  Upserting ${toUpsert.length} listings...`);

    // Upsert in batches of 100
    let inserted = 0;
    for (let i = 0; i < toUpsert.length; i += 100) {
      const chunk = toUpsert.slice(i, i + 100);
      const { error } = await sb
        .from('listings')
        .upsert(chunk, { onConflict: 'source,external_id' });
      if (error) {
        console.error(`  Batch error at ${i}:`, error.message);
      } else {
        inserted += chunk.length;
        process.stdout.write(`  ${inserted}/${toUpsert.length}\r`);
      }
    }
    console.log(`\n  ✅ Done: ${inserted} listings imported`);

    // Also mark sold listings as sold in main listings table
    const { data: soldC24 } = await sb
      .from('chrono24_listings')
      .select('chrono24_id')
      .eq('merchant_id', c24Dealer.merchant_id)
      .eq('is_sold', true);

    if (soldC24 && soldC24.length > 0) {
      const soldIds = soldC24.map(l => l.chrono24_id);
      await sb
        .from('listings')
        .update({ status: 'sold', sold_at: new Date().toISOString() })
        .eq('source', 'chrono24')
        .in('external_id', soldIds);
      console.log(`  Marked ${soldIds.length} as sold`);
    }
  }

  console.log('\n✅ Import complete!');
}

// Extract reference number from title like "Rolex GMT-Master II 126710BLRO"
function extractRef(title) {
  if (!title) return null;
  // Match reference patterns: digits + letters, 6-15 chars
  const match = title.match(/\b([A-Z0-9]{2}[A-Z0-9\-]{4,14})\b/);
  return match ? match[1] : null;
}

main().catch(console.error);
```

---

## STEP 4: Fix the UI to handle Chrono24 listings

### 4a: Update ListingCard for external listings

`chrono24` source listings have:
- `external_url` → link to Chrono24 instead of internal detail page
- `images[0]` instead of images array with multiple
- No `model_id` (null)
- `notes` = full title from Chrono24

Update `src/components/network/listing-card.tsx`:
- If `listing.source === 'chrono24'` and `listing.external_url`:
  - Card click → open `listing.external_url` in new tab (not internal `/listing/[id]`)
  - Show small "C24" badge in corner (chrono24 blue `#2881E2`, 10px text)
  - Use `listing.notes` as title if no model name
  - Show `listing.retail_price` as price

### 4b: Update network-grid query

In `src/components/network/network-grid.tsx` (or wherever listings are fetched):
- The query should already work since everything is in `listings` now
- But add `.not('status', 'eq', 'sold')` filter to hide sold listings

### 4c: Update listing detail page

In `src/app/listing/[id]/page.tsx`:
- If `listing.source === 'chrono24'` → show "View on Chrono24" button linking to `external_url`
- Show "Listed on Chrono24" badge in dealer section

---

## STEP 5: Update /dealers page

In `src/app/dealers/page.tsx`:
- The "Chrono24 Market Dealers" section should now show the dealer's listing count from the `listings` table (source='chrono24') not just chrono24_dealers table
- Add "Last synced: X min ago" to each Chrono24 dealer card
- The "View Inventory" button should filter the network page by dealer

---

## STEP 6: Run the migration + scripts in order

```bash
# 1. Apply migration
npx supabase db push --local=false

# 2. Create dealer profiles
node scripts/create-chrono24-dealer-profiles.mjs

# 3. Import all listings
node scripts/import-chrono24-to-listings.mjs
```

Check results:
```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { count: total } = await sb.from('listings').select('*', { count: 'exact', head: true });
  const { count: c24 } = await sb.from('listings').select('*', { count: 'exact', head: true }).eq('source', 'chrono24');
  const { count: ow } = await sb.from('listings').select('*', { count: 'exact', head: true }).eq('source', 'openwatch');
  console.log('Total listings:', total, '| OpenWatch:', ow, '| Chrono24:', c24);
})();
"
```

Expected: Total ~1000+, OpenWatch: 58, Chrono24: ~950+

---

## DONE CRITERIA

1. Migration 00017 applied (source, external_id, external_url on listings) ✅
2. Jewels in Time dealer profile created in profiles table ✅
3. All active Chrono24 listings imported into listings table ✅
4. Network page shows 1000+ listings (not just 58) ✅
5. Chrono24 listings have "C24" badge and link out to Chrono24 ✅
6. npx tsc --noEmit = 0 errors ✅
7. git add -A && git commit -m "feat: unify chrono24 listings into main marketplace — 1000+ listings visible" ✅

When completely done:
openclaw system event --text "Done: OpenWatch Agent 7 — Chrono24 listings unified into marketplace. All 1058 JIT listings visible in UI." --mode now
