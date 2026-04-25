"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateRangeSelect } from "../DateRangeSelect";
import type { DateRangeKey } from "@/lib/contracts/dashboard";

type DashboardShellProps = {
  dateRange: DateRangeKey;
  onDateRangeChange: (next: DateRangeKey) => void;
  onAIBrief: () => void;
  children: React.ReactNode;
};

/**
 * DashboardShell — top bar + content wrapper. The top bar is a
 * sticky glass toolbar matching the mockup: title block on the
 * left, date-range select + AI-brief CTA on the right. The page
 * content stacks below with consistent vertical rhythm.
 */
export function DashboardShell({
  dateRange,
  onDateRangeChange,
  onAIBrief,
  children,
}: DashboardShellProps) {
  return (
    <>
      <div className="glass-toolbar sticky top-0 z-30 -mx-3 sm:-mx-6 px-3 sm:px-6 py-2.5 mb-4 sm:mb-6 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
          <div className="min-w-0">
            <h1 className="text-md font-semibold text-foreground tracking-tight flex items-center gap-2">
              <span className="h-6 w-6 rounded-md bg-[var(--ai)]/15 flex items-center justify-center shrink-0">
                <Sparkles className="h-3.5 w-3.5 text-[var(--ai)]" />
              </span>
              Engagement overview
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Health, blocking work, and what the agent shipped.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <DateRangeSelect value={dateRange} onChange={onDateRangeChange} />
            <Button
              size="sm"
              onClick={onAIBrief}
              className="gap-1.5 bg-[var(--ai)] hover:bg-[var(--ai)]/90 text-white"
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI brief
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4 sm:space-y-6">{children}</div>
    </>
  );
}
