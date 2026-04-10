"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const INDUSTRIES = [
  { value: "BANKING", label: "Banking & Financial Services", icon: "🏦" },
  { value: "RETAIL", label: "Retail & Consumer", icon: "🛒" },
  { value: "LOGISTICS", label: "Logistics & Supply Chain", icon: "🚚" },
  { value: "MANUFACTURING", label: "Manufacturing", icon: "🏭" },
  { value: "HEALTHCARE", label: "Healthcare", icon: "🏥" },
  { value: "GENERIC", label: "Generic / Cross-Industry", icon: "🔲" },
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
};

export function TemplateImportDialog({ open, onClose }: Props) {
  const utils = trpc.useUtils();
  const [selectedIndustry, setSelectedIndustry] = useState<string>("");
  const [replaceExisting, setReplaceExisting] = useState(false);

  const importMutation = trpc.capability.importFromTemplate.useMutation({
    onSuccess: (data) => {
      utils.capability.getTree.invalidate();
      toast.success(`Imported ${data.imported} capabilities`);
      onClose();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Industry Template</DialogTitle>
          <DialogDescription>
            Select an industry to import a pre-built capability map. You can
            customize it after import.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 my-4">
          {INDUSTRIES.map((ind) => (
            <button
              key={ind.value}
              onClick={() => setSelectedIndustry(ind.value)}
              className={`p-4 border rounded-lg text-left transition-all hover:border-primary/50 ${
                selectedIndustry === ind.value
                  ? "border-primary bg-primary/5"
                  : "border-border"
              }`}
            >
              <span className="text-2xl">{ind.icon}</span>
              <p className="text-sm font-medium mt-2">{ind.label}</p>
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={replaceExisting}
            onChange={(e) => setReplaceExisting(e.target.checked)}
            className="rounded"
          />
          Replace existing capabilities (caution: removes current map)
        </label>

        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              importMutation.mutate({
                industry: selectedIndustry as any,
                levels: ["L1", "L2"],
                replaceExisting,
              })
            }
            disabled={!selectedIndustry || importMutation.isPending}
          >
            {importMutation.isPending ? "Importing..." : "Import Template"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
