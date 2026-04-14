"use client";

import { useState } from "react";
import { X, Trash2, Sparkles, ArrowRight, ArrowLeft, ArrowLeftRight, Plus, Unlink } from "lucide-react";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  LIFECYCLE_LABELS, BV_LABELS, BV_COLORS, TH_LABELS, TH_COLORS,
  RAT_LABELS, RAT_COLORS, APP_TYPE_LABELS, DEPLOY_LABELS,
  FF_LABELS, FF_COLORS, DC_LABELS, DC_COLORS,
  IFACE_PROTOCOL_LABELS, IFACE_CRITICALITY_LABELS, IFACE_CRITICALITY_COLORS,
  IFACE_DIRECTION_LABELS,
} from "@/lib/constants/application-colors";

type Props = {
  applicationId: string;
  onClose: () => void;
  onAutoMap?: (applicationId: string) => void;
};

export function ApplicationDetailPanel({ applicationId, onClose, onAutoMap }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showAddInterface, setShowAddInterface] = useState(false);
  const [newIface, setNewIface] = useState({ targetAppId: "", name: "", protocol: "REST_API", direction: "OUTBOUND", criticality: "INT_MEDIUM" });
  const utils = trpc.useUtils();
  const { data: app, isLoading } = trpc.application.getById.useQuery({ id: applicationId });
  const { data: allApps } = trpc.application.listForMapping.useQuery();
  const { data: radarData } = trpc.techRadar.getRadar.useQuery();
  const { data: workspaceUsers } = trpc.workspace.listUsers.useQuery();
  const radarEntries = radarData?.entries ?? [];

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

  const createIfaceMutation = trpc.application.createInterface.useMutation({
    onSuccess: () => {
      utils.application.getById.invalidate({ id: applicationId });
      setShowAddInterface(false);
      setNewIface({ targetAppId: "", name: "", protocol: "REST_API", direction: "OUTBOUND", criticality: "INT_MEDIUM" });
      toast.success("Interface created");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteIfaceMutation = trpc.application.deleteInterface.useMutation({
    onSuccess: () => {
      utils.application.getById.invalidate({ id: applicationId });
      toast.success("Interface removed");
    },
    onError: (err) => toast.error(err.message),
  });

  const linkTechMutation = trpc.application.linkTech.useMutation({
    onSuccess: () => {
      utils.application.getById.invalidate({ id: applicationId });
      toast.success("Technology linked");
    },
    onError: (err) => toast.error(err.message),
  });

  const unlinkTechMutation = trpc.application.unlinkTech.useMutation({
    onSuccess: () => {
      utils.application.getById.invalidate({ id: applicationId });
      toast.success("Technology unlinked");
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
    <aside className="fixed right-0 top-0 h-screen w-[480px] z-40 border-l bg-white flex flex-col overflow-hidden shadow-xl">
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

      <ScrollArea className="flex-1 min-h-0">
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

          {/* Cost & Users */}
          <CollapsibleSection title="Cost & Users">
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
                <label className="text-xs text-muted-foreground mb-1 block">Actual Users</label>
                <Input
                  type="number"
                  defaultValue={app.actualUsers ?? ""}
                  placeholder="0"
                  className="h-8 text-xs"
                  onBlur={(e) => {
                    const val = parseInt(e.target.value);
                    updateMutation.mutate({ id: app.id, actualUsers: isNaN(val) ? null : val });
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
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Data Classification</label>
                <Select
                  value={app.dataClassification}
                  onValueChange={(v) => updateMutation.mutate({ id: app.id, dataClassification: v as any })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DC_LABELS).map(([k, l]) => (
                      <SelectItem key={k} value={k}>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: DC_COLORS[k] }} />
                          {l}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Replacement App */}
            <div className="mt-3">
              <label className="text-xs text-muted-foreground mb-1 block">Replacement App</label>
              <Select
                value={app.replacementAppId ?? ""}
                onValueChange={(v) => updateMutation.mutate({ id: app.id, replacementAppId: v || null })}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {allApps?.filter((a) => a.id !== app.id).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}{a.vendor ? ` (${a.vendor})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {app.replacementApp && (
                <p className="text-[10px] text-muted-foreground mt-1">Current: {app.replacementApp.name}</p>
              )}
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
          </CollapsibleSection>

          <Separator />

          {/* Assessment */}
          <CollapsibleSection title="Assessment" defaultOpen>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Biz Value</label>
                <Select
                  value={app.businessValue}
                  onValueChange={(v) => assessMutation.mutate({
                    applicationId: app.id,
                    businessValue: v as any,
                    technicalHealth: app.technicalHealth as any,
                    rationalizationStatus: app.rationalizationStatus as any,
                    functionalFit: app.functionalFit as any,
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
                    functionalFit: app.functionalFit as any,
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
                <label className="text-xs text-muted-foreground mb-1 block">Functional Fit</label>
                <Select
                  value={app.functionalFit}
                  onValueChange={(v) => assessMutation.mutate({
                    applicationId: app.id,
                    businessValue: app.businessValue as any,
                    technicalHealth: app.technicalHealth as any,
                    rationalizationStatus: app.rationalizationStatus as any,
                    functionalFit: v as any,
                  })}
                >
                  <SelectTrigger className="h-8 text-xs w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FF_LABELS).map(([k, l]) => (
                      <SelectItem key={k} value={k}>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: FF_COLORS[k] }} />
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
                    functionalFit: app.functionalFit as any,
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
          </CollapsibleSection>

          <Separator />

          {/* Capability mappings */}
          <CollapsibleSection title="Linked Capabilities" count={app.capabilities?.length ?? 0}>
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
          </CollapsibleSection>

          <Separator />

          {/* Interfaces */}
          <CollapsibleSection title="Interfaces" count={(app.interfacesFrom?.length ?? 0) + (app.interfacesTo?.length ?? 0)}>
              <div className="space-y-1.5">
                {app.interfacesFrom?.map((iface: any) => (
                  <div key={iface.id} className="text-xs p-2 bg-[#fafbfc] rounded flex items-center gap-2 group">
                    <ArrowRight className="h-3 w-3 text-blue-500 shrink-0" />
                    <span className="flex-1 truncate">{iface.targetApp?.name}</span>
                    <Badge variant="outline" className="text-[9px]" style={{ borderColor: IFACE_CRITICALITY_COLORS[iface.criticality] }}>
                      {IFACE_PROTOCOL_LABELS[iface.protocol] ?? iface.protocol}
                    </Badge>
                    <button
                      onClick={() => deleteIfaceMutation.mutate({ id: iface.id })}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-500 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {app.interfacesTo?.map((iface: any) => (
                  <div key={iface.id} className="text-xs p-2 bg-[#fafbfc] rounded flex items-center gap-2 group">
                    <ArrowLeft className="h-3 w-3 text-green-500 shrink-0" />
                    <span className="flex-1 truncate">{iface.sourceApp?.name}</span>
                    <Badge variant="outline" className="text-[9px]" style={{ borderColor: IFACE_CRITICALITY_COLORS[iface.criticality] }}>
                      {IFACE_PROTOCOL_LABELS[iface.protocol] ?? iface.protocol}
                    </Badge>
                    <button
                      onClick={() => deleteIfaceMutation.mutate({ id: iface.id })}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-500 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {(app.interfacesFrom?.length ?? 0) + (app.interfacesTo?.length ?? 0) === 0 && (
                  <p className="text-xs text-muted-foreground">No interfaces documented.</p>
                )}

                {showAddInterface ? (
                  <div className="border rounded-md p-2 space-y-2 mt-2">
                    <Select value={newIface.targetAppId} onValueChange={(v) => v && setNewIface({ ...newIface, targetAppId: v })}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Target app..." /></SelectTrigger>
                      <SelectContent>
                        {allApps?.filter((a) => a.id !== app.id).map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={newIface.name}
                      onChange={(e) => setNewIface({ ...newIface, name: e.target.value })}
                      placeholder="Interface name..."
                      className="h-7 text-xs"
                    />
                    <div className="grid grid-cols-3 gap-1">
                      <Select value={newIface.protocol} onValueChange={(v) => v && setNewIface({ ...newIface, protocol: v })}>
                        <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(IFACE_PROTOCOL_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={newIface.direction} onValueChange={(v) => v && setNewIface({ ...newIface, direction: v })}>
                        <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(IFACE_DIRECTION_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={newIface.criticality} onValueChange={(v) => v && setNewIface({ ...newIface, criticality: v })}>
                        <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(IFACE_CRITICALITY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        className="h-7 text-xs flex-1"
                        disabled={!newIface.targetAppId || !newIface.name}
                        onClick={() => createIfaceMutation.mutate({
                          sourceAppId: app.id,
                          targetAppId: newIface.targetAppId,
                          name: newIface.name,
                          protocol: newIface.protocol as any,
                          direction: newIface.direction as any,
                          criticality: newIface.criticality as any,
                        })}
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowAddInterface(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs w-full mt-1"
                    onClick={() => setShowAddInterface(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Interface
                  </Button>
                )}
              </div>
          </CollapsibleSection>

          <Separator />

          {/* Tech Stack */}
          <CollapsibleSection title="Tech Stack" count={app.techStackLinks?.length ?? 0}>
              <div className="space-y-1.5">
                {app.techStackLinks?.map((link: any) => (
                  <div key={`${link.applicationId}-${link.techRadarEntryId}`} className="text-xs p-2 bg-[#fafbfc] rounded flex items-center gap-2 group">
                    <span className="flex-1 truncate">{link.techRadarEntry?.name}</span>
                    <Badge variant="outline" className="text-[9px]">{link.layer}</Badge>
                    <Badge variant="outline" className="text-[9px]">{link.techRadarEntry?.ring}</Badge>
                    <button
                      onClick={() => unlinkTechMutation.mutate({ applicationId: app.id, techRadarEntryId: link.techRadarEntryId })}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-500 transition-opacity"
                    >
                      <Unlink className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {(app.techStackLinks?.length ?? 0) === 0 && (
                  <p className="text-xs text-muted-foreground">No technologies linked.</p>
                )}
                {radarEntries && radarEntries.length > 0 && (
                  <div className="mt-2">
                    <Select
                      value=""
                      onValueChange={(v) => {
                        if (v) linkTechMutation.mutate({ applicationId: app.id, techRadarEntryId: v });
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Link technology..." /></SelectTrigger>
                      <SelectContent>
                        {radarEntries
                          .filter((r: any) => !app.techStackLinks?.some((l: any) => l.techRadarEntryId === r.id))
                          .map((r: any) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name} ({r.ring})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
          </CollapsibleSection>

          <Separator />

          {/* Ownership */}
          <CollapsibleSection title="Ownership">
            <div className="grid grid-cols-2 gap-3">
              <OwnerField
                label="Business Owner"
                owner={(app as any).businessOwner}
                onChange={(id) => updateMutation.mutate({ id: app.id, businessOwnerId: id })}
                users={workspaceUsers}
              />
              <OwnerField
                label="IT Owner"
                owner={(app as any).itOwner}
                onChange={(id) => updateMutation.mutate({ id: app.id, itOwnerId: id })}
                users={workspaceUsers}
              />
            </div>
          </CollapsibleSection>
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

function OwnerField({
  label,
  owner,
  onChange,
  users,
}: {
  label: string;
  owner: { id: string; name: string | null; avatarUrl: string | null } | null;
  onChange: (id: string | null) => void;
  users?: { id: string; name: string | null; email: string; avatarUrl: string | null }[];
}) {
  const [search, setSearch] = useState("");

  const filtered = (users ?? []).filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.name?.toLowerCase().includes(q)) || u.email.toLowerCase().includes(q);
  });

  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      {owner ? (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border bg-white group">
          {owner.avatarUrl ? (
            <img src={owner.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
          ) : (
            <div className="h-5 w-5 rounded-full bg-[#0B5CD6]/10 flex items-center justify-center">
              <span className="text-[9px] font-bold text-[#0B5CD6]">
                {(owner.name ?? "?")[0]?.toUpperCase()}
              </span>
            </div>
          )}
          <span className="text-xs font-medium truncate flex-1">{owner.name ?? "Unknown"}</span>
          <button
            onClick={() => onChange(null)}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 transition"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <Popover>
          <PopoverTrigger className="w-full h-8 px-2 rounded-md border border-dashed text-xs text-muted-foreground hover:border-[#0B5CD6]/50 hover:text-[#0B5CD6] transition text-left">
            + Assign {label.toLowerCase()}
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <div className="p-2 border-b">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
                className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0B5CD6]"
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-auto p-1">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground px-2 py-3 text-center">No users found</p>
              ) : (
                filtered.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => { onChange(u.id); setSearch(""); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-muted transition"
                  >
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-[#0B5CD6]/10 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-[#0B5CD6]">
                          {(u.name ?? u.email)[0]?.toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{u.name ?? "Unnamed"}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
