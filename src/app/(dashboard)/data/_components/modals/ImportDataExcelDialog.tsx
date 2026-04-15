"use client";

import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
}

type RowError = { sheet: string; rowNum: number; name: string; errors: string[] };

type ValidationResult = {
  domains: { total: number; valid: number };
  entities: { total: number; valid: number };
  crud: { total: number; valid: number };
  quality: { total: number; valid: number };
  errors: RowError[];
};

type ImportResult = ValidationResult & {
  imported: {
    domains: number;
    entities: number;
    usages: number;
    qualityScores: number;
  };
};

export function ImportDataExcelDialog({ open, onClose }: Props) {
  const { workspaceId } = useWorkspace();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const utils = trpc.useUtils();

  function reset() {
    setFile(null);
    setValidation(null);
    setValidating(false);
    setImporting(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function downloadExcel(mode: "template" | "data", filename: string) {
    const res = await fetch("/api/export/data-architecture-xlsx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, mode }),
    });
    if (!res.ok) throw new Error("Failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadTemplate() {
    setDownloadingTemplate(true);
    try {
      await downloadExcel("template", "Data_Architecture_Import_Template.xlsx");
      toast.success("Template downloaded");
    } catch {
      toast.error("Failed to download template");
    } finally {
      setDownloadingTemplate(false);
    }
  }

  async function downloadExport() {
    try {
      await downloadExcel("data", "Data_Architecture_Export.xlsx");
      toast.success("Export downloaded");
    } catch {
      toast.error("Export failed");
    }
  }

  async function handleFileChange(f: File) {
    setFile(f);
    setValidation(null);
    setValidating(true);

    try {
      const formData = new FormData();
      formData.append("file", f);
      formData.append("workspaceId", workspaceId);
      formData.append("action", "validate");

      const res = await fetch("/api/import/data-architecture-xlsx", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Validation failed");
        return;
      }

      const result = (await res.json()) as ValidationResult;
      setValidation(result);
    } catch {
      toast.error("Failed to validate file");
    } finally {
      setValidating(false);
    }
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("workspaceId", workspaceId);
      formData.append("action", "import");

      const res = await fetch("/api/import/data-architecture-xlsx", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Import failed");
        return;
      }

      const result = (await res.json()) as ImportResult;
      const { imported } = result;
      toast.success(
        `Imported: ${imported.domains} domains, ${imported.entities} entities, ${imported.usages} CRUD rows, ${imported.qualityScores} quality scores`
      );
      utils.dataDomain.list.invalidate();
      utils.dataEntity.list.invalidate();
      utils.dataEntity.stats.invalidate();
      utils.appEntityUsage.list.invalidate();
      handleClose();
    } catch {
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  }

  const totalValid = validation
    ? validation.domains.valid +
      validation.entities.valid +
      validation.crud.valid +
      validation.quality.valid
    : 0;
  const totalRows = validation
    ? validation.domains.total +
      validation.entities.total +
      validation.crud.total +
      validation.quality.total
    : 0;
  const invalidCount = validation?.errors.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import / Export Data Architecture</DialogTitle>
          <DialogDescription>
            Bulk create domains, entities, CRUD usage, and quality scores from an Excel file, or export existing data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Download buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
              disabled={downloadingTemplate}
              className="flex-1"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {downloadingTemplate ? "Downloading..." : "Download Template"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadExport}
              className="flex-1"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
              Export Current Data
            </Button>
          </div>

          {/* File upload */}
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileChange(f);
              }}
            />
            {validating ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-sm font-medium">Validating...</p>
              </div>
            ) : file ? (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet className="h-8 w-8 text-primary" />
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">Click to replace</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">Upload Excel File</p>
                <p className="text-xs text-muted-foreground">Click or drag .xlsx file here</p>
              </div>
            )}
          </div>

          {/* Validation summary */}
          {validation && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {totalValid} valid
                </span>
                {invalidCount > 0 && (
                  <span className="flex items-center gap-1.5 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    {invalidCount} with errors
                  </span>
                )}
                <span className="text-muted-foreground">
                  {totalRows} total row{totalRows !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Per-sheet breakdown */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {([
                  ["Domains", validation.domains],
                  ["Entities", validation.entities],
                  ["CRUD Matrix", validation.crud],
                  ["Quality Scores", validation.quality],
                ] as const).map(([label, s]) => (
                  <div
                    key={label}
                    className="bg-muted/40 rounded-md px-3 py-2 border border-border"
                  >
                    <p className="font-medium">{label}</p>
                    <p className="text-muted-foreground">
                      {s.valid} / {s.total} valid
                    </p>
                  </div>
                ))}
              </div>

              {/* Error rows */}
              {invalidCount > 0 && (
                <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-1.5 font-medium">Sheet</th>
                        <th className="text-left px-3 py-1.5 font-medium">Row</th>
                        <th className="text-left px-3 py-1.5 font-medium">Name</th>
                        <th className="text-left px-3 py-1.5 font-medium">Errors</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {validation.errors.map((r, idx) => (
                        <tr key={`${r.sheet}-${r.rowNum}-${idx}`} className="bg-red-50/50">
                          <td className="px-3 py-1.5 text-muted-foreground">{r.sheet}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.rowNum}</td>
                          <td className="px-3 py-1.5 font-medium">{r.name || "(empty)"}</td>
                          <td className="px-3 py-1.5 text-red-600">{r.errors.join("; ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Import button */}
              {totalValid > 0 && (
                <Button
                  onClick={handleImport}
                  disabled={importing}
                  className="w-full bg-primary hover:bg-primary/90 text-white"
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      Import {totalValid} row{totalValid !== 1 ? "s" : ""}
                      {invalidCount > 0 ? ` (skip ${invalidCount} invalid)` : ""}
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
