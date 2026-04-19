"use client";

import { useRef, useState } from "react";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileUp,
  Library,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspace } from "@/hooks/useWorkspace";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  onExtracted: () => void;
};

type Mode = "upload" | "existing";

type Result = {
  documentId: string;
  draftsCreated: number;
};

export function KnowledgeUploadDialog({ open, onClose, onExtracted }: Props) {
  const { workspaceId } = useWorkspace();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: documents } = trpc.intake.listDocuments.useQuery(undefined, {
    enabled: open && mode === "existing",
  });

  function reset() {
    setFile(null);
    setSelectedDocId("");
    setRunning(false);
    setResult(null);
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function runUpload(f: File) {
    setFile(f);
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", f);
      formData.append("workspaceId", workspaceId);
      const res = await fetch("/api/ai/knowledge/extract", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Extraction failed");
        toast.error(data.error ?? "Extraction failed");
        return;
      }
      setResult(data);
      toast.success(
        `Extracted ${data.draftsCreated} fact${data.draftsCreated === 1 ? "" : "s"}`
      );
      onExtracted();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Extraction failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  }

  async function runExisting() {
    if (!selectedDocId) {
      toast.error("Pick a document first");
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ai/knowledge/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, documentId: selectedDocId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Extraction failed");
        toast.error(data.error ?? "Extraction failed");
        return;
      }
      setResult(data);
      toast.success(
        `Extracted ${data.draftsCreated} fact${data.draftsCreated === 1 ? "" : "s"}`
      );
      onExtracted();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Extraction failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Distill a document into facts</DialogTitle>
          <DialogDescription>
            Claude reads the document and extracts short, durable statements.
            Each proposed fact lands in the Drafts tab for your review — nothing
            commits to the knowledge base without your approval.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 p-0.5 rounded-md bg-muted/40 w-fit">
          <ModeBtn
            active={mode === "upload"}
            onClick={() => setMode("upload")}
            icon={<FileUp className="h-3.5 w-3.5" />}
            label="Upload new"
          />
          <ModeBtn
            active={mode === "existing"}
            onClick={() => setMode("existing")}
            icon={<Library className="h-3.5 w-3.5" />}
            label="Existing document"
          />
        </div>

        {mode === "upload" && (
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-[var(--ai)] hover:bg-[var(--ai)]/5 transition-colors"
            onClick={() => !running && fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md,.xlsx,.xls,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) runUpload(f);
              }}
            />
            {running ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 text-[var(--ai)] animate-spin" />
                <p className="text-sm font-medium">Distilling facts…</p>
                <p className="text-xs text-muted-foreground">
                  30–90 seconds for typical documents.
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
                  PDF, Excel, TXT, or Markdown (up to 15 MB)
                </p>
              </div>
            )}
          </div>
        )}

        {mode === "existing" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Pick an already-uploaded intake document. Its stored chunks are
              reused — no re-parsing.
            </p>
            <Select
              value={selectedDocId}
              onValueChange={(v) => setSelectedDocId(v ?? "")}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select a document…" />
              </SelectTrigger>
              <SelectContent>
                {(documents ?? []).length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No intake documents yet. Upload one via /intake first.
                  </div>
                ) : (
                  (documents ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.filename}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              onClick={runExisting}
              disabled={running || !selectedDocId}
              className="w-full bg-[var(--ai)] hover:bg-[var(--ai)]/90 text-white"
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Distilling facts…
                </>
              ) : (
                <>
                  <Library className="h-4 w-4 mr-1.5" />
                  Distill from selected document
                </>
              )}
            </Button>
          </div>
        )}

        {result && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-medium text-emerald-900">
                Extracted {result.draftsCreated} fact
                {result.draftsCreated === 1 ? "" : "s"}
              </p>
              <p className="text-emerald-800/80">
                Review them in the Drafts tab. Accept to commit, reject to
                discard.
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
      </DialogContent>
    </Dialog>
  );
}

function ModeBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors",
        active
          ? "bg-background shadow-sm text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
