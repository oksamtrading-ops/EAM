import { cn } from "@/lib/utils";

const RAG_COLORS: Record<string, string> = {
  GREEN: "bg-green-500",
  AMBER: "bg-amber-400",
  RED: "bg-red-500",
};

export function RAGStatusDot({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full shrink-0",
        RAG_COLORS[status] ?? "bg-gray-400",
        className
      )}
      title={`RAG: ${status}`}
    />
  );
}
