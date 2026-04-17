"use client";

import { useMemo, useState } from "react";
import { Plus, History, Trash2 } from "lucide-react";
import { TabFilters } from "./TabFilters";
import { ToolbarActions } from "./ToolbarActions";
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
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { CollapsibleGroup } from "@/components/shared/CollapsibleGroup";

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
      <ToolbarActions>
        <TabFilters
          groups={[
            {
              key: "lifecycle",
              label: "Lifecycle",
              options: LIFECYCLES.map((l) => ({ value: l, label: l.replace(/_/g, " ") })),
            },
            {
              key: "product",
              label: "Product",
              options: products.map((p) => ({ value: p.id, label: p.name })),
            },
          ]}
          values={{ lifecycle, product: productFilter }}
          onValuesChange={(next) => {
            setLifecycle(next.lifecycle);
            setProductFilter(next.product);
          }}
        />
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> New Version
        </Button>
      </ToolbarActions>

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
              onDeleted={() => setSelectedId(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      <VersionFormModal open={showForm} onClose={() => setShowForm(false)} />
    </div>
  );
}

function VersionDetail({ versionId, onDeleted }: { versionId: string; onDeleted: () => void }) {
  const utils = trpc.useUtils();
  const { data: version } = trpc.technologyVersion.getById.useQuery({ id: versionId });
  const updateMutation = trpc.technologyVersion.update.useMutation({
    onSuccess: () => {
      utils.technologyVersion.list.invalidate();
      utils.technologyVersion.getById.invalidate({ id: versionId });
      utils.techArchitecture.kpis.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
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

  const save = (patch: Omit<Parameters<typeof updateMutation.mutate>[0], "id">) =>
    updateMutation.mutate({ ...patch, id: version.id });

  return (
    <>
      <SheetHeader>
        <SheetTitle>{version.product.name} <span className="font-mono text-sm text-muted-foreground">{version.version}</span></SheetTitle>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className={`text-[10px] ${lifecycleColor(version.lifecycleStatus)}`}>
            {version.lifecycleStatus.replace(/_/g, " ")}
          </Badge>
          <span className="text-xs text-muted-foreground">{version.product.vendor?.name ?? ""}</span>
        </div>
      </SheetHeader>
      <div className="px-4 space-y-4">
        <CollapsibleGroup defaultOpenId="identity">
        <CollapsibleSection id="identity" title="Identity" defaultOpen>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Version</label>
              <Input
                defaultValue={version.version}
                className="h-8 text-xs font-mono"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== version.version) save({ version: v });
                }}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Lifecycle status</label>
              <Select value={version.lifecycleStatus} onValueChange={(v) => save({ lifecycleStatus: v as Lifecycle })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LIFECYCLES.map((l) => <SelectItem key={l} value={l}>{l.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
              <Textarea
                defaultValue={version.notes ?? ""}
                rows={2}
                onBlur={(e) => {
                  if (e.target.value !== (version.notes ?? "")) save({ notes: e.target.value || null });
                }}
              />
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection id="lifecycle" title="Lifecycle">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Release</label>
              <Input
                type="date"
                defaultValue={toDateInput(version.releaseDate)}
                className="h-8 text-xs"
                onBlur={(e) => save({ releaseDate: e.target.value ? new Date(e.target.value) : null })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">End of support</label>
              <Input
                type="date"
                defaultValue={toDateInput(version.endOfSupportDate)}
                className="h-8 text-xs"
                onBlur={(e) => save({ endOfSupportDate: e.target.value ? new Date(e.target.value) : null })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">End of life</label>
              <Input
                type="date"
                defaultValue={toDateInput(version.endOfLifeDate)}
                className="h-8 text-xs"
                onBlur={(e) => save({ endOfLifeDate: e.target.value ? new Date(e.target.value) : null })}
              />
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection id="components" title="Deployed Components" count={version.components.length}>
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
        </CollapsibleSection>
        </CollapsibleGroup>

        <div className="flex items-center gap-2 pt-2 border-t">
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

function VersionFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: products = [] } = trpc.technologyProduct.list.useQuery();

  const [productId, setProductId] = useState("");
  const [version, setVersion] = useState("");
  const [lifecycleStatus, setLifecycleStatus] = useState<Lifecycle>("CURRENT");

  const createMutation = trpc.technologyVersion.create.useMutation({
    onSuccess: () => {
      toast.success("Version created");
      utils.technologyVersion.list.invalidate();
      utils.techArchitecture.kpis.invalidate();
      setProductId(""); setVersion(""); setLifecycleStatus("CURRENT");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) { toast.error("Select a product"); return; }
    createMutation.mutate({
      productId,
      version,
      releaseDate: null,
      endOfSupportDate: null,
      endOfLifeDate: null,
      lifecycleStatus,
      notes: null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New Version</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Product *</Label>
            <Select value={productId || "__none__"} onValueChange={(v) => setProductId(!v || v === "__none__" ? "" : v)}>
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
          <div>
            <Label>Lifecycle Status</Label>
            <Select value={lifecycleStatus} onValueChange={(v) => setLifecycleStatus(v as Lifecycle)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LIFECYCLES.map((l) => <SelectItem key={l} value={l}>{l.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Release / EOS / EOL dates and notes can be set on the version after creation.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving…" : "Create Version"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
