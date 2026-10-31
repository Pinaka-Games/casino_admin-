"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export type AgentDateRange = {
  activeFilter: string;
  fromDate?: Date;
  toDate?: Date;
};

/**
 * Same presets, in the same order, as the admin Dashboard (DateFilters), so an
 * agent and the admin reading the same figures pick the window the same way.
 */
const FILTERS = ["All", "Last Month", "Last Week", "Yesterday", "Today"] as const;

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const endOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

/** Resolves a preset label to a concrete [from, to] range. */
export function resolvePreset(filter: string): [Date, Date] {
  const now = new Date();
  // Open-ended presets end at the END of today, not at "now": `now` was frozen
  // when the page loaded, so every payout request / earning created after that
  // fell outside the range — a fresh request vanished from Payout Requests
  // (while the admin list showed it) until the page was reloaded.
  const endToday = endOfDay(now);

  switch (filter) {
    case "All":
      // Same window as the admin Dashboard's "All": the operational period.
      return [new Date(2026, 0, 1, 0, 0, 0, 0), endToday];
    case "Today":
      return [startOfDay(now), endToday];
    case "Yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return [startOfDay(y), endOfDay(y)];
    }
    case "This Week": {
      const s = new Date(now);
      // Monday-based week
      s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
      return [startOfDay(s), endToday];
    }
    case "Last Week": {
      const s = new Date(now);
      s.setDate(s.getDate() - ((s.getDay() + 6) % 7) - 7);
      const e = new Date(s);
      e.setDate(e.getDate() + 6);
      return [startOfDay(s), endOfDay(e)];
    }
    case "This Month":
      return [startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), endToday];
    case "Last Month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return [startOfDay(s), endOfDay(e)];
    }
    default:
      return [startOfDay(now), endToday];
  }
}

interface Props {
  value: AgentDateRange;
  onChange: (next: AgentDateRange) => void;
  /** Fired on preset click, on Apply of a picked range, and on Reset. */
  onApply: (range: AgentDateRange) => void;
}

/*
  Mirrors the admin Dashboard's filter bar: preset buttons on the left, one
  range field on the right committed with Apply, and Reset back to "All".

  The two single-date pickers this replaces applied each pick on its own, so
  choosing "1st to 30th" queried once with the OLD end date before the second
  pick corrected it. The range is now drafted locally and only Apply queries.
*/
export default function AgentDateFilters({ value, onChange, onApply }: Props) {
  const commit = (next: AgentDateRange) => {
    onChange(next);
    onApply(next);
  };

  const handlePreset = (filter: string) => {
    const [from, to] = resolvePreset(filter);
    commit({ activeFilter: filter, fromDate: from, toDate: to });
  };

  const [draft, setDraft] = React.useState<DateRange | undefined>(
    value.fromDate ? { from: value.fromDate, to: value.toDate } : undefined,
  );

  // Presets write straight through; mirror them so reopening the calendar
  // shows the range actually in force.
  React.useEffect(() => {
    setDraft(
      value.fromDate ? { from: value.fromDate, to: value.toDate } : undefined,
    );
  }, [value.fromDate, value.toDate]);

  const rangeLabel = value.fromDate
    ? `${value.fromDate.toLocaleDateString()} – ${(value.toDate ?? value.fromDate).toLocaleDateString()}`
    : "All time";

  const applyDraft = () => {
    if (!draft?.from) return;
    // A single-day click leaves `to` empty; treat it as that one whole day.
    commit({
      activeFilter: "", // a picked range is not one of the presets
      fromDate: startOfDay(draft.from),
      toDate: endOfDay(draft.to ?? draft.from),
    });
  };

  const resetRange = () => {
    const [from, to] = resolvePreset("All");
    setDraft({ from, to });
    commit({ activeFilter: "All", fromDate: from, toDate: to });
  };

  const draftDiffers =
    draft?.from?.getTime() !== value.fromDate?.getTime() ||
    (draft?.to ?? draft?.from)?.getTime() !== value.toDate?.getTime();

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex gap-1 overflow-x-auto scrollbar-hide agent-x-scroll pr-2 -mx-3 px-3 md:mx-0 md:px-0 md:pr-2">
        {FILTERS.map((item) => {
          const isActive = value.activeFilter === item;
          return (
            <Button
              key={item}
              onClick={() => handlePreset(item)}
              variant="ghost"
              className={`px-3 h-8 text-xs whitespace-nowrap rounded-md bg-[#242B35] ${
                isActive
                  ? "bg-[#B93DEB]! text-white!"
                  : "text-gray-300 hover:bg-[#B93DEB]! hover:text-white!"
              }`}
            >
              {item}
            </Button>
          );
        })}
      </div>

      {/* One range field, committed with Apply — same as the admin Dashboard. */}
      <div className="flex items-center gap-2 w-full md:w-auto">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="flex-1 md:flex-none md:w-56 h-8 text-xs bg-[#1F242D] border-[#2A2F3C]"
            >
              {rangeLabel}
              <CalendarIcon className="ml-auto h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-auto" align="end">
            <Calendar
              mode="range"
              numberOfMonths={2}
              defaultMonth={draft?.from}
              selected={draft}
              onSelect={setDraft}
            />
            <div className="flex items-center justify-between border-t border-[#2A2F3C] px-3 py-2">
              <span className="text-[11px] text-gray-500">
                {draft?.from ? "Pick a second date for a range" : "Pick a start date"}
              </span>
              <Button
                type="button"
                variant="ghost"
                onClick={resetRange}
                className="h-7 px-2 text-xs text-gray-300 hover:text-white"
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
          className="h-8 px-4 text-xs bg-[#B93DEB] text-white hover:bg-[#a333d1] disabled:opacity-40"
        >
          Apply
        </Button>

        {value.activeFilter !== "All" && (
          <Button
            type="button"
            variant="outline"
            onClick={resetRange}
            className="h-8 px-3 text-xs bg-[#1F242D] border-[#2A2F3C] text-gray-300 hover:text-white"
            title="Back to All"
          >
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
