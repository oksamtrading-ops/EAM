export default function OrganizationsLoading() {
  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      {/* Header skeleton */}
      <div className="glass-toolbar border-b px-4 sm:px-5 py-4 flex items-center gap-3">
        <div className="skeleton h-5 w-32" />
        <div className="flex-1" />
        <div className="skeleton h-8 w-8 rounded-lg" />
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-1 px-4 sm:px-5 py-2 border-b">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-8 w-28 rounded-md" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="flex-1 p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-chart p-4 space-y-3">
              <div className="skeleton h-4 w-32" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
