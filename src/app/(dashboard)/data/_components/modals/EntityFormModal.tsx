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
  CLASSIFICATION_LABELS,
  CLASSIFICATION_OPTIONS,
  ENTITY_TYPE_LABELS,
  ENTITY_TYPE_OPTIONS,
  REGULATORY_TAG_LABELS,
  REGULATORY_TAG_OPTIONS,
  REGULATORY_TAG_COLORS,
} from "@/lib/constants/data-architecture-colors";

type EntityType = (typeof ENTITY_TYPE_OPTIONS)[number];
type Classification = (typeof CLASSIFICATION_OPTIONS)[number];
type RegTag = (typeof REGULATORY_TAG_OPTIONS)[number];

interface Props {
  open: boolean;
  defaultDomainId?: string;
  onClose: () => void;
}

export function EntityFormModal({ open, defaultDomainId, onClose }: Props) {
  const utils = trpc.useUtils();
  const { data: domains = [] } = trpc.dataDomain.list.useQuery();
  const { data: apps = [] } = trpc.application.list.useQuery();
  const { data: users = [] } = trpc.workspace.listUsers.useQuery();

  const [domainId, setDomainId] = useState(defaultDomainId ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [entityType, setEntityType] = useState<EntityType>("TRANSACTIONAL");
  const [classification, setClassification] = useState<Classification>("DC_UNKNOWN");
  const [regulatoryTags, setRegulatoryTags] = useState<RegTag[]>([]);
  const [goldenSourceAppId, setGoldenSourceAppId] = useState("");
  const [retentionDays, setRetentionDays] = useState("");
  const [stewardId, setStewardId] = useState("");

  useEffect(() => {
    if (open) {
      setDomainId(defaultDomainId ?? domains[0]?.id ?? "");
      setName("");
      setDescription("");
      setEntityType("TRANSACTIONAL");
      setClassification("DC_UNKNOWN");
      setRegulatoryTags([]);
      setGoldenSourceAppId("");
      setRetentionDays("");
      setStewardId("");
    }
  }, [open, defaultDomainId, domains]);

  const createMutation = trpc.dataEntity.create.useMutation({
    onSuccess: () => {
      toast.success("Entity created");
      utils.dataEntity.list.invalidate();
      utils.dataEntity.stats.invalidate();
      utils.dataDomain.list.invalidate();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  function toggleTag(tag: RegTag) {
    setRegulatoryTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!domainId) {
      toast.error("Please select a domain");
      return;
    }
    const parsedRetention =
      retentionDays.trim() === "" ? undefined : Number(retentionDays);
    if (parsedRetention !== undefined && (isNaN(parsedRetention) || parsedRetention <= 0)) {
      toast.error("Retention days must be a positive number");
      return;
    }

    createMutation.mutate({
      domainId,
      name,
      description: description || undefined,
      entityType,
      classification,
      regulatoryTags,
      goldenSourceAppId: goldenSourceAppId || undefined,
      retentionDays: parsedRetention,
      stewardId: stewardId || undefined,
    });
  }

  const noDomains = domains.length === 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Data Entity</DialogTitle>
        </DialogHeader>

        {noDomains ? (
          <div className="p-4 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            Create a data domain first — entities must belong to a domain.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Domain *</Label>
                <Select value={domainId} onValueChange={(v) => v && setDomainId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select domain" />
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
                <Label>Type</Label>
                <Select
                  value={entityType}
                  onValueChange={(v) => v && setEntityType(v as EntityType)}
                >
                  <SelectTrigger>
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
            </div>

            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Customer, Invoice, Product SKU"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this entity represent?"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Classification</Label>
                <Select
                  value={classification}
                  onValueChange={(v) => v && setClassification(v as Classification)}
                >
                  <SelectTrigger>
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
                <Label htmlFor="retention">Retention (days)</Label>
                <Input
                  id="retention"
                  type="number"
                  min={1}
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(e.target.value)}
                  placeholder="e.g. 2555"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Golden Source Application</Label>
                <Select
                  value={goldenSourceAppId || "__none__"}
                  onValueChange={(v) =>
                    setGoldenSourceAppId(!v || v === "__none__" ? "" : v)
                  }
                >
                  <SelectTrigger>
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
                <Label>Data Steward</Label>
                <Select
                  value={stewardId || "__none__"}
                  onValueChange={(v) =>
                    setStewardId(!v || v === "__none__" ? "" : v)
                  }
                >
                  <SelectTrigger>
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

            <div>
              <Label>Regulatory Tags</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {REGULATORY_TAG_OPTIONS.map((tag) => {
                  const active = regulatoryTags.includes(tag);
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

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                {createMutation.isPending ? "Saving…" : "Create Entity"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
