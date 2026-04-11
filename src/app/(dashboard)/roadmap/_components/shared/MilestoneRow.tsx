"use client";

import { format } from "date-fns";
import { CheckCircle2, Circle, AlertCircle, Ban, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_ICON: Record<string, React.ReactNode> = {
  NOT_STARTED: <Circle className="h-4 w-4 text-gray-400" />,
  IN_PROGRESS: <Clock className="h-4 w-4 text-blue-500" />,
  COMPLETE: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  BLOCKED: <AlertCircle className="h-4 w-4 text-red-500" />,
  CANCELLED: <Ban className="h-4 w-4 text-gray-300" />,
};

type Milestone = {
  id: string;
  name: string;
  status: string;
  dueDate?: Date | null;
  isCritical: boolean;
  description?: string | null;
};

export function MilestoneRow({
  milestone,
  onComplete,
  onRevert,
}: {
  milestone: Milestone;
  onComplete?: (id: string) => void;
  onRevert?: (id: string) => void;
}) {
  const isComplete = milestone.status === "COMPLETE";
  const isCancelled = milestone.status === "CANCELLED";

  function handleToggle() {
    if (isCancelled) return;
    if (isComplete) {
      onRevert?.(milestone.id);
    } else {
      onComplete?.(milestone.id);
    }
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/50 group",
        isCancelled && "opacity-50"
      )}
    >
      <button
        onClick={handleToggle}
        className="shrink-0"
        disabled={isCancelled}
        title={isComplete ? "Click to revert to Not Started" : "Mark as complete"}
      >
        {STATUS_ICON[milestone.status] ?? STATUS_ICON.NOT_STARTED}
      </button>
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium truncate",
            milestone.status === "COMPLETE" && "line-through text-muted-foreground"
          )}
        >
          {milestone.isCritical && (
            <span className="mr-1 text-red-500 text-[10px] font-bold uppercase">
              CP
            </span>
          )}
          {milestone.name}
        </p>
        {milestone.description && (
          <p className="text-xs text-muted-foreground truncate">
            {milestone.description}
          </p>
        )}
      </div>
      {milestone.dueDate && (
        <span className="text-[11px] text-muted-foreground shrink-0">
          {format(new Date(milestone.dueDate), "MMM d")}
        </span>
      )}
    </div>
  );
}
