import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";

const LIFECYCLE_STATUSES = [
  "PREVIEW",
  "CURRENT",
  "MAINSTREAM",
  "EXTENDED_SUPPORT",
  "DEPRECATED",
  "END_OF_LIFE",
] as const;

const VersionCreateInput = z.object({
  productId: z.string(),
  version: z.string().min(1).max(80),
  releaseDate: z.coerce.date().nullable().optional(),
  endOfSupportDate: z.coerce.date().nullable().optional(),
  endOfLifeDate: z.coerce.date().nullable().optional(),
  lifecycleStatus: z.enum(LIFECYCLE_STATUSES).default("CURRENT"),
  notes: z.string().nullable().optional(),
});

const VersionUpdateInput = z.object({
  id: z.string(),
  version: z.string().min(1).max(80).optional(),
  releaseDate: z.coerce.date().nullable().optional(),
  endOfSupportDate: z.coerce.date().nullable().optional(),
  endOfLifeDate: z.coerce.date().nullable().optional(),
  lifecycleStatus: z.enum(LIFECYCLE_STATUSES).optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const technologyVersionRouter = router({
  list: workspaceProcedure
    .input(
      z
        .object({
          productId: z.string().optional(),
          lifecycleStatus: z.enum(LIFECYCLE_STATUSES).optional(),
          eolBefore: z.coerce.date().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.technologyVersion.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          isActive: true,
          ...(input?.productId ? { productId: input.productId } : {}),
          ...(input?.lifecycleStatus ? { lifecycleStatus: input.lifecycleStatus } : {}),
          ...(input?.eolBefore ? { endOfLifeDate: { lte: input.eolBefore } } : {}),
        },
        include: {
          product: {
            select: { id: true, name: true, type: true, vendor: { select: { id: true, name: true } } },
          },
          _count: { select: { components: true } },
        },
        orderBy: [{ endOfLifeDate: "asc" }, { version: "desc" }],
      });
    }),

  getById: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const version = await ctx.db.technologyVersion.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
        include: {
          product: { include: { vendor: true } },
          components: {
            where: { isActive: true },
            orderBy: [{ name: "asc" }],
          },
        },
      });
      if (!version) throw new TRPCError({ code: "NOT_FOUND" });
      return version;
    }),

  create: workspaceProcedure
    .input(VersionCreateInput)
    .mutation(async ({ ctx, input }) => {
      const product = await ctx.db.technologyProduct.findFirst({
        where: { id: input.productId, workspaceId: ctx.workspaceId },
      });
      if (!product)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid product" });

      const version = await ctx.db.technologyVersion.create({
        data: {
          ...input,
          workspaceId: ctx.workspaceId,
        },
      });
      auditLog(ctx, {
        action: "CREATE",
        entityType: "TechnologyVersion",
        entityId: version.id,
        after: version as unknown as Record<string, unknown>,
      });
      return version;
    }),

  update: workspaceProcedure
    .input(VersionUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.technologyVersion.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const { id, ...data } = input;
      const updated = await ctx.db.technologyVersion.update({ where: { id }, data });
      auditLog(ctx, {
        action: "UPDATE",
        entityType: "TechnologyVersion",
        entityId: id,
        before: existing as unknown as Record<string, unknown>,
        after: updated as unknown as Record<string, unknown>,
      });
      return updated;
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.technologyVersion.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.technologyVersion.update({
        where: { id: input.id },
        data: { isActive: false },
      });
      auditLog(ctx, {
        action: "DELETE",
        entityType: "TechnologyVersion",
        entityId: input.id,
        before: existing as unknown as Record<string, unknown>,
      });
      return updated;
    }),

  upcomingEol: workspaceProcedure
    .input(z.object({ withinDays: z.number().int().positive().default(90) }).optional())
    .query(async ({ ctx, input }) => {
      const days = input?.withinDays ?? 90;
      const now = new Date();
      const threshold = new Date();
      threshold.setDate(threshold.getDate() + days);
      return ctx.db.technologyVersion.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          isActive: true,
          endOfLifeDate: { gte: now, lte: threshold },
        },
        include: {
          product: {
            select: { id: true, name: true, vendor: { select: { id: true, name: true } } },
          },
          _count: { select: { components: true } },
        },
        orderBy: [{ endOfLifeDate: "asc" }],
      });
    }),

  eolRisk: workspaceProcedure.query(async ({ ctx }) => {
    const versions = await ctx.db.technologyVersion.findMany({
      where: { workspaceId: ctx.workspaceId, isActive: true },
      select: {
        id: true,
        lifecycleStatus: true,
        endOfLifeDate: true,
        _count: { select: { components: true } },
      },
    });

    const now = new Date();
    const in90 = new Date();
    in90.setDate(in90.getDate() + 90);

    const byLifecycle: Record<string, number> = {};
    let pastEol = 0;
    let eolIn90 = 0;

    for (const v of versions) {
      byLifecycle[v.lifecycleStatus] = (byLifecycle[v.lifecycleStatus] ?? 0) + 1;
      if (v.endOfLifeDate && v.endOfLifeDate < now) pastEol += 1;
      else if (v.endOfLifeDate && v.endOfLifeDate <= in90) eolIn90 += 1;
    }

    return {
      total: versions.length,
      byLifecycle,
      pastEol,
      eolIn90,
    };
  }),
});
