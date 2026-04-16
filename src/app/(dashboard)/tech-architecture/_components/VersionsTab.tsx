"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, History, Trash2, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { LifecycleHeatmap } from "./LifecycleHeatmap";

const LIFECYCLES = [
  "PREVIEW",
  "CURRENT",
  "MAINSTREAM",
  "EXTENDED_SUPPORT",
  "DEPRECATED",
  "END_OF_LIFE",
] as const;

type Lifecycle = (typeof LIFECYCLES)[number];

function lifecycleColor(s: string) {
  switch (s) {
    case "PREVIEW":
      return "bg-purple-100 text-purple-700 border-purple-200";
    case "CURRENT":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "MAINSTREAM":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "EXTENDED_SUPPORT":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "DEPRECATED":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "END_OF_LIFE":
      return "bg-rose-100 text-rose-700 border-rose-200";
    default:
      return "bg-muted";
  }
}

function daysUntil(date: Date | null | undefined): number | null {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

export function VersionsTab() {
  const [lifecycle, setLifecycle] = useState<string>("");
  const [productFilter, setProductFilter] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: versions = [], isLoading } = trpc.technologyVersion.list.useQuery({
    lifecycleStatus: (lifecycle || undefined) as Lifecycle | undefined,
    productId: productFilter || undefined,
  });
  const { data: products = [] } = trpc.technologyProduct.list.useQuery();

  const selected = useMemo(() => versions.find((v) => v.id === selectedId) ?? null, [versions, selectedId]);

  return (
    <div className="space-y-3">
      <LifecycleHeatmap />
      <div className="flex flex-wrap items-center gap-2">
        <Select value={lifecycle || "__all__"} onValueChange={(v) => setLifecycle(!v || v === "__all__" ? "" : v)}>
          <SelectTrigger className="h-8 w-[170px] text-xs">
            <SelectValue placeholder="All lifecycles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All lifecycles</SelectItem>
            {LIFECYCLES.map((l) => <SelectItem key={l} value={l}>{l.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={productFilter || "__all__"} onValueChange={(v) => setProductFilter(!v || v === "__all__" ? "" : v)}>
          <SelectTrigger className="h-8 w-[200px] text-xs">
            <SelectValue placeholder="All products" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All products</SelectItem>
            {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Button size="sm" onClick={() => { setEditingId(null); setShowForm(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New Version
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-1">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 rounded bg-muted/40 animate-pulse" />)}</div>
      ) : versions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center">
          <History className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">No versions yet</p>
          <p className="text-xs text-muted-foreground mt-1">Track lifecycle dates for each product version.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">Product</th>
                <th className="text-left font-medium px-3 py-2">Version</th>
                <th className="text-left font-medium px-3 py-2">Lifecycle</th>
                <th className="text-left font-medium px-3 py-2">Release</th>
                <th className="text-left font-medium px-3 py-2">EOS</th>
                <th className="text-left font-medium px-3 py-2">EOL</th>
                <th className="text-right font-medium px-3 py-2">Days to EOL</th>
                <th className="text-right font-medium px-3 py-2">Components</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => {
                const days = daysUntil(v.endOfLifeDate);
                return (
                  <tr key={v.id} onClick={() => setSelectedId(v.id)} className="border-t border-border hover:bg-muted/30 cursor-pointer">
                    <td className="px-3 py-2 font-medium">{v.product.name}</td>
                    <td className="px-3 py-2 font-mono text-xs">{v.version}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={`text-[10px] ${lifecycleColor(v.lifecycleStatus)}`}>
                        {v.lifecycleStatus.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs">{v.releaseDate ? new Date(v.releaseDate).toLocaleDateString() : "—"}</td>
                    <td className="px-3 py-2 text-xs">{v.endOfSupportDate ? new Date(v.endOfSupportDate).toLocaleDateString() : "—"}</td>
                    <td className="px-3 py-2 text-xs">{v.endOfLifeDate ? new Date(v.endOfLifeDate).toLocaleDateString() : "—"}</td>
                    <td className={`px-3 py-2 text-xs text-right tabular-nums ${days !== null && days < 0 ? "text-rose-600 font-medium" : days !== null && days <= 90 ? "text-amber-600 font-medium" : ""}`}>
                      {days === null ? "—" : days < 0 ? `past (${Math.abs(days)}d)` : `${days}d`}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{v._count?.components ?? 0}</td>
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
            <VersionDetail
              versionId={selected.id}
              onEdit={() => { setEditingId(selected.id); setShowForm(true); }}
              onDeleted={() => setSelectedId(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      <VersionFormModal
        open={showForm}
        editingId={editingId}
        onClose={() => { setShowForm(false); setEditingId(null); }}
      />
    </div>
  );
}

function VersionDetail({ versionId, onEdit, onDeleted }: { versionId: string; onEdit: () => void; onDeleted: () => void }) {
  const utils = trpc.useUtils();
  const { data: version } = trpc.technologyVersion.getById.useQuery({ id: versionId });
  const deleteMutation = trpc.technologyVersion.delete.useMutation({
    onSuccess: () => {
      toast.success("Version archived");
      utils.technologyVersion.list.invalidate();
      utils.techArchitecture.kpis.invalidate();
      onDeleted();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!version) return <div className="p-6"><div className="h-5 w-1/2 bg-muted/40 animate-pulse rounded" /></div>;

  return (
    <>
      <SheetHeader>
        <SheetTitle>{version.product.name} <span className="font-mono text-sm text-muted-foreground">{version.version}</span></SheetTitle>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className={`text-[10px] ${lifecycleColor(version.lifecycleStatus)}`}>
            {version.lifecycleStatus.replace(/_/g, " ")}
          </Badge>
        </div>
      </SheetHeader>
      <div className="px-4 space-y-4">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div><p className="text-muted-foreground">Release Date</p><p>{version.releaseDate ? new Date(version.releaseDate).toLocaleDateString() : "—"}</p></div>
          <div><p className="text-muted-foreground">End of Support</p><p>{version.endOfSupportDate ? new Date(version.endOfSupportDate).toLocaleDateString() : "—"}</p></div>
          <div><p className="text-muted-foreground">End of Life</p><p>{version.endOfLifeDate ? new Date(version.endOfLifeDate).toLocaleDateString() : "—"}</p></div>
          <div><p className="text-muted-foreground">Vendor</p><p>{version.product.vendor?.name ?? "—"}</p></div>
        </div>
        {version.notes && <div><p className="text-xs text-muted-foreground mb-1">Notes</p><p className="text-xs whitespace-pre-wrap">{version.notes}</p></div>}
        <div>
          <p className="text-xs font-medium mb-2">Deployed Components <span className="text-muted-foreground">({version.components.length})</span></p>
          {version.components.length === 0 ? (
            <p className="text-xs text-muted-foreground">None.</p>
          ) : (
            <ul className="space-y-1">
              {version.components.map((c) => (
                <li key={c.id} className="text-xs p-2 bg-muted/30 rounded flex items-center justify-between">
                  <span>{c.name}</span>
                  <span className="text-muted-foreground">{c.environment}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={onEdit}><Edit2 className="h-3 w-3 mr-1" /> Edit</Button>
          <Button size="sm" variant="outline" className="text-rose-600 hover:text-rose-700" onClick={() => {
            if (confirm(`Archive version "${version.version}"?`)) deleteMutation.mutate({ id: version.id });
          }} disabled={deleteMutation.isPending}>
            <Trash2 className="h-3 w-3 mr-1" /> Archive
          </Button>
        </div>
      </div>
    </>
  );
}

function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

function VersionFormModal({ open, editingId, onClose }: { open: boolean; editingId: string | null; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: products = [] } = trpc.technologyProduct.list.useQuery();
  const { data: existing } = trpc.technologyVersion.getById.useQuery(
    { id: editingId! },
    { enabled: !!editingId }
  );

  const [productId, setProductId] = useState("");
  const [version, setVersion] = useState("");
  const [release, setRelease] = useState("");
  const [eos, setEos] = useState("");
  const [eol, setEol] = useState("");
  const [lifecycleStatus, setLifecycleStatus] = useState<Lifecycle>("CURRENT");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editingId && existing) {
      setProductId(existing.productId);
      setVersion(existing.version);
      setRelease(toDateInput(existing.releaseDate));
      setEos(toDateInput(existing.endOfSupportDate));
      setEol(toDateInput(existing.endOfLifeDate));
      setLifecycleStatus(existing.lifecycleStatus as Lifecycle);
      setNotes(existing.notes ?? "");
    } else if (!editingId) {
      setProductId("");
      setVersion("");
      setRelease("");
      setEos("");
      setEol("");
      setLifecycleStatus("CURRENT");
      setNotes("");
    }
  }, [open, editingId, existing]);

  const createMutation = trpc.technologyVersion.create.useMutation({
    onSuccess: () => {
      toast.success("Version created");
      utils.technologyVersion.list.invalidate();
      utils.techArchitecture.kpis.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.technologyVersion.update.useMutation({
    onSuccess: () => {
      toast.success("Version updated");
      utils.technologyVersion.list.invalidate();
      if (editingId) utils.technologyVersion.getById.invalidate({ id: editingId });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) { toast.error("Select a product"); return; }
    const basePayload = {
      version,
      releaseDate: release ? new Date(release) : null,
      endOfSupportDate: eos ? new Date(eos) : null,
      endOfLifeDate: eol ? new Date(eol) : null,
      lifecycleStatus,
      notes: notes || null,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...basePayload });
    } else {
      createMutation.mutate({ productId, ...basePayload });
    }
  }

  const pending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editingId ? "Edit Version" : "New Version"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Product *</Label>
            <Select value={productId || "__none__"} onValueChange={(v) => setProductId(!v || v === "__none__" ? "" : v)} disabled={!!editingId}>
              <SelectTrigger><SelectValue placeholder="Select a product" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select a product</SelectItem>
                {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="v-ver">Version *</Label>
            <Input id="v-ver" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="e.g. 17.0.2, 2024-LTS" required autoFocus />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="v-rel">Release</Label>
              <Input id="v-rel" type="date" value={release} onChange={(e) => setRelease(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="v-eos">EOS</Label>
              <Input id="v-eos" type="date" value={eos} onChange={(e) => setEos(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="v-eol">EOL</Label>
              <Input id="v-eol" type="date" value={eol} onChange={(e) => setEol(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Lifecycle Status</Label>
            <Select value={lifecycleStatus} onValueChange={(v) => setLifecycleStatus(v as Lifecycle)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LIFECYCLES.map((l) => <SelectItem key={l} value={l}>{l.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="v-notes">Notes</Label>
            <Textarea id="v-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editingId ? "Save Changes" : "Create Version"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
