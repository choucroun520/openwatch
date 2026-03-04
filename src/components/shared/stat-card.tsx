import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  icon?: ReactNode
  change?: number
  className?: string
  valueClass?: string
}

export function StatCard({ label, value, sub, icon, change, className, valueClass }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl p-4 border flex flex-col gap-1",
        className
      )}
      style={{ background: "var(--ow-bg-card)", borderColor: "var(--ow-border)" }}
    >
      {icon && (
        <div className="mb-1 text-muted-foreground">{icon}</div>
      )}
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
        {label}
      </p>
      <p className={cn("text-xl font-black font-mono text-foreground", valueClass)}>
        {value}
      </p>
      {sub && (
        <p className="text-xs text-muted-foreground">{sub}</p>
      )}
      {typeof change === "number" && (
        <p className={cn("text-xs font-medium", change >= 0 ? "text-green-400" : "text-red-400")}>
          {change >= 0 ? "+" : ""}{change.toFixed(1)}%
        </p>
      )}
    </div>
  )
}
