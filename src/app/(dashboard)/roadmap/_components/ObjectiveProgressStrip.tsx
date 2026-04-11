"use client";

import { format } from "date-fns";
import { ProgressBar } from "./shared/ProgressBar";

type Objective = {
  id: string;
  name: string;
  targetDate?: Date | null;
  kpiTarget?: string | null;
  initiatives: Array<{
    initiative: { progressPct: number };
  }>;
};

export function ObjectiveProgressStrip({
  objectives,
}: {
  objectives: Objective[] | undefined;
}) {
  if (!objectives?.length) return null;

  return (
    <div className="flex gap-4 px-4 py-2 border-b bg-muted/30 overflow-x-auto">
      {objectives.map((obj) => {
        const avgProgress =
          obj.initiatives.length > 0
            ? Math.round(
                obj.initiatives.reduce(
                  (sum, i) => sum + i.initiative.progressPct,
                  0
                ) / obj.initiatives.length
              )
            : 0;

        return (
          <div key={obj.id} className="min-w-[160px] max-w-[200px]">
            <p className="text-[11px] font-medium truncate mb-1">{obj.name}</p>
            <ProgressBar value={avgProgress} showLabel />
            {obj.targetDate && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Target: {format(new Date(obj.targetDate), "MMM yyyy")}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
