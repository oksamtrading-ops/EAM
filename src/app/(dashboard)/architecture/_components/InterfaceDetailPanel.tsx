"use client";

import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Check, Ban, Trash2, Sparkles, Wand2, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DiagramApplication, DiagramInterface } from "./ArchitectureCanvas";
import { DataFlowEditor } from "./DataFlowEditor";

type Props = {
  interface: DiagramInterface;
  apps: DiagramApplication[];
  scenario: "AS_IS" | "TO_BE";
  onClose: () => void;
};

const STATUS_STYLE: Record<string, string> = {
  ACCEPTED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  PENDING: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  REJECTED: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
};

export function InterfaceDetailPanel({ interface: iface, apps, scenario, onClose }: Props) {
  const utils = trpc.useUtils();
  const source = apps.find((a) => a.id === iface.sourceAppId);
  const target = apps.find((a) => a.id === iface.targetAppId);

  const accept = trpc.diagram.acceptSuggestion.useMutation({
    onSuccess: () => {
      toast.success("Accepted");
      utils.diagram.getDiagramData.invalidate();
      utils.diagram.listPendingSuggestions.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const reject = trpc.diagram.rejectSuggestion.useMutation({
    onSuccess: () => {
      toast.success("Rejected — AI won't re-propose this");
      utils.diagram.getDiagramData.invalidate();
      utils.diagram.listPendingSuggestions.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = trpc.application.deleteInterface.useMutation({
    onSuccess: () => {
      toast.success("Integration removed");
      utils.diagram.getDiagramData.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const isPending = iface.reviewStatus === "PENDING";
  const isAi = iface.source === "AI_SUGGESTED" || iface.source === "AI_ACCEPTED" || iface.source === "AI_MODIFIED";

  return (
    <aside className="w-[360px] shrink-0 border-l bg-card flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Integration
          </p>
          <h2 className="text-sm font-semibold truncate" title={iface.name}>
            {iface.name}
          </h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Status */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wider rounded px-2 py-0.5",
              STATUS_STYLE[iface.reviewStatus]
            )}
          >
            {iface.reviewStatus}
          </span>
          {isAi && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium rounded px-2 py-0.5 bg-purple-500/10 text-purple-700 dark:text-purple-400">
              <Sparkles className="h-3 w-3" /> AI
            </span>
          )}
          {iface.aiConfidence != null && (
            <Badge variant="outline" className="text-[10px]">
              {iface.aiConfidence}% confidence
            </Badge>
          )}
        </div>

        {/* Endpoints */}
        <dl className="text-sm space-y-2">
          <div>
            <dt className="text-[11px] text-muted-foreground uppercase tracking-wider">
              Source
            </dt>
            <dd className="font-medium">{source?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted-foreground uppercase tracking-wider">
              Target
            </dt>
            <dd className="font-medium">{target?.name ?? "—"}</dd>
          </div>
        </dl>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Protocol" value={iface.protocol.replace(/_/g, " ")} />
          <Field label="Direction" value={iface.direction.replace(/_/g, " ")} />
          <Field label="Criticality" value={iface.criticality.replace("INT_", "")} />
          <Field label="Source" value={iface.source.replace(/_/g, " ")} />
        </div>

        {/* Pending actions */}
        {isPending && (
          <div className="flex gap-2 pt-2 border-t">
            <Button
              size="sm"
              onClick={() => accept.mutate({ id: iface.id })}
              disabled={accept.isPending}
              className="flex-1"
            >
              <Check className="h-4 w-4" />
              Accept
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => reject.mutate({ id: iface.id })}
              disabled={reject.isPending}
              className="flex-1"
            >
              <Ban className="h-4 w-4" />
              Reject
            </Button>
          </div>
        )}

        {/* Data flows */}
        <div className="pt-3 border-t">
          <div className="flex items-center gap-1.5 mb-2">
            <Database className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Data entities
            </p>
          </div>
          <DataFlowEditor interfaceId={iface.id} />
        </div>

        {/* Delete */}
        {!isPending && (
          <div className="pt-3 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => remove.mutate({ id: iface.id })}
              disabled={remove.isPending}
              className="w-full text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
            >
              <Trash2 className="h-4 w-4" />
              Delete integration
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className="text-sm font-medium capitalize">{value.toLowerCase()}</p>
    </div>
  );
}
