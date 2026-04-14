"use client";

import { cn } from "@/lib/utils";
import { BV_NUMERIC, TH_NUMERIC, RAT_COLORS } from "@/lib/constants/application-colors";

type Props = {
  apps: any[];
  onSelect: (id: string) => void;
  selectedId: string | null;
};

// TIME Model quadrants:
// High BV + Low TH = INVEST (top-left)
// High BV + High TH = TOLERATE (top-right)
// Low BV + Low TH = ELIMINATE (bottom-left)
// Low BV + High TH = MIGRATE (bottom-right)

export function RationalizationMatrix({ apps, onSelect, selectedId }: Props) {
  // Position apps in the quadrant
  const positioned = apps.map((app) => {
    const bv = BV_NUMERIC[app.businessValue] ?? 0;
    const th = TH_NUMERIC[app.technicalHealth] ?? 0;
    // Normalize to 0-100 scale
    const x = (th / 5) * 100;
    const y = 100 - (bv / 4) * 100; // Invert Y so high value is at top
    return { ...app, x, y };
  });

  // Filter out unassessed
  const assessed = positioned.filter(
    (a) => a.businessValue !== "BV_UNKNOWN" || a.technicalHealth !== "TH_UNKNOWN"
  );
  const unassessed = positioned.filter(
    (a) => a.businessValue === "BV_UNKNOWN" && a.technicalHealth === "TH_UNKNOWN"
  );

  return (
    <div className="space-y-4">
      {/* Quadrant chart */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-sm font-semibold text-[#1a1f2e] mb-4">
          TIME Rationalization Matrix
        </h3>

        <div className="relative w-full aspect-[4/3] max-h-[500px] border-2 border-[#1a1f2e] rounded-lg overflow-hidden">
          {/* Quadrant backgrounds */}
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
            <div className="bg-blue-50/50 flex items-center justify-center">
              <span className="text-blue-600 font-bold text-lg opacity-20">INVEST</span>
            </div>
            <div className="bg-green-50/50 flex items-center justify-center">
              <span className="text-green-600 font-bold text-lg opacity-20">TOLERATE</span>
            </div>
            <div className="bg-red-50/50 flex items-center justify-center">
              <span className="text-red-600 font-bold text-lg opacity-20">ELIMINATE</span>
            </div>
            <div className="bg-orange-50/50 flex items-center justify-center">
              <span className="text-orange-600 font-bold text-lg opacity-20">MIGRATE</span>
            </div>
          </div>

          {/* Axis lines */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#1a1f2e]/20" />
          <div className="absolute top-1/2 left-0 right-0 h-px bg-[#1a1f2e]/20" />

          {/* App dots — size reflects integration count (migration risk) */}
          {assessed.map((app) => {
            const color = RAT_COLORS[app.rationalizationStatus] ?? "#cbd5e1";
            const ifaceCount = (app._count?.interfacesFrom ?? 0) + (app._count?.interfacesTo ?? 0);
            // Base 28px, +4px per interface, max 48px
            const dotSize = Math.min(48, 28 + ifaceCount * 4);
            return (
              <button
                key={app.id}
                onClick={() => onSelect(app.id)}
                className={cn(
                  "absolute rounded-full border-2 border-white shadow-md transition-all hover:scale-125 hover:z-10 flex items-center justify-center text-[8px] font-bold text-white",
                  selectedId === app.id && "ring-2 ring-[#0B5CD6] ring-offset-2 scale-125 z-10"
                )}
                style={{
                  width: dotSize,
                  height: dotSize,
                  left: `${Math.max(5, Math.min(95, app.x))}%`,
                  top: `${Math.max(5, Math.min(95, app.y))}%`,
                  transform: "translate(-50%, -50%)",
                  backgroundColor: color,
                }}
                title={`${app.name}\nBusiness Value: ${app.businessValue}\nTech Health: ${app.technicalHealth}${ifaceCount > 0 ? `\nInterfaces: ${ifaceCount}` : ""}`}
              >
                {app.name.substring(0, 2).toUpperCase()}
              </button>
            );
          })}

          {/* Axis labels */}
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-medium text-[#1a1f2e]/60">
            Technical Health →
          </div>
          <div className="absolute left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] font-medium text-[#1a1f2e]/60">
            Business Value →
          </div>
        </div>
      </div>

      {/* Unassessed apps */}
      {unassessed.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm font-medium text-[#1a1f2e] mb-2">
            Not Yet Assessed ({unassessed.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {unassessed.map((app) => (
              <button
                key={app.id}
                onClick={() => onSelect(app.id)}
                className="text-xs px-3 py-1.5 bg-[#f1f3f5] rounded-lg hover:bg-[#e9ecef] text-muted-foreground"
              >
                {app.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
