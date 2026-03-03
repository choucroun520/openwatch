import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import TopNav from "@/components/layout/top-nav"
import AdminClient from "./_client"

export const metadata = { title: "Admin — OpenWatch" }

export default async function AdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: profile } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    redirect("/network")
  }

  const [dealersResult, inviteCodesResult] = await Promise.all([
    db
      .from("profiles")
      .select("id, full_name, company_name, email, role, verified, joined_at")
      .is("deleted_at", null)
      .order("joined_at", { ascending: false }),
    db
      .from("invite_codes")
      .select("*")
      .order("created_at", { ascending: false }),
  ])

  return (
    <div className="min-h-screen bg-bg">
      <TopNav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <AdminClient
          dealers={dealersResult.data || []}
          inviteCodes={inviteCodesResult.data || []}
        />
      </main>
    </div>
  )
}
