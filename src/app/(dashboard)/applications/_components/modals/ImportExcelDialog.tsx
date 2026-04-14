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

type ValidationRow = {
  rowNum: number;
  name: string;
  isValid: boolean;
  errors: string[];
};

type ValidationResult = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ValidationRow[];
};

export function ImportExcelDialog({ open, onClose }: Props) {
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

  async function downloadTemplate() {
    setDownloadingTemplate(true);
    try {
      const res = await fetch("/api/export/applications-xlsx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, mode: "template" }),
      });
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Applications_Import_Template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Template downloaded");
    } catch {
      toast.error("Failed to download template");
    } finally {
      setDownloadingTemplate(false);
    }
  }

  async function downloadExport() {
    try {
      const res = await fetch("/api/export/applications-xlsx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, mode: "data" }),
      });
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Applications_Export.xlsx";
      a.click();
      URL.revokeObjectURL(url);
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

      const res = await fetch("/api/import/applications-xlsx", {
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

      const res = await fetch("/api/import/applications-xlsx", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Import failed");
        return;
      }

      const result = await res.json();
      toast.success(`Imported ${result.imported} application${result.imported !== 1 ? "s" : ""}${result.skipped > 0 ? ` (${result.skipped} skipped)` : ""}`);
      utils.application.list.invalidate();
      handleClose();
    } catch {
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import / Export Applications</DialogTitle>
          <DialogDescription>
            Bulk create applications from an Excel file, or export existing data.
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

          {/* Validation results */}
          {validation && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {validation.validRows} valid
                </span>
                {validation.invalidRows > 0 && (
                  <span className="flex items-center gap-1.5 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    {validation.invalidRows} with errors
                  </span>
                )}
                <span className="text-muted-foreground">
                  {validation.totalRows} total row{validation.totalRows !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Error rows */}
              {validation.rows.filter((r) => !r.isValid).length > 0 && (
                <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-1.5 font-medium">Row</th>
                        <th className="text-left px-3 py-1.5 font-medium">Name</th>
                        <th className="text-left px-3 py-1.5 font-medium">Errors</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {validation.rows.filter((r) => !r.isValid).map((r) => (
                        <tr key={r.rowNum} className="bg-red-50/50">
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
              {validation.validRows > 0 && (
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
                      Import {validation.validRows} Application{validation.validRows !== 1 ? "s" : ""}
                      {validation.invalidRows > 0 ? ` (skip ${validation.invalidRows} invalid)` : ""}
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
