import { Skeleton } from "@/components/ui/skeleton";

export function CardSkeleton() {
  return (
    <div className="bg-bg-card rounded-lg border border-border overflow-hidden">
      {/* Image area — ~48% height of h-72 = ~138px */}
      <Skeleton className="w-full h-[138px] rounded-none" />

      {/* Content area */}
      <div className="p-3 flex flex-col gap-2.5">
        {/* Brand name + avatar row */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded-full flex-shrink-0" />
          <Skeleton className="h-3 w-20" />
        </div>

        {/* Model title */}
        <Skeleton className="h-4 w-36" />

        {/* Reference / Year / Material */}
        <Skeleton className="h-3 w-28" />

        {/* Price row */}
        <div className="flex items-center justify-between mt-1">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <tr className="border-b border-border">
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-32" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-24" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-20" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-16" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-16" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-16" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-20" />
      </td>
    </tr>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-bg-card border border-border rounded-lg p-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-6 w-28 mt-2" />
    </div>
  );
}
