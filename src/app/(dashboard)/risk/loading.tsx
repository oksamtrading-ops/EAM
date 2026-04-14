export default function RiskLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0B5CD6] border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading Risk & Compliance…</p>
      </div>
    </div>
  );
}
