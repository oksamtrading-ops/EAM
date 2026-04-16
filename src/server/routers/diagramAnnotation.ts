import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";

const SCENARIO_VALUES = ["AS_IS", "TO_BE"] as const;

const ANNOTATION_TYPE_VALUES = [
  "CONTAINER",
  "NOTE",
  "RECTANGLE",
  "CIRCLE",
  "CYLINDER",
  "CLOUD",
  "LINE",
  "ARROW",
] as const;

const ANCHOR_KIND_VALUES = ["APP", "ANNOTATION", "FREE"] as const;

const AnchorSchema = z.object({
  kind: z.enum(ANCHOR_KIND_VALUES),
  refId: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  handle: z.enum(["t", "l", "r", "b"]).optional(),
});

const WaypointSchema = z.object({ x: z.number(), y: z.number() });

const BaseFields = {
  scenario: z.enum(SCENARIO_VALUES).default("AS_IS"),
  type: z.enum(ANNOTATION_TYPE_VALUES),
  x: z.number(),
  y: z.number(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  z: z.number().int().optional(),
  rotation: z.number().optional(),
  text: z.string().max(2000).nullable().optional(),
  strokeColor: z.string().max(32).nullable().optional(),
  fillColor: z.string().max(32).nullable().optional(),
  strokeWidth: z.number().int().min(0).max(20).nullable().optional(),
  strokeStyle: z.enum(["solid", "dashed", "dotted"]).nullable().optional(),
  sourceAnchor: AnchorSchema.nullable().optional(),
  targetAnchor: AnchorSchema.nullable().optional(),
  waypoints: z.array(WaypointSchema).optional(),
  routing: z.enum(["orthogonal", "straight"]).optional(),
  headSource: z.boolean().optional(),
  headTarget: z.boolean().optional(),
};

const PatchSchema = z.object({
  type: z.enum(ANNOTATION_TYPE_VALUES).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  z: z.number().int().optional(),
  rotation: z.number().optional(),
  text: z.string().max(2000).nullable().optional(),
  strokeColor: z.string().max(32).nullable().optional(),
  fillColor: z.string().max(32).nullable().optional(),
  strokeWidth: z.number().int().min(0).max(20).nullable().optional(),
  strokeStyle: z.enum(["solid", "dashed", "dotted"]).nullable().optional(),
  sourceAnchor: AnchorSchema.nullable().optional(),
  targetAnchor: AnchorSchema.nullable().optional(),
  waypoints: z.array(WaypointSchema).optional(),
  routing: z.enum(["orthogonal", "straight"]).optional(),
  headSource: z.boolean().optional(),
  headTarget: z.boolean().optional(),
});

export const diagramAnnotationRouter = router({
  list: workspaceProcedure
    .input(z.object({ scenario: z.enum(SCENARIO_VALUES).default("AS_IS") }))
    .query(async ({ ctx, input }) => {
      return ctx.db.diagramAnnotation.findMany({
        where: { workspaceId: ctx.workspaceId, scenario: input.scenario },
        orderBy: [{ z: "asc" }, { createdAt: "asc" }],
      });
    }),

  create: workspaceProcedure
    .input(z.object(BaseFields))
    .mutation(async ({ ctx, input }) => {
      const { scenario, ...rest } = input;
      const created = await ctx.db.diagramAnnotation.create({
        data: {
          workspaceId: ctx.workspaceId,
          scenario,
          type: rest.type,
          x: rest.x,
          y: rest.y,
          width: rest.width ?? null,
          height: rest.height ?? null,
          z: rest.z ?? 0,
          rotation: rest.rotation ?? 0,
          text: rest.text ?? null,
          strokeColor: rest.strokeColor ?? null,
          fillColor: rest.fillColor ?? null,
          strokeWidth: rest.strokeWidth ?? null,
          strokeStyle: rest.strokeStyle ?? null,
          sourceAnchor: rest.sourceAnchor === undefined ? undefined : (rest.sourceAnchor as object | null) ?? undefined,
          targetAnchor: rest.targetAnchor === undefined ? undefined : (rest.targetAnchor as object | null) ?? undefined,
          waypoints: (rest.waypoints ?? []) as object,
          routing: rest.routing ?? "orthogonal",
          headSource: rest.headSource ?? false,
          headTarget: rest.headTarget ?? true,
          createdById: ctx.dbUserId,
        },
      });
      auditLog(ctx, {
        action: "CREATE",
        entityType: "DiagramAnnotation",
        entityId: created.id,
        after: created as any,
      });
      return created;
    }),

  update: workspaceProcedure
    .input(z.object({ id: z.string(), patch: PatchSchema }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.diagramAnnotation.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const { patch } = input;
      const data: Record<string, unknown> = {};
      for (const key of Object.keys(patch) as Array<keyof typeof patch>) {
        if (patch[key] === undefined) continue;
        // JSON fields need a cast
        if (key === "sourceAnchor" || key === "targetAnchor" || key === "waypoints") {
          data[key] = patch[key] as object | null;
        } else {
          data[key] = patch[key];
        }
      }

      return ctx.db.diagramAnnotation.update({
        where: { id: input.id },
        data,
      });
    }),

  bulkUpdate: workspaceProcedure
    .input(
      z.object({
        updates: z
          .array(z.object({ id: z.string(), patch: PatchSchema }))
          .max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Narrow by workspace first to reject foreign ids in a single query.
      const ids = input.updates.map((u) => u.id);
      const owned = await ctx.db.diagramAnnotation.findMany({
        where: { id: { in: ids }, workspaceId: ctx.workspaceId },
        select: { id: true },
      });
      const ownedSet = new Set(owned.map((o) => o.id));

      const results = await Promise.all(
        input.updates
          .filter((u) => ownedSet.has(u.id))
          .map((u) => {
            const data: Record<string, unknown> = {};
            for (const key of Object.keys(u.patch) as Array<keyof typeof u.patch>) {
              if (u.patch[key] === undefined) continue;
              if (key === "sourceAnchor" || key === "targetAnchor" || key === "waypoints") {
                data[key] = u.patch[key] as object | null;
              } else {
                data[key] = u.patch[key];
              }
            }
            return ctx.db.diagramAnnotation.update({ where: { id: u.id }, data });
          })
      );
      return { updated: results.length };
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.diagramAnnotation.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db.diagramAnnotation.delete({ where: { id: input.id } });
      auditLog(ctx, {
        action: "DELETE",
        entityType: "DiagramAnnotation",
        entityId: input.id,
        before: existing as any,
      });
      return { success: true };
    }),

  bulkDelete: workspaceProcedure
    .input(z.object({ ids: z.array(z.string()).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const res = await ctx.db.diagramAnnotation.deleteMany({
        where: { id: { in: input.ids }, workspaceId: ctx.workspaceId },
      });
      return { deleted: res.count };
    }),
});
