export default function CapabilitiesLoading() {
  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      {/* Toolbar skeleton */}
      <div className="glass-toolbar border-b px-4 sm:px-5 py-2.5 flex items-center gap-3">
        <div className="skeleton h-5 w-28" />
        <div className="skeleton h-5 w-8 rounded-full" />
        <div className="w-px h-6 bg-border mx-1" />
        <div className="skeleton h-7 w-28 rounded-lg" />
        <div className="flex-1" />
        <div className="skeleton h-8 w-8 rounded-lg" />
        <div className="skeleton h-8 w-8 rounded-lg" />
      </div>

      {/* Grid skeleton */}
      <div className="flex-1 p-4 sm:p-5 space-y-4 overflow-auto">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="glass-chart p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="skeleton h-5 w-5 rounded" />
              <div className="skeleton h-4 w-48" />
              <div className="skeleton h-4 w-12 rounded-full" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pl-8">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="skeleton h-24 w-full rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
