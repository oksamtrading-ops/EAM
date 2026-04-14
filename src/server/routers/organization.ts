import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";

export const organizationRouter = router({
  list: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.db.organization.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true } },
        _count: { select: { capabilities: true } },
      },
      orderBy: { sortOrder: "asc" },
    });
  }),

  create: workspaceProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().max(1000).optional(),
        parentId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.organization.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          parentId: input.parentId ?? null,
          workspaceId: ctx.workspaceId,
        },
      });

      auditLog(ctx, {
        action: "CREATE",
        entityType: "Organization",
        entityId: org.id,
        after: org as unknown as Record<string, unknown>,
      });
      return org;
    }),

  update: workspaceProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().max(1000).nullable().optional(),
        parentId: z.string().nullable().optional(),
        sortOrder: z.number().int().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.organization.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const { id, ...data } = input;
      const updated = await ctx.db.organization.update({
        where: { id },
        data,
      });

      auditLog(ctx, {
        action: "UPDATE",
        entityType: "Organization",
        entityId: id,
        before: existing as unknown as Record<string, unknown>,
        after: updated as unknown as Record<string, unknown>,
      });
      return updated;
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.organization.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.organization.delete({ where: { id: input.id } });

      auditLog(ctx, {
        action: "DELETE",
        entityType: "Organization",
        entityId: input.id,
        before: existing as unknown as Record<string, unknown>,
      });
      return { success: true };
    }),
});
