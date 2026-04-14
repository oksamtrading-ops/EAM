export default function RiskLoading() {
  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      {/* Toolbar skeleton */}
      <div className="glass-toolbar border-b px-4 sm:px-5 py-2.5 flex items-center gap-3">
        <div className="skeleton h-8 w-8 rounded-lg" />
        <div className="space-y-1">
          <div className="skeleton h-4 w-48" />
          <div className="skeleton h-3 w-16" />
        </div>
        <div className="flex-1" />
        <div className="skeleton h-8 w-8 rounded-lg" />
        <div className="skeleton h-8 w-8 rounded-lg" />
      </div>

      {/* Stats strip skeleton */}
      <div className="px-4 sm:px-5 py-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 border-b">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="glass-chart p-3 space-y-1.5">
            <div className="skeleton h-6 w-10" />
            <div className="skeleton h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-1 px-4 sm:px-5 py-2 border-b">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-8 w-24 rounded-md" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="flex-1 p-4 sm:p-5">
        <div className="skeleton h-full w-full rounded-xl min-h-[300px]" />
      </div>
    </div>
  );
}
