import { cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  positive?: boolean;
  width?: number;
  height?: number;
  className?: string;
}

let gradientCounter = 0;

export function Sparkline({
  data,
  positive,
  width = 80,
  height = 30,
  className,
}: SparklineProps) {
  if (data.length < 2) {
    return <svg width={width} height={height} className={className} aria-hidden="true" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;

  // Build (x, y) coordinates for each data point
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y =
      range === 0
        ? height / 2
        : height - ((d - min) / range) * (height - 4) - 2;
    return { x, y };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Polygon for gradient fill: same as polyline + bottom-right + bottom-left
  const polygonPoints = [
    ...points.map((p) => `${p.x},${p.y}`),
    `${width},${height}`,
    `0,${height}`,
  ].join(" ");

  // Determine color: use `positive` prop if provided, else derive from trend
  const isUp = positive ?? data[data.length - 1] > data[0];
  const color = isUp ? "#22c55e" : "#ef4444";

  // Use a stable unique gradient ID per component instance
  gradientCounter += 1;
  const gradientId = `sparkline-gradient-${gradientCounter}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Gradient fill polygon */}
      <polygon
        points={polygonPoints}
        fill={`url(#${gradientId})`}
        opacity="0.3"
      />

      {/* Line */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
