"use client";

import * as React from "react";
import { Sparkles, CalendarDays, ChevronDown } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { DateRangeSelect } from "../DateRangeSelect";
import { DATE_RANGE_LABELS } from "@/lib/utils/dateRange";
import type { DateRangeKey } from "@/lib/contracts/dashboard";

type DashboardShellProps = {
  dateRange: DateRangeKey;
  onDateRangeChange: (next: DateRangeKey) => void;
  onAIBrief: () => void;
  children: React.ReactNode;
};

const INDUSTRY_LABEL: Record<string, string> = {
  BANKING: "Banking",
  INSURANCE: "Insurance",
  RETAIL: "Retail",
  LOGISTICS: "Logistics",
  MANUFACTURING: "Manufacturing",
  HEALTHCARE: "Healthcare",
  PHARMA_LIFESCIENCES: "Pharma",
  TELECOM: "Telecom",
  ENERGY_UTILITIES: "Energy",
  PUBLIC_SECTOR: "Public Sector",
  GENERIC: "Generic",
  ENTERPRISE_BCM: "BCM",
};

/**
 * DashboardShell — sticky glass top bar + content. Matches the
 * mockup at mockup/dashboard.html: workspace pill on the left
 * (with industry/region chip), date-range + AI brief + theme
 * toggle on the right.
 */
export function DashboardShell({
  dateRange,
  onDateRangeChange,
  onAIBrief,
  children,
}: DashboardShellProps) {
  const { data: ws } = trpc.workspace.getCurrent.useQuery();

  const workspaceName = ws?.clientName?.trim() || ws?.name || "Workspace";
  const industry =
    ws?.industry && INDUSTRY_LABEL[ws.industry]
      ? INDUSTRY_LABEL[ws.industry]
      : null;
  const region = ws?.region ?? null;

  return (
    <>
      <div className="glass-toolbar sticky top-0 z-30 h-14 px-3 sm:px-6 border-b flex items-center">
        <div className="flex items-center justify-between gap-3 w-full">
          {/* Left — workspace pill */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-[var(--ai)]/15 flex items-center justify-center shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-[var(--ai)]" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold truncate">
                {workspaceName}
              </span>
              {(industry || region) && (
                <span className="hidden sm:inline-flex text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800/80 shrink-0">
                  {[industry, region].filter(Boolean).join(" · ")}
                </span>
              )}
            </div>
          </div>

          {/* Right — controls */}
          <div className="flex items-center gap-2 shrink-0">
            <DashboardDateRange
              value={dateRange}
              onChange={onDateRangeChange}
            />
            <button
              type="button"
              onClick={onAIBrief}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-3 h-8 rounded-lg text-white bg-[var(--ai)] hover:bg-[var(--ai-hover)] transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI brief
            </button>
            <button
              type="button"
              onClick={onAIBrief}
              aria-label="AI brief"
              className="sm:hidden h-8 w-8 rounded-lg flex items-center justify-center text-white bg-[var(--ai)] hover:bg-[var(--ai-hover)] transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {children}
    </>
  );
}

/**
 * Date-range select for the dashboard top bar. Wider than the default
 * (h-9, w-44 instead of w-72 default-trigger) so the longest label
 * ("Last 30 days") doesn't truncate or feel cramped against the
 * AI-brief button + theme toggle next to it.
 */
function DashboardDateRange({
  value,
  onChange,
}: {
  value: DateRangeKey;
  onChange: (next: DateRangeKey) => void;
}) {
  return (
    <div className="relative">
      <DateRangeSelect
        value={value}
        onChange={onChange}
        triggerClassName="w-[200px] gap-2 text-sm font-medium"
      />
    </div>
  );
}

// Re-export the icon trio so consumers can render their own decorations.
export { CalendarDays, ChevronDown };
