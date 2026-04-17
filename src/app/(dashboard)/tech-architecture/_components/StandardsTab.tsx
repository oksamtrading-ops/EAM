"use client";

import { useMemo, useState, useEffect } from "react";
import { Plus, ShieldCheck, Trash2, Edit2 } from "lucide-react";
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

const CATEGORIES = [
  "PRODUCT_CHOICE",
  "VERSION_CHOICE",
  "PROTOCOL",
  "SECURITY",
  "ARCHITECTURE_PATTERN",
  "HOSTING",
  "INTEGRATION",
  "DATA",
  "OTHER",
] as const;
const LEVELS = ["MANDATORY", "RECOMMENDED", "DEPRECATED", "PROHIBITED"] as const;
const STATUSES = ["DRAFT", "ACTIVE", "RETIRED"] as const;

type StandardCategory = (typeof CATEGORIES)[number];
type StandardLevel = (typeof LEVELS)[number];
type StandardStatus = (typeof STATUSES)[number];

function levelColor(l: string) {
  switch (l) {
    case "MANDATORY":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "RECOMMENDED":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "DEPRECATED":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "PROHIBITED":
      return "bg-rose-100 text-rose-700 border-rose-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function statusColor(s: string) {
  switch (s) {
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "DRAFT":
      return "bg-muted text-muted-foreground";
    case "RETIRED":
      return "bg-rose-100 text-rose-700 border-rose-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function toDateInput(d?: Date | string | null): string {
  if (!d) return "";
  try {
    const dt = typeof d === "string" ? new Date(d) : d;
    return dt.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export function StandardsTab() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: items = [], isLoading } = trpc.technologyStandard.list.useQuery({
    search: search || undefined,
    category: (categoryFilter || undefined) as StandardCategory | undefined,
    level: (levelFilter || undefined) as StandardLevel | undefined,
    status: (statusFilter || undefined) as StandardStatus | undefined,
  });

  const selected = useMemo(
    () => items.find((s) => s.id === selectedId) ?? null,
    [items, selectedId]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <TabFilters
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search standards…"
          groups={[
            { key: "category", label: "Category", options: CATEGORIES.map((c) => ({ value: c, label: c.replace(/_/g, " ") })) },
            { key: "level", label: "Level", options: LEVELS.map((l) => ({ value: l, label: l })) },
            { key: "status", label: "Status", options: STATUSES.map((s) => ({ value: s, label: s })) },
          ]}
          values={{ category: categoryFilter, level: levelFilter, status: statusFilter }}
          onValuesChange={(next) => {
            setCategoryFilter(next.category);
            setLevelFilter(next.level);
            setStatusFilter(next.status);
          }}
        />
        <div className="ml-auto">
          <Button size="sm" onClick={() => { setEditingId(null); setShowForm(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New Standard
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center">
          <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">No standards defined</p>
          <p className="text-xs text-muted-foreground mt-1">
            Define the tech choices, levels, and guardrails your architecture should follow.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">Name</th>
                <th className="text-left font-medium px-3 py-2">Category</th>
                <th className="text-left font-medium px-3 py-2">Level</th>
                <th className="text-left font-medium px-3 py-2">Status</th>
                <th className="text-left font-medium px-3 py-2">Target</th>
                <th className="text-left font-medium px-3 py-2">Owner</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className="border-t border-border hover:bg-muted/30 cursor-pointer"
                >
                  <td className="px-3 py-2 font-medium text-foreground">{s.name}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{s.category.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={`text-[10px] ${levelColor(s.level)}`}>{s.level}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={`text-[10px] ${statusColor(s.status)}`}>{s.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {s.version
                      ? `${s.product?.name ?? "?"} ${s.version.version}`
                      : s.product?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {s.owner?.name ?? s.owner?.email ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(v) => { if (!v) setSelectedId(null); }}>
        <SheetContent className="w-full sm:!max-w-md overflow-y-auto">
          {selected && (
            <StandardDetail
              standardId={selected.id}
              onEdit={() => { setEditingId(selected.id); setShowForm(true); }}
              onDeleted={() => setSelectedId(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      <StandardFormModal
        open={showForm}
        editingId={editingId}
        onClose={() => { setShowForm(false); setEditingId(null); }}
      />
    </div>
  );
}

function StandardDetail({ standardId, onEdit, onDeleted }: { standardId: string; onEdit: () => void; onDeleted: () => void }) {
  const utils = trpc.useUtils();
  const { data: s } = trpc.technologyStandard.getById.useQuery({ id: standardId });
  const deleteMutation = trpc.technologyStandard.delete.useMutation({
    onSuccess: () => {
      toast.success("Standard archived");
      utils.technologyStandard.list.invalidate();
      utils.techArchitecture.kpis.invalidate();
      onDeleted();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!s) {
    return (
      <div className="p-6">
        <div className="h-6 bg-muted/40 animate-pulse rounded w-1/2 mb-3" />
        <div className="h-4 bg-muted/40 animate-pulse rounded w-3/4" />
      </div>
    );
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{s.name}</SheetTitle>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className={`text-[10px] ${levelColor(s.level)}`}>{s.level}</Badge>
          <Badge variant="outline" className={`text-[10px] ${statusColor(s.status)}`}>{s.status}</Badge>
          <span className="text-xs text-muted-foreground">{s.category.replace(/_/g, " ")}</span>
        </div>
      </SheetHeader>
      <div className="px-4 space-y-4">
        {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-muted-foreground">Target product</p>
            <p>{s.product?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Target version</p>
            <p>{s.version?.version ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Effective</p>
            <p>{s.effectiveDate ? new Date(s.effectiveDate).toLocaleDateString() : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Review</p>
            <p>{s.reviewDate ? new Date(s.reviewDate).toLocaleDateString() : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Owner</p>
            <p>{s.owner?.name ?? s.owner?.email ?? "—"}</p>
          </div>
        </div>
        {s.rationale && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Rationale</p>
            <p className="text-xs whitespace-pre-wrap">{s.rationale}</p>
          </div>
        )}
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
              if (confirm(`Archive standard "${s.name}"?`)) deleteMutation.mutate({ id: s.id });
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

function StandardFormModal({
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
  const { data: products = [] } = trpc.technologyProduct.list.useQuery({});
  const { data: existing } = trpc.technologyStandard.getById.useQuery(
    { id: editingId! },
    { enabled: !!editingId }
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<StandardCategory>("OTHER");
  const [level, setLevel] = useState<StandardLevel>("RECOMMENDED");
  const [status, setStatus] = useState<StandardStatus>("ACTIVE");
  const [productId, setProductId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [rationale, setRationale] = useState("");

  const { data: selectedProduct } = trpc.technologyProduct.getById.useQuery(
    { id: productId },
    { enabled: !!productId }
  );

  useEffect(() => {
    if (!open) return;
    if (editingId && existing) {
      setName(existing.name);
      setDescription(existing.description ?? "");
      setCategory(existing.category as StandardCategory);
      setLevel(existing.level as StandardLevel);
      setStatus(existing.status as StandardStatus);
      setProductId(existing.productId ?? "");
      setVersionId(existing.versionId ?? "");
      setOwnerId(existing.ownerId ?? "");
      setEffectiveDate(toDateInput(existing.effectiveDate));
      setReviewDate(toDateInput(existing.reviewDate));
      setRationale(existing.rationale ?? "");
    } else if (!editingId) {
      setName("");
      setDescription("");
      setCategory("OTHER");
      setLevel("RECOMMENDED");
      setStatus("ACTIVE");
      setProductId("");
      setVersionId("");
      setOwnerId("");
      setEffectiveDate("");
      setReviewDate("");
      setRationale("");
    }
  }, [open, editingId, existing]);

  const createMutation = trpc.technologyStandard.create.useMutation({
    onSuccess: () => {
      toast.success("Standard created");
      utils.technologyStandard.list.invalidate();
      utils.techArchitecture.kpis.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.technologyStandard.update.useMutation({
    onSuccess: () => {
      toast.success("Standard updated");
      utils.technologyStandard.list.invalidate();
      if (editingId) utils.technologyStandard.getById.invalidate({ id: editingId });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name,
      description: description || null,
      category,
      level,
      status,
      productId: productId || null,
      versionId: versionId || null,
      ownerId: ownerId || null,
      effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
      reviewDate: reviewDate ? new Date(reviewDate) : null,
      rationale: rationale || null,
    };
    if (editingId) updateMutation.mutate({ id: editingId, ...payload });
    else createMutation.mutate(payload);
  }

  const pending = createMutation.isPending || updateMutation.isPending;
  const versions = selectedProduct?.versions ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingId ? "Edit Standard" : "New Standard"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="s-name">Name *</Label>
            <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div>
            <Label htmlFor="s-desc">Description</Label>
            <Textarea id="s-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as StandardCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Level</Label>
              <Select value={level} onValueChange={(v) => setLevel(v as StandardLevel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as StandardStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Target Product</Label>
              <Select value={productId || "__none__"} onValueChange={(v) => { const nv = !v || v === "__none__" ? "" : v; setProductId(nv); setVersionId(""); }}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Target Version</Label>
              <Select
                value={versionId || "__none__"}
                onValueChange={(v) => setVersionId(!v || v === "__none__" ? "" : v)}
                disabled={!productId || versions.length === 0}
              >
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {versions.map((v) => <SelectItem key={v.id} value={v.id}>{v.version}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="s-eff">Effective</Label>
              <Input id="s-eff" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="s-rev">Review</Label>
              <Input id="s-rev" type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
            </div>
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
          </div>
          <div>
            <Label htmlFor="s-rat">Rationale</Label>
            <Textarea id="s-rat" value={rationale} onChange={(e) => setRationale(e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editingId ? "Save Changes" : "Create Standard"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
