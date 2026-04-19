import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";
import { rateLimit } from "@/lib/rate-limit";
import { anthropic as client } from "@/server/ai/client";
import { MODEL_SONNET } from "@/server/ai/models";

const MODEL = MODEL_SONNET;

export const maxDuration = 15;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId, name, level, parentName } = await req.json();
  if (!name) return Response.json({ error: "name required" }, { status: 400 });

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId },
    include: { user: true },
  });
  if (!workspace || workspace.user.clerkId !== userId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { allowed } = rateLimit(`cap-desc:${userId}`, { maxRequests: 20, windowMs: 60_000 });
  if (!allowed) {
    return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Write a concise 1-2 sentence business capability description for an Enterprise Architecture capability map.

Capability name: "${name}"
Level: ${level ?? "L1"}${parentName ? `\nParent capability: "${parentName}"` : ""}
Industry: ${workspace.industry}${workspace.subIndustry ? ` / ${workspace.subIndustry}` : ""}

Requirements:
- Describe WHAT this capability does (function/outcome), not HOW
- Use business language, not technical jargon
- Max 40 words
- Do not include the capability name itself in the description
- Return ONLY the description text, no quotes or labels`,
      },
    ],
  });

  const text = response.content.find((b: any) => b.type === "text") as { text: string } | undefined;
  return Response.json({ description: text?.text?.trim() ?? "" });
}
