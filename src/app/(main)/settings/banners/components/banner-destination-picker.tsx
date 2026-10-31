"use client";

import * as React from "react";
import { Check, ChevronDown, Link2, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import {
  CUSTOM_DESTINATION,
  DestinationOption,
} from "./banner-destinations";

/**
 * Destination picker for the banner button.
 *
 * A native <select> was unusable here: the browser renders the list itself, so
 * it ignores the dark theme, can't be searched, and a ~30-route list turns into
 * a tall OS-drawn scroller. This is a normal popover — themed, filterable, and
 * grouped by menu section, with the route shown under each name so two similarly
 * named pages can be told apart.
 */
export function BannerDestinationPicker({
  value,
  options,
  isCustom,
  onSelect,
  onCustom,
}: {
  value: string;
  options: DestinationOption[];
  isCustom: boolean;
  onSelect: (value: string) => void;
  onCustom: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  // A stale query would silently hide options the next time this opens.
  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const selected = options.find((option) => option.value === value);

  const groups = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    const matched = term
      ? options.filter(
          (option) =>
            option.label.toLowerCase().includes(term) ||
            option.value.toLowerCase().includes(term) ||
            option.group.toLowerCase().includes(term),
        )
      : options;

    const map = new Map<string, DestinationOption[]>();
    matched.forEach((option) => {
      const list = map.get(option.group) ?? [];
      list.push(option);
      map.set(option.group, list);
    });
    return Array.from(map.entries());
  }, [options, query]);

  const triggerLabel = isCustom
    ? "Custom link"
    : selected
      ? selected.label
      : "Select a page…";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-gray-700 bg-[#191d24] px-3 text-sm text-left transition-colors hover:border-purple-500/60"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className={selected || isCustom ? "text-white" : "text-gray-500"}>
              {triggerLabel}
            </span>
            {selected && (
              <span className="truncate text-[11px] text-gray-500">
                {selected.value}
              </span>
            )}
          </span>
          <ChevronDown size={15} className="shrink-0 text-gray-500" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[var(--radix-popover-trigger-width)] border-gray-700 bg-[#15181E] p-0 text-white"
      >
        {/* Search — 30+ routes is past the point of scanning by eye */}
        <div className="flex items-center gap-2 border-b border-gray-800 px-3 py-2">
          <Search size={14} className="shrink-0 text-gray-500" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages…"
            className="h-7 border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
          />
        </div>

        {/* The popover lives inside a Radix Dialog, which blocks scroll on
            everything outside its own content to stop the page moving behind
            the modal. That block swallowed this list's wheel events, so it
            rendered a scrollbar that did nothing — stopping propagation here
            keeps the wheel on the list. `overscroll-contain` then stops a
            flick at the end of the list from scrolling the dialog behind it. */}
        <div
          onWheelCapture={(event) => event.stopPropagation()}
          onTouchMoveCapture={(event) => event.stopPropagation()}
          className="max-h-[260px] overflow-y-auto overscroll-contain py-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-track]:bg-transparent"
        >
          {groups.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-gray-500">
              No page matches “{query}”.
            </p>
          )}

          {groups.map(([groupName, groupOptions]) => (
            <div key={groupName} className="px-1 pb-1">
              <p className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                {groupName}
              </p>

              {groupOptions.map((option) => {
                const active = !isCustom && option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onSelect(option.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left transition-colors ${
                      active
                        ? "bg-purple-500/15 text-purple-200"
                        : "text-gray-200 hover:bg-[#242B35]"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px]">
                        {option.label}
                      </span>
                      <span className="block truncate text-[10px] text-gray-500">
                        {option.value}
                      </span>
                    </span>
                    {active && <Check size={14} className="shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Pinned so it stays reachable without scrolling the whole list */}
        <button
          type="button"
          onClick={() => {
            onCustom();
            setOpen(false);
          }}
          className={`flex w-full items-center gap-2 border-t border-gray-800 px-3 py-2.5 text-left text-[13px] transition-colors ${
            isCustom
              ? "bg-purple-500/15 text-purple-200"
              : "text-gray-300 hover:bg-[#242B35]"
          }`}
        >
          <Link2 size={14} className="shrink-0" />
          Custom link…
          {isCustom && <Check size={14} className="ml-auto shrink-0" />}
        </button>
      </PopoverContent>
    </Popover>
  );
}

export { CUSTOM_DESTINATION };
