"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Link2, Edit, Trash2, Check, X } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { scoreLabel } from "@/server/services/riskScoring";
import { RiskFormModal } from "../modals/RiskFormModal";
import { RemediationModal } from "../modals/RemediationModal";

const SCORE_COLORS: Record<string, string> = {
  Critical: "bg-red-100 text-red-700 border-red-200",
  High: "bg-orange-100 text-orange-700 border-orange-200",
  Medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Low: "bg-green-100 text-green-700 border-green-200",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-red-50 text-red-700",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  MITIGATED: "bg-green-50 text-green-700",
  ACCEPTED: "bg-gray-100 text-gray-600",
  CLOSED: "bg-gray-50 text-gray-400",
};

interface Props {
  riskId: string;
  onClose: () => void;
}

export function RiskDetailPanel({ riskId, onClose }: Props) {
  const [showEdit, setShowEdit] = useState(false);
  const [showRemediation, setShowRemediation] = useState(false);
  const [pendingDeleteRemId, setPendingDeleteRemId] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const { data: risk, isLoading } = trpc.risk.getById.useQuery({ id: riskId });

  const acceptMutation = trpc.risk.accept.useMutation({
    onSuccess: () => {
      toast.success("Risk accepted");
      utils.risk.getById.invalidate({ id: riskId });
      utils.risk.list.invalidate();
    },
    onError: () => toast.error("Failed to accept risk"),
  });

  const deleteRemediationMutation = trpc.risk.deleteRemediation.useMutation({
    onSuccess: () => {
      toast.success("Remediation removed");
      utils.risk.getById.invalidate({ id: riskId });
      setPendingDeleteRemId(null);
    },
    onError: () => toast.error("Failed to delete remediation"),
  });

  const deleteMutation = trpc.risk.delete.useMutation({
    onSuccess: () => {
      toast.success("Risk deleted");
      utils.risk.list.invalidate();
      utils.risk.getStats.invalidate();
      onClose();
    },
    onError: () => toast.error("Failed to delete risk"),
  });

  return (
    <>
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-[480px] sm:max-w-[480px] p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                <SheetTitle className="text-base font-semibold leading-snug line-clamp-2">
                  {isLoading ? "Loading…" : risk?.title}
                </SheetTitle>
              </div>
            </div>
          </SheetHeader>

          {risk && (
            <ScrollArea className="flex-1">
              <div className="px-6 py-4 space-y-5">
                {/* Score & Status */}
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge
                    className={cn(
                      "text-sm px-3 py-1 font-semibold border",
                      SCORE_COLORS[scoreLabel(risk.riskScore)]
                    )}
                  >
                    {risk.riskScore}/16 · {scoreLabel(risk.riskScore)}
                  </Badge>
                  <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[risk.status])}>
                    {risk.status}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {risk.category.replace(/_/g, " ")}
                  </Badge>
                </div>

                {/* Likelihood × Impact */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Likelihood</p>
                    <p className="text-sm font-semibold mt-0.5">{risk.likelihood}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Impact</p>
                    <p className="text-sm font-semibold mt-0.5">{risk.impact}</p>
                  </div>
                </div>

                {risk.description && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Description</p>
                    <p className="text-sm leading-relaxed">{risk.description}</p>
                  </div>
                )}

                <Separator />

                {/* Linked Applications */}
                {risk.applicationLinks.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Affected Applications ({risk.applicationLinks.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {risk.applicationLinks.map((link) => (
                        <Badge key={link.applicationId} variant="outline" className="text-xs">
                          {link.applicationId}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Linked Capabilities */}
                {risk.capabilityLinks.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Affected Capabilities ({risk.capabilityLinks.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {risk.capabilityLinks.map((link) => (
                        <Badge key={link.capabilityId} variant="outline" className="text-xs">
                          {link.capabilityId}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Remediations */}
                {risk.remediations.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Remediations ({risk.remediations.length})
                    </p>
                    <div className="space-y-2">
                      {risk.remediations.map((rem) => (
                        <div key={rem.id} className="bg-muted/50 rounded-lg p-3 group">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {rem.remediationType.replace(/_/g, " ")}
                              </Badge>
                              {rem.completedDate && (
                                <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700">
                                  Completed
                                </Badge>
                              )}
                            </div>
                            {pendingDeleteRemId === rem.id ? (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => deleteRemediationMutation.mutate({ id: rem.id })}
                                  disabled={deleteRemediationMutation.isPending}
                                  className="text-xs text-white bg-rose-500 hover:bg-rose-600 px-2 py-0.5 rounded font-medium disabled:opacity-50"
                                >
                                  {deleteRemediationMutation.isPending ? "…" : "Delete"}
                                </button>
                                <button
                                  onClick={() => setPendingDeleteRemId(null)}
                                  className="p-0.5 text-muted-foreground hover:text-foreground"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setPendingDeleteRemId(rem.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-all shrink-0"
                                title="Delete remediation"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          {rem.description && (
                            <p className="text-xs text-muted-foreground mt-1">{rem.description}</p>
                          )}
                          {rem.targetDate && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Target: {new Date(rem.targetDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {risk.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {risk.tags.map((t) => (
                      <Badge
                        key={t.tagId}
                        variant="outline"
                        className="text-xs"
                        style={{ borderColor: t.tag.color, color: t.tag.color }}
                      >
                        {t.tag.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {risk && (
            <div className="px-6 py-4 border-t shrink-0 flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowEdit(true)}>
                <Edit className="h-3.5 w-3.5" />
                Edit
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowRemediation(true)}>
                <Link2 className="h-3.5 w-3.5" />
                Add Remediation
              </Button>
              {risk.status === "OPEN" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => acceptMutation.mutate({ id: riskId })}
                  disabled={acceptMutation.isPending}
                >
                  <Check className="h-3.5 w-3.5" />
                  Accept
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 ml-auto text-destructive hover:text-destructive"
                onClick={() => deleteMutation.mutate({ id: riskId })}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {showEdit && risk && (
        <RiskFormModal
          open
          risk={risk}
          onClose={() => setShowEdit(false)}
        />
      )}

      {showRemediation && risk && (
        <RemediationModal
          riskId={risk.id}
          onClose={() => setShowRemediation(false)}
        />
      )}
    </>
  );
}
