"use client";

import {
  MATURITY_COLORS,
  IMPORTANCE_COLORS,
  MATURITY_LABELS,
  IMPORTANCE_LABELS,
  MATURITY_NUMERIC,
  GAP_COLORS,
  GAP_LABELS,
  getGapColor,
  getOwnerColor,
} from "@/lib/constants/maturity-colors";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ColorByMode } from "../CapabilityPageClient";

type Props = {
  tree: any[];
  colorBy: ColorByMode;
  onSelect: (id: string) => void;
  selectedId: string | null;
};

const LEGEND_TITLE: Record<ColorByMode, string> = {
  maturity:   "Maturity Levels",
  importance: "Strategic Importance",
  gap:        "Maturity Gap",
  owner:      "Capability Owner",
};

export function HeatMapView({ tree, colorBy, onSelect, selectedId }: Props) {
  const colorMap =
    colorBy === "maturity"   ? MATURITY_COLORS :
    colorBy === "importance" ? IMPORTANCE_COLORS :
    colorBy === "gap"        ? GAP_COLORS : null;

  const labelMap =
    colorBy === "maturity"   ? MATURITY_LABELS :
    colorBy === "importance" ? IMPORTANCE_LABELS :
    colorBy === "gap"        ? GAP_LABELS : null;

  const legendEntries = colorMap
    ? Object.entries(colorMap).filter(([key]) => key !== "NOT_ASSESSED")
    : [];

  return (
    <div className="space-y-5">
      {/* Legend */}
      <div className="bg-white rounded-xl border p-4 flex items-center justify-between">
        <span className="text-sm font-medium text-[#1a1f2e]">
          {LEGEND_TITLE[colorBy]}
        </span>
        <div className="flex items-center gap-4">
          {colorBy === "owner" ? (
            <span className="text-xs text-muted-foreground italic">Each colour represents a unique owner</span>
          ) : (
            legendEntries.map(([key, color]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div
                  className="w-3.5 h-3.5 rounded"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-muted-foreground">
                  {labelMap?.[key] ?? key}
                </span>
              </div>
            ))
          )}
          <div className="flex items-center gap-1.5">
            <div
              className="w-3.5 h-3.5 rounded border-2 border-dashed border-[#cbd5e1]"
            />
            <span className="text-xs text-muted-foreground">Not Assessed</span>
          </div>
        </div>
      </div>

      {/* Heat map grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tree.map((l1: any) => (
          <div
            key={l1.id}
            className={cn(
              "rounded-xl border bg-white overflow-hidden shadow-sm transition-all hover:shadow-md",
              selectedId === l1.id && "ring-2 ring-[#86BC25]"
            )}
          >
            {/* L1 header */}
            <button
              onClick={() => onSelect(l1.id)}
              className="w-full p-4 text-left border-b transition-colors hover:bg-[#f8f9fa]"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-bold text-white bg-[#1a1f2e] px-1.5 py-0.5 rounded">
                  L1
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {(l1.children ?? []).length} capabilities
                </span>
              </div>
              <h3 className="font-semibold text-sm text-[#1a1f2e] leading-tight">
                {l1.name}
              </h3>
            </button>

            {/* L2 heat tiles */}
            <div className="p-2.5 grid grid-cols-2 gap-2 bg-[#fafbfc]">
              {(l1.children ?? []).map((l2: any) => {
                const color = getColor(l2, colorBy);
                const isNotAssessed =
                  (colorBy === "maturity" && l2.currentMaturity === "NOT_ASSESSED") ||
                  (colorBy === "importance" && l2.strategicImportance === "NOT_ASSESSED") ||
                  (colorBy === "gap" && (l2.currentMaturity === "NOT_ASSESSED" || l2.targetMaturity === "NOT_ASSESSED"));
                const gap =
                  MATURITY_NUMERIC[l2.targetMaturity] -
                  MATURITY_NUMERIC[l2.currentMaturity];

                return (
                  <Tooltip key={l2.id}>
                    <TooltipTrigger>
                      <button
                        onClick={() => onSelect(l2.id)}
                        className={cn(
                          "w-full rounded-lg p-2.5 text-left leading-tight transition-all hover:scale-[1.02] hover:shadow-md",
                          selectedId === l2.id &&
                            "ring-2 ring-white ring-offset-2",
                          isNotAssessed
                            ? "border-2 border-dashed border-[#cbd5e1] bg-[#f8f9fa] text-[#64748b]"
                            : "text-white"
                        )}
                        style={
                          isNotAssessed
                            ? undefined
                            : {
                                backgroundColor: color,
                                minHeight: "56px",
                              }
                        }
                      >
                        <p
                          className={cn(
                            "text-[11px] font-semibold leading-tight",
                            isNotAssessed ? "text-[#64748b]" : "text-white"
                          )}
                        >
                          {l2.name}
                        </p>
                        {gap > 0 && !isNotAssessed && (
                          <p className="text-[9px] mt-1 text-white/70">
                            Gap: +{gap}
                          </p>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="text-xs max-w-[220px] p-3"
                    >
                      <p className="font-semibold mb-1">{l2.name}</p>
                      <div className="space-y-0.5 text-muted-foreground">
                        <p>
                          Current:{" "}
                          {MATURITY_LABELS[l2.currentMaturity] ?? "N/A"}
                        </p>
                        <p>
                          Target:{" "}
                          {MATURITY_LABELS[l2.targetMaturity] ?? "N/A"}
                        </p>
                        <p>
                          Importance:{" "}
                          {IMPORTANCE_LABELS[l2.strategicImportance] ?? "N/A"}
                        </p>
                        {gap > 0 && (
                          <p className="text-orange-600 font-medium mt-1">
                            Maturity gap: {gap} levels
                          </p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              {(!l1.children || l1.children.length === 0) && (
                <p className="col-span-2 text-xs text-muted-foreground p-3 text-center">
                  No sub-capabilities defined
                </p>
              )}
            </div>

            {/* L3 tiles — shown for any L2 that has children */}
            {(l1.children ?? []).some((l2: any) => l2.children?.length > 0) && (
              <div className="px-2.5 pb-2.5 space-y-1.5 bg-[#fafbfc] border-t border-dashed border-[#e9ecef]">
                <p className="text-[9px] font-semibold text-muted-foreground pt-2 px-0.5 uppercase tracking-wide">
                  L3 Capabilities
                </p>
                {(l1.children ?? []).flatMap((l2: any) =>
                  (l2.children ?? []).map((l3: any) => {
                    const l3Color = getColor(l3, colorBy);
                    const isNotAssessed =
                      (colorBy === "maturity" && l3.currentMaturity === "NOT_ASSESSED") ||
                      (colorBy === "importance" && l3.strategicImportance === "NOT_ASSESSED");
                    return (
                      <Tooltip key={l3.id}>
                        <TooltipTrigger className="w-full">
                          <button
                            onClick={() => onSelect(l3.id)}
                            className={cn(
                              "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                              selectedId === l3.id
                                ? "bg-[#86BC25]/10 ring-1 ring-[#86BC25]/40"
                                : "hover:bg-[#f1f3f5]"
                            )}
                          >
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{
                                backgroundColor: isNotAssessed ? "#cbd5e1" : l3Color,
                                border: isNotAssessed ? "2px dashed #94a3b8" : "none",
                              }}
                            />
                            <span className="text-[10px] text-muted-foreground text-left truncate">
                              <span className="font-medium text-[#495057]">{l3.name}</span>
                              <span className="ml-1 opacity-60">— {l2.name}</span>
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs max-w-[200px] p-2">
                          <p className="font-semibold">{l3.name}</p>
                          <p className="text-muted-foreground text-[11px]">
                            {MATURITY_LABELS[l3.currentMaturity] ?? "Not Assessed"}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 opacity-70">
                            Click to view &amp; assess
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function getColor(node: any, colorBy: ColorByMode): string {
  if (colorBy === "maturity") return MATURITY_COLORS[node.currentMaturity] ?? MATURITY_COLORS.NOT_ASSESSED;
  if (colorBy === "importance") return IMPORTANCE_COLORS[node.strategicImportance] ?? IMPORTANCE_COLORS.NOT_ASSESSED;
  if (colorBy === "gap") return getGapColor(node);
  return getOwnerColor(node.owner?.id);
}

