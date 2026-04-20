import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, workspaceProcedure } from "@/server/trpc";

export const agentRunRouter = router({
  list: workspaceProcedure
    .input(
      z
        .object({
          kind: z.string().optional(),
          kindPrefix: z.string().optional(),
          hideSubRuns: z.boolean().optional(),
          /**
           * Drops console runs whose conversation has been deleted.
           * Use in UIs where orphaned rows are noise (e.g. the
           * deliverable wizard). The trace viewer at /agents/runs
           * still surfaces them for audit purposes.
           */
          hideOrphanConsole: z.boolean().optional(),
          limit: z.number().int().min(1).max(200).default(50),
          cursor: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const orphanFilter =
        input?.hideOrphanConsole
          ? {
              NOT: { kind: "console", conversationId: null },
            }
          : {};
      const runs = await ctx.db.agentRun.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          kind: input?.kind
            ? input.kind
            : input?.kindPrefix
              ? { startsWith: input.kindPrefix }
              : undefined,
          parentRunId: input?.hideSubRuns ? null : undefined,
          ...orphanFilter,
        },
        orderBy: { startedAt: "desc" },
        take: limit + 1, // fetch +1 to know if there's a next page
        ...(input?.cursor
          ? { cursor: { id: input.cursor }, skip: 1 }
          : {}),
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
          parentRunId: true,
          // Conversation title is the human-friendly label for "console"
          // runs (auto-derived from the first user message). Sub-agent
          // and scheduled runs have no conversation — fall back to kind
          // in the UI.
          conversation: { select: { id: true, title: true } },
          _count: { select: { steps: true, subRuns: true } },
        },
      });
      const hasNext = runs.length > limit;
      const items = hasNext ? runs.slice(0, limit) : runs;
      return {
        items,
        nextCursor: hasNext ? items[items.length - 1]!.id : null,
      };
    }),

  listKinds: workspaceProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.agentRun.groupBy({
      by: ["kind"],
      where: { workspaceId: ctx.workspaceId },
      _count: { _all: true },
      orderBy: { kind: "asc" },
    });
    return rows.map((r) => ({ kind: r.kind, count: r._count._all }));
  }),

  getById: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const run = await ctx.db.agentRun.findFirst({
        where: { id: input.id, workspaceId: ctx.workspaceId },
        include: {
          steps: { orderBy: { ordinal: "asc" } },
          parent: { select: { id: true, kind: true, status: true } },
          subRuns: {
            orderBy: { startedAt: "asc" },
            select: {
              id: true,
              kind: true,
              status: true,
              startedAt: true,
              endedAt: true,
              totalTokensIn: true,
              totalTokensOut: true,
              errorMessage: true,
            },
          },
        },
      });
      if (!run) throw new TRPCError({ code: "NOT_FOUND" });
      return run;
    }),
});
