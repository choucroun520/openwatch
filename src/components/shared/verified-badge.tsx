import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: { circle: 14, check: 8 },
  md: { circle: 16, check: 9 },
  lg: { circle: 20, check: 11 },
};

export function VerifiedBadge({ size = "md", className }: VerifiedBadgeProps) {
  const { circle, check } = sizeMap[size];

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-blue-600 flex-shrink-0",
        className
      )}
      style={{ width: circle, height: circle }}
      aria-label="Verified"
      title="Verified"
    >
      <svg
        width={check}
        height={check}
        viewBox="0 0 10 10"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M1.5 5L4 7.5L8.5 2.5"
          stroke="white"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
