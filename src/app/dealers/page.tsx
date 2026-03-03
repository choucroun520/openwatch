import { createClient } from "@/lib/supabase/server"
import AppLayout from "@/components/layout/app-layout"
import { VerifiedBadge } from "@/components/shared/verified-badge"
import Link from "next/link"
import Chrono24DealersSection from "./chrono24-dealers-section"

export const metadata = { title: "Dealers — OpenWatch" }
export const dynamic = "force-dynamic"

export default async function DealersPage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: dealers } = await db
    .from("profiles")
    .select("id, full_name, company_name, avatar_url, verified, seller_rating, total_sales, total_listings, location, specialties")
    .in("role", ["dealer", "admin", "super_admin"])
    .is("deleted_at", null)
    .order("total_listings", { ascending: false })

  return (
    <AppLayout>
      <div className="max-w-[1200px] mx-auto space-y-10">

        {/* OpenWatch Dealers */}
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-black text-white">OpenWatch Dealers</h1>
            <p className="text-sm mt-1" style={{ color: "#8A939B" }}>
              Verified luxury watch dealers on the OpenWatch network
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {((dealers ?? []) as any[]).map((dealer: any) => {
              const companyName = dealer.company_name ?? dealer.full_name ?? "Unknown Dealer"
              const isRcCrown = companyName.toUpperCase().startsWith("RC")
              const initial = isRcCrown ? "RC" : companyName[0]?.toUpperCase() ?? "D"
              const avatarBg = isRcCrown ? "#006039" : "linear-gradient(135deg, #2563eb, #7c3aed)"

              return (
                <div
                  key={dealer.id}
                  className="rounded-2xl p-6"
                  style={{ background: "#1E1E2E", border: "1px solid #333333" }}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center text-white font-black text-lg shrink-0"
                      style={{ background: avatarBg, fontSize: isRcCrown ? 14 : 20 }}
                    >
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-white text-lg leading-tight">{companyName}</h3>
                        {dealer.verified && <VerifiedBadge />}
                      </div>
                      {dealer.location && (
                        <p className="text-sm mt-0.5" style={{ color: "#8A939B" }}>{dealer.location}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-4 mb-4">
                    <div>
                      <p className="text-lg font-black font-mono text-white">{dealer.total_listings ?? 0}</p>
                      <p className="text-[11px]" style={{ color: "#8A939B" }}>Listings</p>
                    </div>
                    <div>
                      <p className="text-lg font-black font-mono text-white">{dealer.total_sales ?? 0}</p>
                      <p className="text-[11px]" style={{ color: "#8A939B" }}>Sales</p>
                    </div>
                    {parseFloat(dealer.seller_rating) > 0 && (
                      <div>
                        <p className="text-lg font-black font-mono text-white">{parseFloat(dealer.seller_rating).toFixed(1)}</p>
                        <p className="text-[11px]" style={{ color: "#8A939B" }}>Rating</p>
                      </div>
                    )}
                  </div>

                  {dealer.specialties && dealer.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {(dealer.specialties as string[]).slice(0, 3).map((s: string) => (
                        <span
                          key={s}
                          className="text-[11px] px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(32,129,226,0.12)", color: "#2081E2", border: "1px solid rgba(32,129,226,0.2)" }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  <Link
                    href={`/network?dealer=${dealer.id}`}
                    className="block w-full text-center py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: "#2081E2" }}
                  >
                    View Inventory
                  </Link>
                </div>
              )
            })}
            {(dealers ?? []).length === 0 && (
              <div className="col-span-full py-12 text-center" style={{ color: "#8A939B" }}>
                No dealers found.
              </div>
            )}
          </div>
        </div>

        {/* Chrono24 Market Dealers (client component) */}
        <Chrono24DealersSection />
      </div>
    </AppLayout>
  )
}
