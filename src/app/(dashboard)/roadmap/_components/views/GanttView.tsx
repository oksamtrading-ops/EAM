"use client";

import { format } from "date-fns";
import { useRoadmapContext } from "../RoadmapContext";
import { RAGStatusDot } from "../shared/RAGStatusDot";
import { GanttHeader } from "../shared/GanttHeader";
import { HorizonBands } from "../shared/HorizonBands";
import { DependencyArrows } from "../shared/DependencyArrows";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-300",
  PLANNED: "bg-blue-400",
  IN_PROGRESS: "bg-green-500",
  ON_HOLD: "bg-yellow-400",
  COMPLETE: "bg-green-700",
  CANCELLED: "bg-gray-300 opacity-40",
};

export function GanttView() {
  const { roadmap, selectedId, setSelectedId } = useRoadmapContext();
  const { initiatives, horizonBoundaries, now } = roadmap ?? {};

  if (!initiatives) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Loading roadmap…
      </div>
    );
  }

  if (initiatives.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        No initiatives yet. Create one to build your roadmap.
      </div>
    );
  }

  const allDates = initiatives.flatMap((i) =>
    [i.startDate, i.endDate].filter(Boolean)
  ) as Date[];

  const minDate =
    allDates.length > 0
      ? new Date(Math.min(...allDates.map((d) => new Date(d).getTime())))
      : new Date();
  const maxDate =
    allDates.length > 0
      ? new Date(Math.max(...allDates.map((d) => new Date(d).getTime())))
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const totalMs = maxDate.getTime() - minDate.getTime() || 1;

  function pct(date: Date | null | undefined, fallback: Date): number {
    const d = date ? new Date(date) : fallback;
    return Math.max(0, Math.min(100, ((d.getTime() - minDate.getTime()) / totalMs) * 100));
  }

  const todayPct = now ? pct(new Date(now), new Date()) : 0;

  return (
    <div className="flex-1 overflow-auto p-4 select-none">
      <GanttHeader minDate={minDate} maxDate={maxDate} />

      <div className="relative mt-1">
        {/* Today line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-20 pointer-events-none"
          style={{ left: `calc(224px + ${todayPct}% * (100% - 224px) / 100)` }}
        />

        {/* Horizon bands (behind rows) */}
        {horizonBoundaries && (
          <HorizonBands
            minDate={minDate}
            totalMs={totalMs}
            horizonBoundaries={{
              H1_NOW: new Date(horizonBoundaries.H1_NOW),
              H2_NEXT: new Date(horizonBoundaries.H2_NEXT),
              H3_LATER: new Date(horizonBoundaries.H3_LATER),
            }}
          />
        )}

        {/* Initiative rows */}
        {initiatives.map((initiative) => {
          const left = pct(
            initiative.startDate ? new Date(initiative.startDate) : null,
            minDate
          );
          const right = pct(
            initiative.endDate ? new Date(initiative.endDate) : null,
            maxDate
          );
          const width = Math.max(right - left, 0.5);
          const isSelected = selectedId === initiative.id;

          return (
            <div
              key={initiative.id}
              className="relative h-10 mb-1 flex items-center group"
            >
              {/* Label */}
              <div className="w-56 shrink-0 text-xs font-medium truncate pr-3 flex items-center gap-1.5 z-10">
                <RAGStatusDot status={initiative.ragStatus} />
                <span className="truncate">{initiative.name}</span>
              </div>

              {/* Bar area */}
              <div className="flex-1 relative h-6">
                <div
                  className={`absolute h-full rounded-md cursor-pointer transition-all ${STATUS_COLORS[initiative.status]} ${isSelected ? "ring-2 ring-offset-1 ring-blue-500" : "hover:brightness-110"}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  onClick={() =>
                    setSelectedId(
                      isSelected ? null : initiative.id
                    )
                  }
                  title={initiative.name}
                >
                  {/* Progress fill */}
                  <div
                    className="h-full rounded-md bg-black/10"
                    style={{ width: `${initiative.progressPct}%` }}
                  />
                </div>

                {/* Milestone diamonds */}
                {initiative.milestones
                  .filter((m) => m.dueDate)
                  .map((m) => (
                    <div
                      key={m.id}
                      className={`absolute z-10 w-3 h-3 border-2 border-white
                        ${m.status === "COMPLETE"
                          ? "bg-green-600"
                          : m.isCritical
                          ? "bg-red-500"
                          : "bg-blue-500"
                        }`}
                      style={{
                        left: `${pct(m.dueDate ? new Date(m.dueDate) : null, maxDate)}%`,
                        top: "50%",
                        transform: "translate(-50%, -50%) rotate(45deg)",
                      }}
                      title={`${m.name} — ${m.dueDate ? format(new Date(m.dueDate), "MMM d") : ""}`}
                    />
                  ))}
              </div>
            </div>
          );
        })}

        {/* Dependency arrows overlay */}
        <DependencyArrows
          initiatives={initiatives as any}
          pct={pct}
          minDate={minDate}
        />
      </div>
    </div>
  );
}
