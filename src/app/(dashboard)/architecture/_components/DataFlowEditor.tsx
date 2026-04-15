"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, X } from "lucide-react";

type Props = { interfaceId: string };

export function DataFlowEditor({ interfaceId }: Props) {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  const { data: flows = [], isLoading } = trpc.interfaceDataFlow.listByInterface.useQuery({
    interfaceId,
  });
  const { data: entities = [] } = trpc.dataEntity.list.useQuery(undefined);

  const add = trpc.interfaceDataFlow.addEntity.useMutation({
    onSuccess: () => {
      utils.interfaceDataFlow.listByInterface.invalidate({ interfaceId });
      utils.diagram.getDiagramData.invalidate();
      setOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = trpc.interfaceDataFlow.removeEntity.useMutation({
    onSuccess: () => {
      utils.interfaceDataFlow.listByInterface.invalidate({ interfaceId });
      utils.diagram.getDiagramData.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const attachedIds = new Set(flows.map((f) => f.dataEntityId));
  const available = entities.filter((e) => !attachedIds.has(e.id));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {isLoading ? (
          <span className="text-xs text-muted-foreground">Loading...</span>
        ) : flows.length === 0 ? (
          <span className="text-xs text-muted-foreground italic">
            No data entities attached
          </span>
        ) : (
          flows.map((f: any) => (
            <Badge
              key={f.id}
              variant="secondary"
              className="gap-1 pl-2 pr-1 py-0.5 text-[11px]"
            >
              {f.entity?.name ?? "Unknown"}
              <button
                onClick={() => remove.mutate({ id: f.id })}
                className="hover:bg-rose-500/20 rounded p-0.5"
                aria-label={`Remove ${f.entity?.name}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={available.length === 0}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border text-xs font-medium bg-background hover:bg-muted/60 disabled:opacity-50 disabled:pointer-events-none"
        >
          <Plus className="h-3 w-3" />
          Attach data entity
        </PopoverTrigger>
        <PopoverContent className="p-0 w-64" align="start">
          <Command>
            <CommandInput placeholder="Search entities..." className="h-9" />
            <CommandList>
              <CommandEmpty>No entities found.</CommandEmpty>
              <CommandGroup>
                {available.map((e) => (
                  <CommandItem
                    key={e.id}
                    value={e.name}
                    onSelect={() => {
                      add.mutate({
                        interfaceId,
                        dataEntityId: e.id,
                        direction: "SOURCE_TO_TARGET",
                      });
                    }}
                  >
                    {e.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
