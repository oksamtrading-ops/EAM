"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  MATURITY_LABELS,
  MATURITY_COLORS,
  IMPORTANCE_LABELS,
} from "@/lib/constants/maturity-colors";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { CheckCircle2, ChevronRight, Search } from "lucide-react";

type FlatCap = {
  id: string;
  name: string;
  level: string;
  parentName: string | null;
  currentMaturity: string;
  targetMaturity: string;
  strategicImportance: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  tree: any[];
};

const MATURITY_OPTIONS = [
  "NOT_ASSESSED", "INITIAL", "DEVELOPING", "DEFINED", "MANAGED", "OPTIMIZING",
] as const;

const IMPORTANCE_OPTIONS = [
  "NOT_ASSESSED", "LOW", "MEDIUM", "HIGH", "CRITICAL",
] as const;

export function BulkAssessDialog({ open, onClose, tree }: Props) {
  const utils = trpc.useUtils();
  const [step, setStep] = useState<"select" | "assess">("select");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [filterMaturity, setFilterMaturity] = useState<string>("all");

  // Bulk values
  const [bulkCurrentMaturity, setBulkCurrentMaturity] = useState<string>("");
  const [bulkTargetMaturity, setBulkTargetMaturity] = useState<string>("");
  const [bulkImportance, setBulkImportance] = useState<string>("");
  const [bulkNotes, setBulkNotes] = useState("");

  const bulkAssessMutation = trpc.capability.bulkAssess.useMutation({
    onSuccess: (data) => {
      utils.capability.getTree.invalidate();
      toast.success(`${data.assessed} capabilities assessed`);
      handleClose();
    },
    onError: (err) => toast.error(err.message),
  });

  // Flatten tree
  const flatCaps = useMemo(() => {
    const result: FlatCap[] = [];
    function walk(nodes: any[], parentName: string | null) {
      for (const node of nodes) {
        result.push({
          id: node.id,
          name: node.name,
          level: node.level,
          parentName,
          currentMaturity: node.currentMaturity,
          targetMaturity: node.targetMaturity,
          strategicImportance: node.strategicImportance,
        });
        if (node.children) walk(node.children, node.name);
      }
    }
    walk(tree, null);
    return result;
  }, [tree]);

  // Filter
  const filtered = useMemo(() => {
    return flatCaps.filter((c) => {
      if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterLevel !== "all" && c.level !== filterLevel) return false;
      if (filterMaturity === "not_assessed" && c.currentMaturity !== "NOT_ASSESSED") return false;
      if (filterMaturity === "assessed" && c.currentMaturity === "NOT_ASSESSED") return false;
      return true;
    });
  }, [flatCaps, searchQuery, filterLevel, filterMaturity]);

  function toggleAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.id)));
    }
  }

  function toggle(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function handleClose() {
    setStep("select");
    setSelectedIds(new Set());
    setSearchQuery("");
    setFilterLevel("all");
    setFilterMaturity("all");
    setBulkCurrentMaturity("");
    setBulkTargetMaturity("");
    setBulkImportance("");
    setBulkNotes("");
    onClose();
  }

  function handleSubmit() {
    if (selectedIds.size === 0) return;

    const assessments = Array.from(selectedIds).map((capabilityId) => {
      const cap = flatCaps.find((c) => c.id === capabilityId)!;
      return {
        capabilityId,
        currentMaturity: (bulkCurrentMaturity || cap.currentMaturity) as any,
        targetMaturity: (bulkTargetMaturity || cap.targetMaturity) as any,
        strategicImportance: (bulkImportance || cap.strategicImportance) as any,
        notes: bulkNotes || undefined,
      };
    });

    bulkAssessMutation.mutate({ assessments });
  }

  const notAssessedCount = flatCaps.filter((c) => c.currentMaturity === "NOT_ASSESSED").length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-[#0B5CD6]" />
            Bulk Maturity Assessment
            {step === "select" && (
              <Badge variant="outline" className="ml-auto text-xs font-normal">
                {selectedIds.size} selected
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {step === "select" ? (
          <>
            {/* Quick stats */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>{flatCaps.length} total capabilities</span>
              <span className="text-amber-600 font-medium">
                {notAssessedCount} not assessed
              </span>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search capabilities..."
                  className="w-full h-9 pl-9 pr-3 rounded-md border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0B5CD6]/20 focus:border-[#0B5CD6]"
                />
              </div>
              <Select value={filterLevel} onValueChange={(v) => setFilterLevel(v ?? "all")}>
                <SelectTrigger className="w-24 h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="L1">L1</SelectItem>
                  <SelectItem value="L2">L2</SelectItem>
                  <SelectItem value="L3">L3</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterMaturity} onValueChange={(v) => setFilterMaturity(v ?? "all")}>
                <SelectTrigger className="w-32 h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All maturity</SelectItem>
                  <SelectItem value="not_assessed">Not Assessed</SelectItem>
                  <SelectItem value="assessed">Assessed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Select all */}
            <div className="flex items-center gap-2 px-1">
              <Checkbox
                checked={selectedIds.size > 0 && selectedIds.size === filtered.length}
                onCheckedChange={toggleAll}
              />
              <span className="text-xs text-muted-foreground">
                Select all ({filtered.length})
              </span>
              {notAssessedCount > 0 && filterMaturity === "all" && (
                <button
                  onClick={() => {
                    setFilterMaturity("not_assessed");
                    setSelectedIds(new Set(
                      flatCaps.filter((c) => c.currentMaturity === "NOT_ASSESSED").map((c) => c.id)
                    ));
                  }}
                  className="ml-auto text-xs text-[#0B5CD6] hover:underline"
                >
                  Select all unassessed ({notAssessedCount})
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto border rounded-lg divide-y min-h-0 max-h-[40vh]">
              {filtered.map((cap) => (
                <label
                  key={cap.id}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-[#fafbfc] cursor-pointer transition"
                >
                  <Checkbox
                    checked={selectedIds.has(cap.id)}
                    onCheckedChange={() => toggle(cap.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[9px] font-mono shrink-0">
                        {cap.level}
                      </Badge>
                      {cap.parentName && (
                        <>
                          <span className="text-[10px] text-muted-foreground truncate max-w-24">
                            {cap.parentName}
                          </span>
                          <ChevronRight className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                        </>
                      )}
                      <span className="text-xs font-medium truncate">{cap.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: MATURITY_COLORS[cap.currentMaturity] }}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {MATURITY_LABELS[cap.currentMaturity]}
                    </span>
                  </div>
                </label>
              ))}
              {filtered.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No capabilities match your filters.
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={() => setStep("assess")}
                disabled={selectedIds.size === 0}
                className="bg-[#0B5CD6] hover:bg-[#094cb0] text-white"
              >
                Assess {selectedIds.size} Capabilities
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Assess step */}
            <p className="text-sm text-muted-foreground">
              Set maturity and importance values for <strong>{selectedIds.size}</strong> capabilities.
              Leave a field blank to keep existing values.
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Current Maturity
                  </label>
                  <Select value={bulkCurrentMaturity || "__keep__"} onValueChange={(v) => setBulkCurrentMaturity(!v || v === "__keep__" ? "" : v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Keep existing" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__keep__">
                        <span className="text-muted-foreground">Keep existing</span>
                      </SelectItem>
                      {MATURITY_OPTIONS.map((m) => (
                        <SelectItem key={m} value={m}>
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: MATURITY_COLORS[m] }} />
                            {MATURITY_LABELS[m]}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Target Maturity
                  </label>
                  <Select value={bulkTargetMaturity || "__keep__"} onValueChange={(v) => setBulkTargetMaturity(!v || v === "__keep__" ? "" : v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Keep existing" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__keep__">
                        <span className="text-muted-foreground">Keep existing</span>
                      </SelectItem>
                      {MATURITY_OPTIONS.map((m) => (
                        <SelectItem key={m} value={m}>
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: MATURITY_COLORS[m] }} />
                            {MATURITY_LABELS[m]}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Strategic Importance
                </label>
                <Select value={bulkImportance || "__keep__"} onValueChange={(v) => setBulkImportance(!v || v === "__keep__" ? "" : v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Keep existing" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__keep__">
                      <span className="text-muted-foreground">Keep existing</span>
                    </SelectItem>
                    {IMPORTANCE_OPTIONS.map((i) => (
                      <SelectItem key={i} value={i}>{IMPORTANCE_LABELS[i]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Assessment Notes (optional)
                </label>
                <Textarea
                  value={bulkNotes}
                  onChange={(e) => setBulkNotes(e.target.value)}
                  placeholder="e.g. Assessed during Q2 2026 architecture review..."
                  rows={2}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setStep("select")}>Back</Button>
              <Button
                onClick={handleSubmit}
                disabled={bulkAssessMutation.isPending || (!bulkCurrentMaturity && !bulkTargetMaturity && !bulkImportance)}
                className="bg-[#0B5CD6] hover:bg-[#094cb0] text-white"
              >
                {bulkAssessMutation.isPending
                  ? "Saving..."
                  : `Apply to ${selectedIds.size} Capabilities`}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
