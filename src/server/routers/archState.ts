import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";
import type { ArchStateSnapshot } from "@/types/arch-state";

export const archStateRouter = router({
  captureAsIs: workspaceProcedure
    .input(
      z.object({
        label: z.string().min(1).max(200),
        description: z.string().optional(),
        initiativeId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const snapshot = await captureCurrentState(
        ctx.db,
        ctx.workspaceId,
        "AS_IS",
        input.label
      );

      const state = await ctx.db.architectureState.create({
        data: {
          workspaceId: ctx.workspaceId,
          initiativeId: input.initiativeId ?? null,
          stateType: "AS_IS",
          label: input.label,
          description: input.description,
          snapshot: snapshot as any,
          createdById: ctx.dbUserId,
        },
      });

      auditLog(ctx, {
        action: "CREATE",
        entityType: "ArchitectureState",
        entityId: state.id,
        after: { label: input.label, stateType: "AS_IS" } as Record<string, unknown>,
      });
      return state;
    }),

  defineToBeState: workspaceProcedure
    .input(
      z.object({
        initiativeId: z.string(),
        label: z.string().min(1).max(200),
        description: z.string().optional(),
        capabilityTargets: z.array(
          z.object({
            capabilityId: z.string(),
            targetMaturity: z.string(),
            notes: z.string().optional(),
          })
        ),
        applicationChanges: z.array(
          z.object({
            applicationId: z.string(),
            changeType: z.string(),
            replacedById: z.string().optional(),
            notes: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const asIsSnapshot = await captureCurrentState(
        ctx.db,
        ctx.workspaceId,
        "AS_IS",
        "baseline"
      );
      const toBeSnapshot = applyToBeChanges(
        asIsSnapshot,
        input.capabilityTargets,
        input.applicationChanges
      );

      const state = await ctx.db.architectureState.create({
        data: {
          workspaceId: ctx.workspaceId,
          initiativeId: input.initiativeId,
          stateType: "TO_BE",
          label: input.label,
          description: input.description,
          snapshot: {
            ...toBeSnapshot,
            stateType: "TO_BE",
            label: input.label,
          } as any,
          createdById: ctx.dbUserId,
        },
      });

      auditLog(ctx, {
        action: "CREATE",
        entityType: "ArchitectureState",
        entityId: state.id,
        after: { label: input.label, stateType: "TO_BE" } as Record<string, unknown>,
      });
      return state;
    }),

  compare: workspaceProcedure
    .input(z.object({ asIsId: z.string(), toBeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [asIs, toBe] = await Promise.all([
        ctx.db.architectureState.findFirst({
          where: { id: input.asIsId, workspaceId: ctx.workspaceId },
        }),
        ctx.db.architectureState.findFirst({
          where: { id: input.toBeId, workspaceId: ctx.workspaceId },
        }),
      ]);
      if (!asIs || !toBe) throw new TRPCError({ code: "NOT_FOUND" });

      return diffArchStates(
        asIs.snapshot as unknown as ArchStateSnapshot,
        toBe.snapshot as unknown as ArchStateSnapshot
      );
    }),

  list: workspaceProcedure
    .input(z.object({ initiativeId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.architectureState.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          ...(input?.initiativeId ? { initiativeId: input.initiativeId } : {}),
        },
        include: {
          createdBy: { select: { name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),
});

// ── Helpers ──────────────────────────────────────────────────

async function captureCurrentState(
  db: any,
  workspaceId: string,
  stateType: string,
  label: string
): Promise<ArchStateSnapshot> {
  const [capabilities, apps] = await Promise.all([
    db.businessCapability.findMany({ where: { workspaceId, isActive: true } }),
    db.application.findMany({
      where: { workspaceId, isActive: true },
      include: { capabilities: { select: { capabilityId: true } } },
    }),
  ]);

  const capabilityAppCount = new Map<string, number>();
  apps.forEach((a: any) => {
    a.capabilities.forEach((c: any) => {
      capabilityAppCount.set(
        c.capabilityId,
        (capabilityAppCount.get(c.capabilityId) ?? 0) + 1
      );
    });
  });

  const coveredCapabilityIds = new Set(capabilityAppCount.keys());
  const gaps = capabilities
    .filter((c: any) => !coveredCapabilityIds.has(c.id))
    .map((c: any) => ({ capabilityId: c.id, capabilityName: c.name }));

  const redundancies = Array.from(capabilityAppCount.entries())
    .filter(([, count]) => count > 1)
    .map(([capabilityId, appCount]) => ({
      capabilityId,
      capabilityName:
        capabilities.find((c: any) => c.id === capabilityId)?.name ?? "",
      appCount,
    }));

  return {
    version: 1,
    capturedAt: new Date().toISOString(),
    stateType: stateType as "AS_IS" | "TO_BE",
    label,
    capabilities: capabilities.map((c: any) => ({
      id: c.id,
      name: c.name,
      level: c.level,
      currentMaturity: c.currentMaturity,
      targetMaturity: c.targetMaturity,
      strategicImportance: c.strategicImportance,
    })),
    applications: apps.map((a: any) => ({
      id: a.id,
      name: a.name,
      lifecycle: a.lifecycle,
      rationalizationStatus: a.rationalizationStatus,
      businessValue: a.businessValue,
      technicalHealth: a.technicalHealth,
      capabilityIds: a.capabilities.map((c: any) => c.capabilityId),
    })),
    gaps,
    redundancies,
  };
}

function applyToBeChanges(
  asIs: ArchStateSnapshot,
  capTargets: Array<{ capabilityId: string; targetMaturity: string }>,
  appChanges: Array<{ applicationId: string; changeType: string }>
): ArchStateSnapshot {
  const capabilities = asIs.capabilities.map((c) => {
    const target = capTargets.find((t) => t.capabilityId === c.id);
    return target ? { ...c, targetMaturity: target.targetMaturity } : c;
  });

  const applications = asIs.applications
    .filter((a) => {
      const change = appChanges.find((ch) => ch.applicationId === a.id);
      return change?.changeType !== "RETIRE";
    })
    .map((a) => {
      const change = appChanges.find((ch) => ch.applicationId === a.id);
      return change?.changeType === "KEEP" || !change
        ? a
        : { ...a, lifecycle: "PHASING_OUT" };
    });

  return { ...asIs, capabilities, applications, stateType: "TO_BE" };
}

function diffArchStates(asIs: ArchStateSnapshot, toBe: ArchStateSnapshot) {
  const capDiffs = asIs.capabilities.map((asCap) => {
    const toBeCap = toBe.capabilities.find((c) => c.id === asCap.id);
    return {
      id: asCap.id,
      name: asCap.name,
      maturityChange: toBeCap
        ? { from: asCap.currentMaturity, to: toBeCap.targetMaturity }
        : null,
      removed: !toBeCap,
    };
  });

  const appDiffs = {
    retired: asIs.applications
      .filter((a) => !toBe.applications.find((b) => b.id === a.id))
      .map((a) => a.name),
    introduced: toBe.applications
      .filter((b) => !asIs.applications.find((a) => a.id === b.id))
      .map((b) => b.name),
    modified: asIs.applications
      .filter((a) => {
        const toBeApp = toBe.applications.find((b) => b.id === a.id);
        return toBeApp && toBeApp.lifecycle !== a.lifecycle;
      })
      .map((a) => ({
        name: a.name,
        from: a.lifecycle,
        to: toBe.applications.find((b) => b.id === a.id)!.lifecycle,
      })),
  };

  const gapsClosed = asIs.gaps.filter(
    (g) => !toBe.gaps.find((tg) => tg.capabilityId === g.capabilityId)
  );
  const redundanciesResolved = asIs.redundancies.filter((r) => {
    const toBeR = toBe.redundancies.find(
      (tr) => tr.capabilityId === r.capabilityId
    );
    return !toBeR || toBeR.appCount < r.appCount;
  });

  return { capDiffs, appDiffs, gapsClosed, redundanciesResolved };
}
