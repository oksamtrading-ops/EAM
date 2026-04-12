"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { dateRangeToSince } from "@/lib/utils/dateRange";
import type { DateRangeKey } from "@/lib/contracts/dashboard";

import { DateRangeSelect } from "./DateRangeSelect";
import { KpiStripV2 } from "./KpiStripV2";
import { AppPortfolioHealthChart } from "./AppPortfolioHealthChart";
import { CapabilityMaturityChart } from "./CapabilityMaturityChart";
import { ActionRequiredFeed } from "./ActionRequiredFeed";
import { RecentAchievementsCard } from "./RecentAchievementsCard";
import { ActivityFeed } from "./ActivityFeed";
import { PinnedItemsCard } from "./PinnedItemsCard";
import { CostByDomainChart } from "./CostByDomainChart";

export function DashboardPageClient() {
  const [dateRange, setDateRange] = useState<DateRangeKey>("30d");
  const since = dateRangeToSince(dateRange);

  // KPI summary — uses the proven getSummary (no date filter, all-time counts)
  const { data: kpis, isLoading: kpisLoading, isError: kpisError } = trpc.dashboard.getSummary.useQuery();
  const { data: appHealth, isLoading: appHealthLoading } = trpc.dashboard.getAppHealthDistribution.useQuery();
  const { data: capMaturity = [], isLoading: capMaturityLoading } = trpc.dashboard.getCapabilityMaturityByDomain.useQuery();
  const { data: costByDomain = [], isLoading: costByDomainLoading } = trpc.dashboard.getCostByDomain.useQuery();
  const { data: achievements = [], isLoading: achievementsLoading } = trpc.dashboard.getRecentAchievements.useQuery({ since });
  const { data: actionItems = [] } = trpc.dashboard.getActionItems.useQuery();
  const { data: activity = [] } = trpc.dashboard.getActivity.useQuery({ limit: 20 });
  const { data: pins = [] } = trpc.dashboard.getPins.useQuery();

  const utils = trpc.useUtils();
  const unpinMutation = trpc.dashboard.unpin.useMutation({
    onSuccess: () => utils.dashboard.getPins.invalidate(),
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Executive Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time overview of architecture portfolio and health metrics
          </p>
        </div>
        <div className="flex-shrink-0 pt-0.5">
          <DateRangeSelect value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {/* KPI Strip */}
      <KpiStripV2
        kpis={kpis ?? null}
        loading={kpisLoading}
        isError={kpisError}
      />

      {/* Charts row 1: Portfolio Health + IT Spend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AppPortfolioHealthChart
          data={appHealth ?? null}
          loading={appHealthLoading}
        />
        <CostByDomainChart
          data={costByDomain}
          loading={costByDomainLoading}
          currency={kpis?.costCurrency ?? "USD"}
        />
      </div>

      {/* Charts row 2: Capability Maturity */}
      <CapabilityMaturityChart
        data={capMaturity}
        loading={capMaturityLoading}
      />

      {/* Action Required + Recent Achievements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActionRequiredFeed items={actionItems} />
        <RecentAchievementsCard items={achievements} loading={achievementsLoading} />
      </div>

      {/* Activity + Pinned */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActivityFeed entries={activity} />
        <PinnedItemsCard
          pins={pins}
          onUnpin={(id) => unpinMutation.mutate({ id })}
        />
      </div>
    </div>
  );
}
