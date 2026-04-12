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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

interface Props {
  entryId: string;
  onClose: () => void;
}

export function EolAcknowledgeModal({ entryId, onClose }: Props) {
  const utils = trpc.useUtils();
  const [notes, setNotes] = useState("");
  const [initiativeId, setInitiativeId] = useState("");

  const { data: initiatives = [] } = trpc.initiative.list.useQuery();

  const acknowledgeMutation = trpc.eol.acknowledge.useMutation({
    onSuccess: () => {
      toast.success("EOL entry acknowledged");
      utils.eol.list.invalidate();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    acknowledgeMutation.mutate({
      id: entryId,
      notes: notes || undefined,
      remediationInitiativeId: initiativeId || undefined,
    });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Acknowledge EOL Entry</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Acknowledge that this EOL risk has been reviewed. Optionally link a remediation initiative.
          </p>

          <div>
            <Label>Linked Initiative (optional)</Label>
            <Select value={initiativeId} onValueChange={(v) => setInitiativeId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Select initiative…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {initiatives.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why is this acknowledged? Any planned actions?…"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              disabled={acknowledgeMutation.isPending}
              className="bg-[#86BC25] hover:bg-[#75a821] text-white"
            >
              {acknowledgeMutation.isPending ? "Saving…" : "Acknowledge"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
