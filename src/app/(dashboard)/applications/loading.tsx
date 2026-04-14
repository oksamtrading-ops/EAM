export default function ApplicationsLoading() {
  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      {/* Toolbar skeleton */}
      <div className="glass-toolbar border-b px-4 sm:px-5 py-2.5 flex items-center gap-3">
        <div className="skeleton h-5 w-36" />
        <div className="skeleton h-3 w-28" />
        <div className="flex-1" />
        <div className="skeleton h-8 w-40 rounded-lg" />
        <div className="skeleton h-8 w-8 rounded-lg" />
      </div>

      {/* Table skeleton */}
      <div className="flex-1 p-4 sm:p-5">
        <div className="glass-chart overflow-hidden">
          {/* Header row */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-border">
            {["w-40", "w-24", "w-32", "w-20", "w-28"].map((w, i) => (
              <div key={i} className={`skeleton h-3 ${w}`} />
            ))}
          </div>
          {/* Data rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-b-0">
              <div className="skeleton h-4 w-40" />
              <div className="skeleton h-5 w-16 rounded-full" />
              <div className="skeleton h-4 w-32" />
              <div className="skeleton h-4 w-20" />
              <div className="skeleton h-4 w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
