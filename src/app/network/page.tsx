import { createClient } from "@/lib/supabase/server";
import NetworkGrid from "@/components/network/network-grid";
import TopNav from "@/components/layout/top-nav";
import type { ListingWithRelations, Brand } from "@/lib/types";

export const metadata = { title: "Network — OpenWatch" };

export default async function NetworkPage() {
  const supabase = await createClient();

  // Fetch listings with all relations
  const { data: listings } = await supabase
    .from("listings")
    .select(
      `
      *,
      brand:brands(*),
      model:models(*),
      dealer:profiles!dealer_id(id, full_name, company_name, avatar_url, verified, seller_rating, total_sales)
    `
    )
    .eq("status", "active")
    .is("deleted_at", null)
    .order("listed_at", { ascending: false });

  // Fetch all brands for filter tabs
  const { data: brands } = await supabase
    .from("brands")
    .select("*")
    .is("deleted_at", null)
    .order("name");

  return (
    <div className="min-h-screen" style={{ background: "#0b0b14" }}>
      <TopNav />
      <div className="max-w-[1400px] mx-auto">
        <NetworkGrid
          listings={(listings || []) as ListingWithRelations[]}
          brands={(brands || []) as Brand[]}
        />
      </div>
    </div>
  );
}
