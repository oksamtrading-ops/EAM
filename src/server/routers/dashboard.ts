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

      // Aggregate cost per L1 domain
      const domainMap = new Map<string, { totalCost: number; appIds: Set<string> }>();
      for (const app of apps) {
        const cost = Number(app.annualCostUsd ?? 0);
        for (const mapping of app.capabilities) {
          const l1Id = findL1(mapping.capabilityId);
          if (l1Id) {
            if (!domainMap.has(l1Id)) domainMap.set(l1Id, { totalCost: 0, appIds: new Set() });
            const entry = domainMap.get(l1Id)!;
            entry.totalCost += cost;
            entry.appIds.add(app.id);
          }
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
});
