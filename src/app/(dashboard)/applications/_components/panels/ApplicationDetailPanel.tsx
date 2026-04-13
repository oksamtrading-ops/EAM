"use client";

import { useState } from "react";
import { X, Trash2, Sparkles } from "lucide-react";
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
  onAutoMap?: (applicationId: string) => void;
};

export function ApplicationDetailPanel({ applicationId, onClose, onAutoMap }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
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
        <div className="flex items-center gap-1">
          {onAutoMap && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAutoMap(applicationId)}
              title="AI suggests capabilities this app supports"
              className="h-7 text-[10px] text-[#7c3aed] border-[#7c3aed]/30 hover:bg-[#7c3aed]/5 px-2"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Auto-Map
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
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

          {/* Cost Details */}
          <section>
            <h3 className="text-sm font-medium mb-3">Cost Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Cost Model</label>
                <Select
                  value={app.costModel ?? ""}
                  onValueChange={(v) => updateMutation.mutate({ id: app.id, costModel: (v || null) as any })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LICENSE_PER_USER">License (Per User)</SelectItem>
                    <SelectItem value="LICENSE_FLAT">License (Flat)</SelectItem>
                    <SelectItem value="SUBSCRIPTION">Subscription</SelectItem>
                    <SelectItem value="USAGE_BASED">Usage Based</SelectItem>
                    <SelectItem value="OPEN_SOURCE">Open Source</SelectItem>
                    <SelectItem value="INTERNAL">Internal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Currency</label>
                <Select
                  value={app.costCurrency ?? "USD"}
                  onValueChange={(v) => v && updateMutation.mutate({ id: app.id, costCurrency: v })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="CAD">CAD</SelectItem>
                    <SelectItem value="AUD">AUD</SelectItem>
                    <SelectItem value="ZAR">ZAR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Licensed Users</label>
                <Input
                  type="number"
                  defaultValue={app.licensedUsers ?? ""}
                  placeholder="0"
                  className="h-8 text-xs"
                  onBlur={(e) => {
                    const val = parseInt(e.target.value);
                    updateMutation.mutate({ id: app.id, licensedUsers: isNaN(val) ? null : val });
                  }}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Renewal Date</label>
                <Input
                  type="date"
                  defaultValue={app.costRenewalDate ? new Date(app.costRenewalDate).toISOString().split("T")[0] : ""}
                  className="h-8 text-xs"
                  onBlur={(e) => {
                    updateMutation.mutate({ id: app.id, costRenewalDate: e.target.value || null });
                  }}
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs text-muted-foreground mb-1 block">Cost Notes</label>
              <Textarea
                defaultValue={app.costNotes ?? ""}
                placeholder="Contract details, license terms..."
                rows={2}
                onBlur={(e) => {
                  if (e.target.value !== (app.costNotes ?? "")) {
                    updateMutation.mutate({ id: app.id, costNotes: e.target.value || null });
                  }
                }}
              />
            </div>
          </section>

          <Separator />

          {/* Assessment */}
          <section>
            <h3 className="text-sm font-medium mb-3">Assessment</h3>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Biz Value</label>
                <Select
                  value={app.businessValue}
                  onValueChange={(v) => assessMutation.mutate({
                    applicationId: app.id,
                    businessValue: v as any,
                    technicalHealth: app.technicalHealth as any,
                    rationalizationStatus: app.rationalizationStatus as any,
                  })}
                >
                  <SelectTrigger className="h-8 text-xs w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(BV_LABELS).map(([k, l]) => (
                      <SelectItem key={k} value={k}>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: BV_COLORS[k] }} />
                          {l}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Tech Health</label>
                <Select
                  value={app.technicalHealth}
                  onValueChange={(v) => assessMutation.mutate({
                    applicationId: app.id,
                    businessValue: app.businessValue as any,
                    technicalHealth: v as any,
                    rationalizationStatus: app.rationalizationStatus as any,
                  })}
                >
                  <SelectTrigger className="h-8 text-xs w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TH_LABELS).map(([k, l]) => (
                      <SelectItem key={k} value={k}>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: TH_COLORS[k] }} />
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
                  <SelectTrigger className="h-8 text-xs w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(RAT_LABELS).map(([k, l]) => (
                      <SelectItem key={k} value={k}>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: RAT_COLORS[k] }} />
                          {l}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
        {confirmDelete ? (
          <div className="space-y-2">
            <p className="text-xs text-rose-600 text-center font-medium">Delete &ldquo;{app.name}&rdquo;? This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 px-3 py-2 text-sm border rounded-md text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate({ id: app.id })}
                disabled={deleteMutation.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-rose-500 hover:bg-rose-600 text-white rounded-md font-medium transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleteMutation.isPending ? "Deleting…" : "Confirm Delete"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-md transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Application
          </button>
        )}
      </div>
    </aside>
  );
}
