import { subDays, subYears } from "date-fns";
import type { DateRangeKey } from "@/lib/contracts/dashboard";

/** Returns an ISO string (for tRPC inputs) or undefined for "all time". */
export function dateRangeToSince(key: DateRangeKey): string | undefined {
  const now = new Date();
  if (key === "7d") return subDays(now, 7).toISOString();
  if (key === "30d") return subDays(now, 30).toISOString();
  if (key === "90d") return subDays(now, 90).toISOString();
  if (key === "6mo") return subDays(now, 180).toISOString();
  if (key === "1yr") return subYears(now, 1).toISOString();
  if (key === "2yr") return subYears(now, 2).toISOString();
  return undefined; // "all"
}

export const DATE_RANGE_LABELS: Record<DateRangeKey, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "6mo": "Last 6 months",
  "1yr": "Last year",
  "2yr": "Last 2 years",
  all: "All time",
};
