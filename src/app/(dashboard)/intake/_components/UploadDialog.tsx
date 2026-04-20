"use client";

import { useRef, useState } from "react";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
};

type Result = {
  documentId: string;
  chunksCreated: number;
  draftsCreated: number;
};

export function UploadDialog({ open, onClose, onUploaded }: Props) {
  const { workspaceId } = useWorkspace();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setUploading(false);
    setResult(null);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleUpload(f: File) {
    setFile(f);
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", f);
      formData.append("workspaceId", workspaceId);

      const res = await fetch("/api/ai/intake", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Upload failed");
        toast.error(data.error ?? "Upload failed");
        return;
      }

      setResult(data);
      toast.success(
        `Extracted ${data.draftsCreated} draft${data.draftsCreated === 1 ? "" : "s"}`
      );
      onUploaded();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Document for Intake</DialogTitle>
          <DialogDescription>
            Claude will extract draft records (capabilities, applications,
            risks, vendors) from your document. Nothing is committed until
            you review and accept.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-[var(--ai)] hover:bg-[var(--ai)]/5 transition-colors"
            onClick={() => !uploading && fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md,.xlsx,.xls,.docx,.doc,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 text-[var(--ai)] animate-spin" />
                <p className="text-sm font-medium">Extracting drafts…</p>
                <p className="text-xs text-muted-foreground">
                  This can take 30–90 seconds for larger PDFs.
                </p>
              </div>
            ) : file && !result && !error ? (
              <div className="flex flex-col items-center gap-2">
                <FileText className="h-8 w-8 text-[var(--ai)]" />
                <p className="text-sm font-medium">{file.name}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">Upload a document</p>
                <p className="text-xs text-muted-foreground">
                  PDF, Word, Excel, TXT, or Markdown (up to 15 MB)
                </p>
              </div>
            )}
          </div>

          {result && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-emerald-900">
                  Extracted {result.draftsCreated} draft
                  {result.draftsCreated === 1 ? "" : "s"}
                </p>
                <p className="text-emerald-800/80">
                  {result.chunksCreated} evidence chunk
                  {result.chunksCreated === 1 ? "" : "s"} stored. Review them in
                  the main list.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50/70 p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-900">{error}</p>
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleClose}>
              {result ? "Done" : "Cancel"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
