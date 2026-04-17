"use client";

import { useState } from "react";
import {
  X, Trash2, ChevronRight, Copy, Target, Link2, Unlink,
  Users, Building2, Workflow, Plus, ArrowRight, DollarSign,
} from "lucide-react";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { CollapsibleGroup } from "@/components/shared/CollapsibleGroup";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  MATURITY_LABELS,
  MATURITY_COLORS,
  IMPORTANCE_LABELS,
  MATURITY_NUMERIC,
} from "@/lib/constants/maturity-colors";
import { toast } from "sonner";
import { CapabilityAIInsights } from "./CapabilityAIInsights";
import { ObjectiveFormModal } from "@/components/shared/ObjectiveFormModal";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Props = {
  capabilityId: string;
  onClose: () => void;
  onSelect?: (id: string) => void;
  autoOpenAI?: boolean;
};

const MATURITY_OPTIONS = [
  "NOT_ASSESSED", "INITIAL", "DEVELOPING", "DEFINED", "MANAGED", "OPTIMIZING",
] as const;

const IMPORTANCE_OPTIONS = [
  "NOT_ASSESSED", "LOW", "MEDIUM", "HIGH", "CRITICAL",
] as const;

const ALIGNMENT_OPTIONS = [
  { value: "STRONG", label: "Strong", color: "#16a34a" },
  { value: "MODERATE", label: "Moderate", color: "#ca8a04" },
  { value: "WEAK", label: "Weak", color: "#94a3b8" },
] as const;

