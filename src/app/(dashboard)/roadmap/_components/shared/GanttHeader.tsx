import { format, addMonths, startOfMonth } from "date-fns";

export function GanttHeader({
  minDate,
  maxDate,
  labelW,
  chartWidth,
}: {
  minDate: Date;
  maxDate: Date;
  labelW: number;
  chartWidth: number;
}) {
  const totalMs = maxDate.getTime() - minDate.getTime() || 1;
  const months: { label: string; pct: number }[] = [];

  let cursor = startOfMonth(minDate);
  while (cursor <= maxDate) {
    const pct = Math.max(
      0,
      Math.min(100, ((cursor.getTime() - minDate.getTime()) / totalMs) * 100)
    );
    months.push({ label: format(cursor, "MMM yy"), pct });
    cursor = addMonths(cursor, 1);
  }

  return (
    <div className="flex">
      {/* Label column spacer */}
      <div style={{ width: labelW, minWidth: labelW }} className="shrink-0 border-r bg-background" />
      {/* Chart header */}
      <div className="relative h-8 flex-1 overflow-hidden" style={{ minWidth: chartWidth }}>
        {months.map((m) => (
          <div
            key={m.label}
            className="absolute top-0 h-full flex items-center border-r border-border/40"
            style={{ left: `${m.pct}%` }}
          >
            <span className="pl-1.5 text-[10px] text-muted-foreground font-medium whitespace-nowrap">
              {m.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
