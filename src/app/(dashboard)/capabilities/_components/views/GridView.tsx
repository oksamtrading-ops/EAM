"use client";

import { cn } from "@/lib/utils";
import {
  MATURITY_COLORS,
  IMPORTANCE_COLORS,
  MATURITY_LABELS,
  MATURITY_NUMERIC,
  IMPORTANCE_LABELS,
} from "@/lib/constants/maturity-colors";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, TrendingUp, AlertCircle } from "lucide-react";

type Props = {
  tree: any[];
  colorBy: "maturity" | "importance";
  onSelect: (id: string) => void;
  selectedId: string | null;
};

export function GridView({ tree, colorBy, onSelect, selectedId }: Props) {
  return (
    <div className="space-y-5">
      {tree.map((l1: any) => {
        const gap = getGap(l1);
        return (
          <div
            key={l1.id}
            className="bg-white rounded-xl border shadow-sm overflow-hidden"
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
                  <button
                    key={l2.id}
                    onClick={() => onSelect(l2.id)}
                    className={cn(
                      "text-left p-3.5 rounded-lg border bg-white transition-all hover:shadow-md hover:border-[#86BC25]/30 group",
                      selectedId === l2.id
                        ? "border-[#86BC25] shadow-md ring-1 ring-[#86BC25]/20"
                        : "border-[#e9ecef]"
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-[9px] font-bold text-[#86BC25] bg-[#86BC25]/10 px-1.5 py-0.5 rounded">
                        L2
                      </span>
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
                      {l2.children && l2.children.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {l2.children.length} L3
                        </span>
                      )}
                    </div>

                    {/* L3 preview */}
                    {l2.children && l2.children.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2.5 pt-2.5 border-t border-dashed border-[#e9ecef]">
                        {l2.children.slice(0, 3).map((l3: any) => (
                          <span
                            key={l3.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelect(l3.id);
                            }}
                            className="text-[10px] px-2 py-0.5 bg-[#f1f3f5] rounded-full cursor-pointer hover:bg-[#e9ecef] truncate max-w-[110px] text-muted-foreground"
                          >
                            {l3.name}
                          </span>
                        ))}
                        {l2.children.length > 3 && (
                          <span className="text-[10px] text-muted-foreground px-1">
                            +{l2.children.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
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
