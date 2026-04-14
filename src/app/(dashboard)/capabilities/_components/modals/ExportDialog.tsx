"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText, Presentation } from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  onExportPptx: () => void;
};

type ExportFormat = "xlsx" | "csv" | "pptx";

const FORMAT_OPTIONS: { value: ExportFormat; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: "xlsx",
    label: "Excel (.xlsx)",
    description: "Full capability data with maturity, ownership, tags, and investment rollup",
    icon: <FileSpreadsheet className="h-5 w-5 text-[#16a34a]" />,
  },
  {
    value: "csv",
    label: "CSV (.csv)",
    description: "Lightweight comma-separated format for import into other tools",
    icon: <FileText className="h-5 w-5 text-[#0B5CD6]" />,
  },
  {
    value: "pptx",
    label: "PowerPoint (.pptx)",
    description: "Visual capability map slides for stakeholder presentations",
    icon: <Presentation className="h-5 w-5 text-[#ea580c]" />,
  },
];

export function ExportDialog({ open, onClose, onExportPptx }: Props) {
  const { workspaceId } = useWorkspace();
  const [exporting, setExporting] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("xlsx");

  async function handleExport() {
    if (selectedFormat === "pptx") {
      onExportPptx();
      onClose();
      return;
    }

    setExporting(true);
    try {
      const res = await fetch("/api/export/capabilities-xlsx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, format: selectedFormat }),
      });

      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = selectedFormat === "csv"
        ? "Capabilities_Export.csv"
        : "Capabilities_Export.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${selectedFormat.toUpperCase()} exported`);
      onClose();
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Capabilities</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelectedFormat(opt.value)}
              className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left ${
                selectedFormat === opt.value
                  ? "border-[#0B5CD6] bg-[#0B5CD6]/[0.04] ring-1 ring-[#0B5CD6]/20"
                  : "border-[#e9ecef] hover:border-[#0B5CD6]/30 hover:bg-[#fafbfc]"
              }`}
            >
              <div className="mt-0.5 shrink-0">{opt.icon}</div>
              <div>
                <p className="text-sm font-medium text-[#1a1f2e]">{opt.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleExport}
            disabled={exporting}
            className="bg-[#0B5CD6] hover:bg-[#094cb0] text-white"
          >
            {exporting ? "Exporting..." : `Export ${selectedFormat.toUpperCase()}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
