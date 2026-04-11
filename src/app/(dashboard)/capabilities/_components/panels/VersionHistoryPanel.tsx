"use client";

import { useState } from "react";
import {
  X,
  History,
  Save,
  RotateCcw,
  Clock,
  Bot,
  User,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function VersionHistoryPanel({ open, onClose }: Props) {
  const [saveLabel, setSaveLabel] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  const utils = trpc.useUtils();
  const { data: versions, isLoading } = trpc.version.list.useQuery(
    undefined,
    { enabled: open }
  );

  const saveMutation = trpc.version.save.useMutation({
    onSuccess: () => {
      utils.version.list.invalidate();
      setSaveLabel("");
      setShowSaveInput(false);
      toast.success("Version saved");
    },
    onError: (err) => toast.error(err.message),
  });

  const restoreMutation = trpc.version.restore.useMutation({
    onSuccess: (data) => {
      utils.capability.getTree.invalidate();
      utils.version.list.invalidate();
      toast.success(`Restored to "${data.fromLabel}"`);
    },
    onError: (err) => toast.error(err.message),
  });

  if (!open) return null;

  return (
    <aside className="fixed right-0 top-0 h-screen w-[360px] z-40 border-l bg-white flex flex-col shadow-xl">
      {/* Header */}
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[#1a1f2e]/5 flex items-center justify-center">
            <History className="h-4 w-4 text-[#1a1f2e]" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-[#1a1f2e]">
              Version History
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {versions?.length ?? 0} snapshots
            </p>
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Save version */}
      <div className="px-5 py-3 border-b bg-[#fafbfc]">
        {showSaveInput ? (
          <div className="space-y-2">
            <Input
              autoFocus
              value={saveLabel}
              onChange={(e) => setSaveLabel(e.target.value)}
              placeholder='e.g. "Post-Workshop v1"'
              onKeyDown={(e) => {
                if (e.key === "Enter" && saveLabel.trim()) {
                  saveMutation.mutate({ label: saveLabel.trim() });
                }
                if (e.key === "Escape") {
                  setShowSaveInput(false);
                  setSaveLabel("");
                }
              }}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 bg-[#86BC25] hover:bg-[#76a821] text-white text-xs"
                disabled={!saveLabel.trim() || saveMutation.isPending}
                onClick={() => saveMutation.mutate({ label: saveLabel.trim() })}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1" />
                )}
                Save Snapshot
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => {
                  setShowSaveInput(false);
                  setSaveLabel("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            className="w-full bg-[#86BC25] hover:bg-[#76a821] text-white"
            onClick={() => setShowSaveInput(true)}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Current Version
          </Button>
        )}
      </div>

      {/* Version list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Loading versions...
          </div>
        ) : !versions || versions.length === 0 ? (
          <div className="p-8 text-center">
            <History className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">
              No versions saved yet
            </p>
            <p className="text-xs text-muted-foreground">
              Save a snapshot to create a restore point before making major
              changes.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {versions.map((v, i) => (
              <div
                key={v.id}
                className="px-5 py-3.5 hover:bg-[#fafbfc] transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-[#1a1f2e] truncate">
                        {v.label}
                      </p>
                      {v.isAutomatic && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1.5 py-0 shrink-0"
                        >
                          <Bot className="h-2.5 w-2.5 mr-0.5" />
                          Auto
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        {formatDistanceToNow(new Date(v.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                      {v.createdBy?.name && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {v.createdBy.name}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {(v.snapshot as any)?.capabilities?.length ?? "?"}{" "}
                      capabilities
                    </p>
                  </div>

                  {i > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs shrink-0"
                      disabled={restoreMutation.isPending}
                      onClick={() => {
                        if (
                          confirm(
                            `Restore to "${v.label}"? Your current map will be auto-saved first.`
                          )
                        ) {
                          restoreMutation.mutate({ versionId: v.id });
                        }
                      }}
                    >
                      {restoreMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Restore
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer info */}
      <div className="px-5 py-3 border-t bg-[#fafbfc]">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Restoring a version is non-destructive — your current map is
          auto-saved before any restore. Auto-snapshots are created on template
          imports and bulk assessments.
        </p>
      </div>
    </aside>
  );
}
