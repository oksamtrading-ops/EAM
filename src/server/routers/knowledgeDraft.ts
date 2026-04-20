import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";
import { embedKnowledgeRow } from "@/server/ai/embeddings/writeKnowledgeEmbeddings";

const KindEnum = z.enum(["FACT", "DECISION", "PATTERN"]);
const StatusEnum = z.enum(["PENDING", "ACCEPTED", "REJECTED", "MODIFIED"]);

export const knowledgeDraftRouter = router({
  list: workspaceProcedure
    .input(
      z
        .object({
          status: StatusEnum.optional(),
          kind: KindEnum.optional(),
          documentId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.knowledgeDraft.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          status: input?.status,
          kind: input?.kind,
          sourceDocumentId: input?.documentId,
        },
        orderBy: [
          { status: "asc" },
          { confidence: "desc" },
          { createdAt: "asc" },
        ],
        include: {
          sourceDocument: { select: { id: true, filename: true } },
          similarKnowledge: {
            select: { id: true, subject: true, statement: true, kind: true },
          },
        },
      });
    }),

  accept: workspaceProcedure
    .input(
      z.object({
        id: z.string(),
        overrides: z
          .object({
            subject: z.string().min(1).max(200).optional(),
            statement: z.string().min(1).max(2000).optional(),
            kind: KindEnum.optional(),
            confidence: z.number().min(0).max(1).optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const draft = await ctx.db.knowledgeDraft.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
      });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
      if (draft.status === "ACCEPTED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Draft already accepted",
        });
      }

      const subject = input.overrides?.subject ?? draft.subject;
      const statement = input.overrides?.statement ?? draft.statement;
      const kind = input.overrides?.kind ?? draft.kind;
      const confidence = input.overrides?.confidence ?? draft.confidence;

      const committed = await ctx.db.workspaceKnowledge.create({
        data: {
          workspaceId: ctx.workspaceId,
          subject,
          statement,
          kind,
          confidence,
          sourceRunId: draft.sourceRunId ?? null,
          createdBy: ctx.dbUserId,
        },
        select: { id: true },
      });
      await embedKnowledgeRow(committed.id).catch(() => {});

      const updated = await ctx.db.knowledgeDraft.update({
        where: { id: input.id },
        data: {
          status: "ACCEPTED",
          reviewedBy: ctx.dbUserId,
          reviewedAt: new Date(),
          committedKnowledgeId: committed.id,
          subject,
          statement,
          kind,
          confidence,
        },
      });
      return { draft: updated, committedKnowledgeId: committed.id };
    }),

  reject: workspaceProcedure
    .input(z.object({ id: z.string(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const draft = await ctx.db.knowledgeDraft.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
        select: { id: true },
      });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.db.knowledgeDraft.update({
        where: { id: input.id },
        data: {
          status: "REJECTED",
          reviewedBy: ctx.dbUserId,
          reviewedAt: new Date(),
          rejectionReason: input.reason ?? null,
        },
      });
    }),

  modify: workspaceProcedure
    .input(
      z.object({
        id: z.string(),
        subject: z.string().min(1).max(200).optional(),
        statement: z.string().min(1).max(2000).optional(),
        kind: KindEnum.optional(),
        confidence: z.number().min(0).max(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const draft = await ctx.db.knowledgeDraft.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
        select: { id: true, status: true },
      });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
      if (draft.status === "ACCEPTED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot modify an accepted draft",
        });
      }
      const { id, ...data } = input;
      return ctx.db.knowledgeDraft.update({
        where: { id },
        data: { ...data, status: "MODIFIED" },
      });
    }),

  supersede: workspaceProcedure
    .input(
      z.object({
        draftId: z.string(),
        existingKnowledgeId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const draft = await ctx.db.knowledgeDraft.findFirst({
        where: { id: input.draftId, workspaceId: ctx.workspaceId },
      });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
      if (draft.status === "ACCEPTED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Draft already accepted",
        });
      }

      const existing = await ctx.db.workspaceKnowledge.findFirst({
        where: {
          id: input.existingKnowledgeId,
          workspaceId: ctx.workspaceId,
        },
        select: { id: true },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Existing knowledge row not found",
        });
      }

      // Archive the old row, create the new one, mark draft accepted.
      await ctx.db.workspaceKnowledge.update({
        where: { id: existing.id },
        data: { isActive: false },
      });

      const committed = await ctx.db.workspaceKnowledge.create({
        data: {
          workspaceId: ctx.workspaceId,
          subject: draft.subject,
          statement: draft.statement,
          kind: draft.kind,
          confidence: draft.confidence,
          sourceRunId: draft.sourceRunId ?? null,
          createdBy: ctx.dbUserId,
        },
        select: { id: true },
      });
      await embedKnowledgeRow(committed.id).catch(() => {});

      const updated = await ctx.db.knowledgeDraft.update({
        where: { id: input.draftId },
        data: {
          status: "ACCEPTED",
          reviewedBy: ctx.dbUserId,
          reviewedAt: new Date(),
          committedKnowledgeId: committed.id,
        },
      });

      return {
        draft: updated,
        committedKnowledgeId: committed.id,
        archivedKnowledgeId: existing.id,
      };
    }),

  bulkAcceptByConfidence: workspaceProcedure
    .input(z.object({ threshold: z.number().min(0).max(1) }))
    .mutation(async ({ ctx, input }) => {
      const drafts = await ctx.db.knowledgeDraft.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          status: { in: ["PENDING", "MODIFIED"] },
          confidence: { gte: input.threshold },
        },
      });
      let accepted = 0;
      let failed = 0;
      for (const draft of drafts) {
        try {
          const committed = await ctx.db.workspaceKnowledge.create({
            data: {
              workspaceId: ctx.workspaceId,
              subject: draft.subject,
              statement: draft.statement,
              kind: draft.kind,
              confidence: draft.confidence,
              sourceRunId: draft.sourceRunId ?? null,
              createdBy: ctx.dbUserId,
            },
            select: { id: true },
          });
          await embedKnowledgeRow(committed.id).catch(() => {});
          await ctx.db.knowledgeDraft.update({
            where: { id: draft.id },
            data: {
              status: "ACCEPTED",
              reviewedBy: ctx.dbUserId,
              reviewedAt: new Date(),
              committedKnowledgeId: committed.id,
            },
          });
          accepted++;
        } catch {
          failed++;
        }
      }
      return { accepted, failed };
    }),
});
