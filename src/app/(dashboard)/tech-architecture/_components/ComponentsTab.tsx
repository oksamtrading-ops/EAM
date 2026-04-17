"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Boxes, Trash2, Edit2, AlertTriangle, Link2, Unlink } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabFilters } from "./TabFilters";

const ENVIRONMENTS = ["PRODUCTION", "STAGING", "TEST", "DEVELOPMENT", "DR", "SHARED"] as const;
const HOSTING_MODELS = ["ON_PREMISES", "PRIVATE_CLOUD", "PUBLIC_IAAS", "PUBLIC_PAAS", "SAAS", "HYBRID"] as const;
const LAYERS = ["PRESENTATION", "APPLICATION", "DATA", "INTEGRATION", "INFRASTRUCTURE", "SECURITY"] as const;
const ROLES = ["PRIMARY", "SECONDARY", "FALLBACK", "DEPRECATED"] as const;
const CRITICALITIES = ["CRITICAL", "IMPORTANT", "STANDARD", "OPTIONAL"] as const;

type Env = (typeof ENVIRONMENTS)[number];
type Hosting = (typeof HOSTING_MODELS)[number];
type Layer = (typeof LAYERS)[number];
type Role = (typeof ROLES)[number];
type Criticality = (typeof CRITICALITIES)[number];

function riskBadge(version: { lifecycleStatus: string; endOfLifeDate: Date | string | null } | null): { label: string; cls: string } | null {
  if (!version) return null;
  const now = Date.now();
  const eol = version.endOfLifeDate ? new Date(version.endOfLifeDate).getTime() : null;
  if (version.lifecycleStatus === "END_OF_LIFE" || (eol && eol < now)) {
    return { label: "EOL", cls: "bg-rose-100 text-rose-700 border-rose-200" };
  }
  if (eol && eol - now <= 90 * 86400000) {
    return { label: "EOL<90d", cls: "bg-amber-100 text-amber-700 border-amber-200" };
  }
  if (version.lifecycleStatus === "DEPRECATED") {
    return { label: "Deprecated", cls: "bg-orange-100 text-orange-700 border-orange-200" };
  }
  return null;
}

