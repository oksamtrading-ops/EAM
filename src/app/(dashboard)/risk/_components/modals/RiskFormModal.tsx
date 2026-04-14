"use client";

import { useState } from "react";
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
import type { RiskItem } from "../RiskContext";

const CATEGORIES = [
  { value: "TECHNOLOGY_EOL", label: "Technology EOL" },
  { value: "VENDOR_RISK", label: "Vendor Risk" },
  { value: "SECURITY", label: "Security" },
  { value: "ARCHITECTURE", label: "Architecture" },
  { value: "CAPABILITY_GAP", label: "Capability Gap" },
  { value: "COMPLIANCE", label: "Compliance" },
  { value: "OPERATIONAL", label: "Operational" },
  { value: "DATA", label: "Data" },
] as const;

const LIKELIHOODS = ["RARE", "LOW", "MEDIUM", "HIGH"] as const;
const IMPACTS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const STATUSES = ["OPEN", "IN_PROGRESS", "MITIGATED", "ACCEPTED", "CLOSED"] as const;

interface Props {
  open: boolean;
  risk?: RiskItem;
  onClose: () => void;
}

export function RiskFormModal({ open, risk, onClose }: Props) {
  const utils = trpc.useUtils();

  const [title, setTitle] = useState(risk?.title ?? "");
  const [description, setDescription] = useState(risk?.description ?? "");
  const [category, setCategory] = useState<string>(risk?.category ?? "SECURITY");
  const [likelihood, setLikelihood] = useState<string>(risk?.likelihood ?? "MEDIUM");
  const [impact, setImpact] = useState<string>(risk?.impact ?? "MEDIUM");
  const [status, setStatus] = useState<string>(risk?.status ?? "OPEN");
  const [dueDate, setDueDate] = useState(
    risk?.dueDate ? new Date(risk.dueDate).toISOString().split("T")[0] : ""
  );

  const createMutation = trpc.risk.create.useMutation({
    onSuccess: () => {
      toast.success("Risk created");
      utils.risk.list.invalidate();
      utils.risk.getStats.invalidate();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.risk.update.useMutation({
    onSuccess: () => {
      toast.success("Risk updated");
      utils.risk.list.invalidate();
      utils.risk.getById.invalidate({ id: risk!.id });
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      title,
      description: description || undefined,
      category: category as any,
      likelihood: likelihood as any,
      impact: impact as any,
      status: status as any,
      dueDate: dueDate || undefined,
    };

    if (risk) {
      updateMutation.mutate({ id: risk.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{risk ? "Edit Risk" : "New Risk"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Risk title"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the risk and its potential impact…"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category *</Label>
              <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => v && setStatus(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Likelihood *</Label>
              <Select value={likelihood} onValueChange={(v) => v && setLikelihood(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIKELIHOODS.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Impact *</Label>
              <Select value={impact} onValueChange={(v) => v && setImpact(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPACTS.map((i) => (
                    <SelectItem key={i} value={i}>{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {isSubmitting ? "Saving…" : risk ? "Update Risk" : "Create Risk"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
