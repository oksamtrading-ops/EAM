import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";

const DEPENDENCY_TYPES = [
  "REQUIRES",
  "RUNS_ON",
  "COMPATIBLE_WITH",
  "CONFLICTS_WITH",
  "REPLACES",
] as const;

export const technologyDependencyRouter = router({
  list: workspaceProcedure
    .input(
      z
        .object({
          productId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.technologyDependency.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          isActive: true,
          ...(input?.productId
            ? {
                OR: [
                  { sourceProductId: input.productId },
                  { targetProductId: input.productId },
                ],
              }
            : {}),
        },
        include: {
          sourceProduct: { select: { id: true, name: true, type: true } },
          targetProduct: { select: { id: true, name: true, type: true } },
        },
        orderBy: [{ createdAt: "desc" }],
      });
    }),

  create: workspaceProcedure
    .input(
      z.object({
        sourceProductId: z.string(),
        targetProductId: z.string(),
        dependencyType: z.enum(DEPENDENCY_TYPES).default("REQUIRES"),
        versionConstraint: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.sourceProductId === input.targetProductId)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A product cannot depend on itself",
        });

      const [source, target] = await Promise.all([
        ctx.db.technologyProduct.findFirst({
          where: { id: input.sourceProductId, workspaceId: ctx.workspaceId },
        }),
        ctx.db.technologyProduct.findFirst({
          where: { id: input.targetProductId, workspaceId: ctx.workspaceId },
        }),
      ]);
      if (!source || !target)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid product" });

      const dep = await ctx.db.technologyDependency.create({
        data: { ...input, workspaceId: ctx.workspaceId },
      });
      auditLog(ctx, {
        action: "CREATE",
        entityType: "TechnologyDependency",
        entityId: dep.id,
        after: dep as unknown as Record<string, unknown>,
      });
      return dep;
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.technologyDependency.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.technologyDependency.delete({ where: { id: input.id } });
      auditLog(ctx, {
        action: "DELETE",
        entityType: "TechnologyDependency",
        entityId: input.id,
        before: existing as unknown as Record<string, unknown>,
      });
      return { success: true };
    }),

  graphForProduct: workspaceProcedure
    .input(z.object({ productId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [upstream, downstream] = await Promise.all([
        ctx.db.technologyDependency.findMany({
          where: {
            workspaceId: ctx.workspaceId,
            isActive: true,
            targetProductId: input.productId,
          },
          include: {
            sourceProduct: { select: { id: true, name: true, type: true } },
          },
        }),
        ctx.db.technologyDependency.findMany({
          where: {
            workspaceId: ctx.workspaceId,
            isActive: true,
            sourceProductId: input.productId,
          },
          include: {
            targetProduct: { select: { id: true, name: true, type: true } },
          },
        }),
      ]);
      return { upstream, downstream };
    }),
});
