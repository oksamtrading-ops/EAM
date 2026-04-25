import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { embedKnowledgeRow } from "@/server/ai/embeddings/writeKnowledgeEmbeddings";
import { mineRecentRunsForKnowledge } from "@/server/ai/services/mineRunsForKnowledge";

const KnowledgeKindEnum = z.enum(["FACT", "DECISION", "PATTERN"]);

export const workspaceKnowledgeRouter = router({
  list: workspaceProcedure
    .input(
      z
        .object({
          kind: KnowledgeKindEnum.optional(),
          search: z.string().optional(),
          includeArchived: z.boolean().optional(),
          limit: z.number().int().min(1).max(200).default(50),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const search = input?.search?.trim();
      return ctx.db.workspaceKnowledge.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          kind: input?.kind,
          isActive: input?.includeArchived ? undefined : true,
          ...(search
            ? {
                OR: [
                  { subject: { contains: search, mode: "insensitive" } },
                  { statement: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: { updatedAt: "desc" },
        take: input?.limit ?? 50,
      });
    }),

  create: workspaceProcedure
    .input(
      z.object({
        subject: z.string().min(1).max(200),
        statement: z.string().min(1).max(2000),
        kind: KnowledgeKindEnum.default("FACT"),
        confidence: z.number().min(0).max(1).default(0.9),
        sourceRunId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const created = await ctx.db.workspaceKnowledge.create({
        data: {
          workspaceId: ctx.workspaceId,
          kind: input.kind,
          subject: input.subject,
          statement: input.statement,
          confidence: input.confidence,
          sourceRunId: input.sourceRunId ?? null,
          createdBy: ctx.dbUserId,
        },
      });
      // Fire-and-forget embed so the new fact is immediately semantically
      // retrievable. Failure leaves it keyword-only until the next write
      // or an explicit backfill run.
      await embedKnowledgeRow(created.id).catch(() => {});
      return created;
    }),

  update: workspaceProcedure
    .input(
      z.object({
        id: z.string(),
        subject: z.string().min(1).max(200).optional(),
        statement: z.string().min(1).max(2000).optional(),
        kind: KnowledgeKindEnum.optional(),
        confidence: z.number().min(0).max(1).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await ctx.db.workspaceKnowledge.findFirst({
        where: { id, workspaceId: ctx.workspaceId },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      const updated = await ctx.db.workspaceKnowledge.update({
        where: { id },
        data,
      });
      // Re-embed if the semantically meaningful fields changed.
      if (input.subject != null || input.statement != null) {
        // Null the stored embedding first — the helper only fills NULL
        // rows. This way the next retrieval after an edit is fresh.
        await ctx.db
          .$executeRaw`UPDATE workspace_knowledge SET embedding = NULL WHERE id = ${id}`;
        await embedKnowledgeRow(id).catch(() => {});
      }
      return updated;
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.workspaceKnowledge.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db.workspaceKnowledge.delete({ where: { id: input.id } });
      return { success: true };
    }),

  /**
   * Sweep recent agent-run outputs for durable findings and propose
   * them as KnowledgeDraft rows. Idempotent — runs that already
   * produced drafts are skipped. Power-user surface; most workspaces
   * will trigger this from the Knowledge tab's overflow menu.
   */
  mineRecentRuns: workspaceProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(100).default(25),
        })
        .optional()
    )
    .mutation(async ({ ctx, input }) => {
      return mineRecentRunsForKnowledge({
        workspaceId: ctx.workspaceId,
        limit: input?.limit ?? 25,
      });
    }),

  /**
   * User re-confirmed a fact still applies. Stamps lastReviewedAt to
   * now, which both clears the Stale badge in the UI and resets the
   * retrieval freshness anchor.
   */
  markReviewed: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.workspaceKnowledge.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.db.workspaceKnowledge.update({
        where: { id: input.id },
        data: { lastReviewedAt: new Date() },
      });
    }),
});
