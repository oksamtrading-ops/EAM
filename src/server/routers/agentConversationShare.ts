import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "node:crypto";
import { router, workspaceProcedure } from "@/server/trpc";

/**
 * Generates a 22-char URL-safe slug. 16 bytes of randomness →
 * ~128 bits of entropy — non-guessable; small collision risk handled
 * by the unique constraint on the DB column.
 */
function generateSlug(): string {
  return randomBytes(16).toString("base64url");
}

const CreateInput = z.object({
  conversationId: z.string(),
  title: z.string().max(200).optional(),
  redactToolCalls: z.boolean().default(true),
  expiryDays: z.number().int().min(1).max(365).nullable().optional(),
});

export const agentConversationShareRouter = router({
  // Fetch the live share for a conversation, if any. Used by the
  // AgentConsole share dialog to show "current URL" vs "no share yet".
  getForConversation: workspaceProcedure
    .input(z.object({ conversationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const convo = await ctx.db.agentConversation.findFirst({
        where: {
          id: input.conversationId,
          workspaceId: ctx.workspaceId,
          userId: ctx.dbUserId,
        },
        select: { id: true },
      });
      if (!convo) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.db.agentConversationShare.findUnique({
        where: { conversationId: convo.id },
      });
    }),

  list: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.db.agentConversationShare.findMany({
      where: {
        createdBy: ctx.dbUserId,
        conversation: { workspaceId: ctx.workspaceId },
      },
      orderBy: { createdAt: "desc" },
      include: {
        conversation: { select: { id: true, title: true } },
      },
    });
  }),

  create: workspaceProcedure
    .input(CreateInput)
    .mutation(async ({ ctx, input }) => {
      // Verify the conversation belongs to this workspace + user.
      const convo = await ctx.db.agentConversation.findFirst({
        where: {
          id: input.conversationId,
          workspaceId: ctx.workspaceId,
          userId: ctx.dbUserId,
        },
        select: { id: true, title: true },
      });
      if (!convo) throw new TRPCError({ code: "NOT_FOUND" });

      // One share per conversation. If a prior one exists, update it
      // in place (flipping revoked=false, refreshing expiry, etc.)
      // rather than creating a second row that would violate the
      // unique constraint.
      const expiresAt = input.expiryDays
        ? new Date(Date.now() + input.expiryDays * 24 * 60 * 60 * 1000)
        : null;

      const existing = await ctx.db.agentConversationShare.findUnique({
        where: { conversationId: convo.id },
      });
      if (existing) {
        return ctx.db.agentConversationShare.update({
          where: { id: existing.id },
          data: {
            title: input.title ?? null,
            redactToolCalls: input.redactToolCalls,
            expiresAt,
            revoked: false,
          },
        });
      }

      return ctx.db.agentConversationShare.create({
        data: {
          conversationId: convo.id,
          slug: generateSlug(),
          title: input.title ?? null,
          redactToolCalls: input.redactToolCalls,
          expiresAt,
          createdBy: ctx.dbUserId,
        },
      });
    }),

  revoke: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const share = await ctx.db.agentConversationShare.findFirst({
        where: {
          id: input.id,
          createdBy: ctx.dbUserId,
          conversation: { workspaceId: ctx.workspaceId },
        },
        select: { id: true },
      });
      if (!share) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.db.agentConversationShare.update({
        where: { id: share.id },
        data: { revoked: true },
      });
    }),
});
