"use client";

import { Button } from "@/components/ui/button";
import { GameProvider } from "../types";
import { ChevronRight } from "lucide-react";
import GameCategory from "./Game-Categories";

interface Props {
  provider: GameProvider;
  onToggle: (
    providerId: string | number,
    categoryId: string | number,
    itemId: string | number,
    value: boolean
  ) => void;
  onToggleFeatured?: (
    providerId: string | number,
    categoryId: string | number,
    itemId: string | number,
    value: boolean
  ) => void;
  onToggleNew?: (
    providerId: string | number,
    categoryId: string | number,
    itemId: string | number,
    value: boolean
  ) => void;
  onViewAll: (id: string | number) => void;
  onViewCategory?: (providerId: string | number, categoryName: string) => void;
  onEditCategory?: (categoryId: string | number, categoryName: string) => void;
}

export default function GameProviderSection({
  provider,
  onToggle,
  onToggleFeatured,
  onToggleNew,
  onViewAll,
  onViewCategory,
  onEditCategory,
}: Props) {
  const categories = provider?.categories ?? [];

  const totalGames =
    provider?.totalGames ??
    categories.reduce((acc, cat) => acc + (cat.count ?? cat.items?.length ?? 0), 0);

  return (
    <div className="w-full rounded-xl border border-gray-800/50 bg-[#15181E] p-5 transition-all duration-300 hover:border-gray-700/50">

      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold tracking-tight text-white capitalize">
              {provider?.name}
            </h2>

            <div className="flex items-center gap-2">
              <span className="rounded bg-[#B93DEB]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#B93DEB]">
                {totalGames} Games
              </span>

              <div className="h-1 w-1 rounded-full bg-gray-700" />

              <span className="text-[9px] font-medium text-gray-500">
                {categories.length} Categories
              </span>
            </div>
          </div>
        </div>

        {/* <Button
          size="sm"
          onClick={() => onViewAll(provider.id)}
          className="group flex h-8 items-center gap-2 rounded-full border border-gray-700/50 bg-[#242B35] px-4 text-[10px] font-bold text-white transition-all duration-300 hover:bg-[#B93DEB]"
        >
          <span>View All Games</span>

          <ChevronRight
            size={12}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </Button> */}
      </div>

      {/* Categories */}
      <div className="space-y-6">
        {categories.map((category) => (
          <GameCategory
            key={category.id}
            providerId={provider.id}
            category={category}
            onToggle={onToggle}
            onToggleFeatured={onToggleFeatured}
            onToggleNew={onToggleNew}
            onViewAll={onViewCategory}
            onEditCategory={onEditCategory}
          />
        ))}
      </div>
    </div>
  );
}