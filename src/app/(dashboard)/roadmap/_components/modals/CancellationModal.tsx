"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";

export function CancellationModal({
  open,
  initiativeName,
  onConfirm,
  onClose,
}: {
  open: boolean;
  initiativeName: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");

  if (!open) return null;

  function handleConfirm() {
    if (!reason.trim()) return;
    onConfirm(reason.trim());
    setReason("");
  }

  function handleClose() {
    setReason("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-background rounded-xl shadow-2xl w-[calc(100%-1.5rem)] sm:w-[440px] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="font-semibold text-sm">Cancel Initiative</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[360px]">
              {initiativeName}
            </p>
          </div>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Please provide a reason for cancelling this initiative. This will be recorded for audit purposes.
          </p>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Cancellation Reason *
            </label>
            <textarea
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-rose-400 resize-none"
              placeholder="e.g. Budget constraints, strategic reprioritisation, project scope changed..."
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t">
          <button
            type="button"
            onClick={handleClose}
            className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Keep Initiative
          </button>
          <button
            onClick={handleConfirm}
            disabled={!reason.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white text-sm font-semibold rounded-md hover:bg-rose-600 disabled:opacity-50 transition-colors"
          >
            Confirm Cancellation
          </button>
        </div>
      </div>
    </div>
  );
}
