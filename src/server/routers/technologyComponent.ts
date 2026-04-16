import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";

const ENVIRONMENTS = [
  "PRODUCTION",
  "STAGING",
  "TEST",
  "DEVELOPMENT",
  "DR",
  "SHARED",
] as const;

const HOSTING_MODELS = [
  "ON_PREMISES",
  "PRIVATE_CLOUD",
  "PUBLIC_IAAS",
  "PUBLIC_PAAS",
  "SAAS",
  "HYBRID",
] as const;

const TECH_LAYERS = [
  "PRESENTATION",
  "APPLICATION",
  "DATA",
  "INTEGRATION",
  "INFRASTRUCTURE",
  "SECURITY",
] as const;

const TECH_ROLES = ["PRIMARY", "SECONDARY", "FALLBACK", "DEPRECATED"] as const;
const CRITICALITIES = ["CRITICAL", "IMPORTANT", "STANDARD", "OPTIONAL"] as const;

const ComponentCreateInput = z.object({
  productId: z.string(),
  versionId: z.string().nullable().optional(),
  name: z.string().min(1).max(200),
  environment: z.enum(ENVIRONMENTS).default("PRODUCTION"),
  hostingModel: z.enum(HOSTING_MODELS).default("ON_PREMISES"),
  region: z.string().nullable().optional(),
  ownerId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const ComponentUpdateInput = z.object({
  id: z.string(),
  productId: z.string().optional(),
  versionId: z.string().nullable().optional(),
  name: z.string().min(1).max(200).optional(),
  environment: z.enum(ENVIRONMENTS).optional(),
  hostingModel: z.enum(HOSTING_MODELS).optional(),
  region: z.string().nullable().optional(),
  ownerId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const technologyComponentRouter = router({
  list: workspaceProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          productId: z.string().optional(),
          environment: z.enum(ENVIRONMENTS).optional(),
          hostingModel: z.enum(HOSTING_MODELS).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.technologyComponent.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          isActive: true,
          ...(input?.productId ? { productId: input.productId } : {}),
          ...(input?.environment ? { environment: input.environment } : {}),
          ...(input?.hostingModel ? { hostingModel: input.hostingModel } : {}),
          ...(input?.search
            ? { name: { contains: input.search, mode: "insensitive" as const } }
            : {}),
        },
        include: {
          product: {
            select: { id: true, name: true, type: true, vendor: { select: { id: true, name: true } } },
          },
          version: { select: { id: true, version: true, lifecycleStatus: true, endOfLifeDate: true } },
          owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
          _count: { select: { applications: true } },
        },
        orderBy: [{ name: "asc" }],
      });
    }),

  getById: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const component = await ctx.db.technologyComponent.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
        include: {
          product: { include: { vendor: true } },
          version: true,
          owner: true,
          applications: {
            include: {
              application: {
                select: { id: true, name: true, lifecycle: true, businessValue: true },
              },
            },
          },
        },
      });
      if (!component) throw new TRPCError({ code: "NOT_FOUND" });
      return component;
    }),

  create: workspaceProcedure
    .input(ComponentCreateInput)
    .mutation(async ({ ctx, input }) => {
      const product = await ctx.db.technologyProduct.findFirst({
        where: { id: input.productId, workspaceId: ctx.workspaceId },
      });
      if (!product)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid product" });

      if (input.versionId) {
        const version = await ctx.db.technologyVersion.findFirst({
          where: {
            id: input.versionId,
            workspaceId: ctx.workspaceId,
            productId: input.productId,
          },
        });
        if (!version)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Version does not belong to product",
          });
      }

      const component = await ctx.db.technologyComponent.create({
        data: { ...input, workspaceId: ctx.workspaceId },
      });
      auditLog(ctx, {
        action: "CREATE",
        entityType: "TechnologyComponent",
        entityId: component.id,
        after: component as unknown as Record<string, unknown>,
      });
      return component;
    }),

  update: workspaceProcedure
    .input(ComponentUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.technologyComponent.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const { id, ...data } = input;
      const updated = await ctx.db.technologyComponent.update({ where: { id }, data });
      auditLog(ctx, {
        action: "UPDATE",
        entityType: "TechnologyComponent",
        entityId: id,
        before: existing as unknown as Record<string, unknown>,
        after: updated as unknown as Record<string, unknown>,
      });
      return updated;
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.technologyComponent.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.technologyComponent.update({
        where: { id: input.id },
        data: { isActive: false },
      });
      auditLog(ctx, {
        action: "DELETE",
        entityType: "TechnologyComponent",
        entityId: input.id,
        before: existing as unknown as Record<string, unknown>,
      });
      return updated;
    }),

  linkApplication: workspaceProcedure
    .input(
      z.object({
        componentId: z.string(),
        applicationId: z.string(),
        layer: z.enum(TECH_LAYERS).default("APPLICATION"),
        role: z.enum(TECH_ROLES).default("PRIMARY"),
        criticality: z.enum(CRITICALITIES).default("STANDARD"),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const component = await ctx.db.technologyComponent.findFirst({
        where: { id: input.componentId, workspaceId: ctx.workspaceId },
      });
      if (!component) throw new TRPCError({ code: "NOT_FOUND" });
      const app = await ctx.db.application.findFirst({
        where: { id: input.applicationId, workspaceId: ctx.workspaceId },
      });
      if (!app) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid application" });

      const link = await ctx.db.applicationTechnology.upsert({
        where: {
          applicationId_componentId: {
            applicationId: input.applicationId,
            componentId: input.componentId,
          },
        },
        create: {
          applicationId: input.applicationId,
          componentId: input.componentId,
          layer: input.layer,
          role: input.role,
          criticality: input.criticality,
          notes: input.notes ?? null,
        },
        update: {
          layer: input.layer,
          role: input.role,
          criticality: input.criticality,
          notes: input.notes ?? null,
        },
      });
      auditLog(ctx, {
        action: "CREATE",
        entityType: "ApplicationTechnology",
        entityId: `${input.applicationId}:${input.componentId}`,
        after: link as unknown as Record<string, unknown>,
      });
      return link;
    }),

  unlinkApplication: workspaceProcedure
    .input(
      z.object({
        componentId: z.string(),
        applicationId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const component = await ctx.db.technologyComponent.findFirst({
        where: { id: input.componentId, workspaceId: ctx.workspaceId },
      });
      if (!component) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.applicationTechnology.delete({
        where: {
          applicationId_componentId: {
            applicationId: input.applicationId,
            componentId: input.componentId,
          },
        },
      });
      auditLog(ctx, {
        action: "DELETE",
        entityType: "ApplicationTechnology",
        entityId: `${input.applicationId}:${input.componentId}`,
      });
      return { success: true };
    }),

  listForApplication: workspaceProcedure
    .input(z.object({ applicationId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.applicationTechnology.findMany({
        where: {
          applicationId: input.applicationId,
          component: { workspaceId: ctx.workspaceId },
        },
        include: {
          component: {
            include: {
              product: {
                include: { vendor: { select: { id: true, name: true } } },
              },
              version: { select: { id: true, version: true, lifecycleStatus: true } },
            },
          },
        },
      });
    }),
});
