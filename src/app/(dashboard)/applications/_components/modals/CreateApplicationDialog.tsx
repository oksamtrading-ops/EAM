"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePicker } from "@/components/shared/DatePicker";
import { toast } from "sonner";
import {
  APP_TYPE_LABELS, LIFECYCLE_LABELS, DEPLOY_LABELS,
  BV_LABELS, BV_COLORS, TH_LABELS, TH_COLORS,
  RAT_LABELS, RAT_COLORS, FF_LABELS, FF_COLORS,
  DC_LABELS, DC_COLORS, COST_MODEL_LABELS,
} from "@/lib/constants/application-colors";

type Props = {
  open: boolean;
  onClose: () => void;
  capTree: any[];
};

const INITIAL = {
  name: "",
  alias: "",
  vendor: "",
  version: "",
  description: "",
  appType: "CUSTOM",
  deployment: "UNKNOWN",
  lifecycle: "ACTIVE",
  businessValue: "BV_UNKNOWN",
  technicalHealth: "TH_UNKNOWN",
  functionalFit: "FF_UNKNOWN",
  rationalization: "RAT_NOT_ASSESSED",
  dataClassification: "DC_UNKNOWN",
  cost: "",
  costCurrency: "USD",
  costModel: "",
  costNotes: "",
  costRenewalDate: "",
  licensedUsers: "",
  actualUsers: "",
  businessOwnerId: "",
  itOwnerId: "",
  replacementAppId: "",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</span>
      <Separator className="flex-1" />
    </div>
  );
}

function ColorDot({ color }: { color?: string }) {
  if (!color) return null;
  return <span className="w-2 h-2 rounded-full inline-block mr-1.5 shrink-0" style={{ backgroundColor: color }} />;
}

