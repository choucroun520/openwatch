import AppLayout from "@/components/layout/app-layout";
import { Skeleton } from "@/components/ui/skeleton";

export default function ListingLoading() {
  return (
    <AppLayout>
      <main className="max-w-6xl mx-auto">
        {/* Breadcrumb skeleton */}
        <Skeleton className="h-4 w-64 mb-6" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Image skeleton */}
          <div className="space-y-4">
            <Skeleton className="min-h-96 rounded-xl w-full" style={{ height: "384px" }} />
            {/* Completeness cards skeleton */}
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          </div>

          {/* Right: Info skeleton */}
          <div className="space-y-4">
            {/* Dealer row */}
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>

            {/* Brand + title */}
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-72" />
              <Skeleton className="h-4 w-32" />
            </div>

            {/* Traits grid */}
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>

            {/* Price box */}
            <Skeleton className="h-36 rounded-xl" />
          </div>
        </div>
      </main>
    </AppLayout>
  );
}
