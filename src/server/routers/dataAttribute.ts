import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";

const CLASSIFICATIONS = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED", "DC_UNKNOWN"] as const;
const REG_TAGS = ["PII", "PHI", "PCI", "GDPR", "CCPA", "SOX", "HIPAA", "FERPA"] as const;

const AttributeCreateInput = z.object({
  entityId: z.string(),
  name: z.string().min(1).max(120),
  dataType: z.string().min(1).max(120),
  isNullable: z.boolean().optional(),
  isPrimaryKey: z.boolean().optional(),
  isForeignKey: z.boolean().optional(),
  fkTargetEntityId: z.string().nullable().optional(),
  classification: z.enum(CLASSIFICATIONS).optional(),
  regulatoryTags: z.array(z.enum(REG_TAGS)).optional(),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

const AttributeUpdateInput = z.object({
  id: z.string(),
  name: z.string().min(1).max(120).optional(),
  dataType: z.string().min(1).max(120).optional(),
  isNullable: z.boolean().optional(),
  isPrimaryKey: z.boolean().optional(),
  isForeignKey: z.boolean().optional(),
  fkTargetEntityId: z.string().nullable().optional(),
  classification: z.enum(CLASSIFICATIONS).optional(),
  regulatoryTags: z.array(z.enum(REG_TAGS)).optional(),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const dataAttributeRouter = router({
  list: workspaceProcedure
    .input(z.object({ entityId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.dataAttribute.findMany({
        where: { workspaceId: ctx.workspaceId, entityId: input.entityId },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
    }),

  create: workspaceProcedure
    .input(AttributeCreateInput)
    .mutation(async ({ ctx, input }) => {
      // Verify entity belongs to workspace
      const entity = await ctx.db.dataEntity.findFirst({
        where: { id: input.entityId, workspaceId: ctx.workspaceId },
        select: { id: true },
      });
      if (!entity) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid entity" });

      // Validate soft FK target (if provided) — must belong to same workspace
      if (input.fkTargetEntityId) {
        const target = await ctx.db.dataEntity.findFirst({
          where: { id: input.fkTargetEntityId, workspaceId: ctx.workspaceId },
          select: { id: true },
        });
        if (!target) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid FK target entity" });
        }
      }

      const attribute = await ctx.db.dataAttribute.create({
        data: {
          ...input,
          regulatoryTags: input.regulatoryTags ?? [],
          workspaceId: ctx.workspaceId,
        },
      });
      auditLog(ctx, {
        action: "CREATE",
        entityType: "DataAttribute",
        entityId: attribute.id,
        after: attribute as unknown as Record<string, unknown>,
      });
      return attribute;
    }),

  update: workspaceProcedure
    .input(AttributeUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.dataAttribute.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      if (input.fkTargetEntityId) {
        const target = await ctx.db.dataEntity.findFirst({
          where: { id: input.fkTargetEntityId, workspaceId: ctx.workspaceId },
          select: { id: true },
        });
        if (!target) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid FK target entity" });
        }
      }

      const { id, ...data } = input;
      const updated = await ctx.db.dataAttribute.update({
        where: { id },
        data,
      });
      auditLog(ctx, {
        action: "UPDATE",
        entityType: "DataAttribute",
        entityId: id,
        before: existing as unknown as Record<string, unknown>,
        after: updated as unknown as Record<string, unknown>,
      });
      return updated;
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.dataAttribute.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.dataAttribute.delete({ where: { id: input.id } });
      auditLog(ctx, {
        action: "DELETE",
        entityType: "DataAttribute",
        entityId: input.id,
        before: existing as unknown as Record<string, unknown>,
      });
      return { success: true };
    }),

  reorder: workspaceProcedure
    .input(z.object({ entityId: z.string(), order: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      // Verify all attributes belong to this entity in this workspace
      const attrs = await ctx.db.dataAttribute.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          entityId: input.entityId,
          id: { in: input.order },
        },
        select: { id: true },
      });
      if (attrs.length !== input.order.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Order contains unknown attributes" });
      }

      await ctx.db.$transaction(
        input.order.map((id, idx) =>
          ctx.db.dataAttribute.update({
            where: { id },
            data: { sortOrder: idx },
          })
        )
      );
      return { success: true };
    }),
});