export function ComponentsTab() {
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState<string>("");
  const [envFilter, setEnvFilter] = useState<string>("");
  const [hostingFilter, setHostingFilter] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: components = [], isLoading } = trpc.technologyComponent.list.useQuery({
    search: search || undefined,
    productId: productFilter || undefined,
    environment: (envFilter || undefined) as Env | undefined,
    hostingModel: (hostingFilter || undefined) as Hosting | undefined,
  });
  const { data: products = [] } = trpc.technologyProduct.list.useQuery();

  const selected = useMemo(() => components.find((c) => c.id === selectedId) ?? null, [components, selectedId]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <TabFilters
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search components…"
          groups={[
            { key: "product", label: "Product", options: products.map((p) => ({ value: p.id, label: p.name })) },
            { key: "env", label: "Environment", options: ENVIRONMENTS.map((e) => ({ value: e, label: e })) },
            { key: "hosting", label: "Hosting", options: HOSTING_MODELS.map((h) => ({ value: h, label: h.replace(/_/g, " ") })) },
          ]}
          values={{ product: productFilter, env: envFilter, hosting: hostingFilter }}
          onValuesChange={(next) => {
            setProductFilter(next.product);
            setEnvFilter(next.env);
            setHostingFilter(next.hosting);
          }}
        />
        <div className="ml-auto">
          <Button size="sm" onClick={() => { setEditingId(null); setShowForm(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New Component
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-1">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 rounded bg-muted/40 animate-pulse" />)}</div>
      ) : components.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center">
          <Boxes className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">No components yet</p>
          <p className="text-xs text-muted-foreground mt-1">Deploy a product in an environment to create a component.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">Name</th>
                <th className="text-left font-medium px-3 py-2">Product</th>
                <th className="text-left font-medium px-3 py-2">Version</th>
                <th className="text-left font-medium px-3 py-2">Env</th>
                <th className="text-left font-medium px-3 py-2">Hosting</th>
                <th className="text-left font-medium px-3 py-2">Region</th>
                <th className="text-right font-medium px-3 py-2">Apps</th>
                <th className="text-left font-medium px-3 py-2">Risk</th>
              </tr>
            </thead>
            <tbody>
              {components.map((c) => {
                const risk = riskBadge(c.version);
                return (
                  <tr key={c.id} onClick={() => setSelectedId(c.id)} className="border-t border-border hover:bg-muted/30 cursor-pointer">
                    <td className="px-3 py-2 font-medium">{c.name}</td>
                    <td className="px-3 py-2 text-xs">{c.product.name}</td>
                    <td className="px-3 py-2 text-xs font-mono">{c.version?.version ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">{c.environment}</td>
                    <td className="px-3 py-2 text-xs">{c.hostingModel.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{c.region ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c._count?.applications ?? 0}</td>
                    <td className="px-3 py-2">
                      {risk ? (
                        <Badge variant="outline" className={`text-[10px] ${risk.cls}`}>
                          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                          {risk.label}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(v) => { if (!v) setSelectedId(null); }}>
        <SheetContent className="w-full sm:!max-w-md overflow-y-auto">
          {selected && (
            <ComponentDetail
              componentId={selected.id}
              onEdit={() => { setEditingId(selected.id); setShowForm(true); }}
              onDeleted={() => setSelectedId(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      <ComponentFormModal
        open={showForm}
        editingId={editingId}
        onClose={() => { setShowForm(false); setEditingId(null); }}
      />
    </div>
  );
}

function ComponentDetail({ componentId, onEdit, onDeleted }: { componentId: string; onEdit: () => void; onDeleted: () => void }) {
  const utils = trpc.useUtils();
  const { data: component } = trpc.technologyComponent.getById.useQuery({ id: componentId });
  const { data: apps = [] } = trpc.application.list.useQuery();
  const [linkAppId, setLinkAppId] = useState("");
  const [linkLayer, setLinkLayer] = useState<Layer>("APPLICATION");
  const [linkRole, setLinkRole] = useState<Role>("PRIMARY");
  const [linkCriticality, setLinkCriticality] = useState<Criticality>("STANDARD");

  const deleteMutation = trpc.technologyComponent.delete.useMutation({
    onSuccess: () => {
      toast.success("Component archived");
      utils.technologyComponent.list.invalidate();
      utils.techArchitecture.kpis.invalidate();
      onDeleted();
    },
    onError: (e) => toast.error(e.message),
  });
  const linkMutation = trpc.technologyComponent.linkApplication.useMutation({
    onSuccess: () => {
      toast.success("Application linked");
      utils.technologyComponent.getById.invalidate({ id: componentId });
      utils.technologyComponent.list.invalidate();
      utils.techArchitecture.kpis.invalidate();
      setLinkAppId("");
    },
    onError: (e) => toast.error(e.message),
  });
  const unlinkMutation = trpc.technologyComponent.unlinkApplication.useMutation({
    onSuccess: () => {
      toast.success("Application unlinked");
      utils.technologyComponent.getById.invalidate({ id: componentId });
      utils.technologyComponent.list.invalidate();
      utils.techArchitecture.kpis.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!component) return <div className="p-6"><div className="h-5 w-1/2 bg-muted/40 animate-pulse rounded" /></div>;

  const risk = riskBadge(component.version);
  const linkedIds = new Set(component.applications.map((a) => a.applicationId));

  return (
    <>
      <SheetHeader>
        <SheetTitle>{component.name}</SheetTitle>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge variant="outline" className="text-[10px]">{component.product.name}</Badge>
          {component.version && <Badge variant="outline" className="text-[10px] font-mono">{component.version.version}</Badge>}
          <Badge variant="outline" className="text-[10px]">{component.environment}</Badge>
          {risk && (
            <Badge variant="outline" className={`text-[10px] ${risk.cls}`}>
              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
              {risk.label}
            </Badge>
          )}
        </div>
      </SheetHeader>
      <div className="px-4 space-y-4">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div><p className="text-muted-foreground">Hosting</p><p>{component.hostingModel.replace(/_/g, " ")}</p></div>
          <div><p className="text-muted-foreground">Region</p><p>{component.region ?? "—"}</p></div>
          <div><p className="text-muted-foreground">Vendor</p><p>{component.product.vendor?.name ?? "—"}</p></div>
          <div><p className="text-muted-foreground">Owner</p><p>{component.owner?.name ?? component.owner?.email ?? "—"}</p></div>
        </div>
        {component.notes && <div><p className="text-xs text-muted-foreground mb-1">Notes</p><p className="text-xs whitespace-pre-wrap">{component.notes}</p></div>}

        <Separator />

        <div>
          <p className="text-xs font-medium mb-2">
            Applications <span className="text-muted-foreground">({component.applications.length})</span>
          </p>
          <ul className="space-y-1">
            {component.applications.map((link) => (
              <li key={link.applicationId} className="text-xs p-2 bg-muted/30 rounded flex items-center gap-2 group">
                <span className="flex-1 truncate">{link.application.name}</span>
                <Badge variant="outline" className="text-[9px]">{link.layer}</Badge>
                <Badge variant="outline" className="text-[9px]">{link.role}</Badge>
                <Badge variant="outline" className="text-[9px]">{link.criticality}</Badge>
                <button
                  onClick={() => unlinkMutation.mutate({ componentId, applicationId: link.applicationId })}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-500 transition-opacity"
                  aria-label="Unlink"
                >
                  <Unlink className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-3 rounded-lg border border-dashed border-border p-2 space-y-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Link an application</p>
            <Select value={linkAppId || "__none__"} onValueChange={(v) => setLinkAppId(!v || v === "__none__" ? "" : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select an application" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select an application</SelectItem>
                {apps.filter((a) => !linkedIds.has(a.id)).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-3 gap-1.5">
              <Select value={linkLayer} onValueChange={(v) => setLinkLayer(v as Layer)}>
                <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                <SelectContent>{LAYERS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={linkRole} onValueChange={(v) => setLinkRole(v as Role)}>
                <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={linkCriticality} onValueChange={(v) => setLinkCriticality(v as Criticality)}>
                <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                <SelectContent>{CRITICALITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              className="w-full h-7 text-xs"
              disabled={!linkAppId || linkMutation.isPending}
              onClick={() => linkMutation.mutate({
                componentId,
                applicationId: linkAppId,
                layer: linkLayer,
                role: linkRole,
                criticality: linkCriticality,
              })}
            >
              <Link2 className="h-3 w-3 mr-1" /> Link Application
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={onEdit}><Edit2 className="h-3 w-3 mr-1" /> Edit</Button>
          <Button size="sm" variant="outline" className="text-rose-600 hover:text-rose-700" onClick={() => {
            if (confirm(`Archive component "${component.name}"?`)) deleteMutation.mutate({ id: component.id });
          }} disabled={deleteMutation.isPending}>
            <Trash2 className="h-3 w-3 mr-1" /> Archive
          </Button>
        </div>
      </div>
    </>
  );
}

function ComponentFormModal({ open, editingId, onClose }: { open: boolean; editingId: string | null; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: products = [] } = trpc.technologyProduct.list.useQuery();
  const { data: existing } = trpc.technologyComponent.getById.useQuery(
    { id: editingId! },
    { enabled: !!editingId }
  );

  const [productId, setProductId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<Env>("PRODUCTION");
  const [hostingModel, setHostingModel] = useState<Hosting>("ON_PREMISES");
  const [region, setRegion] = useState("");
  const [notes, setNotes] = useState("");

  const { data: versions = [] } = trpc.technologyVersion.list.useQuery(
    { productId: productId || undefined },
    { enabled: !!productId }
  );

  useEffect(() => {
    if (!open) return;
    if (editingId && existing) {
      setProductId(existing.productId);
      setVersionId(existing.versionId ?? "");
      setName(existing.name);
      setEnvironment(existing.environment as Env);
      setHostingModel(existing.hostingModel as Hosting);
      setRegion(existing.region ?? "");
      setNotes(existing.notes ?? "");
    } else if (!editingId) {
      setProductId("");
      setVersionId("");
      setName("");
      setEnvironment("PRODUCTION");
      setHostingModel("ON_PREMISES");
      setRegion("");
      setNotes("");
    }
  }, [open, editingId, existing]);

  const createMutation = trpc.technologyComponent.create.useMutation({
    onSuccess: () => {
      toast.success("Component created");
      utils.technologyComponent.list.invalidate();
      utils.techArchitecture.kpis.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.technologyComponent.update.useMutation({
    onSuccess: () => {
      toast.success("Component updated");
      utils.technologyComponent.list.invalidate();
      if (editingId) utils.technologyComponent.getById.invalidate({ id: editingId });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) { toast.error("Select a product"); return; }
    const payload = {
      productId,
      versionId: versionId || null,
      name,
      environment,
      hostingModel,
      region: region || null,
      notes: notes || null,
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
        <DialogHeader><DialogTitle>{editingId ? "Edit Component" : "New Component"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="c-name">Name *</Label>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Prod Postgres - us-east-1" required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Product *</Label>
              <Select value={productId || "__none__"} onValueChange={(v) => { setProductId(!v || v === "__none__" ? "" : v); setVersionId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select…</SelectItem>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Version</Label>
              <Select value={versionId || "__none__"} onValueChange={(v) => setVersionId(!v || v === "__none__" ? "" : v)} disabled={!productId}>
                <SelectTrigger><SelectValue placeholder="No version" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No version</SelectItem>
                  {versions.map((v) => <SelectItem key={v.id} value={v.id}>{v.version}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Environment</Label>
              <Select value={environment} onValueChange={(v) => setEnvironment(v as Env)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ENVIRONMENTS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Hosting</Label>
              <Select value={hostingModel} onValueChange={(v) => setHostingModel(v as Hosting)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{HOSTING_MODELS.map((h) => <SelectItem key={h} value={h}>{h.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="c-region">Region</Label>
            <Input id="c-region" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. us-east-1" />
          </div>
          <div>
            <Label htmlFor="c-notes">Notes</Label>
            <Textarea id="c-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editingId ? "Save Changes" : "Create Component"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
