"use client";

import { useState } from "react";
import { Image as ImageIcon, Maximize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type Props = {
  documentId: string;
  filename: string;
};

/**
 * Source-image thumbnail for diagram intakes. Lazy-fetches the
 * base64 payload (kept off listDrafts to avoid shipping ~500KB on
 * every panel render). Click the thumbnail → modal with full-size.
 *
 * Renders nothing if the document has no thumbnail (text intakes,
 * oversized images that skipped persistence).
 */
export function IntakeSourceThumbnail({ documentId, filename }: Props) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = trpc.intake.getThumbnail.useQuery(
    { documentId },
    { staleTime: 5 * 60 * 1000 } // image bytes don't change once written
  );

  if (isLoading) {
    return (
      <div
        className="glass rounded-lg p-2 flex items-center gap-2 max-w-xs animate-pulse"
        aria-hidden="true"
      >
        <div className="h-12 w-12 rounded bg-muted/40" />
        <div className="flex-1 space-y-1">
          <div className="h-2 w-24 rounded bg-muted/40" />
          <div className="h-2 w-16 rounded bg-muted/30" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "glass rounded-lg p-2 flex items-center gap-3 max-w-xs",
          "hover:bg-[var(--ai)]/5 transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ai)]/50"
        )}
        aria-label={`View source diagram: ${filename}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- data URI; next/image doesn't handle inline base64 */}
        <img
          src={data.dataUri}
          alt={`Source diagram: ${filename}`}
          className="h-12 w-12 rounded object-contain bg-zinc-100 dark:bg-zinc-800/50 shrink-0"
        />
        <div className="flex-1 min-w-0 text-left">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
            <ImageIcon className="h-3 w-3" />
            Source
          </div>
          <div className="text-xs font-medium truncate">{filename}</div>
        </div>
        <Maximize2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden">
          <DialogTitle className="sr-only">
            Source diagram: {filename}
          </DialogTitle>
          <div className="bg-zinc-100 dark:bg-zinc-900/80 p-4 max-h-[80vh] overflow-auto flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URI; next/image doesn't handle inline base64 */}
            <img
              src={data.dataUri}
              alt={`Full-size source diagram: ${filename}`}
              className="max-w-full h-auto"
            />
          </div>
          <div className="px-4 py-2 text-xs text-muted-foreground border-t flex items-center justify-between">
            <span className="truncate">{filename}</span>
            <span className="text-muted-foreground/70">
              Pinch / scroll to zoom
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
