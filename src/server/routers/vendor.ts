import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";
import { optionalUrl } from "@/server/lib/zod";

const VENDOR_CATEGORIES = [
  "HYPERSCALER",
  "SOFTWARE",
  "HARDWARE",
  "SERVICES",
  "OPEN_SOURCE_FOUNDATION",
  "INTERNAL",
  "OTHER",
] as const;

const VENDOR_STATUSES = [
  "ACTIVE",
  "STRATEGIC",
  "UNDER_REVIEW",
  "EXITING",
  "DEPRECATED",
] as const;

const VendorCreateInput = z.object({
  name: z.string().min(1).max(200),
  website: optionalUrl(),
  category: z.enum(VENDOR_CATEGORIES).default("OTHER"),
  description: z.string().nullable().optional(),
  headquartersCountry: z.string().nullable().optional(),
  annualSpend: z.number().nonnegative().nullable().optional(),
  currency: z.string().min(3).max(3).default("USD"),
  contractNotes: z.string().nullable().optional(),
  relationshipOwnerId: z.string().nullable().optional(),
  status: z.enum(VENDOR_STATUSES).default("ACTIVE"),
});

const VendorUpdateInput = z.object({
  id: z.string(),
  name: z.string().min(1).max(200).optional(),
  website: optionalUrl(),
  category: z.enum(VENDOR_CATEGORIES).optional(),
  description: z.string().nullable().optional(),
  headquartersCountry: z.string().nullable().optional(),
  annualSpend: z.number().nonnegative().nullable().optional(),
  currency: z.string().min(3).max(3).optional(),
  contractNotes: z.string().nullable().optional(),
  relationshipOwnerId: z.string().nullable().optional(),
  status: z.enum(VENDOR_STATUSES).optional(),
  isActive: z.boolean().optional(),
});

export const vendorRouter = router({
  list: workspaceProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          status: z.enum(VENDOR_STATUSES).optional(),
          category: z.enum(VENDOR_CATEGORIES).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.vendor.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          isActive: true,
          ...(input?.status ? { status: input.status } : {}),
          ...(input?.category ? { category: input.category } : {}),
          ...(input?.search
            ? { name: { contains: input.search, mode: "insensitive" as const } }
            : {}),
        },
        include: {
          relationshipOwner: { select: { id: true, name: true, email: true, avatarUrl: true } },
          _count: { select: { products: true } },
        },
        orderBy: [{ name: "asc" }],
      });
    }),

  getById: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const vendor = await ctx.db.vendor.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
        include: {
          relationshipOwner: true,
          products: {
            where: { isActive: true },
            include: { _count: { select: { components: true, versions: true } } },
            orderBy: [{ name: "asc" }],
          },
        },
      });
      if (!vendor) throw new TRPCError({ code: "NOT_FOUND" });

      const componentCount = await ctx.db.technologyComponent.count({
        where: {
          workspaceId: ctx.workspaceId,
          isActive: true,
          product: { vendorId: vendor.id },
        },
      });

      return { ...vendor, componentsCount: componentCount };
    }),

  create: workspaceProcedure
    .input(VendorCreateInput)
    .mutation(async ({ ctx, input }) => {
      const vendor = await ctx.db.vendor.create({
        data: {
          ...input,
          workspaceId: ctx.workspaceId,
        },
      });
      auditLog(ctx, {
        action: "CREATE",
        entityType: "Vendor",
        entityId: vendor.id,
        after: vendor as unknown as Record<string, unknown>,
      });
      return vendor;
    }),

  update: workspaceProcedure
    .input(VendorUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.vendor.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const { id, ...data } = input;
      const updated = await ctx.db.vendor.update({ where: { id }, data });
      auditLog(ctx, {
        action: "UPDATE",
        entityType: "Vendor",
        entityId: id,
        before: existing as unknown as Record<string, unknown>,
        after: updated as unknown as Record<string, unknown>,
      });
      return updated;
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.vendor.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.vendor.update({
        where: { id: input.id },
        data: { isActive: false },
      });
      auditLog(ctx, {
        action: "DELETE",
        entityType: "Vendor",
        entityId: input.id,
        before: existing as unknown as Record<string, unknown>,
      });
      return updated;
    }),

  listOwners: workspaceProcedure.query(async ({ ctx }) => {
    const workspace = await ctx.db.workspace.findFirst({
      where: { id: ctx.workspaceId },
      select: { userId: true },
    });
    if (!workspace) return [];
    return ctx.db.user.findMany({
      where: { id: workspace.userId },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });
  }),
});
