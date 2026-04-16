import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";
import { optionalUrl } from "@/server/lib/zod";

const TECHNOLOGY_TYPES = [
  "SOFTWARE",
  "CLOUD_SERVICE",
  "DATABASE",
  "MIDDLEWARE",
  "SERVER",
  "NETWORK",
  "OPERATING_SYSTEM",
  "LANGUAGE",
  "FRAMEWORK",
  "PLATFORM",
  "LIBRARY",
  "CONTAINER",
  "OTHER",
] as const;

const LICENSE_TYPES = [
  "COMMERCIAL",
  "OSS_PERMISSIVE",
  "OSS_COPYLEFT",
  "PROPRIETARY_INTERNAL",
  "FREEMIUM",
  "UNKNOWN",
] as const;

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const ProductCreateInput = z.object({
  vendorId: z.string(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(80).optional(),
  type: z.enum(TECHNOLOGY_TYPES).default("OTHER"),
  category: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  website: optionalUrl(),
  openSource: z.boolean().default(false),
  licenseType: z.enum(LICENSE_TYPES).default("UNKNOWN"),
  techRadarEntryId: z.string().nullable().optional(),
});

const ProductUpdateInput = z.object({
  id: z.string(),
  vendorId: z.string().optional(),
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(80).optional(),
  type: z.enum(TECHNOLOGY_TYPES).optional(),
  category: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  website: optionalUrl(),
  openSource: z.boolean().optional(),
  licenseType: z.enum(LICENSE_TYPES).optional(),
  techRadarEntryId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const technologyProductRouter = router({
  list: workspaceProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          type: z.enum(TECHNOLOGY_TYPES).optional(),
          vendorId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.technologyProduct.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          isActive: true,
          ...(input?.type ? { type: input.type } : {}),
          ...(input?.vendorId ? { vendorId: input.vendorId } : {}),
          ...(input?.search
            ? { name: { contains: input.search, mode: "insensitive" as const } }
            : {}),
        },
        include: {
          vendor: { select: { id: true, name: true, category: true, status: true } },
          _count: { select: { versions: true, components: true } },
        },
        orderBy: [{ name: "asc" }],
      });
    }),

  getById: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const product = await ctx.db.technologyProduct.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
        include: {
          vendor: true,
          versions: {
            where: { isActive: true },
            orderBy: [{ releaseDate: "desc" }, { version: "desc" }],
          },
          components: {
            where: { isActive: true },
            include: {
              version: { select: { id: true, version: true, lifecycleStatus: true } },
              _count: { select: { applications: true } },
            },
            orderBy: [{ name: "asc" }],
          },
          dependenciesOut: {
            include: {
              targetProduct: { select: { id: true, name: true, type: true } },
            },
          },
          dependenciesIn: {
            include: {
              sourceProduct: { select: { id: true, name: true, type: true } },
            },
          },
        },
      });
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      return product;
    }),

  create: workspaceProcedure
    .input(ProductCreateInput)
    .mutation(async ({ ctx, input }) => {
      const vendor = await ctx.db.vendor.findFirst({
        where: { id: input.vendorId, workspaceId: ctx.workspaceId },
      });
      if (!vendor)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid vendor" });

      const slug = input.slug ?? slugify(input.name);
      const existingSlug = await ctx.db.technologyProduct.findFirst({
        where: { workspaceId: ctx.workspaceId, slug },
      });
      if (existingSlug)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Slug "${slug}" is already taken`,
        });

      const product = await ctx.db.technologyProduct.create({
        data: {
          ...input,
          slug,
          workspaceId: ctx.workspaceId,
        },
      });
      auditLog(ctx, {
        action: "CREATE",
        entityType: "TechnologyProduct",
        entityId: product.id,
        after: product as unknown as Record<string, unknown>,
      });
      return product;
    }),

  update: workspaceProcedure
    .input(ProductUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.technologyProduct.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const { id, ...data } = input;
      const updated = await ctx.db.technologyProduct.update({ where: { id }, data });
      auditLog(ctx, {
        action: "UPDATE",
        entityType: "TechnologyProduct",
        entityId: id,
        before: existing as unknown as Record<string, unknown>,
        after: updated as unknown as Record<string, unknown>,
      });
      return updated;
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.technologyProduct.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.technologyProduct.update({
        where: { id: input.id },
        data: { isActive: false },
      });
      auditLog(ctx, {
        action: "DELETE",
        entityType: "TechnologyProduct",
        entityId: input.id,
        before: existing as unknown as Record<string, unknown>,
      });
      return updated;
    }),

  linkTechRadarEntry: workspaceProcedure
    .input(z.object({ productId: z.string(), techRadarEntryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const product = await ctx.db.technologyProduct.findFirst({
        where: { id: input.productId, workspaceId: ctx.workspaceId },
      });
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      const entry = await ctx.db.techRadarEntry.findFirst({
        where: { id: input.techRadarEntryId, workspaceId: ctx.workspaceId },
      });
      if (!entry)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid TechRadar entry" });

      return ctx.db.technologyProduct.update({
        where: { id: input.productId },
        data: { techRadarEntryId: input.techRadarEntryId },
      });
    }),

  unlinkTechRadarEntry: workspaceProcedure
    .input(z.object({ productId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const product = await ctx.db.technologyProduct.findFirst({
        where: { id: input.productId, workspaceId: ctx.workspaceId },
      });
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.db.technologyProduct.update({
        where: { id: input.productId },
        data: { techRadarEntryId: null },
      });
    }),
});
