import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

export interface SearchResult {
  type: "listing" | "ref" | "brand" | "dealer"
  id: string
  title: string
  subtitle: string
  href: string
  image?: string | null
  price?: number | null
  currency?: string
  badge?: string
  badgeColor?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

function toArr(val: unknown): Row[] {
  if (!val) return []
  if (Array.isArray(val)) return val as Row[]
  return [val as Row]
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim()
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  const supabase = await createClient()
  const results: SearchResult[] = []

  // ── Parallel: search listings by ref, brands by name, models by name/ref ──
  const [listingsByRef, brandsData, modelsData] = await Promise.all([
    supabase
      .from("listings")
      .select("id, ref_number, asking_price, currency, condition, brand:brands(id,name,slug), model:models(id,name), images")
      .eq("status", "active")
      .is("deleted_at", null)
      .ilike("ref_number", `%${q}%`)
      .limit(6),

    supabase
      .from("brands")
      .select("id, name, slug, logo_url")
      .is("deleted_at", null)
      .ilike("name", `%${q}%`)
      .limit(4),

    supabase
      .from("models")
      .select("id, name, ref_number, brand:brands(id,name,slug)")
      .or(`name.ilike.%${q}%, ref_number.ilike.%${q}%`)
      .limit(6),
  ])

  // ── Search listings by model_id (from model name matches) ──
  const modelIds = (modelsData.data ?? []).map((m: Row) => m.id).filter(Boolean)
  const brandIds = (brandsData.data ?? []).map((b: Row) => b.id).filter(Boolean)

  const [listingsByModel, listingsByBrand] = await Promise.all([
    modelIds.length > 0
      ? supabase
          .from("listings")
          .select("id, ref_number, asking_price, currency, condition, brand:brands(id,name,slug), model:models(id,name), images")
          .eq("status", "active")
          .is("deleted_at", null)
          .in("model_id", modelIds)
          .limit(6)
      : { data: [] },

    brandIds.length > 0
      ? supabase
          .from("listings")
          .select("id, ref_number, asking_price, currency, condition, brand:brands(id,name,slug), model:models(id,name), images")
          .eq("status", "active")
          .is("deleted_at", null)
          .in("brand_id", brandIds)
          .limit(6)
      : { data: [] },
  ])

  // ── Deduplicate all listing rows by id ──
  const seen = new Set<string>()
  const allListings: Row[] = (
    [
      ...(listingsByRef.data ?? []),
      ...(listingsByModel.data ?? []),
      ...(listingsByBrand.data ?? []),
    ] as Row[]
  ).filter((l: Row) => {
    if (!l || seen.has(l.id as string)) return false
    seen.add(l.id as string)
    return true
  })

  // ── Convert listings → results ──
  for (const l of allListings.slice(0, 8)) {
    const brand = toArr(l.brand)[0]
    const model = toArr(l.model)[0]
    const brandName = brand?.name ?? ""
    const modelName = model?.name ?? ""
    const images = (l.images as string[] | null) ?? []

    results.push({
      type: "listing",
      id: l.id,
      title: [brandName, modelName].filter(Boolean).join(" ") || l.ref_number || "Watch",
      subtitle: [l.ref_number, l.condition].filter(Boolean).join(" · ") || "Listing",
      href: `/listing/${l.id}`,
      image: images[0] ?? null,
      price: l.asking_price,
      currency: l.currency ?? "USD",
    })
  }

  // ── Brands ──
  for (const b of (brandsData.data ?? []) as Row[]) {
    results.push({
      type: "brand",
      id: b.id,
      title: b.name,
      subtitle: "Brand · View all watches",
      href: `/brands/${b.slug ?? b.id}`,
      image: b.logo_url ?? null,
      badge: "Brand",
      badgeColor: "#2081E2",
    })
  }

  // ── Ref pages ──
  const refSet = new Set<string>()
  for (const l of allListings) {
    if (l.ref_number) refSet.add(l.ref_number)
  }
  for (const m of (modelsData.data ?? []) as Row[]) {
    if (m.ref_number) refSet.add(m.ref_number)
  }

  for (const ref of Array.from(refSet).slice(0, 4)) {
    const matchListing = allListings.find((l) => l.ref_number === ref)
    const brand = matchListing ? toArr(matchListing.brand)[0] : null

    results.push({
      type: "ref",
      id: `ref-${ref}`,
      title: `Ref. ${ref}`,
      subtitle: brand?.name
        ? `${brand.name} · Market data & price history`
        : "Market data & price history",
      href: `/ref/${encodeURIComponent(ref)}`,
      badge: "Ref",
      badgeColor: "#10b981",
    })
  }

  // ── Sort: refs first, then listings, then brands ──
  const order: Record<string, number> = { ref: 0, listing: 1, brand: 2, dealer: 3 }
  results.sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9))

  return NextResponse.json({ results: results.slice(0, 12) })
}
