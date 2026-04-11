// SVG overlay that draws arrows between initiative bars in GanttView
// Each initiative row is ROW_HEIGHT px tall; arrows connect end of blocker to start of dependent

const ROW_HEIGHT = 44; // h-10 (40px) + mb-1 (4px)

type Initiative = {
  id: string;
  startDate?: Date | null;
  endDate?: Date | null;
  dependsOn: Array<{
    blockingId: string;
    blocking?: { id: string } | null;
  }>;
};

export function DependencyArrows({
  initiatives,
  pct,
  minDate,
}: {
  initiatives: Initiative[];
  pct: (d: Date | null | undefined, fallback: Date) => number;
  minDate: Date;
}) {
  if (!initiatives?.length) return null;

  const idToIndex = new Map(initiatives.map((i, idx) => [i.id, idx]));
  const maxDate = new Date(
    Math.max(
      ...initiatives
        .flatMap((i) => [i.startDate, i.endDate])
        .filter(Boolean)
        .map((d) => d!.getTime())
    )
  );

  const arrows: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

  for (const initiative of initiatives) {
    for (const dep of initiative.dependsOn) {
      const blockingIdx = idToIndex.get(dep.blockingId);
      const dependentIdx = idToIndex.get(initiative.id);
      if (blockingIdx === undefined || dependentIdx === undefined) continue;

      const blocking = initiatives[blockingIdx];
      const x1 = pct(blocking.endDate, maxDate);
      const y1 = blockingIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
      const x2 = pct(initiative.startDate, minDate);
      const y2 = dependentIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
      arrows.push({ x1, y1, x2, y2 });
    }
  }

  if (!arrows.length) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none ml-56"
      style={{ width: "calc(100% - 224px)", height: `${initiatives.length * ROW_HEIGHT}px` }}
      overflow="visible"
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="6"
          markerHeight="6"
          refX="3"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
        </marker>
      </defs>
      {arrows.map((a, i) => (
        <path
          key={i}
          d={`M ${a.x1}% ${a.y1} C ${(a.x1 + a.x2) / 2}% ${a.y1}, ${(a.x1 + a.x2) / 2}% ${a.y2}, ${a.x2}% ${a.y2}`}
          fill="none"
          stroke="#94a3b8"
          strokeWidth="1.5"
          markerEnd="url(#arrowhead)"
        />
      ))}
    </svg>
  );
}
