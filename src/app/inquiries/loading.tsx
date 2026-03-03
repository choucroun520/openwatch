import AppLayout from "@/components/layout/app-layout"
import { Skeleton } from "@/components/ui/skeleton"

export default function InquiriesLoading() {
  return (
    <AppLayout>
      <main className="max-w-7xl mx-auto">
        <Skeleton className="h-8 w-32 mb-6" />
        <div className="flex gap-4 mb-4">
          <Skeleton className="h-9 w-32 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex gap-4 items-center p-4 border-b border-border"
            >
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-48 flex-1" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-7 w-16 rounded" />
            </div>
          ))}
        </div>
      </main>
    </AppLayout>
  )
}
