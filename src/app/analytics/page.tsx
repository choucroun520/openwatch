import { createClient } from "@/lib/supabase/server"
import AppLayout from "@/components/layout/app-layout"
import AnalyticsClient from "./_client"

export const metadata = { title: "Analytics — OpenWatch" }

export default async function AnalyticsPage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const [listingsResult, brandsResult, eventsResult, compsCountResult, compsLastResult] =
    await Promise.all([
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
      db
        .from("market_comps")
        .select("reference_number", { count: "exact", head: false }),
      db
        .from("market_comps")
        .select("scraped_at")
        .order("scraped_at", { ascending: false })
        .limit(1),
    ])

  // Compute market data summary
  const allComps = compsCountResult.data ?? []
  const totalComps = allComps.length
  const refsCovered = new Set(allComps.map((c: { reference_number: string }) => c.reference_number)).size
  const avgCompsPerRef = refsCovered > 0 ? Math.round(totalComps / refsCovered) : 0
  const lastScraped: string | null = compsLastResult.data?.[0]?.scraped_at ?? null

  return (
    <AppLayout>
      <main className="max-w-7xl mx-auto">
        <AnalyticsClient
          listings={listingsResult.data || []}
          brands={brandsResult.data || []}
          events={eventsResult.data || []}
          marketData={{
            totalComps,
            refsCovered,
            avgCompsPerRef,
            lastScraped,
          }}
        />
      </main>
    </AppLayout>
  )
}
