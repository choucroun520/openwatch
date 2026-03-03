/**
 * Format a numeric value as currency string.
 * Always returns a string — never pass raw numbers to display.
 */
export function formatCurrency(
  value: number | string,
  currency = "USD",
  compact = false
): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "$0";

  if (compact) {
    if (num >= 1_000_000_000)
      return `$${(num / 1_000_000_000).toFixed(2)}B`;
    if (num >= 1_000_000)
      return `$${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000)
      return `$${(num / 1_000).toFixed(1)}K`;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/** Compact formatter for tables: $1.2M, $45K, $8,500 */
export function formatCompact(value: number | string): string {
  return formatCurrency(value, "USD", true);
}

/** Parse a currency string back to a number string suitable for DB storage */
export function parseCurrency(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? "0.00" : num.toFixed(2);
}

/** Format a percentage change with sign */
export function formatPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}
