"use client";

import { useMemo, useState } from "react";
import { Plus, Building2, Trash2 } from "lucide-react";
import { TabFilters } from "./TabFilters";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";

const CATEGORIES = [
  "HYPERSCALER",
  "SOFTWARE",
  "HARDWARE",
  "SERVICES",
  "OPEN_SOURCE_FOUNDATION",
  "INTERNAL",
  "OTHER",
] as const;
const STATUSES = ["ACTIVE", "STRATEGIC", "UNDER_REVIEW", "EXITING", "DEPRECATED"] as const;

type VendorCategory = (typeof CATEGORIES)[number];
type VendorStatus = (typeof STATUSES)[number];

function statusColor(s: string): string {
  switch (s) {
    case "STRATEGIC":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "ACTIVE":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "UNDER_REVIEW":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "EXITING":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "DEPRECATED":
      return "bg-rose-100 text-rose-700 border-rose-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function VendorsTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: vendors = [], isLoading } = trpc.vendor.list.useQuery({
    search: search || undefined,
    status: (statusFilter || undefined) as VendorStatus | undefined,
    category: (categoryFilter || undefined) as VendorCategory | undefined,
  });

  const selected = useMemo(
    () => vendors.find((v) => v.id === selectedId) ?? null,
    [vendors, selectedId]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <TabFilters
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search vendors…"
          groups={[
            {
              key: "status",
              label: "Status",
              options: STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") })),
            },
            {
              key: "category",
              label: "Category",
              options: CATEGORIES.map((c) => ({ value: c, label: c.replace(/_/g, " ") })),
            },
          ]}
          values={{ status: statusFilter, category: categoryFilter }}
          onValuesChange={(next) => {
            setStatusFilter(next.status);
            setCategoryFilter(next.category);
          }}
        />
        <div className="ml-auto">
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New Vendor
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : vendors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-10 text-center">
          <Building2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">No vendors yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Create your first vendor to start cataloging technology products.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">Name</th>
                <th className="text-left font-medium px-3 py-2">Category</th>
                <th className="text-left font-medium px-3 py-2">Status</th>
                <th className="text-right font-medium px-3 py-2">Products</th>
                <th className="text-right font-medium px-3 py-2">Annual Spend</th>
                <th className="text-left font-medium px-3 py-2">Owner</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr
                  key={v.id}
                  onClick={() => setSelectedId(v.id)}
                  className="border-t border-border hover:bg-muted/30 cursor-pointer"
                >
                  <td className="px-3 py-2 font-medium text-foreground">{v.name}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {v.category.replace(/_/g, " ")}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={`text-[10px] ${statusColor(v.status)}`}>
                      {v.status.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{v._count?.products ?? 0}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">
                    {v.annualSpend ? `${v.currency} ${Number(v.annualSpend).toLocaleString()}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {v.relationshipOwner?.name ?? v.relationshipOwner?.email ?? "—"}
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
            <VendorDetail
              vendorId={selected.id}
              onDeleted={() => setSelectedId(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      <VendorFormModal
        open={showForm}
        onClose={() => setShowForm(false)}
      />
    </div>
  );
}

function VendorDetail({ vendorId, onDeleted }: { vendorId: string; onDeleted: () => void }) {
  const utils = trpc.useUtils();
  const { data: vendor } = trpc.vendor.getById.useQuery({ id: vendorId });
  const { data: users = [] } = trpc.workspace.listUsers.useQuery();

  const updateMutation = trpc.vendor.update.useMutation({
    onSuccess: () => {
      utils.vendor.list.invalidate();
      utils.vendor.getById.invalidate({ id: vendorId });
      utils.techArchitecture.kpis.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.vendor.delete.useMutation({
    onSuccess: () => {
      toast.success("Vendor archived");
      utils.vendor.list.invalidate();
      utils.techArchitecture.kpis.invalidate();
      onDeleted();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!vendor) {
    return (
      <div className="p-6">
        <div className="h-6 bg-muted/40 animate-pulse rounded w-1/2 mb-3" />
        <div className="h-4 bg-muted/40 animate-pulse rounded w-3/4" />
      </div>
    );
  }

  const save = (patch: Omit<Parameters<typeof updateMutation.mutate>[0], "id">) =>
    updateMutation.mutate({ ...patch, id: vendor.id });

  return (
    <>
      <SheetHeader>
        <SheetTitle>{vendor.name}</SheetTitle>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className={`text-[10px] ${statusColor(vendor.status)}`}>
            {vendor.status.replace(/_/g, " ")}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {vendor.category.replace(/_/g, " ")}
          </span>
        </div>
      </SheetHeader>
      <div className="px-4 space-y-4">
        <CollapsibleSection title="Identity" defaultOpen>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Name</label>
              <Input
                defaultValue={vendor.name}
                className="h-8 text-xs"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== vendor.name) save({ name: v });
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Category</label>
                <Select value={vendor.category} onValueChange={(v) => save({ category: v as VendorCategory })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                <Select value={vendor.status} onValueChange={(v) => save({ status: v as VendorStatus })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Website</label>
              <Input
                defaultValue={vendor.website ?? ""}
                placeholder="https://…"
                className="h-8 text-xs"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (vendor.website ?? "")) save({ website: v || null });
                }}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Description</label>
              <Textarea
                defaultValue={vendor.description ?? ""}
                rows={2}
                onBlur={(e) => {
                  if (e.target.value !== (vendor.description ?? "")) save({ description: e.target.value || null });
                }}
              />
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Commercial" defaultOpen>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">HQ Country</label>
              <Input
                defaultValue={vendor.headquartersCountry ?? ""}
                placeholder="USA"
                className="h-8 text-xs"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (vendor.headquartersCountry ?? "")) save({ headquartersCountry: v || null });
                }}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Annual Spend</label>
              <Input
                type="number"
                defaultValue={vendor.annualSpend ? Number(vendor.annualSpend) : ""}
                className="h-8 text-xs"
                onBlur={(e) => {
                  const n = parseFloat(e.target.value);
                  save({ annualSpend: isNaN(n) ? null : n });
                }}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Currency</label>
              <Input
                defaultValue={vendor.currency}
                maxLength={3}
                className="h-8 text-xs"
                onBlur={(e) => {
                  const v = e.target.value.toUpperCase();
                  if (v && v !== vendor.currency) save({ currency: v });
                }}
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="text-xs text-muted-foreground mb-1 block">Contract Notes</label>
            <Textarea
              defaultValue={vendor.contractNotes ?? ""}
              rows={2}
              onBlur={(e) => {
                if (e.target.value !== (vendor.contractNotes ?? "")) save({ contractNotes: e.target.value || null });
              }}
            />
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Ownership" defaultOpen>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Relationship Owner</label>
            <Select
              value={vendor.relationshipOwnerId ?? "__none__"}
              onValueChange={(v) => save({ relationshipOwnerId: v === "__none__" ? null : v })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="No owner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No owner</SelectItem>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name ?? u.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Linked Products" count={vendor.products.length}>
          {vendor.products.length === 0 ? (
            <p className="text-xs text-muted-foreground">No products yet.</p>
          ) : (
            <ul className="space-y-1">
              {vendor.products.map((p) => (
                <li key={p.id} className="text-xs p-2 bg-muted/30 rounded flex items-center justify-between">
                  <span>{p.name}</span>
                  <span className="text-muted-foreground">
                    {p._count.versions}v · {p._count.components}c
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CollapsibleSection>

        <div className="flex items-center gap-2 pt-2 border-t">
          <Button
            size="sm"
            variant="outline"
            className="text-rose-600 hover:text-rose-700"
            onClick={() => {
              if (confirm(`Archive vendor "${vendor.name}"?`)) {
                deleteMutation.mutate({ id: vendor.id });
              }
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

function VendorFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<VendorCategory>("OTHER");
  const [status, setStatus] = useState<VendorStatus>("ACTIVE");
  const [website, setWebsite] = useState("");

  const createMutation = trpc.vendor.create.useMutation({
    onSuccess: () => {
      toast.success("Vendor created");
      utils.vendor.list.invalidate();
      utils.techArchitecture.kpis.invalidate();
      setName(""); setCategory("OTHER"); setStatus("ACTIVE"); setWebsite("");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      name,
      category,
      status,
      website: website || null,
      description: null,
      headquartersCountry: null,
      annualSpend: null,
      currency: "USD",
      relationshipOwnerId: null,
      contractNotes: null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Vendor</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="v-name">Name *</Label>
            <Input id="v-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as VendorCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as VendorStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="v-web">Website</Label>
            <Input id="v-web" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Additional details (spend, ownership, contract notes) can be filled in on the vendor after creation.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving…" : "Create Vendor"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
