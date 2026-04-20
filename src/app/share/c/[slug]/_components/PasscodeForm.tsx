"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  slug: string;
};

export function PasscodeForm({ slug }: Props) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/public/conversations/${slug}/unlock`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passcode: trimmed }),
        }
      );
      if (res.ok) {
        // Cookie is set; reload so the server component renders the
        // transcript branch.
        window.location.reload();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(
        body.error ??
          (res.status === 429
            ? "Too many attempts. Try again soon."
            : "Incorrect code.")
      );
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 text-left">
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        autoFocus
        placeholder="e.g. A7K2MX"
        aria-label="Share passcode"
        maxLength={12}
        className="font-mono uppercase text-center tracking-widest text-lg"
      />
      <Button
        type="submit"
        disabled={submitting || code.trim().length === 0}
        className="w-full gap-1.5 bg-[var(--ai)] hover:bg-[var(--ai)]/90 text-white"
      >
        {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Unlock
      </Button>
      {error && (
        <p className="text-[11px] text-red-600 text-center mt-1" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
