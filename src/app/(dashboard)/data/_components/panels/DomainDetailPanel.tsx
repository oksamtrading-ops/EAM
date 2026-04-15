"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Layers, Edit, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { DomainFormModal } from "../modals/DomainFormModal";
import { ClassificationBadge } from "@/components/shared/ClassificationBadge";

interface Props {
  domainId: string;
  onClose: () => void;
}

export function DomainDetailPanel({ domainId, onClose }: Props) {
  const [showEdit, setShowEdit] = useState(false);
  const utils = trpc.useUtils();
  const { data: domain, isLoading } = trpc.dataDomain.getById.useQuery({ id: domainId });

  const deleteMutation = trpc.dataDomain.delete.useMutation({
    onSuccess: () => {
      toast.success("Domain deleted");
      utils.dataDomain.list.invalidate();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <>
      <Sheet open onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full sm:w-[480px] sm:max-w-[480px] p-0 flex flex-col">
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
            <ScrollArea className="flex-1">
              <div className="px-6 py-4 space-y-5">
                {domain.description && (
                  <p className="text-sm text-muted-foreground">{domain.description}</p>
                )}

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground mb-0.5">Owner</p>
                    <p className="font-medium text-foreground">
                      {domain.owner?.name ?? domain.owner?.email ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5">Entities</p>
                    <p className="font-medium text-foreground">{domain.entities.length}</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Entities in this domain
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
              onClick={() => setShowEdit(true)}
              className="gap-1.5"
            >
              <Edit className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (
                  domain &&
                  confirm(
                    domain.entities.length > 0
                      ? `Cannot delete: domain has ${domain.entities.length} entities. Move or delete entities first.`
                      : `Delete "${domain.name}"?`
                  )
                ) {
                  if (domain.entities.length === 0) {
                    deleteMutation.mutate({ id: domain.id });
                  }
                }
              }}
              className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {domain && (
        <DomainFormModal
          open={showEdit}
          domain={{
            id: domain.id,
            name: domain.name,
            description: domain.description,
            color: domain.color,
          }}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  );
}
