import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { auditLog } from "@/server/services/audit";

const CapabilityCreateInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  parentId: z.string().optional(),
  level: z.enum(["L1", "L2", "L3"]),
  organizationId: z.string().optional(),
  strategicImportance: z
    .enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "NOT_ASSESSED"])
    .default("NOT_ASSESSED"),
  currentMaturity: z
    .enum([
      "INITIAL",
      "DEVELOPING",
      "DEFINED",
      "MANAGED",
      "OPTIMIZING",
      "NOT_ASSESSED",
    ])
    .default("NOT_ASSESSED"),
  targetMaturity: z
    .enum([
      "INITIAL",
      "DEVELOPING",
      "DEFINED",
      "MANAGED",
      "OPTIMIZING",
      "NOT_ASSESSED",
    ])
    .default("NOT_ASSESSED"),
  tagIds: z.array(z.string()).optional(),
  sortOrder: z.number().int().default(0),
});

const CapabilityUpdateInput = z.object({
  id: z.string(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  level: z.enum(["L1", "L2", "L3"]).optional(),
  organizationId: z.string().nullable().optional(),
  strategicImportance: z
    .enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "NOT_ASSESSED"])
    .optional(),
  currentMaturity: z
    .enum([
      "INITIAL",
      "DEVELOPING",
      "DEFINED",
      "MANAGED",
      "OPTIMIZING",
      "NOT_ASSESSED",
    ])
    .optional(),
  targetMaturity: z
    .enum([
      "INITIAL",
      "DEVELOPING",
      "DEFINED",
      "MANAGED",
      "OPTIMIZING",
      "NOT_ASSESSED",
    ])
    .optional(),
  tagIds: z.array(z.string()).optional(),
});

const AssessInput = z.object({
  capabilityId: z.string(),
  currentMaturity: z.enum([
    "INITIAL",
    "DEVELOPING",
    "DEFINED",
    "MANAGED",
    "OPTIMIZING",
    "NOT_ASSESSED",
  ]),
  targetMaturity: z.enum([
    "INITIAL",
    "DEVELOPING",
    "DEFINED",
    "MANAGED",
    "OPTIMIZING",
    "NOT_ASSESSED",
  ]),
  strategicImportance: z.enum([
    "CRITICAL",
    "HIGH",
    "MEDIUM",
    "LOW",
    "NOT_ASSESSED",
  ]),
  notes: z.string().optional(),
});

