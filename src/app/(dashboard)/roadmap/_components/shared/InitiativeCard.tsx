"use client";

import { HorizonBadge } from "./HorizonBadge";
import { RAGStatusDot } from "./RAGStatusDot";
import { ProgressBar } from "./ProgressBar";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-50 border-slate-200 text-slate-700",
  PLANNED: "bg-blue-50 border-blue-200 text-blue-700",
  IN_PROGRESS: "bg-[#86BC25]/5 border-[#86BC25]/30 text-green-800",
  ON_HOLD: "bg-amber-50 border-amber-200 text-amber-700",
  COMPLETE: "bg-emerald-50 border-emerald-200 text-emerald-700",
  CANCELLED: "bg-rose-50 border-rose-200 text-rose-500 opacity-80",
};

type Initiative = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  horizon: string;
  ragStatus: string;
  progressPct: number;
  priority: string;
  category: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  budgetUsd?: any;
  budgetCurrency?: string | null;
  cancellationReason?: string | null;
  _count?: { milestones: number };
};

function timeProgressPct(start: Date | string | null | undefined, end: Date | string | null | undefined): number | null {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (e <= s) return null;
  const now = Date.now();
  return Math.min(100, Math.max(0, Math.round(((now - s) / (e - s)) * 100)));
}

export function InitiativeCard({
  initiative,
  onClick,
}: {
  initiative: Initiative;
  onClick?: () => void;
}) {
  const timePct = timeProgressPct(initiative.startDate, initiative.endDate);
  const isCancelled = initiative.status === "CANCELLED";

  return (
    <div
      className={`rounded-lg border p-3 cursor-pointer hover:shadow-sm transition-shadow ${STATUS_STYLES[initiative.status] ?? "bg-white border-gray-200"}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <RAGStatusDot status={initiative.ragStatus} />
          <p className={cn("text-xs font-semibold truncate", isCancelled && "line-through text-muted-foreground")}>
            {initiative.name}
          </p>
        </div>
        <HorizonBadge horizon={initiative.horizon} className="shrink-0" />
      </div>

      {isCancelled && initiative.cancellationReason && (
        <p className="text-[10px] text-rose-500 italic line-clamp-1 mb-2">
          {initiative.cancellationReason}
        </p>
      )}

      {!isCancelled && initiative.description && (
        <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">
          {initiative.description}
        </p>
      )}

      {/* Milestone progress */}
      <ProgressBar value={initiative.progressPct} showLabel className="mb-2" />

      {/* Time progress */}
      {timePct !== null && !isCancelled && (
        <>
          <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden mb-1">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                timePct >= 90 ? "bg-rose-400" : timePct >= 60 ? "bg-amber-400" : "bg-sky-400"
              )}
              style={{ width: `${timePct}%` }}
            />
          </div>
          <p className="text-[9px] text-muted-foreground mb-2">Time elapsed {timePct}%</p>
        </>
      )}

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="uppercase tracking-wide">{initiative.category}</span>
        {initiative._count && (
          <span>{initiative._count.milestones} milestones</span>
        )}
      </div>
    </div>
  );
}
