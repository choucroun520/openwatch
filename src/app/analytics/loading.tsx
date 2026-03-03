import AppLayout from "@/components/layout/app-layout"
import { Skeleton } from "@/components/ui/skeleton"

export default function AnalyticsLoading() {
  return (
    <AppLayout>
      <main className="max-w-7xl mx-auto space-y-8">
        <div>
          <Skeleton className="h-9 w-56 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-bg-card border border-border rounded-xl p-5"
            >
              <Skeleton className="h-3 w-24 mb-2" />
              <Skeleton className="h-7 w-20" />
            </div>
          ))}
        </div>
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-4">
            <Skeleton className="h-5 w-32" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-4 p-4 border-t border-border"
            >
              <Skeleton className="h-4 w-6" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </div>
      </main>
    </AppLayout>
  )
}
