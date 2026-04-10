"use client";

import {
  MATURITY_COLORS,
  IMPORTANCE_COLORS,
  MATURITY_LABELS,
  IMPORTANCE_LABELS,
  MATURITY_NUMERIC,
} from "@/lib/constants/maturity-colors";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Props = {
  tree: any[];
  colorBy: "maturity" | "importance";
  onSelect: (id: string) => void;
  selectedId: string | null;
};

export function HeatMapView({ tree, colorBy, onSelect, selectedId }: Props) {
  const colorMap = colorBy === "maturity" ? MATURITY_COLORS : IMPORTANCE_COLORS;
  const labelMap = colorBy === "maturity" ? MATURITY_LABELS : IMPORTANCE_LABELS;

  // Filter out NOT_ASSESSED from legend
  const legendEntries = Object.entries(colorMap).filter(
    ([key]) => key !== "NOT_ASSESSED"
  );

  return (
    <div className="space-y-5">
      {/* Legend */}
      <div className="bg-white rounded-xl border p-4 flex items-center justify-between">
        <span className="text-sm font-medium text-[#1a1f2e]">
          {colorBy === "maturity" ? "Maturity Levels" : "Strategic Importance"}
        </span>
        <div className="flex items-center gap-4">
          {legendEntries.map(([key, color]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div
                className="w-3.5 h-3.5 rounded"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-muted-foreground">
                {labelMap[key] ?? key}
              </span>
            </div>
          ))}
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
                  (colorBy === "importance" && l2.strategicImportance === "NOT_ASSESSED");
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
          </div>
        ))}
      </div>
    </div>
  );
}

function getColor(node: any, colorBy: "maturity" | "importance"): string {
  if (colorBy === "maturity") {
    return (
      MATURITY_COLORS[node.currentMaturity] ?? MATURITY_COLORS.NOT_ASSESSED
    );
  }
  return (
    IMPORTANCE_COLORS[node.strategicImportance] ??
    IMPORTANCE_COLORS.NOT_ASSESSED
  );
}
