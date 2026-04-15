"use client";

import { useState } from "react";
import { X, Trash2, Layers } from "lucide-react";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { ClassificationBadge } from "@/components/shared/ClassificationBadge";

interface Props {
  domainId: string;
  onClose: () => void;
}

export function DomainDetailPanel({ domainId, onClose }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const utils = trpc.useUtils();
  const { data: domain, isLoading } = trpc.dataDomain.getById.useQuery({ id: domainId });
  const { data: users = [] } = trpc.workspace.listUsers.useQuery();

  const updateMutation = trpc.dataDomain.update.useMutation({
    onSuccess: () => {
      utils.dataDomain.list.invalidate();
      utils.dataDomain.getById.invalidate({ id: domainId });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.dataDomain.delete.useMutation({
    onSuccess: () => {
      toast.success("Domain deleted");
      utils.dataDomain.list.invalidate();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  function update(patch: Parameters<typeof updateMutation.mutate>[0]) {
    updateMutation.mutate(patch);
  }

  if (isLoading || !domain) {
    return (
      <aside className="fixed right-0 top-0 h-screen w-full sm:w-[480px] z-50 border-l bg-card p-4 shadow-xl">
        <div className="animate-pulse text-sm text-muted-foreground">Loading…</div>
      </aside>
    );
  }

  const canDelete = domain.entities.length === 0;

  return (
    <aside className="fixed right-0 top-0 h-screen w-full sm:w-[480px] z-50 border-l bg-card flex flex-col overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-4 border-b flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: `${domain.color ?? "#0B5CD6"}18`,
              color: domain.color ?? "#0B5CD6",
            }}
          >
            <Layers className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-[15px] text-foreground truncate">{domain.name}</h2>
            <p className="text-xs text-muted-foreground">
              {domain.entities.length} entit{domain.entities.length === 1 ? "y" : "ies"}
            </p>
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-5">
          {/* Name */}
          <section>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
            <Input
              defaultValue={domain.name}
              className="h-8 text-sm"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== domain.name) update({ id: domain.id, name: v });
              }}
            />
          </section>

          {/* Description */}
          <section>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Description
            </label>
            <Textarea
              defaultValue={domain.description ?? ""}
              placeholder="What data belongs in this domain?"
              rows={2}
              onBlur={(e) => {
                const v = e.target.value;
                if (v !== (domain.description ?? "")) {
                  update({ id: domain.id, description: v || null });
                }
              }}
            />
          </section>

          <Separator />

          {/* Color */}
          <section>
            <label className="text-xs text-muted-foreground mb-1 block">Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                defaultValue={domain.color ?? "#0B5CD6"}
                className="h-8 w-10 rounded-md border border-border cursor-pointer bg-background"
                onBlur={(e) => {
                  if (e.target.value !== domain.color) {
                    update({ id: domain.id, color: e.target.value });
                  }
                }}
              />
              <Input
                defaultValue={domain.color ?? "#0B5CD6"}
                className="h-8 text-xs font-mono"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== domain.color) {
                    update({ id: domain.id, color: v });
                  }
                }}
              />
            </div>
          </section>

          <Separator />

          {/* Ownership */}
          <CollapsibleSection title="Ownership" defaultOpen>
            <OwnerField
              label="Owner"
              owner={domain.owner ?? null}
              onChange={(id) => update({ id: domain.id, ownerId: id })}
              users={users}
            />
          </CollapsibleSection>

          <Separator />

          {/* Entities */}
          <CollapsibleSection
            title="Entities in this domain"
            count={domain.entities.length}
            defaultOpen
          >
            {domain.entities.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No entities yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {domain.entities.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border bg-card"
                  >
                    <span className="text-sm font-medium text-foreground truncate">
                      {e.name}
                    </span>
                    <ClassificationBadge classification={e.classification} />
                  </li>
                ))}
              </ul>
            )}
          </CollapsibleSection>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t">
        {confirmDelete ? (
          <div className="space-y-2">
            <p className="text-xs text-rose-600 text-center font-medium">
              Delete &ldquo;{domain.name}&rdquo;? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 px-3 py-2 text-sm border rounded-md text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate({ id: domain.id })}
                disabled={deleteMutation.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-rose-500 hover:bg-rose-600 text-white rounded-md font-medium transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleteMutation.isPending ? "Deleting…" : "Confirm Delete"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              if (!canDelete) {
                toast.error(
                  `Cannot delete: domain has ${domain.entities.length} entities. Move or delete entities first.`
                );
                return;
              }
              setConfirmDelete(true);
            }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={canDelete ? undefined : "Domain must be empty before deletion"}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Domain
          </button>
        )}
      </div>
    </aside>
  );
}

function OwnerField({
  label,
  owner,
  onChange,
  users,
}: {
  label: string;
  owner: { id: string; name: string | null; avatarUrl: string | null } | null;
  onChange: (id: string | null) => void;
  users?: { id: string; name: string | null; email: string; avatarUrl: string | null }[];
}) {
  const [search, setSearch] = useState("");

  const filtered = (users ?? []).filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      {owner ? (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border bg-card group">
          {owner.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={owner.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
          ) : (
            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-[9px] font-bold text-primary">
                {(owner.name ?? "?")[0]?.toUpperCase()}
              </span>
            </div>
          )}
          <span className="text-xs font-medium truncate flex-1">
            {owner.name ?? "Unknown"}
          </span>
          <button
            onClick={() => onChange(null)}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 transition"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <Popover>
          <PopoverTrigger className="w-full h-8 px-2 rounded-md border border-dashed text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition text-left">
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
                <p className="text-xs text-muted-foreground px-2 py-3 text-center">
                  No users found
                </p>
              ) : (
                filtered.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      onChange(u.id);
                      setSearch("");
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-muted transition"
                  >
                    {u.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
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