export function CreateApplicationDialog({ open, onClose, capTree }: Props) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState(INITIAL);
  const [selectedCaps, setSelectedCaps] = useState<string[]>([]);
  const { data: allApps } = trpc.application.listForMapping.useQuery();
  const { data: workspaceUsers } = trpc.workspace.listUsers.useQuery();

  const createMutation = trpc.application.create.useMutation({
    onSuccess: () => {
      utils.application.list.invalidate();
      toast.success("Application created");
      resetAndClose();
    },
    onError: (err) => toast.error(err.message),
  });

  function set<K extends keyof typeof INITIAL>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetAndClose() {
    setForm(INITIAL);
    setSelectedCaps([]);
    onClose();
  }

  // Flatten capabilities for selection
  const flatCaps: { id: string; name: string; level: string }[] = [];
  function walk(nodes: any[]) {
    for (const n of nodes) {
      flatCaps.push({ id: n.id, name: n.name, level: n.level });
      if (n.children) walk(n.children);
    }
  }
  walk(capTree);

  function toggleCap(id: string) {
    setSelectedCaps((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  }

  function handleCreate() {
    createMutation.mutate({
      name: form.name.trim(),
      alias: form.alias.trim() || undefined,
      vendor: form.vendor.trim() || undefined,
      version: form.version.trim() || undefined,
      description: form.description.trim() || undefined,
      applicationType: form.appType as any,
      deploymentModel: form.deployment as any,
      lifecycle: form.lifecycle as any,
      businessValue: form.businessValue as any,
      technicalHealth: form.technicalHealth as any,
      functionalFit: form.functionalFit as any,
      rationalizationStatus: form.rationalization as any,
      dataClassification: form.dataClassification as any,
      annualCostUsd: form.cost ? parseFloat(form.cost) : undefined,
      costCurrency: form.costCurrency || "USD",
      costModel: form.costModel ? (form.costModel as any) : undefined,
      costNotes: form.costNotes.trim() || undefined,
      costRenewalDate: form.costRenewalDate || undefined,
      licensedUsers: form.licensedUsers ? parseInt(form.licensedUsers) : undefined,
      actualUsers: form.actualUsers ? parseInt(form.actualUsers) : undefined,
      businessOwnerId: form.businessOwnerId || undefined,
      itOwnerId: form.itOwnerId || undefined,
      replacementAppId: form.replacementAppId || undefined,
      capabilityIds: selectedCaps.length > 0 ? selectedCaps : undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && resetAndClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Application</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* ── Identity ── */}
          <SectionLabel>Identity</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Application Name <span className="text-rose-500">*</span></Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Salesforce CRM" className="mt-1" />
            </div>
            <div>
              <Label>Alias</Label>
              <Input value={form.alias} onChange={(e) => set("alias", e.target.value)} placeholder="Short name or acronym" className="mt-1" />
            </div>
            <div>
              <Label>Vendor</Label>
              <Input value={form.vendor} onChange={(e) => set("vendor", e.target.value)} placeholder="e.g. Salesforce" className="mt-1" />
            </div>
            <div>
              <Label>Version</Label>
              <Input value={form.version} onChange={(e) => set("version", e.target.value)} placeholder="e.g. 2024.1" className="mt-1" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.appType} onValueChange={(v) => v && set("appType", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(APP_TYPE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Deployment Model</Label>
              <Select value={form.deployment} onValueChange={(v) => v && set("deployment", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DEPLOY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lifecycle</Label>
              <Select value={form.lifecycle} onValueChange={(v) => v && set("lifecycle", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LIFECYCLE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What does this application do?" rows={2} className="mt-1" />
          </div>

          {/* ── Assessment ── */}
          <SectionLabel>Assessment</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Business Value</Label>
              <Select value={form.businessValue} onValueChange={(v) => v && set("businessValue", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(BV_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center"><ColorDot color={BV_COLORS[k]} />{l}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Technical Health</Label>
              <Select value={form.technicalHealth} onValueChange={(v) => v && set("technicalHealth", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TH_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center"><ColorDot color={TH_COLORS[k]} />{l}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Functional Fit</Label>
              <Select value={form.functionalFit} onValueChange={(v) => v && set("functionalFit", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FF_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center"><ColorDot color={FF_COLORS[k]} />{l}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rationalization</Label>
              <Select value={form.rationalization} onValueChange={(v) => v && set("rationalization", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RAT_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center"><ColorDot color={RAT_COLORS[k]} />{l}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data Classification</Label>
              <Select value={form.dataClassification} onValueChange={(v) => v && set("dataClassification", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DC_LABELS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center"><ColorDot color={DC_COLORS[k]} />{l}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Cost & Users ── */}
          <SectionLabel>Cost &amp; Users</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Annual Cost ($)</Label>
              <Input type="number" min={0} value={form.cost} onChange={(e) => set("cost", e.target.value)} placeholder="0" className="mt-1" />
            </div>
            <div>
              <Label>Cost Currency</Label>
              <Input value={form.costCurrency} onChange={(e) => set("costCurrency", e.target.value)} placeholder="USD" className="mt-1" />
            </div>
            <div>
              <Label>Cost Model</Label>
              <Select value={form.costModel || "_none"} onValueChange={(v) => v && set("costModel", v === "_none" ? "" : v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {Object.entries(COST_MODEL_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Renewal Date</Label>
              <div className="mt-1">
                <DatePicker
                  value={form.costRenewalDate}
                  onChange={(v) => set("costRenewalDate", v)}
                  placeholder="Select renewal date"
                />
              </div>
            </div>
            <div>
              <Label>Licensed Users</Label>
              <Input type="number" min={0} value={form.licensedUsers} onChange={(e) => set("licensedUsers", e.target.value)} placeholder="0" className="mt-1" />
            </div>
            <div>
              <Label>Actual Users</Label>
              <Input type="number" min={0} value={form.actualUsers} onChange={(e) => set("actualUsers", e.target.value)} placeholder="0" className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label>Cost Notes</Label>
              <Input value={form.costNotes} onChange={(e) => set("costNotes", e.target.value)} placeholder="Contract terms, billing notes..." className="mt-1" />
            </div>
          </div>

          {/* ── Ownership ── */}
          <SectionLabel>Ownership</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <OwnerFieldInline
              label="Business Owner"
              selectedId={form.businessOwnerId}
              onChange={(id) => set("businessOwnerId", id ?? "")}
              users={workspaceUsers}
            />
            <OwnerFieldInline
              label="IT Owner"
              selectedId={form.itOwnerId}
              onChange={(id) => set("itOwnerId", id ?? "")}
              users={workspaceUsers}
            />
          </div>

          {/* ── Replacement App ── */}
          {allApps && allApps.length > 0 && (
            <>
              <SectionLabel>Replacement</SectionLabel>
              <div>
                <Label>Replacement Application</Label>
                <Select value={form.replacementAppId || "_none"} onValueChange={(v) => v && set("replacementAppId", v === "_none" ? "" : v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None</SelectItem>
                    {allApps.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">If this app is being replaced, select its successor</p>
              </div>
            </>
          )}

          {/* ── Capability Mapping ── */}
          <SectionLabel>Capabilities</SectionLabel>
          <div>
            <Label>Link to Capabilities ({selectedCaps.length} selected)</Label>
            <div className="mt-2 max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
              {flatCaps.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">Import capabilities first in Module 1.</p>
              ) : (
                flatCaps.map((cap) => (
                  <button
                    key={cap.id}
                    type="button"
                    onClick={() => toggleCap(cap.id)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 transition-colors ${
                      selectedCaps.includes(cap.id) ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <Badge variant="outline" className="text-[8px] shrink-0">{cap.level}</Badge>
                    <span className="truncate">{cap.name}</span>
                    {selectedCaps.includes(cap.id) && <span className="ml-auto text-primary">✓</span>}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={resetAndClose}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={!form.name.trim() || createMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {createMutation.isPending ? "Creating..." : "Create Application"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OwnerFieldInline({
  label,
  selectedId,
  onChange,
  users,
}: {
  label: string;
  selectedId: string;
  onChange: (id: string | null) => void;
  users?: { id: string; name: string | null; email: string; avatarUrl: string | null }[];
}) {
  const [search, setSearch] = useState("");
  const selected = selectedId ? (users ?? []).find((u) => u.id === selectedId) : null;

  const filtered = (users ?? []).filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.name?.toLowerCase().includes(q)) || u.email.toLowerCase().includes(q);
  });

  return (
    <div>
      <Label>{label}</Label>
      {selected ? (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border bg-card group mt-1">
          {selected.avatarUrl ? (
            <img src={selected.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
          ) : (
            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-[9px] font-bold text-primary">
                {(selected.name ?? "?")[0]?.toUpperCase()}
              </span>
            </div>
          )}
          <span className="text-xs font-medium truncate flex-1">{selected.name ?? "Unknown"}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 transition"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <Popover>
          <PopoverTrigger className="w-full h-9 px-2 rounded-md border border-dashed text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition text-left mt-1">
            + Assign {label.toLowerCase()}
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <div className="p-2 border-b">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
                className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-auto p-1">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground px-2 py-3 text-center">No users found</p>
              ) : (
                filtered.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => { onChange(u.id); setSearch(""); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-muted transition"
                  >
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-primary">
                          {(u.name ?? u.email)[0]?.toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{u.name ?? "Unnamed"}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
