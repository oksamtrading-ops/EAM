"use client";

import { useState } from "react";
import {
  Check,
  X,
  Pencil,
  ChevronDown,
  ChevronRight,
  Network,
  AppWindow,
  ShieldAlert,
  Building2,
  Layers,
  FileText,
  Map as RoadmapIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrencyCompact, formatCurrency } from "@/lib/currency";
import type { RouterOutputs } from "@/lib/trpc/client";

export type DraftStatusFilter =
  | "ALL"
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "MODIFIED";

type IntakeDraftsOutput = RouterOutputs["intake"]["listDrafts"];
type IntakeDraft = IntakeDraftsOutput[number];

type Props = {
  draft: IntakeDraft;
  onAccept: () => void;
  onReject: () => void;
  onEdit: () => void;
};

const ENTITY_META: Record<
  string,
  { icon: typeof Network; label: string; accent: string }
> = {
  CAPABILITY: {
    icon: Network,
    label: "Capability",
    accent: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  APPLICATION: {
    icon: AppWindow,
    label: "Application",
    accent: "bg-blue-50 text-blue-700 border-blue-200",
  },
  RISK: {
    icon: ShieldAlert,
    label: "Risk",
    accent: "bg-red-50 text-red-700 border-red-200",
  },
  VENDOR: {
    icon: Building2,
    label: "Vendor",
    accent: "bg-violet-50 text-violet-700 border-violet-200",
  },
  TECH_COMPONENT: {
    icon: Layers,
    label: "Tech Component",
    accent: "bg-slate-50 text-slate-700 border-slate-200",
  },
  INITIATIVE: {
    icon: RoadmapIcon,
    label: "Initiative",
    accent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
};

function confidenceColor(c: number): string {
  if (c >= 0.9) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (c >= 0.7) return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

// ─── Facts strip ──────────────────────────────────────────────
// Surfaces the high-signal payload fields inline so reviewers can
// accept/reject without expanding the card. Conditional pills:
// pills with no value are not rendered, so sparse payloads
// collapse to nothing rather than empty placeholders.

type Tone = "red" | "amber" | "emerald" | "blue" | "indigo" | "slate";

const TONE: Record<Tone, string> = {
  red: "bg-red-50 text-red-700 border-red-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  slate: "bg-slate-50 text-slate-700 border-slate-200",
};

type Pill = { label: string; tone: Tone; title?: string; emphasis?: boolean };

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const SEVERITY_TONE: Record<string, Tone> = {
  CRITICAL: "red",
  HIGH: "amber",
  MEDIUM: "blue",
  LOW: "slate",
};

const TIME_TONE: Record<string, Tone> = {
  ELIMINATE: "red",
  MIGRATE: "amber",
  INVEST: "emerald",
  TOLERATE: "slate",
};

const HORIZON_TONE: Record<string, Tone> = {
  H1_NOW: "red",
  H2_NEXT: "amber",
  H3_LATER: "blue",
  BEYOND: "slate",
};

const HORIZON_LABEL: Record<string, string> = {
  H1_NOW: "Now",
  H2_NEXT: "Next",
  H3_LATER: "Later",
  BEYOND: "Beyond",
};

const VENDOR_STATUS_TONE: Record<string, Tone> = {
  STRATEGIC: "indigo",
  ACTIVE: "emerald",
  UNDER_REVIEW: "amber",
  EXITING: "slate",
  DEPRECATED: "slate",
};

const RISK_STATUS_TONE: Record<string, Tone> = {
  OPEN: "red",
  IN_PROGRESS: "amber",
  MITIGATED: "blue",
  ACCEPTED: "slate",
  CLOSED: "slate",
};

const LIFECYCLE_TONE: Record<string, Tone> = {
  PLANNED: "blue",
  ACTIVE: "emerald",
  PHASING_OUT: "amber",
  RETIRED: "slate",
  SUNSET: "slate",
};

function pillsForPayload(
  entityType: string,
  payload: Record<string, unknown>
): Pill[] {
  const pills: Pill[] = [];
  const get = (k: string): string | undefined => {
    const v = payload[k];
    return typeof v === "string" && v.trim().length ? v : undefined;
  };
  const getNum = (k: string): number | undefined => {
    const v = payload[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim().length) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return undefined;
  };

  switch (entityType) {
    case "CAPABILITY": {
      const cur = get("currentMaturity");
      const tgt = get("targetMaturity");
      if (cur && tgt) {
        pills.push({
          label: `${titleCase(cur)} → ${titleCase(tgt)}`,
          tone: "blue",
          title: `Maturity: ${titleCase(cur)} → ${titleCase(tgt)}`,
        });
      } else if (cur) {
        pills.push({
          label: `Current: ${titleCase(cur)}`,
          tone: "slate",
          title: `Current maturity: ${titleCase(cur)}`,
        });
      } else if (tgt) {
        pills.push({
          label: `Target: ${titleCase(tgt)}`,
          tone: "slate",
          title: `Target maturity: ${titleCase(tgt)}`,
        });
      }
      const imp = get("strategicImportance");
      if (imp)
        pills.push({
          label: titleCase(imp),
          tone: SEVERITY_TONE[imp] ?? "slate",
          title: `Strategic importance: ${titleCase(imp)}`,
        });
      break;
    }
    case "APPLICATION": {
      const lifecycle = get("lifecycle");
      if (lifecycle)
        pills.push({
          label: titleCase(lifecycle),
          tone: LIFECYCLE_TONE[lifecycle] ?? "slate",
          title: `Lifecycle: ${titleCase(lifecycle)}`,
        });
      const vendor = get("vendor");
      if (vendor)
        pills.push({
          label: vendor,
          tone: "slate",
          title: `Vendor: ${vendor}`,
        });
      const cost = getNum("annualCostUsd");
      if (cost != null) {
        const ccy = get("costCurrency") ?? "USD";
        pills.push({
          label: formatCurrencyCompact(cost, ccy),
          tone: "indigo",
          title: `Annual cost: ${formatCurrency(cost, ccy)}`,
        });
      }
      const time = get("rationalizationStatus");
      if (time)
        pills.push({
          label: titleCase(time),
          tone: TIME_TONE[time] ?? "slate",
          title: `TIME disposition: ${titleCase(time)}`,
          emphasis: true,
        });
      break;
    }
    case "RISK": {
      const cat = get("category");
      if (cat)
        pills.push({
          label: titleCase(cat),
          tone: "slate",
          title: `Category: ${titleCase(cat)}`,
        });
      const lik = get("likelihood");
      const imp = get("impact");
      if (lik && imp) {
        const sev = SEVERITY_TONE[imp] ?? "slate";
        pills.push({
          label: `${lik[0]} × ${imp[0]}`,
          tone: sev,
          title: `Likelihood ${titleCase(lik)} × Impact ${titleCase(imp)}`,
        });
      }
      const status = get("status");
      if (status)
        pills.push({
          label: titleCase(status),
          tone: RISK_STATUS_TONE[status] ?? "slate",
          title: `Status: ${titleCase(status)}`,
        });
      break;
    }
    case "VENDOR": {
      const cat = get("category");
      if (cat)
        pills.push({
          label: titleCase(cat),
          tone: "slate",
          title: `Category: ${titleCase(cat)}`,
        });
      const status = get("status");
      if (status)
        pills.push({
          label: titleCase(status),
          tone: VENDOR_STATUS_TONE[status] ?? "slate",
          title: `Status: ${titleCase(status)}`,
        });
      const spend = getNum("annualSpend");
      if (spend != null) {
        const ccy = get("currency") ?? "USD";
        pills.push({
          label: formatCurrencyCompact(spend, ccy),
          tone: "indigo",
          title: `Annual spend: ${formatCurrency(spend, ccy)}`,
        });
      }
      break;
    }
    case "INITIATIVE": {
      const horizon = get("horizon");
      if (horizon)
        pills.push({
          label: HORIZON_LABEL[horizon] ?? titleCase(horizon),
          tone: HORIZON_TONE[horizon] ?? "slate",
          title: `Horizon: ${HORIZON_LABEL[horizon] ?? titleCase(horizon)}`,
        });
      const priority = get("priority");
      if (priority)
        pills.push({
          label: titleCase(priority),
          tone: SEVERITY_TONE[priority] ?? "slate",
          title: `Priority: ${titleCase(priority)}`,
        });
      const cat = get("category");
      if (cat)
        pills.push({
          label: titleCase(cat),
          tone: "slate",
          title: `Category: ${titleCase(cat)}`,
        });
      const budget = getNum("budgetUsd");
      if (budget != null) {
        const ccy = get("budgetCurrency") ?? "USD";
        pills.push({
          label: formatCurrencyCompact(budget, ccy),
          tone: "indigo",
          title: `Budget: ${formatCurrency(budget, ccy)}`,
        });
      }
      break;
    }
    case "TECH_COMPONENT": {
      const layer = get("layer");
      if (layer)
        pills.push({
          label: titleCase(layer),
          tone: "slate",
          title: `Layer: ${titleCase(layer)}`,
        });
      break;
    }
  }
  return pills;
}

function FactsStrip({ pills }: { pills: Pill[] }) {
  if (pills.length === 0) return null;
  // Show first 3 inline, collapse the rest into a "+N more" pill
  // that renders the overflow. Panel ~380px holds 3 comfortably.
  const visible = pills.slice(0, 3);
  const overflow = pills.slice(3);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      {visible.map((p, i) => (
        <span
          key={i}
          title={p.title}
          className={cn(
            "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
            TONE[p.tone],
            p.emphasis && "ring-1 ring-current/20"
          )}
        >
          {p.label}
        </span>
      ))}
      {overflow.length > 0 && (
        <span
          title={overflow.map((p) => p.title ?? p.label).join(" • ")}
          className={cn(
            "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
            TONE.slate
          )}
        >
          +{overflow.length} more
        </span>
      )}
    </div>
  );
}

export function DraftCard({ draft, onAccept, onReject, onEdit }: Props) {
  const [expanded, setExpanded] = useState(false);
  const meta =
    ENTITY_META[draft.entityType] ?? {
      icon: FileText,
      label: draft.entityType,
      accent: "bg-muted",
    };
  const Icon = meta.icon;
  const payload = draft.payload as Record<string, unknown>;
  const evidence = Array.isArray(draft.evidence)
    ? (draft.evidence as Array<{
        excerpt?: string;
        page?: number | null;
      }>)
    : [];
  const isPending = draft.status === "PENDING" || draft.status === "MODIFIED";

  return (
    <div
      className={cn(
        "rounded-lg border bg-card/80 p-3 transition-all",
        draft.status === "ACCEPTED" && "opacity-60",
        draft.status === "REJECTED" && "opacity-50"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "h-8 w-8 rounded-lg border flex items-center justify-center shrink-0",
            meta.accent
          )}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-foreground truncate">
              {String(payload.name ?? payload.title ?? "(unnamed)")}
            </span>
            <Badge
              variant="outline"
              className={cn("text-[10px] font-medium", confidenceColor(draft.confidence))}
            >
              {Math.round(draft.confidence * 100)}%
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {meta.label}
            </Badge>
            {draft.status !== "PENDING" && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px]",
                  draft.status === "ACCEPTED" &&
                    "bg-emerald-50 text-emerald-700 border-emerald-200",
                  draft.status === "REJECTED" &&
                    "bg-red-50 text-red-700 border-red-200",
                  draft.status === "MODIFIED" &&
                    "bg-amber-50 text-amber-700 border-amber-200"
                )}
              >
                {draft.status}
              </Badge>
            )}
          </div>
          {typeof payload.description === "string" && payload.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {payload.description}
            </p>
          )}
          <FactsStrip pills={pillsForPayload(draft.entityType, payload)} />
        </div>

        {isPending && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-emerald-600 hover:bg-emerald-50"
              onClick={onAccept}
              title="Accept"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:bg-muted"
              onClick={onEdit}
              title="Modify"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-red-600 hover:bg-red-50"
              onClick={onReject}
              title="Reject"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {evidence.length} evidence snippet{evidence.length === 1 ? "" : "s"}
      </button>

      {expanded && evidence.length > 0 && (
        <div className="mt-2 space-y-1.5 pl-4 border-l-2 border-[var(--ai)]/30">
          {evidence.map((e, i) => (
            <div key={i} className="text-[11px]">
              {e.page != null && (
                <span className="text-muted-foreground font-mono">
                  p.{e.page}{" "}
                </span>
              )}
              <span className="text-foreground/80 italic">&ldquo;{e.excerpt}&rdquo;</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
