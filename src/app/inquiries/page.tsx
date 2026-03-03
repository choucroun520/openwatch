import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import AppLayout from "@/components/layout/app-layout"
import InquiriesClient from "./_client"

export const metadata = { title: "Inquiries — OpenWatch" }

export default async function InquiriesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: inquiries } = await supabase
    .from("deal_inquiries")
    .select(
      `
      *,
      listing:listings(id, reference_number, wholesale_price, brand:brands(name,slug), model:models(name)),
      from_dealer:profiles!from_dealer_id(id, full_name, company_name, verified),
      to_dealer:profiles!to_dealer_id(id, full_name, company_name, verified)
    `
    )
    .or(`from_dealer_id.eq.${user.id},to_dealer_id.eq.${user.id}`)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  return (
    <AppLayout>
      <main className="max-w-7xl mx-auto">
        <InquiriesClient inquiries={inquiries || []} userId={user.id} />
      </main>
    </AppLayout>
  )
}
