import { notFound } from "next/navigation";
import Link from "next/link";
import { Watch, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import TopNav from "@/components/layout/top-nav";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { ConditionBadge } from "@/components/shared/condition-badge";
import InquiryDialog from "./_inquiry-dialog";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import type { ListingWithRelations } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("listings")
    .select("reference_number, brand_id, model_id")
    .eq("id", id)
    .single() as { data: { reference_number: string; brand_id: string; model_id: string } | null };

  if (!data) return { title: "Listing — OpenWatch" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: brand }, { data: model }] = await Promise.all([
    (supabase as any).from("brands").select("name").eq("id", data.brand_id).single() as Promise<{ data: { name: string } | null }>,
    (supabase as any).from("models").select("name").eq("id", data.model_id).single() as Promise<{ data: { name: string } | null }>,
  ]);

  return {
    title: `${brand?.name ?? ""} ${model?.name ?? ""} ${data.reference_number} — OpenWatch`,
  };
}

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch listing with all relations
  const { data: rawListing } = await supabase
    .from("listings")
    .select(
      `
      *,
      brand:brands(*),
      model:models(*),
      dealer:profiles!dealer_id(id, full_name, company_name, avatar_url, verified, seller_rating, total_sales)
    `
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!rawListing) {
    notFound();
  }

  const listing = rawListing as unknown as ListingWithRelations;

  // Increment views (fire and forget)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  void (supabase as any)
    .from("listings")
    .update({ views: listing.views + 1 })
    .eq("id", id);

  // Fetch model avg price
  const { data: modelListings } = await supabase
    .from("listings")
    .select("wholesale_price")
    .eq("model_id", listing.model_id)
    .eq("status", "active")
    .is("deleted_at", null)
    .neq("id", id);

  const modelPrices = (modelListings || [])
    .map((l: { wholesale_price: string }) => parseFloat(l.wholesale_price))
    .filter(Boolean);

  const avgPrice = modelPrices.length
    ? modelPrices.reduce((a: number, b: number) => a + b, 0) / modelPrices.length
    : 0;

  const priceDiff =
    avgPrice > 0
      ? ((parseFloat(listing.wholesale_price) - avgPrice) / avgPrice) * 100
      : 0;

  const sellerRating = parseFloat(listing.dealer.seller_rating as string) || 0;

  return (
    <div className="min-h-screen bg-bg">
      <TopNav />
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground mb-6 flex items-center gap-2 flex-wrap">
          <Link href="/network" className="hover:text-foreground transition-colors">
            Network
          </Link>
          <span>/</span>
          <Link
            href={`/network?brand=${listing.brand.slug}`}
            className="hover:text-foreground transition-colors"
          >
            {listing.brand.name}
          </Link>
          <span>/</span>
          <span className="text-foreground">
            {listing.model.name} {listing.reference_number}
          </span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LEFT: Image */}
          <div>
            <div
              className="relative rounded-xl overflow-hidden min-h-96 flex items-center justify-center"
              style={{
                background:
                  listing.brand.banner_gradient ||
                  "linear-gradient(135deg, #1e3a5f 0%, #111119 100%)",
              }}
            >
              <Watch className="w-32 h-32 text-white/15" />
              {listing.has_box && listing.has_papers && (
                <div className="absolute bottom-3 left-3 bg-green-500/20 text-green-400 border border-green-500/30 text-xs px-2 py-1 rounded-full">
                  Full Set
                </div>
              )}
              <div className="absolute bottom-3 right-3">
                <ConditionBadge condition={listing.condition} />
              </div>
            </div>

            {/* Completeness cards */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[
                { label: "Box", value: listing.has_box },
                { label: "Papers", value: listing.has_papers },
                { label: "Warranty", value: listing.has_warranty },
              ].map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    "rounded-lg p-3 text-center border",
                    item.value
                      ? "bg-green-500/10 border-green-500/20 text-green-400"
                      : "bg-bg-elevated border-border text-muted-foreground"
                  )}
                >
                  <p className="text-xs font-medium">{item.label}</p>
                  <p className="text-xs mt-0.5">
                    {item.value ? "Included" : "Not Included"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: Info */}
          <div className="space-y-5">
            {/* Dealer */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-600/30 flex items-center justify-center text-blue-400 font-bold text-sm flex-shrink-0">
                {(
                  listing.dealer.company_name ||
                  listing.dealer.full_name ||
                  "?"
                )[0].toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-foreground">
                    {listing.dealer.company_name || listing.dealer.full_name}
                  </span>
                  {listing.dealer.verified && <VerifiedBadge />}
                </div>
                <div className="flex items-center gap-0.5 mt-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "w-3 h-3",
                        i < Math.round(sellerRating)
                          ? "text-yellow-400 fill-yellow-400"
                          : "text-[#475569]"
                      )}
                    />
                  ))}
                  <span className="text-xs text-muted-foreground ml-1">
                    {listing.dealer.total_sales} sales
                  </span>
                </div>
              </div>
            </div>

            {/* Brand + Model */}
            <div>
              <Link
                href={`/network?brand=${listing.brand.slug}`}
                className="text-blue-400 text-sm font-medium hover:underline"
              >
                {listing.brand.name}
              </Link>
              <h1 className="text-2xl font-black text-foreground mt-0.5">
                {listing.model.name} · {listing.reference_number}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                {listing.year} · {listing.material}
              </p>
            </div>

            {/* Traits grid */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Brand", value: listing.brand.name },
                { label: "Model", value: listing.model.name },
                { label: "Reference", value: listing.reference_number },
                { label: "Material", value: listing.material },
                { label: "Dial", value: listing.dial_color },
                { label: "Case Size", value: listing.case_size || "—" },
                { label: "Year", value: listing.year.toString() },
                { label: "Condition", value: listing.condition },
                { label: "Movement", value: listing.movement || "—" },
              ].map((trait) => (
                <div
                  key={trait.label}
                  className="bg-blue-600/5 border border-blue-600/15 rounded-lg p-2.5 text-center"
                >
                  <p className="text-[10px] text-blue-400 uppercase font-bold tracking-wider">
                    {trait.label}
                  </p>
                  <p
                    className="text-sm font-semibold text-foreground mt-0.5 truncate"
                    title={trait.value}
                  >
                    {trait.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Price box */}
            <div className="bg-bg-card border border-border rounded-xl p-5">
              <p className="text-xs text-[#475569] uppercase tracking-wider">
                Wholesale Price
              </p>
              <p className="text-4xl font-black font-mono text-foreground mt-1">
                {formatCurrency(listing.wholesale_price)}
              </p>
              {avgPrice > 0 && (
                <p
                  className={cn(
                    "text-sm mt-1",
                    priceDiff < 0 ? "text-[#22c55e]" : "text-[#ef4444]"
                  )}
                >
                  {Math.abs(priceDiff).toFixed(1)}%{" "}
                  {priceDiff < 0 ? "below" : "above"} model avg (
                  {formatCurrency(avgPrice)})
                </p>
              )}
              <InquiryDialog listing={listing} />
            </div>

            {/* Dealer Notes */}
            {listing.notes && (
              <div className="bg-bg-elevated border border-border rounded-lg p-4">
                <p className="text-xs text-[#475569] uppercase tracking-wider mb-2">
                  Dealer Notes
                </p>
                <p className="text-sm text-muted-foreground">{listing.notes}</p>
              </div>
            )}

            {/* Complications */}
            {listing.complications && listing.complications.length > 0 && (
              <div>
                <p className="text-xs text-[#475569] uppercase tracking-wider mb-2">
                  Complications
                </p>
                <div className="flex flex-wrap gap-2">
                  {listing.complications.map((c) => (
                    <span
                      key={c}
                      className="bg-bg-elevated border border-border text-xs text-muted-foreground px-2 py-1 rounded-md"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
