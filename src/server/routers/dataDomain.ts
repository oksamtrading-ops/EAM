import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";

const DomainCreateInput = z.object({
  name: z.string().min(1).max(120),
  description: z.string().optional(),
  ownerId: z.string().optional(),
  color: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

const DomainUpdateInput = z.object({
  id: z.string(),
  name: z.string().min(1).max(120).optional(),
  description: z.string().nullable().optional(),
  ownerId: z.string().nullable().optional(),
  color: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export const dataDomainRouter = router({
  list: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.db.dataDomain.findMany({
      where: { workspaceId: ctx.workspaceId, isActive: true },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        _count: { select: { entities: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }),

  getById: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const domain = await ctx.db.dataDomain.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
        include: {
          owner: true,
          entities: {
            where: { isActive: true },
            orderBy: { name: "asc" },
          },
        },
      });
      if (!domain) throw new TRPCError({ code: "NOT_FOUND" });
      return domain;
    }),

  create: workspaceProcedure
    .input(DomainCreateInput)
    .mutation(async ({ ctx, input }) => {
      const domain = await ctx.db.dataDomain.create({
        data: {
          ...input,
          workspaceId: ctx.workspaceId,
        },
      });
      auditLog(ctx, {
        action: "CREATE",
        entityType: "DataDomain",
        entityId: domain.id,
        after: domain as unknown as Record<string, unknown>,
      });
      return domain;
    }),

  update: workspaceProcedure
    .input(DomainUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.dataDomain.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const { id, ...data } = input;
      const updated = await ctx.db.dataDomain.update({
        where: { id },
        data,
      });
      auditLog(ctx, {
        action: "UPDATE",
        entityType: "DataDomain",
        entityId: id,
        before: existing as unknown as Record<string, unknown>,
        after: updated as unknown as Record<string, unknown>,
      });
      return updated;
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.dataDomain.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
        include: { _count: { select: { entities: true } } },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing._count.entities > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot delete domain with ${existing._count.entities} entities. Move or delete entities first.`,
        });
      }

      await ctx.db.dataDomain.delete({ where: { id: input.id } });
      auditLog(ctx, {
        action: "DELETE",
        entityType: "DataDomain",
        entityId: input.id,
        before: existing as unknown as Record<string, unknown>,
      });
      return { success: true };
    }),
});
