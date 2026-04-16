"use client";

import { memo } from "react";
import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";

export type ApplicationNodeData = {
  name: string;
  vendor?: string | null;
  applicationType?: string | null;
  lifecycle?: string | null;
  businessValue?: string | null;
  technicalHealth?: string | null;
  systemLandscapeRole?: string | null;
  width?: number;
  height?: number;
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

export const APP_NODE_MIN_W = 100;
export const APP_NODE_MIN_H = 40;
export const APP_NODE_DEFAULT_W = 160;
export const APP_NODE_DEFAULT_H = 56;

function ApplicationNodeImpl({ data, selected, width, height }: NodeProps) {
  const d = data as ApplicationNodeData;
  const accent = LIFECYCLE_ACCENT[d.lifecycle ?? ""] ?? "border-border";
  const valueChip = VALUE_CHIP[d.businessValue ?? ""];

  // Adaptive content — hide subtitle/role when short, hide role only when medium.
  const h = typeof height === "number" ? height : (d.height ?? APP_NODE_DEFAULT_H);
  const w = typeof width === "number" ? width : (d.width ?? APP_NODE_DEFAULT_W);
  const showVendor = h >= 72 && !!d.vendor;
  const showRole = h >= 96 && !!d.systemLandscapeRole;

  return (
    <div
      className={cn(
        "group bg-card text-card-foreground shadow-sm border-2 transition-all flex flex-col",
        accent,
        selected
          ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-md"
          : "hover:shadow-md"
      )}
      style={{ width: w, height: h }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={APP_NODE_MIN_W}
        minHeight={APP_NODE_MIN_H}
        lineClassName="!border-primary/50"
        handleClassName="!bg-primary !border-primary !w-2 !h-2 !rounded-none"
      />

      {/* Invisible handles on all 4 sides — lets edges dock anywhere for 90° routing */}
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-full !h-1 !top-0 !left-1/2 !-translate-x-1/2" id="t" />
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !h-full !w-1 !left-0 !top-1/2 !-translate-y-1/2" id="l" />
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !h-full !w-1 !right-0 !top-1/2 !-translate-y-1/2" id="r" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-full !h-1 !bottom-0 !left-1/2 !-translate-x-1/2" id="b" />

      <div className="flex-1 min-h-0 px-2.5 py-1.5 flex flex-col justify-center overflow-hidden">
        <div className="flex items-start justify-between gap-1.5">
          <p className="text-[12.5px] font-semibold leading-tight truncate flex-1" title={d.name}>
            {d.name}
          </p>
          {valueChip && d.businessValue && (
            <span
              className={cn(
                "shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5",
                valueChip
              )}
            >
              {d.businessValue.charAt(0)}
            </span>
          )}
        </div>
        {showVendor && (
          <p className="text-[10.5px] text-muted-foreground truncate mt-0.5" title={d.vendor ?? undefined}>
            {d.vendor}
          </p>
        )}
        {showRole && (
          <p className="text-[10px] text-muted-foreground/80 mt-0.5 italic truncate">
            {d.systemLandscapeRole}
          </p>
        )}
      </div>
    </div>
  );
}

export const ApplicationNode = memo(ApplicationNodeImpl);
