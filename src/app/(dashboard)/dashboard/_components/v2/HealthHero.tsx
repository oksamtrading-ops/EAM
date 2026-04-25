"use client";

import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { StatTile } from "@/components/ui/stat-tile";
import { Sparkline } from "@/components/ui/sparkline";

/**
 * HealthHero — the engagement-health hero card. One composite score
 * on the left (display weight + tabular numerals), trend sparkline
 * in the center, component breakdown on the right. Wraps to single
 * column below the lg breakpoint.
 */
export function HealthHero() {
  const { data, isLoading } = trpc.dashboardV2.healthScore.useQuery({
    sinceDays: 30,
  });

  // Loading skeleton — keep the same height so the layout doesn't
  // jump when data arrives. Hero stat tile is ~12rem tall.
  if (isLoading || !data) {
    return (
      <div className="rounded-2xl glass-strong ring-glow-soft p-7 min-h-[14rem] animate-pulse" />
    );
  }

  const { score, components, trend, verdict } = data;
  const Icon =
    verdict.tone === "success"
      ? TrendingUp
      : verdict.tone === "danger"
        ? TrendingDown
        : Minus;

  return (
    <div
      className="rounded-2xl glass-strong p-5 sm:p-7 ring-1 ring-[var(--ai)]/10"
      style={{
        boxShadow:
          "0 0 0 1px rgba(124, 58, 237, 0.06), 0 8px 32px -12px rgba(124, 58, 237, 0.12)",
      }}
    >
      <StatTile
        layout="hero"
        label="Engagement Health"
        eyebrow={Activity}
        primary={String(score)}
        primarySize="hero"
        verdict={{ text: verdict.text, tone: verdict.tone }}
        body={
          <>
            Composite of architecture health, knowledge freshness, risk
            posture, and agent reliability.{" "}
            <Icon
              className="inline h-3 w-3 align-[-1px]"
              aria-hidden="true"
            />
          </>
        }
        sparkline={
          <Sparkline
            data={trend}
            variant="trail"
            height={120}
            color="var(--ai)"
            endDot
            ariaLabel="30-day engagement health trend"
          />
        }
        components={components.map((c) => ({
          label: c.label,
          value: c.score,
          tone: c.tone,
        }))}
      />
    </div>
  );
}
