"use client";

import { useEffect, useRef, useState } from "react";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "sonner";

function isImageFile(f: File | null): boolean {
  if (!f) return false;
  return /^image\//.test(f.type) || /\.(png|jpe?g|webp)$/i.test(f.name);
}

/** Loading state shown while extraction is in flight. Vision calls
 *  take 5–15s; we don't currently stream SSE events from the intake
 *  pipeline (single Anthropic round-trip), so the steps advance on a
 *  rough timeline rather than from real events. The point is honesty
 *  about latency, not millisecond accuracy.
 *
 *  aria-live announces the state to screen readers. */
function UploadingState({ file }: { file: File | null }) {
  const isDiagram = isImageFile(file);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - t0) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, []);

  const step =
    elapsed < 2 ? 0 : elapsed < 6 ? 1 : 2;

  const stepLabels = isDiagram
    ? ["Reading image", "Looking at your diagram", "Extracting entities"]
    : ["Reading document", "Analyzing content", "Extracting entities"];

  const headline = isDiagram
    ? "Reading your diagram (typically 10–15s)…"
    : "Extracting drafts…";

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-3 w-full"
    >
      <div className="flex items-center gap-2">
        {isDiagram ? (
          <Sparkles className="h-5 w-5 text-[var(--ai)]" />
        ) : (
          <Loader2 className="h-5 w-5 text-[var(--ai)] animate-spin" />
        )}
        <Badge tone={isDiagram ? "ai" : "info"}>
          {isDiagram
            ? "Diagram detected — vision extraction"
            : "Document — text extraction"}
        </Badge>
      </div>

      <p className="text-sm font-medium">{headline}</p>

      <div className="flex flex-col gap-1.5 text-xs text-muted-foreground w-full max-w-xs">
        {stepLabels.map((label, i) => (
          <div
            key={label}
            className={`flex items-center gap-2 transition-opacity ${
              i === step ? "opacity-100" : i < step ? "opacity-60" : "opacity-30"
            }`}
          >
            {i < step ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            ) : i === step ? (
              <Loader2 className="h-3.5 w-3.5 text-[var(--ai)] animate-spin shrink-0" />
            ) : (
              <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 shrink-0" />
            )}
            <span>{label}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground/80 tabular-nums">
        {elapsed}s elapsed
      </p>
    </div>
  );
}

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
              accept=".pdf,.txt,.md,.xlsx,.xls,.docx,.doc,.png,.jpg,.jpeg,.webp,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
            {uploading ? (
              <UploadingState file={file} />
            ) : file && !result && !error ? (
              <div className="flex flex-col items-center gap-2">
                {isImageFile(file) ? (
                  <ImageIcon className="h-8 w-8 text-[var(--ai)]" />
                ) : (
                  <FileText className="h-8 w-8 text-[var(--ai)]" />
                )}
                <p className="text-sm font-medium">{file.name}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">
                  Upload a document or architecture diagram
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, Word, Excel, PNG, JPG, TXT, or Markdown (up to 15 MB)
                </p>
                <p className="text-[10px] text-muted-foreground/80 mt-1">
                  Images use vision extraction (~10s); documents are fast.
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
