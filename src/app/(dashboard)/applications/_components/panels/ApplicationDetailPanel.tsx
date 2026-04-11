"use client";

import { X, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  LIFECYCLE_LABELS, BV_LABELS, BV_COLORS, TH_LABELS, TH_COLORS,
  RAT_LABELS, RAT_COLORS, APP_TYPE_LABELS, DEPLOY_LABELS,
} from "@/lib/constants/application-colors";

type Props = {
  applicationId: string;
  onClose: () => void;
};

export function ApplicationDetailPanel({ applicationId, onClose }: Props) {
  const utils = trpc.useUtils();
  const { data: app, isLoading } = trpc.application.getById.useQuery({ id: applicationId });

  const updateMutation = trpc.application.update.useMutation({
    onSuccess: () => {
      utils.application.list.invalidate();
      utils.application.getById.invalidate({ id: applicationId });
      toast.success("Application updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const assessMutation = trpc.application.assess.useMutation({
    onSuccess: () => {
      utils.application.list.invalidate();
      utils.application.getById.invalidate({ id: applicationId });
      toast.success("Assessment saved");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.application.delete.useMutation({
    onSuccess: () => {
      utils.application.list.invalidate();
      onClose();
      toast.success("Application deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading || !app) {
    return (
      <aside className="w-96 border-l bg-white p-4">
        <div className="animate-pulse">Loading...</div>
      </aside>
    );
  }

  return (
    <aside className="fixed right-0 top-0 h-screen w-[400px] z-40 border-l bg-white flex flex-col overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-4 border-b flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-[15px] text-[#1a1f2e] truncate">{app.name}</h2>
          {app.alias && <p className="text-xs text-muted-foreground">{app.alias}</p>}
          {app.vendor && <p className="text-xs text-muted-foreground">{app.vendor}</p>}
        </div>
        <Button size="icon" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Description */}
          <section>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
            <Textarea
              defaultValue={app.description ?? ""}
              placeholder="Describe this application..."
              rows={2}
              onBlur={(e) => {
                if (e.target.value !== (app.description ?? "")) {
                  updateMutation.mutate({ id: app.id, description: e.target.value || null });
                }
              }}
            />
          </section>

          <Separator />

          {/* Classification */}
          <section className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Type</label>
              <Select value={app.applicationType} onValueChange={(v) => updateMutation.mutate({ id: app.id, applicationType: v as any })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(APP_TYPE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Deployment</label>
              <Select value={app.deploymentModel} onValueChange={(v) => updateMutation.mutate({ id: app.id, deploymentModel: v as any })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DEPLOY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Lifecycle</label>
              <Select value={app.lifecycle} onValueChange={(v) => updateMutation.mutate({ id: app.id, lifecycle: v as any })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LIFECYCLE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Annual Cost</label>
              <Input
                type="number"
                defaultValue={app.annualCostUsd ? Number(app.annualCostUsd) : ""}
                placeholder="$0"
                className="h-8 text-xs"
                onBlur={(e) => {
                  const val = parseFloat(e.target.value);
                  updateMutation.mutate({ id: app.id, annualCostUsd: isNaN(val) ? null : val });
                }}
              />
            </div>
          </section>

          <Separator />

          {/* Assessment */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Assessment</h3>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Business Value</label>
              <Select
                value={app.businessValue}
                onValueChange={(v) => assessMutation.mutate({
                  applicationId: app.id,
                  businessValue: v as any,
                  technicalHealth: app.technicalHealth as any,
                  rationalizationStatus: app.rationalizationStatus as any,
                })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(BV_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BV_COLORS[k] }} />
                        {l}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Technical Health</label>
              <Select
                value={app.technicalHealth}
                onValueChange={(v) => assessMutation.mutate({
                  applicationId: app.id,
                  businessValue: app.businessValue as any,
                  technicalHealth: v as any,
                  rationalizationStatus: app.rationalizationStatus as any,
                })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TH_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TH_COLORS[k] }} />
                        {l}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Rationalization</label>
              <Select
                value={app.rationalizationStatus}
                onValueChange={(v) => assessMutation.mutate({
                  applicationId: app.id,
                  businessValue: app.businessValue as any,
                  technicalHealth: app.technicalHealth as any,
                  rationalizationStatus: v as any,
                })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RAT_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: RAT_COLORS[k] }} />
                        {l}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <Separator />

          {/* Capability mappings */}
          <section>
            <h3 className="text-sm font-medium mb-2">
              Linked Capabilities ({app.capabilities?.length ?? 0})
            </h3>
            {app.capabilities && app.capabilities.length > 0 ? (
              <div className="space-y-1">
                {app.capabilities.map((m: any) => (
                  <div key={m.capabilityId} className="text-xs p-2 bg-[#fafbfc] rounded flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px]">{m.capability?.level}</Badge>
                    <span className="text-[#1a1f2e]">{m.capability?.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No capabilities linked. Edit this app to assign capabilities.
              </p>
            )}
          </section>

          {/* Ownership */}
          <section className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Business Owner</label>
              <Input
                defaultValue={app.businessOwnerName ?? ""}
                placeholder="Name"
                className="h-8 text-xs"
                onBlur={(e) => updateMutation.mutate({ id: app.id, businessOwnerName: e.target.value || null })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">IT Owner</label>
              <Input
                defaultValue={app.itOwnerName ?? ""}
                placeholder="Name"
                className="h-8 text-xs"
                onBlur={(e) => updateMutation.mutate({ id: app.id, itOwnerName: e.target.value || null })}
              />
            </div>
          </section>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t">
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => {
            if (confirm(`Delete "${app.name}"?`)) deleteMutation.mutate({ id: app.id });
          }}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Delete Application
        </Button>
      </div>
    </aside>
  );
}
