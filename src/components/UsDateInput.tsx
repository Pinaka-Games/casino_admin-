"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * ISO (yyyy-mm-dd) date input independent of the browser locale (native
 * <input type="date"> ignores `lang` in some Chrome builds). Smart-masks a text
 * field — auto-pads the month/day (typing `2` → `02-`), clamps to valid ranges
 * (no 22/22), and shows a live yyyy-mm-dd ghost while typing. Emits the same ISO
 * `yyyy-mm-dd` string via onChange; the calendar button opens a date picker.
 *
 * The picker is the app's own Calendar rather than the browser's. The native
 * one accepted any year at all — a mistyped birth date landed on "5345-03-04"
 * and was saved as though it were real — and it could not be styled to match
 * the rest of the admin. This one offers month and year dropdowns bounded by
 * `min`/`max`, so an out-of-range year cannot be picked at all.
 */

const TEMPLATE = "yyyy-mm-dd";

/** Lowest year the mask accepts. Below this the text is treated as incomplete. */
const MIN_YEAR = 1900;

const isoToDisplay = (iso?: string) => {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
};

const displayToIso = (text: string): string | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return null;
  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < MIN_YEAR) return null;
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
};

/** ISO string → local Date at midnight, avoiding the UTC shift `new Date(iso)` adds. */
const isoToDate = (iso?: string): Date | undefined => {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const dateToIso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const smartFormat = (raw: string): string => {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (!d) return "";

  // YEAR (4 digits, taken as typed)
  const year = d.slice(0, 4);
  if (d.length < 4) return year;
  let out = `${year}-`;
  if (d.length === 4) return out;

  // MONTH (01-12) — auto-pads so "9" becomes 09 and frees the next digit
  // for the day, exactly as the mm/dd/yyyy mask used to.
  let i = 4;
  let month = "";
  const m0 = d[i];
  if (m0 >= "2") {
    month = "0" + m0;
    i += 1;
  } else if (d.length > i + 1) {
    const n = Number(m0 + d[i + 1]);
    if (n >= 1 && n <= 12) {
      month = m0 + d[i + 1];
      i += 2;
    } else {
      month = "0" + m0;
      i += 1;
    }
  } else {
    month = m0;
    i += 1;
  }
  if (month === "00") month = "01";
  if (month.length < 2) return out + month;
  out += `${month}-`;
  if (i >= d.length) return out;

  // DAY (01-31)
  let day = "";
  const d0 = d[i];
  if (d0 >= "4") {
    day = "0" + d0;
    i += 1;
  } else if (d.length > i + 1) {
    const n = Number(d0 + d[i + 1]);
    if (n >= 1 && n <= 31) {
      day = d0 + d[i + 1];
      i += 2;
    } else {
      day = "0" + d0;
      i += 1;
    }
  } else {
    day = d0;
    i += 1;
  }
  if (day === "00") day = "01";
  out += day;
  return out;
};

export default function UsDateInput({
  value,
  onChange,
  max,
  min,
  disabled,
  placeholder = "yyyy-mm-dd",
  className = "",
  id,
  name,
}: {
  value: string;
  onChange: (iso: string) => void;
  max?: string;
  min?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
}) {
  const [text, setText] = useState(() => isoToDisplay(value));
  const [open, setOpen] = useState(false);
  // While the field has focus its text belongs to the person typing, not to
  // `value`. Without this the first backspace wiped the whole field: the
  // shortened text no longer parsed, so `onChange("")` fired, the parent stored
  // an empty string, and the sync below echoed that back over what was typed.
  const editingRef = useRef(false);

  useEffect(() => {
    if (editingRef.current) return;
    setText(isoToDisplay(value));
  }, [value]);

  const minDate = useMemo(() => isoToDate(min), [min]);
  const maxDate = useMemo(() => isoToDate(max), [max]);

  const outOfRange = (iso: string) =>
    (!!min && iso < min) || (!!max && iso > max);

  const emit = (iso: string) => {
    // An out-of-range date is not a date: reporting it as empty keeps a
    // half-typed or impossible year (the old "5345") from being saved, while
    // leaving the text on screen so the correction is visible.
    onChange(outOfRange(iso) ? "" : iso);
  };

  const handleText = (raw: string) => {
    const next = smartFormat(raw);
    setText(next);
    emit(displayToIso(next) ?? "");
  };

  const handleBlur = () => {
    editingRef.current = false;
    // Discard anything that never became a real date, so the field shows what
    // is actually stored rather than a fragment that was never saved. An
    // out-of-range value is cleared on the parent too — a legacy "5345" left
    // only on screen would still be saved back untouched.
    const iso = displayToIso(text) ?? "";
    if (outOfRange(iso)) {
      setText("");
      onChange("");
      return;
    }
    setText(isoToDisplay(iso));
  };

  const handleSelect = (d: Date | undefined) => {
    if (!d) return;
    const iso = dateToIso(d);
    setText(isoToDisplay(iso));
    emit(iso);
    setOpen(false);
  };

  const selected = isoToDate(displayToIso(text) ?? undefined);

  const ghost =
    text && text.length < TEMPLATE.length ? TEMPLATE.slice(text.length) : "";

  return (
    <div className={`relative flex items-center gap-1 ${className}`}>
      <div className="relative flex-1 min-w-0 h-full flex items-center">
        <div className="pointer-events-none absolute inset-0 flex items-center font-mono whitespace-pre overflow-hidden">
          <span className="invisible">{text}</span>
          <span className="text-gray-500">{ghost}</span>
        </div>
        <input
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={text}
          onChange={(e) => handleText(e.target.value)}
          onFocus={() => {
            editingRef.current = true;
          }}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder}
          className="relative w-full bg-transparent outline-none font-mono"
        />
      </div>

      {!disabled && (
        <Popover open={open} onOpenChange={setOpen} modal={false}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Open calendar"
              className="relative shrink-0 text-gray-400 hover:text-white flex items-center justify-center cursor-pointer w-6 h-6"
            >
              <CalendarIcon size={16} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            side="bottom"
            sideOffset={8}
            // Above the edit dialogs this sits inside, which carry their own
            // stacking context.
            className="w-auto p-0 rounded-lg border border-[#2b323b] bg-[#111418] shadow-xl z-[20000]"
          >
            <Calendar
              mode="single"
              selected={selected}
              onSelect={handleSelect}
              defaultMonth={selected ?? maxDate}
              // Dropdowns rather than arrows: a birth date is decades back, and
              // stepping a month at a time to reach 1980 is not navigation.
              captionLayout="dropdown"
              startMonth={minDate ?? new Date(MIN_YEAR, 0, 1)}
              endMonth={maxDate ?? new Date(new Date().getFullYear() + 10, 11, 31)}
              disabled={(d) => {
                if (minDate && d < minDate) return true;
                if (maxDate && d > maxDate) return true;
                return false;
              }}
              autoFocus
              className="text-white p-3"
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
