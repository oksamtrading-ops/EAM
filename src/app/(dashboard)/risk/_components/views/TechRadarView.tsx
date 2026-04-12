"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import { useRiskContext } from "../RiskContext";
import { RadarEntryPanel } from "../panels/RadarEntryPanel";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const RING_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  ADOPT:  { bg: "bg-[#3B6D11]", text: "text-[#3B6D11]",  border: "border-[#3B6D11]"  },
  TRIAL:  { bg: "bg-[#185FA5]", text: "text-[#185FA5]",  border: "border-[#185FA5]"  },
  ASSESS: { bg: "bg-[#BA7517]", text: "text-[#BA7517]",  border: "border-[#BA7517]"  },
  HOLD:   { bg: "bg-[#A32D2D]", text: "text-[#A32D2D]",  border: "border-[#A32D2D]"  },
};

const RING_SVG_RADII = { ADOPT: 60, TRIAL: 120, ASSESS: 190, HOLD: 260 };
const RING_ORDER = ["ADOPT", "TRIAL", "ASSESS", "HOLD"] as const;
const QUADRANT_ORDER = [
  "LANGUAGES_FRAMEWORKS",
  "PLATFORMS_INFRASTRUCTURE",
  "TOOLS_TECHNIQUES",
  "DATA_STORAGE",
] as const;

const QUADRANT_LABELS: Record<string, string> = {
  LANGUAGES_FRAMEWORKS: "Languages & Frameworks",
  PLATFORMS_INFRASTRUCTURE: "Platforms & Infrastructure",
  TOOLS_TECHNIQUES: "Tools & Techniques",
  DATA_STORAGE: "Data Storage",
};

// Deterministic position within quadrant sector
function entryPosition(
  index: number,
  total: number,
  ring: string,
  quadrant: number
): { x: number; y: number } {
  const innerR = ring === "ADOPT" ? 10 : ring === "TRIAL" ? 60 : ring === "ASSESS" ? 120 : 190;
  const outerR = RING_SVG_RADII[ring as keyof typeof RING_SVG_RADII];
  const r = innerR + ((outerR - innerR) / (total + 1)) * (index + 1);

  // Quadrant angles (0=top-right, 1=top-left, 2=bottom-left, 3=bottom-right)
  const startAngles = [0, 90, 180, 270];
  const startA = startAngles[quadrant] ?? 0;
  const spreadA = 80; // degrees within quadrant
  const angle = startA + (spreadA / (total + 1)) * (index + 1);
  const rad = (angle * Math.PI) / 180;
  return {
    x: 270 + r * Math.cos(rad),
    y: 270 - r * Math.sin(rad),
  };
}

