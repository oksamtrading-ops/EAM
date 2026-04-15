"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table2, Trash2, CheckCircle2, AlertCircle, Crown, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RecordQualityScoreModal } from "../modals/RecordQualityScoreModal";
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
  const [showRecordScore, setShowRecordScore] = useState(false);
  const utils = trpc.useUtils();
  const { data: entity, isLoading } = trpc.dataEntity.getById.useQuery({ id: entityId });
  const { data: domains = [] } = trpc.dataDomain.list.useQuery();
  const { data: apps = [] } = trpc.application.list.useQuery();
  const { data: users = [] } = trpc.workspace.listUsers.useQuery();

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

  const latestByDimension = new Map<string, { score: number; asOf: Date }>();
  if (entity) {
    for (const qs of entity.qualityScores) {
      const existing = latestByDimension.get(qs.dimension);
      const ts = new Date(qs.asOf);
      if (!existing || ts > existing.asOf) {
        latestByDimension.set(qs.dimension, { score: qs.score, asOf: ts });
      }
    }
  }

  return (
    <>
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full sm:w-[560px] sm:max-w-[560px] p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Table2 className="h-5 w-5 text-blue-600 shrink-0" />
              <SheetTitle className="text-base font-semibold leading-snug line-clamp-2">
                {isLoading ? "Loading…" : entity?.name}
              </SheetTitle>
            </div>
          </SheetHeader>

          {entity && (
            <ScrollArea className="flex-1" key={entity.id}>
              <div className="px-6 py-4 space-y-5">
                {/* Name */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Name
                  </Label>
                  <Input
                    defaultValue={entity.name}
                    className="h-8 text-sm"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== entity.name) update({ id: entity.id, name: v });
                    }}
                  />
                </div>

                {/* Description */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Description
                  </Label>
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
                </div>

                <Separator />

                {/* Domain / Type / Classification */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">
                      Domain
                    </Label>
                    <Select
                      value={entity.domainId}
                      onValueChange={(v) => v && update({ id: entity.id, domainId: v })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
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
                    <Label className="text-xs text-muted-foreground mb-1 block">
                      Type
                    </Label>
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
                    <Label className="text-xs text-muted-foreground mb-1 block">
                      Classification
                    </Label>
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
                    <Label className="text-xs text-muted-foreground mb-1 block">
                      Retention (days)
                    </Label>
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
                </div>

                {/* Golden Source / Steward */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">
                      Golden Source App
                    </Label>
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
                        <SelectValue placeholder="None" />
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
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">
                      Data Steward
                    </Label>
                    <Select
                      value={entity.stewardId ?? "__none__"}
                      onValueChange={(v) =>
                        update({
                          id: entity.id,
                          stewardId: !v || v === "__none__" ? null : v,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Unassigned</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name ?? u.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

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
                  {!entity.steward && (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <AlertCircle className="h-3 w-3" /> Unassigned steward
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

                {/* Regulatory tags */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Regulatory Tags
                  </Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
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
                </div>

                <Separator />

                {/* Applications using this entity */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Applications using this entity ({entity.appUsages.length})
                  </h4>
                  {entity.appUsages.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No application usages recorded yet. Use the CRUD Matrix view to add
                      one.
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
                </div>

                <Separator />

                {/* Data Quality */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Data Quality
                    </h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRecordScore(true)}
                      className="h-7 gap-1 text-xs"
                    >
                      <Plus className="h-3 w-3" />
                      Record score
                    </Button>
                  </div>
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
                </div>
              </div>
            </ScrollArea>
          )}

          <div className="px-6 py-3 border-t shrink-0 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (entity && confirm(`Delete "${entity.name}"?`)) {
                  deleteMutation.mutate({ id: entity.id });
                }
              }}
              className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
            {updateMutation.isPending && (
              <span className="text-[11px] text-muted-foreground">Saving…</span>
            )}
            {!updateMutation.isPending && entity?.goldenSourceApp && (
              <span className="ml-auto text-[11px] text-green-600 inline-flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Has golden source
              </span>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {entity && (
        <RecordQualityScoreModal
          open={showRecordScore}
          entityId={entity.id}
          onClose={() => setShowRecordScore(false)}
        />
      )}
    </>
  );
}
