"use client";

import { HorizonBadge } from "./HorizonBadge";
import { RAGStatusDot } from "./RAGStatusDot";
import { ProgressBar } from "./ProgressBar";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-50 border-gray-200 text-gray-700",
  PLANNED: "bg-blue-50 border-blue-200 text-blue-700",
  IN_PROGRESS: "bg-green-50 border-green-200 text-green-700",
  ON_HOLD: "bg-yellow-50 border-yellow-200 text-yellow-700",
  COMPLETE: "bg-emerald-50 border-emerald-200 text-emerald-700",
  CANCELLED: "bg-gray-50 border-gray-200 text-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PLANNED: "Planned",
  IN_PROGRESS: "In Progress",
  ON_HOLD: "On Hold",
  COMPLETE: "Complete",
  CANCELLED: "Cancelled",
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
  startDate?: Date | null;
  endDate?: Date | null;
  _count?: { milestones: number };
};

export function InitiativeCard({
  initiative,
  onClick,
  onStatusChange,
}: {
  initiative: Initiative;
  onClick?: () => void;
  onStatusChange?: (status: string) => void;
}) {
  return (
    <div
      className={`rounded-lg border p-3 cursor-pointer hover:shadow-sm transition-shadow ${STATUS_STYLES[initiative.status] ?? "bg-white border-gray-200"}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <RAGStatusDot status={initiative.ragStatus} />
          <p className="text-xs font-semibold truncate">{initiative.name}</p>
        </div>
        <HorizonBadge horizon={initiative.horizon} className="shrink-0" />
      </div>

      {initiative.description && (
        <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">
          {initiative.description}
        </p>
      )}

      <ProgressBar value={initiative.progressPct} showLabel className="mb-2" />

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="uppercase tracking-wide">{initiative.category}</span>
        {initiative._count && (
          <span>{initiative._count.milestones} milestones</span>
        )}
      </div>
    </div>
  );
}
