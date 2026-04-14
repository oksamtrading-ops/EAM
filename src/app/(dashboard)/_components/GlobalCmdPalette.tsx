"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import fuzzysort from "fuzzysort";
import {
  AppWindow,
  Network,
  ShieldAlert,
  Map as MapIcon,
  Tags as TagsIcon,
  Building2,
  Sparkles,
  Plus,
  LayoutDashboard,
  Briefcase,
  ArrowRight,
  Loader2,
  Star,
  Trash2,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { paletteDeepLink, quickActionLink } from "@/lib/utils/paletteDeepLinks";
import { CmdAIAnswer } from "./CmdAIAnswer";
import { PalettePeekPane } from "./PalettePeekPane";

type SearchableItem = {
  id: string;
  label: string;
  sub?: string;
  hay: string; // concatenated haystack for fuzzy matching
  type: "Application" | "Capability" | "Risk" | "Initiative" | "Tag" | "OrgUnit";
  meta?: string;
};

const QUICK_ACTIONS: {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: { type: string; url?: string };
}[] = [
  { id: "qa-new-app", label: "New application", icon: Plus, action: { type: "NEW_APP" } },
  { id: "qa-new-risk", label: "New risk", icon: Plus, action: { type: "NEW_RISK" } },
  { id: "qa-new-init", label: "New initiative", icon: Plus, action: { type: "NEW_INITIATIVE" } },
  { id: "qa-auto-map", label: "Auto-map applications with AI", icon: Sparkles, action: { type: "AUTO_MAP" } },
  { id: "qa-dashboard", label: "Go to Dashboard", icon: LayoutDashboard, action: { type: "NAVIGATE", url: "/dashboard" } },
  { id: "qa-roadmap", label: "Go to Roadmap", icon: MapIcon, action: { type: "NAVIGATE", url: "/roadmap" } },
  { id: "qa-org", label: "Organization Profile", icon: Briefcase, action: { type: "NAVIGATE", url: "/settings/organization-profile" } },
];

export function GlobalCmdPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { workspaceId } = useWorkspace();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"search" | "ai">("search");
  const [activeValue, setActiveValue] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);

  // Saved AI queries (workspace + user scoped)
  const utils = trpc.useUtils();
  const { data: savedQueries = [] } = trpc.paletteQuery.list.useQuery(undefined, {
    enabled: open,
  });
  const markUsed = trpc.paletteQuery.markUsed.useMutation({
    onSuccess: () => utils.paletteQuery.list.invalidate(),
  });
  const deleteSaved = trpc.paletteQuery.delete.useMutation({
    onSuccess: () => utils.paletteQuery.list.invalidate(),
  });

  // Lazy fetch the index when palette first opens
  const { data: index } = trpc.search.index.useQuery(undefined, {
    enabled: open,
    staleTime: 60_000,
  });

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery("");
      setMode("search");
    }
  }, [open]);

  // Build flat searchable list
  const items: SearchableItem[] = useMemo(() => {
    if (!index) return [];
    const out: SearchableItem[] = [];

    for (const a of index.applications) {
      out.push({
        id: a.id,
        label: a.name,
        sub: [a.vendor, a.lifecycle].filter(Boolean).join(" · "),
        hay: `${a.name} ${a.alias ?? ""} ${a.vendor ?? ""} ${a.description ?? ""}`.toLowerCase(),
        type: "Application",
        meta: a.lifecycle,
      });
    }
    for (const c of index.capabilities) {
      out.push({
        id: c.id,
        label: c.name,
        sub: c.level,
        hay: `${c.name} ${c.description ?? ""}`.toLowerCase(),
        type: "Capability",
      });
    }
    for (const r of index.risks) {
      out.push({
        id: r.id,
        label: r.title,
        sub: `${r.status} · score ${r.riskScore}`,
        hay: `${r.title} ${r.description ?? ""} ${r.category}`.toLowerCase(),
        type: "Risk",
      });
    }
    for (const i of index.initiatives) {
      out.push({
        id: i.id,
        label: i.name,
        sub: `${i.status} · ${i.horizon}`,
        hay: `${i.name} ${i.description ?? ""}`.toLowerCase(),
        type: "Initiative",
      });
    }
    for (const t of index.tags) {
      out.push({
        id: t.id,
        label: t.name,
        hay: t.name.toLowerCase(),
        type: "Tag",
      });
    }
    for (const o of index.orgUnits) {
      out.push({
        id: o.id,
        label: o.name,
        hay: o.name.toLowerCase(),
        type: "OrgUnit",
      });
    }
    return out;
  }, [index]);

  // Fuzzy search
  const results = useMemo(() => {
    if (!query.trim()) {
      return {
        applications: items.filter((i) => i.type === "Application").slice(0, 6),
        capabilities: items.filter((i) => i.type === "Capability").slice(0, 6),
        risks: items.filter((i) => i.type === "Risk").slice(0, 6),
        initiatives: items.filter((i) => i.type === "Initiative").slice(0, 6),
      };
    }
    const matches = fuzzysort.go(query, items, {
      key: "hay",
      limit: 30,
      threshold: -10000,
    });
    const grouped: Record<string, SearchableItem[]> = {
      applications: [],
      capabilities: [],
      risks: [],
      initiatives: [],
    };
    for (const m of matches) {
      const it = m.obj;
      if (it.type === "Application") grouped.applications.push(it);
      else if (it.type === "Capability") grouped.capabilities.push(it);
      else if (it.type === "Risk") grouped.risks.push(it);
      else if (it.type === "Initiative") grouped.initiatives.push(it);
    }
    return grouped as {
      applications: SearchableItem[];
      capabilities: SearchableItem[];
      risks: SearchableItem[];
      initiatives: SearchableItem[];
    };
  }, [items, query]);

  const filteredQuickActions = useMemo(() => {
    if (!query.trim()) return QUICK_ACTIONS.slice(0, 4);
    const q = query.toLowerCase();
    return QUICK_ACTIONS.filter((a) => a.label.toLowerCase().includes(q));
  }, [query]);

  const totalResults =
    results.applications.length +
    results.capabilities.length +
    results.risks.length +
    results.initiatives.length;

  const showAiRow = query.trim().length >= 3;

  function handleSelectItem(it: SearchableItem) {
    onClose();
    router.push(paletteDeepLink(it.type, it.id));
  }

  function handleQuickAction(action: { type: string; url?: string }) {
    onClose();
    router.push(quickActionLink(action));
  }

  function handleAskAi() {
    setMode("ai");
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      className="max-w-[960px]! sm:max-w-[960px]!"
      title="Search"
      description="Search apps, capabilities, risks, or ask AI"
    >
      {mode === "search" ? (
        <div className="flex w-full">
          <div className="flex-1 min-w-0 border-r border-border">
        <Command
          shouldFilter={false}
          value={activeValue}
          onValueChange={setActiveValue}
        >
          <CommandInput
            ref={inputRef}
            value={query}
            onValueChange={setQuery}
            placeholder="Search apps, capabilities, risks… or press ↵ to ask AI"
            onKeyDown={(e) => {
              if (e.key === "Enter" && showAiRow && totalResults === 0) {
                e.preventDefault();
                handleAskAi();
              }
            }}
          />
          <CommandList>
            {!query.trim() && savedQueries.length > 0 && (
              <>
                <CommandGroup heading="Saved AI queries">
                  {savedQueries.slice(0, 5).map((q) => (
                    <CommandItem
                      key={q.id}
                      value={`saved-${q.id}`}
                      onSelect={() => {
                        markUsed.mutate({ id: q.id });
                        setQuery(q.queryText);
                        setMode("ai");
                      }}
                      className="group"
                    >
                      <Star className="h-4 w-4 fill-[#f59e0b] text-[#f59e0b]" />
                      <span className="truncate">{q.label}</span>
                      {q.useCount > 0 && (
                        <span className="ml-auto text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-full bg-muted">
                          {q.useCount}×
                        </span>
                      )}
                      <button
                        type="button"
                        aria-label="Delete saved query"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSaved.mutate({ id: q.id });
                        }}
                        className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-black/[0.08] text-muted-foreground"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            {showAiRow && (
              <>
                <CommandGroup>
                  <CommandItem
                    value={`__ai__${query}`}
                    onSelect={handleAskAi}
                    className="text-[var(--ai)] font-medium"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Ask AI — &quot;{query}&quot;</span>
                    <span className="ml-auto text-xs text-muted-foreground">↵</span>
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {!index && (
              <div className="px-3 py-6 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading workspace…
              </div>
            )}

            {index && totalResults === 0 && filteredQuickActions.length === 0 && !showAiRow && (
              <CommandEmpty>No matches. Type 3+ chars to ask AI.</CommandEmpty>
            )}

            {results.applications.length > 0 && (
              <CommandGroup heading="Applications">
                {results.applications.map((it) => (
                  <CommandItem key={it.id} value={`app-${it.id}`} onSelect={() => handleSelectItem(it)}>
                    <AppWindow className="h-4 w-4 text-muted-foreground" />
                    <span>{it.label}</span>
                    {it.sub && <span className="ml-auto text-xs text-muted-foreground">{it.sub}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results.capabilities.length > 0 && (
              <CommandGroup heading="Capabilities">
                {results.capabilities.map((it) => (
                  <CommandItem key={it.id} value={`cap-${it.id}`} onSelect={() => handleSelectItem(it)}>
                    <Network className="h-4 w-4 text-muted-foreground" />
                    <span>{it.label}</span>
                    {it.sub && <span className="ml-auto text-xs text-muted-foreground">{it.sub}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results.risks.length > 0 && (
              <CommandGroup heading="Risks">
                {results.risks.map((it) => (
                  <CommandItem key={it.id} value={`risk-${it.id}`} onSelect={() => handleSelectItem(it)}>
                    <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                    <span>{it.label}</span>
                    {it.sub && <span className="ml-auto text-xs text-muted-foreground">{it.sub}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results.initiatives.length > 0 && (
              <CommandGroup heading="Initiatives">
                {results.initiatives.map((it) => (
                  <CommandItem key={it.id} value={`init-${it.id}`} onSelect={() => handleSelectItem(it)}>
                    <MapIcon className="h-4 w-4 text-muted-foreground" />
                    <span>{it.label}</span>
                    {it.sub && <span className="ml-auto text-xs text-muted-foreground">{it.sub}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {filteredQuickActions.length > 0 && (
              <>
                {totalResults > 0 && <CommandSeparator />}
                <CommandGroup heading="Quick actions">
                  {filteredQuickActions.map((a) => {
                    const Icon = a.icon;
                    return (
                      <CommandItem
                        key={a.id}
                        value={a.id}
                        onSelect={() => handleQuickAction(a.action)}
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span>{a.label}</span>
                        <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
          </div>
          <aside className="w-[320px] shrink-0 bg-muted/20 hidden md:block">
            <PalettePeekPane activeValue={activeValue} index={index} />
          </aside>
        </div>
      ) : (
        <CmdAIAnswer
          query={query}
          workspaceId={workspaceId}
          onBack={() => setMode("search")}
          onNavigate={(url) => {
            onClose();
            router.push(url);
          }}
        />
      )}
    </CommandDialog>
  );
}
