"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

const RINGS = ["ADOPT", "TRIAL", "ASSESS", "HOLD"] as const;
const QUADRANTS = [
  { value: "LANGUAGES_FRAMEWORKS", label: "Languages & Frameworks" },
  { value: "PLATFORMS_INFRASTRUCTURE", label: "Platforms & Infrastructure" },
  { value: "TOOLS_TECHNIQUES", label: "Tools & Techniques" },
  { value: "DATA_STORAGE", label: "Data Storage" },
] as const;

const RING_DESCRIPTIONS: Record<string, string> = {
  ADOPT: "Approved standard — use for all new work",
  TRIAL: "Worth evaluating with guardrails",
  ASSESS: "Interesting but not proven — POC only",
  HOLD: "Not recommended — plan migration",
};

interface Props {
  entryId: string | null;
  onClose: () => void;
}

export function RadarEntryPanel({ entryId, onClose }: Props) {
  const utils = trpc.useUtils();
  const { data: radar } = trpc.techRadar.getRadar.useQuery();
  const existing = entryId ? radar?.entries.find((e) => e.id === entryId) : null;

  const [name, setName] = useState(existing?.name ?? "");
  const [quadrant, setQuadrant] = useState<string>(existing?.quadrant ?? "LANGUAGES_FRAMEWORKS");
  const [ring, setRing] = useState<string>(existing?.ring ?? "ASSESS");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [rationale, setRationale] = useState(existing?.rationale ?? "");
  const [isNew, setIsNew] = useState(existing?.isNew ?? true);
  const [movedFrom, setMovedFrom] = useState<string>(existing?.movedFrom ?? "");

  const upsertMutation = trpc.techRadar.upsert.useMutation({
    onSuccess: () => {
      toast.success(entryId ? "Entry updated" : "Entry added to radar");
      utils.techRadar.getRadar.invalidate();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.techRadar.delete.useMutation({
    onSuccess: () => {
      toast.success("Entry removed from radar");
      utils.techRadar.getRadar.invalidate();
      onClose();
    },
    onError: () => toast.error("Failed to remove entry"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    upsertMutation.mutate({
      ...(entryId ? { id: entryId } : {}),
      name,
      quadrant: quadrant as any,
      ring: ring as any,
      description: description || undefined,
      rationale: rationale || undefined,
      isNew,
      movedFrom: (movedFrom as any) || undefined,
    });
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:w-[440px] sm:max-w-[440px] p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle>{entryId ? "Edit Radar Entry" : "Add to Radar"}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <Label htmlFor="name">Technology Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. React, PostgreSQL, Kubernetes"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ring *</Label>
                <Select value={ring} onValueChange={(v) => v && setRing(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RINGS.map((r) => (
                      <SelectItem key={r} value={r}>
                        <div>
                          <div className="font-medium">{r}</div>
                          <div className="text-[10px] text-muted-foreground">{RING_DESCRIPTIONS[r]}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Moved From</Label>
                <Select value={movedFrom} onValueChange={(v) => setMovedFrom(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {RINGS.filter((r) => r !== ring).map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Quadrant *</Label>
              <Select value={quadrant} onValueChange={(v) => v && setQuadrant(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUADRANTS.map((q) => (
                    <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of what this technology does…"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="rationale">Rationale</Label>
              <Textarea
                id="rationale"
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="Why is it classified in this ring? What changed?…"
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isNew"
                checked={isNew}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIsNew(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="isNew" className="cursor-pointer">Mark as new entry</Label>
            </div>
          </div>

          <div className="px-6 py-4 border-t flex items-center gap-2 shrink-0">
            <Button type="submit" disabled={upsertMutation.isPending} className="bg-primary hover:bg-primary/90 text-white">
              {upsertMutation.isPending ? "Saving…" : entryId ? "Update" : "Add to Radar"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            {entryId && (
              <Button
                type="button"
                variant="ghost"
                className="ml-auto text-destructive hover:text-destructive"
                onClick={() => deleteMutation.mutate({ id: entryId })}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
