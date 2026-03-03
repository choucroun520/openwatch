import { createClient } from "@/lib/supabase/server"
import AppLayout from "@/components/layout/app-layout"
import AnalyticsClient from "./_client"

export const metadata = { title: "Analytics — OpenWatch" }

export default async function AnalyticsPage() {
  const supabase = await createClient()

  const [listingsResult, brandsResult, eventsResult] = await Promise.all([
    supabase
      .from("listings")
      .select(
        "id, dealer_id, brand_id, model_id, wholesale_price, status, listed_at, sold_at, brand:brands(id,name,slug), model:models(id,name)"
      )
      .is("deleted_at", null),
    supabase
      .from("brands")
      .select("id,name,slug,icon,annual_production")
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("market_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
  ])

  return (
    <AppLayout>
      <main className="max-w-7xl mx-auto">
        <AnalyticsClient
          listings={listingsResult.data || []}
          brands={brandsResult.data || []}
          events={eventsResult.data || []}
        />
      </main>
    </AppLayout>
  )
}
