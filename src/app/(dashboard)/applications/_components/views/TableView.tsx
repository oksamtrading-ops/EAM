"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  LIFECYCLE_COLORS, LIFECYCLE_LABELS,
  BV_LABELS, BV_COLORS,
  TH_LABELS, TH_COLORS,
  RAT_LABELS, RAT_COLORS,
  APP_TYPE_LABELS,
  FF_LABELS, FF_COLORS,
  DC_LABELS, DC_COLORS,
} from "@/lib/constants/application-colors";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

type Props = {
  apps: any[];
  onSelect: (id: string) => void;
  selectedId: string | null;
};

export function TableView({ apps, onSelect, selectedId }: Props) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const deleteMutation = trpc.application.delete.useMutation({
    onSuccess: () => {
      utils.application.list.invalidate();
      setPendingDeleteId(null);
      toast.success("Application deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="bg-card rounded-xl border overflow-x-auto">
      <table className="w-full text-sm min-w-[900px]">
        <thead>
          <tr className="border-b bg-muted/20">
            <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Application</th>
            <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Vendor</th>
            <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Type</th>
            <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Lifecycle</th>
            <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Business Value</th>
            <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Tech Health</th>
            <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Func. Fit</th>
            <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Rationalization</th>
            <th className="text-left px-4 py-3 font-medium text-xs text-muted-foreground">Data Class.</th>
            <th className="text-right px-4 py-3 font-medium text-xs text-muted-foreground">Cost/yr</th>
            <th className="text-center px-4 py-3 font-medium text-xs text-muted-foreground">Caps</th>
            <th className="text-center px-4 py-3 font-medium text-xs text-muted-foreground">Ifaces</th>
            <th className="w-8 px-2 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {apps.map((app) => (
            <tr
              key={app.id}
              onClick={() => { if (pendingDeleteId !== app.id) onSelect(app.id); }}
              className={cn(
                "group cursor-pointer transition-colors hover:bg-muted/20",
                selectedId === app.id && "bg-primary/5"
              )}
            >
              <td className="px-4 py-3">
                <div>
                  <p className="font-medium text-foreground">{app.name}</p>
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
                <Tooltip>
                  <TooltipTrigger ><span className="cursor-help"><StatusPill color={LIFECYCLE_COLORS[app.lifecycle]} label={LIFECYCLE_LABELS[app.lifecycle]} /></span></TooltipTrigger>
                  <TooltipContent side="top">Lifecycle: {LIFECYCLE_LABELS[app.lifecycle] ?? app.lifecycle}</TooltipContent>
                </Tooltip>
              </td>
              <td className="px-4 py-3">
                <Tooltip>
                  <TooltipTrigger ><span className="cursor-help"><StatusPill color={BV_COLORS[app.businessValue]} label={BV_LABELS[app.businessValue]} /></span></TooltipTrigger>
                  <TooltipContent side="top">Business Value — revenue and strategic impact of this application</TooltipContent>
                </Tooltip>
              </td>
              <td className="px-4 py-3">
                <Tooltip>
                  <TooltipTrigger ><span className="cursor-help"><StatusPill color={TH_COLORS[app.technicalHealth]} label={TH_LABELS[app.technicalHealth]} /></span></TooltipTrigger>
                  <TooltipContent side="top">Technical Health — code quality, architecture fitness, and maintainability</TooltipContent>
                </Tooltip>
              </td>
              <td className="px-4 py-3">
                <Tooltip>
                  <TooltipTrigger ><span className="cursor-help"><StatusPill color={FF_COLORS[app.functionalFit]} label={FF_LABELS[app.functionalFit]} /></span></TooltipTrigger>
                  <TooltipContent side="top">Functional Fit — how well the app serves its intended business purpose</TooltipContent>
                </Tooltip>
              </td>
              <td className="px-4 py-3">
                <Tooltip>
                  <TooltipTrigger ><span className="cursor-help"><StatusPill color={RAT_COLORS[app.rationalizationStatus]} label={RAT_LABELS[app.rationalizationStatus]} /></span></TooltipTrigger>
                  <TooltipContent side="top">Rationalization — recommended disposition: Keep, Migrate, Consolidate, or Retire</TooltipContent>
                </Tooltip>
              </td>
              <td className="px-4 py-3">
                <Tooltip>
                  <TooltipTrigger ><span className="cursor-help"><StatusPill color={DC_COLORS[app.dataClassification]} label={DC_LABELS[app.dataClassification]} /></span></TooltipTrigger>
                  <TooltipContent side="top">Data Classification — sensitivity of data this application handles</TooltipContent>
                </Tooltip>
              </td>
              <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                <Tooltip>
                  <TooltipTrigger >
                    <span className="cursor-help">
                      {app.annualCostUsd ? `$${Number(app.annualCostUsd).toLocaleString()}` : "—"}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">Annual operating cost in USD</TooltipContent>
                </Tooltip>
              </td>
              <td className="px-4 py-3 text-center">
                <Tooltip>
                  <TooltipTrigger >
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full cursor-help">
                      {app.capabilities?.length ?? 0}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">Linked business capabilities</TooltipContent>
                </Tooltip>
              </td>
              <td className="px-4 py-3 text-center">
                <Tooltip>
                  <TooltipTrigger >
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full cursor-help">
                      {(app._count?.interfacesFrom ?? 0) + (app._count?.interfacesTo ?? 0)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">Application interfaces (integrations)</TooltipContent>
                </Tooltip>
              </td>
              <td className="px-2 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                {pendingDeleteId === app.id ? (
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => deleteMutation.mutate({ id: app.id })}
                      disabled={deleteMutation.isPending}
                      className="text-xs text-white bg-rose-500 hover:bg-rose-600 px-2 py-0.5 rounded font-medium disabled:opacity-50"
                    >
                      {deleteMutation.isPending ? "…" : "Delete"}
                    </button>
                    <button
                      onClick={() => setPendingDeleteId(null)}
                      className="text-xs text-muted-foreground hover:text-foreground px-1"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <Tooltip>
                    <TooltipTrigger >
                      <button
                        onClick={() => setPendingDeleteId(app.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left">Delete application</TooltipContent>
                  </Tooltip>
                )}
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
