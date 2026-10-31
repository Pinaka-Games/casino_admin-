"use client";

import { GameProvider } from "../types";
import GameProviderSection from "./Game-provider-section";


interface Props {
  providers: GameProvider[];
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

export default function GameProviderList({
  providers,
  onToggle,
  onToggleFeatured,
  onToggleNew,
  onViewAll,
  onViewCategory,
  onEditCategory,
}: Props) {
  return (
    <div className="space-y-4 ">
      {providers.map((provider) => (
        <GameProviderSection
          key={provider.id}
          provider={provider}
          onToggle={onToggle}
          onToggleFeatured={onToggleFeatured}
          onToggleNew={onToggleNew}
          onViewAll={onViewAll}
          onViewCategory={onViewCategory}
          onEditCategory={onEditCategory}
        />
      ))}
    </div>
  );
}
