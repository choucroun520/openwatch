import TopNav from "@/components/layout/top-nav";
import { CardSkeleton } from "@/components/shared/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function NetworkLoading() {
  return (
    <div className="min-h-screen bg-bg">
      <TopNav />
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats bar skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-bg-card border border-border rounded-lg p-4">
              <Skeleton className="h-3 w-24 mb-2" />
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>

        {/* Brand tabs skeleton */}
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full" />
          ))}
        </div>

        {/* Filter bar skeleton */}
        <div className="flex gap-3">
          <Skeleton className="h-8 w-36 rounded-md" />
          <Skeleton className="h-8 w-40 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-36 rounded-md" />
        </div>

        {/* Grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}
