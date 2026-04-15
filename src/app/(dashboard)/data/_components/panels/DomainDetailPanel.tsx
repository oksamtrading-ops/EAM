"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Layers, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { ClassificationBadge } from "@/components/shared/ClassificationBadge";

interface Props {
  domainId: string;
  onClose: () => void;
}

export function DomainDetailPanel({ domainId, onClose }: Props) {
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

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:w-[520px] sm:max-w-[520px] p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: `${domain?.color ?? "#0B5CD6"}18`,
                color: domain?.color ?? "#0B5CD6",
              }}
            >
              <Layers className="h-4 w-4" />
            </div>
            <SheetTitle className="text-base font-semibold leading-snug line-clamp-2">
              {isLoading ? "Loading…" : domain?.name}
            </SheetTitle>
          </div>
        </SheetHeader>

        {domain && (
          <ScrollArea className="flex-1" key={domain.id}>
            <div className="px-6 py-4 space-y-5">
              {/* Name */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Name</Label>
                <Input
                  defaultValue={domain.name}
                  className="h-8 text-sm"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== domain.name) update({ id: domain.id, name: v });
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Description
                </Label>
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
              </div>

              {/* Owner + Color */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Owner
                  </Label>
                  <Select
                    value={domain.ownerId ?? "__none__"}
                    onValueChange={(v) =>
                      update({
                        id: domain.id,
                        ownerId: !v || v === "__none__" ? null : v,
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="No owner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No owner</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name ?? u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Color
                  </Label>
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
                </div>
              </div>

              <Separator />

              {/* Entities list */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Entities in this domain ({domain.entities.length})
                </h4>
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
              </div>
            </div>
          </ScrollArea>
        )}

        <div className="px-6 py-3 border-t shrink-0 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!domain) return;
              if (domain.entities.length > 0) {
                toast.error(
                  `Cannot delete: domain has ${domain.entities.length} entities. Move or delete entities first.`
                );
                return;
              }
              if (confirm(`Delete "${domain.name}"?`)) {
                deleteMutation.mutate({ id: domain.id });
              }
            }}
            className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
          {updateMutation.isPending && (
            <span className="text-[11px] text-muted-foreground">Saving…</span>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
