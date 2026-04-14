"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

const STATUSES = [
  { value: "COMPLIANT", label: "Compliant" },
  { value: "PARTIAL", label: "Partial" },
  { value: "NON_COMPLIANT", label: "Non-Compliant" },
  { value: "NOT_ASSESSED", label: "Not Assessed" },
  { value: "EXEMPT", label: "Exempt" },
] as const;

const ENTITY_TYPES = ["Workspace", "Application", "TechComponent"] as const;

interface Props {
  requirementId: string;
  controlTitle: string;
  onClose: () => void;
}

export function ComplianceMappingPanel({ requirementId, controlTitle, onClose }: Props) {
  const utils = trpc.useUtils();
  const [entityType, setEntityType] = useState<string>("Workspace");
  const [entityId, setEntityId] = useState("");
  const [entityName, setEntityName] = useState("");
  const [status, setStatus] = useState<string>("NOT_ASSESSED");
  const [evidence, setEvidence] = useState("");
  const [notes, setNotes] = useState("");
  const [nextReviewDate, setNextReviewDate] = useState("");

  const { data: applications = [] } = trpc.application.list.useQuery(undefined, {
    enabled: entityType === "Application",
  });

  const assessMutation = trpc.compliance.assess.useMutation({
    onSuccess: () => {
      toast.success("Compliance assessment saved");
      utils.compliance.getScorecard.invalidate();
      utils.compliance.listRequirements.invalidate();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleEntityTypeChange(val: string | null) {
    if (!val) return;
    setEntityType(val);
    setEntityId("");
    setEntityName("");
    if (val === "Workspace") {
      setEntityName("Workspace");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const effectiveEntityId = entityType === "Workspace" ? requirementId : entityId;
    const effectiveEntityName = entityType === "Workspace" ? "Workspace" : entityName;

    if (!effectiveEntityId || !effectiveEntityName) {
      toast.error("Please select or enter the entity being assessed");
      return;
    }

    assessMutation.mutate({
      requirementId,
      entityType,
      entityId: effectiveEntityId,
      entityName: effectiveEntityName,
      status: status as any,
      evidence: evidence || undefined,
      nextReviewDate: nextReviewDate || undefined,
      notes: notes || undefined,
    });
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[440px] sm:max-w-[440px] p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle className="text-base line-clamp-2">Assess: {controlTitle}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <Label>Assessed Entity</Label>
              <Select value={entityType} onValueChange={handleEntityTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {entityType === "Application" && (
              <div>
                <Label>Application *</Label>
                <Select
                  value={entityId}
                  onValueChange={(val) => {
                    const v = val ?? "";
                    setEntityId(v);
                    const app = applications.find((a) => a.id === v);
                    setEntityName(app?.name ?? v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select application…" />
                  </SelectTrigger>
                  <SelectContent>
                    {applications.map((app) => (
                      <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {entityType === "TechComponent" && (
              <div>
                <Label>Component Name *</Label>
                <Input
                  value={entityName}
                  onChange={(e) => { setEntityName(e.target.value); setEntityId(e.target.value); }}
                  placeholder="e.g. PostgreSQL 12, Ubuntu 18.04"
                />
              </div>
            )}

            <div>
              <Label>Compliance Status *</Label>
              <Select value={status} onValueChange={(v) => v && setStatus(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="evidence">Evidence</Label>
              <Textarea
                id="evidence"
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="Describe the evidence supporting this status…"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional context or gaps…"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="nextReview">Next Review Date</Label>
              <Input
                id="nextReview"
                type="date"
                value={nextReviewDate}
                onChange={(e) => setNextReviewDate(e.target.value)}
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t flex items-center gap-2 shrink-0">
            <Button type="submit" disabled={assessMutation.isPending} className="bg-[#0B5CD6] hover:bg-[#75a821] text-white">
              {assessMutation.isPending ? "Saving…" : "Save Assessment"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
