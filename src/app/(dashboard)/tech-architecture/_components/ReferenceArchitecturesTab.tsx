"use client";

import { useMemo, useState, useEffect } from "react";
import { Plus, BookOpen, Trash2, Edit2, X, Wand2, Check } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabFilters } from "./TabFilters";

const STATUSES = ["DRAFT", "ACTIVE", "DEPRECATED"] as const;
const LAYERS = ["PRESENTATION", "APPLICATION", "DATA", "INTEGRATION", "INFRASTRUCTURE", "SECURITY"] as const;
const ROLES = ["PRIMARY", "SECONDARY", "FALLBACK", "DEPRECATED"] as const;

type RefArchStatus = (typeof STATUSES)[number];
type TechLayer = (typeof LAYERS)[number];
type TechRole = (typeof ROLES)[number];

function statusColor(s: string) {
  switch (s) {
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "DRAFT":
      return "bg-muted text-muted-foreground";
    case "DEPRECATED":
      return "bg-rose-100 text-rose-700 border-rose-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function ReferenceArchitecturesTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showAiDialog, setShowAiDialog] = useState(false);

  const { data: items = [], isLoading } = trpc.referenceArchitecture.list.useQuery({
    search: search || undefined,
    status: (statusFilter || undefined) as RefArchStatus | undefined,
  });

  const selected = useMemo(
    () => items.find((a) => a.id === selectedId) ?? null,
    [items, selectedId]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <TabFilters
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search reference architectures…"
          groups={[
            { key: "status", label: "Status", options: STATUSES.map((s) => ({ value: s, label: s })) },
          ]}
          values={{ status: statusFilter }}
          onValuesChange={(next) => setStatusFilter(next.status)}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAiDialog(true)}
            className="border-[var(--ai)]/30 text-[var(--ai)] hover:bg-[var(--ai-subtle)] hover:text-[var(--ai)]"
          >
            <Wand2 className="h-3.5 w-3.5 mr-1" /> Generate with AI
          </Button>
          <Button size="sm" onClick={() => { setEditingId(null); setShowForm(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New Reference Architecture
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center">
          <BookOpen className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">No reference architectures yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Capture reusable blueprints — preferred product combinations for common patterns.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedId(a.id)}
              className="text-left rounded-lg border border-border bg-card p-3 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{a.name}</p>
                <Badge variant="outline" className={`text-[10px] shrink-0 ${statusColor(a.status)}`}>{a.status}</Badge>
              </div>
              {a.category && <p className="text-xs text-muted-foreground mt-1">{a.category}</p>}
              <p className="text-xs text-muted-foreground mt-2">
                {a._count?.components ?? 0} components · {a.owner?.name ?? a.owner?.email ?? "unassigned"}
              </p>
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(v) => { if (!v) setSelectedId(null); }}>
        <SheetContent className="w-full sm:!max-w-lg overflow-y-auto">
          {selected && (
            <RefArchDetail
              archId={selected.id}
              onEdit={() => { setEditingId(selected.id); setShowForm(true); }}
              onDeleted={() => setSelectedId(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      <RefArchFormModal
        open={showForm}
        editingId={editingId}
        onClose={() => { setShowForm(false); setEditingId(null); }}
      />

      <GenerateRefArchDialog
        open={showAiDialog}
        onClose={() => setShowAiDialog(false)}
      />
    </div>
  );
}

type AiGenerateResult = {
  name: string;
  description: string;
  notes: string;
  components: Array<{
    productId: string;
    productName: string;
    vendorName: string;
    layer: TechLayer;
    role: TechRole;
    rationale: string;
  }>;
};

function GenerateRefArchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { workspaceId } = useWorkspace();
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiGenerateResult | null>(null);
  const [saving, setSaving] = useState(false);

  const createMutation = trpc.referenceArchitecture.create.useMutation();
  const addComponentMutation = trpc.referenceArchitecture.addComponent.useMutation();

  function reset() {
    setCategory("");
    setNotes("");
    setResult(null);
    setLoading(false);
    setSaving(false);
  }

  function handleClose() {
    if (saving) return;
    reset();
    onClose();
  }

  async function runGenerate() {
    if (!category.trim()) {
      toast.error("Category is required");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/ai/tech-architecture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-reference-architecture",
          workspaceId,
          payload: { category: category.trim(), notes: notes.trim() || undefined },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Generation failed");
        return;
      }
      setResult({
        name: json.name ?? "",
        description: json.description ?? "",
        notes: json.notes ?? "",
        components: Array.isArray(json.components) ? json.components : [],
      });
      if ((json.components ?? []).length === 0) {
        toast.info("No components could be proposed from your catalog");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveResult() {
    if (!result || !result.name) return;
    setSaving(true);
    try {
      const created = await createMutation.mutateAsync({
        name: result.name,
        description: result.description || null,
        category: category || null,
        status: "DRAFT",
      });
      for (const c of result.components) {
        try {
          await addComponentMutation.mutateAsync({
            architectureId: created.id,
            productId: c.productId,
            layer: c.layer,
            role: c.role,
            notes: c.rationale || null,
          });
        } catch {
          // skip single-component errors, surface aggregate
        }
      }
      toast.success(`Created "${created.name}" with ${result.components.length} components`);
      utils.referenceArchitecture.list.invalidate();
      utils.techArchitecture.kpis.invalidate();
      reset();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Reference Architecture with AI</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="ai-category">Category *</Label>
            <Input
              id="ai-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Web App, Data Pipeline, Event-Driven Microservices…"
              disabled={loading || saving}
            />
          </div>
          <div>
            <Label htmlFor="ai-notes">Additional notes</Label>
            <Textarea
              id="ai-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional: constraints, scale, integrations…"
              disabled={loading || saving}
            />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={runGenerate} disabled={loading || saving || !category.trim()}>
              <Wand2 className="h-3.5 w-3.5 mr-1" />
              {loading ? "Generating…" : result ? "Re-generate" : "Generate"}
            </Button>
          </div>

          {result && (
            <div className="space-y-3 border-t pt-3">
              <div>
                <p className="text-sm font-medium">{result.name}</p>
                {result.description && (
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{result.description}</p>
                )}
              </div>
              {result.components.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                    Proposed components ({result.components.length})
                  </p>
                  <ul className="space-y-1">
                    {result.components.map((c) => (
                      <li key={c.productId} className="text-xs p-2 bg-muted/30 rounded space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{c.productName}</span>
                          <span className="text-muted-foreground">· {c.vendorName}</span>
                          <Badge variant="outline" className="text-[9px] ml-auto">{c.layer}</Badge>
                          <Badge variant="outline" className="text-[9px]">{c.role}</Badge>
                        </div>
                        {c.rationale && (
                          <p className="text-muted-foreground leading-snug">{c.rationale}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.notes && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Notes</p>
                  <p className="text-xs text-muted-foreground leading-snug">{result.notes}</p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={saveResult}
              disabled={!result || !result.name || saving || loading}
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              {saving ? "Saving…" : "Create & Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RefArchDetail({ archId, onEdit, onDeleted }: { archId: string; onEdit: () => void; onDeleted: () => void }) {
  const utils = trpc.useUtils();
  const { data: arch } = trpc.referenceArchitecture.getById.useQuery({ id: archId });
  const { data: products = [] } = trpc.technologyProduct.list.useQuery({});

  const deleteMutation = trpc.referenceArchitecture.delete.useMutation({
    onSuccess: () => {
      toast.success("Reference architecture archived");
      utils.referenceArchitecture.list.invalidate();
      utils.techArchitecture.kpis.invalidate();
      onDeleted();
    },
    onError: (e) => toast.error(e.message),
  });

  const addComponentMutation = trpc.referenceArchitecture.addComponent.useMutation({
    onSuccess: () => {
      toast.success("Component added");
      utils.referenceArchitecture.getById.invalidate({ id: archId });
    },
    onError: (e) => toast.error(e.message),
  });
  const removeComponentMutation = trpc.referenceArchitecture.removeComponent.useMutation({
    onSuccess: () => {
      toast.success("Component removed");
      utils.referenceArchitecture.getById.invalidate({ id: archId });
    },
    onError: (e) => toast.error(e.message),
  });

  const [newProductId, setNewProductId] = useState("");
  const [newLayer, setNewLayer] = useState<TechLayer>("APPLICATION");
  const [newRole, setNewRole] = useState<TechRole>("PRIMARY");

  if (!arch) {
    return (
      <div className="p-6">
        <div className="h-6 bg-muted/40 animate-pulse rounded w-1/2 mb-3" />
        <div className="h-4 bg-muted/40 animate-pulse rounded w-3/4" />
      </div>
    );
  }

  const grouped = new Map<string, typeof arch.components>();
  for (const c of arch.components) {
    const key = c.layer;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(c);
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{arch.name}</SheetTitle>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className={`text-[10px] ${statusColor(arch.status)}`}>{arch.status}</Badge>
          {arch.category && <span className="text-xs text-muted-foreground">{arch.category}</span>}
        </div>
      </SheetHeader>
      <div className="px-4 space-y-4">
        {arch.description && <p className="text-sm text-muted-foreground">{arch.description}</p>}
        {arch.diagramUrl && (
          <a href={arch.diagramUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline block">
            View external diagram ↗
          </a>
        )}
        <div className="text-xs text-muted-foreground">
          Owner: {arch.owner?.name ?? arch.owner?.email ?? "—"}
        </div>

        <Separator />

        <div>
          <p className="text-xs font-medium text-foreground mb-2">
            Components <span className="text-muted-foreground">({arch.components.length})</span>
          </p>
          {arch.components.length === 0 ? (
            <p className="text-xs text-muted-foreground mb-3">No components yet.</p>
          ) : (
            <div className="space-y-3 mb-3">
              {LAYERS.filter((l) => grouped.has(l)).map((layer) => (
                <div key={layer}>
                  <p className="text-[10px] font-medium uppercase text-muted-foreground mb-1">{layer}</p>
                  <ul className="space-y-1">
                    {grouped.get(layer)!.map((c) => (
                      <li key={c.productId} className="text-xs p-2 bg-muted/30 rounded flex items-center justify-between gap-2">
                        <span className="flex-1">
                          <span className="font-medium">{c.product.name}</span>
                          {c.version && <span className="text-muted-foreground ml-1">{c.version.version}</span>}
                          <span className="text-muted-foreground ml-2">· {c.role}</span>
                        </span>
                        <button
                          onClick={() => removeComponentMutation.mutate({ architectureId: archId, productId: c.productId })}
                          className="text-muted-foreground hover:text-rose-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <div className="rounded border border-dashed border-border p-2 space-y-2">
            <p className="text-[10px] uppercase text-muted-foreground">Add component</p>
            <Select value={newProductId || "__none__"} onValueChange={(v) => setNewProductId(!v || v === "__none__" ? "" : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Product" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Pick a product…</SelectItem>
                {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Select value={newLayer} onValueChange={(v) => setNewLayer(v as TechLayer)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LAYERS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as TechRole)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={!newProductId || addComponentMutation.isPending}
              onClick={() => {
                if (!newProductId) return;
                addComponentMutation.mutate({
                  architectureId: archId,
                  productId: newProductId,
                  layer: newLayer,
                  role: newRole,
                });
                setNewProductId("");
              }}
            >
              Add
            </Button>
          </div>
        </div>

        <Separator />

        <div className="flex items-center gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Edit2 className="h-3 w-3 mr-1" /> Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-rose-600 hover:text-rose-700"
            onClick={() => {
              if (confirm(`Archive reference architecture "${arch.name}"?`))
                deleteMutation.mutate({ id: arch.id });
            }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-3 w-3 mr-1" /> Archive
          </Button>
        </div>
      </div>
    </>
  );
}

function RefArchFormModal({
  open,
  editingId,
  onClose,
}: {
  open: boolean;
  editingId: string | null;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: users = [] } = trpc.workspace.listUsers.useQuery();
  const { data: existing } = trpc.referenceArchitecture.getById.useQuery(
    { id: editingId! },
    { enabled: !!editingId }
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<RefArchStatus>("DRAFT");
  const [ownerId, setOwnerId] = useState("");
  const [diagramUrl, setDiagramUrl] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editingId && existing) {
      setName(existing.name);
      setDescription(existing.description ?? "");
      setCategory(existing.category ?? "");
      setStatus(existing.status as RefArchStatus);
      setOwnerId(existing.ownerId ?? "");
      setDiagramUrl(existing.diagramUrl ?? "");
    } else if (!editingId) {
      setName("");
      setDescription("");
      setCategory("");
      setStatus("DRAFT");
      setOwnerId("");
      setDiagramUrl("");
    }
  }, [open, editingId, existing]);

  const createMutation = trpc.referenceArchitecture.create.useMutation({
    onSuccess: () => {
      toast.success("Reference architecture created");
      utils.referenceArchitecture.list.invalidate();
      utils.techArchitecture.kpis.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.referenceArchitecture.update.useMutation({
    onSuccess: () => {
      toast.success("Reference architecture updated");
      utils.referenceArchitecture.list.invalidate();
      if (editingId) utils.referenceArchitecture.getById.invalidate({ id: editingId });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name,
      description: description || null,
      category: category || null,
      status,
      ownerId: ownerId || null,
      diagramUrl: diagramUrl || null,
    };
    if (editingId) updateMutation.mutate({ id: editingId, ...payload });
    else createMutation.mutate(payload);
  }

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingId ? "Edit Reference Architecture" : "New Reference Architecture"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="ra-name">Name *</Label>
            <Input id="ra-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div>
            <Label htmlFor="ra-desc">Description</Label>
            <Textarea id="ra-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ra-cat">Category</Label>
              <Input id="ra-cat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Web App, Data Pipeline…" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as RefArchStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Owner</Label>
              <Select value={ownerId || "__none__"} onValueChange={(v) => setOwnerId(!v || v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name ?? u.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="ra-url">Diagram URL</Label>
              <Input id="ra-url" value={diagramUrl} onChange={(e) => setDiagramUrl(e.target.value)} placeholder="https://…" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editingId ? "Save Changes" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
