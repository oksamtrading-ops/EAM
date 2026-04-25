"use client";

import { Trophy, Flag, ShieldCheck, BookOpen, Package, Link2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import type { DateRangeKey } from "@/lib/contracts/dashboard";
import { dateRangeToSinceDays } from "./dateRangeUtils";

type Props = { dateRange: DateRangeKey };

/**
 * Shipped card — counts of outcomes the user (or the agent) shipped
 * in the date range. Replaces the legacy "Recent achievements" card
 * with two extensions:
 *   - Knowledge facts accepted (split docs/runs)
 *   - Share links created (split by mode)
 *   - Deliverables generated → null/n-a (no DB tracking; Plan G)
 */
export function ShippedCard({ dateRange }: Props) {
  const sinceDays = dateRangeToSinceDays(dateRange);
  const { data, isLoading } = trpc.dashboardV2.shipped.useQuery({ sinceDays });

  return (
    <div className="rounded-2xl glass p-5 sm:p-6">
      <header className="mb-4">
        <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
          <Trophy className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Shipped
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Last {sinceDays} days
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 rounded-md bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          <ShippedRow
            icon={Flag}
            iconBg="bg-emerald-50 dark:bg-emerald-950/40"
            iconColor="text-emerald-600 dark:text-emerald-400"
            label="Initiatives completed"
            count={data?.initiativesCompleted ?? 0}
          />
          <ShippedRow
            icon={ShieldCheck}
            iconBg="bg-emerald-50 dark:bg-emerald-950/40"
            iconColor="text-emerald-600 dark:text-emerald-400"
            label="Risks resolved"
            count={data?.risksResolved ?? 0}
          />
          <ShippedRow
            icon={BookOpen}
            iconBg="bg-[var(--ai)]/10"
            iconColor="text-[var(--ai)]"
            label="Facts accepted"
            count={data?.factsAccepted ?? 0}
            sub={
              data && data.factsAccepted > 0
                ? `${data.factsAcceptedFromDocs} from docs · ${data.factsAcceptedFromRuns} mined`
                : undefined
            }
          />
          <ShippedRow
            icon={Package}
            iconBg="bg-[var(--ai)]/10"
            iconColor="text-[var(--ai)]"
            label="Deliverables generated"
            count={data?.deliverablesGenerated}
            sub="Tracking arrives in a future plan"
          />
          <ShippedRow
            icon={Link2}
            iconBg="bg-[var(--ai)]/10"
            iconColor="text-[var(--ai)]"
            label="Share links sent"
            count={data?.sharesCreated ?? 0}
            sub={
              data && data.sharesCreated > 0
                ? [
                    data.sharesByMode.passcode > 0 &&
                      `${data.sharesByMode.passcode} passcode`,
                    data.sharesByMode.signedIn > 0 &&
                      `${data.sharesByMode.signedIn} sign-in`,
                    data.sharesByMode.anonymous > 0 &&
                      `${data.sharesByMode.anonymous} anonymous`,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}

type ShippedRowProps = {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  label: string;
  count: number | null | undefined;
  sub?: string;
};

function ShippedRow({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  count,
  sub,
}: ShippedRowProps) {
  const display =
    count == null ? "n/a" : count.toLocaleString();
  return (
    <div className="flex items-center justify-between p-2.5 -mx-2 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
            iconBg
          )}
        >
          <Icon className={cn("h-3.5 w-3.5", iconColor)} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{label}</div>
          {sub && (
            <div className="text-[10px] text-muted-foreground font-mono truncate">
              {sub}
            </div>
          )}
        </div>
      </div>
      <span
        className={cn(
          "font-mono text-sm font-semibold tabular-nums shrink-0",
          count == null && "text-muted-foreground italic font-normal"
        )}
      >
        {display}
      </span>
    </div>
  );
}
