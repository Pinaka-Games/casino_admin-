"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import {
  DASHBOARD_PRESETS,
  presetRange,
  useDashboardStore,
} from "@/store/dashboard-store";

export default function DateFilters() {
  const {
    activeFilter,
    setActiveFilter,
    fromDate,
    toDate,
    setDates,
  } = useDashboardStore();

  const filters = DASHBOARD_PRESETS;

  const startOfDay = (y: number, m: number, d: number) =>
    new Date(y, m, d, 0, 0, 0, 0);
  const endOfDay = (y: number, m: number, d: number) =>
    new Date(y, m, d, 23, 59, 59, 999);

  // Ranges come from the store's presetRange — the same function the
  // background prefetch uses, so a click lands on the figures it cached.
  const handleFilterClick = (filter: string) => {
    setActiveFilter(filter);
    const range = presetRange(filter);
    if (range) setDates(range[0], range[1]);
  };

  /*
    One range field instead of two single-date fields.

    Picking a start and an end used to mean opening two separate calendars, and
    each pick fired its own request — so choosing "1st to 30th" queried once for
    a range still ending on the OLD end date before the second pick corrected
    it. A range is one selection, so it is chosen in one calendar and committed
    once, with Apply.

    The draft is local: nothing reaches the store until Apply, so a half-picked
    range (start chosen, end not yet) never queries.
  */
  const [draft, setDraft] = React.useState<DateRange | undefined>(
    fromDate ? { from: fromDate, to: toDate } : undefined,
  );

  // Preset buttons write straight to the store; mirror them so reopening the
  // calendar shows the range actually in force.
  React.useEffect(() => {
    setDraft(fromDate ? { from: fromDate, to: toDate } : undefined);
  }, [fromDate, toDate]);

  const rangeLabel = fromDate
    ? `${fromDate.toLocaleDateString()} – ${(toDate ?? fromDate).toLocaleDateString()}`
    : "All time";

  const applyDraft = () => {
    if (!draft?.from) return;
    setActiveFilter(""); // manual range is not one of the presets
    const from = draft.from;
    // A single-day click leaves `to` empty; treat it as that one whole day.
    const to = draft.to ?? draft.from;
    setDates(
      startOfDay(from.getFullYear(), from.getMonth(), from.getDate()),
      endOfDay(to.getFullYear(), to.getMonth(), to.getDate()),
    );
  };

  /*
    Clearing the range needed a way back. "All" is a preset button, but once a
    manual range was applied nothing in the calendar itself undid it — the only
    escape was picking a preset, which is not what an operator reaches for when
    they meant "show me everything again".
  */
  const resetRange = () => {
    setDraft(undefined);
    setDates(undefined, undefined);
    setActiveFilter("All");
  };

  const rangeIsSet = Boolean(fromDate || toDate || draft?.from);

  const draftDiffers =
    draft?.from?.getTime() !== fromDate?.getTime() ||
    (draft?.to ?? draft?.from)?.getTime() !== toDate?.getTime();

  return (
    <div className="w-full">
      {/* Stacked on a phone. Side by side, the fixed-width date field and the
          Apply/Reset buttons left the preset strip a few dozen pixels, so the
          presets were clipped mid-word and the range was unreadable. */}
      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {/* LEFT FILTERS */}
        <div className="flex min-w-0 gap-1 overflow-x-auto scrollbar-hide pr-2">
          {filters.map((item) => {
            const isActive = activeFilter === item;

            return (
              <Button
                key={item}
                onClick={() => handleFilterClick(item)}
                variant="ghost"
                className={`px-3 h-8 text-xs whitespace-nowrap rounded-md
                  bg-[#242B35]
                  ${
                    isActive
                      ? "!bg-[#B93DEB] !text-white"
                      : "text-gray-300 hover:!bg-[#B93DEB] hover:!text-white"
                  }`}
              >
                {item}
              </Button>
            );
          })}
        </div>

        {/* RIGHT CONTROLS — one range field, committed with Apply */}
        <div className="flex shrink-0 items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-8 min-w-0 flex-1 text-xs bg-[#1F242D] border-[#2A2F3C] sm:w-56 sm:flex-none"
              >
                {rangeLabel}
                <CalendarIcon className="ml-auto h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-auto">
              <Calendar
                mode="range"
                numberOfMonths={2}
                defaultMonth={draft?.from}
                selected={draft}
                onSelect={setDraft}
              />
              <div className="flex items-center justify-between border-t border-[#2A2F3C] px-3 py-2">
                <span className="text-[11px] text-gray-500">
                  {draft?.from
                    ? "Pick a second date for a range"
                    : "No range — showing all time"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={resetRange}
                  disabled={!rangeIsSet}
                  className="h-7 px-2 text-xs text-gray-300 hover:text-white disabled:opacity-40"
                >
                  Reset
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            type="button"
            onClick={applyDraft}
            disabled={!draft?.from || !draftDiffers}
            className="h-8 px-4 text-xs bg-[#B93DEB] text-white
                       hover:bg-[#a333d1] disabled:opacity-40"
          >
            Apply
          </Button>

          {/* Only offered when there is something to clear, so the row does not
              carry a permanently dead button. */}
          {rangeIsSet && (
            <Button
              type="button"
              variant="outline"
              onClick={resetRange}
              className="h-8 px-3 text-xs bg-[#1F242D] border-[#2A2F3C] text-gray-300 hover:text-white"
              title="Clear the date range and show all time"
            >
              Reset
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
