"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  MATURITY_COLORS,
  IMPORTANCE_COLORS,
  MATURITY_LABELS,
  MATURITY_NUMERIC,
  IMPORTANCE_LABELS,
  getGapColor,
  getOwnerColor,
} from "@/lib/constants/maturity-colors";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, TrendingUp, GripVertical } from "lucide-react";
import type { ColorByMode } from "../CapabilityPageClient";

type Props = {
  tree: any[];
  colorBy: ColorByMode;
  onSelect: (id: string) => void;
  selectedId: string | null;
  onMove?: (capabilityId: string, newParentId: string | null, newLevel: "L1" | "L2" | "L3") => void;
};

export function GridView({ tree, colorBy, onSelect, selectedId, onMove }: Props) {
  const draggingRef = useRef<{ id: string; level: string; name: string } | null>(null);
  const [dragOverL1, setDragOverL1] = useState<string | null>(null);

  function handleDragStart(e: React.DragEvent, cap: any) {
    draggingRef.current = { id: cap.id, level: cap.level, name: cap.name };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", cap.id);
    // Semi-transparent drag image
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  }

  function handleDragEnd(e: React.DragEvent) {
    draggingRef.current = null;
    setDragOverL1(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
  }

  function handleDropOnL1(e: React.DragEvent, targetL1Id: string) {
    e.preventDefault();
    setDragOverL1(null);
    const dragged = draggingRef.current;
    if (!dragged || !onMove) return;

    // Don't drop on self
    if (dragged.id === targetL1Id) return;

    // Only allow L2 (or L1 being reparented as L2) to be dropped onto an L1
    if (dragged.level === "L1") {
      // L1 dropped onto another L1 — not allowed (would need explicit UI confirmation)
      return;
    }

    // Move L2 to new L1 parent
    onMove(dragged.id, targetL1Id, "L2");
  }

  function handleDropOnRoot(e: React.DragEvent) {
    e.preventDefault();
    setDragOverL1(null);
    const dragged = draggingRef.current;
    if (!dragged || !onMove) return;

    // Promote L2 to L1 (remove parent)
    if (dragged.level === "L2") {
      onMove(dragged.id, null, "L1");
    }
  }

  return (
    <div
      className="space-y-5"
      onDragOver={(e) => {
        // Allow dropping on root area (between L1 groups) to promote to L1
        if (draggingRef.current?.level === "L2") {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }
      }}
      onDrop={handleDropOnRoot}
    >
      {tree.map((l1: any) => {
        const gap = getGap(l1);
        const isDragOver = dragOverL1 === l1.id;
        return (
          <div
            key={l1.id}
            className={cn(
              "bg-white rounded-xl border shadow-sm overflow-hidden transition-all",
              isDragOver && "ring-2 ring-[#86BC25] border-[#86BC25]"
            )}
            onDragOver={(e) => {
              if (draggingRef.current && draggingRef.current.level !== "L1") {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "move";
                setDragOverL1(l1.id);
              }
            }}
            onDragLeave={(e) => {
              // Only clear if leaving the L1 container entirely
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOverL1(null);
              }
            }}
            onDrop={(e) => {
              e.stopPropagation();
              handleDropOnL1(e, l1.id);
            }}
          >
            {/* L1 Header */}
            <button
              onClick={() => onSelect(l1.id)}
              className={cn(
                "w-full text-left px-5 py-4 transition-all hover:bg-[#f8f9fa] border-b",
                selectedId === l1.id && "bg-[#86BC25]/5"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-1.5 h-10 rounded-full shrink-0"
                    style={{ backgroundColor: getColor(l1, colorBy) }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-white bg-[#1a1f2e] px-1.5 py-0.5 rounded">
                        L1
                      </span>
                      <h3 className="font-semibold text-[15px] text-[#1a1f2e]">
                        {l1.name}
                      </h3>
                    </div>
                    {l1.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {l1.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isDragOver && (
                    <span className="text-xs text-[#86BC25] font-medium animate-pulse">
                      Drop here
                    </span>
                  )}
                  {gap > 0 && (
                    <div className="flex items-center gap-1 text-orange-600 text-xs">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span>+{gap} gap</span>
                    </div>
                  )}
                  <MaturityPill value={l1.currentMaturity} />
                  <ImportancePill value={l1.strategicImportance} />
                  <span className="text-xs text-muted-foreground bg-[#f1f3f5] px-2 py-1 rounded-md">
                    {l1.children?.length ?? 0} sub-capabilities
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </button>

            {/* L2 Grid */}
            {l1.children && l1.children.length > 0 && (
              <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 bg-[#fafbfc]">
                {l1.children.map((l2: any) => (
                  <div
                    key={l2.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, l2)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onSelect(l2.id)}
                    className={cn(
                      "text-left p-3.5 rounded-lg border bg-white transition-all hover:shadow-md hover:border-[#86BC25]/30 group cursor-grab active:cursor-grabbing",
                      selectedId === l2.id
                        ? "border-[#86BC25] shadow-md ring-1 ring-[#86BC25]/20"
                        : "border-[#e9ecef]"
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                        <span className="text-[9px] font-bold text-[#86BC25] bg-[#86BC25]/10 px-1.5 py-0.5 rounded">
                          L2
                        </span>
                      </div>
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5"
                        style={{ backgroundColor: getColor(l2, colorBy) }}
                      />
                    </div>
                    <h4 className="text-sm font-medium text-[#1a1f2e] leading-tight mb-2 group-hover:text-[#86BC25] transition-colors">
                      {l2.name}
                    </h4>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <MaturityChip value={l2.currentMaturity} />
                    </div>

                    {/* L3 sub-capabilities */}
                    {l2.children && l2.children.length > 0 && (
                      <div className="mt-2.5 pt-2.5 border-t border-dashed border-[#e9ecef] space-y-1">
                        {l2.children.map((l3: any) => {
                          const l3Color = getColor(l3, colorBy);
                          return (
                            <button
                              key={l3.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelect(l3.id);
                              }}
                              className={cn(
                                "w-full text-left flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] transition-colors group/l3",
                                selectedId === l3.id
                                  ? "bg-[#86BC25]/10 text-[#1a1f2e]"
                                  : "hover:bg-[#f1f3f5] text-muted-foreground"
                              )}
                            >
                              <span className="text-[7px] font-bold text-muted-foreground bg-muted px-1 py-0.5 rounded shrink-0">
                                L3
                              </span>
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: l3Color }}
                              />
                              <span className="truncate group-hover/l3:text-[#1a1f2e] transition-colors">
                                {l3.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function getColor(node: any, colorBy: ColorByMode): string {
  if (colorBy === "maturity") return MATURITY_COLORS[node.currentMaturity] ?? MATURITY_COLORS.NOT_ASSESSED;
  if (colorBy === "importance") return IMPORTANCE_COLORS[node.strategicImportance] ?? IMPORTANCE_COLORS.NOT_ASSESSED;
  if (colorBy === "gap") return getGapColor(node);
  return getOwnerColor(node.owner?.id);
}

function getGap(node: any): number {
  const current = MATURITY_NUMERIC[node.currentMaturity] ?? 0;
  const target = MATURITY_NUMERIC[node.targetMaturity] ?? 0;
  return Math.max(0, target - current);
}

function MaturityPill({ value }: { value: string }) {
  const color = MATURITY_COLORS[value] ?? MATURITY_COLORS.NOT_ASSESSED;
  const label = MATURITY_LABELS[value] ?? "N/A";

  return (
    <span
      className="text-[11px] font-medium px-2 py-0.5 rounded-full border"
      style={{ borderColor: color, color }}
    >
      {label}
    </span>
  );
}

function ImportancePill({ value }: { value: string }) {
  const label = IMPORTANCE_LABELS[value] ?? "N/A";
  if (value === "NOT_ASSESSED") return null;

  const bgMap: Record<string, string> = {
    CRITICAL: "bg-red-50 text-red-700 border-red-200",
    HIGH: "bg-orange-50 text-orange-700 border-orange-200",
    MEDIUM: "bg-yellow-50 text-yellow-700 border-yellow-200",
    LOW: "bg-green-50 text-green-700 border-green-200",
  };

  return (
    <span
      className={cn(
        "text-[11px] font-medium px-2 py-0.5 rounded-full border",
        bgMap[value]
      )}
    >
      {label}
    </span>
  );
}

function MaturityChip({ value }: { value: string }) {
  const color = MATURITY_COLORS[value] ?? MATURITY_COLORS.NOT_ASSESSED;
  const label =
    value === "NOT_ASSESSED"
      ? "Not assessed"
      : value.charAt(0) + value.slice(1).toLowerCase();

  return (
    <span
      className="text-[10px] font-medium px-1.5 py-0.5 rounded border inline-flex items-center gap-1"
      style={{ borderColor: color + "60", color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
