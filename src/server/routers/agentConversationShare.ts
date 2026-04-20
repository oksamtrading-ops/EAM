import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "node:crypto";
import { router, workspaceProcedure } from "@/server/trpc";
import {
  generatePasscode,
  hashPasscode,
} from "@/server/share/accessControl";

const ProtectionModeEnum = z.enum(["ANONYMOUS", "PASSCODE", "SIGNED_IN"]);
// 4-12 chars so we can accept typed-in codes as well as the generator's
// 6-char default. Matches the alphabet the generator uses but we let
// users bring their own if they want.
const PasscodeInput = z
  .string()
  .trim()
  .min(4)
  .max(12)
  .regex(/^[A-Za-z0-9]+$/, "Alphanumeric only");

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
  protectionMode: ProtectionModeEnum.default("ANONYMOUS"),
  // Optional — when caller doesn't supply one on PASSCODE mode, we
  // generate a 6-char code server-side and return it as plaintext.
  passcode: PasscodeInput.optional(),
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
      // Explicit select — never return passcodeHash to the client.
      return ctx.db.agentConversationShare.findUnique({
        where: { conversationId: convo.id },
        select: {
          id: true,
          slug: true,
          title: true,
          redactToolCalls: true,
          expiresAt: true,
          revoked: true,
          createdAt: true,
          protectionMode: true,
        },
      });
    }),

  list: workspaceProcedure.query(async ({ ctx }) => {
    return ctx.db.agentConversationShare.findMany({
      where: {
        createdBy: ctx.dbUserId,
        conversation: { workspaceId: ctx.workspaceId },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        redactToolCalls: true,
        expiresAt: true,
        revoked: true,
        createdAt: true,
        protectionMode: true,
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

      // Resolve the passcode. On PASSCODE mode, use the caller's code
      // if provided, otherwise generate one. Hash before store. Return
      // the plaintext in the mutation result once (UI surfaces it)
      // then forget.
      let plaintextPasscode: string | null = null;
      let passcodeHash: string | null = null;
      if (input.protectionMode === "PASSCODE") {
        plaintextPasscode = input.passcode ?? generatePasscode();
        passcodeHash = hashPasscode(plaintextPasscode);
      }

      const existing = await ctx.db.agentConversationShare.findUnique({
        where: { conversationId: convo.id },
      });
      if (existing) {
        const updated = await ctx.db.agentConversationShare.update({
          where: { id: existing.id },
          data: {
            title: input.title ?? null,
            redactToolCalls: input.redactToolCalls,
            expiresAt,
            revoked: false,
            protectionMode: input.protectionMode,
            // Null out the hash when moving away from PASSCODE; keep
            // the existing hash when mode stays PASSCODE and no new
            // code was supplied (so a plain edit doesn't invalidate a
            // code the user already handed out).
            passcodeHash:
              input.protectionMode === "PASSCODE"
                ? passcodeHash ?? existing.passcodeHash
                : null,
          },
        });
        return { ...updated, plaintextPasscode };
      }

      const created = await ctx.db.agentConversationShare.create({
        data: {
          conversationId: convo.id,
          slug: generateSlug(),
          title: input.title ?? null,
          redactToolCalls: input.redactToolCalls,
          expiresAt,
          createdBy: ctx.dbUserId,
          protectionMode: input.protectionMode,
          passcodeHash,
        },
      });
      return { ...created, plaintextPasscode };
    }),

  /**
   * Generate a fresh passcode for an existing PASSCODE-mode share.
   * Invalidates any unlocked cookies tied to the old hash (they'd
   * still verify HMAC, but the server no longer has the matching
   * hash for fresh unlock attempts — this is good enough for the
   * "I leaked the code" use case).
   */
  rotatePasscode: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const share = await ctx.db.agentConversationShare.findFirst({
        where: {
          id: input.id,
          createdBy: ctx.dbUserId,
          conversation: { workspaceId: ctx.workspaceId },
        },
        select: { id: true, protectionMode: true },
      });
      if (!share) throw new TRPCError({ code: "NOT_FOUND" });
      if (share.protectionMode !== "PASSCODE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Share is not in passcode mode",
        });
      }
      const plaintextPasscode = generatePasscode();
      await ctx.db.agentConversationShare.update({
        where: { id: share.id },
        data: { passcodeHash: hashPasscode(plaintextPasscode) },
      });
      return { plaintextPasscode };
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
