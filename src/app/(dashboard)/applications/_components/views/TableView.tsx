"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  LIFECYCLE_COLORS, LIFECYCLE_LABELS,
  BV_LABELS, BV_COLORS,
  TH_LABELS, TH_COLORS,
  RAT_LABELS, RAT_COLORS,
  APP_TYPE_LABELS,
} from "@/lib/constants/application-colors";

type Props = {
  apps: any[];
  onSelect: (id: string) => void;
  selectedId: string | null;
};

export function TableView({ apps, onSelect, selectedId }: Props) {
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-[#fafbfc]">
            <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Application</th>
            <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Vendor</th>
            <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Type</th>
            <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Lifecycle</th>
            <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Business Value</th>
            <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Tech Health</th>
            <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Rationalization</th>
            <th className="text-right px-4 py-3 font-medium text-xs text-muted-foreground">Cost/yr</th>
            <th className="text-center px-4 py-3 font-medium text-xs text-muted-foreground">Caps</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {apps.map((app) => (
            <tr
              key={app.id}
              onClick={() => onSelect(app.id)}
              className={cn(
                "cursor-pointer transition-colors hover:bg-[#fafbfc]",
                selectedId === app.id && "bg-[#86BC25]/5"
              )}
            >
              <td className="px-4 py-3">
                <div>
                  <p className="font-medium text-[#1a1f2e]">{app.name}</p>
                  {app.alias && (
                    <p className="text-[11px] text-muted-foreground">{app.alias}</p>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground text-xs">{app.vendor ?? "—"}</td>
              <td className="px-4 py-3">
                <span className="text-xs text-muted-foreground">
                  {APP_TYPE_LABELS[app.applicationType] ?? app.applicationType}
                </span>
              </td>
              <td className="px-4 py-3">
                <StatusPill color={LIFECYCLE_COLORS[app.lifecycle]} label={LIFECYCLE_LABELS[app.lifecycle]} />
              </td>
              <td className="px-4 py-3">
                <StatusPill color={BV_COLORS[app.businessValue]} label={BV_LABELS[app.businessValue]} />
              </td>
              <td className="px-4 py-3">
                <StatusPill color={TH_COLORS[app.technicalHealth]} label={TH_LABELS[app.technicalHealth]} />
              </td>
              <td className="px-4 py-3">
                <StatusPill color={RAT_COLORS[app.rationalizationStatus]} label={RAT_LABELS[app.rationalizationStatus]} />
              </td>
              <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                {app.annualCostUsd
                  ? `$${Number(app.annualCostUsd).toLocaleString()}`
                  : "—"}
              </td>
              <td className="px-4 py-3 text-center">
                <span className="text-xs text-muted-foreground bg-[#f1f3f5] px-2 py-0.5 rounded-full">
                  {app.capabilities?.length ?? 0}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ color, label }: { color?: string; label?: string }) {
  return (
    <span
      className="text-[11px] font-medium px-2 py-0.5 rounded-full border inline-flex items-center gap-1"
      style={{ borderColor: (color ?? "#cbd5e1") + "60", color: color ?? "#cbd5e1" }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color ?? "#cbd5e1" }} />
      {label ?? "N/A"}
    </span>
  );
}
