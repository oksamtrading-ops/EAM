import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";

const STANDARD_CATEGORIES = [
  "PRODUCT_CHOICE",
  "VERSION_CHOICE",
  "PROTOCOL",
  "SECURITY",
  "ARCHITECTURE_PATTERN",
  "HOSTING",
  "INTEGRATION",
  "DATA",
  "OTHER",
] as const;

const STANDARD_LEVELS = ["MANDATORY", "RECOMMENDED", "DEPRECATED", "PROHIBITED"] as const;
const STANDARD_STATUSES = ["DRAFT", "ACTIVE", "RETIRED"] as const;

const StandardCreateInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().nullable().optional(),
  category: z.enum(STANDARD_CATEGORIES).default("OTHER"),
  level: z.enum(STANDARD_LEVELS).default("RECOMMENDED"),
  status: z.enum(STANDARD_STATUSES).default("ACTIVE"),
  productId: z.string().nullable().optional(),
  versionId: z.string().nullable().optional(),
  ownerId: z.string().nullable().optional(),
  effectiveDate: z.coerce.date().nullable().optional(),
  reviewDate: z.coerce.date().nullable().optional(),
  rationale: z.string().nullable().optional(),
});

const StandardUpdateInput = StandardCreateInput.partial().extend({
  id: z.string(),
  isActive: z.boolean().optional(),
});

export const technologyStandardRouter = router({
  list: workspaceProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          category: z.enum(STANDARD_CATEGORIES).optional(),
          level: z.enum(STANDARD_LEVELS).optional(),
          status: z.enum(STANDARD_STATUSES).optional(),
          productId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.technologyStandard.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          isActive: true,
          ...(input?.category ? { category: input.category } : {}),
          ...(input?.level ? { level: input.level } : {}),
          ...(input?.status ? { status: input.status } : {}),
          ...(input?.productId ? { productId: input.productId } : {}),
          ...(input?.search
            ? { name: { contains: input.search, mode: "insensitive" as const } }
            : {}),
        },
        include: {
          product: { select: { id: true, name: true, type: true } },
          version: { select: { id: true, version: true, lifecycleStatus: true } },
          owner: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      });
    }),

  getById: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const s = await ctx.db.technologyStandard.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
        include: {
          product: true,
          version: true,
          owner: { select: { id: true, name: true, email: true } },
        },
      });
      if (!s) throw new TRPCError({ code: "NOT_FOUND" });
      return s;
    }),

  create: workspaceProcedure
    .input(StandardCreateInput)
    .mutation(async ({ ctx, input }) => {
      if (!input.name && !input.productId && !input.versionId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "At least one of name, productId, or versionId is required",
        });
      }
      if (input.productId) {
        const p = await ctx.db.technologyProduct.findFirst({
          where: { id: input.productId, workspaceId: ctx.workspaceId },
        });
        if (!p) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid product" });
      }
      if (input.versionId) {
        const v = await ctx.db.technologyVersion.findFirst({
          where: { id: input.versionId, workspaceId: ctx.workspaceId },
        });
        if (!v) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid version" });
      }

      const created = await ctx.db.technologyStandard.create({
        data: { ...input, workspaceId: ctx.workspaceId },
      });
      auditLog(ctx, {
        action: "CREATE",
        entityType: "TechnologyStandard",
        entityId: created.id,
        after: created as unknown as Record<string, unknown>,
      });
      return created;
    }),

  update: workspaceProcedure
    .input(StandardUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.technologyStandard.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const { id, ...data } = input;
      const updated = await ctx.db.technologyStandard.update({
        where: { id },
        data,
      });
      auditLog(ctx, {
        action: "UPDATE",
        entityType: "TechnologyStandard",
        entityId: id,
        before: existing as unknown as Record<string, unknown>,
        after: updated as unknown as Record<string, unknown>,
      });
      return updated;
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.technologyStandard.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.technologyStandard.update({
        where: { id: input.id },
        data: { isActive: false },
      });
      auditLog(ctx, {
        action: "DELETE",
        entityType: "TechnologyStandard",
        entityId: input.id,
        before: existing as unknown as Record<string, unknown>,
      });
      return updated;
    }),

  complianceSummary: workspaceProcedure.query(async ({ ctx }) => {
    const standards = await ctx.db.technologyStandard.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        isActive: true,
        status: "ACTIVE",
      },
      select: { id: true, level: true, productId: true, versionId: true },
    });
    const prohibited = standards.filter((s) => s.level === "PROHIBITED");
    const deprecated = standards.filter((s) => s.level === "DEPRECATED");
    const mandatory = standards.filter((s) => s.level === "MANDATORY");
    const recommended = standards.filter((s) => s.level === "RECOMMENDED");
    return {
      total: standards.length,
      prohibited: prohibited.length,
      deprecated: deprecated.length,
      mandatory: mandatory.length,
      recommended: recommended.length,
    };
  }),
});
