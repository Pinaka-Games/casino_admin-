"use client";

import { useState } from "react";
import { CalendarDays, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface DateSelection {
  datePreset: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * The same keys the filter drawer uses (ReportFilterDrawer), so a range picked
 * here shows as the matching preset there, and the other way round.
 */
const QUICK_RANGES: { value: string; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 Days" },
  { value: "last30", label: "Last 30 Days" },
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

/** Local calendar days, like the drawer; the store sends them as yyyy-MM-dd. */
function quickRange(value: string): { startDate?: Date; endDate?: Date } {
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - n);
  switch (value) {
    case "today":
      return { startDate: startOfDay(now), endDate: endOfDay(now) };
    case "yesterday":
      return { startDate: startOfDay(daysAgo(1)), endDate: endOfDay(daysAgo(1)) };
    case "last7":
      return { startDate: startOfDay(daysAgo(6)), endDate: endOfDay(now) };
    case "last30":
      return { startDate: startOfDay(daysAgo(29)), endDate: endOfDay(now) };
    case "thisMonth":
      return { startDate: new Date(now.getFullYear(), now.getMonth(), 1), endDate: endOfDay(now) };
    case "lastMonth":
      return {
        startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        endDate: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    default:
      return { startDate: undefined, endDate: undefined };
  }
}

function rangeLabel({ datePreset, startDate, endDate }: DateSelection) {
  const quick = QUICK_RANGES.find((q) => q.value === datePreset && q.value !== "all");
  if (quick) return quick.label;
  if (!startDate && !endDate) return "Custom";
  const from = startDate ?? endDate!;
  const to = endDate ?? startDate!;
  if (from.toDateString() === to.toDateString()) return format(from, "MMM d, yyyy");
  const sameYear = from.getFullYear() === to.getFullYear();
  return `${format(from, sameYear ? "MMM d" : "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`;
}

/**
 * Always-visible "Custom" date control beside the presets: quick day ranges
 * plus a calendar for any start / end day. The calendar pick is a draft until
 * Apply, so choosing a start day alone never fires a request.
 */
export default function CustomDateButton({
  value,
  onApply,
}: {
  value: DateSelection;
  onApply: (next: DateSelection) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(
    value.startDate ? { from: value.startDate, to: value.endDate } : undefined,
  );

  // Opening shows the range actually in force (it can change from the drawer).
  const onOpenChange = (next: boolean) => {
    if (next) setDraft(value.startDate ? { from: value.startDate, to: value.endDate } : undefined);
    setOpen(next);
  };

  const active = value.datePreset !== "all" && Boolean(value.startDate || value.endDate);

  const pickQuick = (preset: string) => {
    onApply({ datePreset: preset, ...quickRange(preset) });
    setOpen(false);
  };

  const applyDraft = () => {
    if (!draft?.from) return;
    // A single-day click leaves `to` empty: that one whole day.
    const to = draft.to ?? draft.from;
    onApply({ datePreset: "custom", startDate: startOfDay(draft.from), endDate: endOfDay(to) });
    setOpen(false);
  };

  const clear = () => {
    setDraft(undefined);
    onApply({ datePreset: "all", startDate: undefined, endDate: undefined });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-pressed={active}
          title="Pick the days to report on"
          className={`flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-xs font-medium transition-colors ${
            active
              ? "border-[#B93DEB] bg-[#B93DEB]/15 text-white"
              : "border-[#242B35] bg-[#191D24] text-gray-300 hover:border-[#B93DEB]/50 hover:text-white"
          }`}
        >
          <CalendarDays size={14} className={active ? "text-[#B93DEB]" : "text-gray-400"} />
          {rangeLabel(value)}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-auto max-w-[calc(100vw-32px)] border border-[#2A2F3C] bg-[#161A21] p-0 text-white"
      >
        <div className="flex flex-col sm:flex-row">
          <div
            role="group"
            aria-label="Quick ranges"
            className="flex gap-1 overflow-x-auto border-b border-[#2A2F3C] p-2 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r"
          >
            {QUICK_RANGES.map((q) => {
              const selected = value.datePreset === q.value || (q.value === "all" && !active);
              return (
                <button
                  key={q.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => pickQuick(q.value)}
                  className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-left text-xs transition-colors ${
                    selected ? "bg-[#B93DEB] text-white" : "text-gray-300 hover:bg-[#242B35] hover:text-white"
                  }`}
                >
                  {q.label}
                </button>
              );
            })}
          </div>

          <div>
            <Calendar
              mode="range"
              numberOfMonths={1}
              defaultMonth={draft?.from ?? new Date()}
              selected={draft}
              onSelect={setDraft}
              disabled={{ after: new Date() }}
            />
            <div className="flex items-center justify-between gap-2 border-t border-[#2A2F3C] px-3 py-2">
              <span className="text-[11px] text-gray-500">
                {draft?.from
                  ? draft.to
                    ? `${format(draft.from, "MMM d")} – ${format(draft.to, "MMM d, yyyy")}`
                    : "Pick an end day, or Apply for one day"
                  : "Pick a start day"}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={clear}
                  disabled={!active && !draft?.from}
                  className="h-7 px-2 text-xs text-gray-300 hover:text-white disabled:opacity-40"
                >
                  <X size={12} className="mr-1" />
                  Clear
                </Button>
                <Button
                  type="button"
                  onClick={applyDraft}
                  disabled={!draft?.from}
                  className="h-7 bg-[#B93DEB] px-3 text-xs text-white hover:bg-[#a431d4] disabled:opacity-40"
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
