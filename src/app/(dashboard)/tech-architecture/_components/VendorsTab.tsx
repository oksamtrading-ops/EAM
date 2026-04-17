"use client";

import { useMemo, useState, useEffect } from "react";
import { Plus, Building2, Trash2, Edit2 } from "lucide-react";
import { TabFilters } from "./TabFilters";
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
  const [editingId, setEditingId] = useState<string | null>(null);
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
          <Button size="sm" onClick={() => { setEditingId(null); setShowForm(true); }}>
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

      {/* Detail sheet */}
      <Sheet open={!!selected} onOpenChange={(v) => { if (!v) setSelectedId(null); }}>
        <SheetContent className="w-full sm:!max-w-md overflow-y-auto">
          {selected && (
            <VendorDetail
              vendorId={selected.id}
              onEdit={() => { setEditingId(selected.id); setShowForm(true); }}
              onDeleted={() => setSelectedId(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Form modal */}
      <VendorFormModal
        open={showForm}
        editingId={editingId}
        onClose={() => { setShowForm(false); setEditingId(null); }}
      />
    </div>
  );
}

function VendorDetail({ vendorId, onEdit, onDeleted }: { vendorId: string; onEdit: () => void; onDeleted: () => void }) {
  const utils = trpc.useUtils();
  const { data: vendor } = trpc.vendor.getById.useQuery({ id: vendorId });
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
        {vendor.description && (
          <p className="text-sm text-muted-foreground">{vendor.description}</p>
        )}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-muted-foreground">Website</p>
            <p>{vendor.website ? <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{vendor.website}</a> : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">HQ Country</p>
            <p>{vendor.headquartersCountry ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Annual Spend</p>
            <p className="tabular-nums">{vendor.annualSpend ? `${vendor.currency} ${Number(vendor.annualSpend).toLocaleString()}` : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Relationship Owner</p>
            <p>{vendor.relationshipOwner?.name ?? vendor.relationshipOwner?.email ?? "—"}</p>
          </div>
        </div>

        {vendor.contractNotes && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Contract Notes</p>
            <p className="text-xs whitespace-pre-wrap">{vendor.contractNotes}</p>
          </div>
        )}

        <Separator />

        <div>
          <p className="text-xs font-medium text-foreground mb-2">
            Products <span className="text-muted-foreground">({vendor.products.length})</span>
          </p>
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
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Edit2 className="h-3 w-3 mr-1" /> Edit
          </Button>
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

function VendorFormModal({
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
  const { data: existing } = trpc.vendor.getById.useQuery(
    { id: editingId! },
    { enabled: !!editingId }
  );

  const [name, setName] = useState("");
  const [category, setCategory] = useState<VendorCategory>("OTHER");
  const [status, setStatus] = useState<VendorStatus>("ACTIVE");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [hq, setHq] = useState("");
  const [spend, setSpend] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [ownerId, setOwnerId] = useState("");
  const [contractNotes, setContractNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editingId && existing) {
      setName(existing.name);
      setCategory(existing.category as VendorCategory);
      setStatus(existing.status as VendorStatus);
      setWebsite(existing.website ?? "");
      setDescription(existing.description ?? "");
      setHq(existing.headquartersCountry ?? "");
      setSpend(existing.annualSpend ? String(existing.annualSpend) : "");
      setCurrency(existing.currency);
      setOwnerId(existing.relationshipOwnerId ?? "");
      setContractNotes(existing.contractNotes ?? "");
    } else if (!editingId) {
      setName("");
      setCategory("OTHER");
      setStatus("ACTIVE");
      setWebsite("");
      setDescription("");
      setHq("");
      setSpend("");
      setCurrency("USD");
      setOwnerId("");
      setContractNotes("");
    }
  }, [open, editingId, existing]);

  const createMutation = trpc.vendor.create.useMutation({
    onSuccess: () => {
      toast.success("Vendor created");
      utils.vendor.list.invalidate();
      utils.techArchitecture.kpis.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.vendor.update.useMutation({
    onSuccess: () => {
      toast.success("Vendor updated");
      utils.vendor.list.invalidate();
      if (editingId) utils.vendor.getById.invalidate({ id: editingId });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name,
      category,
      status,
      website: website || null,
      description: description || null,
      headquartersCountry: hq || null,
      annualSpend: spend ? Number(spend) : null,
      currency,
      relationshipOwnerId: ownerId || null,
      contractNotes: contractNotes || null,
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
        <DialogHeader>
          <DialogTitle>{editingId ? "Edit Vendor" : "New Vendor"}</DialogTitle>
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
          <div>
            <Label htmlFor="v-desc">Description</Label>
            <Textarea id="v-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="v-hq">HQ Country</Label>
              <Input id="v-hq" value={hq} onChange={(e) => setHq(e.target.value)} placeholder="USA" />
            </div>
            <div>
              <Label htmlFor="v-spend">Annual Spend</Label>
              <Input id="v-spend" type="number" value={spend} onChange={(e) => setSpend(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label htmlFor="v-cur">Currency</Label>
              <Input id="v-cur" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
            </div>
          </div>
          <div>
            <Label>Relationship Owner</Label>
            <Select value={ownerId || "__none__"} onValueChange={(v) => setOwnerId(!v || v === "__none__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="No owner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No owner</SelectItem>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name ?? u.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="v-notes">Contract Notes</Label>
            <Textarea id="v-notes" value={contractNotes} onChange={(e) => setContractNotes(e.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editingId ? "Save Changes" : "Create Vendor"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
