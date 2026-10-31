"use client";

/**
 * Lazy-loading placeholder for table bodies — shimmer rows instead of a spinning
 * loader. Drop it into a table's loading branch: `<TableSkeleton rows={10} cols={n} />`.
 */
export default function TableSkeleton({
  rows = 10,
  cols = 6,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="divide-y divide-gray-800/30">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="px-6 py-4 flex items-center gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="h-4 rounded bg-[#242B35] animate-pulse"
              style={{
                width: c === 0 ? 70 : c === cols - 1 ? 40 : undefined,
                flex: c === 0 || c === cols - 1 ? "0 0 auto" : "1 1 0%",
                animationDelay: `${(r * cols + c) * 25}ms`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
