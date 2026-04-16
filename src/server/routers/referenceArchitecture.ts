import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";
import { optionalUrl } from "@/server/lib/zod";

const REF_ARCH_STATUSES = ["DRAFT", "ACTIVE", "DEPRECATED"] as const;
const TECH_LAYERS = [
  "PRESENTATION",
  "APPLICATION",
  "DATA",
  "INTEGRATION",
  "INFRASTRUCTURE",
  "SECURITY",
] as const;
const TECH_ROLES = ["PRIMARY", "SECONDARY", "FALLBACK", "DEPRECATED"] as const;

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const RefArchCreateInput = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(80).optional(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  status: z.enum(REF_ARCH_STATUSES).default("DRAFT"),
  ownerId: z.string().nullable().optional(),
  diagramUrl: optionalUrl(),
});

const RefArchUpdateInput = RefArchCreateInput.partial().extend({
  id: z.string(),
  isActive: z.boolean().optional(),
});

export const referenceArchitectureRouter = router({
  list: workspaceProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          status: z.enum(REF_ARCH_STATUSES).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.referenceArchitecture.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          isActive: true,
          ...(input?.status ? { status: input.status } : {}),
          ...(input?.search
            ? { name: { contains: input.search, mode: "insensitive" as const } }
            : {}),
        },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          _count: { select: { components: true } },
        },
        orderBy: [{ name: "asc" }],
      });
    }),

  getById: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const arch = await ctx.db.referenceArchitecture.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          components: {
            include: {
              product: { select: { id: true, name: true, type: true } },
              version: { select: { id: true, version: true, lifecycleStatus: true } },
            },
          },
        },
      });
      if (!arch) throw new TRPCError({ code: "NOT_FOUND" });
      return arch;
    }),

  create: workspaceProcedure
    .input(RefArchCreateInput)
    .mutation(async ({ ctx, input }) => {
      const slug = input.slug ?? slugify(input.name);
      const existing = await ctx.db.referenceArchitecture.findFirst({
        where: { workspaceId: ctx.workspaceId, slug },
      });
      if (existing)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Slug "${slug}" is already taken`,
        });

      const created = await ctx.db.referenceArchitecture.create({
        data: { ...input, slug, workspaceId: ctx.workspaceId },
      });
      auditLog(ctx, {
        action: "CREATE",
        entityType: "ReferenceArchitecture",
        entityId: created.id,
        after: created as unknown as Record<string, unknown>,
      });
      return created;
    }),

  update: workspaceProcedure
    .input(RefArchUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.referenceArchitecture.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const { id, ...data } = input;
      const updated = await ctx.db.referenceArchitecture.update({
        where: { id },
        data,
      });
      auditLog(ctx, {
        action: "UPDATE",
        entityType: "ReferenceArchitecture",
        entityId: id,
        before: existing as unknown as Record<string, unknown>,
        after: updated as unknown as Record<string, unknown>,
      });
      return updated;
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.referenceArchitecture.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.referenceArchitecture.update({
        where: { id: input.id },
        data: { isActive: false },
      });
      auditLog(ctx, {
        action: "DELETE",
        entityType: "ReferenceArchitecture",
        entityId: input.id,
        before: existing as unknown as Record<string, unknown>,
      });
      return updated;
    }),

  addComponent: workspaceProcedure
    .input(
      z.object({
        architectureId: z.string(),
        productId: z.string(),
        versionId: z.string().nullable().optional(),
        layer: z.enum(TECH_LAYERS).default("APPLICATION"),
        role: z.enum(TECH_ROLES).default("PRIMARY"),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const arch = await ctx.db.referenceArchitecture.findFirst({
        where: { id: input.architectureId, workspaceId: ctx.workspaceId },
      });
      if (!arch) throw new TRPCError({ code: "NOT_FOUND" });
      const product = await ctx.db.technologyProduct.findFirst({
        where: { id: input.productId, workspaceId: ctx.workspaceId },
      });
      if (!product)
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid product" });

      return ctx.db.referenceArchitectureComponent.upsert({
        where: {
          architectureId_productId: {
            architectureId: input.architectureId,
            productId: input.productId,
          },
        },
        create: {
          architectureId: input.architectureId,
          productId: input.productId,
          versionId: input.versionId ?? null,
          layer: input.layer,
          role: input.role,
          notes: input.notes ?? null,
        },
        update: {
          versionId: input.versionId ?? null,
          layer: input.layer,
          role: input.role,
          notes: input.notes ?? null,
        },
      });
    }),

  removeComponent: workspaceProcedure
    .input(
      z.object({
        architectureId: z.string(),
        productId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const arch = await ctx.db.referenceArchitecture.findFirst({
        where: { id: input.architectureId, workspaceId: ctx.workspaceId },
      });
      if (!arch) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db.referenceArchitectureComponent.deleteMany({
        where: {
          architectureId: input.architectureId,
          productId: input.productId,
        },
      });
      return { ok: true };
    }),
});
