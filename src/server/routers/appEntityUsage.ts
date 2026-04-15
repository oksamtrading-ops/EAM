import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";

const UsageUpsertInput = z.object({
  appId: z.string(),
  entityId: z.string(),
  creates: z.boolean().optional(),
  reads: z.boolean().optional(),
  updates: z.boolean().optional(),
  deletes: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

export const appEntityUsageRouter = router({
  list: workspaceProcedure
    .input(
      z
        .object({
          appId: z.string().optional(),
          entityId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.appEntityUsage.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          ...(input?.appId ? { appId: input.appId } : {}),
          ...(input?.entityId ? { entityId: input.entityId } : {}),
        },
        include: {
          app: { select: { id: true, name: true, lifecycle: true } },
          entity: {
            select: {
              id: true,
              name: true,
              classification: true,
              domain: { select: { id: true, name: true, color: true } },
            },
          },
        },
        orderBy: [{ app: { name: "asc" } }, { entity: { name: "asc" } }],
      });
    }),

  upsert: workspaceProcedure
    .input(UsageUpsertInput)
    .mutation(async ({ ctx, input }) => {
      // Validate both app and entity belong to this workspace
      const [app, entity] = await Promise.all([
        ctx.db.application.findFirst({
          where: { id: input.appId, workspaceId: ctx.workspaceId },
          select: { id: true },
        }),
        ctx.db.dataEntity.findFirst({
          where: { id: input.entityId, workspaceId: ctx.workspaceId },
          select: { id: true },
        }),
      ]);
      if (!app || !entity) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid app or entity" });
      }

      const { appId, entityId, ...flags } = input;

      // If all CRUD flags are false (or unset), delete the row instead of keeping an empty usage
      const anyFlag =
        (flags.creates ?? false) ||
        (flags.reads ?? false) ||
        (flags.updates ?? false) ||
        (flags.deletes ?? false);

      const existing = await ctx.db.appEntityUsage.findUnique({
        where: { appId_entityId: { appId, entityId } },
      });

      if (!anyFlag && existing) {
        await ctx.db.appEntityUsage.delete({ where: { id: existing.id } });
        auditLog(ctx, {
          action: "DELETE",
          entityType: "AppEntityUsage",
          entityId: existing.id,
          before: existing as unknown as Record<string, unknown>,
        });
        return { deleted: true, id: existing.id };
      }

      const usage = await ctx.db.appEntityUsage.upsert({
        where: { appId_entityId: { appId, entityId } },
        create: {
          workspaceId: ctx.workspaceId,
          appId,
          entityId,
          creates: flags.creates ?? false,
          reads: flags.reads ?? false,
          updates: flags.updates ?? false,
          deletes: flags.deletes ?? false,
          notes: flags.notes ?? null,
        },
        update: {
          ...(flags.creates !== undefined ? { creates: flags.creates } : {}),
          ...(flags.reads !== undefined ? { reads: flags.reads } : {}),
          ...(flags.updates !== undefined ? { updates: flags.updates } : {}),
          ...(flags.deletes !== undefined ? { deletes: flags.deletes } : {}),
          ...(flags.notes !== undefined ? { notes: flags.notes } : {}),
        },
      });

      auditLog(ctx, {
        action: existing ? "UPDATE" : "CREATE",
        entityType: "AppEntityUsage",
        entityId: usage.id,
        before: existing as unknown as Record<string, unknown> | undefined,
        after: usage as unknown as Record<string, unknown>,
      });

      return usage;
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.appEntityUsage.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.appEntityUsage.delete({ where: { id: input.id } });
      auditLog(ctx, {
        action: "DELETE",
        entityType: "AppEntityUsage",
        entityId: input.id,
        before: existing as unknown as Record<string, unknown>,
      });
      return { success: true };
    }),
});
