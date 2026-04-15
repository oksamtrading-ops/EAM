import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";

const DIRECTION_VALUES = ["SOURCE_TO_TARGET", "TARGET_TO_SOURCE", "BIDIRECTIONAL"] as const;

export const interfaceDataFlowRouter = router({
  listByInterface: workspaceProcedure
    .input(z.object({ interfaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.interfaceDataFlow.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          interfaceId: input.interfaceId,
        },
        include: {
          entity: {
            select: { id: true, name: true, domainId: true },
          },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  addEntity: workspaceProcedure
    .input(
      z.object({
        interfaceId: z.string(),
        dataEntityId: z.string(),
        direction: z.enum(DIRECTION_VALUES).default("SOURCE_TO_TARGET"),
        frequency: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const iface = await ctx.db.applicationInterface.findFirst({
        where: { id: input.interfaceId, workspaceId: ctx.workspaceId },
      });
      if (!iface) throw new TRPCError({ code: "NOT_FOUND", message: "Interface not found" });

      const entity = await ctx.db.dataEntity.findFirst({
        where: { id: input.dataEntityId, workspaceId: ctx.workspaceId },
      });
      if (!entity) throw new TRPCError({ code: "NOT_FOUND", message: "Data entity not found" });

      const flow = await ctx.db.interfaceDataFlow.create({
        data: {
          workspaceId: ctx.workspaceId,
          interfaceId: input.interfaceId,
          dataEntityId: input.dataEntityId,
          direction: input.direction,
          frequency: input.frequency,
          notes: input.notes,
        },
      });
      auditLog(ctx, {
        action: "CREATE",
        entityType: "InterfaceDataFlow",
        entityId: flow.id,
        after: flow as any,
      });
      return flow;
    }),

  updateEntity: workspaceProcedure
    .input(
      z.object({
        id: z.string(),
        direction: z.enum(DIRECTION_VALUES).optional(),
        frequency: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await ctx.db.interfaceDataFlow.findFirst({
        where: { id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.db.interfaceDataFlow.update({ where: { id }, data });
    }),

  removeEntity: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.interfaceDataFlow.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db.interfaceDataFlow.delete({ where: { id: input.id } });
      auditLog(ctx, {
        action: "DELETE",
        entityType: "InterfaceDataFlow",
        entityId: input.id,
        before: existing as any,
      });
      return { success: true };
    }),
});
