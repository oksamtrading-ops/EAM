"use client";

import { cn } from "@/lib/utils";
import { BV_NUMERIC, TH_NUMERIC, RAT_COLORS } from "@/lib/constants/application-colors";

type Props = {
  apps: any[];
  onSelect: (id: string) => void;
  selectedId: string | null;
};

// Gartner TIME Model quadrants:
// High BV + Low TH  = MIGRATE   (top-left)    — valuable but technically weak, modernize or replace
// High BV + High TH = INVEST    (top-right)   — strategic assets worth expanding
// Low BV + Low TH   = ELIMINATE (bottom-left) — neither valuable nor healthy, retire
// Low BV + High TH  = TOLERATE  (bottom-right)— stable, leave as-is, low priority

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
      <div className="bg-card rounded-xl border p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          TIME Rationalization Matrix
        </h3>

        {/* Top labels — outside the quadrant */}
        <div className="grid grid-cols-2 gap-2 mb-2 pl-8 pr-2 text-center">
          <div>
            <div className="text-orange-600 font-bold text-sm tracking-wide">MIGRATE</div>
            <div className="text-muted-foreground text-[10px] leading-tight mt-0.5">
              Valuable but technically weak — modernize or replace
            </div>
          </div>
          <div>
            <div className="text-blue-600 font-bold text-sm tracking-wide">INVEST</div>
            <div className="text-muted-foreground text-[10px] leading-tight mt-0.5">
              Strategic assets — enhance and expand
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {/* Y-axis label (outside) */}
          <div className="flex items-center">
            <span className="text-[10px] font-medium text-foreground/60 -rotate-90 whitespace-nowrap">
              Business Value →
            </span>
          </div>

          {/* Quadrant box */}
          <div className="flex-1 relative aspect-[4/3] max-h-[500px] border-2 border-foreground rounded-lg overflow-visible">
            {/* Quadrant background tints — inside overflow-hidden wrapper so the app-dot labels can spill out */}
            <div className="absolute inset-0 overflow-hidden rounded-lg">
              <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                <div className="bg-orange-50/40" />
                <div className="bg-blue-50/40" />
                <div className="bg-red-50/40" />
                <div className="bg-green-50/40" />
              </div>
              {/* Axis lines */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-foreground/20" />
              <div className="absolute top-1/2 left-0 right-0 h-px bg-foreground/20" />
            </div>

            {/* App dots with name labels */}
            {assessed.map((app) => {
              const color = RAT_COLORS[app.rationalizationStatus] ?? "#cbd5e1";
              const ifaceCount = (app._count?.interfacesFrom ?? 0) + (app._count?.interfacesTo ?? 0);
              // Base 20px, +3px per interface, max 36px
              const dotSize = Math.min(36, 20 + ifaceCount * 3);
              const clampedX = Math.max(4, Math.min(96, app.x));
              const clampedY = Math.max(4, Math.min(96, app.y));
              // If dot is on the right half, put label to the left of it; otherwise to the right.
              const labelOnLeft = clampedX > 70;
              const isSelected = selectedId === app.id;
              return (
                <button
                  key={app.id}
                  onClick={() => onSelect(app.id)}
                  className={cn(
                    "absolute flex items-center gap-1.5 transition-all hover:z-20 group",
                    labelOnLeft && "flex-row-reverse",
                    isSelected && "z-20"
                  )}
                  style={{
                    left: `${clampedX}%`,
                    top: `${clampedY}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                  title={`Business Value: ${app.businessValue} · Tech Health: ${app.technicalHealth}${ifaceCount > 0 ? ` · Interfaces: ${ifaceCount}` : ""}`}
                >
                  <span
                    className={cn(
                      "rounded-full border-2 border-white shadow-md shrink-0 transition-all group-hover:scale-110",
                      isSelected && "ring-2 ring-primary ring-offset-2 scale-110"
                    )}
                    style={{
                      width: dotSize,
                      height: dotSize,
                      backgroundColor: color,
                    }}
                  />
                  <span
                    className={cn(
                      "text-[11px] font-medium text-foreground bg-background/90 backdrop-blur-sm px-1.5 py-0.5 rounded border border-border shadow-sm whitespace-nowrap max-w-[140px] truncate transition-all",
                      isSelected && "bg-primary text-primary-foreground border-primary max-w-none"
                    )}
                  >
                    {app.name}
                  </span>
                </button>
              );
            })}

            {/* X-axis label (inside, at bottom) */}
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-medium text-foreground/60 whitespace-nowrap">
              Technical Health →
            </div>
          </div>
        </div>

        {/* Bottom labels — outside the quadrant */}
        <div className="grid grid-cols-2 gap-2 mt-7 pl-8 pr-2 text-center">
          <div>
            <div className="text-red-600 font-bold text-sm tracking-wide">ELIMINATE</div>
            <div className="text-muted-foreground text-[10px] leading-tight mt-0.5">
              Neither valuable nor healthy — retire
            </div>
          </div>
          <div>
            <div className="text-green-600 font-bold text-sm tracking-wide">TOLERATE</div>
            <div className="text-muted-foreground text-[10px] leading-tight mt-0.5">
              Stable but low priority — leave as-is
            </div>
          </div>
        </div>
      </div>

      {/* Unassessed apps */}
      {unassessed.length > 0 && (
        <div className="bg-card rounded-xl border p-4">
          <p className="text-sm font-medium text-foreground mb-2">
            Not Yet Assessed ({unassessed.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {unassessed.map((app) => (
              <button
                key={app.id}
                onClick={() => onSelect(app.id)}
                className="text-xs px-3 py-1.5 bg-muted rounded-lg hover:bg-muted text-muted-foreground"
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