export const capabilityRouter = router({
  // Get full capability tree
  getTree: workspaceProcedure.query(async ({ ctx }) => {
    const capabilities = await ctx.db.businessCapability.findMany({
      where: { workspaceId: ctx.workspaceId, isActive: true },
      include: {
        tags: { include: { tag: true } },
        organization: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true, avatarUrl: true } },
        assessments: {
          orderBy: { assessedAt: "desc" },
          take: 1,
        },
        _count: { select: { children: true } },
      },
      orderBy: [{ level: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });

    return buildTree(capabilities);
  }),

  // Get single capability with full detail
  getById: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const cap = await ctx.db.businessCapability.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
        include: {
          tags: { include: { tag: true } },
          organization: true,
          owner: true,
          parent: { select: { id: true, name: true, level: true } },
          children: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
          },
          assessments: {
            orderBy: { assessedAt: "desc" },
            take: 5,
          },
        },
      });

      if (!cap) throw new TRPCError({ code: "NOT_FOUND" });
      return cap;
    }),

  // Create a capability
  create: workspaceProcedure
    .input(CapabilityCreateInput)
    .mutation(async ({ ctx, input }) => {
      const { tagIds, ...data } = input;

      if (data.parentId) {
        const parent = await ctx.db.businessCapability.findFirst({
          where: { id: data.parentId, workspaceId: ctx.workspaceId },
        });
        if (!parent)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid parent",
          });
      }

      const capability = await ctx.db.businessCapability.create({
        data: {
          ...data,
          workspaceId: ctx.workspaceId,
          tags: tagIds?.length
            ? { create: tagIds.map((tagId) => ({ tagId })) }
            : undefined,
        },
      });

      auditLog(ctx, { action: "CREATE", entityType: "BusinessCapability", entityId: capability.id, after: capability as any });
      return capability;
    }),

  // Update a capability
  update: workspaceProcedure
    .input(CapabilityUpdateInput)
    .mutation(async ({ ctx, input }) => {
      const { id, tagIds, ...data } = input;

      const existing = await ctx.db.businessCapability.findFirst({
        where: { id, workspaceId: ctx.workspaceId },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.$transaction(async (tx) => {
        if (tagIds !== undefined) {
          await tx.capabilityTagMap.deleteMany({
            where: { capabilityId: id },
          });
          if (tagIds.length > 0) {
            await tx.capabilityTagMap.createMany({
              data: tagIds.map((tagId) => ({ capabilityId: id, tagId })),
            });
          }
        }
        return tx.businessCapability.update({ where: { id }, data });
      });

      auditLog(ctx, { action: "UPDATE", entityType: "BusinessCapability", entityId: id, before: existing as any, after: updated as any });
      return updated;
    }),

  // Soft delete
  delete: workspaceProcedure
    .input(
      z.object({ id: z.string(), cascade: z.boolean().default(false) })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.businessCapability.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
        include: { _count: { select: { children: true } } },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      if (existing._count.children > 0 && !input.cascade) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Capability has ${existing._count.children} children. Use cascade=true to delete all.`,
        });
      }

      if (input.cascade) {
        // Recursively soft-delete all descendants
        await softDeleteDescendants(ctx.db, ctx.workspaceId, input.id);
      }

      await ctx.db.businessCapability.update({
        where: { id: input.id },
        data: { isActive: false },
      });

      auditLog(ctx, { action: "DELETE", entityType: "BusinessCapability", entityId: input.id, before: existing as any });
      return { success: true };
    }),

  // Bulk reorder / move (drag-and-drop)
  reorder: workspaceProcedure
    .input(
      z.object({
        updates: z.array(
          z.object({
            id: z.string(),
            sortOrder: z.number().int(),
            parentId: z.string().nullable().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ids = input.updates.map((u) => u.id);
      const owned = await ctx.db.businessCapability.count({
        where: { id: { in: ids }, workspaceId: ctx.workspaceId },
      });
      if (owned !== ids.length) throw new TRPCError({ code: "FORBIDDEN" });

      await ctx.db.$transaction(
        input.updates.map((u) =>
          ctx.db.businessCapability.update({
            where: { id: u.id },
            data: {
              sortOrder: u.sortOrder,
              ...(u.parentId !== undefined ? { parentId: u.parentId } : {}),
            },
          })
        )
      );

      return { success: true };
    }),

  // Assess a single capability
  assess: workspaceProcedure
    .input(AssessInput)
    .mutation(async ({ ctx, input }) => {
      const { capabilityId, ...assessData } = input;

      const cap = await ctx.db.businessCapability.findFirst({
        where: { id: capabilityId, workspaceId: ctx.workspaceId },
      });
      if (!cap) throw new TRPCError({ code: "NOT_FOUND" });

      const [assessment] = await ctx.db.$transaction([
        ctx.db.capabilityAssessment.create({
          data: { capabilityId, ...assessData },
        }),
        ctx.db.businessCapability.update({
          where: { id: capabilityId },
          data: {
            currentMaturity: assessData.currentMaturity,
            targetMaturity: assessData.targetMaturity,
            strategicImportance: assessData.strategicImportance,
          },
        }),
      ]);

      return assessment;
    }),

  // Bulk assess
  bulkAssess: workspaceProcedure
    .input(z.object({ assessments: z.array(AssessInput) }))
    .mutation(async ({ ctx, input }) => {
      const ids = input.assessments.map((a) => a.capabilityId);
      const owned = await ctx.db.businessCapability.count({
        where: { id: { in: ids }, workspaceId: ctx.workspaceId },
      });
      if (owned !== ids.length) throw new TRPCError({ code: "FORBIDDEN" });

      await ctx.db.$transaction([
        ...input.assessments.map((a) =>
          ctx.db.capabilityAssessment.create({
            data: {
              capabilityId: a.capabilityId,
              currentMaturity: a.currentMaturity,
              targetMaturity: a.targetMaturity,
              strategicImportance: a.strategicImportance,
              notes: a.notes,
            },
          })
        ),
        ...input.assessments.map((a) =>
          ctx.db.businessCapability.update({
            where: { id: a.capabilityId },
            data: {
              currentMaturity: a.currentMaturity,
              targetMaturity: a.targetMaturity,
              strategicImportance: a.strategicImportance,
            },
          })
        ),
      ]);

      return { assessed: input.assessments.length };
    }),

  // Return L1 domains for a template (used by the domain picker UI)
  getTemplateDomains: workspaceProcedure
    .input(
      z.object({
        industry: z.enum([
          "BANKING",
          "RETAIL",
          "LOGISTICS",
          "MANUFACTURING",
          "HEALTHCARE",
          "GENERIC",
          "ENTERPRISE_BCM",
        ]),
      })
    )
    .query(async ({ ctx, input }) => {
      const l1s = await ctx.db.capabilityTemplate.findMany({
        where: { industry: input.industry, level: "L1", isActive: true },
        orderBy: [{ sortOrder: "asc" }],
      });
      const l1Codes = l1s.map((t) => t.code);

      // Count direct L2 children per L1
      const l2All = await ctx.db.capabilityTemplate.findMany({
        where: {
          industry: input.industry,
          level: "L2",
          isActive: true,
          parentCode: { in: l1Codes },
        },
        select: { code: true, parentCode: true },
      });
      const l2ToL1 = new Map<string, string>();
      const l2CountMap = new Map<string, number>();
      for (const l2 of l2All) {
        if (l2.parentCode) {
          l2ToL1.set(l2.code, l2.parentCode);
          l2CountMap.set(l2.parentCode, (l2CountMap.get(l2.parentCode) ?? 0) + 1);
        }
      }

      // Count L3s per L1 (traced through L2 parent chain)
      const l2Codes = l2All.map((l2) => l2.code);
      const l3All = l2Codes.length
        ? await ctx.db.capabilityTemplate.findMany({
            where: {
              industry: input.industry,
              level: "L3",
              isActive: true,
              parentCode: { in: l2Codes },
            },
            select: { parentCode: true },
          })
        : [];
      const l3CountMap = new Map<string, number>();
      for (const l3 of l3All) {
        const l1Code = l2ToL1.get(l3.parentCode ?? "");
        if (l1Code) l3CountMap.set(l1Code, (l3CountMap.get(l1Code) ?? 0) + 1);
      }

      return l1s.map((l1) => ({
        code: l1.code,
        name: l1.name,
        band: l1.band,
        strategicImportance: l1.strategicImportance as string,
        l2Count: l2CountMap.get(l1.code) ?? 0,
        l3Count: l3CountMap.get(l1.code) ?? 0,
      }));
    }),

  // Import from industry template
  importFromTemplate: workspaceProcedure
    .input(
      z.object({
        industry: z.enum([
          "BANKING",
          "RETAIL",
          "LOGISTICS",
          "MANUFACTURING",
          "HEALTHCARE",
          "GENERIC",
          "ENTERPRISE_BCM",
        ]),
        levels: z.array(z.enum(["L1", "L2", "L3"])).default(["L1", "L2"]),
        replaceExisting: z.boolean().default(false),
        // Optional: restrict import to specific L1 domain codes
        domainCodes: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let templates;

      if (input.domainCodes?.length) {
        // Hierarchical fetch: only import templates that belong to selected domains
        const l1s = await ctx.db.capabilityTemplate.findMany({
          where: {
            industry: input.industry,
            level: "L1",
            code: { in: input.domainCodes },
            isActive: true,
          },
          orderBy: [{ sortOrder: "asc" }],
        });
        const l1Codes = l1s.map((t) => t.code);

        const l2s =
          input.levels.some((l) => l !== "L1") && l1Codes.length
            ? await ctx.db.capabilityTemplate.findMany({
                where: {
                  industry: input.industry,
                  level: "L2",
                  parentCode: { in: l1Codes },
                  isActive: true,
                },
                orderBy: [{ sortOrder: "asc" }],
              })
            : [];
        const l2Codes = l2s.map((t) => t.code);

        const l3s =
          input.levels.includes("L3") && l2Codes.length
            ? await ctx.db.capabilityTemplate.findMany({
                where: {
                  industry: input.industry,
                  level: "L3",
                  parentCode: { in: l2Codes },
                  isActive: true,
                },
                orderBy: [{ sortOrder: "asc" }],
              })
            : [];

        templates = [...l1s, ...l2s, ...l3s];
      } else {
        // No domain filter — import everything at the requested levels
        templates = await ctx.db.capabilityTemplate.findMany({
          where: {
            industry: input.industry,
            level: { in: input.levels },
            isActive: true,
          },
          orderBy: [{ level: "asc" }, { sortOrder: "asc" }],
        });
      }

      // Pre-create value-chain band tags outside the transaction
      // so we can upsert them cleanly (no nested transaction needed)
      const BAND_COLORS: Record<string, string> = {
        Grow: "#0B5CD6",
        Run: "#3b82f6",
        Protect: "#f59e0b",
      };
      const uniqueBands = [...new Set(
        templates.map((t) => t.band).filter((b): b is string => !!b)
      )];
      const bandTagIds = new Map<string, string>();
      for (const band of uniqueBands) {
        const tag = await ctx.db.capabilityTag.upsert({
          where: { workspaceId_name: { workspaceId: ctx.workspaceId, name: band } },
          update: {},
          create: {
            workspaceId: ctx.workspaceId,
            name: band,
            color: BAND_COLORS[band] ?? "#6366f1",
            description: `Value chain band: ${band}`,
          },
          select: { id: true },
        });
        bandTagIds.set(band, tag.id);
      }

      const codeToId = new Map<string, string>();

      // Run entire import in a single transaction to minimize round trips
      await ctx.db.$transaction(async (tx) => {
        if (input.replaceExisting) {
          await tx.businessCapability.updateMany({
            where: { workspaceId: ctx.workspaceId },
            data: { isActive: false },
          });
        }

        // Must create sequentially per level (L2/L3 need parent IDs from L1)
        for (const level of ["L1", "L2", "L3"] as const) {
          const levelTemplates = templates.filter((t) => t.level === level);

          for (const tpl of levelTemplates) {
            const parentId =
              level === "L1"
                ? null
                : (tpl.parentCode ? codeToId.get(tpl.parentCode) ?? null : null);

            const cap = await tx.businessCapability.create({
              data: {
                workspaceId: ctx.workspaceId,
                name: tpl.name,
                description: tpl.description,
                level: tpl.level,
                parentId,
                externalId: tpl.code,
                sortOrder: tpl.sortOrder,
                strategicImportance: tpl.strategicImportance,
                // Assign band tag inline if this capability has one
                ...(tpl.band && bandTagIds.has(tpl.band)
                  ? {
                      tags: {
                        create: [{ tagId: bandTagIds.get(tpl.band)! }],
                      },
                    }
                  : {}),
              },
              select: { id: true },
            });
            codeToId.set(tpl.code, cap.id);
          }
        }
      });

      return { imported: templates.length };
    }),
});

// Helpers

function buildTree(flat: any[]): any[] {
  const map = new Map(flat.map((c) => [c.id, { ...c, children: [] as any[] }]));
  const roots: any[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

async function softDeleteDescendants(
  db: any,
  workspaceId: string,
  parentId: string
) {
  const children = await db.businessCapability.findMany({
    where: { parentId, workspaceId, isActive: true },
    select: { id: true },
  });

  for (const child of children) {
    await softDeleteDescendants(db, workspaceId, child.id);
    await db.businessCapability.update({
      where: { id: child.id },
      data: { isActive: false },
    });
  }
}
