"use client";

import { useState } from "react";
import { X, Trash2, Table2, AlertCircle, Crown, Plus } from "lucide-react";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { CollapsibleGroup } from "@/components/shared/CollapsibleGroup";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { OwnerField } from "@/components/shared/OwnerField";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RecordQualityScoreModal } from "../modals/RecordQualityScoreModal";
import { AttributeTable } from "./AttributeTable";
import {
  CLASSIFICATION_LABELS,
  CLASSIFICATION_OPTIONS,
  ENTITY_TYPE_LABELS,
  ENTITY_TYPE_OPTIONS,
  ENTITY_TYPE_COLORS,
  REGULATORY_TAG_LABELS,
  REGULATORY_TAG_OPTIONS,
  REGULATORY_TAG_COLORS,
  DQ_DIMENSION_LABELS,
  dqScoreColor,
} from "@/lib/constants/data-architecture-colors";

type EntityType = (typeof ENTITY_TYPE_OPTIONS)[number];
type Classification = (typeof CLASSIFICATION_OPTIONS)[number];
type RegTag = (typeof REGULATORY_TAG_OPTIONS)[number];

interface Props {
  entityId: string;
  onClose: () => void;
}

export function EntityDetailPanel({ entityId, onClose }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showRecordScore, setShowRecordScore] = useState(false);
  const utils = trpc.useUtils();
  const { data: entity, isLoading } = trpc.dataEntity.getById.useQuery({ id: entityId });
  const { data: domains = [] } = trpc.dataDomain.list.useQuery();
  const { data: apps = [] } = trpc.application.list.useQuery();
  const { data: users = [] } = trpc.workspace.listUsers.useQuery();
  const { data: allEntities = [] } = trpc.dataEntity.list.useQuery();

  const updateMutation = trpc.dataEntity.update.useMutation({
    onSuccess: () => {
      utils.dataEntity.list.invalidate();
      utils.dataEntity.stats.invalidate();
      utils.dataEntity.getById.invalidate({ id: entityId });
      utils.dataDomain.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.dataEntity.delete.useMutation({
    onSuccess: () => {
      toast.success("Entity deleted");
      utils.dataEntity.list.invalidate();
      utils.dataEntity.stats.invalidate();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  function update(patch: Parameters<typeof updateMutation.mutate>[0]) {
    updateMutation.mutate(patch);
  }

  function toggleTag(tag: RegTag) {
    if (!entity) return;
    const current = entity.regulatoryTags as RegTag[];
    const next = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    update({ id: entity.id, regulatoryTags: next });
  }

  if (isLoading || !entity) {
    return (
      <aside className="fixed right-0 top-0 h-screen w-full sm:w-[480px] z-50 border-l bg-card p-4 shadow-xl">
        <div className="animate-pulse text-sm text-muted-foreground">Loading…</div>
      </aside>
    );
  }

  const latestByDimension = new Map<string, { score: number; asOf: Date }>();
  for (const qs of entity.qualityScores) {
    const existing = latestByDimension.get(qs.dimension);
    const ts = new Date(qs.asOf);
    if (!existing || ts > existing.asOf) {
      latestByDimension.set(qs.dimension, { score: qs.score, asOf: ts });
    }
  }

  return (
    <>
      <aside className="fixed right-0 top-0 h-screen w-full sm:w-[480px] z-50 border-l bg-card flex flex-col overflow-hidden shadow-xl">
        {/* Header */}
        <div className="p-4 border-b flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Table2 className="h-5 w-5 text-blue-600 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-bold text-[15px] text-foreground truncate">{entity.name}</h2>
              {entity.domain && (
                <p className="text-xs text-muted-foreground truncate">
                  {entity.domain.name}
                </p>
              )}
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-5">
            <CollapsibleGroup defaultOpenId="ownership">
            {/* Name */}
            <section>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
              <Input
                defaultValue={entity.name}
                className="h-8 text-sm"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== entity.name) update({ id: entity.id, name: v });
                }}
              />
            </section>

            {/* Description */}
            <section>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Description
              </label>
              <Textarea
                defaultValue={entity.description ?? ""}
                placeholder="What does this entity represent?"
                rows={2}
                onBlur={(e) => {
                  const v = e.target.value;
                  if (v !== (entity.description ?? "")) {
                    update({ id: entity.id, description: v || null });
                  }
                }}
              />
            </section>

            <Separator />

            {/* Classification — always open, top row */}
            <section className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Domain</label>
                <Select
                  value={entity.domainId}
                  onValueChange={(v) => v && update({ id: entity.id, domainId: v })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue>
                      {domains.find((d) => d.id === entity.domainId)?.name ??
                        entity.domain?.name ??
                        "Select domain"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {domains.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                <Select
                  value={entity.entityType}
                  onValueChange={(v) =>
                    v && update({ id: entity.id, entityType: v as EntityType })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {ENTITY_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Classification
                </label>
                <Select
                  value={entity.classification}
                  onValueChange={(v) =>
                    v && update({ id: entity.id, classification: v as Classification })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASSIFICATION_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CLASSIFICATION_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Retention (days)
                </label>
                <Input
                  type="number"
                  min={1}
                  defaultValue={entity.retentionDays ?? ""}
                  placeholder="e.g. 2555"
                  className="h-8 text-xs"
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    if (raw === "") {
                      if (entity.retentionDays != null)
                        update({ id: entity.id, retentionDays: null });
                      return;
                    }
                    const n = Number(raw);
                    if (!isNaN(n) && n > 0 && n !== entity.retentionDays) {
                      update({ id: entity.id, retentionDays: n });
                    }
                  }}
                />
              </div>
            </section>

            {/* Status hints */}
            <div className="flex flex-wrap gap-2 text-[11px]">
              {entity.goldenSourceApp ? (
                <span className="inline-flex items-center gap-1 text-green-600">
                  <Crown className="h-3 w-3 text-amber-500" /> Golden source:{" "}
                  {entity.goldenSourceApp.name}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-600">
                  <AlertCircle className="h-3 w-3" /> No golden source
                </span>
              )}
              {!entity.businessOwner && (
                <span className="inline-flex items-center gap-1 text-amber-600">
                  <AlertCircle className="h-3 w-3" /> No business owner
                </span>
              )}
              {!entity.steward && (
                <span className="inline-flex items-center gap-1 text-amber-600">
                  <AlertCircle className="h-3 w-3" /> Unassigned steward
                </span>
              )}
              {!entity.custodian && (
                <span className="inline-flex items-center gap-1 text-amber-600">
                  <AlertCircle className="h-3 w-3" /> No custodian
                </span>
              )}
              {entity.entityType && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 rounded border"
                  style={{
                    color: ENTITY_TYPE_COLORS[entity.entityType],
                    borderColor: `${ENTITY_TYPE_COLORS[entity.entityType]}55`,
                    background: `${ENTITY_TYPE_COLORS[entity.entityType]}12`,
                  }}
                >
                  {ENTITY_TYPE_LABELS[entity.entityType]}
                </span>
              )}
            </div>

            <Separator />

            {/* Ownership */}
            <CollapsibleSection id="ownership" title="Ownership" defaultOpen>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Golden Source App
                  </label>
                  <Select
                    value={entity.goldenSourceAppId ?? "__none__"}
                    onValueChange={(v) =>
                      update({
                        id: entity.id,
                        goldenSourceAppId: !v || v === "__none__" ? null : v,
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue>
                        {entity.goldenSourceAppId
                          ? apps.find((a) => a.id === entity.goldenSourceAppId)?.name ??
                            entity.goldenSourceApp?.name ??
                            "None"
                          : "None"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {apps.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <OwnerField
                  label="Business Owner"
                  owner={entity.businessOwner ?? null}
                  onChange={(id) => update({ id: entity.id, businessOwnerId: id })}
                  users={users}
                />
                <OwnerField
                  label="Data Steward"
                  owner={entity.steward ?? null}
                  onChange={(id) => update({ id: entity.id, stewardId: id })}
                  users={users}
                />
                <OwnerField
                  label="Technical Custodian"
                  owner={entity.custodian ?? null}
                  onChange={(id) => update({ id: entity.id, custodianId: id })}
                  users={users}
                />
              </div>
            </CollapsibleSection>

            <Separator />

            {/* Regulatory tags */}
            <CollapsibleSection
              id="regulatory"
              title="Regulatory Tags"
              count={(entity.regulatoryTags as RegTag[]).length}
            >
              <div className="flex flex-wrap gap-1.5">
                {REGULATORY_TAG_OPTIONS.map((tag) => {
                  const active = (entity.regulatoryTags as RegTag[]).includes(tag);
                  const color = REGULATORY_TAG_COLORS[tag];
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide border transition-colors"
                      style={{
                        color: active ? "#fff" : color,
                        borderColor: `${color}77`,
                        background: active ? color : `${color}12`,
                      }}
                    >
                      {REGULATORY_TAG_LABELS[tag]}
                    </button>
                  );
                })}
              </div>
            </CollapsibleSection>

            <Separator />

            {/* Attributes (field-level schema) */}
            <CollapsibleSection id="attributes" title="Attributes">
              <AttributeTable entityId={entity.id} allEntities={allEntities} />
            </CollapsibleSection>

            <Separator />

            {/* Applications using this entity */}
            <CollapsibleSection
              id="usages"
              title="Applications using this entity"
              count={entity.appUsages.length}
            >
              {entity.appUsages.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No application usages recorded yet. Use the CRUD Matrix view to add one.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {entity.appUsages.map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border bg-card"
                    >
                      <span className="text-sm font-medium text-foreground truncate">
                        {u.app.name}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono">
                        {(["creates", "reads", "updates", "deletes"] as const).map(
                          (op) => (
                            <span
                              key={op}
                              className={cn(
                                "inline-flex h-5 w-5 items-center justify-center rounded border",
                                u[op]
                                  ? "bg-primary/10 text-primary border-primary/30"
                                  : "bg-muted/40 text-muted-foreground border-border"
                              )}
                              title={op}
                            >
                              {op.charAt(0).toUpperCase()}
                            </span>
                          )
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CollapsibleSection>

            <Separator />

            {/* Data Quality */}
            <CollapsibleSection
              id="dq"
              title="Data Quality"
              count={latestByDimension.size}
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRecordScore(true)}
                  className="h-7 gap-1 text-xs"
                >
                  <Plus className="h-3 w-3" />
                  Record
                </Button>
              }
            >
              {latestByDimension.size === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No quality scores recorded yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {Array.from(latestByDimension.entries()).map(([dim, v]) => (
                    <div key={dim} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-28 shrink-0">
                        {DQ_DIMENSION_LABELS[dim]}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${v.score}%`,
                            background: dqScoreColor(v.score),
                          }}
                        />
                      </div>
                      <span
                        className="text-xs font-semibold tabular-nums w-8 text-right"
                        style={{ color: dqScoreColor(v.score) }}
                      >
                        {v.score}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleSection>
            </CollapsibleGroup>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t">
          {confirmDelete ? (
            <div className="space-y-2">
              <p className="text-xs text-rose-600 text-center font-medium">
                Delete &ldquo;{entity.name}&rdquo;? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 px-3 py-2 text-sm border rounded-md text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate({ id: entity.id })}
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
              Delete Entity
            </button>
          )}
        </div>
      </aside>

      <RecordQualityScoreModal
        open={showRecordScore}
        entityId={entity.id}
        onClose={() => setShowRecordScore(false)}
      />
    </>
  );
}
