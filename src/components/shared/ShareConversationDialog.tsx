"use client";

import { useEffect, useState } from "react";
import {
  Link2,
  Copy,
  CheckCircle2,
  Loader2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onClose: () => void;
  conversationId: string | null;
};

type ExpiryValue = "7" | "30" | "never";

export function ShareConversationDialog({
  open,
  onClose,
  conversationId,
}: Props) {
  const enabled = open && !!conversationId;
  const { data: existing, isLoading } =
    trpc.agentConversationShare.getForConversation.useQuery(
      { conversationId: conversationId ?? "" },
      { enabled }
    );

  const [redactToolCalls, setRedactToolCalls] = useState(true);
  const [expiry, setExpiry] = useState<ExpiryValue>("30");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setCopied(false);
    }
  }, [open]);

  const utils = trpc.useUtils();
  const create = trpc.agentConversationShare.create.useMutation({
    onSuccess: () => {
      toast.success("Share link created");
      utils.agentConversationShare.getForConversation.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const revoke = trpc.agentConversationShare.revoke.useMutation({
    onSuccess: () => {
      toast.success("Share revoked");
      utils.agentConversationShare.getForConversation.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const isLive = !!existing && !existing.revoked;
  const shareUrl = isLive
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/c/${existing!.slug}`
    : null;

  async function copyUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  function createShare() {
    if (!conversationId) return;
    const expiryDays =
      expiry === "never" ? null : parseInt(expiry);
    create.mutate({
      conversationId,
      redactToolCalls,
      expiryDays,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-[var(--ai)]" />
            Share conversation
          </DialogTitle>
          <DialogDescription>
            Create a read-only URL a client can open without signing in.
            Revoke it at any time.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Loading…
          </p>
        ) : isLive && shareUrl ? (
          <div className="space-y-3">
            <div className="rounded-lg border bg-emerald-50/50 border-emerald-200 p-3 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="min-w-0 text-xs text-emerald-900">
                <p className="font-medium">Share is live</p>
                <p className="text-emerald-800/80">
                  Tool-call cards{" "}
                  {existing!.redactToolCalls ? "redacted" : "visible"}
                  {existing!.expiresAt
                    ? ` · expires ${new Date(existing!.expiresAt).toLocaleDateString()}`
                    : " · no expiry"}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 min-w-0 text-xs bg-muted/40 border rounded-md px-2 py-1.5 font-mono"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={copyUrl}
                className="gap-1.5 shrink-0"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </Button>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!window.confirm("Revoke this share link?")) return;
                  revoke.mutate({ id: existing!.id });
                }}
                disabled={revoke.isPending}
                className="gap-1.5 text-red-600 hover:text-red-700"
              >
                <XCircle className="h-3.5 w-3.5" />
                Revoke
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={redactToolCalls}
                  onChange={(e) => setRedactToolCalls(e.target.checked)}
                  className="h-3.5 w-3.5 mt-0.5 accent-[var(--ai)] shrink-0"
                />
                <span className="text-sm">
                  Hide tool-call details
                  <span className="block text-[11px] text-muted-foreground">
                    Recommended for client-facing shares. Viewers see only the
                    agent&apos;s text responses, not the underlying tool
                    inputs/outputs.
                  </span>
                </span>
              </Label>
            </div>

            <div>
              <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Expiry
              </Label>
              <Select
                value={expiry}
                onValueChange={(v) => v && setExpiry(v as ExpiryValue)}
              >
                <SelectTrigger className="h-9 text-sm mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="never">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {existing?.revoked && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 flex gap-2 text-[11px] text-amber-900">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                A previous share was revoked. Creating now restores access
                with the same slug — the old URL becomes live again.
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={createShare}
                disabled={create.isPending || !conversationId}
                className="gap-1.5 bg-[var(--ai)] hover:bg-[var(--ai)]/90 text-white"
              >
                {create.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Link2 className="h-3.5 w-3.5" />
                )}
                Create link
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
