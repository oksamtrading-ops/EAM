"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table2, Edit, Trash2, CheckCircle2, AlertCircle, Crown } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EntityFormModal } from "../modals/EntityFormModal";
import { ClassificationBadge } from "@/components/shared/ClassificationBadge";
import { RegulatoryTagList } from "@/components/shared/RegulatoryTagList";
import {
  ENTITY_TYPE_LABELS,
  ENTITY_TYPE_COLORS,
  DQ_DIMENSION_LABELS,
  dqScoreColor,
} from "@/lib/constants/data-architecture-colors";

interface Props {
  entityId: string;
  onClose: () => void;
}

export function EntityDetailPanel({ entityId, onClose }: Props) {
  const [showEdit, setShowEdit] = useState(false);
  const utils = trpc.useUtils();
  const { data: entity, isLoading } = trpc.dataEntity.getById.useQuery({ id: entityId });

  const deleteMutation = trpc.dataEntity.delete.useMutation({
    onSuccess: () => {
      toast.success("Entity deleted");
      utils.dataEntity.list.invalidate();
      utils.dataEntity.stats.invalidate();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

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
        <SheetContent className="w-full sm:w-[520px] sm:max-w-[520px] p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Table2 className="h-5 w-5 text-blue-600 shrink-0" />
              <SheetTitle className="text-base font-semibold leading-snug line-clamp-2">
                {isLoading ? "Loading…" : entity?.name}
              </SheetTitle>
            </div>
          </SheetHeader>

          {entity && (
            <ScrollArea className="flex-1">
              <div className="px-6 py-4 space-y-5">
                {/* Domain + Type chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-md border"
                    style={{
                      color: entity.domain.color ?? "#0B5CD6",
                      borderColor: `${entity.domain.color ?? "#0B5CD6"}55`,
                      background: `${entity.domain.color ?? "#0B5CD6"}12`,
                    }}
                  >
                    {entity.domain.name}
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-md border"
                    style={{
                      color: ENTITY_TYPE_COLORS[entity.entityType],
                      borderColor: `${ENTITY_TYPE_COLORS[entity.entityType]}55`,
                      background: `${ENTITY_TYPE_COLORS[entity.entityType]}12`,
                    }}
                  >
                    {ENTITY_TYPE_LABELS[entity.entityType]}
                  </span>
                  <ClassificationBadge classification={entity.classification} />
                </div>

                {entity.description && (
                  <p className="text-sm text-muted-foreground">{entity.description}</p>
                )}

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground mb-0.5">Steward</p>
                    <p className="font-medium text-foreground">
                      {entity.steward?.name ?? entity.steward?.email ?? (
                        <span className="text-amber-600 inline-flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Unassigned
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5">Retention</p>
                    <p className="font-medium text-foreground">
                      {entity.retentionDays ? `${entity.retentionDays} days` : "—"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground mb-0.5">Golden Source</p>
                    <p className="font-medium text-foreground inline-flex items-center gap-1.5">
                      {entity.goldenSourceApp ? (
                        <>
                          <Crown className="h-3 w-3 text-amber-500" />
                          {entity.goldenSourceApp.name}
                        </>
                      ) : (
                        <span className="text-amber-600 inline-flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Not designated
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {entity.regulatoryTags.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Regulatory Tags
                      </h4>
                      <RegulatoryTagList tags={entity.regulatoryTags} />
                    </div>
                  </>
                )}

                <Separator />

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

                {latestByDimension.size > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Data Quality
                      </h4>
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
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          )}

          <div className="px-6 py-3 border-t shrink-0 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEdit(true)}
              className="gap-1.5"
            >
              <Edit className="h-3.5 w-3.5" />
              Edit
            </Button>
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
            {entity?.goldenSourceApp && (
              <span className="ml-auto text-[11px] text-green-600 inline-flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Has golden source
              </span>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {entity && (
        <EntityFormModal
          open={showEdit}
          entity={{
            id: entity.id,
            domainId: entity.domainId,
            name: entity.name,
            description: entity.description,
            entityType: entity.entityType as "MASTER" | "REFERENCE" | "TRANSACTIONAL" | "ANALYTICAL" | "METADATA",
            classification: entity.classification as "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED" | "DC_UNKNOWN",
            regulatoryTags: entity.regulatoryTags as ("PII" | "PHI" | "PCI" | "GDPR" | "CCPA" | "SOX" | "HIPAA" | "FERPA")[],
            goldenSourceAppId: entity.goldenSourceAppId,
            retentionDays: entity.retentionDays,
          }}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  );
}
