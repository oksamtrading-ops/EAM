import { AgentRunDetailClient } from "../_components/AgentRunDetailClient";

export default async function AgentRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AgentRunDetailClient runId={id} />;
}
