"use client";

import { Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { FilterChip } from "./types";

interface FilterToolbarProps {
  /** Omitted (or empty) where the screen already carries its own heading. */
  title?: string;
  /** e.g. "128 rounds" — shown next to the title. */
  countLabel?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  activeCount: number;
  /** Kept in the prop shape for callers; the toolbar no longer renders chips. */
  chips?: FilterChip[];
  /**
   * Kept in the prop shape because every caller passes it and their empty
   * states read the same value; the chip row itself keys off `chips`.
   */
  hasAnyFilter?: boolean;
  onOpenFilters: () => void;
  /** Kept in the prop shape for callers; filters are cleared from the sheet. */
  onResetAll?: () => void;
  /** Extra controls (export, add, refresh) rendered left of the Filters button. */
  actions?: React.ReactNode;
  /**
   * Hides the Filters button for a screen that only searches. Better than
   * rendering one that opens an empty sheet.
   */
  showFilters?: boolean;
  /**
   * Overrides the default bottom margin. A page that already wraps the toolbar
   * in its own padded panel passes `mb-0`, otherwise the panel's padding and
   * this margin stack and the row sits off-centre inside it.
   */
  className?: string;
}

/**
 * The header every filterable screen shares: an optional title + count, then a
 * full-width row holding the search box, the Filters button and the screen's
 * own actions.
 *
 * Filters are set and cleared in the sheet the button opens, so the toolbar
 * shows only how many are active rather than a row of removable chips.
 *
 * The controls sit on their own line under the heading rather than beside it.
 * Sharing a row meant the search box was squeezed to whatever the title left
 * over, so the same component was a different width on every tab; on its own
 * line the box can take the space and the tabs finally agree.
 */
export default function FilterToolbar({
  title,
  countLabel,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  activeCount,
  onOpenFilters,
  actions,
  showFilters = true,
  className,
}: FilterToolbarProps) {
  return (
    <div className={cn("mb-3", className)}>
      {(title || countLabel) && (
        <div className="mb-2 flex items-baseline gap-2">
          {title ? <h3 className="text-gray-400 text-md">{title}</h3> : null}
          {countLabel && <span className="text-xs text-gray-500">{countLabel}</span>}
        </div>
      )}

      {/* One line on a phone: wrapping dropped the actions onto a second row
          under a lone search box. The search gives up width first, and a
          screen with more actions than fit scrolls sideways instead. */}
      <div className="flex w-full flex-nowrap items-center gap-2 overflow-x-auto scrollbar-hide sm:flex-wrap sm:gap-3 sm:overflow-visible">
        {/* Search takes the row; the icon sits inside the field, as it does on
            the listing pages, rather than as a separate button beside it.
            (dev's version used ListSearch capped at `sm:w-72`, which is what
            made the box a different width on every screen.) */}
        <div className="group relative min-w-[140px] flex-1 sm:min-w-[200px]">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 transition-colors group-focus-within:text-[#B93DEB]"
          />
          <Input
            value={searchValue}
            placeholder={searchPlaceholder}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-[#242B35]! border-none pl-9 text-sm text-white placeholder:text-gray-500"
          />
        </div>

        {/* Filters sits directly after the search box and the page's own
            actions follow it, matching the User Listing toolbar. */}
        {showFilters && (
        <Button
          type="button"
          variant="outline"
          onClick={onOpenFilters}
          className="shrink-0 cursor-pointer gap-2 bg-[#242B35] border-gray-700 text-white hover:bg-[#2f3743] hover:text-white"
        >
          <Filter size={16} className="text-[#B93DEB]" />
          Filters
          {activeCount > 0 && (
            <span className="ml-1 rounded-md bg-purple-500 px-1.5 py-0.5 text-[11px] leading-none text-white">
              {activeCount}
            </span>
          )}
        </Button>
        )}

        {actions}
      </div>

    </div>
  );
}
