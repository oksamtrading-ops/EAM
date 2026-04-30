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
  Target,
  Scale,
  Clock,
  LayoutTemplate,
  Compass,
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
  OBJECTIVE: {
    icon: Target,
    label: "Objective",
    accent: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  COMPLIANCE_REQUIREMENT: {
    // Scale (balance) not ShieldCheck — Risk already uses ShieldAlert,
    // and two shield icons next to each other are visually
    // indistinguishable at the panel's icon size.
    icon: Scale,
    label: "Compliance",
    accent: "bg-blue-50 text-blue-700 border-blue-200",
  },
  EOL_WATCH: {
    icon: Clock,
    label: "EOL Watch",
    accent: "bg-amber-50 text-amber-700 border-amber-200",
  },
  ARCH_STATE: {
    icon: LayoutTemplate,
    label: "Architecture State",
    accent: "bg-slate-50 text-slate-700 border-slate-200",
  },
  WORKSPACE_PROFILE: {
    icon: Compass,
    label: "Workspace Profile",
    accent: "bg-violet-50 text-violet-700 border-violet-200",
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

type Pill = {
  label: string;
  tone: Tone;
  title?: string;
  emphasis?: boolean;
  /** Optional hex color rendered as a small filled swatch before the
   *  label. Used by WORKSPACE_PROFILE so reviewers see the actual
   *  brand color, not just the hex string. */
  swatchHex?: string;
};

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
    case "OBJECTIVE": {
      const target = get("targetDate");
      if (target)
        pills.push({
          label: target,
          tone: "slate",
          title: `Target: ${target}`,
        });
      const owner = get("ownerName");
      if (owner)
        pills.push({
          label: owner,
          tone: "slate",
          title: `Owner: ${owner}`,
        });
      break;
    }
    case "COMPLIANCE_REQUIREMENT": {
      const framework = get("framework");
      if (framework)
        pills.push({
          label: titleCase(framework),
          tone: "blue",
          title: `Framework: ${titleCase(framework)}`,
        });
      const cat = get("category");
      if (cat)
        pills.push({
          label: cat,
          tone: "slate",
          title: `Category: ${cat}`,
        });
      const isMandatory = payload.isMandatory;
      if (isMandatory === true)
        pills.push({
          label: "Mandatory",
          tone: "amber",
          title: "Mandatory control",
        });
      break;
    }
    case "EOL_WATCH": {
      const eolDate = get("eolDate");
      const urgency = computeUrgencyFromDate(eolDate);
      if (urgency) {
        pills.push({
          label: titleCase(urgency),
          tone: URGENCY_TONE[urgency],
          title: `Urgency: ${titleCase(urgency)}${eolDate ? ` (EOL ${eolDate})` : ""}`,
          emphasis: urgency === "CRITICAL",
        });
      }
      const vendor = get("vendor");
      if (vendor)
        pills.push({
          label: vendor,
          tone: "slate",
          title: `Vendor: ${vendor}`,
        });
      if (eolDate)
        pills.push({
          label: eolDate,
          tone: "slate",
          title: `EOL date: ${eolDate}`,
        });
      break;
    }
    case "ARCH_STATE": {
      const stateType = get("stateType");
      if (stateType) {
        const tone: Tone = stateType === "TO_BE" ? "indigo" : "slate";
        const label = stateType === "TO_BE" ? "To-Be" : "As-Is";
        pills.push({
          label,
          tone,
          title: `State: ${label}`,
          emphasis: stateType === "TO_BE",
        });
      }
      break;
    }
    case "WORKSPACE_PROFILE": {
      const industry = get("industry");
      if (industry)
        pills.push({
          label: titleCase(industry),
          tone: "slate",
          title: `Industry: ${titleCase(industry)}`,
        });
      const brandColor = get("brandColor");
      if (brandColor) {
        // Custom swatch pill is rendered separately; signal via tone "swatch"
        pills.push({
          label: brandColor,
          tone: "slate",
          title: `Brand color ${brandColor}`,
          swatchHex: brandColor,
        });
      }
      break;
    }
  }
  return pills;
}

const URGENCY_TONE: Record<string, Tone> = {
  CRITICAL: "red",
  WARNING: "amber",
  HEALTHY: "slate",
};

/** Mirrors computeUrgencyBand on the server. The draft payload may
 *  not yet carry urgencyBand (only the committed row does), so the
 *  card recomputes it from the eolDate string for visual parity. */
function computeUrgencyFromDate(
  eolDate: string | undefined
): "CRITICAL" | "WARNING" | "HEALTHY" | null {
  if (!eolDate) return null;
  const d = new Date(eolDate);
  if (isNaN(d.getTime())) return null;
  const now = Date.now();
  const eol = d.getTime();
  const sixMonthsMs = 1000 * 60 * 60 * 24 * 30 * 6;
  const eighteenMonthsMs = 1000 * 60 * 60 * 24 * 30 * 18;
  if (eol - now <= sixMonthsMs) return "CRITICAL";
  if (eol - now <= eighteenMonthsMs) return "WARNING";
  return "HEALTHY";
}

