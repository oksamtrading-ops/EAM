"use client";

import { addMonths, differenceInMonths } from "date-fns";
import { useRoadmapContext } from "../RoadmapContext";
import { RAGStatusDot } from "../shared/RAGStatusDot";
import { GanttHeader } from "../shared/GanttHeader";
import { HorizonBands } from "../shared/HorizonBands";
import { DependencyArrows } from "../shared/DependencyArrows";

const MONTH_PX = 70;       // pixels per month in the bar area
const LABEL_W = 160;       // px — label column width
const MIN_MONTHS = 18;     // always show at least 18 months
const ROW_H = 44;          // h-10 (40) + mb-1 (4)

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-300",
  PLANNED: "bg-blue-400",
  IN_PROGRESS: "bg-primary",
  ON_HOLD: "bg-yellow-400",
  COMPLETE: "bg-emerald-600",
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

  const today = now ? new Date(now) : new Date();

  const allDates = initiatives.flatMap((i) =>
    [i.startDate, i.endDate].filter(Boolean)
  ) as Date[];

  // minDate: earliest of today or earliest initiative date (floor to start of month)
  const rawMin = allDates.length > 0
    ? new Date(Math.min(...allDates.map((d) => new Date(d).getTime())))
    : today;
  const minDate = new Date(Math.min(today.getTime(), rawMin.getTime()));
  minDate.setDate(1);
  minDate.setHours(0, 0, 0, 0);

  // maxDate: ensure at least MIN_MONTHS visible
  const rawMax = allDates.length > 0
    ? new Date(Math.max(...allDates.map((d) => new Date(d).getTime())))
    : addMonths(today, MIN_MONTHS);
  const minMaxDate = addMonths(minDate, MIN_MONTHS);
  const maxDate = new Date(Math.max(rawMax.getTime(), minMaxDate.getTime()));

  const totalMonths = Math.max(differenceInMonths(maxDate, minDate) + 2, MIN_MONTHS);
  const totalMs = maxDate.getTime() - minDate.getTime() || 1;
  const chartWidth = totalMonths * MONTH_PX; // bar area total width in px
  const totalWidth = LABEL_W + chartWidth;

  function pct(date: Date | null | undefined, fallback: Date): number {
    const d = date ? new Date(date) : fallback;
    return Math.max(0, Math.min(100, ((d.getTime() - minDate.getTime()) / totalMs) * 100));
  }

  const todayPct = pct(today, today);

  return (
    <div className="flex-1 overflow-auto select-none">
      <div style={{ minWidth: totalWidth }}>
        {/* Sticky header row */}
        <div className="sticky top-0 z-30 bg-background border-b">
          <GanttHeader minDate={minDate} maxDate={maxDate} labelW={LABEL_W} chartWidth={chartWidth} />
        </div>

        {/* Rows */}
        <div className="relative">
          {/* Today line — positioned over entire chart area */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-20 pointer-events-none"
            style={{ left: `${LABEL_W + (todayPct / 100) * chartWidth}px` }}
          />

          {/* Horizon bands sit behind the bar area only */}
          {horizonBoundaries && (
            <div
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{ left: LABEL_W, right: 0 }}
            >
              <HorizonBands
                minDate={minDate}
                totalMs={totalMs}
                horizonBoundaries={{
                  H1_NOW: new Date(horizonBoundaries.H1_NOW),
                  H2_NEXT: new Date(horizonBoundaries.H2_NEXT),
                  H3_LATER: new Date(horizonBoundaries.H3_LATER),
                }}
              />
            </div>
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
              <div key={initiative.id} className="flex items-center h-10 mb-1 group">
                {/* Sticky label column */}
                <div
                  className="sticky left-0 z-10 bg-background flex items-center gap-1.5 pr-3 h-full border-r shrink-0"
                  style={{ width: LABEL_W }}
                >
                  <RAGStatusDot status={initiative.ragStatus} />
                  <span className="text-xs font-medium truncate">{initiative.name}</span>
                </div>

                {/* Bar area */}
                <div className="relative h-6 flex-1">
                  <div
                    className={`absolute h-full rounded-md cursor-pointer transition-all ${STATUS_COLORS[initiative.status]} ${isSelected ? "ring-2 ring-offset-1 ring-blue-500" : "hover:brightness-110"}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    onClick={() => setSelectedId(isSelected ? null : initiative.id)}
                    title={initiative.name}
                  >
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
                          ${m.status === "COMPLETE" ? "bg-emerald-600" : m.isCritical ? "bg-red-500" : "bg-blue-500"}`}
                        style={{
                          left: `${pct(m.dueDate ? new Date(m.dueDate) : null, maxDate)}%`,
                          top: "50%",
                          transform: "translate(-50%, -50%) rotate(45deg)",
                        }}
                        title={m.name}
                      />
                    ))}
                </div>
              </div>
            );
          })}

          {/* Dependency arrows — offset to bar area start */}
          <div style={{ marginLeft: LABEL_W }}>
            <DependencyArrows
              initiatives={initiatives as any}
              pct={pct}
              minDate={minDate}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
