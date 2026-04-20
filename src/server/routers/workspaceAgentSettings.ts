import { z } from "zod";
import { router, workspaceProcedure } from "@/server/trpc";
import { AGENT_SETTINGS_DEFAULTS } from "@/server/ai/settings";

const UpdateInput = z.object({
  maxToolIterations: z.number().int().min(1).max(20).optional(),
  subAgentBudget: z.number().int().min(0).max(10).optional(),
  llmMaxTokens: z.number().int().min(256).max(8000).optional(),
  autoAcceptConfidence: z.number().min(0).max(1).nullable().optional(),
  criticEnabled: z.boolean().optional(),
  staleKnowledgeDays: z.number().int().min(7).max(365).optional(),
});

export const workspaceAgentSettingsRouter = router({
  get: workspaceProcedure.query(async ({ ctx }) => {
    const row = await ctx.db.workspaceAgentSettings.findUnique({
      where: { workspaceId: ctx.workspaceId },
    });
    return row ?? {
      workspaceId: ctx.workspaceId,
      ...AGENT_SETTINGS_DEFAULTS,
      updatedAt: null,
    };
  }),

  update: workspaceProcedure
    .input(UpdateInput)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.workspaceAgentSettings.upsert({
        where: { workspaceId: ctx.workspaceId },
        update: input,
        create: {
          workspaceId: ctx.workspaceId,
          ...AGENT_SETTINGS_DEFAULTS,
          ...input,
        },
      });
    }),

  reset: workspaceProcedure.mutation(async ({ ctx }) => {
    await ctx.db.workspaceAgentSettings
      .delete({ where: { workspaceId: ctx.workspaceId } })
      .catch(() => {});
    return { success: true };
  }),
});
