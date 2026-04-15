"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";

export type ApplicationNodeData = {
  name: string;
  vendor?: string | null;
  applicationType?: string | null;
  lifecycle?: string | null;
  businessValue?: string | null;
  technicalHealth?: string | null;
  systemLandscapeRole?: string | null;
  selected?: boolean;
};

const LIFECYCLE_ACCENT: Record<string, string> = {
  PLANNED: "border-blue-400/70",
  ACTIVE: "border-emerald-500/70",
  PHASING_OUT: "border-amber-500/70",
  RETIRED: "border-zinc-400/70",
  SUNSET: "border-rose-500/70",
};

const VALUE_CHIP: Record<string, string> = {
  CRITICAL: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  HIGH: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  MEDIUM: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  LOW: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400",
};

function ApplicationNodeImpl({ data, selected }: NodeProps) {
  const d = data as ApplicationNodeData;
  const accent = LIFECYCLE_ACCENT[d.lifecycle ?? ""] ?? "border-border";
  const valueChip = VALUE_CHIP[d.businessValue ?? ""];

  return (
    <div
      className={cn(
        "group rounded-xl bg-card text-card-foreground shadow-sm border-2 transition-all",
        accent,
        selected
          ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-md"
          : "hover:shadow-md"
      )}
      style={{ width: 220 }}
    >
      {/* Invisible handles on all 4 sides — lets edges dock anywhere for 90° routing */}
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-full !h-1 !top-0 !left-1/2 !-translate-x-1/2" id="t" />
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !h-full !w-1 !left-0 !top-1/2 !-translate-y-1/2" id="l" />
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !h-full !w-1 !right-0 !top-1/2 !-translate-y-1/2" id="r" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-full !h-1 !bottom-0 !left-1/2 !-translate-x-1/2" id="b" />

      <div className="px-3 pt-2.5 pb-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-tight truncate" title={d.name}>
            {d.name}
          </p>
          {valueChip && d.businessValue && (
            <span
              className={cn(
                "shrink-0 text-[9px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5",
                valueChip
              )}
            >
              {d.businessValue.charAt(0)}
            </span>
          )}
        </div>
        {d.vendor && (
          <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={d.vendor}>
            {d.vendor}
          </p>
        )}
        {d.systemLandscapeRole && (
          <p className="text-[10px] text-muted-foreground/80 mt-1 italic truncate">
            {d.systemLandscapeRole}
          </p>
        )}
      </div>
    </div>
  );
}

export const ApplicationNode = memo(ApplicationNodeImpl);
