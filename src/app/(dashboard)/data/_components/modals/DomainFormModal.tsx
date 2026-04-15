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
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

interface DomainSeed {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
}

interface Props {
  open: boolean;
  domain?: DomainSeed;
  onClose: () => void;
}

export function DomainFormModal({ open, domain, onClose }: Props) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(domain?.name ?? "");
  const [description, setDescription] = useState(domain?.description ?? "");
  const [color, setColor] = useState(domain?.color ?? "#0B5CD6");

  useEffect(() => {
    if (open) {
      setName(domain?.name ?? "");
      setDescription(domain?.description ?? "");
      setColor(domain?.color ?? "#0B5CD6");
    }
  }, [open, domain]);

  const createMutation = trpc.dataDomain.create.useMutation({
    onSuccess: () => {
      toast.success("Domain created");
      utils.dataDomain.list.invalidate();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.dataDomain.update.useMutation({
    onSuccess: () => {
      toast.success("Domain updated");
      utils.dataDomain.list.invalidate();
      if (domain) utils.dataDomain.getById.invalidate({ id: domain.id });
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name,
      description: description || undefined,
      color,
    };
    if (domain) {
      updateMutation.mutate({ id: domain.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{domain ? "Edit Domain" : "New Data Domain"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Customer, Product, Finance"
              required
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What data belongs in this domain?"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="color">Color</Label>
            <div className="flex items-center gap-2">
              <input
                id="color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-14 rounded-md border border-border cursor-pointer bg-background"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="max-w-[120px] font-mono text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {isSubmitting ? "Saving…" : domain ? "Update Domain" : "Create Domain"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
