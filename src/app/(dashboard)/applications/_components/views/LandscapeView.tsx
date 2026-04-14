"use client";

import { cn } from "@/lib/utils";
import { RAT_COLORS, RAT_LABELS } from "@/lib/constants/application-colors";
import { AlertTriangle } from "lucide-react";

type Props = {
  apps: any[];
  capTree: any[];
  onSelect: (id: string) => void;
  selectedId: string | null;
};

export function LandscapeView({ apps, capTree, onSelect, selectedId }: Props) {
  // Build capId -> apps mapping
  const capApps = new Map<string, any[]>();
  for (const app of apps) {
    for (const mapping of app.capabilities ?? []) {
      const existing = capApps.get(mapping.capabilityId) ?? [];
      capApps.set(mapping.capabilityId, [...existing, app]);
    }
  }

  // Apps with no capabilities
  const unmapped = apps.filter((a) => !a.capabilities || a.capabilities.length === 0);

  return (
    <div className="space-y-5">
      {/* Legend */}
      <div className="bg-card rounded-xl border p-4 flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          Application Landscape — by Capability
        </span>
        <div className="flex items-center gap-3">
          {Object.entries(RAT_LABELS).filter(([k]) => k !== "RAT_NOT_ASSESSED").map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: RAT_COLORS[key] }} />
              <span className="text-[11px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Capability columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {capTree.map((l1: any) => (
          <div key={l1.id} className="bg-card rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b bg-foreground">
              <p className="text-xs font-bold text-background">{l1.name}</p>
              <p className="text-[10px] text-background/50">
                {(capApps.get(l1.id) ?? []).length} apps
                {(l1.children ?? []).reduce((sum: number, c: any) => sum + (capApps.get(c.id) ?? []).length, 0) > 0 &&
                  ` + ${(l1.children ?? []).reduce((sum: number, c: any) => sum + (capApps.get(c.id) ?? []).length, 0)} in sub-caps`}
              </p>
            </div>
            <div className="p-2 space-y-1.5 bg-muted/20 min-h-[80px]">
              {/* Apps directly mapped to L1 */}
              {(capApps.get(l1.id) ?? []).map((app: any) => (
                <AppCard key={app.id} app={app} onSelect={onSelect} selected={selectedId === app.id} />
              ))}
              {/* Apps mapped to L2 children */}
              {(l1.children ?? []).flatMap((l2: any) =>
                (capApps.get(l2.id) ?? []).map((app: any) => (
                  <AppCard key={`${l2.id}-${app.id}`} app={app} onSelect={onSelect} selected={selectedId === app.id} />
                ))
              )}
              {(capApps.get(l1.id) ?? []).length === 0 &&
                (l1.children ?? []).every((l2: any) => (capApps.get(l2.id) ?? []).length === 0) && (
                  <div className="flex items-center gap-1.5 p-2 text-[11px] text-orange-600">
                    <AlertTriangle className="h-3 w-3" />
                    No app support — gap
                  </div>
                )}
            </div>
          </div>
        ))}
      </div>

      {/* Unmapped apps */}
      {unmapped.length > 0 && (
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b bg-orange-50">
            <p className="text-sm font-medium text-orange-800">
              Unmapped Applications ({unmapped.length})
            </p>
            <p className="text-xs text-orange-600">
              These applications are not linked to any capability.
            </p>
          </div>
          <div className="p-3 flex flex-wrap gap-2">
            {unmapped.map((app) => (
              <AppCard key={app.id} app={app} onSelect={onSelect} selected={selectedId === app.id} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AppCard({ app, onSelect, selected }: { app: any; onSelect: (id: string) => void; selected: boolean }) {
  const color = RAT_COLORS[app.rationalizationStatus] ?? RAT_COLORS.RAT_NOT_ASSESSED;
  return (
    <button
      onClick={() => onSelect(app.id)}
      className={cn(
        "text-left w-full px-3 py-2 rounded-lg border text-xs transition-all hover:shadow-sm",
        selected ? "border-primary ring-1 ring-primary/20 bg-card" : "border-border bg-card hover:border-primary/30"
      )}
      style={{ borderLeftColor: color, borderLeftWidth: "3px" }}
    >
      <p className="font-medium text-foreground truncate">{app.name}</p>
      {app.vendor && <p className="text-[10px] text-muted-foreground truncate">{app.vendor}</p>}
    </button>
  );
}
