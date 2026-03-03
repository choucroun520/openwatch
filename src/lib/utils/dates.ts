import { formatDistanceToNow, format, parseISO } from "date-fns";

/**
 * Returns a human-readable relative time: "3 days ago", "just now"
 */
export function timeAgo(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Format a date for display: "Mar 2, 2026"
 */
export function formatDate(date: string | Date, fmt = "MMM d, yyyy"): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, fmt);
}

/**
 * Format a date for activity feed: "Mar 2 · 14:32"
 */
export function formatActivity(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "MMM d · HH:mm");
}

/**
 * Short relative time for cards: "3d ago", "1h ago", "just now"
 */
export function shortTimeAgo(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
