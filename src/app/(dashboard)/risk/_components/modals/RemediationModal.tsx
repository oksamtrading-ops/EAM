"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const REMEDIATION_TYPES = [
  { value: "INITIATIVE_LINK", label: "Link to Initiative" },
  { value: "MANUAL_ACTION", label: "Manual Action" },
  { value: "ACCEPTED_RISK", label: "Accepted Risk" },
  { value: "DEFERRED", label: "Deferred" },
] as const;

interface Props {
  riskId: string;
  onClose: () => void;
}

export function RemediationModal({ riskId, onClose }: Props) {
  const utils = trpc.useUtils();
  const [remediationType, setRemediationType] = useState<string>("MANUAL_ACTION");
  const [initiativeId, setInitiativeId] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");

  const { data: initiatives = [] } = trpc.initiative.list.useQuery(undefined, {
    enabled: remediationType === "INITIATIVE_LINK",
  });

  const linkMutation = trpc.risk.linkRemediation.useMutation({
    onSuccess: () => {
      toast.success("Remediation linked");
      utils.risk.getById.invalidate({ id: riskId });
      utils.risk.list.invalidate();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    linkMutation.mutate({
      riskId,
      remediationType: remediationType as any,
      initiativeId: remediationType === "INITIATIVE_LINK" ? initiativeId || undefined : undefined,
      description: description || undefined,
      targetDate: targetDate || undefined,
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Remediation</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Remediation Type *</Label>
            <Select value={remediationType} onValueChange={(v) => v && setRemediationType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REMEDIATION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {remediationType === "INITIATIVE_LINK" && (
            <div>
              <Label>Initiative</Label>
              <Select value={initiativeId} onValueChange={(v) => setInitiativeId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select initiative…" />
                </SelectTrigger>
                <SelectContent>
                  {initiatives.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the remediation action…"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="targetDate">Target Date</Label>
            <Input
              id="targetDate"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              disabled={linkMutation.isPending}
              className="bg-[#86BC25] hover:bg-[#75a821] text-white"
            >
              {linkMutation.isPending ? "Saving…" : "Add Remediation"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
