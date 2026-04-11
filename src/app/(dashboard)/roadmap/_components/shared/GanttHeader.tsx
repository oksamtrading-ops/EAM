import { format, addMonths, startOfMonth } from "date-fns";

export function GanttHeader({
  minDate,
  maxDate,
}: {
  minDate: Date;
  maxDate: Date;
}) {
  const totalMs = maxDate.getTime() - minDate.getTime();
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
    <div className="relative h-7 border-b ml-56 select-none">
      {months.map((m) => (
        <span
          key={m.label}
          className="absolute top-1 text-[10px] text-muted-foreground font-medium"
          style={{ left: `${m.pct}%` }}
        >
          {m.label}
        </span>
      ))}
    </div>
  );
}
