"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";
import { useRiskContext } from "../RiskContext";
import { cn } from "@/lib/utils";
import { scoreLabel } from "@/server/services/riskScoring";

const LIKELIHOODS = ["HIGH", "MEDIUM", "LOW", "RARE"] as const;
const IMPACTS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

const LIKELIHOOD_SCORE: Record<string, number> = { RARE: 1, LOW: 2, MEDIUM: 3, HIGH: 4 };
const IMPACT_SCORE: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

const CELL_BG: Record<string, string> = {
  Low: "bg-green-50 hover:bg-green-100",
  Medium: "bg-yellow-50 hover:bg-yellow-100",
  High: "bg-orange-50 hover:bg-orange-100",
  Critical: "bg-red-50 hover:bg-red-100",
};

const CELL_TEXT: Record<string, string> = {
  Low: "text-green-700",
  Medium: "text-yellow-700",
  High: "text-orange-700",
  Critical: "text-red-700",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-red-100 text-red-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  MITIGATED: "bg-green-100 text-green-700",
  ACCEPTED: "bg-gray-100 text-gray-600",
  CLOSED: "bg-gray-100 text-gray-400",
};

interface Props {
  onSelectRisk: (id: string) => void;
}

export function RiskHeatMapView({ onSelectRisk }: Props) {
  const { risks } = useRiskContext();
  const [activeCell, setActiveCell] = useState<{ likelihood: string; impact: string } | null>(null);

  const activeRisks = risks.filter((r) => r.status !== "CLOSED");

  const cellRisks =
    activeCell
      ? activeRisks.filter(
          (r) => r.likelihood === activeCell.likelihood && r.impact === activeCell.impact
        )
      : [];

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold">Risk Heat Map</h2>
          <p className="text-xs text-muted-foreground">
            {activeRisks.length} open risk(s) · Click a cell to see details
          </p>
        </div>

        <div className="inline-block">
          {/* Impact axis header */}
          <div className="flex mb-1 ml-16">
            <p className="text-xs text-muted-foreground mb-1 ml-2">← Impact →</p>
          </div>
          <div className="flex ml-16 gap-1 mb-1">
            {IMPACTS.map((imp) => (
              <div key={imp} className="w-20 sm:w-32 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {imp}
              </div>
            ))}
          </div>

          <div className="flex">
            {/* Likelihood axis */}
            <div className="w-16 flex flex-col gap-1">
              {LIKELIHOODS.map((lik) => (
                <div key={lik} className="h-24 flex items-center justify-end pr-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide -rotate-0">
                    {lik}
                  </span>
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="flex flex-col gap-1">
              {LIKELIHOODS.map((lik) => (
                <div key={lik} className="flex gap-1">
                  {IMPACTS.map((imp) => {
                    const score = LIKELIHOOD_SCORE[lik] * IMPACT_SCORE[imp];
                    const label = scoreLabel(score);
                    const count = activeRisks.filter(
                      (r) => r.likelihood === lik && r.impact === imp
                    ).length;
                    const isActive =
                      activeCell?.likelihood === lik && activeCell?.impact === imp;

                    return (
                      <button
                        key={imp}
                        onClick={() =>
                          setActiveCell(isActive ? null : { likelihood: lik, impact: imp })
                        }
                        className={cn(
                          "w-20 sm:w-32 h-20 sm:h-24 rounded-lg border-2 flex flex-col items-center justify-center gap-1 transition-all",
                          CELL_BG[label],
                          isActive ? "border-foreground shadow-md scale-105" : "border-transparent"
                        )}
                      >
                        <span className={cn("text-3xl font-bold", CELL_TEXT[label])}>
                          {count > 0 ? count : "—"}
                        </span>
                        <span className={cn("text-[10px] font-medium uppercase tracking-wider", CELL_TEXT[label])}>
                          {label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cell detail panel */}
      {activeCell && (
        <div className="w-80 border-l bg-background flex flex-col overflow-hidden shrink-0">
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <p className="text-sm font-semibold">
                {activeCell.likelihood} × {activeCell.impact}
              </p>
              <p className="text-xs text-muted-foreground">
                {cellRisks.length} risk(s)
              </p>
            </div>
            <button onClick={() => setActiveCell(null)} className="p-1 rounded hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {cellRisks.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No risks in this cell</p>
              ) : (
                cellRisks.map((risk) => (
                  <button
                    key={risk.id}
                    onClick={() => onSelectRisk(risk.id)}
                    className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <p className="text-[13px] font-medium line-clamp-2">{risk.title}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] h-4 px-1.5", STATUS_COLORS[risk.status])}
                      >
                        {risk.status}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {risk.category.replace(/_/g, " ")}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
