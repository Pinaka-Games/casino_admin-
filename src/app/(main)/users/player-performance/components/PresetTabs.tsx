"use client";

import type { ReportCurrency } from "@/api/reports/reports";
import { PERFORMANCE_PRESETS, type PresetId } from "@/store/player-performance-store";
import { useHoverIntent } from "./useHoverIntent";

export default function PresetTabs({
  active,
  currency,
  onSelect,
  onPrefetch,
}: {
  active: PresetId | "custom";
  currency: ReportCurrency;
  onSelect: (id: PresetId) => void;
  /** Hover / focus intent: load the preset's first page ahead of the click. */
  onPrefetch: (id: PresetId) => void;
}) {
  const hover = useHoverIntent<PresetId>(onPrefetch);

  return (
    <div
      role="group"
      aria-label="Leaderboard presets"
      className="flex min-w-0 flex-1 gap-2 overflow-x-auto scrollbar-hide"
    >
      {PERFORMANCE_PRESETS.map((p) => {
        const selected = active === p.id;
        // Bonus/deposit % is null for every Wulf Coin row, so that sort would be meaningless.
        const disabled = Boolean(p.cashOnly) && currency === "wulfCoin";
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            title={disabled ? "Bonus / deposit ratio is only tracked for Wulf Cash" : p.description}
            onClick={() => onSelect(p.id)}
            {...(disabled || selected ? {} : hover(p.id))}
            className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              selected
                ? "border-[#B93DEB] bg-[#B93DEB]/15 text-white"
                : "border-[#242B35] bg-[#191D24] text-gray-400 hover:border-[#B93DEB]/50 hover:text-gray-200"
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
