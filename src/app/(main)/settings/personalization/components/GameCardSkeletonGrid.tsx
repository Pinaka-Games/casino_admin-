"use client";

interface GameCardSkeletonGridProps {
  count?: number;
  cardClassName?: string;
}

export default function GameCardSkeletonGrid({
  count = 8,
  cardClassName = "w-[140px]",
}: GameCardSkeletonGridProps) {
  return (
    <div className="mb-2 min-w-0">
      <div className="overflow-x-auto overflow-y-visible pt-2 pb-2 scrollbar-hide">
        <div className="flex gap-4">
          {Array.from({ length: count }).map((_, index) => (
            <div key={index} className={`shrink-0 animate-pulse ${cardClassName}`}>
              <div className="w-full aspect-3/4 rounded-xl bg-[#242B35]" />
              <div className="mx-auto mt-2 h-5 w-8 rounded bg-[#242B35]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
