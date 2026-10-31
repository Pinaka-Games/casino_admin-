"use client";

import { GameCategory as CategoryType } from "../types";
import { ChevronRight, Pencil } from "lucide-react";
import GameItem from "./Game-items";

interface Props {
  providerId: string | number;
  category: CategoryType;
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
  onViewAll?: (providerId: string | number, categoryName: string) => void;
  /** When provided, the header shows an "Edit Category" button (collections) */
  onEditCategory?: (categoryId: string | number, categoryName: string) => void;
}

export default function GameCategory({
  providerId,
  category,
  onToggle,
  onToggleFeatured,
  onToggleNew,
  onViewAll,
  onEditCategory,
}: Props) {
  const items = category?.items ?? [];
  const readOnly = category?.readOnly ?? false;
  // A derived group (Trending Now) has no collection row to edit.
  const autoCurated = category?.autoCurated ?? false;

  return (
    <div className="bg-[#191D24]/50 p-4 rounded-xl border border-gray-800/50 transition-all duration-300 hover:border-gray-700/50 w-full min-w-0">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 md:mb-4">
        <div className="flex min-w-0 items-center gap-3">
          <h3 className="whitespace-nowrap text-gray-400 text-[10px] uppercase font-bold tracking-[0.1em]">
            {category.name}
            <span className="ml-2 text-gray-600 font-normal">
              ({category.count ?? items.length})
            </span>
          </h3>
        </div>

        {category.headerAction ? (
          category.headerAction
        ) : autoCurated ? (
          <span className="whitespace-nowrap rounded-md border border-gray-700/70 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
            {category.autoCuratedHint ?? "Auto-ranked"}
          </span>
        ) : onEditCategory ? (
          <button
            onClick={() => onEditCategory(category.id, category.name)}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-gray-700 px-2 py-1 text-[10px] font-bold text-gray-300 transition-colors hover:border-[#B93DEB] hover:text-[#B93DEB]"
          >
            <Pencil size={11} />
            <span>Edit Category</span>
          </button>
        ) : !readOnly ? (
          <button
            onClick={() => onViewAll?.(providerId, category.name)}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[10px] font-bold text-[#B93DEB] hover:text-[#a32cd4] transition-colors group"
          >
            <span>View All Games</span>
            <ChevronRight size={12} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        ) : null}
      </div>

      {/* HORIZONTAL SCROLL */}
      <div className="relative">
        <div className="flex w-full min-w-0 gap-4 overflow-x-auto pb-3 scroll-smooth scrollbar-hide">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex-shrink-0 w-[calc((100%-1.5rem)/2.2)] sm:w-[calc((100%-3rem)/4)] lg:w-[calc((100%-5rem)/6)]"
            >
              <GameItem
                providerId={providerId}
                categoryId={category.id}
                item={item}
                readOnly={readOnly}
                onToggle={onToggle}
                onToggleFeatured={readOnly ? undefined : onToggleFeatured}
                onToggleNew={readOnly ? undefined : onToggleNew}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
