"use client";

import {
  AppWindow,
  Network,
  ShieldAlert,
  Map as MapIcon,
  Info,
} from "lucide-react";

/**
 * Right-hand peek pane for GlobalCmdPalette.
 * Shows a preview of the currently highlighted result, using the already-
 * fetched search.index payload (no extra round-trip).
 */

type IndexShape = {
  applications: Array<{
    id: string;
    name: string;
    alias?: string | null;
    vendor?: string | null;
    description?: string | null;
    lifecycle?: string | null;
    rationalizationStatus?: string | null;
    businessValue?: string | null;
    technicalHealth?: string | null;
  }>;
  capabilities: Array<{
    id: string;
    name: string;
    description?: string | null;
    level: string;
  }>;
  risks: Array<{
    id: string;
    title: string;
    description?: string | null;
    status: string;
    category: string;
    riskScore: number;
  }>;
  initiatives: Array<{
    id: string;
    name: string;
    description?: string | null;
    status: string;
    horizon: string;
  }>;
};

type ActiveItem =
  | { kind: "app"; id: string }
  | { kind: "cap"; id: string }
  | { kind: "risk"; id: string }
  | { kind: "init"; id: string }
  | null;

function parseActive(value: string | undefined): ActiveItem {
  if (!value) return null;
  const m = value.match(/^(app|cap|risk|init)-(.+)$/);
  if (!m) return null;
  return { kind: m[1] as any, id: m[2]! };
}

const LIFECYCLE_COLOR: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  SUNSET: "bg-amber-50 text-amber-700",
  RETIRED: "bg-rose-50 text-rose-700",
  EVALUATING: "bg-blue-50 text-blue-700",
  PLANNED: "bg-purple-50 text-purple-700",
};

const STATUS_COLOR: Record<string, string> = {
  OPEN: "bg-amber-50 text-amber-700",
  MITIGATED: "bg-emerald-50 text-emerald-700",
  ACCEPTED: "bg-blue-50 text-blue-700",
  CLOSED: "bg-muted text-muted-foreground",
  IDENTIFIED: "bg-purple-50 text-purple-700",
};

export function PalettePeekPane({
  activeValue,
  index,
}: {
  activeValue: string | undefined;
  index: IndexShape | undefined;
}) {
  const active = parseActive(activeValue);

  if (!index || !active) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-2">
        <Info className="h-5 w-5 text-muted-foreground" />
        <p className="text-[12px] text-muted-foreground leading-relaxed max-w-[220px]">
          Highlight an item on the left to preview details here.
        </p>
      </div>
    );
  }

  if (active.kind === "app") {
    const a = index.applications.find((x) => x.id === active.id);
    if (!a) return <Empty />;
    return (
      <div className="p-4 space-y-3 overflow-y-auto h-full">
        <Header icon={AppWindow} title={a.name} subtitle={a.vendor ?? "No vendor"} />
        {a.description && (
          <p className="text-[12px] leading-relaxed text-muted-foreground line-clamp-4">
            {a.description}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {a.lifecycle && (
            <Chip cls={LIFECYCLE_COLOR[a.lifecycle] ?? "bg-muted text-muted-foreground"}>
              {a.lifecycle}
            </Chip>
          )}
          {a.rationalizationStatus && (
            <Chip cls="bg-muted text-muted-foreground">{a.rationalizationStatus}</Chip>
          )}
        </div>
        <Grid
          rows={[
            ["Business value", a.businessValue ?? "—"],
            ["Technical health", a.technicalHealth ?? "—"],
            ["Alias", a.alias ?? "—"],
          ]}
        />
      </div>
    );
  }

  if (active.kind === "cap") {
    const c = index.capabilities.find((x) => x.id === active.id);
    if (!c) return <Empty />;
    return (
      <div className="p-4 space-y-3 overflow-y-auto h-full">
        <Header icon={Network} title={c.name} subtitle={c.level} />
        {c.description ? (
          <p className="text-[12px] leading-relaxed text-muted-foreground line-clamp-6">
            {c.description}
          </p>
        ) : (
          <p className="text-[12px] italic text-muted-foreground">No description</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          <Chip cls="bg-muted text-muted-foreground">Level {c.level}</Chip>
        </div>
      </div>
    );
  }

  if (active.kind === "risk") {
    const r = index.risks.find((x) => x.id === active.id);
    if (!r) return <Empty />;
    const scoreColor =
      r.riskScore >= 60
        ? "text-rose-600"
        : r.riskScore >= 30
        ? "text-amber-600"
        : "text-emerald-600";
    return (
      <div className="p-4 space-y-3 overflow-y-auto h-full">
        <Header icon={ShieldAlert} title={r.title} subtitle={r.category} />
        {r.description && (
          <p className="text-[12px] leading-relaxed text-muted-foreground line-clamp-4">
            {r.description}
          </p>
        )}
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Score</p>
            <p className={`text-xl font-semibold ${scoreColor}`}>{r.riskScore}</p>
          </div>
          <Chip cls={STATUS_COLOR[r.status] ?? "bg-muted text-muted-foreground"}>
            {r.status}
          </Chip>
        </div>
      </div>
    );
  }

  if (active.kind === "init") {
    const i = index.initiatives.find((x) => x.id === active.id);
    if (!i) return <Empty />;
    return (
      <div className="p-4 space-y-3 overflow-y-auto h-full">
        <Header icon={MapIcon} title={i.name} subtitle={i.horizon} />
        {i.description && (
          <p className="text-[12px] leading-relaxed text-muted-foreground line-clamp-5">
            {i.description}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          <Chip cls="bg-muted text-muted-foreground">{i.status}</Chip>
          <Chip cls="bg-purple-50 text-purple-700">{i.horizon}</Chip>
        </div>
      </div>
    );
  }

  return <Empty />;
}

function Empty() {
  return (
    <div className="h-full flex items-center justify-center">
      <p className="text-[12px] text-muted-foreground">Item not found in index.</p>
    </div>
  );
}

function Header({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-foreground leading-tight truncate">
          {title}
        </p>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function Chip({ children, cls }: { children: React.ReactNode; cls: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium ${cls}`}>
      {children}
    </span>
  );
}

function Grid({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px]">
      {rows.map(([k, v]) => (
        <div key={k} className="col-span-2 flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground uppercase tracking-wider text-[10px]">{k}</dt>
          <dd className="text-foreground text-right truncate">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
