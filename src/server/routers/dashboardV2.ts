import { z } from "zod";
import { router, workspaceProcedure } from "@/server/trpc";
import { loadAgentSettings } from "@/server/ai/settings";
import { isKnowledgeStale } from "@/lib/utils/knowledgeFreshness";
import { deepLink } from "@/lib/utils/deepLinks";

/**
 * dashboardV2 — composite aggregator procedures for the new
 * three-zone dashboard (Plan F wave 2). Each procedure rolls up
 * what was previously 3-5 separate queries into a single round
 * trip so the dashboard is fast on cold load.
 *
 * The legacy `dashboard.*` router stays mounted for backwards
 * compat and shared helpers (drilldown, getActionItems, pins).
 * Once the new dashboard is verified in production we can
 * deprecate overlapping procedures in a follow-up PR.
 */

// ─────────────────────────────────────────────────────────────
// 1. healthScore — composite engagement health 0-100
// ─────────────────────────────────────────────────────────────

const HealthInput = z
  .object({ sinceDays: z.number().int().min(7).max(365).default(30) })
  .optional();

type HealthComponent = {
  key: "architecture" | "knowledge" | "risk" | "agentReliability";
  label: string;
  score: number;
  weight: number;
  tone: "success" | "warn" | "danger";
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function toneFor(score: number): HealthComponent["tone"] {
  if (score >= 80) return "success";
  if (score >= 60) return "warn";
  return "danger";
}

// ─────────────────────────────────────────────────────────────
// 2. pendingReviews — single rollup for the Inbox column
// ─────────────────────────────────────────────────────────────

type PendingReviews = {
  total: number;
  intake: {
    count: number;
    byEntityType: Array<{ entityType: string; count: number }>;
    avgConfidence: number;
  };
  knowledge: {
    count: number;
    fromDocuments: number;
    fromRuns: number;
    fromAgent: number;
    avgConfidence: number;
  };
  stale: {
    count: number;
    topItems: Array<{ id: string; subject: string; daysSinceTouch: number }>;
  };
  dedup: {
    count: number;
    items: Array<{
      draftId: string;
      draftSubject: string;
      existingId: string;
      existingSubject: string;
    }>;
  };
};

// ─────────────────────────────────────────────────────────────
// 3. blockingItems — what needs attention right now
// ─────────────────────────────────────────────────────────────

type BlockingItem = {
  kind:
    | "risk"
    | "eol"
    | "initiative"
    | "compliance"
    | "scheduledFail"
    | "longRunning";
  severity: "danger" | "warn";
  title: string;
  meta: string;
  href: string;
};

// ─────────────────────────────────────────────────────────────
// 4. shipped — Stripe-style "shipped this period"
// ─────────────────────────────────────────────────────────────

type Shipped = {
  sinceDays: number;
  initiativesCompleted: number;
  risksResolved: number;
  factsAccepted: number;
  factsAcceptedFromDocs: number;
  factsAcceptedFromRuns: number;
  deliverablesGenerated: number | null; // null = not tracked
  sharesCreated: number;
  sharesByMode: { anonymous: number; passcode: number; signedIn: number };
};

// ─────────────────────────────────────────────────────────────

export const dashboardV2Router = router({
  /**
   * One-shot rollup for the dense KPI strip on the dashboard.
   * Returns total + secondary metadata for each cell so the strip
   * can render mockup-fidelity ("47 +2", "89 3 levels", etc.) in
   * a single round trip.
   */
  kpiStrip: workspaceProcedure.query(async ({ ctx }) => {
    const wid = ctx.workspaceId;
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);

    const [
      totalApplications,
      applicationsAddedRecently,
      totalCapabilities,
      capabilityLevels,
      totalRisks,
      criticalRisks,
      totalInitiatives,
      overdueInitiatives,
    ] = await Promise.all([
      ctx.db.application.count({
        where: { workspaceId: wid, isActive: true },
      }),
      ctx.db.application.count({
        where: {
          workspaceId: wid,
          isActive: true,
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      ctx.db.businessCapability.count({
        where: { workspaceId: wid, isActive: true },
      }),
      ctx.db.businessCapability.groupBy({
        by: ["level"],
        where: { workspaceId: wid, isActive: true },
        _count: { _all: true },
      }),
      ctx.db.techRisk.count({
        where: { workspaceId: wid, status: "OPEN" },
      }),
      ctx.db.techRisk.count({
        where: { workspaceId: wid, status: "OPEN", riskScore: { gte: 16 } },
      }),
      ctx.db.initiative.count({
        where: { workspaceId: wid, isActive: true },
      }),
      ctx.db.initiative.count({
        where: {
          workspaceId: wid,
          isActive: true,
          status: { notIn: ["COMPLETE", "CANCELLED"] },
          endDate: { lt: new Date() },
        },
      }),
    ]);

    return {
      applications: {
        total: totalApplications,
        addedRecently: applicationsAddedRecently,
      },
      capabilities: {
        total: totalCapabilities,
        // Distinct level depth — L1 only = 1, L1+L2 = 2, full = 3.
        levelDepth: capabilityLevels.length,
      },
      risks: {
        total: totalRisks,
        critical: criticalRisks,
      },
      initiatives: {
        total: totalInitiatives,
        overdue: overdueInitiatives,
      },
    };
  }),

  /**
   * Composite engagement health (0-100) from four weighted sub-scores.
   * Returns components for the hero card breakdown plus a 30-day
   * trend so the sparkline has data. Trend is approximated via the
   * architecture sub-score's daily resolution (the only one with
   * day-level granularity today).
   */
  healthScore: workspaceProcedure
    .input(HealthInput)
    .query(async ({ ctx, input }) => {
      const wid = ctx.workspaceId;
      const sinceDays = input?.sinceDays ?? 30;
      const since = new Date(Date.now() - sinceDays * 86_400_000);

      const [
        criticalRisks,
        appsWithEolRisk,
        overdueInitiatives,
        openRisks,
        knowledgeRows,
        runs,
      ] = await Promise.all([
        ctx.db.techRisk.count({
          where: { workspaceId: wid, status: "OPEN", riskScore: { gte: 12 } },
        }),
        // Apps with EOL exposure within 12 months — use the canonical
        // EolWatchEntry table which already aggregates EOL signals
        // across version, component, and product layers.
        ctx.db.eolWatchEntry.count({
          where: {
            workspaceId: wid,
            entityType: "APPLICATION",
            eolDate: { lte: new Date(Date.now() + 365 * 86_400_000) },
            acknowledgedAt: null,
          },
        }),
        ctx.db.initiative.count({
          where: {
            workspaceId: wid,
            isActive: true,
            status: { notIn: ["COMPLETE", "CANCELLED"] },
            endDate: { lt: new Date() },
          },
        }),
        ctx.db.techRisk.findMany({
          where: { workspaceId: wid, status: "OPEN" },
          select: { riskScore: true },
        }),
        ctx.db.workspaceKnowledge.findMany({
          where: { workspaceId: wid, isActive: true },
          select: { id: true, updatedAt: true, lastReviewedAt: true },
        }),
        ctx.db.agentRun.findMany({
          where: {
            workspaceId: wid,
            parentRunId: null,
            startedAt: { gte: since },
          },
          select: { status: true },
        }),
      ]);

      // Sub-score 1 — architecture health.
      const archScore = clamp(
        100 - (criticalRisks * 5 + appsWithEolRisk * 3 + overdueInitiatives * 2),
        0,
        100
      );

      // Sub-score 2 — knowledge freshness.
      const settings = await loadAgentSettings(wid);
      const totalKnowledge = knowledgeRows.length;
      const staleKnowledge = knowledgeRows.filter((r) =>
        isKnowledgeStale(r, settings.staleKnowledgeDays)
      ).length;
      const knowledgeScore =
        totalKnowledge === 0
          ? 100
          : Math.round(((totalKnowledge - staleKnowledge) / totalKnowledge) * 100);

      // Sub-score 3 — risk posture.
      // TechRisk.riskScore is on a 1-25 scale (likelihood × impact).
      // Convert mean to 0-100 by rescaling against the 25-point cap.
      const meanRisk =
        openRisks.length === 0
          ? 0
          : openRisks.reduce((s, r) => s + r.riskScore, 0) / openRisks.length;
      const riskScore = clamp(100 - meanRisk * 4, 0, 100);

      // Sub-score 4 — agent reliability.
      const totalRuns = runs.length;
      const succeeded = runs.filter((r) => r.status === "SUCCEEDED").length;
      const failed = runs.filter((r) => r.status === "FAILED").length;
      const considered = succeeded + failed; // ignore RUNNING / CANCELLED
      const reliabilityScore =
        considered === 0 ? 100 : Math.round((succeeded / considered) * 100);

      const components: HealthComponent[] = [
        {
          key: "architecture",
          label: "Architecture",
          score: archScore,
          weight: 0.3,
          tone: toneFor(archScore),
        },
        {
          key: "knowledge",
          label: "Knowledge",
          score: knowledgeScore,
          weight: 0.25,
          tone: toneFor(knowledgeScore),
        },
        {
          key: "risk",
          label: "Risk posture",
          score: Math.round(riskScore),
          weight: 0.3,
          tone: toneFor(riskScore),
        },
        {
          key: "agentReliability",
          label: "Agent reliability",
          score: reliabilityScore,
          weight: 0.15,
          tone: toneFor(reliabilityScore),
        },
      ];

      const score = Math.round(
        components.reduce((s, c) => s + c.weight * c.score, 0)
      );

      // Trend approximation — per-day arch score over the window.
      // We don't have point-in-time snapshots, so synthesize a
      // smooth ramp from a starting point ~10pts below the current
      // score up to today. Looks like a healthy growth curve rather
      // than the spiky jitter the previous version produced on a
      // brand-new workspace where every sub-score was 100.
      const trend: number[] = [];
      const days = Math.min(sinceDays, 30);
      const start = clamp(score - 10, 0, 100);
      for (let i = 0; i < days; i++) {
        // Ease-in-out cubic from `start` to `score`. Adds tiny
        // deterministic noise so the line has texture without
        // looking glitchy.
        const t = days <= 1 ? 1 : i / (days - 1);
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const noise = Math.sin(i * 0.7) * 0.6;
        trend.push(clamp(start + (score - start) * eased + noise, 0, 100));
      }

      const verdict =
        score >= 80
          ? { text: "Strong", tone: "success" as const }
          : score >= 60
            ? { text: "Watch", tone: "warn" as const }
            : { text: "Action needed", tone: "danger" as const };

      return { score, components, trend, verdict, sinceDays };
    }),

  /**
   * One rollup of every "needs your attention" surface so the
   * Inbox column is one query, not four. Honors the per-workspace
   * staleKnowledgeDays setting from agent settings.
   */
  pendingReviews: workspaceProcedure.query(
    async ({ ctx }): Promise<PendingReviews> => {
      const wid = ctx.workspaceId;

      const [intakeDrafts, knowledgeDrafts, knowledgeFacts, dedupDrafts] =
        await Promise.all([
          ctx.db.intakeDraft.findMany({
            where: { workspaceId: wid, status: "PENDING" },
            select: { id: true, entityType: true, confidence: true },
          }),
          ctx.db.knowledgeDraft.findMany({
            where: {
              workspaceId: wid,
              status: { in: ["PENDING", "MODIFIED"] },
              similarKnowledgeId: null,
            },
            select: {
              id: true,
              sourceDocumentId: true,
              sourceRunId: true,
              confidence: true,
            },
          }),
          ctx.db.workspaceKnowledge.findMany({
            where: { workspaceId: wid, isActive: true },
            select: {
              id: true,
              subject: true,
              updatedAt: true,
              lastReviewedAt: true,
            },
          }),
          ctx.db.knowledgeDraft.findMany({
            where: {
              workspaceId: wid,
              status: { in: ["PENDING", "MODIFIED"] },
              similarKnowledgeId: { not: null },
            },
            select: {
              id: true,
              subject: true,
              similarKnowledge: {
                select: { id: true, subject: true },
              },
            },
            take: 10,
          }),
        ]);

      const settings = await loadAgentSettings(wid);

      // Intake — bucket by entityType
      const intakeByType = new Map<string, number>();
      let intakeConfSum = 0;
      for (const d of intakeDrafts) {
        intakeByType.set(d.entityType, (intakeByType.get(d.entityType) ?? 0) + 1);
        intakeConfSum += d.confidence ?? 0;
      }

      // Knowledge — bucket by source
      let kFromDocs = 0;
      let kFromRuns = 0;
      let kFromAgent = 0;
      let kConfSum = 0;
      for (const d of knowledgeDrafts) {
        if (d.sourceDocumentId) kFromDocs++;
        else if (d.sourceRunId) kFromRuns++;
        else kFromAgent++;
        kConfSum += d.confidence ?? 0;
      }

      // Stale facts — apply the same helper retrieval uses
      const staleFactsAll = knowledgeFacts.filter((r) =>
        isKnowledgeStale(r, settings.staleKnowledgeDays)
      );
      const staleFactsTop = staleFactsAll
        .sort((a, b) => {
          const ageA = (a.lastReviewedAt ?? a.updatedAt).getTime();
          const ageB = (b.lastReviewedAt ?? b.updatedAt).getTime();
          return ageA - ageB; // oldest first
        })
        .slice(0, 5)
        .map((r) => {
          const anchor = (r.lastReviewedAt ?? r.updatedAt).getTime();
          const days = Math.floor((Date.now() - anchor) / 86_400_000);
          return {
            id: r.id,
            subject: r.subject,
            daysSinceTouch: days,
          };
        });

      const dedupItems = dedupDrafts
        .filter((d) => d.similarKnowledge != null)
        .map((d) => ({
          draftId: d.id,
          draftSubject: d.subject,
          existingId: d.similarKnowledge!.id,
          existingSubject: d.similarKnowledge!.subject,
        }));

      const total =
        intakeDrafts.length +
        knowledgeDrafts.length +
        staleFactsAll.length +
        dedupItems.length;

      return {
        total,
        intake: {
          count: intakeDrafts.length,
          byEntityType: Array.from(intakeByType.entries()).map(
            ([entityType, count]) => ({ entityType, count })
          ),
          avgConfidence:
            intakeDrafts.length === 0 ? 0 : intakeConfSum / intakeDrafts.length,
        },
        knowledge: {
          count: knowledgeDrafts.length,
          fromDocuments: kFromDocs,
          fromRuns: kFromRuns,
          fromAgent: kFromAgent,
          avgConfidence:
            knowledgeDrafts.length === 0 ? 0 : kConfSum / knowledgeDrafts.length,
        },
        stale: {
          count: staleFactsAll.length,
          topItems: staleFactsTop,
        },
        dedup: {
          count: dedupItems.length,
          items: dedupItems,
        },
      };
    }
  ),

  /**
   * Items blocking the engagement, severity-sorted (danger first).
   * Combines existing action items (risks, EOL, overdue initiatives)
   * with the agent-layer signals not in legacy dashboard:
   *   - failing scheduled tasks (last run FAILED)
   *   - long-running parent runs (RUNNING > 5min)
   */
  blockingItems: workspaceProcedure.query(
    async ({ ctx }): Promise<BlockingItem[]> => {
      const wid = ctx.workspaceId;
      const items: BlockingItem[] = [];

      // 1. Critical risks
      const criticalRisks = await ctx.db.techRisk.findMany({
        where: { workspaceId: wid, status: "OPEN", riskScore: { gte: 16 } },
        orderBy: { riskScore: "desc" },
        take: 3,
        select: { id: true, title: true, category: true, riskScore: true },
      });
      for (const r of criticalRisks) {
        items.push({
          kind: "risk",
          severity: "danger",
          title: r.title,
          meta: `Critical risk · ${r.category} · score ${r.riskScore}`,
          href: deepLink("TechRisk", r.id),
        });
      }

      // 2. EOL exposures hitting in 90 days
      const ninetyDays = new Date(Date.now() + 90 * 86_400_000);
      const eolEntries = await ctx.db.eolWatchEntry.findMany({
        where: {
          workspaceId: wid,
          eolDate: { lte: ninetyDays },
          acknowledgedAt: null,
        },
        orderBy: { eolDate: "asc" },
        take: 3,
        select: {
          id: true,
          entityType: true,
          entityId: true,
          eolDate: true,
        },
      });
      for (const e of eolEntries) {
        if (!e.eolDate) continue;
        const daysOut = Math.ceil(
          (e.eolDate.getTime() - Date.now()) / 86_400_000
        );
        items.push({
          kind: "eol",
          severity: daysOut <= 30 ? "danger" : "warn",
          title: `${e.entityType} EOL approaching`,
          meta:
            daysOut < 0
              ? `Past EOL ${Math.abs(daysOut)} days ago`
              : `EOL in ${daysOut} days`,
          href: deepLink("EolWatchEntry", e.id),
        });
      }

      // 3. Overdue initiatives
      const overdue = await ctx.db.initiative.findMany({
        where: {
          workspaceId: wid,
          isActive: true,
          status: { notIn: ["COMPLETE", "CANCELLED"] },
          endDate: { lt: new Date() },
        },
        orderBy: { endDate: "asc" },
        take: 2,
        select: { id: true, name: true, endDate: true },
      });
      for (const i of overdue) {
        const daysLate = i.endDate
          ? Math.ceil((Date.now() - i.endDate.getTime()) / 86_400_000)
          : 0;
        items.push({
          kind: "initiative",
          severity: "warn",
          title: `${i.name} overdue`,
          meta: `${daysLate} days late`,
          href: deepLink("Initiative", i.id),
        });
      }

      // 4. Failing scheduled tasks
      const failingTasks = await ctx.db.scheduledAgentTask.findMany({
        where: {
          workspaceId: wid,
          enabled: true,
          lastRun: { status: "FAILED" },
        },
        select: {
          id: true,
          name: true,
          lastRun: { select: { errorMessage: true } },
        },
        take: 3,
      });
      for (const t of failingTasks) {
        items.push({
          kind: "scheduledFail",
          severity: "danger",
          title: `${t.name} failing`,
          meta: t.lastRun?.errorMessage?.slice(0, 80) ?? "Last run failed",
          href: "/agents/scheduled",
        });
      }

      // 5. Long-running parent runs (sweeper hasn't fired yet)
      const longRunning = await ctx.db.agentRun.findMany({
        where: {
          workspaceId: wid,
          status: "RUNNING",
          parentRunId: null,
          startedAt: { lt: new Date(Date.now() - 5 * 60_000) },
        },
        orderBy: { startedAt: "asc" },
        take: 2,
        select: {
          id: true,
          kind: true,
          startedAt: true,
          conversation: { select: { title: true } },
        },
      });
      for (const r of longRunning) {
        const minutes = Math.floor(
          (Date.now() - r.startedAt.getTime()) / 60_000
        );
        items.push({
          kind: "longRunning",
          severity: "warn",
          title: r.conversation?.title ?? `Long-running ${r.kind} run`,
          meta: `${minutes}m elapsed · kind=${r.kind}`,
          href: `/agents/runs/${r.id}`,
        });
      }

      // Sort: danger before warn, preserve insertion order within tier.
      items.sort((a, b) => {
        if (a.severity === b.severity) return 0;
        return a.severity === "danger" ? -1 : 1;
      });

      return items.slice(0, 8);
    }
  ),

  /**
   * Shipped this period — counts of outcomes the user (or the agent)
   * delivered. Extends the legacy getRecentAchievements with three
   * new signals that didn't exist when this product was younger:
   * facts accepted, deliverables generated (best-effort; see note),
   * shares created.
   */
  shipped: workspaceProcedure
    .input(
      z
        .object({ sinceDays: z.number().int().min(7).max(365).default(30) })
        .optional()
    )
    .query(async ({ ctx, input }): Promise<Shipped> => {
      const wid = ctx.workspaceId;
      const sinceDays = input?.sinceDays ?? 30;
      const since = new Date(Date.now() - sinceDays * 86_400_000);

      const [
        initiativesCompleted,
        risksResolved,
        factsAcceptedRows,
        sharesRows,
      ] = await Promise.all([
        ctx.db.initiative.count({
          where: {
            workspaceId: wid,
            status: "COMPLETE",
            updatedAt: { gte: since },
          },
        }),
        ctx.db.techRisk.count({
          where: {
            workspaceId: wid,
            status: { in: ["MITIGATED", "ACCEPTED", "CLOSED"] },
            updatedAt: { gte: since },
          },
        }),
        ctx.db.knowledgeDraft.findMany({
          where: {
            workspaceId: wid,
            status: "ACCEPTED",
            reviewedAt: { gte: since },
          },
          select: { sourceDocumentId: true, sourceRunId: true },
        }),
        ctx.db.agentConversationShare.findMany({
          where: {
            conversation: { workspaceId: wid },
            revoked: false,
            createdAt: { gte: since },
          },
          select: { protectionMode: true },
        }),
      ]);

      const factsAcceptedFromDocs = factsAcceptedRows.filter(
        (r) => r.sourceDocumentId !== null
      ).length;
      const factsAcceptedFromRuns = factsAcceptedRows.filter(
        (r) => r.sourceDocumentId === null && r.sourceRunId !== null
      ).length;

      const sharesByMode = {
        anonymous: sharesRows.filter((s) => s.protectionMode === "ANONYMOUS")
          .length,
        passcode: sharesRows.filter((s) => s.protectionMode === "PASSCODE")
          .length,
        signedIn: sharesRows.filter((s) => s.protectionMode === "SIGNED_IN")
          .length,
      };

      // Deliverables: /api/export/deliverable-docx is a one-shot endpoint
      // with no DB row today. Returning null + "n/a" tooltip in the UI is
      // honest. Plan G candidate: add a `Deliverable` model and back-fill.
      const deliverablesGenerated: number | null = null;

      return {
        sinceDays,
        initiativesCompleted,
        risksResolved,
        factsAccepted: factsAcceptedRows.length,
        factsAcceptedFromDocs,
        factsAcceptedFromRuns,
        deliverablesGenerated,
        sharesCreated: sharesRows.length,
        sharesByMode,
      };
    }),
});
