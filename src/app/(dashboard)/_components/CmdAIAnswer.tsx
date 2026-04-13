"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Sparkles,
  ExternalLink,
  Loader2,
  AppWindow,
  Network,
  ShieldAlert,
  Map as MapIcon,
  Tags as TagsIcon,
  Building2,
} from "lucide-react";
import { digDeeperLink, paletteDeepLink, quickActionLink, type EntityType } from "@/lib/utils/paletteDeepLinks";

type Metadata = {
  filters: { label: string; url: string }[];
  entityRefs: { type: EntityType; id: string }[];
  primaryRef: { type: EntityType; id: string } | null;
  quickAction: { type: string; url?: string } | null;
};

const ICON_MAP: Record<EntityType, React.ComponentType<{ className?: string }>> = {
  Application: AppWindow,
  Capability: Network,
  Risk: ShieldAlert,
  Initiative: MapIcon,
  Tag: TagsIcon,
  OrgUnit: Building2,
};

export function CmdAIAnswer({
  query,
  workspaceId,
  onBack,
  onNavigate,
}: {
  query: string;
  workspaceId: string;
  onBack: () => void;
  onNavigate: (url: string) => void;
}) {
  const [prose, setProse] = useState("");
  const [meta, setMeta] = useState<Metadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const started = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const controller = new AbortController();
    abortRef.current = controller;

    let buffer = "";
    let fullText = "";

    (async () => {
      try {
        const res = await fetch("/api/ai/palette-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, query }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          setError(await res.text().catch(() => "Request failed"));
          setDone(true);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done: rdone, value } = await reader.read();
          if (rdone) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const raw of events) {
            if (!raw.trim()) continue;
            const lines = raw.split("\n");
            const evtLine = lines.find((l) => l.startsWith("event: "));
            const dataLine = lines.find((l) => l.startsWith("data: "));
            if (!evtLine || !dataLine) continue;
            const evt = evtLine.slice(7).trim();
            const data = JSON.parse(dataLine.slice(6));
            if (evt === "delta" && typeof data.text === "string") {
              fullText += data.text;
              // Split on METADATA delimiter
              const idx = fullText.indexOf("---METADATA---");
              if (idx === -1) {
                setProse(fullText);
              } else {
                setProse(fullText.slice(0, idx).trim());
              }
            } else if (evt === "error") {
              setError(data.error ?? "Unknown error");
            }
          }
        }
        // Parse trailing metadata
        const idx = fullText.indexOf("---METADATA---");
        if (idx !== -1) {
          const metaRaw = fullText.slice(idx + "---METADATA---".length).trim();
          try {
            const parsed: Metadata = JSON.parse(metaRaw);
            setMeta(parsed);
            // Auto-trigger quick actions
            if (parsed.quickAction) {
              const url = quickActionLink(parsed.quickAction);
              setTimeout(() => onNavigate(url), 250);
            }
          } catch {
            // Metadata parse fail — fall back to prose-only
          }
        }
        setDone(true);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setError(err?.message ?? String(err));
        setDone(true);
      }
    })();

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col max-h-[60vh]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#e5e5e7]">
        <button
          onClick={onBack}
          className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-black/[0.05] text-[#86868b]"
          aria-label="Back to search"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Sparkles className="h-4 w-4 text-[#7c3aed]" />
        <span className="text-[13px] font-medium text-[#1d1d1f] truncate">{query}</span>
        {!done && (
          <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-[#86868b]" />
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : (
          <>
            {/* Prose answer */}
            <p className="text-[14px] leading-relaxed text-[#1d1d1f] whitespace-pre-wrap">
              {prose || (
                <span className="text-[#86868b]">Thinking…</span>
              )}
            </p>

            {/* Filter pills */}
            {meta?.filters && meta.filters.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {meta.filters.map((f, i) => (
                  <button
                    key={i}
                    onClick={() => onNavigate(f.url)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#7c3aed]/10 text-[#6d28d9] hover:bg-[#7c3aed]/20 transition"
                  >
                    {f.label}
                    <ExternalLink className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}

            {/* Entity refs */}
            {meta?.entityRefs && meta.entityRefs.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                  Related
                </p>
                <div className="space-y-0.5">
                  {meta.entityRefs.map((ref, i) => {
                    const Icon = ICON_MAP[ref.type] ?? AppWindow;
                    return (
                      <button
                        key={`${ref.type}-${ref.id}-${i}`}
                        onClick={() => onNavigate(paletteDeepLink(ref.type, ref.id))}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] text-left hover:bg-black/[0.04] transition"
                      >
                        <Icon className="h-3.5 w-3.5 text-[#86868b]" />
                        <span className="text-[#1d1d1f]">{ref.type}</span>
                        <span className="text-[#86868b] truncate font-mono text-[11px]">
                          {ref.id}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dig Deeper button */}
            {meta?.primaryRef && done && (
              <div className="pt-2 border-t border-[#e5e5e7]">
                <button
                  onClick={() => onNavigate(digDeeperLink(meta.primaryRef!.type, meta.primaryRef!.id))}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium bg-[#7c3aed] text-white hover:bg-[#6d28d9] transition"
                >
                  <Sparkles className="h-4 w-4" />
                  Dig Deeper with AI
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
