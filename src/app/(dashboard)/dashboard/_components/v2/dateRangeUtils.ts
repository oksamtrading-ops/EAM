import type { DateRangeKey } from "@/lib/contracts/dashboard";

/**
 * Map the dashboard's DateRangeKey to a "since N days" integer the
 * cost / shipped / health procedures expect. Open-ended ranges like
 * "all" cap at 365 days (the max our cost-summary input accepts).
 */
export function dateRangeToSinceDays(range: DateRangeKey): number {
  switch (range) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "6mo":
      return 180;
    case "1yr":
      return 365;
    case "2yr":
      return 365; // capped at procedure max
    case "all":
      return 365;
    default:
      return 30;
  }
}
