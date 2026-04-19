import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";

export const agentConversationRouter = router({
  list: workspaceProcedure
    .input(
      z
        .object({
          kind: z.string().optional(),
          search: z.string().optional(),
          limit: z.number().int().min(1).max(100).default(30),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const search = input?.search?.trim();
      return ctx.db.agentConversation.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          userId: ctx.dbUserId,
          kind: input?.kind,
          ...(search
            ? {
                OR: [
                  { title: { contains: search, mode: "insensitive" } },
                  {
                    messages: {
                      some: {
                        content: { contains: search, mode: "insensitive" },
                      },
                    },
                  },
                ],
              }
            : {}),
        },
        orderBy: { updatedAt: "desc" },
        take: input?.limit ?? 30,
        select: {
          id: true,
          title: true,
          kind: true,
          updatedAt: true,
          createdAt: true,
          _count: { select: { messages: true } },
        },
      });
    }),

  getById: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const convo = await ctx.db.agentConversation.findFirst({
        where: {
          id: input.id,
          workspaceId: ctx.workspaceId,
          userId: ctx.dbUserId,
        },
        include: {
          messages: {
            orderBy: { ordinal: "asc" },
          },
        },
      });
      if (!convo) throw new TRPCError({ code: "NOT_FOUND" });
      return convo;
    }),

  create: workspaceProcedure
    .input(
      z
        .object({
          title: z.string().min(1).max(200).optional(),
          kind: z.string().default("console"),
        })
        .optional()
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.agentConversation.create({
        data: {
          workspaceId: ctx.workspaceId,
          userId: ctx.dbUserId,
          title: input?.title ?? "New thread",
          kind: input?.kind ?? "console",
        },
        select: { id: true, title: true, kind: true, createdAt: true },
      });
    }),

  rename: workspaceProcedure
    .input(z.object({ id: z.string(), title: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const convo = await ctx.db.agentConversation.findFirst({
        where: {
          id: input.id,
          workspaceId: ctx.workspaceId,
          userId: ctx.dbUserId,
        },
        select: { id: true },
      });
      if (!convo) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.db.agentConversation.update({
        where: { id: input.id },
        data: { title: input.title },
      });
    }),

  delete: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const convo = await ctx.db.agentConversation.findFirst({
        where: {
          id: input.id,
          workspaceId: ctx.workspaceId,
          userId: ctx.dbUserId,
        },
        select: { id: true },
      });
      if (!convo) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db.agentConversation.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
