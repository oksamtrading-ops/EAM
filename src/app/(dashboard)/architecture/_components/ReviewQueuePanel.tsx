"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { X, Check, Ban, Sparkles, Zap } from "lucide-react";

type Props = {
  scenario: "AS_IS" | "TO_BE";
  onClose: () => void;
};

export function ReviewQueuePanel({ scenario, onClose }: Props) {
  const [minConfidence, setMinConfidence] = useState(80);
  const utils = trpc.useUtils();

  const { data: pending = [], isLoading } = trpc.diagram.listPendingSuggestions.useQuery({
    scenario,
  });

  const accept = trpc.diagram.acceptSuggestion.useMutation({
    onSuccess: () => {
      utils.diagram.listPendingSuggestions.invalidate();
      utils.diagram.getDiagramData.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const reject = trpc.diagram.rejectSuggestion.useMutation({
    onSuccess: () => {
      utils.diagram.listPendingSuggestions.invalidate();
      utils.diagram.getDiagramData.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const bulkAccept = trpc.diagram.bulkAcceptByConfidence.useMutation({
    onSuccess: (res) => {
      toast.success(`Accepted ${res.accepted} suggestion${res.accepted === 1 ? "" : "s"}`);
      utils.diagram.listPendingSuggestions.invalidate();
      utils.diagram.getDiagramData.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex" aria-modal="true">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="w-[440px] max-w-[100vw] bg-card border-l shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
        <header className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <h2 className="text-sm font-semibold">Review queue</h2>
            <Badge variant="secondary">{pending.length}</Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </header>

        {/* Bulk actions */}
        <div className="px-5 py-3 border-b space-y-2">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
            Bulk accept
          </p>
          <div className="flex items-center gap-2">
            <label className="text-xs whitespace-nowrap">Confidence ≥</label>
            <input
              type="number"
              min={0}
              max={100}
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              className="w-16 h-7 rounded border border-input bg-background px-2 text-xs"
            />
            <span className="text-xs">%</span>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={() => bulkAccept.mutate({ scenario, minConfidence })}
              disabled={bulkAccept.isPending || pending.length === 0}
            >
              <Zap className="h-3.5 w-3.5" />
              Bulk accept
            </Button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : pending.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No pending suggestions. Click "AI Discover" to generate some.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {pending.map((s: any) => (
                <li key={s.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {s.sourceApp.name}{" "}
                        <span className="text-muted-foreground">→</span>{" "}
                        {s.targetApp.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {s.name}
                      </p>
                    </div>
                    {s.aiConfidence != null && (
                      <ConfidenceBadge value={s.aiConfidence} />
                    )}
                  </div>

                  {s.aiRationale && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {s.aiRationale}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 h-7 text-xs"
                      onClick={() => accept.mutate({ id: s.id })}
                      disabled={accept.isPending}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Accept
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-xs"
                      onClick={() => reject.mutate({ id: s.id })}
                      disabled={reject.isPending}
                    >
                      <Ban className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const tier =
    value >= 80
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
      : value >= 60
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
        : "bg-rose-500/15 text-rose-700 dark:text-rose-400";
  return (
    <span
      className={cn(
        "shrink-0 text-[10px] font-bold uppercase tracking-wider rounded px-2 py-0.5",
        tier
      )}
    >
      {value}%
    </span>
  );
}
