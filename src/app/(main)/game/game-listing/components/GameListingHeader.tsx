"use client";

import { useState } from "react";
import { LayoutGrid, List, Settings, Tag } from "lucide-react";
import CreateCategoryModal from "./CreateCategoryModal";
import type { ViewMode } from "@/store/game-store";

interface Props {
  onRefresh: () => void;
  /** Current top-level sort/view mode */
  viewMode: ViewMode;
  /** Switch between Category, Provider and the flat All Games list */
  onViewModeChange: (mode: ViewMode) => void;
  /** Opens the catalog sync controls, which used to be a tab of their own. */
  onOpenSettings: () => void;
  settingsActive: boolean;
}

const MODES: { mode: ViewMode; label: string; Icon: typeof Tag }[] = [
  { mode: "category", label: "Category", Icon: Tag },
  { mode: "provider", label: "Provider", Icon: LayoutGrid },
  { mode: "all", label: "All Games", Icon: List },
];

export default function GameListingHeader({
  onRefresh,
  viewMode,
  onViewModeChange,
  onOpenSettings,
  settingsActive,
}: Props) {
  const [openModal, setOpenModal] = useState(false);

  return (
    <>
      <div className="flex flex-col items-stretch gap-3 bg-[#191D24] px-3 py-3 rounded-lg mb-4 min-w-0 md:flex-row md:items-center md:justify-between md:px-4">
        <h1 className="text-white text-sm font-normal whitespace-nowrap">
          Games / Game Listing
        </h1>

        <div className="flex min-w-0 items-center gap-2 overflow-x-auto scrollbar-hide md:gap-3">
          {/* Sync controls: a page-level action, not one of the catalog views
              it used to sit among. */}
          <button
            type="button"
            onClick={onOpenSettings}
            className={`flex items-center gap-2 rounded-lg border px-4 py-1.5 text-sm font-medium transition-all ${
              settingsActive
                ? "border-[#B93DEB] bg-[#B93DEB] text-white"
                : "border-gray-800/50 bg-[#15181E] text-gray-400 hover:text-white"
            }`}
          >
            <Settings size={14} />
            Settings
          </button>

          {/* ===== VIEW SELECTOR: Category / Provider / All Games ===== */}
          <span className="hidden sm:inline text-[11px] font-medium uppercase tracking-wider text-gray-500">
            Sort by
          </span>
          <div className="inline-flex items-center gap-1 rounded-lg border border-gray-800/50 bg-[#15181E] p-1">
            {MODES.map(({ mode, label, Icon }) => (
              <button
                key={mode}
                type="button"
                onClick={() => onViewModeChange(mode)}
                className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-all ${
                  viewMode === mode
                    ? "bg-[#B93DEB] text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <CreateCategoryModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onSuccess={onRefresh}
      />
    </>
  );
}
