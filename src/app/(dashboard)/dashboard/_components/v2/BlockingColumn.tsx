"use client";

import Link from "next/link";
import {
  ChevronRight,
  ShieldAlert,
  CalendarClock,
  Calendar,
  Clock,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

const KIND_ICON = {
  risk: ShieldAlert,
  eol: AlertTriangle,
  initiative: Calendar,
  compliance: ShieldAlert,
  scheduledFail: CalendarClock,
  longRunning: Clock,
} as const;

/**
 * Blocking column — what's stopping the engagement from moving.
 * Severity dot + title + meta row + chevron. Each item links to
 * the canonical surface so the user can take action one click in.
 */
export function BlockingColumn() {
  const { data: items = [], isLoading } =
    trpc.dashboardV2.blockingItems.useQuery();

  const dangerCount = items.filter((i) => i.severity === "danger").length;
  const warnCount = items.length - dangerCount;

  return (
    <div className="rounded-2xl glass p-5 sm:p-6">
      <header className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Blocking</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLoading
              ? "Loading…"
              : items.length === 0
                ? "Nothing blocking right now"
                : `${items.length} item${items.length === 1 ? "" : "s"} need attention`}
          </p>
        </div>
        {items.length > 0 && (
          <div className="flex items-center gap-1">
            {dangerCount > 0 && (
              <Badge tone="danger" className="text-[10px] font-mono gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                {dangerCount}
              </Badge>
            )}
            {warnCount > 0 && (
              <Badge tone="warn" className="text-[10px] font-mono">
                {warnCount}
              </Badge>
            )}
          </div>
        )}
      </header>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-12 rounded-md bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Loader2}
          title="All clear"
          body="No critical risks, EOL exposures, or failing tasks. Keep going."
          size="sm"
        />
      ) : (
        <div className="space-y-1">
          {items.map((item, idx) => {
            const Icon = KIND_ICON[item.kind] ?? AlertTriangle;
            return (
              <Link
                key={idx}
                href={item.href}
                className="flex items-start gap-3 p-2.5 -mx-2 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors group"
              >
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 rounded-full shrink-0",
                    item.severity === "danger"
                      ? "bg-red-500 animate-pulse"
                      : "bg-amber-500"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {item.meta}
                  </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mt-1.5 shrink-0 group-hover:text-foreground transition-colors" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