export function TechRadarView() {
  const { radar } = useRiskContext();
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const utils = trpc.useUtils();

  const syncMutation = trpc.techRadar.syncFromTechComponents.useMutation({
    onSuccess: (res) => {
      toast.success(`Synced ${res.synced} entry(ies) from portfolio`);
      utils.techRadar.getRadar.invalidate();
    },
    onError: () => toast.error("Sync failed"),
  });

  const entries = radar?.entries ?? [];

  // Build index by quadrant+ring
  const indexedEntries: Record<string, Record<string, typeof entries>> = {};
  for (const q of QUADRANT_ORDER) {
    indexedEntries[q] = {};
    for (const r of RING_ORDER) indexedEntries[q][r] = [];
  }
  for (const e of entries) {
    indexedEntries[e.quadrant]?.[e.ring]?.push(e);
  }

  const selectedEntry = selectedEntryId ? entries.find((e) => e.id === selectedEntryId) : null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* SVG Radar */}
      <div className="flex-1 overflow-auto p-6 flex flex-col items-center">
        <div className="flex items-center justify-between w-full max-w-[580px] mb-4">
          <h2 className="text-base font-semibold">Tech Radar</h2>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="gap-1.5"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", syncMutation.isPending && "animate-spin")} />
              Sync from portfolio
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-[#86BC25] hover:bg-[#75a821] text-white"
              onClick={() => { setSelectedEntryId(null); setShowPanel(true); }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add entry
            </Button>
          </div>
        </div>

        <svg width="540" height="540" viewBox="0 0 540 540">
          {/* Ring band fills — subtle tinted zones */}
          <circle cx="270" cy="270" r="260" fill="rgba(163,45,45,0.04)" />
          <circle cx="270" cy="270" r="190" fill="rgba(186,117,23,0.05)" />
          <circle cx="270" cy="270" r="120" fill="rgba(24,95,165,0.05)" />
          <circle cx="270" cy="270" r="60"  fill="rgba(59,109,17,0.07)" />

          {/* Ring circles */}
          {RING_ORDER.map((ring) => (
            <circle
              key={ring}
              cx="270" cy="270"
              r={RING_SVG_RADII[ring]}
              fill="none"
              stroke="rgba(0,0,0,0.12)"
              strokeWidth="1"
            />
          ))}

          {/* Quadrant dividers */}
          <line x1="270" y1="10" x2="270" y2="530" stroke="rgba(0,0,0,0.12)" strokeWidth="1" />
          <line x1="10" y1="270" x2="530" y2="270" stroke="rgba(0,0,0,0.12)" strokeWidth="1" />

          {/* Ring labels — larger, darker */}
          {RING_ORDER.map((ring) => (
            <text
              key={ring}
              x={270 + RING_SVG_RADII[ring] - 6}
              y="266"
              fontSize="11"
              fill="#44495a"
              textAnchor="end"
              fontWeight="700"
              letterSpacing="0.5"
            >
              {ring}
            </text>
          ))}

          {/* Quadrant labels — centered in outer corner of each quadrant */}
          <text x="405" y="34" fontSize="12" fill="#2d3142" fontWeight="700" textAnchor="middle">Languages &amp;</text>
          <text x="405" y="49" fontSize="12" fill="#2d3142" fontWeight="700" textAnchor="middle">Frameworks</text>
          <text x="135" y="34" fontSize="12" fill="#2d3142" fontWeight="700" textAnchor="middle">Platforms &amp;</text>
          <text x="135" y="49" fontSize="12" fill="#2d3142" fontWeight="700" textAnchor="middle">Infrastructure</text>
          <text x="405" y="503" fontSize="12" fill="#2d3142" fontWeight="700" textAnchor="middle">Tools &amp;</text>
          <text x="405" y="518" fontSize="12" fill="#2d3142" fontWeight="700" textAnchor="middle">Techniques</text>
          <text x="135" y="503" fontSize="12" fill="#2d3142" fontWeight="700" textAnchor="middle">Data</text>
          <text x="135" y="518" fontSize="12" fill="#2d3142" fontWeight="700" textAnchor="middle">Storage</text>

          {/* Entries */}
          {QUADRANT_ORDER.map((quadrant, qi) =>
            RING_ORDER.map((ring) => {
              const qEntries = indexedEntries[quadrant][ring];
              return qEntries.map((entry, idx) => {
                const pos = entryPosition(idx, qEntries.length, ring, qi);
                const colors = RING_COLORS[ring];
                const isSelected = entry.id === selectedEntryId;
                return (
                  <g
                    key={entry.id}
                    onClick={() => { setSelectedEntryId(entry.id); setShowPanel(true); }}
                    className="cursor-pointer"
                  >
                    <circle
                      cx={pos.x} cy={pos.y} r={isSelected ? 9 : 7}
                      className={cn(
                        colors?.bg ?? "bg-gray-500",
                        entry.isNew ? "opacity-100" : "opacity-80"
                      )}
                      fill={ring === "ADOPT" ? "#3B6D11" : ring === "TRIAL" ? "#185FA5" : ring === "ASSESS" ? "#BA7517" : "#A32D2D"}
                      stroke={isSelected ? "white" : "none"}
                      strokeWidth={isSelected ? 2 : 0}
                    />
                    {entry.isNew && (
                      <circle
                        cx={pos.x} cy={pos.y} r="10"
                        fill="none"
                        stroke={ring === "ADOPT" ? "#3B6D11" : ring === "TRIAL" ? "#185FA5" : ring === "ASSESS" ? "#BA7517" : "#A32D2D"}
                        strokeWidth="1.5"
                        strokeDasharray="3 2"
                        opacity="0.7"
                      />
                    )}
                    <title>{entry.name}</title>
                  </g>
                );
              });
            })
          )}
        </svg>

        {/* Legend */}
        <div className="flex gap-4 mt-4">
          {RING_ORDER.map((ring) => (
            <div key={ring} className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{
                  backgroundColor:
                    ring === "ADOPT" ? "#3B6D11"
                    : ring === "TRIAL" ? "#185FA5"
                    : ring === "ASSESS" ? "#BA7517"
                    : "#A32D2D",
                }}
              />
              <span className="text-[11px] text-muted-foreground">{ring}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full border border-gray-400 border-dashed" />
            <span className="text-[11px] text-muted-foreground">New</span>
          </div>
        </div>
      </div>

      {/* Sidebar list */}
      <div className="w-72 border-l overflow-y-auto bg-background shrink-0">
        <div className="p-4 border-b">
          <p className="text-sm font-semibold">All Entries ({entries.length})</p>
        </div>
        {RING_ORDER.map((ring) => {
          const ringEntries = entries.filter((e) => e.ring === ring);
          if (ringEntries.length === 0) return null;
          const colors = RING_COLORS[ring];
          return (
            <div key={ring}>
              <div className={cn("px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white", colors.bg)}>
                {ring} · {ringEntries.length}
              </div>
              {ringEntries.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => { setSelectedEntryId(entry.id); setShowPanel(true); }}
                  className={cn(
                    "w-full text-left px-4 py-2 hover:bg-muted/50 transition-colors border-b border-border/30",
                    selectedEntryId === entry.id && "bg-muted"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[12px] font-medium", colors.text)}>{entry.name}</span>
                    {entry.isNew && <Badge variant="outline" className="text-[9px] h-4 px-1">NEW</Badge>}
                    {entry.movedFrom && (
                      <Badge variant="outline" className="text-[9px] h-4 px-1 text-blue-600">↑</Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {QUADRANT_LABELS[entry.quadrant]}
                  </p>
                </button>
              ))}
            </div>
          );
        })}
        {entries.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No entries yet. Add technologies or sync from portfolio.
          </div>
        )}
      </div>

      {showPanel && (
        <RadarEntryPanel
          entryId={selectedEntryId}
          onClose={() => { setShowPanel(false); setSelectedEntryId(null); }}
        />
      )}
    </div>
  );
}
