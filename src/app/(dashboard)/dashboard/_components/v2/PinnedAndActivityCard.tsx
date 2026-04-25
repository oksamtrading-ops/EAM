"use client";

import Link from "next/link";
import { Pin, X, Activity, Check, Plus, Pencil, Trash2, Upload, Sparkles, Package } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import type { PinnedItem, ActivityEntry } from "@/lib/contracts/dashboard";

const ENTITY_DOT: Record<string, string> = {
  TechRisk: "bg-red-500",
  Application: "bg-blue-500",
  Initiative: "bg-emerald-500",
  BusinessCapability: "bg-violet-500",
  ComplianceRequirement: "bg-amber-500",
  EolWatchEntry: "bg-amber-500",
  TechRadarEntry: "bg-blue-500",
  IntakeDocument: "bg-zinc-500",
  IntakeDraft: "bg-zinc-500",
  AgentRun: "bg-[var(--ai)]",
};

const ENTITY_LABEL: Record<string, string> = {
  TechRisk: "Risk",
  Application: "App",
  Initiative: "Init",
  BusinessCapability: "Capability",
  ComplianceRequirement: "Comp",
  EolWatchEntry: "EOL",
  TechRadarEntry: "Radar",
  IntakeDocument: "Doc",
  IntakeDraft: "Draft",
  AgentRun: "Run",
};

const ACTION_ICON = {
  CREATE: Plus,
  UPDATE: Pencil,
  DELETE: Trash2,
  IMPORT: Upload,
  ASSESS: Check,
  ACCEPT: Check,
  GENERATE: Package,
} as const;

/**
 * PinnedAndActivityCard — pins on top, audit-log activity feed
 * below, separated by a divider. One card so the third column of
 * Zone 3 stays balanced height-wise with the others.
 */
export function PinnedAndActivityCard() {
  const pins = trpc.dashboard.getPins.useQuery();
  const activity = trpc.dashboard.getActivity.useQuery({ limit: 6 });
  const utils = trpc.useUtils();

  const unpin = trpc.dashboard.unpin.useMutation({
    onSuccess: () => utils.dashboard.getPins.invalidate(),
  });

  return (
    <div className="rounded-2xl glass p-5 sm:p-6">
      <header className="mb-4">
        <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
          <Pin className="h-4 w-4 text-muted-foreground" />
          Pinned
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">Quick access</p>
      </header>

      {/* Pins */}
      <div className="space-y-1.5 mb-5">
        {pins.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-7 rounded bg-muted/40 animate-pulse" />
          ))
        ) : (pins.data ?? []).length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic py-1">
            Nothing pinned yet. Use the dashboard pin icons on entity pages.
          </p>
        ) : (
          (pins.data ?? []).slice(0, 5).map((pin: PinnedItem) => (
            <div
              key={pin.id}
              className="flex items-center gap-2 p-1.5 -mx-1.5 rounded hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors group"
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full shrink-0",
                  ENTITY_DOT[pin.entityType] ?? "bg-zinc-400"
                )}
              />
              <Link
                href={pin.href}
                className="flex-1 text-xs font-medium truncate hover:underline"
              >
                {pin.label}
              </Link>
              <span className="text-[9px] uppercase font-mono tracking-wider text-muted-foreground shrink-0">
                {ENTITY_LABEL[pin.entityType] ?? pin.entityType}
              </span>
              <button
                onClick={() => unpin.mutate({ id: pin.id })}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-muted-foreground hover:text-destructive shrink-0"
                aria-label="Unpin"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Activity */}
      <div className="pt-4 border-t border-black/5 dark:border-white/5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3 flex items-center gap-1.5">
          <Activity className="h-3 w-3" />
          Recent activity
        </div>
        {activity.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-7 rounded bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : (activity.data ?? []).length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">
            No recent activity.
          </p>
        ) : (
          <div className="space-y-2.5">
            {(activity.data ?? []).map((entry: ActivityEntry) => {
              const Icon =
                ACTION_ICON[entry.action as keyof typeof ACTION_ICON] ?? Pencil;
              return (
                <Link
                  key={entry.id}
                  href={entry.href}
                  className="flex items-start gap-2.5 group"
                >
                  <div className="h-5 w-5 rounded-md bg-muted/60 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-[var(--ai)]/10 transition-colors">
                    <Icon className="h-2.5 w-2.5 text-muted-foreground group-hover:text-[var(--ai)] transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] truncate group-hover:text-foreground transition-colors">
                      {entry.action.toLowerCase()}{" "}
                      <span className="font-medium">{entry.label}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      {entry.actorName} · {formatRelative(entry.occurredAt)}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function formatRelative(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return date.toLocaleDateString();
}
