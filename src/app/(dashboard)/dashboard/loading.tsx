export default function DashboardLoading() {
  return (
    <div className="p-4 sm:p-6 space-y-6 animate-in fade-in duration-300">
      {/* KPI bar skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="glass-chart p-4 space-y-2">
            <div className="skeleton h-7 w-16" />
            <div className="skeleton h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Charts row skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-chart p-5 space-y-3">
          <div className="skeleton h-4 w-40" />
          <div className="skeleton h-[200px] w-full rounded-xl" />
        </div>
        <div className="glass-chart p-5 space-y-3">
          <div className="skeleton h-4 w-36" />
          <div className="skeleton h-[200px] w-full rounded-xl" />
        </div>
      </div>

      {/* Bottom row skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="glass-chart p-5 space-y-3">
            <div className="skeleton h-4 w-32" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="skeleton h-10 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
