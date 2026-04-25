"use client";

import { useMemo, useState } from "react";
import { X, Trash2, Sparkles, ArrowRight, ArrowLeft, ArrowLeftRight, Plus, Unlink, Crown, Database, Wand2, Check, Search as SearchIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWorkspace } from "@/hooks/useWorkspace";
import Link from "next/link";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { CollapsibleGroup } from "@/components/shared/CollapsibleGroup";
import { ClassificationBadge } from "@/components/shared/ClassificationBadge";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { OwnerField } from "@/components/shared/OwnerField";
import { DatePicker } from "@/components/shared/DatePicker";
import { AnalyzeWithAgentButton } from "@/components/shared/AnalyzeWithAgentButton";
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
  const [showCapPicker, setShowCapPicker] = useState(false);
  const [capQuery, setCapQuery] = useState("");
  const utils = trpc.useUtils();
  const { data: app, isLoading } = trpc.application.getById.useQuery({ id: applicationId });
  const { data: allApps } = trpc.application.listForMapping.useQuery();
  const { data: radarData } = trpc.techRadar.getRadar.useQuery();
  const { data: workspaceUsers } = trpc.workspace.listUsers.useQuery();
  const { data: dataUsages = [] } = trpc.appEntityUsage.list.useQuery({ appId: applicationId });
  const { data: capTree } = trpc.capability.getTree.useQuery();
  const radarEntries = radarData?.entries ?? [];

  // Flatten the capability tree once so the picker can search across
  // all levels. Tree node shape: { id, name, level, children: [...] }.
  type FlatCap = { id: string; name: string; level: string; path: string };
  const flatCapabilities = useMemo<FlatCap[]>(() => {
    const out: FlatCap[] = [];
    function walk(nodes: unknown[], parents: string[]) {
      for (const n of nodes as Array<Record<string, unknown>>) {
        const id = n.id as string;
        const name = n.name as string;
        const level = n.level as string;
        out.push({
          id,
          name,
          level,
          path: parents.length > 0 ? parents.join(" › ") : "",
        });
        const kids = n.children as unknown[] | undefined;
        if (Array.isArray(kids) && kids.length > 0) {
          walk(kids, [...parents, name]);
        }
      }
    }
    if (Array.isArray(capTree)) walk(capTree as unknown[], []);
    return out;
  }, [capTree]);

  // Filter the flat list against search + already-linked exclusion.
  const linkedCapIds = useMemo(
    () => new Set((app?.capabilities ?? []).map((m: { capabilityId: string }) => m.capabilityId)),
    [app]
  );
  const capPickerResults = useMemo(() => {
    const q = capQuery.trim().toLowerCase();
    return flatCapabilities
      .filter((c) => !linkedCapIds.has(c.id))
      .filter(
        (c) =>
          q === "" ||
          c.name.toLowerCase().includes(q) ||
          c.path.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [flatCapabilities, linkedCapIds, capQuery]);

  const linkCapMutation = trpc.application.linkCapability.useMutation({
    onSuccess: () => {
      utils.application.getById.invalidate({ id: applicationId });
      utils.application.list.invalidate();
      utils.dashboard.getCostByDomain.invalidate();
      setCapQuery("");
      setShowCapPicker(false);
      toast.success("Capability linked");
    },
    onError: (err) => toast.error(err.message),
  });
  const unlinkCapMutation = trpc.application.unlinkCapability.useMutation({
    onSuccess: () => {
      utils.application.getById.invalidate({ id: applicationId });
      utils.application.list.invalidate();
      utils.dashboard.getCostByDomain.invalidate();
      toast.success("Capability unlinked");
    },
    onError: (err) => toast.error(err.message),
  });

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
      <aside className="w-full sm:w-96 border-l bg-card p-4">
        <div className="animate-pulse">Loading...</div>
      </aside>
    );
  }

  return (
    <aside className="fixed right-0 top-0 h-screen w-full sm:w-[480px] z-50 border-l bg-card flex flex-col overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-4 border-b flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-[15px] text-foreground truncate">{app.name}</h2>
          {app.alias && <p className="text-xs text-muted-foreground">{app.alias}</p>}
          {app.vendor && <p className="text-xs text-muted-foreground">{app.vendor}</p>}
        </div>
        <div className="flex items-center gap-1">
          <AnalyzeWithAgentButton
            size="sm"
            label="Analyze"
            className="h-7 text-[10px] px-2"
            prompt={`Analyze the application "${app.name}". Use rationalize_application and analyze_application_impact as needed. Summarize: recommended TIME classification with rationale, key risks, and what breaks if we retire it.`}
          />
          {onAutoMap && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAutoMap(applicationId)}
              title="AI suggests capabilities this app supports"
              className="h-7 text-[10px] text-[var(--ai)] border-[var(--ai)]/30 hover:bg-[var(--ai)]/5 px-2"
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
          <CollapsibleGroup defaultOpenId="assessment">
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
          <CollapsibleSection id="cost" title="Cost & Users">
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
                <DatePicker
                  value={app.costRenewalDate ? new Date(app.costRenewalDate).toISOString().split("T")[0] : ""}
                  onChange={(v) => updateMutation.mutate({ id: app.id, costRenewalDate: v || null })}
                  placeholder="Select renewal date"
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
          <CollapsibleSection id="assessment" title="Assessment" defaultOpen>
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
          <CollapsibleSection id="capabilities" title="Linked Capabilities" count={app.capabilities?.length ?? 0}>
            <div className="space-y-1">
              {/* Existing mappings — hover to reveal an unlink button. */}
              {app.capabilities && app.capabilities.length > 0 ? (
                app.capabilities.map((m: any) => (
                  <div
                    key={m.capabilityId}
                    className="text-xs p-2 bg-muted/20 rounded flex items-center gap-2 group"
                  >
                    <Badge variant="outline" className="text-[9px] shrink-0">
                      {m.capability?.level}
                    </Badge>
                    <span className="text-foreground flex-1 truncate">
                      {m.capability?.name}
                    </span>
                    {m.source === "MANUAL" ? null : (
                      <Badge
                        variant="outline"
                        className="text-[9px] shrink-0 opacity-60"
                        title={`Source: ${m.source}`}
                      >
                        {m.source === "AI_ACCEPTED" || m.source === "AI_SUGGESTED"
                          ? "AI"
                          : m.source}
                      </Badge>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        unlinkCapMutation.mutate({
                          applicationId,
                          capabilityId: m.capabilityId,
                        })
                      }
                      disabled={unlinkCapMutation.isPending}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-500 transition-opacity shrink-0"
                      aria-label={`Unlink ${m.capability?.name}`}
                      title="Remove this capability"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground py-1">
                  No capabilities linked yet.
                </p>
              )}

              {/* Add-capability picker — searchable popover. */}
              <Popover open={showCapPicker} onOpenChange={setShowCapPicker}>
                <PopoverTrigger
                  render={(triggerProps) => (
                    <button
                      {...triggerProps}
                      type="button"
                      className="mt-1.5 w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium px-2.5 h-7 rounded-md border border-dashed border-border hover:border-[var(--ai)]/40 hover:bg-[var(--ai)]/5 hover:text-[var(--ai)] text-muted-foreground transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      Add capability
                    </button>
                  )}
                />
                <PopoverContent
                  align="start"
                  sideOffset={6}
                  className="w-[300px] p-0 overflow-hidden"
                >
                  <div className="flex items-center gap-2 px-2.5 py-2 border-b">
                    <SearchIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <Input
                      autoFocus
                      value={capQuery}
                      onChange={(e) => setCapQuery(e.target.value)}
                      placeholder="Search capabilities…"
                      className="h-7 border-0 px-0 focus-visible:ring-0 text-xs"
                    />
                  </div>
                  <div className="max-h-[280px] overflow-y-auto py-1">
                    {capPickerResults.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-3 py-3 text-center">
                        {flatCapabilities.length === 0
                          ? "No capabilities defined yet."
                          : capQuery
                            ? "No matches."
                            : "Every capability is already linked."}
                      </p>
                    ) : (
                      capPickerResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            linkCapMutation.mutate({
                              applicationId,
                              capabilityId: c.id,
                            })
                          }
                          disabled={linkCapMutation.isPending}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-muted/60 text-left transition-colors"
                        >
                          <Badge
                            variant="outline"
                            className="text-[9px] shrink-0"
                          >
                            {c.level}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <div className="truncate text-foreground">
                              {c.name}
                            </div>
                            {c.path && (
                              <div className="truncate text-[10px] text-muted-foreground">
                                {c.path}
                              </div>
                            )}
                          </div>
                          <Plus className="h-3 w-3 text-muted-foreground shrink-0" />
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </CollapsibleSection>

          <Separator />

          {/* Interfaces */}
          <CollapsibleSection id="interfaces" title="Interfaces" count={(app.interfacesFrom?.length ?? 0) + (app.interfacesTo?.length ?? 0)}>
              <div className="space-y-1.5">
                {app.interfacesFrom?.map((iface: any) => (
                  <div key={iface.id} className="text-xs p-2 bg-muted/20 rounded flex items-center gap-2 group">
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
                  <div key={iface.id} className="text-xs p-2 bg-muted/20 rounded flex items-center gap-2 group">
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

          {/* Data Entities */}
          <CollapsibleSection id="data" title="Data Entities" count={dataUsages.length}>
            {dataUsages.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No data entities yet. Use the{" "}
                <Link href="/data?view=matrix" className="text-primary hover:underline">
                  CRUD Matrix
                </Link>
                {" "}to record which entities this application touches.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {dataUsages.map((u) => {
                  const isGolden = u.entity.goldenSourceAppId === applicationId;
                  return (
                    <li
                      key={u.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card"
                    >
                      <Database className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-foreground truncate">
                            {u.entity.name}
                          </span>
                          {isGolden && (
                            <span
                              className="inline-flex items-center gap-0.5 text-[10px] text-amber-600"
                              title="This application is the golden source for this entity"
                            >
                              <Crown className="h-3 w-3" />
                              Golden
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: u.entity.domain.color }}
                            />
                            {u.entity.domain.name}
                          </span>
                          <ClassificationBadge classification={u.entity.classification} />
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono shrink-0">
                        {(["creates", "reads", "updates", "deletes"] as const).map((op) => (
                          <span
                            key={op}
                            className={
                              u[op]
                                ? "inline-flex h-5 w-5 items-center justify-center rounded border bg-primary/10 text-primary border-primary/30"
                                : "inline-flex h-5 w-5 items-center justify-center rounded border bg-muted/40 text-muted-foreground border-border"
                            }
                            title={op}
                          >
                            {op.charAt(0).toUpperCase()}
                          </span>
                        ))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CollapsibleSection>

          <Separator />

          {/* Tech Stack */}
          <CollapsibleSection id="techStack" title="Tech Stack" count={app.techStackLinks?.length ?? 0}>
              <div className="space-y-1.5">
                {app.techStackLinks?.map((link: any) => (
                  <div key={`${link.applicationId}-${link.techRadarEntryId}`} className="text-xs p-2 bg-muted/20 rounded flex items-center gap-2 group">
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

          {/* Technology Components (Module 7) */}
          <ApplicationTechnologySection applicationId={app.id} />

          <Separator />

          {/* Ownership */}
          <CollapsibleSection id="ownership" title="Ownership">
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
          </CollapsibleGroup>
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

const TECH_LAYERS = ["PRESENTATION", "APPLICATION", "DATA", "INTEGRATION", "INFRASTRUCTURE", "SECURITY"] as const;
const TECH_ROLES = ["PRIMARY", "SECONDARY", "FALLBACK", "DEPRECATED"] as const;
const TECH_CRITICALITIES = ["CRITICAL", "IMPORTANT", "STANDARD", "OPTIONAL"] as const;

type LinkLayer = (typeof TECH_LAYERS)[number];
type LinkRole = (typeof TECH_ROLES)[number];
type LinkCriticality = (typeof TECH_CRITICALITIES)[number];

type DetectSuggestion = {
  componentId: string;
  componentName: string;
  productName: string;
  vendorName: string;
  layer: LinkLayer;
  role: LinkRole;
  criticality: LinkCriticality;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  rationale: string;
};

function ApplicationTechnologySection({ applicationId }: { applicationId: string }) {
  const utils = trpc.useUtils();
  const { workspaceId } = useWorkspace();
  const { data: links = [] } = trpc.technologyComponent.listForApplication.useQuery({ applicationId });
  const { data: components = [] } = trpc.technologyComponent.list.useQuery();
  const { data: score } = trpc.techArchitecture.applicationScore.useQuery({ applicationId });
  const [linkComponentId, setLinkComponentId] = useState("");
  const [linkLayer, setLinkLayer] = useState<LinkLayer>("APPLICATION");
  const [linkRole, setLinkRole] = useState<LinkRole>("PRIMARY");
  const [linkCriticality, setLinkCriticality] = useState<LinkCriticality>("STANDARD");

  const [detectLoading, setDetectLoading] = useState(false);
  const [detectRationale, setDetectRationale] = useState<string>("");
  const [suggestions, setSuggestions] = useState<DetectSuggestion[] | null>(null);
  const [linkedFromAI, setLinkedFromAI] = useState<Set<string>>(new Set());

  async function handleDetectStack() {
    setDetectLoading(true);
    setSuggestions(null);
    setDetectRationale("");
    setLinkedFromAI(new Set());
    try {
      const res = await fetch("/api/ai/tech-architecture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "detect-stack",
          workspaceId,
          payload: { applicationId },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Detection failed");
        return;
      }
      setDetectRationale(json.rationale || "");
      setSuggestions(Array.isArray(json.suggestions) ? json.suggestions : []);
      if ((json.suggestions ?? []).length === 0) {
        toast.info("No confident suggestions found");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Detection failed");
    } finally {
      setDetectLoading(false);
    }
  }

  async function handleLinkSuggestion(s: DetectSuggestion) {
    try {
      await linkMutation.mutateAsync({
        applicationId,
        componentId: s.componentId,
        layer: s.layer,
        role: s.role,
        criticality: s.criticality,
      });
      setLinkedFromAI((prev) => {
        const next = new Set(prev);
        next.add(s.componentId);
        return next;
      });
    } catch {
      // toast handled by mutation
    }
  }

  const linkMutation = trpc.technologyComponent.linkApplication.useMutation({
    onSuccess: () => {
      toast.success("Component linked");
      utils.technologyComponent.listForApplication.invalidate({ applicationId });
      utils.techArchitecture.kpis.invalidate();
      setLinkComponentId("");
    },
    onError: (e) => toast.error(e.message),
  });
  const unlinkMutation = trpc.technologyComponent.unlinkApplication.useMutation({
    onSuccess: () => {
      toast.success("Component unlinked");
      utils.technologyComponent.listForApplication.invalidate({ applicationId });
      utils.techArchitecture.kpis.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const linkedIds = new Set(links.map((l) => l.componentId));
  const grouped = links.reduce<Record<string, typeof links>>((acc, link) => {
    (acc[link.layer] ||= []).push(link);
    return acc;
  }, {});

  const bandColor = score
    ? score.band === "GREEN"
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : score.band === "AMBER"
        ? "bg-amber-100 text-amber-700 border-amber-200"
        : "bg-rose-100 text-rose-700 border-rose-200"
    : "bg-muted text-muted-foreground";

  return (
    <CollapsibleSection id="techComponents" title="Technology Components" count={links.length}>
      <div className="space-y-2">
        {score && (
          <div className="flex items-center gap-2 flex-wrap text-xs pb-1">
            <Badge variant="outline" className={`text-[10px] ${bandColor}`}>
              Standards {score.band} · score {score.score}
            </Badge>
            {score.prohibitedCount > 0 && (
              <Badge variant="outline" className="text-[10px] bg-rose-100 text-rose-700 border-rose-200">
                {score.prohibitedCount} prohibited
              </Badge>
            )}
            {score.deprecatedCount > 0 && (
              <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                {score.deprecatedCount} deprecated
              </Badge>
            )}
            {score.eolRiskCount > 0 && (
              <Badge variant="outline" className="text-[10px] bg-orange-100 text-orange-700 border-orange-200">
                {score.eolRiskCount} EOL risk
              </Badge>
            )}
          </div>
        )}
        {links.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No technology components linked. Use the link control below.
          </p>
        ) : (
          Object.entries(grouped).map(([layer, items]) => (
            <div key={layer}>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{layer}</p>
              <ul className="space-y-1">
                {items.map((link) => (
                  <li
                    key={link.componentId}
                    className="text-xs p-2 bg-muted/20 rounded flex items-center gap-2 group"
                  >
                    <span className="flex-1 truncate">
                      {link.component.name}
                      <span className="text-muted-foreground ml-1">
                        ({link.component.product.name}
                        {link.component.version ? ` ${link.component.version.version}` : ""})
                      </span>
                    </span>
                    <Badge variant="outline" className="text-[9px]">{link.role}</Badge>
                    <Badge variant="outline" className="text-[9px]">{link.criticality}</Badge>
                    <button
                      onClick={() => unlinkMutation.mutate({ applicationId, componentId: link.componentId })}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-500 transition-opacity"
                      aria-label="Unlink"
                    >
                      <Unlink className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}

        <div className="mt-2 rounded-lg border border-[var(--ai)]/20 bg-[var(--ai-subtle)] p-2 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Wand2 className="h-3 w-3 text-[var(--ai)]" />
              <p className="text-[10px] uppercase tracking-wide text-[var(--ai)] font-medium">AI stack detection</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className={
                detectLoading
                  ? "h-6 text-[11px] bg-[var(--ai)] text-white border-[var(--ai)] hover:bg-[var(--ai-hover)]"
                  : "h-6 text-[11px] border-[var(--ai)]/30 text-[var(--ai)] hover:bg-[var(--ai-subtle)] hover:text-[var(--ai)]"
              }
              onClick={handleDetectStack}
              disabled={detectLoading}
            >
              <Wand2 className="h-3 w-3 mr-1" />
              {detectLoading ? "Detecting…" : suggestions ? "Re-run" : "Detect stack"}
            </Button>
          </div>
          {detectRationale && (
            <p className="text-[11px] text-[var(--ai)]/80 leading-snug">{detectRationale}</p>
          )}
          {suggestions && suggestions.length === 0 && !detectLoading && (
            <p className="text-[11px] text-muted-foreground">No confident suggestions.</p>
          )}
          {suggestions && suggestions.length > 0 && (
            <ul className="space-y-1">
              {suggestions.map((s) => {
                const isLinked = linkedFromAI.has(s.componentId);
                return (
                  <li key={s.componentId} className="text-[11px] p-2 bg-card rounded border border-border space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{s.componentName}</p>
                        <p className="text-muted-foreground truncate">
                          {s.productName} · {s.vendorName}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[9px] shrink-0 ${
                          s.confidence === "HIGH"
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                            : s.confidence === "MEDIUM"
                              ? "bg-amber-100 text-amber-700 border-amber-200"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {s.confidence}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      <Badge variant="outline" className="text-[9px]">{s.layer}</Badge>
                      <Badge variant="outline" className="text-[9px]">{s.role}</Badge>
                      <Badge variant="outline" className="text-[9px]">{s.criticality}</Badge>
                    </div>
                    {s.rationale && <p className="text-muted-foreground leading-snug">{s.rationale}</p>}
                    <Button
                      size="sm"
                      variant={isLinked ? "outline" : "default"}
                      className="h-6 w-full text-[10px]"
                      disabled={isLinked || linkMutation.isPending}
                      onClick={() => handleLinkSuggestion(s)}
                    >
                      {isLinked ? (
                        <>
                          <Check className="h-3 w-3 mr-1" /> Linked
                        </>
                      ) : (
                        <>
                          <Plus className="h-3 w-3 mr-1" /> Link
                        </>
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-2 rounded-lg border border-dashed border-border p-2 space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Link a component</p>
          <Select value={linkComponentId || "__none__"} onValueChange={(v) => setLinkComponentId(!v || v === "__none__" ? "" : v)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select a component" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Select a component</SelectItem>
              {components.filter((c) => !linkedIds.has(c.id)).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} — {c.product.name} ({c.environment})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-3 gap-1.5">
            <Select value={linkLayer} onValueChange={(v) => setLinkLayer((v || "APPLICATION") as LinkLayer)}>
              <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
              <SelectContent>{TECH_LAYERS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={linkRole} onValueChange={(v) => setLinkRole((v || "PRIMARY") as LinkRole)}>
              <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
              <SelectContent>{TECH_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={linkCriticality} onValueChange={(v) => setLinkCriticality((v || "STANDARD") as LinkCriticality)}>
              <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
              <SelectContent>{TECH_CRITICALITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            className="w-full h-7 text-xs"
            disabled={!linkComponentId || linkMutation.isPending}
            onClick={() => linkMutation.mutate({
              applicationId,
              componentId: linkComponentId,
              layer: linkLayer,
              role: linkRole,
              criticality: linkCriticality,
            })}
          >
            <Plus className="h-3 w-3 mr-1" /> Link Component
          </Button>
        </div>
      </div>
    </CollapsibleSection>
  );
}
