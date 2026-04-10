import { router } from "@/server/trpc";
import { capabilityRouter } from "./capability";
import { workspaceRouter } from "./workspace";
import { tagRouter } from "./tag";

export const appRouter = router({
  capability: capabilityRouter,
  workspace: workspaceRouter,
  tag: tagRouter,
});

export type AppRouter = typeof appRouter;
