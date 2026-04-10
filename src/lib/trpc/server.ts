import "server-only";

import { createTRPCContext } from "@/server/trpc/context";
import { appRouter } from "@/server/routers/_app";
import { createCallerFactory } from "@/server/trpc";
import { headers } from "next/headers";

const createCaller = createCallerFactory(appRouter);

export async function createServerCaller() {
  const hdrs = await headers();
  return createCaller(
    await createTRPCContext({ headers: hdrs })
  );
}
