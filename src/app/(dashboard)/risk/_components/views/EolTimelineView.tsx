"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, CheckCircle2, AlertTriangle, Trash2, X } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useRiskContext } from "../RiskContext";
import { EolAcknowledgeModal } from "../modals/EolAcknowledgeModal";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const BAND_ORDER = ["EXPIRED", "URGENT", "WARNING", "APPROACHING", "PLANNED", "HEALTHY"] as const;

const BAND_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  EXPIRED:    { bg: "bg-red-50",    text: "text-red-700",    badge: "bg-red-100 text-red-700" },
  URGENT:     { bg: "bg-red-50",    text: "text-red-600",    badge: "bg-red-100 text-red-600" },
  WARNING:    { bg: "bg-orange-50", text: "text-orange-700", badge: "bg-orange-100 text-orange-700" },
  APPROACHING:{ bg: "bg-yellow-50", text: "text-yellow-700", badge: "bg-yellow-100 text-yellow-700" },
  PLANNED:    { bg: "bg-blue-50",   text: "text-blue-700",   badge: "bg-blue-100 text-blue-700" },
  HEALTHY:    { bg: "bg-green-50",  text: "text-green-700",  badge: "bg-green-100 text-green-700" },
};

const BAND_LABELS: Record<string, string> = {
  EXPIRED: "Expired",
  URGENT: "Urgent (< 90 days)",
  WARNING: "Warning (90–180 days)",
  APPROACHING: "Approaching (180–365 days)",
  PLANNED: "Planned (1–3 years)",
  HEALTHY: "Healthy (3+ years)",
};

export function EolTimelineView() {
  const { eolList } = useRiskContext();
  const [acknowledgeId, setAcknowledgeId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const deleteMutation = trpc.eol.delete.useMutation({
    onSuccess: () => {
      toast.success("EOL entry removed");
      utils.eol.list.invalidate();
      setPendingDeleteId(null);
    },
    onError: () => toast.error("Failed to delete entry"),
  });

  const syncMutation = trpc.eol.syncFromPortfolio.useMutation({
    onSuccess: (res) => {
      toast.success(`Synced ${res.upserted} EOL entry(ies) from portfolio`);
      utils.eol.list.invalidate();
    },
    onError: () => toast.error("Sync failed"),
  });

  const grouped: Record<string, typeof eolList> = {};
  for (const band of BAND_ORDER) grouped[band] = [];
  for (const entry of eolList) {
    (grouped[entry.urgencyBand] ??= []).push(entry);
  }

  const now = new Date();

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <h2 className="text-base font-semibold">EOL Watch List ({eolList.length})</h2>
        <Button
          variant="outline" size="sm"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="gap-1.5"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", syncMutation.isPending && "animate-spin")} />
          Sync from portfolio
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {BAND_ORDER.map((band) => {
            const entries = grouped[band];
            if (!entries || entries.length === 0) return null;
            const colors = BAND_COLORS[band];

            return (
              <div key={band}>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className={cn("h-4 w-4", colors.text)} />
                  <h3 className={cn("text-sm font-semibold", colors.text)}>
                    {BAND_LABELS[band]} · {entries.length}
                  </h3>
                </div>
                <div className="space-y-2">
                  {entries.map((entry) => {
                    const daysUntil = entry.eolDate
                      ? differenceInDays(entry.eolDate, now)
                      : null;
                    return (
                      <div
                        key={entry.id}
                        data-slot="card"
                        className={cn(
                          "flex items-center gap-4 p-4 rounded-lg border",
                          colors.bg,
                          entry.isAcknowledged && "opacity-60"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{entry.entityName}</p>
                            <Badge variant="outline" className={cn("text-[10px] h-4 px-1", colors.badge)}>
                              {entry.urgencyBand}
                            </Badge>
                            {entry.isAcknowledged && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1 bg-green-50 text-green-700">
                                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                                ACK
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>
                              EOL:{" "}
                              {entry.eolDate ? format(entry.eolDate, "MMM d, yyyy") : "Unknown"}
                            </span>
                            {daysUntil !== null && (
                              <span>
                                {daysUntil < 0
                                  ? `${Math.abs(daysUntil)}d overdue`
                                  : `${daysUntil}d remaining`}
                              </span>
                            )}
                            {entry.vendor && <span>Vendor: {entry.vendor}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {!entry.isAcknowledged && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAcknowledgeId(entry.id)}
                            >
                              Acknowledge
                            </Button>
                          )}
                          {pendingDeleteId === entry.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => deleteMutation.mutate({ id: entry.id })}
                                disabled={deleteMutation.isPending}
                                className="text-xs text-white bg-rose-500 hover:bg-rose-600 px-2 py-1 rounded font-medium disabled:opacity-50"
                              >
                                {deleteMutation.isPending ? "…" : "Delete"}
                              </button>
                              <button
                                onClick={() => setPendingDeleteId(null)}
                                className="p-1 text-muted-foreground hover:text-foreground"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setPendingDeleteId(entry.id)}
                              className="p-1.5 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-50"
                              title="Remove entry"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {eolList.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No EOL entries tracked.</p>
              <p className="text-xs mt-1">Sync from portfolio to import application lifecycle dates.</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {acknowledgeId && (
        <EolAcknowledgeModal
          entryId={acknowledgeId}
          onClose={() => setAcknowledgeId(null)}
        />
      )}
    </div>
  );
}
