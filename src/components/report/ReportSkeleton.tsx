"use client";

/**
 * Lightweight shimmer skeletons for report tables + stat cards. Shown while a
 * report re-queries (e.g. after switching the Wulf Cash / Wulf Coins tab) so the
 * layout stays put and the wait reads as instant instead of a jarring spinner.
 */

const shimmer =
  "relative overflow-hidden rounded bg-[#242B35]/60 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.4s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent";

/** Skeleton rows sized to a table's column count. Render inside <tbody>. */
export function TableSkeletonRows({
  rows = 8,
  cols,
}: {
  rows?: number;
  cols: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className={r % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-5 py-4">
              <div
                className={`${shimmer} h-3.5`}
                style={{ width: `${c === 0 ? 70 : 40 + ((r + c) % 4) * 12}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Skeleton placeholders for the KPI / stat card row above a report table. */
export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-[#242B35] bg-[#191D24] p-5"
        >
          <div className="mb-4 flex items-start justify-between">
            <div className="space-y-3">
              <div className={`${shimmer} h-3 w-20`} />
              <div className={`${shimmer} h-7 w-28`} />
            </div>
            <div className={`${shimmer} h-11 w-11 rounded-xl`} />
          </div>
          <div className={`${shimmer} h-3 w-16`} />
        </div>
      ))}
    </div>
  );
}
