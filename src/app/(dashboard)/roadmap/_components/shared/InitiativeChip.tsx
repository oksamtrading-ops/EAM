import { RAGStatusDot } from "./RAGStatusDot";
import { cn } from "@/lib/utils";

const STATUS_BG: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 border-gray-200",
  PLANNED: "bg-blue-100 text-blue-700 border-blue-200",
  IN_PROGRESS: "bg-green-100 text-green-700 border-green-200",
  ON_HOLD: "bg-yellow-100 text-yellow-700 border-yellow-200",
  COMPLETE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-gray-100 text-gray-400 border-gray-200 line-through",
};

export function InitiativeChip({
  initiative,
  onClick,
}: {
  initiative: { id: string; name: string; status: string; ragStatus: string };
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-xs px-2 py-1 rounded border font-medium max-w-[160px] truncate hover:shadow-sm transition-shadow flex items-center gap-1",
        STATUS_BG[initiative.status] ?? "bg-white border-gray-200"
      )}
    >
      <RAGStatusDot status={initiative.ragStatus} />
      <span className="truncate">{initiative.name}</span>
    </button>
  );
}
