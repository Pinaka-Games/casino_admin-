"use client";

import * as React from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import type { Matcher } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Date field for the agent / sub-agent module.
 *
 * Replaces `UsDateInput` at the agent call sites. That component draws a
 * calendar glyph and lays an `opacity-0 <input type="date">` on top of it, so
 * "opening the picker" depends on the browser honouring a click on a fully
 * transparent native control. Desktop Chrome does; **iOS Safari does not** — it
 * will not raise the native date wheel from a zero-opacity input — so on iPhone
 * the calendar button did nothing at all.
 *
 * This uses the same shadcn Popover + react-day-picker calendar that
 * `AgentDateFilters` already uses elsewhere in this module: real DOM, real
 * buttons, no reliance on native picker behaviour, identical on every platform.
 *
 * `UsDateInput` itself is deliberately left alone — the admin module renders it
 * in nine other places and is out of scope here.
 *
 * The prop shape matches `UsDateInput` (ISO `yyyy-mm-dd` in and out) so the swap
 * is one line per call site.
 */

/**
 * Parse `yyyy-mm-dd` into a LOCAL date.
 *
 * Not `new Date(iso)` — the spec parses a bare date string as UTC midnight, so
 * anywhere west of Greenwich it lands on the previous calendar day and the
 * picker highlights the wrong date. Splitting the parts sidesteps the offset.
 */
function isoToDate(iso?: string): Date | undefined {
  if (!iso) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Format a local date back to `yyyy-mm-dd`.
 *
 * Not `toISOString().slice(0,10)` — that converts to UTC first and shifts the
 * day for any negative offset, which is the same bug as above in reverse.
 */
function dateToIso(date?: Date): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Display format, matching the mm/dd/yyyy the old field used. */
function isoToUs(iso?: string): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${m[2]}/${m[3]}/${m[1]}` : "";
}

interface AgentDatePickerProps {
  /** ISO `yyyy-mm-dd`, or "" for empty. */
  value: string;
  /** Emits ISO `yyyy-mm-dd`, or "" when cleared. */
  onChange: (iso: string) => void;
  /** ISO bound — dates after this are not selectable. */
  max?: string;
  /** ISO bound — dates before this are not selectable. */
  min?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
  /** Shows an inline clear button once a date is picked. */
  clearable?: boolean;
  /**
   * `"dropdown"` swaps the month caption for month + year selects. Use it for
   * dates far from today — a date of birth is 21+ years back, and paging there
   * one month at a time is 250+ clicks.
   */
  captionLayout?: "label" | "dropdown";
  /** Earliest year offered by the dropdown. Defaults to 100 years back. */
  fromYear?: number;
}

export default function AgentDatePicker({
  value,
  onChange,
  max,
  min,
  disabled,
  placeholder = "mm/dd/yyyy",
  className = "",
  id,
  name,
  clearable = false,
  captionLayout = "label",
  fromYear,
}: AgentDatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selected = isoToDate(value);
  const maxDate = isoToDate(max);
  const minDate = isoToDate(min);

  // react-day-picker takes matchers, not a min/max pair.
  const disabledMatcher = React.useMemo(() => {
    const rules: Matcher[] = [];
    if (minDate) rules.push({ before: minDate });
    if (maxDate) rules.push({ after: maxDate });
    return rules.length ? rules : undefined;
  }, [minDate, maxDate]);

  // Open on the selected date; failing that, on the nearest allowed edge rather
  // than today. With a `max` of "21 years ago" and no value, opening on today
  // would land the user in a fully disabled month.
  const defaultMonth = selected ?? maxDate ?? minDate ?? undefined;

  // Bounds for the year dropdown. Without an explicit range react-day-picker
  // offers only the current year, which makes "dropdown" useless for a DOB.
  const endMonth = maxDate ?? new Date();
  const startMonth =
    minDate ??
    new Date(fromYear ?? endMonth.getFullYear() - 100, 0, 1);

  return (
    <div className={`relative flex items-center gap-1 ${className}`}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {/*
            A real <button>, which is the whole point: it is focusable, it has a
            visible hit area, and it works the same on iOS as anywhere else.
          */}
          <button
            id={id}
            name={name}
            type="button"
            disabled={disabled}
            aria-label={placeholder}
            className="flex flex-1 min-w-0 items-center justify-between gap-2 bg-transparent text-left outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span
              className={`truncate ${value ? "text-inherit" : "text-gray-500"}`}
            >
              {isoToUs(value) || placeholder}
            </span>
            <CalendarIcon size={16} className="shrink-0 text-gray-400" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          // Above the module's full-screen modals (SubAgentDownlineModal and the
          // transaction modal both sit at z-[9999]), or the calendar opens
          // behind the sheet that contains its own trigger.
          className="w-auto p-0 z-[10050]"
        >
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={defaultMonth}
            disabled={disabledMatcher}
            captionLayout={captionLayout}
            startMonth={captionLayout === "dropdown" ? startMonth : undefined}
            endMonth={captionLayout === "dropdown" ? endMonth : undefined}
            onSelect={(date) => {
              onChange(dateToIso(date));
              setOpen(false);
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>

      {clearable && value && !disabled && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear date"
          className="shrink-0 text-gray-500 transition-colors hover:text-white"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
