"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { COMPLIANCE_TEMPLATES } from "@/lib/constants/compliance-templates";

const FRAMEWORK_LABELS: Record<string, string> = {
  SOC2_TYPE2: "SOC 2 Type II",
  ISO_27001: "ISO 27001",
  GDPR: "GDPR",
  PCI_DSS: "PCI-DSS",
  HIPAA: "HIPAA",
  NIST_CSF: "NIST CSF",
  CIS_CONTROLS: "CIS Controls",
  SOX: "SOX",
  PIPEDA: "PIPEDA",
};

const AVAILABLE_FRAMEWORKS = Object.keys(FRAMEWORK_LABELS) as (keyof typeof FRAMEWORK_LABELS)[];

interface Props {
  onClose: () => void;
}

export function FrameworkImportModal({ onClose }: Props) {
  const utils = trpc.useUtils();
  const [framework, setFramework] = useState<string>("");

  const importMutation = trpc.compliance.importFramework.useMutation({
    onSuccess: (res) => {
      toast.success(
        `Imported ${res.imported} control(s) for ${FRAMEWORK_LABELS[framework] ?? framework}${res.skipped > 0 ? ` (${res.skipped} already existed)` : ""}`
      );
      utils.compliance.getScorecard.invalidate();
      utils.compliance.getImportedFrameworks.invalidate();
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!framework) return;
    importMutation.mutate({ framework: framework as any });
  }

  const selectedTemplate = framework ? COMPLIANCE_TEMPLATES[framework] : null;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import Compliance Framework</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Import a standard compliance framework to start tracking controls and assessments.
            Existing controls will not be overwritten.
          </p>

          <div>
            <Label>Framework *</Label>
            <Select value={framework} onValueChange={(v) => v && setFramework(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a framework…" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_FRAMEWORKS.map((fw) => (
                  <SelectItem key={fw} value={fw}>
                    {FRAMEWORK_LABELS[fw]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTemplate && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-medium">{FRAMEWORK_LABELS[framework]}</p>
              <p className="text-muted-foreground text-xs mt-1">
                {selectedTemplate.length} controls will be imported across{" "}
                {new Set(selectedTemplate.map((t) => t.category)).size} categories.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              disabled={!framework || importMutation.isPending}
              className="bg-[#86BC25] hover:bg-[#75a821] text-white"
            >
              {importMutation.isPending ? "Importing…" : "Import Framework"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
