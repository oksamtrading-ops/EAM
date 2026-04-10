import { router } from "@/server/trpc";
import { capabilityRouter } from "./capability";
import { workspaceRouter } from "./workspace";
import { tagRouter } from "./tag";
import { versionRouter } from "./version";
import { applicationRouter } from "./application";

export const appRouter = router({
  capability: capabilityRouter,
  workspace: workspaceRouter,
  tag: tagRouter,
  version: versionRouter,
  application: applicationRouter,
});

export type AppRouter = typeof appRouter;
