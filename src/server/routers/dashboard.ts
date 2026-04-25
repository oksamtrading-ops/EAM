import { z } from "zod";
import { format, subMonths, startOfMonth } from "date-fns";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";
import { deepLink } from "@/lib/utils/deepLinks";
import type {
  DashboardKpis,
  ActionItem,
  ActivityEntry,
  PinnedItem,
  CostByDomain,
  DashboardKpisV2,
  MigrationTrendPoint,
  AppHealthDistribution,
  CapabilityMaturityDomain,
  RecentAchievement,
  DrillDownResult,
  DrillDownRow,
} from "@/lib/contracts/dashboard";

export const dashboardRouter = router({
  getSummary: workspaceProcedure.query(async ({ ctx }): Promise<DashboardKpis> => {
    const wid = ctx.workspaceId;
    const now = new Date();

    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      totalCapabilities,
      criticalCapabilities,
      totalApplications,
      appsWithEolRisk,
      openRisks,
      criticalRisks,
      overdueInitiatives,
      complianceReqs,
      costApps,
      upcomingRenewals,
    ] = await Promise.all([
      ctx.db.businessCapability.count({ where: { workspaceId: wid, isActive: true } }),
      ctx.db.businessCapability.count({
        where: { workspaceId: wid, isActive: true, strategicImportance: "CRITICAL" },
      }),
      ctx.db.application.count({ where: { workspaceId: wid, isActive: true } }),
      ctx.db.eolWatchEntry.count({
        where: { workspaceId: wid, urgencyBand: { in: ["EXPIRED", "URGENT"] } },
      }),
      ctx.db.techRisk.count({
        where: {
          workspaceId: wid,
          status: { notIn: ["CLOSED", "ACCEPTED"] },
        },
      }),
      ctx.db.techRisk.count({
        where: { workspaceId: wid, riskScore: { gte: 12 } },
      }),
      ctx.db.initiative.count({
        where: {
          workspaceId: wid,
          isActive: true,
          endDate: { lt: now },
          status: { notIn: ["COMPLETE", "CANCELLED"] },
        },
      }),
      ctx.db.complianceRequirement.findMany({
        where: { workspaceId: wid, isApplicable: true },
        select: {
          framework: true,
          mappings: { select: { status: true } },
        },
      }),
      ctx.db.application.findMany({
        where: { workspaceId: wid, isActive: true, annualCostUsd: { not: null } },
        select: { annualCostUsd: true, costCurrency: true },
      }),
      ctx.db.application.count({
        where: {
          workspaceId: wid,
          isActive: true,
          costRenewalDate: { gte: now, lte: thirtyDaysFromNow },
        },
      }),
    ]);

    // Compute avg compliance score across all frameworks
    let avgComplianceScore = 0;
    if (complianceReqs.length > 0) {
      const frameworkMap = new Map<string, { total: number; compliant: number }>();
      for (const req of complianceReqs) {
        const fw = req.framework as string;
        if (!frameworkMap.has(fw)) frameworkMap.set(fw, { total: 0, compliant: 0 });
        const entry = frameworkMap.get(fw)!;
        entry.total += 1;
        const bestMapping = req.mappings.find(
          (m) => m.status === "COMPLIANT" || m.status === "PARTIAL"
        );
        if (bestMapping?.status === "COMPLIANT") entry.compliant += 1;
        else if (bestMapping?.status === "PARTIAL") entry.compliant += 0.5;
      }
      const scores = Array.from(frameworkMap.values()).map(
        ({ total, compliant }) => (total > 0 ? (compliant / total) * 100 : 0)
      );
      avgComplianceScore =
        scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0;
    }

    // Total annual cost
    let totalAnnualCost = 0;
    const currencyCounts = new Map<string, number>();
    for (const app of costApps) {
      totalAnnualCost += Number(app.annualCostUsd ?? 0);
      const c = app.costCurrency ?? "USD";
      currencyCounts.set(c, (currencyCounts.get(c) ?? 0) + 1);
    }
    // Use the most common currency for display
    let costCurrency = "USD";
    let maxCount = 0;
    for (const [c, count] of currencyCounts) {
      if (count > maxCount) { costCurrency = c; maxCount = count; }
    }

    return {
      totalCapabilities,
      criticalCapabilities,
      totalApplications,
      appsWithEolRisk,
      openRisks,
      criticalRisks,
      avgComplianceScore,
      overdueInitiatives,
      totalAnnualCost: Math.round(totalAnnualCost),
      costCurrency,
      upcomingRenewals,
    };
  }),

  getActionItems: workspaceProcedure.query(async ({ ctx }): Promise<ActionItem[]> => {
    const wid = ctx.workspaceId;
    const now = new Date();
    const items: ActionItem[] = [];

    const [
      criticalRisks,
      highRisks,
      expiredEol,
      urgentEol,
      overdueInitiatives,
      unassessedReqs,
    ] = await Promise.all([
      ctx.db.techRisk.findMany({
        where: { workspaceId: wid, riskScore: { gte: 12 }, status: { in: ["OPEN", "IN_PROGRESS"] } },
        select: { id: true, title: true, category: true, riskScore: true },
        orderBy: { riskScore: "desc" },
        take: 5,
      }),
      ctx.db.techRisk.findMany({
        where: { workspaceId: wid, riskScore: { gte: 6, lt: 12 }, status: { in: ["OPEN", "IN_PROGRESS"] } },
        select: { id: true, title: true, category: true, riskScore: true },
        orderBy: { riskScore: "desc" },
        take: 5,
      }),
      ctx.db.eolWatchEntry.findMany({
        where: { workspaceId: wid, urgencyBand: "EXPIRED", isAcknowledged: false },
        select: { id: true, entityName: true, eolDate: true },
        take: 5,
      }),
      ctx.db.eolWatchEntry.findMany({
        where: { workspaceId: wid, urgencyBand: "URGENT", isAcknowledged: false },
        select: { id: true, entityName: true, eolDate: true },
        take: 5,
      }),
      ctx.db.initiative.findMany({
        where: { workspaceId: wid, isActive: true, endDate: { lt: now }, status: { notIn: ["COMPLETE", "CANCELLED"] } },
        select: { id: true, name: true, endDate: true, status: true },
        orderBy: { endDate: "asc" },
        take: 5,
      }),
      ctx.db.complianceRequirement.findMany({
        where: {
          workspaceId: wid,
          isApplicable: true,
          mappings: { none: {} },
        },
        select: { id: true, title: true, framework: true },
        take: 5,
      }),
    ]);

    for (const r of criticalRisks) {
      items.push({
        id: r.id,
        type: "RISK",
        severity: "critical",
        title: r.title,
        description: `Critical risk (score ${r.riskScore}) — ${r.category.replace(/_/g, " ")}`,
        href: deepLink("TechRisk", r.id),
      });
    }
    for (const e of expiredEol) {
      items.push({
        id: e.id,
        type: "EOL",
        severity: "critical",
        title: `${e.entityName} — EOL Expired`,
        description: e.eolDate
          ? `End-of-life was ${e.eolDate.toLocaleDateString()}`
          : "End-of-life date passed",
        href: deepLink("EolWatchEntry", e.id),
      });
    }
    for (const r of highRisks) {
      items.push({
        id: r.id,
        type: "RISK",
        severity: "high",
        title: r.title,
        description: `High risk (score ${r.riskScore}) — ${r.category.replace(/_/g, " ")}`,
        href: deepLink("TechRisk", r.id),
      });
    }
    for (const e of urgentEol) {
      items.push({
        id: e.id,
        type: "EOL",
        severity: "high",
        title: `${e.entityName} — EOL Urgent`,
        description: e.eolDate
          ? `End-of-life approaching ${e.eolDate.toLocaleDateString()}`
          : "EOL within 90 days",
        href: deepLink("EolWatchEntry", e.id),
      });
    }
    for (const i of overdueInitiatives) {
      items.push({
        id: i.id,
        type: "INITIATIVE",
        severity: "high",
        title: `${i.name} — Overdue`,
        description: `Status: ${i.status.replace(/_/g, " ")}${i.endDate ? ` · Due ${i.endDate.toLocaleDateString()}` : ""}`,
        href: deepLink("Initiative", i.id),
      });
    }
    for (const c of unassessedReqs) {
      items.push({
        id: c.id,
        type: "COMPLIANCE",
        severity: "medium",
        title: c.title,
        description: `${c.framework.replace(/_/g, " ")} — not yet assessed`,
        href: deepLink("ComplianceRequirement", c.id),
      });
    }

    return items.slice(0, 20);
  }),

  getActivity: workspaceProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }): Promise<ActivityEntry[]> => {
      const logs = await ctx.db.auditLog.findMany({
        where: { workspaceId: ctx.workspaceId },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        include: { user: { select: { name: true, email: true } } },
      });

      return logs.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        label: (log.after as Record<string, unknown>)?.name as string
          ?? (log.before as Record<string, unknown>)?.name as string
          ?? log.entityId,
        href: deepLink(log.entityType, log.entityId),
        actorName: log.user?.name ?? log.user?.email ?? "System",
        occurredAt: log.createdAt,
      }));
    }),

  getPins: workspaceProcedure.query(async ({ ctx }): Promise<PinnedItem[]> => {
    const pins = await ctx.db.dashboardPin.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return pins.map((p) => ({
      id: p.id,
      entityType: p.entityType,
      entityId: p.entityId,
      label: p.label,
      href: p.href,
      createdAt: p.createdAt,
    }));
  }),

  pin: workspaceProcedure
    .input(
      z.object({
        entityType: z.string(),
        entityId: z.string(),
        label: z.string(),
        href: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const pin = await ctx.db.dashboardPin.upsert({
        where: {
          workspaceId_entityType_entityId: {
            workspaceId: ctx.workspaceId,
            entityType: input.entityType,
            entityId: input.entityId,
          },
        },
        create: {
          workspaceId: ctx.workspaceId,
          createdById: ctx.dbUserId,
          ...input,
        },
        update: { label: input.label, href: input.href },
      });
      auditLog(ctx, { action: "CREATE", entityType: "DashboardPin", entityId: pin.id });
      return pin;
    }),

  unpin: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.dashboardPin.deleteMany({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      auditLog(ctx, { action: "DELETE", entityType: "DashboardPin", entityId: input.id });
      return { success: true };
    }),

  // ─── V2 procedures ─────────────────────────────────────────────────────────

  getSummaryV2: workspaceProcedure
    .input(z.object({ since: z.string().optional() }))
    .query(async ({ ctx, input }): Promise<DashboardKpisV2> => {
      const wid = ctx.workspaceId;
      const now = new Date();
      const since = input.since ? new Date(input.since) : undefined;

      const makeDelta = (current: number, previous: number, hasSince: boolean) => {
        const delta = hasSince ? current - previous : null;
        const direction = delta === null ? null : delta > 0 ? "up" : delta < 0 ? "down" : "flat";
        return { current, delta, direction } as DashboardKpisV2["totalApplications"];
      };

      const [
        totalApps,
        appsBeforeSince,
        totalCaps,
        capsBeforeSince,
        openRisks,
        risksBeforeSince,
        criticalRisks,
        appsWithEolRisk,
        overdueInitiatives,
        complianceReqs,
      ] = await Promise.all([
        ctx.db.application.count({ where: { workspaceId: wid, isActive: true } }),
        since
          ? ctx.db.application.count({ where: { workspaceId: wid, isActive: true, createdAt: { lt: since } } })
          : Promise.resolve(0),
        ctx.db.businessCapability.count({ where: { workspaceId: wid, isActive: true } }),
        since
          ? ctx.db.businessCapability.count({ where: { workspaceId: wid, isActive: true, createdAt: { lt: since } } })
          : Promise.resolve(0),
        ctx.db.techRisk.count({ where: { workspaceId: wid, status: { notIn: ["CLOSED", "ACCEPTED"] } } }),
        since
          ? ctx.db.techRisk.count({ where: { workspaceId: wid, status: { notIn: ["CLOSED", "ACCEPTED"] }, createdAt: { lt: since } } })
          : Promise.resolve(0),
        ctx.db.techRisk.count({ where: { workspaceId: wid, riskScore: { gte: 12 } } }),
        ctx.db.eolWatchEntry.count({ where: { workspaceId: wid, urgencyBand: { in: ["EXPIRED", "URGENT"] } } }),
        ctx.db.initiative.count({
          where: { workspaceId: wid, isActive: true, endDate: { lt: now }, status: { notIn: ["COMPLETE", "CANCELLED"] } },
        }),
        ctx.db.complianceRequirement.findMany({
          where: { workspaceId: wid, isApplicable: true },
          select: { framework: true, mappings: { select: { status: true } } },
        }),
      ]);

      // Compute avg compliance score
      let avgScore = 0;
      if (complianceReqs.length > 0) {
        const fwMap = new Map<string, { total: number; compliant: number }>();
        for (const req of complianceReqs) {
          const fw = req.framework as string;
          if (!fwMap.has(fw)) fwMap.set(fw, { total: 0, compliant: 0 });
          const entry = fwMap.get(fw)!;
          entry.total += 1;
          const best = req.mappings.find((m) => m.status === "COMPLIANT" || m.status === "PARTIAL");
          if (best?.status === "COMPLIANT") entry.compliant += 1;
          else if (best?.status === "PARTIAL") entry.compliant += 0.5;
        }
        const scores = Array.from(fwMap.values()).map(({ total, compliant }) =>
          total > 0 ? (compliant / total) * 100 : 0
        );
        avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      }

      return {
        totalApplications: makeDelta(totalApps, appsBeforeSince, !!since),
        totalCapabilities: makeDelta(totalCaps, capsBeforeSince, !!since),
        openRisks: makeDelta(openRisks, risksBeforeSince, !!since),
        avgComplianceScore: { current: avgScore, delta: null, direction: null },
        criticalRisks,
        appsWithEolRisk,
        overdueInitiatives,
      };
    }),

  getMigrationTrend: workspaceProcedure
    .input(z.object({ monthCount: z.number().int().min(3).max(24).default(12) }))
    .query(async ({ ctx, input }): Promise<MigrationTrendPoint[]> => {
      const wid = ctx.workspaceId;

      const apps = await ctx.db.application.findMany({
        where: { workspaceId: wid, isActive: true },
        select: { createdAt: true, deploymentModel: true },
        take: 5000,
      });

      const now = new Date();
      const points: MigrationTrendPoint[] = [];

      for (let i = input.monthCount - 1; i >= 0; i--) {
        const boundary = startOfMonth(subMonths(now, i));
        const label = format(boundary, "MMM yy");

        let Cloud = 0, OnPremise = 0, Hybrid = 0, SaaS = 0;
        for (const app of apps) {
          if (app.createdAt > boundary) continue;
          if (app.deploymentModel === "CLOUD_PUBLIC" || app.deploymentModel === "CLOUD_PRIVATE") Cloud++;
          else if (app.deploymentModel === "ON_PREMISE") OnPremise++;
          else if (app.deploymentModel === "HYBRID") Hybrid++;
          else if (app.deploymentModel === "SAAS_HOSTED") SaaS++;
        }

        points.push({ month: label, Cloud, OnPremise, Hybrid, SaaS });
      }

      return points;
    }),

  getAppHealthDistribution: workspaceProcedure.query(
    async ({ ctx }): Promise<AppHealthDistribution> => {
      const wid = ctx.workspaceId;
      const apps = await ctx.db.application.findMany({
        where: { workspaceId: wid, isActive: true },
        select: { technicalHealth: true },
      });

      let healthy = 0, warning = 0, critical = 0;
      for (const app of apps) {
        if (app.technicalHealth === "EXCELLENT" || app.technicalHealth === "GOOD") healthy++;
        else if (app.technicalHealth === "FAIR") warning++;
        else critical++; // POOR, TH_CRITICAL, TH_UNKNOWN
      }

      return { healthy, warning, critical, total: apps.length };
    }
  ),

  getCostByDomain: workspaceProcedure.query(
    async ({ ctx }): Promise<CostByDomain[]> => {
      const wid = ctx.workspaceId;

      // Get all active apps with their cost and capability mappings
      const apps = await ctx.db.application.findMany({
        where: { workspaceId: wid, isActive: true },
        select: {
          id: true,
          annualCostUsd: true,
          capabilities: { select: { capabilityId: true } },
        },
      });

      // Get L1 capabilities
      const caps = await ctx.db.businessCapability.findMany({
        where: { workspaceId: wid, isActive: true },
        select: { id: true, parentId: true, level: true, name: true },
      });

      // Build parent lookup: for any cap, find its L1 ancestor
      const capById = new Map(caps.map((c) => [c.id, c]));
      function findL1(capId: string): string | null {
        const cap = capById.get(capId);
        if (!cap) return null;
        if (cap.level === "L1") return cap.id;
        if (cap.parentId) return findL1(cap.parentId);
        return null;
      }

      // Aggregate cost per L1 domain. Each app's cost attributes to
      // exactly one bucket so the rollup reconciles to
      // `getSummary.totalAnnualCost`. Apps with no capability mapping
      // — or mapped only to caps that don't resolve to an L1 — land
      // in a synthetic "Unmapped" bucket so the breakdown is always
      // a complete picture of where cost lives.
      const domainMap = new Map<
        string,
        { totalCost: number; appIds: Set<string> }
      >();
      let unmappedCost = 0;
      const unmappedAppIds = new Set<string>();

      for (const app of apps) {
        const cost = Number(app.annualCostUsd ?? 0);
        if (cost <= 0) continue;

        // Find the first L1 ancestor among the app's mapped caps.
        // First-match keeps rollup deterministic and avoids the
        // double-counting bug where multi-mapped apps inflated
        // every domain they touched.
        let resolvedL1: string | null = null;
        for (const mapping of app.capabilities) {
          const l1 = findL1(mapping.capabilityId);
          if (l1) {
            resolvedL1 = l1;
            break;
          }
        }

        if (resolvedL1) {
          if (!domainMap.has(resolvedL1)) {
            domainMap.set(resolvedL1, { totalCost: 0, appIds: new Set() });
          }
          const entry = domainMap.get(resolvedL1)!;
          entry.totalCost += cost;
          entry.appIds.add(app.id);
        } else {
          // No mapping, or no mapping reached an L1 → unmapped.
          unmappedCost += cost;
          unmappedAppIds.add(app.id);
        }
      }

      const domains: CostByDomain[] = [];
      for (const [domainId, { totalCost, appIds }] of domainMap) {
        const cap = capById.get(domainId);
        if (cap) {
          domains.push({
            domainId,
            domain: cap.name,
            totalCost: Math.round(totalCost),
            appCount: appIds.size,
          });
        }
      }

      // Append the synthetic Unmapped bucket last so consumers can
      // pattern-match the reserved `__unmapped__` ID for special
      // styling (e.g. neutral zinc instead of an AI-fade color).
      if (unmappedCost > 0) {
        domains.push({
          domainId: "__unmapped__",
          domain: "Unmapped",
          totalCost: Math.round(unmappedCost),
          appCount: unmappedAppIds.size,
        });
      }

      return domains.sort((a, b) => b.totalCost - a.totalCost);
    }
  ),

  getCapabilityMaturityByDomain: workspaceProcedure.query(
    async ({ ctx }): Promise<CapabilityMaturityDomain[]> => {
      const wid = ctx.workspaceId;

      const MATURITY_NUMERIC: Record<string, number> = {
        INITIAL: 1,
        DEVELOPING: 2,
        DEFINED: 3,
        MANAGED: 4,
        OPTIMIZING: 5,
        NOT_ASSESSED: 0,
      };

      const caps = await ctx.db.businessCapability.findMany({
        where: { workspaceId: wid, isActive: true },
        select: { id: true, parentId: true, level: true, currentMaturity: true, name: true },
      });

      // Build child map
      const childMap = new Map<string, string[]>();
      const l1s = caps.filter((c) => c.level === "L1");
      for (const cap of caps) {
        if (cap.parentId) {
          if (!childMap.has(cap.parentId)) childMap.set(cap.parentId, []);
          childMap.get(cap.parentId)!.push(cap.id);
        }
      }

      const capById = new Map(caps.map((c) => [c.id, c]));

      function collectDescendants(id: string): string[] {
        const children = childMap.get(id) ?? [];
        return [id, ...children.flatMap(collectDescendants)];
      }

      const domains: CapabilityMaturityDomain[] = l1s.map((l1) => {
        const ids = collectDescendants(l1.id);
        const maturityValues = ids.map((id) => MATURITY_NUMERIC[capById.get(id)?.currentMaturity ?? "NOT_ASSESSED"] ?? 0);
        const avg = maturityValues.length > 0
          ? maturityValues.reduce((a, b) => a + b, 0) / maturityValues.length
          : 0;
        return {
          domainId: l1.id,
          domain: l1.name,
          avgMaturity: Math.round(avg * 10) / 10,
          count: ids.length,
        };
      });

      return domains.sort((a, b) => b.avgMaturity - a.avgMaturity);
    }
  ),

  getRecentAchievements: workspaceProcedure
    .input(z.object({ since: z.string().optional(), limit: z.number().int().min(1).max(20).default(8) }))
    .query(async ({ ctx, input }): Promise<RecentAchievement[]> => {
      const wid = ctx.workspaceId;
      const since = input.since ? new Date(input.since) : undefined;
      const achievements: RecentAchievement[] = [];

      const [completedInitiatives, resolvedRisks, acknowledgedEol] = await Promise.all([
        ctx.db.initiative.findMany({
          where: { workspaceId: wid, status: "COMPLETE", ...(since ? { updatedAt: { gte: since } } : {}) },
          select: { id: true, name: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
          take: input.limit,
        }),
        ctx.db.techRisk.findMany({
          where: { workspaceId: wid, status: { in: ["MITIGATED", "CLOSED"] }, ...(since ? { updatedAt: { gte: since } } : {}) },
          select: { id: true, title: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
          take: input.limit,
        }),
        ctx.db.eolWatchEntry.findMany({
          where: { workspaceId: wid, isAcknowledged: true, ...(since ? { updatedAt: { gte: since } } : {}) },
          select: { id: true, entityName: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
          take: input.limit,
        }),
      ]);

      for (const i of completedInitiatives) {
        achievements.push({
          id: i.id,
          type: "INITIATIVE_COMPLETE",
          title: i.name,
          description: "Initiative completed",
          completedAt: i.updatedAt,
          href: deepLink("Initiative", i.id),
        });
      }
      for (const r of resolvedRisks) {
        achievements.push({
          id: r.id,
          type: "RISK_RESOLVED",
          title: r.title,
          description: "Risk resolved",
          completedAt: r.updatedAt,
          href: deepLink("TechRisk", r.id),
        });
      }
      for (const e of acknowledgedEol) {
        achievements.push({
          id: e.id,
          type: "EOL_ACKNOWLEDGED",
          title: e.entityName,
          description: "EOL acknowledged",
          completedAt: e.updatedAt,
          href: deepLink("EolWatchEntry", e.id),
        });
      }

      return achievements.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime()).slice(0, input.limit);
    }),

  getDrillDownItems: workspaceProcedure
    .input(
      z.object({
        kind: z.enum(["apps_by_health", "risks", "capabilities_by_domain", "eol_risk", "overdue_initiatives"]),
        bucket: z.enum(["healthy", "warning", "critical"]).optional(),
        severity: z.enum(["critical", "high", "all"]).optional(),
        domainId: z.string().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }): Promise<DrillDownResult> => {
      const wid = ctx.workspaceId;
      const search = input.search?.trim();
      const items: DrillDownRow[] = [];

      if (input.kind === "apps_by_health") {
        const healthFilters: Record<string, string[]> = {
          healthy: ["EXCELLENT", "GOOD"],
          warning: ["FAIR"],
          critical: ["POOR", "TH_CRITICAL", "TH_UNKNOWN"],
        };
        const bucket = input.bucket ?? "critical";
        const apps = await ctx.db.application.findMany({
          where: {
            workspaceId: wid,
            isActive: true,
            technicalHealth: { in: healthFilters[bucket] as never[] },
            ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
          },
          select: { id: true, name: true, technicalHealth: true, lifecycle: true },
          orderBy: { name: "asc" },
          take: 50,
        });
        for (const app of apps) {
          items.push({
            id: app.id,
            label: app.name,
            sublabel: `${app.technicalHealth.replace("TH_", "")} · ${app.lifecycle}`,
            badge: bucket,
            badgeVariant: bucket === "healthy" ? "success" : bucket === "warning" ? "warning" : "destructive",
            href: deepLink("Application", app.id),
          });
        }
      } else if (input.kind === "risks") {
        const scoreFilter =
          input.severity === "critical" ? { gte: 12 } : input.severity === "high" ? { gte: 6, lt: 12 } : { gte: 1 };
        const risks = await ctx.db.techRisk.findMany({
          where: {
            workspaceId: wid,
            status: { notIn: ["CLOSED", "ACCEPTED"] },
            riskScore: scoreFilter,
            ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
          },
          select: { id: true, title: true, riskScore: true, status: true, category: true },
          orderBy: { riskScore: "desc" },
          take: 50,
        });
        for (const r of risks) {
          const sev = r.riskScore >= 12 ? "Critical" : r.riskScore >= 6 ? "High" : "Medium";
          items.push({
            id: r.id,
            label: r.title,
            sublabel: `Score ${r.riskScore} · ${r.category.replace(/_/g, " ")}`,
            badge: sev,
            badgeVariant: r.riskScore >= 12 ? "destructive" : r.riskScore >= 6 ? "warning" : "outline",
            href: deepLink("TechRisk", r.id),
          });
        }
      } else if (input.kind === "capabilities_by_domain") {
        const domainId = input.domainId;
        if (!domainId) return { items: [], total: 0 };

        // Collect all caps in the domain subtree
        const all = await ctx.db.businessCapability.findMany({
          where: { workspaceId: wid, isActive: true },
          select: { id: true, parentId: true, name: true, currentMaturity: true, level: true },
        });
        const childMap = new Map<string, string[]>();
        for (const c of all) {
          if (c.parentId) {
            if (!childMap.has(c.parentId)) childMap.set(c.parentId, []);
            childMap.get(c.parentId)!.push(c.id);
          }
        }
        const capById = new Map(all.map((c) => [c.id, c]));
        function collectIds(id: string): string[] {
          return [id, ...(childMap.get(id) ?? []).flatMap(collectIds)];
        }
        const ids = collectIds(domainId);
        const caps = ids
          .map((id) => capById.get(id))
          .filter((c): c is NonNullable<typeof c> => !!c)
          .filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()));

        for (const c of caps) {
          items.push({
            id: c.id,
            label: c.name,
            sublabel: `${c.level} · Maturity: ${c.currentMaturity.replace(/_/g, " ")}`,
            href: deepLink("BusinessCapability", c.id),
          });
        }
      } else if (input.kind === "eol_risk") {
        const entries = await ctx.db.eolWatchEntry.findMany({
          where: {
            workspaceId: wid,
            urgencyBand: { in: ["EXPIRED", "URGENT"] },
            isAcknowledged: false,
            ...(search ? { entityName: { contains: search, mode: "insensitive" } } : {}),
          },
          select: { id: true, entityName: true, eolDate: true, urgencyBand: true },
          orderBy: { eolDate: "asc" },
          take: 50,
        });
        for (const e of entries) {
          items.push({
            id: e.id,
            label: e.entityName,
            sublabel: e.eolDate ? `EOL: ${e.eolDate.toLocaleDateString()}` : "EOL date unknown",
            badge: e.urgencyBand,
            badgeVariant: e.urgencyBand === "EXPIRED" ? "destructive" : "warning",
            href: deepLink("EolWatchEntry", e.id),
          });
        }
      } else if (input.kind === "overdue_initiatives") {
        const now = new Date();
        const initiatives = await ctx.db.initiative.findMany({
          where: {
            workspaceId: wid,
            isActive: true,
            endDate: { lt: now },
            status: { notIn: ["COMPLETE", "CANCELLED"] },
            ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
          },
          select: { id: true, name: true, endDate: true, status: true },
          orderBy: { endDate: "asc" },
          take: 50,
        });
        for (const i of initiatives) {
          items.push({
            id: i.id,
            label: i.name,
            sublabel: `Status: ${i.status.replace(/_/g, " ")} · Due: ${i.endDate?.toLocaleDateString() ?? "—"}`,
            badge: "Overdue",
            badgeVariant: "destructive",
            href: deepLink("Initiative", i.id),
          });
        }
      }

      return { items, total: items.length };
    }),

  // ─── AI context aggregation ─────────────────────────────────────────────────

  getAIContext: workspaceProcedure.query(async ({ ctx }) => {
    const wid = ctx.workspaceId;
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const MATURITY_NUMERIC: Record<string, number> = {
      INITIAL: 1, DEVELOPING: 2, DEFINED: 3, MANAGED: 4, OPTIMIZING: 5, NOT_ASSESSED: 0,
    };

    // ── Parallel data fetch ────────────────────────────────────────────
    const [
      apps,
      capabilities,
      capAppMaps,
      risks,
      complianceReqs,
      initiatives,
      objectives,
      initiativeObjectiveMaps,
      eolEntries,
      actionItems,
    ] = await Promise.all([
      ctx.db.application.findMany({
        where: { workspaceId: wid, isActive: true },
        select: {
          id: true, name: true, vendor: true, lifecycle: true,
          technicalHealth: true, businessValue: true, annualCostUsd: true,
        },
      }),
      ctx.db.businessCapability.findMany({
        where: { workspaceId: wid, isActive: true },
        select: {
          id: true, name: true, level: true, strategicImportance: true,
          currentMaturity: true, targetMaturity: true,
        },
      }),
      ctx.db.applicationCapabilityMap.findMany({
        where: { workspaceId: wid },
        select: { applicationId: true, capabilityId: true },
      }),
      ctx.db.techRisk.findMany({
        where: { workspaceId: wid, status: { notIn: ["CLOSED"] } },
        select: { id: true, title: true, category: true, riskScore: true, status: true },
      }),
      ctx.db.complianceRequirement.findMany({
        where: { workspaceId: wid, isApplicable: true },
        select: {
          framework: true, controlId: true, title: true,
          mappings: { select: { status: true } },
        },
      }),
      ctx.db.initiative.findMany({
        where: { workspaceId: wid, isActive: true },
        select: {
          id: true, name: true, status: true, ragStatus: true,
          budgetUsd: true, progressPct: true, endDate: true,
        },
      }),
      ctx.db.objective.count({ where: { workspaceId: wid, isActive: true } }),
      ctx.db.initiativeObjectiveMap.findMany({
        where: { initiative: { workspaceId: wid } },
        select: { initiativeId: true, objectiveId: true },
      }),
      ctx.db.eolWatchEntry.findMany({
        where: { workspaceId: wid },
        select: { id: true, entityId: true, urgencyBand: true },
      }),
      ctx.db.techRisk.findMany({
        where: { workspaceId: wid, riskScore: { gte: 6 }, status: { in: ["OPEN", "IN_PROGRESS"] } },
        select: { title: true, category: true, riskScore: true },
        orderBy: { riskScore: "desc" },
        take: 10,
      }),
    ]);

    // ── Portfolio Economics ─────────────────────────────────────────────
    let totalAnnualCost = 0;
    let activeCost = 0;
    let legacyCost = 0;
    const vendorSpend = new Map<string, number>();
    const lifecycleCounts: Record<string, number> = {};
    const healthCounts: Record<string, number> = {};
    const bvCounts: Record<string, number> = {};

    for (const app of apps) {
      const cost = Number(app.annualCostUsd ?? 0);
      totalAnnualCost += cost;
      const lc = app.lifecycle;
      lifecycleCounts[lc] = (lifecycleCounts[lc] ?? 0) + 1;
      healthCounts[app.technicalHealth] = (healthCounts[app.technicalHealth] ?? 0) + 1;
      bvCounts[app.businessValue] = (bvCounts[app.businessValue] ?? 0) + 1;

      if (lc === "ACTIVE" || lc === "PLANNED") activeCost += cost;
      if (lc === "PHASING_OUT" || lc === "SUNSET" || lc === "RETIRED") legacyCost += cost;

      const v = app.vendor ?? "Unknown";
      vendorSpend.set(v, (vendorSpend.get(v) ?? 0) + cost);
    }

    const sortedVendors = [...vendorSpend.entries()].sort((a, b) => b[1] - a[1]);
    const topVendors = sortedVendors.slice(0, 5).map(([v, s]) => `${v}: $${Math.round(s).toLocaleString()}`);
    const topVendorName = sortedVendors[0]?.[0] ?? "N/A";
    const topVendorPct = totalAnnualCost > 0
      ? Math.round(((sortedVendors[0]?.[1] ?? 0) / totalAnnualCost) * 100)
      : 0;

    // ── Capability Architecture ────────────────────────────────────────
    const criticalCaps = capabilities.filter((c) => c.strategicImportance === "CRITICAL");
    const capAppSet = new Map<string, Set<string>>();
    for (const m of capAppMaps) {
      if (!capAppSet.has(m.capabilityId)) capAppSet.set(m.capabilityId, new Set());
      capAppSet.get(m.capabilityId)!.add(m.applicationId);
    }
    const unsupportedCritical = criticalCaps.filter((c) => !capAppSet.has(c.id) || capAppSet.get(c.id)!.size === 0);

    const maturityDist: Record<string, number> = {};
    let totalGap = 0;
    let gapCount = 0;
    let largeGapCount = 0;
    let largeGapCriticalCount = 0;
    for (const cap of capabilities) {
      const cm = cap.currentMaturity;
      maturityDist[cm] = (maturityDist[cm] ?? 0) + 1;
      const cur = MATURITY_NUMERIC[cm] ?? 0;
      const tgt = MATURITY_NUMERIC[cap.targetMaturity] ?? 0;
      if (tgt > 0 && cur > 0) {
        const gap = tgt - cur;
        totalGap += gap;
        gapCount++;
        if (gap >= 2) {
          largeGapCount++;
          if (cap.strategicImportance === "CRITICAL") largeGapCriticalCount++;
        }
      }
    }
    const avgMaturityGap = gapCount > 0 ? Math.round((totalGap / gapCount) * 10) / 10 : 0;

    const immatureCritical = capabilities.filter(
      (c) => c.strategicImportance === "CRITICAL" && (c.currentMaturity === "INITIAL" || c.currentMaturity === "NOT_ASSESSED")
    );

    // Redundancy: capabilities with 2+ apps
    const redundantCaps = [...capAppSet.entries()].filter(([, s]) => s.size >= 2);

    // ── Toxic apps: POOR/CRITICAL health supporting CRITICAL capabilities ──
    const criticalCapIds = new Set(criticalCaps.map((c) => c.id));
    const appsSupportingCritical = new Set<string>();
    for (const m of capAppMaps) {
      if (criticalCapIds.has(m.capabilityId)) appsSupportingCritical.add(m.applicationId);
    }
    const toxicApps = apps.filter(
      (a) =>
        (a.technicalHealth === "POOR" || a.technicalHealth === "TH_CRITICAL") &&
        appsSupportingCritical.has(a.id)
    );

    // ── EOL apps supporting critical capabilities ──
    const eolAppIds = new Set(
      eolEntries.filter((e) => e.urgencyBand === "EXPIRED" || e.urgencyBand === "URGENT").map((e) => e.entityId)
    );
    const eolCriticalApps = apps.filter(
      (a) => eolAppIds.has(a.id) && appsSupportingCritical.has(a.id)
    );

    // ── Risk stats ─────────────────────────────────────────────────────
    const openRisks = risks.filter((r) => r.status !== "ACCEPTED");
    const criticalRisks = risks.filter((r) => r.riskScore >= 12);
    const unmitigated = risks.filter((r) => r.status === "OPEN");
    const byCategoryMap: Record<string, number> = {};
    for (const r of openRisks) {
      byCategoryMap[r.category] = (byCategoryMap[r.category] ?? 0) + 1;
    }

    // ── Compliance ─────────────────────────────────────────────────────
    const frameworkMap: Record<string, { total: number; compliant: number; partial: number; nonCompliant: number; notAssessed: number }> = {};
    for (const req of complianceReqs) {
      const fw = req.framework as string;
      if (!frameworkMap[fw]) frameworkMap[fw] = { total: 0, compliant: 0, partial: 0, nonCompliant: 0, notAssessed: 0 };
      frameworkMap[fw].total++;
      if (req.mappings.length === 0) { frameworkMap[fw].notAssessed++; }
      else if (req.mappings.every((m) => m.status === "COMPLIANT")) { frameworkMap[fw].compliant++; }
      else if (req.mappings.some((m) => m.status === "NON_COMPLIANT")) { frameworkMap[fw].nonCompliant++; }
      else if (req.mappings.some((m) => m.status === "PARTIAL")) { frameworkMap[fw].partial++; }
      else { frameworkMap[fw].notAssessed++; }
    }
    const perFrameworkScores = Object.entries(frameworkMap).map(([fw, c]) => {
      const score = c.total > 0 ? Math.round(((c.compliant) / c.total) * 100) : 0;
      return { framework: fw, score, ...c };
    });
    const avgComplianceScore = perFrameworkScores.length > 0
      ? Math.round(perFrameworkScores.reduce((s, f) => s + f.score, 0) / perFrameworkScores.length)
      : 0;
    const weakFrameworks = perFrameworkScores.filter((f) => f.score < 50);

    // ── Transformation Roadmap ─────────────────────────────────────────
    const statusCounts: Record<string, number> = {};
    const ragCounts: Record<string, number> = {};
    let totalBudget = 0;
    let totalProgress = 0;
    let progressCount = 0;
    for (const init of initiatives) {
      statusCounts[init.status] = (statusCounts[init.status] ?? 0) + 1;
      ragCounts[init.ragStatus] = (ragCounts[init.ragStatus] ?? 0) + 1;
      totalBudget += Number(init.budgetUsd ?? 0);
      if (init.status === "IN_PROGRESS" || init.status === "COMPLETE") {
        totalProgress += init.progressPct;
        progressCount++;
      }
    }
    const overdueInitiatives = initiatives.filter(
      (i) => i.endDate && i.endDate < now && i.status !== "COMPLETE" && i.status !== "CANCELLED"
    );
    const recentlyCompleted = initiatives.filter(
      (i) => i.status === "COMPLETE"
    ).length;
    const linkedObjectives = new Set(initiativeObjectiveMaps.map((m) => m.objectiveId)).size;
    const redInitiatives = initiatives.filter((i) => i.ragStatus === "RED");

    // ── High-value risk signals ────────────────────────────────────────
    const highSpendThreshold = 100_000;
    const highValueAppIds = new Set(
      apps.filter((a) => Number(a.annualCostUsd ?? 0) >= highSpendThreshold).map((a) => a.id)
    );
    // Risks affecting high-value apps: risk → app links via capAppMaps (approximate)
    // We count risks on capabilities that are supported by high-value apps
    const highValueRiskCount = 0; // Simplified — full impl would need RiskApplicationLink joins

    // ── Action items summary ───────────────────────────────────────────
    const actionSummary = actionItems.map(
      (r) => `- ${r.title} (${r.category.replace(/_/g, " ")}, score: ${r.riskScore}/16)`
    ).join("\n");

    // ── Assemble context ───────────────────────────────────────────────
    return {
      portfolioEconomics: {
        totalAnnualCost: Math.round(totalAnnualCost),
        activeCost: Math.round(activeCost),
        activeCostPct: totalAnnualCost > 0 ? Math.round((activeCost / totalAnnualCost) * 100) : 0,
        legacyCost: Math.round(legacyCost),
        legacyCostPct: totalAnnualCost > 0 ? Math.round((legacyCost / totalAnnualCost) * 100) : 0,
        topVendorsBySpend: topVendors,
        topVendorName,
        topVendorPct,
      },
      capabilityArchitecture: {
        totalCapabilities: capabilities.length,
        criticalCapabilities: criticalCaps.length,
        unsupportedCritical: unsupportedCritical.length,
        unsupportedCriticalNames: unsupportedCritical.map((c) => c.name),
        maturityDistribution: maturityDist,
        avgMaturityGap,
        largeGapCount,
        largeGapCriticalCount,
        immatureCriticalCount: immatureCritical.length,
        immatureCriticalNames: immatureCritical.map((c) => c.name),
      },
      applicationPortfolio: {
        totalApplications: apps.length,
        lifecycleDistribution: lifecycleCounts,
        healthDistribution: healthCounts,
        businessValueDistribution: bvCounts,
        toxicAppCount: toxicApps.length,
        toxicAppNames: toxicApps.map((a) => a.name),
        pastEolActiveCount: [...eolAppIds].filter((id) => apps.some((a) => a.id === id)).length,
        redundantCapabilityCount: redundantCaps.length,
      },
      riskCompliance: {
        openRisks: openRisks.length,
        criticalRisks: criticalRisks.length,
        unmitigated: unmitigated.length,
        byCategory: byCategoryMap,
        eolExpired: eolEntries.filter((e) => e.urgencyBand === "EXPIRED").length,
        eolUrgent: eolEntries.filter((e) => e.urgencyBand === "URGENT").length,
        perFrameworkScores,
        avgComplianceScore,
        weakFrameworks: weakFrameworks.map((f) => `${f.framework} (${f.score}%)`),
      },
      transformation: {
        totalInitiatives: initiatives.length,
        byStatus: statusCounts,
        ragDistribution: ragCounts,
        overdueCount: overdueInitiatives.length,
        totalBudget: Math.round(totalBudget),
        avgProgress: progressCount > 0 ? Math.round(totalProgress / progressCount) : 0,
        recentlyCompleted,
        linkedObjectives,
        totalObjectives: objectives,
        redInitiatives: redInitiatives.map((i) => i.name),
      },
      crossModuleSignals: {
        eolCriticalCount: eolCriticalApps.length,
        eolCriticalNames: eolCriticalApps.map((a) => a.name),
        immatureCriticalCount: immatureCritical.length,
        highValueRiskCount,
        complianceTransformOverlap: 0, // Simplified
      },
      actionItemsSummary: actionSummary,
    };
  }),
});
