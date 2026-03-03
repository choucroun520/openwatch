import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import TopNav from "@/components/layout/top-nav"
import InventoryClient from "./_client"
import type { Listing, Brand, Model } from "@/lib/types"

export const metadata = { title: "My Inventory — OpenWatch" }

export default async function InventoryPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [listingsResult, brandsResult] = await Promise.all([
    supabase
      .from("listings")
      .select("*, brand:brands(id,name,slug,icon), model:models(id,name,category)")
      .eq("dealer_id", user.id)
      .is("deleted_at", null)
      .order("listed_at", { ascending: false }),
    supabase
      .from("brands")
      .select("id,name,slug,icon")
      .is("deleted_at", null)
      .order("name"),
  ])

  return (
    <div className="min-h-screen bg-bg">
      <TopNav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <InventoryClient
          initialListings={
            (listingsResult.data || []) as (Listing & {
              brand: Brand
              model: Model
            })[]
          }
          brands={(brandsResult.data || []) as Brand[]}
          userId={user.id}
        />
      </main>
    </div>
  )
}
