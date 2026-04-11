const BAND_COLORS: Record<string, string> = {
  H1_NOW: "bg-blue-50/60",
  H2_NEXT: "bg-purple-50/60",
  H3_LATER: "bg-gray-50/60",
};

export function HorizonBands({
  minDate,
  totalMs,
  horizonBoundaries,
}: {
  minDate: Date;
  totalMs: number;
  horizonBoundaries: Record<string, Date>;
}) {
  const bands = [
    { key: "H1_NOW", from: minDate, to: horizonBoundaries.H1_NOW },
    {
      key: "H2_NEXT",
      from: horizonBoundaries.H1_NOW,
      to: horizonBoundaries.H2_NEXT,
    },
    {
      key: "H3_LATER",
      from: horizonBoundaries.H2_NEXT,
      to: horizonBoundaries.H3_LATER,
    },
  ];

  function pct(d: Date): number {
    return Math.max(0, Math.min(100, ((d.getTime() - minDate.getTime()) / totalMs) * 100));
  }

  return (
    <div className="absolute inset-0 pointer-events-none ml-56">
      {bands.map((band) => {
        const left = pct(band.from);
        const width = pct(band.to) - left;
        return (
          <div
            key={band.key}
            className={`absolute top-0 bottom-0 ${BAND_COLORS[band.key]}`}
            style={{ left: `${left}%`, width: `${Math.max(0, width)}%` }}
          />
        );
      })}
    </div>
  );
}
