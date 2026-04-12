"use client";

import { HorizonBadge } from "./HorizonBadge";
import { RAGStatusDot } from "./RAGStatusDot";
import { ProgressBar } from "./ProgressBar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const RAG_LABELS: Record<string, string> = {
  GREEN: "On track — no issues",
  AMBER: "At risk — minor issues requiring attention",
  RED: "Off track — critical issues requiring immediate action",
};

const HORIZON_LABELS: Record<string, string> = {
  H1_NOW: "H1 Now — current quarter delivery",
  H2_NEXT: "H2 Next — next 6–12 months",
  H3_LATER: "H3 Later — 1–3 year horizon",
  BEYOND: "Beyond — strategic, 3+ years out",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft — not yet approved for execution",
  PLANNED: "Planned — approved and scheduled",
  IN_PROGRESS: "In Progress — actively being delivered",
  ON_HOLD: "On Hold — paused, pending decision",
  COMPLETE: "Complete — delivered and closed",
  CANCELLED: "Cancelled — no longer proceeding",
};

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

export function InitiativeCard({
  initiative,
  onClick,
}: {
  initiative: Initiative;
  onClick?: () => void;
}) {
  const isCancelled = initiative.status === "CANCELLED";

  return (
    <div
      data-slot="card"
      className={`rounded-lg border p-3 cursor-pointer ${STATUS_STYLES[initiative.status] ?? "bg-white border-gray-200"}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Tooltip>
            <TooltipTrigger>
              <span className="shrink-0 cursor-help">
                <RAGStatusDot status={initiative.ragStatus} />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">{RAG_LABELS[initiative.ragStatus] ?? initiative.ragStatus}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger>
              <p className={cn("text-xs font-semibold truncate cursor-default", isCancelled && "line-through text-muted-foreground")}>
                {initiative.name}
              </p>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px]">
              <span className="font-medium">{STATUS_LABELS[initiative.status] ?? initiative.status}</span>
            </TooltipContent>
          </Tooltip>
        </div>
        <Tooltip>
          <TooltipTrigger>
            <span className="shrink-0 cursor-help">
              <HorizonBadge horizon={initiative.horizon} className="shrink-0" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">{HORIZON_LABELS[initiative.horizon] ?? initiative.horizon}</TooltipContent>
        </Tooltip>
      </div>

      {isCancelled && initiative.cancellationReason && (
        <Tooltip>
          <TooltipTrigger>
            <p className="text-[10px] text-rose-500 italic line-clamp-1 mb-2 cursor-help">
              {initiative.cancellationReason}
            </p>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[280px]">{initiative.cancellationReason}</TooltipContent>
        </Tooltip>
      )}

      {!isCancelled && initiative.description && (
        <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">
          {initiative.description}
        </p>
      )}

      {/* Milestone progress */}
      <Tooltip>
        <TooltipTrigger>
          <div className="mb-2 cursor-help">
            <ProgressBar value={initiative.progressPct} showLabel />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">{initiative.progressPct}% of milestones complete</TooltipContent>
      </Tooltip>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="uppercase tracking-wide">{initiative.category}</span>
        {initiative._count && (
          <Tooltip>
            <TooltipTrigger>
              <span className="cursor-help">{initiative._count.milestones} milestones</span>
            </TooltipTrigger>
            <TooltipContent side="bottom">Number of milestones defined for this initiative</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
