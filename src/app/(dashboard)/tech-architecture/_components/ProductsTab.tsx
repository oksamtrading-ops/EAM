"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Package, Trash2, Edit2, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TYPES = [
  "SOFTWARE",
  "CLOUD_SERVICE",
  "DATABASE",
  "MIDDLEWARE",
  "SERVER",
  "NETWORK",
  "OPERATING_SYSTEM",
  "LANGUAGE",
  "FRAMEWORK",
  "PLATFORM",
  "LIBRARY",
  "CONTAINER",
  "OTHER",
] as const;
const LICENSES = [
  "COMMERCIAL",
  "OSS_PERMISSIVE",
  "OSS_COPYLEFT",
  "PROPRIETARY_INTERNAL",
  "FREEMIUM",
  "UNKNOWN",
] as const;

type TechType = (typeof TYPES)[number];
type LicenseType = (typeof LICENSES)[number];

export function ProductsTab() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [vendorFilter, setVendorFilter] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: products = [], isLoading } = trpc.technologyProduct.list.useQuery({
    search: search || undefined,
    type: (typeFilter || undefined) as TechType | undefined,
    vendorId: vendorFilter || undefined,
  });
  const { data: vendors = [] } = trpc.vendor.list.useQuery();

  const selected = useMemo(() => products.find((p) => p.id === selectedId) ?? null, [products, selectedId]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={typeFilter || "__all__"} onValueChange={(v) => setTypeFilter(!v || v === "__all__" ? "" : v)}>
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All types</SelectItem>
            {TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={vendorFilter || "__all__"} onValueChange={(v) => setVendorFilter(!v || v === "__all__" ? "" : v)}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue placeholder="All vendors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All vendors</SelectItem>
            {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Button size="sm" onClick={() => { setEditingId(null); setShowForm(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New Product
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-1">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 rounded bg-muted/40 animate-pulse" />)}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center">
          <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">No products yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add a technology product tied to a vendor.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">Name</th>
                <th className="text-left font-medium px-3 py-2">Vendor</th>
                <th className="text-left font-medium px-3 py-2">Type</th>
                <th className="text-left font-medium px-3 py-2">License</th>
                <th className="text-right font-medium px-3 py-2">Versions</th>
                <th className="text-right font-medium px-3 py-2">Components</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} onClick={() => setSelectedId(p.id)} className="border-t border-border hover:bg-muted/30 cursor-pointer">
                  <td className="px-3 py-2 font-medium">
                    {p.name}
                    {p.openSource && <Badge variant="outline" className="ml-2 text-[9px]">OSS</Badge>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{p.vendor?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{p.type.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{p.licenseType.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{p._count?.versions ?? 0}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{p._count?.components ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(v) => { if (!v) setSelectedId(null); }}>
        <SheetContent className="w-full sm:!max-w-md overflow-y-auto">
          {selected && (
            <ProductDetail
              productId={selected.id}
              onEdit={() => { setEditingId(selected.id); setShowForm(true); }}
              onDeleted={() => setSelectedId(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      <ProductFormModal
        open={showForm}
        editingId={editingId}
        onClose={() => { setShowForm(false); setEditingId(null); }}
      />
    </div>
  );
}

function ProductDetail({ productId, onEdit, onDeleted }: { productId: string; onEdit: () => void; onDeleted: () => void }) {
  const utils = trpc.useUtils();
  const { data: product } = trpc.technologyProduct.getById.useQuery({ id: productId });
  const deleteMutation = trpc.technologyProduct.delete.useMutation({
    onSuccess: () => {
      toast.success("Product archived");
      utils.technologyProduct.list.invalidate();
      utils.techArchitecture.kpis.invalidate();
      onDeleted();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!product) {
    return <div className="p-6"><div className="h-5 w-1/2 bg-muted/40 animate-pulse rounded" /></div>;
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{product.name}</SheetTitle>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-[10px]">{product.type.replace(/_/g, " ")}</Badge>
          <span className="text-xs text-muted-foreground">{product.vendor?.name}</span>
        </div>
      </SheetHeader>
      <div className="px-4 space-y-4">
        {product.description && <p className="text-sm text-muted-foreground">{product.description}</p>}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div><p className="text-muted-foreground">Category</p><p>{product.category ?? "—"}</p></div>
          <div><p className="text-muted-foreground">License</p><p>{product.licenseType.replace(/_/g, " ")}</p></div>
          <div><p className="text-muted-foreground">Open Source</p><p>{product.openSource ? "Yes" : "No"}</p></div>
          <div><p className="text-muted-foreground">Website</p><p>{product.website ? <a href={product.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Link <ExternalLink className="h-3 w-3" /></a> : "—"}</p></div>
        </div>

        <Separator />

        <div>
          <p className="text-xs font-medium mb-2">Versions <span className="text-muted-foreground">({product.versions.length})</span></p>
          {product.versions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No versions tracked.</p>
          ) : (
            <ul className="space-y-1">
              {product.versions.map((v) => (
                <li key={v.id} className="text-xs p-2 bg-muted/30 rounded flex items-center justify-between gap-2">
                  <span className="font-mono">{v.version}</span>
                  <Badge variant="outline" className="text-[9px]">{v.lifecycleStatus.replace(/_/g, " ")}</Badge>
                  <span className="text-muted-foreground">
                    {v.endOfLifeDate ? `EOL ${new Date(v.endOfLifeDate).toLocaleDateString()}` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Separator />

        <div>
          <p className="text-xs font-medium mb-2">Components <span className="text-muted-foreground">({product.components.length})</span></p>
          {product.components.length === 0 ? (
            <p className="text-xs text-muted-foreground">No deployed components.</p>
          ) : (
            <ul className="space-y-1">
              {product.components.map((c) => (
                <li key={c.id} className="text-xs p-2 bg-muted/30 rounded flex items-center justify-between gap-2">
                  <span>{c.name}</span>
                  <span className="text-muted-foreground">
                    {c.environment} · {c._count.applications} apps
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Separator />
        <ProductDependenciesSection productId={product.id} />


        <div className="flex items-center gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={onEdit}><Edit2 className="h-3 w-3 mr-1" /> Edit</Button>
          <Button size="sm" variant="outline" className="text-rose-600 hover:text-rose-700" onClick={() => {
            if (confirm(`Archive product "${product.name}"?`)) deleteMutation.mutate({ id: product.id });
          }} disabled={deleteMutation.isPending}>
            <Trash2 className="h-3 w-3 mr-1" /> Archive
          </Button>
        </div>
      </div>
    </>
  );
}

function ProductFormModal({ open, editingId, onClose }: { open: boolean; editingId: string | null; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: vendors = [] } = trpc.vendor.list.useQuery();
  const { data: existing } = trpc.technologyProduct.getById.useQuery(
    { id: editingId! },
    { enabled: !!editingId }
  );

  const [name, setName] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [type, setType] = useState<TechType>("OTHER");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [openSource, setOpenSource] = useState(false);
  const [licenseType, setLicenseType] = useState<LicenseType>("UNKNOWN");

  useEffect(() => {
    if (!open) return;
    if (editingId && existing) {
      setName(existing.name);
      setVendorId(existing.vendorId);
      setType(existing.type as TechType);
      setCategory(existing.category ?? "");
      setDescription(existing.description ?? "");
      setWebsite(existing.website ?? "");
      setOpenSource(existing.openSource);
      setLicenseType(existing.licenseType as LicenseType);
    } else if (!editingId) {
      setName("");
      setVendorId("");
      setType("OTHER");
      setCategory("");
      setDescription("");
      setWebsite("");
      setOpenSource(false);
      setLicenseType("UNKNOWN");
    }
  }, [open, editingId, existing]);

  const createMutation = trpc.technologyProduct.create.useMutation({
    onSuccess: () => {
      toast.success("Product created");
      utils.technologyProduct.list.invalidate();
      utils.techArchitecture.kpis.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.technologyProduct.update.useMutation({
    onSuccess: () => {
      toast.success("Product updated");
      utils.technologyProduct.list.invalidate();
      if (editingId) utils.technologyProduct.getById.invalidate({ id: editingId });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vendorId) {
      toast.error("Select a vendor");
      return;
    }
    const payload = {
      vendorId,
      name,
      type,
      category: category || null,
      description: description || null,
      website: website || null,
      openSource,
      licenseType,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editingId ? "Edit Product" : "New Product"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="p-name">Name *</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div>
            <Label>Vendor *</Label>
            <Select value={vendorId || "__none__"} onValueChange={(v) => setVendorId(!v || v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Select a vendor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select a vendor</SelectItem>
                {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as TechType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>License</Label>
              <Select value={licenseType} onValueChange={(v) => setLicenseType(v as LicenseType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LICENSES.map((l) => <SelectItem key={l} value={l}>{l.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="p-cat">Category</Label>
            <Input id="p-cat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Relational DB" />
          </div>
          <div>
            <Label htmlFor="p-desc">Description</Label>
            <Textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div>
            <Label htmlFor="p-web">Website</Label>
            <Input id="p-web" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="p-oss" checked={openSource} onCheckedChange={(v) => setOpenSource(!!v)} />
            <Label htmlFor="p-oss" className="cursor-pointer">Open source</Label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editingId ? "Save Changes" : "Create Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const DEPENDENCY_TYPES = [
  "REQUIRES",
  "RUNS_ON",
  "COMPATIBLE_WITH",
  "CONFLICTS_WITH",
  "REPLACES",
] as const;
type DependencyType = (typeof DEPENDENCY_TYPES)[number];

function ProductDependenciesSection({ productId }: { productId: string }) {
  const utils = trpc.useUtils();
  const { data: graph } = trpc.technologyDependency.graphForProduct.useQuery({ productId });
  const { data: allProducts = [] } = trpc.technologyProduct.list.useQuery({});
  const [targetId, setTargetId] = useState("");
  const [depType, setDepType] = useState<DependencyType>("REQUIRES");

  const createMutation = trpc.technologyDependency.create.useMutation({
    onSuccess: () => {
      toast.success("Dependency added");
      utils.technologyDependency.graphForProduct.invalidate({ productId });
      utils.technologyProduct.getById.invalidate({ id: productId });
      setTargetId("");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.technologyDependency.delete.useMutation({
    onSuccess: () => {
      toast.success("Dependency removed");
      utils.technologyDependency.graphForProduct.invalidate({ productId });
      utils.technologyProduct.getById.invalidate({ id: productId });
    },
    onError: (e) => toast.error(e.message),
  });

  const upstream = graph?.upstream ?? [];
  const downstream = graph?.downstream ?? [];
  const existingTargetIds = new Set(downstream.map((d) => d.targetProduct.id));
  existingTargetIds.add(productId);

  return (
    <div>
      <p className="text-xs font-medium mb-2">Dependencies</p>
      {downstream.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] text-muted-foreground uppercase mb-1">Depends on</p>
          <ul className="space-y-0.5">
            {downstream.map((d) => (
              <li key={d.id} className="text-xs flex items-center gap-2 group">
                <Badge variant="outline" className="text-[9px]">{d.dependencyType.replace(/_/g, " ")}</Badge>
                <span className="flex-1">{d.targetProduct.name}</span>
                <button
                  onClick={() => deleteMutation.mutate({ id: d.id })}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {upstream.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] text-muted-foreground uppercase mb-1">Depended on by</p>
          <ul className="space-y-0.5">
            {upstream.map((d) => (
              <li key={d.id} className="text-xs flex items-center gap-2">
                <Badge variant="outline" className="text-[9px]">{d.dependencyType.replace(/_/g, " ")}</Badge>
                <span>{d.sourceProduct.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded border border-dashed border-border p-2 space-y-1.5 mt-2">
        <p className="text-[10px] uppercase text-muted-foreground">Add dependency</p>
        <Select value={targetId || "__none__"} onValueChange={(v) => setTargetId(!v || v === "__none__" ? "" : v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Depends on…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Choose a product…</SelectItem>
            {allProducts.filter((p) => !existingTargetIds.has(p.id)).map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1.5">
          <Select value={depType} onValueChange={(v) => setDepType(v as DependencyType)}>
            <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DEPENDENCY_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            disabled={!targetId || createMutation.isPending}
            onClick={() => createMutation.mutate({
              sourceProductId: productId,
              targetProductId: targetId,
              dependencyType: depType,
            })}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