/** Headline shown at the top of the card. Most entity types use
 *  payload.name or payload.title; ARCH_STATE uses label;
 *  WORKSPACE_PROFILE has no name field — fall back to a static
 *  "Workspace settings" string so reviewers don't see "(unnamed)". */
function headlineFor(
  entityType: string,
  payload: Record<string, unknown>
): string {
  if (entityType === "ARCH_STATE") {
    const label = payload.label;
    if (typeof label === "string" && label.trim()) return label;
    return "Architecture state";
  }
  if (entityType === "WORKSPACE_PROFILE") return "Workspace settings";
  if (entityType === "EOL_WATCH") {
    const en = payload.entityName;
    if (typeof en === "string" && en.trim()) return en;
    return "(unnamed)";
  }
  if (entityType === "COMPLIANCE_REQUIREMENT") {
    const t = payload.title;
    if (typeof t === "string" && t.trim()) return t;
    return "(unnamed)";
  }
  return String(payload.name ?? payload.title ?? "(unnamed)");
}

/** WORKSPACE_PROFILE payload rendering. Different commit semantics
 *  than other drafts (updates the Workspace row instead of creating
 *  one), so reviewers need to see what specific fields will change.
 *  We don't have access to the current workspace values from this
 *  component — that's a Phase 3 polish (full diff treatment). For
 *  now, list the proposed fields with a clear scope caption. */
function WorkspaceProfilePreview({
  payload,
}: {
  payload: Record<string, unknown>;
}) {
  const rows: Array<{ label: string; value: string }> = [];
  const itVision = payload.itVision;
  if (typeof itVision === "string" && itVision.trim())
    rows.push({ label: "IT vision", value: itVision });
  const mission = payload.missionStatement;
  if (typeof mission === "string" && mission.trim())
    rows.push({ label: "Mission", value: mission });
  const industry = payload.industry;
  if (typeof industry === "string" && industry.trim())
    rows.push({ label: "Industry", value: industry });
  const brandColor = payload.brandColor;
  if (typeof brandColor === "string" && brandColor.trim())
    rows.push({ label: "Brand color", value: brandColor });
  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground mt-1 italic">
        No extractable fields.
      </p>
    );
  }
  return (
    <div className="mt-1.5 space-y-1.5">
      <p className="text-[11px] text-muted-foreground italic">
        Accepting applies these values to your workspace settings.
      </p>
      <div className="rounded-md border border-violet-200 bg-violet-50/40 p-2 space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="text-[11px] flex gap-2">
            <span className="text-muted-foreground shrink-0 w-[72px]">
              {r.label}
            </span>
            <span className="text-foreground/90 line-clamp-2 break-words">
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
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
            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
            TONE[p.tone],
            p.emphasis && "ring-1 ring-current/20"
          )}
        >
          {p.swatchHex && (
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-sm border border-black/10"
              style={{ backgroundColor: p.swatchHex }}
            />
          )}
          <span className={p.swatchHex ? "font-mono" : undefined}>{p.label}</span>
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
              {headlineFor(draft.entityType, payload)}
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
          {/* Description rendering. ARCH_STATE narratives are
              multi-paragraph and need more room than the default
              line-clamp-2; expand to full text when the user
              opens the evidence/details. WORKSPACE_PROFILE renders
              its proposed fields as a key-value block instead of
              a single description. */}
          {draft.entityType === "WORKSPACE_PROFILE" ? (
            <WorkspaceProfilePreview payload={payload} />
          ) : (
            typeof payload.description === "string" &&
            payload.description && (
              <p
                className={cn(
                  "text-xs text-muted-foreground mt-1",
                  draft.entityType === "ARCH_STATE"
                    ? expanded
                      ? "whitespace-pre-line"
                      : "line-clamp-5"
                    : "line-clamp-2"
                )}
              >
                {payload.description}
              </p>
            )
          )}
          <FactsStrip pills={pillsForPayload(draft.entityType, payload)} />
        </div>

        {isPending && (
          <div className="flex items-center gap-1 shrink-0">
            {draft.entityType === "WORKSPACE_PROFILE" ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[11px] font-medium text-violet-700 hover:bg-violet-50"
                onClick={onAccept}
                title="Apply to workspace settings"
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Apply
              </Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-emerald-600 hover:bg-emerald-50"
                onClick={onAccept}
                title="Accept"
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
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
        aria-expanded={expanded}
        className="mt-2 text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {evidence.length} evidence snippet{evidence.length === 1 ? "" : "s"}
        {draft.entityType === "ARCH_STATE" &&
          typeof payload.description === "string" &&
          payload.description.length > 240 && (
            <span className="text-muted-foreground/70 ml-1">
              · {expanded ? "show less" : "show more"}
            </span>
          )}
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
