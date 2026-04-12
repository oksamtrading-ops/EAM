"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Pencil } from "lucide-react";
import { ProgressBar } from "./shared/ProgressBar";
import { ObjectiveFormModal } from "./modals/ObjectiveFormModal";

type Objective = {
  id: string;
  name: string;
  description?: string | null;
  targetDate?: Date | string | null;
  kpiDescription?: string | null;
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
  const [editObjective, setEditObjective] = useState<Objective | null>(null);

  if (!objectives?.length) return null;

  return (
    <>
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
            <div key={obj.id} className="min-w-[160px] max-w-[200px] group relative">
              <div className="flex items-center gap-1 mb-1">
                <p className="text-[11px] font-medium truncate flex-1">{obj.name}</p>
                <button
                  onClick={() => setEditObjective(obj)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-[#86BC25] transition-all shrink-0"
                  title="Edit objective"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
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

      {editObjective && (
        <ObjectiveFormModal
          open
          objective={editObjective}
          onClose={() => setEditObjective(null)}
          onDeleted={() => setEditObjective(null)}
        />
      )}
    </>
  );
}
