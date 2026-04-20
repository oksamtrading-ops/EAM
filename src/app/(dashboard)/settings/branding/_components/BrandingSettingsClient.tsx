"use client";

import { useEffect, useState } from "react";
import { Palette, RotateCcw, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

type FormState = {
  logoUrl: string;
  brandColor: string;
};

const EMPTY: FormState = { logoUrl: "", brandColor: "" };

export function BrandingSettingsClient() {
  const { data: ws, isLoading } = trpc.workspace.getCurrent.useQuery();
  const [form, setForm] = useState<FormState>(EMPTY);
  const utils = trpc.useUtils();

  useEffect(() => {
    if (!ws) return;
    setForm({
      logoUrl: ws.logoUrl ?? "",
      brandColor: ws.brandColor ?? "",
    });
  }, [ws]);

  const update = trpc.workspace.update.useMutation({
    onSuccess: () => {
      toast.success("Branding saved");
      utils.workspace.getCurrent.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const trimmedLogo = form.logoUrl.trim();
  const trimmedColor = form.brandColor.trim();
  const logoIsValid = !trimmedLogo || isValidUrl(trimmedLogo);
  const colorIsValid = !trimmedColor || HEX_RE.test(trimmedColor);
  const canSave = logoIsValid && colorIsValid && ws != null && !update.isPending;

  function save() {
    if (!ws) return;
    if (!logoIsValid) {
      toast.error("Logo URL isn't a valid URL");
      return;
    }
    if (!colorIsValid) {
      toast.error("Brand color must be a 6-digit hex like #1e40af");
      return;
    }
    update.mutate({
      id: ws.id,
      logoUrl: trimmedLogo ? trimmedLogo : null,
      brandColor: trimmedColor ? trimmedColor : null,
    });
  }

  function clearBranding() {
    if (!ws) return;
    setForm(EMPTY);
    update.mutate({ id: ws.id, logoUrl: null, brandColor: null });
  }

  const workspaceLabel = ws?.clientName?.trim() || ws?.name || "Workspace";
  const previewAccent = colorIsValid && trimmedColor ? trimmedColor : null;

  return (
    <div className="flex h-full flex-col">
      <div className="glass-toolbar border-b px-4 sm:px-5 py-2.5">
        <h1 className="text-md font-semibold text-foreground tracking-tight flex items-center gap-2">
          <span className="h-6 w-6 rounded-md bg-[var(--ai)]/15 flex items-center justify-center">
            <Palette className="h-3.5 w-3.5 text-[var(--ai)]" />
          </span>
          Client Branding
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Applied to public share links (/share/c/…). Leave both fields
          blank to fall back to the default EAM look.
        </p>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center pt-8">
              Loading…
            </p>
          ) : (
            <>
              <div className="rounded-lg border bg-card p-5 space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Logo URL</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Paste a hosted image URL (PNG/SVG). Rendered up to 40px
                    tall on the share page header.
                  </p>
                  <Input
                    value={form.logoUrl}
                    onChange={(e) =>
                      setForm({ ...form, logoUrl: e.target.value })
                    }
                    placeholder="https://example.com/logo.png"
                    className={!logoIsValid ? "border-red-300" : undefined}
                  />
                  {!logoIsValid && (
                    <p className="text-[11px] text-red-600">Not a valid URL.</p>
                  )}
                </div>

                <div className="space-y-2 border-t pt-5">
                  <Label className="text-sm font-medium">Accent color</Label>
                  <p className="text-[11px] text-muted-foreground">
                    6-digit hex. Used for the header gradient, eyebrow, and
                    link hovers on the share page.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colorIsValid && trimmedColor ? trimmedColor : "#7c3aed"}
                      onChange={(e) =>
                        setForm({ ...form, brandColor: e.target.value })
                      }
                      className="h-9 w-12 rounded border cursor-pointer"
                      aria-label="Pick color"
                    />
                    <Input
                      value={form.brandColor}
                      onChange={(e) =>
                        setForm({ ...form, brandColor: e.target.value })
                      }
                      placeholder="#1e40af"
                      className={
                        "font-mono" +
                        (!colorIsValid ? " border-red-300" : "")
                      }
                    />
                  </div>
                  {!colorIsValid && (
                    <p className="text-[11px] text-red-600">
                      Must be a 6-digit hex, e.g. #1e40af.
                    </p>
                  )}
                </div>
              </div>

              {/* Live preview of the share-page header */}
              <div className="rounded-lg border bg-card overflow-hidden">
                <div className="px-5 py-3 border-b bg-muted/30 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <Sparkles className="h-3 w-3" />
                  Preview
                </div>
                <div
                  className="border-b"
                  style={
                    previewAccent
                      ? {
                          background: `linear-gradient(to right, ${previewAccent}15, transparent)`,
                        }
                      : undefined
                  }
                >
                  <div
                    className={
                      previewAccent
                        ? "px-5 py-5"
                        : "px-5 py-5 bg-gradient-to-r from-[var(--ai)]/5 to-transparent"
                    }
                  >
                    <div className="flex items-center gap-3">
                      {trimmedLogo && logoIsValid && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={trimmedLogo}
                          alt={workspaceLabel}
                          className="max-h-10 w-auto rounded"
                        />
                      )}
                      <div className="min-w-0">
                        <div
                          className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider"
                          style={
                            previewAccent
                              ? { color: previewAccent }
                              : { color: "var(--ai)" }
                          }
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Shared agent transcript
                        </div>
                        <h1 className="mt-1 text-lg font-bold text-foreground">
                          Example thread — Current-state review
                        </h1>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {workspaceLabel} · Shared {new Date().toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-5 py-3 text-center text-[11px] text-muted-foreground">
                  {trimmedLogo || trimmedColor
                    ? `Prepared by ${workspaceLabel}`
                    : "Generated by EAM · eampoc.vercel.app"}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearBranding}
                  disabled={update.isPending || (!form.logoUrl && !form.brandColor)}
                  className="gap-1.5 text-muted-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Clear branding
                </Button>
                <Button
                  size="sm"
                  onClick={save}
                  disabled={!canSave}
                  className="gap-1.5 bg-[var(--ai)] hover:bg-[var(--ai)]/90 text-white"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
