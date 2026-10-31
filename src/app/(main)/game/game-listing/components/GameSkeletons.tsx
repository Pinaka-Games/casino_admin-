"use client";

import { Skeleton } from "@/components/ui/skeleton";

/** Single game card skeleton — mirrors GameItem's 180px card layout */
export function GameItemSkeleton() {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#1a2030] h-[180px] flex flex-col overflow-hidden">
      <Skeleton className="h-28 w-full rounded-none bg-gray-700/40" />
      <div className="flex flex-1 flex-col justify-between p-3">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-3 w-2/3 bg-gray-700/40" />
          <Skeleton className="h-4 w-7 rounded-full bg-gray-700/40" />
        </div>
        <div className="flex items-center justify-between mt-1">
          <Skeleton className="h-2.5 w-16 bg-gray-700/40" />
          <Skeleton className="h-4 w-12 rounded bg-gray-700/40" />
        </div>
      </div>
    </div>
  );
}

/** Responsive grid of card skeletons */
export function GameGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <GameItemSkeleton key={i} />
      ))}
    </div>
  );
}

/** Provider (studio) card skeleton — mirrors the compact logo card */
export function ProviderCardSkeleton() {
  return (
    <div className="flex h-[110px] items-center justify-center rounded-xl border border-[#242B35] bg-[#14171D]">
      <Skeleton className="h-9 w-2/3 bg-gray-700/40" />
    </div>
  );
}

/** Responsive grid of provider card skeletons */
export function ProviderGridSkeleton({ count = 14 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
      {Array.from({ length: count }).map((_, i) => (
        <ProviderCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Detailed provider view skeleton (header + action bar + grid + footer) */
export function DetailedViewSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 flex items-center gap-4 py-2 mb-4">
        <Skeleton className="h-8 w-36 bg-gray-700/40" />
        <Skeleton className="h-5 w-24 bg-gray-700/40" />
      </div>
      <div className="bg-[#191D24] px-4 py-2 rounded-t-xl border border-gray-800/50 flex items-center gap-4">
        <Skeleton className="h-10 w-[180px] bg-gray-700/40" />
        <Skeleton className="h-10 flex-1 max-w-md bg-gray-700/40" />
        <Skeleton className="h-10 w-28 ml-auto bg-gray-700/40" />
      </div>
      <div className="flex-1 px-6 py-8 bg-[#15181E]/40 border-x border-gray-800/50">
        <GameGridSkeleton count={18} />
      </div>
      <div className="shrink-0 bg-[#15181E] px-6 py-4 border border-gray-800/50 rounded-b-xl flex items-center justify-between">
        <Skeleton className="h-3 w-40 bg-gray-700/40" />
        <Skeleton className="h-8 w-48 bg-gray-700/40" />
      </div>
    </div>
  );
}

/** Overview skeleton: provider cards each with a category row of cards */
export function OverviewSkeleton({ providers = 2, categories = 2 }: { providers?: number; categories?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: providers }).map((_, p) => (
        <div key={p} className="w-full rounded-xl border border-gray-800/50 bg-[#15181E] p-5">
          <div className="mb-5 flex items-center gap-3">
            <Skeleton className="h-4 w-28 bg-gray-700/40" />
            <Skeleton className="h-4 w-16 bg-gray-700/40" />
          </div>
          <div className="space-y-6">
            {Array.from({ length: categories }).map((_, c) => (
              <div key={c} className="bg-[#191D24]/50 p-4 rounded-xl border border-gray-800/50">
                <Skeleton className="h-3 w-24 mb-4 bg-gray-700/40" />
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <GameItemSkeleton key={i} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
