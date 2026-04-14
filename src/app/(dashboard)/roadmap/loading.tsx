export default function RoadmapLoading() {
  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      {/* Toolbar skeleton */}
      <div className="glass-toolbar border-b px-4 sm:px-5 py-2.5 flex items-center gap-3">
        <div className="skeleton h-5 w-40" />
        <div className="flex-1" />
        <div className="skeleton h-8 w-48 rounded-lg" />
        <div className="skeleton h-8 w-8 rounded-lg" />
        <div className="skeleton h-8 w-8 rounded-lg" />
      </div>

      {/* Objective strip skeleton */}
      <div className="px-4 sm:px-5 py-3 border-b flex gap-3 overflow-hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-16 w-56 rounded-xl shrink-0" />
        ))}
      </div>

      {/* Content skeleton — gantt-like rows */}
      <div className="flex-1 p-4 sm:p-5 space-y-2 overflow-auto">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="skeleton h-10 w-40 shrink-0 rounded-lg" />
            <div
              className="skeleton h-8 rounded-lg"
              style={{ width: `${30 + Math.random() * 50}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
