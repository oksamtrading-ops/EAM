import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";

const QUADRANTS = [
  "LANGUAGES_FRAMEWORKS",
  "PLATFORMS_INFRASTRUCTURE",
  "TOOLS_TECHNIQUES",
  "DATA_STORAGE",
] as const;

const RINGS = ["ADOPT", "TRIAL", "ASSESS", "HOLD"] as const;

export const techRadarRouter = router({
  getRadar: workspaceProcedure.query(async ({ ctx }) => {
    const entries = await ctx.db.techRadarEntry.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: {
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ quadrant: "asc" }, { ring: "asc" }, { name: "asc" }],
    });

    // Group by quadrant then ring
    const grouped: Record<string, Record<string, typeof entries>> = {};
    for (const q of QUADRANTS) {
      grouped[q] = {};
      for (const r of RINGS) {
        grouped[q][r] = [];
      }
    }
    for (const entry of entries) {
      grouped[entry.quadrant][entry.ring].push(entry);
    }

    return { entries, grouped };
  }),

  upsert: workspaceProcedure
    .input(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1).max(200),
        quadrant: z.enum(QUADRANTS),
        ring: z.enum(RINGS),
        description: z.string().optional(),
        rationale: z.string().optional(),
        isNew: z.boolean().default(false),
        movedFrom: z.enum(RINGS).optional(),
        techComponentId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const now = new Date();

      if (id) {
        const existing = await ctx.db.techRadarEntry.findFirst({
          where: { id, workspaceId: ctx.workspaceId },
        });
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

        const updated = await ctx.db.techRadarEntry.update({
          where: { id },
          data: {
            ...data,
            reviewedAt: now,
            reviewedById: ctx.dbUserId ?? null,
          },
        });

        auditLog(ctx, {
          action: "UPDATE",
          entityType: "TechRadarEntry",
          entityId: id,
          before: existing as unknown as Record<string, unknown>,
          after: updated as unknown as Record<string, unknown>,
        });
        return updated;
      }

      const entry = await ctx.db.techRadarEntry.create({
        data: {
          ...data,
          workspaceId: ctx.workspaceId,
          reviewedAt: now,
          reviewedById: ctx.dbUserId ?? null,
        },
      });

      auditLog(ctx, {
        action: "CREATE",
        entityType: "TechRadarEntry",
        entityId: entry.id,
        after: entry as unknown as Record<string, unknown>,
      });
      return entry;
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.techRadarEntry.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.techRadarEntry.delete({ where: { id: input.id } });

      auditLog(ctx, {
        action: "DELETE",
        entityType: "TechRadarEntry",
        entityId: input.id,
        before: existing as unknown as Record<string, unknown>,
      });
      return { success: true };
    }),

  syncFromTechComponents: workspaceProcedure.mutation(async ({ ctx }) => {
    // Find apps with technical health POOR/TH_CRITICAL not yet on radar
    const apps = await ctx.db.application.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        isActive: true,
        technicalHealth: { in: ["POOR", "TH_CRITICAL"] },
      },
    });

    const synced: string[] = [];
    for (const app of apps) {
      const existing = await ctx.db.techRadarEntry.findFirst({
        where: { workspaceId: ctx.workspaceId, name: app.name },
      });
      if (existing) continue;

      const ring =
        app.technicalHealth === "TH_CRITICAL" ? "HOLD" : "ASSESS";
      const entry = await ctx.db.techRadarEntry.create({
        data: {
          workspaceId: ctx.workspaceId,
          techComponentId: app.id,
          name: app.name,
          quadrant: "PLATFORMS_INFRASTRUCTURE",
          ring,
          description: `Auto-synced from application portfolio. Lifecycle: ${app.lifecycle}. Technical Health: ${app.technicalHealth}.`,
          rationale: "Synced from portfolio — review and reclassify as needed.",
          isNew: true,
          reviewedAt: new Date(),
          reviewedById: ctx.dbUserId ?? null,
        },
      });
      synced.push(entry.id);
    }

    return { synced: synced.length, ids: synced };
  }),
});
