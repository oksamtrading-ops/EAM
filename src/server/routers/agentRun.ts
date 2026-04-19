import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";

export const agentRunRouter = router({
  list: workspaceProcedure
    .input(
      z
        .object({
          kind: z.string().optional(),
          limit: z.number().int().min(1).max(200).default(50),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.agentRun.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          kind: input?.kind,
        },
        orderBy: { startedAt: "desc" },
        take: input?.limit ?? 50,
        select: {
          id: true,
          kind: true,
          status: true,
          startedAt: true,
          endedAt: true,
          model: true,
          promptVersion: true,
          totalTokensIn: true,
          totalTokensOut: true,
          errorMessage: true,
          _count: { select: { steps: true } },
        },
      });
    }),

  getById: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const run = await ctx.db.agentRun.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
        include: {
          steps: { orderBy: { ordinal: "asc" } },
        },
      });
      if (!run) throw new TRPCError({ code: "NOT_FOUND" });
      return run;
    }),
});
