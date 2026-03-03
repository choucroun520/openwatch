import { cn } from "@/lib/utils";

interface ConditionBadgeProps {
  condition: string;
  className?: string;
}

function getConditionStyles(condition: string): string {
  switch (condition) {
    case "Unworn":
    case "Mint":
      return "bg-green-500/15 text-green-400 border border-green-500/30";
    case "Excellent":
    case "Very Good":
      return "bg-blue-500/15 text-blue-400 border border-blue-500/30";
    case "Good":
      return "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30";
    case "Fair":
      return "bg-red-500/15 text-red-400 border border-red-500/30";
    default:
      return "bg-gray-500/15 text-gray-400 border border-gray-500/30";
  }
}

export function ConditionBadge({ condition, className }: ConditionBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        getConditionStyles(condition),
        className
      )}
    >
      {condition}
    </span>
  );
}
