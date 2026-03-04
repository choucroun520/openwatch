import { cn } from "@/lib/utils";

interface PriceChangeProps {
  value: number;
  className?: string;
}

export function PriceChange({ value, className }: PriceChangeProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;

  const colorClass = isPositive
    ? "text-success"
    : isNegative
      ? "text-danger"
      : "text-[var(--ow-text-faint)]";

  const formatted = `${isPositive ? "+" : ""}${value.toFixed(1)}%`;

  return (
    <span className={cn("font-mono text-sm font-semibold", colorClass, className)}>
      {formatted}
    </span>
  );
}
