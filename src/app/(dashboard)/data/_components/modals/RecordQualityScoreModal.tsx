"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  DQ_DIMENSION_LABELS,
  dqScoreColor,
} from "@/lib/constants/data-architecture-colors";

const DQ_DIMENSIONS = [
  "COMPLETENESS",
  "ACCURACY",
  "CONSISTENCY",
  "TIMELINESS",
  "UNIQUENESS",
  "VALIDITY",
] as const;
type DqDimension = (typeof DQ_DIMENSIONS)[number];

interface Props {
  open: boolean;
  entityId: string;
  onClose: () => void;
}

export function RecordQualityScoreModal({ open, entityId, onClose }: Props) {
  const utils = trpc.useUtils();
  const [dimension, setDimension] = useState<DqDimension>("COMPLETENESS");
  const [score, setScore] = useState<number>(80);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setDimension("COMPLETENESS");
      setScore(80);
      setNote("");
    }
  }, [open]);

  const mutation = trpc.dataEntity.recordQualityScore.useMutation({
    onSuccess: () => {
      toast.success("Quality score recorded");
      utils.dataEntity.getById.invalidate({ id: entityId });
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (score < 0 || score > 100) {
      toast.error("Score must be between 0 and 100");
      return;
    }
    mutation.mutate({
      entityId,
      dimension,
      score,
      note: note.trim() === "" ? undefined : note.trim(),
    });
  }

  const scoreColor = dqScoreColor(score);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Quality Score</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Dimension</Label>
            <Select
              value={dimension}
              onValueChange={(v) => v && setDimension(v as DqDimension)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DQ_DIMENSIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {DQ_DIMENSION_LABELS[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label htmlFor="score">Score (0–100)</Label>
              <span
                className="text-lg font-semibold tabular-nums"
                style={{ color: scoreColor }}
              >
                {score}
              </span>
            </div>
            <input
              id="score"
              type="range"
              min={0}
              max={100}
              step={1}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="w-full accent-primary"
              style={{ accentColor: scoreColor }}
            />
            <div className="mt-2">
              <Input
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
                className="w-24"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Context: sample size, methodology, data window…"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {mutation.isPending ? "Saving…" : "Record Score"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