export function CapabilityDetailPanel({ capabilityId, onClose, onSelect, autoOpenAI }: Props) {
  const utils = trpc.useUtils();
  const { data: cap, isLoading } = trpc.capability.getById.useQuery({ id: capabilityId });
  const { data: valueStreams } = trpc.capability.listValueStreams.useQuery();
  const { data: objectives } = trpc.objective.list.useQuery();
  const { data: tree } = trpc.capability.getTree.useQuery();
  const { data: costRollup } = trpc.capability.getCostRollup.useQuery();

  const { data: organizations } = trpc.organization.list.useQuery();
  const { data: workspaceUsers } = trpc.workspace.listUsers.useQuery();

  const [showObjectivePicker, setShowObjectivePicker] = useState(false);
  const [showDependencyPicker, setShowDependencyPicker] = useState(false);
  const [showCreateObjective, setShowCreateObjective] = useState(false);
  const [showCreateVS, setShowCreateVS] = useState(false);
  const [newVSName, setNewVSName] = useState("");

  const updateMutation = trpc.capability.update.useMutation({
    onSuccess: () => {
      utils.capability.getTree.invalidate();
      utils.capability.getById.invalidate({ id: capabilityId });
      toast.success("Capability updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.capability.delete.useMutation({
    onSuccess: () => {
      utils.capability.getTree.invalidate();
      onClose();
      toast.success("Capability deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const assessMutation = trpc.capability.assess.useMutation({
    onSuccess: () => {
      utils.capability.getTree.invalidate();
      utils.capability.getById.invalidate({ id: capabilityId });
      toast.success("Assessment saved");
    },
    onError: (err) => toast.error(err.message),
  });

  const cloneMutation = trpc.capability.clone.useMutation({
    onSuccess: (data) => {
      utils.capability.getTree.invalidate();
      toast.success("Capability cloned");
      onSelect?.(data.id);
    },
    onError: (err) => toast.error(err.message),
  });

  const createVSMutation = trpc.capability.createValueStream.useMutation({
    onSuccess: (vs) => {
      utils.capability.listValueStreams.invalidate();
      updateMutation.mutate({ id: capabilityId, valueStreamId: vs.id });
      setShowCreateVS(false);
      setNewVSName("");
      toast.success("Value stream created & assigned");
    },
    onError: (err) => toast.error(err.message),
  });

  const linkObjectiveMutation = trpc.capability.linkObjective.useMutation({
    onSuccess: () => {
      utils.capability.getById.invalidate({ id: capabilityId });
      setShowObjectivePicker(false);
      toast.success("Objective linked");
    },
    onError: (err) => toast.error(err.message),
  });

  const unlinkObjectiveMutation = trpc.capability.unlinkObjective.useMutation({
    onSuccess: () => {
      utils.capability.getById.invalidate({ id: capabilityId });
      toast.success("Objective unlinked");
    },
  });

  const addDependencyMutation = trpc.capability.addDependency.useMutation({
    onSuccess: () => {
      utils.capability.getById.invalidate({ id: capabilityId });
      setShowDependencyPicker(false);
      toast.success("Dependency added");
    },
    onError: (err) => toast.error(err.message),
  });

  const removeDependencyMutation = trpc.capability.removeDependency.useMutation({
    onSuccess: () => {
      utils.capability.getById.invalidate({ id: capabilityId });
      toast.success("Dependency removed");
    },
  });

  if (isLoading || !cap) {
    return (
      <aside className="fixed right-0 top-0 h-screen w-full sm:w-[480px] z-50 border-l bg-background p-4 shadow-xl">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-20 bg-muted rounded" />
        </div>
      </aside>
    );
  }

  const gap = MATURITY_NUMERIC[cap.targetMaturity] - MATURITY_NUMERIC[cap.currentMaturity];
  const linkedObjectiveIds = new Set((cap as any).objectives?.map((o: any) => o.objectiveId) ?? []);
  const dependsOnIds = new Set((cap as any).dependsOn?.map((d: any) => d.prerequisiteId) ?? []);

  // Flatten tree for dependency picker
  const flatCaps: { id: string; name: string; level: string }[] = [];
  function flattenTree(nodes: any[]) {
    for (const n of nodes) {
      if (n.id !== capabilityId) flatCaps.push({ id: n.id, name: n.name, level: n.level });
      if (n.children) flattenTree(n.children);
    }
  }
  if (tree) flattenTree(tree);

  return (
    <aside className="fixed right-0 top-0 h-screen w-full sm:w-[480px] z-50 border-l bg-background flex flex-col overflow-hidden shadow-xl">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b bg-card">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <Badge variant="outline" className="text-[10px] font-mono">
                {cap.level}
              </Badge>
              {cap.parent && (
                <>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground truncate">
                    {cap.parent.name}
                  </span>
                </>
              )}
            </div>
            <EditableField
              value={cap.name}
              onSave={(name) => updateMutation.mutate({ id: cap.id, name })}
              className="font-semibold text-lg leading-tight"
            />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              title="Clone capability"
              onClick={() => cloneMutation.mutate({ id: cap.id })}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-5 space-y-5">
          <CollapsibleGroup defaultOpenId="assessment">
          {/* Description */}
          <section>
            <SectionLabel>Description</SectionLabel>
            <Textarea
              defaultValue={cap.description ?? ""}
              placeholder="Add a description..."
              rows={3}
              className="text-sm"
              onBlur={(e) => {
                if (e.target.value !== (cap.description ?? "")) {
                  updateMutation.mutate({ id: cap.id, description: e.target.value || null });
                }
              }}
            />
          </section>

          <Separator />

          {/* Value Stream */}
          <CollapsibleSection id="valueStream" title="Value Stream" icon={<Workflow className="h-3.5 w-3.5" />}>
            <Select
              value={cap.valueStreamId ?? "__none__"}
              onValueChange={(v) =>
                updateMutation.mutate({ id: cap.id, valueStreamId: v === "__none__" ? null : v })
              }
            >
              <SelectTrigger className="h-9 text-sm">
                {(cap as any).valueStream
                  ? <span className="flex flex-1 items-center gap-2 text-left truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: (cap as any).valueStream.color }} />
                      {(cap as any).valueStream.name}
                    </span>
                  : <SelectValue placeholder="Assign value stream..." />
                }
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-muted-foreground">None</span>
                </SelectItem>
                {valueStreams?.map((vs) => (
                  <SelectItem key={vs.id} value={vs.id}>
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: vs.color }} />
                      {vs.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(cap as any).valueStream && (
              <div className="mt-2 flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: (cap as any).valueStream.color }}
                />
                <span className="text-xs font-medium">{(cap as any).valueStream.name}</span>
              </div>
            )}
            {showCreateVS ? (
              <div className="mt-2 flex items-center gap-1.5">
                <input
                  value={newVSName}
                  onChange={(e) => setNewVSName(e.target.value)}
                  placeholder="Stream name..."
                  className="flex-1 h-7 text-xs border rounded px-2 focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newVSName.trim()) {
                      createVSMutation.mutate({ name: newVSName.trim() });
                    }
                    if (e.key === "Escape") { setShowCreateVS(false); setNewVSName(""); }
                  }}
                />
                <button
                  onClick={() => newVSName.trim() && createVSMutation.mutate({ name: newVSName.trim() })}
                  disabled={!newVSName.trim() || createVSMutation.isPending}
                  className="h-7 px-2 text-xs bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  onClick={() => { setShowCreateVS(false); setNewVSName(""); }}
                  className="h-7 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCreateVS(true)}
                className="mt-2 text-xs text-primary hover:text-primary/90 flex items-center gap-1"
              >
                <Plus className="h-3 w-3" />
                Create new value stream
              </button>
            )}
          </CollapsibleSection>

          <Separator />

          {/* Investment / Cost Rollup */}
          <CollapsibleSection id="investment" title="Investment" icon={<DollarSign className="h-3.5 w-3.5" />}>
            {(() => {
              const capCost = costRollup?.[capabilityId];
              if (!capCost || capCost.totalCost === 0) {
                return (
                  <p className="text-xs text-muted-foreground">
                    No application costs mapped to this capability.
                  </p>
                );
              }
              return (
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-foreground">
                      ${capCost.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-xs text-muted-foreground">/year (weighted)</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    From {capCost.appCount} application{capCost.appCount !== 1 ? "s" : ""}
                  </p>
                  <div className="space-y-1">
                    {capCost.apps
                      .sort((a, b) => b.cost - a.cost)
                      .slice(0, 5)
                      .map((app) => (
                        <div key={app.id} className="flex items-center gap-2 text-xs">
                          <span className="flex-1 truncate font-medium">{app.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            app.lifecycle === "ACTIVE" ? "bg-green-100 text-green-700" :
                            app.lifecycle === "SUNSET" || app.lifecycle === "RETIRED" ? "bg-red-100 text-red-700" :
                            "bg-gray-100 text-gray-600"
                          }`}>
                            {app.lifecycle}
                          </span>
                          <span className="text-muted-foreground tabular-nums">
                            ${app.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                          {app.weight < 1 && (
                            <span className="text-[10px] text-muted-foreground">
                              ({Math.round(app.weight * 100)}%)
                            </span>
                          )}
                        </div>
                      ))}
                    {capCost.apps.length > 5 && (
                      <p className="text-[10px] text-muted-foreground">
                        +{capCost.apps.length - 5} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}
          </CollapsibleSection>

          <Separator />

          {/* Ownership */}
          <CollapsibleSection id="ownership" title="Ownership" icon={<Users className="h-3.5 w-3.5" />}>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Organization</label>
                <Select
                  value={cap.organizationId ?? "__none__"}
                  onValueChange={(v) =>
                    updateMutation.mutate({ id: cap.id, organizationId: v === "__none__" ? null : v })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    {(cap as any).organization
                      ? <span className="flex flex-1 text-left truncate">{(cap as any).organization.name}</span>
                      : <SelectValue placeholder="Assign org..." />
                    }
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-muted-foreground">None</span>
                    </SelectItem>
                    {organizations?.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <OwnerField
                  label="Business Owner"
                  owner={(cap as any).businessOwner}
                  onChange={(id) => updateMutation.mutate({ id: cap.id, businessOwnerId: id })}
                  users={workspaceUsers}
                />
                <OwnerField
                  label="IT Owner"
                  owner={(cap as any).itOwner}
                  onChange={(id) => updateMutation.mutate({ id: cap.id, itOwnerId: id })}
                  users={workspaceUsers}
                />
              </div>
            </div>
          </CollapsibleSection>

          <Separator />

          {/* Assessment */}
          <CollapsibleSection id="assessment" title="Assessment" defaultOpen>
            <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Current Maturity</label>
                <Select
                  value={cap.currentMaturity}
                  onValueChange={(v) =>
                    assessMutation.mutate({
                      capabilityId: cap.id,
                      currentMaturity: v as any,
                      targetMaturity: cap.targetMaturity as any,
                      strategicImportance: cap.strategicImportance as any,
                    })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATURITY_OPTIONS.map((m) => (
                      <SelectItem key={m} value={m}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: MATURITY_COLORS[m] }} />
                          {MATURITY_LABELS[m]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Target Maturity</label>
                <Select
                  value={cap.targetMaturity}
                  onValueChange={(v) =>
                    assessMutation.mutate({
                      capabilityId: cap.id,
                      currentMaturity: cap.currentMaturity as any,
                      targetMaturity: v as any,
                      strategicImportance: cap.strategicImportance as any,
                    })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATURITY_OPTIONS.map((m) => (
                      <SelectItem key={m} value={m}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: MATURITY_COLORS[m] }} />
                          {MATURITY_LABELS[m]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Gap indicator */}
            {gap !== 0 && cap.currentMaturity !== "NOT_ASSESSED" && (
              <div className="text-xs px-3 py-2 rounded-lg bg-muted/60 flex items-center gap-2">
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                Maturity gap:{" "}
                <span className={gap > 0 ? "text-orange-600 font-semibold" : "text-green-600 font-semibold"}>
                  {gap > 0 ? `${gap} level${gap > 1 ? "s" : ""} to close` : "Target reached"}
                </span>
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Strategic Importance</label>
              <Select
                value={cap.strategicImportance}
                onValueChange={(v) =>
                  assessMutation.mutate({
                    capabilityId: cap.id,
                    currentMaturity: cap.currentMaturity as any,
                    targetMaturity: cap.targetMaturity as any,
                    strategicImportance: v as any,
                  })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPORTANCE_OPTIONS.map((i) => (
                    <SelectItem key={i} value={i}>{IMPORTANCE_LABELS[i]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            </div>
          </CollapsibleSection>

          <Separator />

          {/* Strategic Objectives */}
          <CollapsibleSection
            id="objectives"
            title="Strategic Objectives"
            icon={<Target className="h-3.5 w-3.5" />}
            count={(cap as any).objectives?.length ?? 0}
            actions={
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-[var(--ai)] hover:text-[var(--ai)]/90"
                  onClick={() => setShowCreateObjective(true)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  New
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-primary hover:text-primary/90"
                  onClick={() => setShowObjectivePicker(!showObjectivePicker)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Link
                </Button>
              </>
            }
          >

            {showObjectivePicker && (
              <div className="mb-3 p-3 rounded-lg border bg-muted/30 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground mb-2">Select an objective to link:</p>
                {objectives?.filter((o) => !linkedObjectiveIds.has(o.id)).map((obj) => (
                  <button
                    key={obj.id}
                    onClick={() => linkObjectiveMutation.mutate({ capabilityId, objectiveId: obj.id })}
                    className="w-full text-left px-3 py-2 rounded-md text-xs hover:bg-card transition flex items-center gap-2"
                  >
                    <Target className="h-3 w-3 text-primary shrink-0" />
                    <span className="truncate">{obj.name}</span>
                  </button>
                ))}
                {objectives?.filter((o) => !linkedObjectiveIds.has(o.id)).length === 0 && (
                  <p className="text-xs text-muted-foreground px-3 py-2">
                    All objectives already linked, or none exist yet.
                  </p>
                )}
              </div>
            )}

            {(cap as any).objectives?.length > 0 ? (
              <div className="space-y-1.5">
                {(cap as any).objectives.map((link: any) => (
                  <div
                    key={link.objectiveId}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card group"
                  >
                    <Target className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-xs font-medium flex-1 truncate">
                      {link.objective.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px]"
                      style={{
                        color: ALIGNMENT_OPTIONS.find((a) => a.value === link.alignment)?.color,
                        borderColor: ALIGNMENT_OPTIONS.find((a) => a.value === link.alignment)?.color,
                      }}
                    >
                      {link.alignment}
                    </Badge>
                    <button
                      onClick={() =>
                        unlinkObjectiveMutation.mutate({ capabilityId, objectiveId: link.objectiveId })
                      }
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 transition"
                    >
                      <Unlink className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No strategic objectives linked. Link objectives to track alignment.
              </p>
            )}
          </CollapsibleSection>

          <Separator />

          {/* Dependencies */}
          <CollapsibleSection
            id="dependencies"
            title="Dependencies"
            icon={<Link2 className="h-3.5 w-3.5" />}
            actions={
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-primary hover:text-primary/90"
                onClick={() => setShowDependencyPicker(!showDependencyPicker)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            }
          >

            {showDependencyPicker && (
              <div className="mb-3 p-3 rounded-lg border bg-muted/30 max-h-48 overflow-auto space-y-1">
                <p className="text-xs font-medium text-muted-foreground mb-2">This capability depends on:</p>
                {flatCaps.filter((c) => !dependsOnIds.has(c.id)).map((c) => (
                  <button
                    key={c.id}
                    onClick={() =>
                      addDependencyMutation.mutate({ dependentId: capabilityId, prerequisiteId: c.id })
                    }
                    className="w-full text-left px-3 py-1.5 rounded-md text-xs hover:bg-card transition flex items-center gap-2"
                  >
                    <Badge variant="outline" className="text-[9px] font-mono shrink-0">{c.level}</Badge>
                    <span className="truncate">{c.name}</span>
                  </button>
                ))}
              </div>
            )}

            {(cap as any).dependsOn?.length > 0 && (
              <div className="space-y-1.5 mb-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Depends on</p>
                {(cap as any).dependsOn.map((dep: any) => (
                  <div
                    key={dep.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card group cursor-pointer hover:border-primary/30"
                    onClick={() => onSelect?.(dep.prerequisiteId)}
                  >
                    <Badge variant="outline" className="text-[9px] font-mono shrink-0">
                      {dep.prerequisite.level}
                    </Badge>
                    <span className="text-xs font-medium flex-1 truncate">
                      {dep.prerequisite.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeDependencyMutation.mutate({ id: dep.id });
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 transition"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {(cap as any).dependedOnBy?.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Depended on by</p>
                {(cap as any).dependedOnBy.map((dep: any) => (
                  <div
                    key={dep.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30 cursor-pointer hover:border-primary/30"
                    onClick={() => onSelect?.(dep.dependentId)}
                  >
                    <Badge variant="outline" className="text-[9px] font-mono shrink-0">
                      {dep.dependent.level}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex-1 truncate">
                      {dep.dependent.name}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {!(cap as any).dependsOn?.length && !(cap as any).dependedOnBy?.length && (
              <p className="text-xs text-muted-foreground">
                No dependencies defined.
              </p>
            )}
          </CollapsibleSection>

          <Separator />

          {/* AI Insights */}
          <section>
            <CapabilityAIInsights capabilityId={cap.id} autoOpen={autoOpenAI} />
          </section>

          <Separator />

          {/* Sub-capabilities */}
          {cap.children && cap.children.length > 0 && (
            <CollapsibleSection id="children" title="Sub-capabilities" count={cap.children.length}>
              <div className="space-y-1">
                {cap.children.map((child: any) => (
                  <div
                    key={child.id}
                    className="text-sm px-3 py-2 rounded-lg hover:bg-muted cursor-pointer transition flex items-center gap-2"
                    onClick={() => onSelect?.(child.id)}
                  >
                    <Badge variant="outline" className="text-[10px] font-mono">{child.level}</Badge>
                    <span className="truncate">{child.name}</span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Tags */}
          {cap.tags && cap.tags.length > 0 && (
            <section>
              <SectionLabel>Tags</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {cap.tags.map((t: any) => (
                  <Badge
                    key={t.tag.id}
                    variant="secondary"
                    className="text-xs"
                    style={{ borderColor: t.tag.color, color: t.tag.color }}
                  >
                    {t.tag.name}
                  </Badge>
                ))}
              </div>
            </section>
          )}
          </CollapsibleGroup>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t bg-card flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          onClick={() => cloneMutation.mutate({ id: cap.id })}
        >
          <Copy className="h-3.5 w-3.5 mr-1.5" />
          Clone
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="flex-1 text-xs"
          onClick={() => {
            if (confirm("Delete this capability?")) {
              deleteMutation.mutate({ id: cap.id, cascade: (cap.children?.length ?? 0) > 0 });
            }
          }}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Delete
        </Button>
      </div>

      <ObjectiveFormModal
        open={showCreateObjective}
        onClose={() => {
          setShowCreateObjective(false);
          utils.objective.list.invalidate();
        }}
      />
    </aside>
  );
}

// ── Helpers ────────────────────────────────────────────────────

function SectionLabel({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <h3 className="flex items-center gap-1.5 text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
      {icon}
      {children}
    </h3>
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
    return (
      (u.name?.toLowerCase().includes(q)) ||
      u.email.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      {owner ? (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border bg-card group">
          {owner.avatarUrl ? (
            <img src={owner.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
          ) : (
            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-[9px] font-bold text-primary">
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
          <PopoverTrigger className="w-full h-8 px-2 rounded-md border border-dashed text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition text-left">
              + Assign {label.toLowerCase()}
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <div className="p-2 border-b">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
                className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-auto p-1">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground px-2 py-3 text-center">
                  No users found
                </p>
              ) : (
                filtered.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      onChange(u.id);
                      setSearch("");
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-muted transition"
                  >
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-primary">
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

function EditableField({
  value,
  onSave,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft !== value && draft.trim()) onSave(draft.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        className={className}
      />
    );
  }

  return (
    <h2
      className={`cursor-pointer hover:text-primary transition-colors ${className}`}
      tabIndex={0}
      role="button"
      aria-label={`Edit ${value}. Double-click to edit.`}
      onDoubleClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setEditing(true); }
      }}
      title="Double-click to edit"
    >
      {value}
    </h2>
  );
}
