import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, "../.env.local") })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Get RC Crown dealer id
const { data: dealer } = await sb.from("profiles").select("id").eq("email", "inventory@rccrown.com").maybeSingle()
const dealerId = dealer?.id
console.log("RC Crown dealer id:", dealerId)

// Get all RC Crown listings
const { data: all } = await sb.from("listings")
  .select("id, source, external_id, reference_number, wholesale_price, status, created_at")
  .eq("dealer_id", dealerId)
  .order("created_at", { ascending: true })

console.log("Total RC Crown listings:", all?.length)

// Find duplicate external_ids
const byExt = {}
for (const r of all ?? []) {
  if (!byExt[r.external_id]) byExt[r.external_id] = []
  byExt[r.external_id].push(r)
}
const dups = Object.entries(byExt).filter(([, rows]) => rows.length > 1)
console.log("Duplicate external_ids:", dups.length)

// Find duplicate ref numbers (legitimate - multiple copies of same watch)
const byRef = {}
for (const r of all ?? []) {
  if (!r.reference_number) continue
  if (!byRef[r.reference_number]) byRef[r.reference_number] = []
  byRef[r.reference_number].push(r)
}
const dupRefs = Object.entries(byRef).filter(([, rows]) => rows.length > 1)
console.log("\nMultiple copies of same ref (may be legit):")
for (const [ref, rows] of dupRefs) {
  console.log(`  ${ref}: ${rows.length} copies — prices: ${rows.map(r => "$" + parseFloat(r.wholesale_price).toLocaleString()).join(", ")}`)
}

// If there are true duplicate external_ids (same UUID inserted twice), delete the older ones
if (dups.length > 0) {
  console.log("\nFixing true duplicates (same external_id)...")
  const toDelete = []
  for (const [, rows] of dups) {
    // Keep the newest, delete the rest
    const sorted = rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    toDelete.push(...sorted.slice(1).map(r => r.id))
  }
  if (toDelete.length > 0) {
    const { error } = await sb.from("listings").delete().in("id", toDelete)
    if (error) console.error("Delete error:", error.message)
    else console.log(`  Deleted ${toDelete.length} true duplicate rows`)
  }
} else {
  console.log("\n✅ No true duplicates found — all duplicates are legitimate multiple copies of the same ref")
}
