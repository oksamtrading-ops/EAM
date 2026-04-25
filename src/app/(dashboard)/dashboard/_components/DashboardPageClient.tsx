"use client";

import { useState } from "react";
import type { DateRangeKey } from "@/lib/contracts/dashboard";

import { DashboardAIPanel } from "./DashboardAIPanel";
import { DashboardShell } from "./v2/DashboardShell";
import { HealthHero } from "./v2/HealthHero";
import { KpiStripDense } from "./v2/KpiStripDense";
import { BlockingColumn } from "./v2/BlockingColumn";
import { InboxColumn } from "./v2/InboxColumn";
import { AgentActivityCard } from "./v2/AgentActivityCard";
import { PortfolioCostCard } from "./v2/PortfolioCostCard";
import { ShippedCard } from "./v2/ShippedCard";
import { PinnedAndActivityCard } from "./v2/PinnedAndActivityCard";

/**
 * DashboardPageClient — three-zone reference implementation
 * (Plan F wave 2). Mirrors the mockup at mockup/dashboard.html.
 *
 * Zone 1 — Engagement health (full-width hero + dense KPI strip)
 * Zone 2 — Today (Blocking | Inbox)
 * Zone 3 — Activity & Spend (Agent activity | Shipped | Pinned)
 *
 * Mobile: everything stacks. Tablet: KPI strip stays 6-col, Today
 * goes 2-col, Zone 3 stays stacked. Desktop (lg+): full layout.
 */
export function DashboardPageClient() {
  const [dateRange, setDateRange] = useState<DateRangeKey>("30d");
  const [showAI, setShowAI] = useState(false);

  return (
    <>
      <div className="dashboard-surface min-h-full">
        <DashboardShell
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          onAIBrief={() => setShowAI((v) => !v)}
        >
          <div className="px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
            {/* ─── Zone 1 — Engagement health ─────────────────── */}
            <HealthHero />
            <KpiStripDense />

            {/* ─── Zone 2 — Portfolio cost ────────────────────── */}
            <PortfolioCostCard />

            {/* ─── Zone 3 — Today ─────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <BlockingColumn />
              <InboxColumn />
            </div>

            {/* ─── Zone 4 — Activity & Spend ──────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              <AgentActivityCard dateRange={dateRange} />
              <ShippedCard dateRange={dateRange} />
              <PinnedAndActivityCard />
            </div>
          </div>
        </DashboardShell>
      </div>

      <DashboardAIPanel open={showAI} onClose={() => setShowAI(false)} />
    </>
  );
}
