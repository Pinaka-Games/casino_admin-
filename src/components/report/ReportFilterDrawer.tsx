"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import DatePicker from "@/components/DatePicker";
import { Input } from "@/components/ui/input";

/**
 * A single filter control in the drawer.
 *  - dateRange   : renders Start/End date pickers bound to `startDate`/`endDate`
 *  - datePreset  : quick-range dropdown bound to `datePreset`
 *  - select      : a labelled dropdown bound to `key`
 *  - numberRange : Min/Max numeric inputs bound to `${key}Min` / `${key}Max`
 * Keep the field list to what is actually meaningful for the report — the goal
 * is a consistent, uncluttered drawer, not every possible column.
 */
export type FilterField =
  | { kind: "dateRange"; label?: string }
  | { kind: "datePreset"; label?: string }
  | {
      kind: "select";
      key: string;
      label: string;
      placeholder?: string;
      options: { value: string; label: string }[];
    }
  | {
      kind: "numberRange";
      key: string;
      label: string;
    };

/** Quick date-range presets. Computed relative to "now" when selected. */
const DATE_PRESETS: { value: string; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 Days" },
  { value: "last30", label: "Last 30 Days" },
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "custom", label: "Custom Range" },
];

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

/** Resolve a preset key to a concrete date range (undefined = open ended). */
function resolvePreset(preset: string): { startDate?: Date; endDate?: Date } {
  const now = new Date();
  switch (preset) {
    case "today":
      return { startDate: startOfDay(now), endDate: endOfDay(now) };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { startDate: startOfDay(y), endDate: endOfDay(y) };
    }
    case "last7": {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      return { startDate: startOfDay(s), endDate: endOfDay(now) };
    }
    case "last30": {
      const s = new Date(now);
      s.setDate(s.getDate() - 29);
      return { startDate: startOfDay(s), endDate: endOfDay(now) };
    }
    case "thisMonth":
      return {
        startDate: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
        endDate: endOfDay(now),
      };
    case "lastMonth":
      return {
        startDate: startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        endDate: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    case "all":
    default:
      return { startDate: undefined, endDate: undefined };
  }
}

export type FilterValues = {
  startDate?: Date;
  endDate?: Date;
  [key: string]: unknown;
};

interface ReportFilterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  fields: FilterField[];
  values: FilterValues;
  /** Values applied on Reset (defaults). Dates are cleared regardless. */
  defaults: FilterValues;
  onApply: (values: FilterValues) => void;
}

/**
 * Consistent right-hand filter drawer shared by every report. Pages describe
 * their meaningful filters via `fields`; this component owns the draft state,
 * the date-range pickers, and the Reset / Apply actions.
 */
export default function ReportFilterDrawer({
  open,
  onOpenChange,
  title = "Filters",
  description = "Refine the report below.",
  fields,
  values,
  defaults,
  onApply,
}: ReportFilterDrawerProps) {
  const [draft, setDraft] = React.useState<FilterValues>(values);

  // Re-seed the draft from the live values every time the drawer opens so it
  // reflects what is currently applied.
  React.useEffect(() => {
    if (open) setDraft(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setField = (key: string, value: unknown) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const handleReset = () => {
    setDraft(defaults);
    onApply(defaults);
    onOpenChange(false);
  };

  // A numeric range is invalid only when BOTH bounds are set and Max is not
  // greater than Min. Leaving Max empty is valid — it means "≥ Min" (open ended).
  const isRangeInvalid = (key: string) => {
    const min = draft[`${key}Min`];
    const max = draft[`${key}Max`];
    const hasMin = min !== undefined && min !== null && min !== "";
    const hasMax = max !== undefined && max !== null && max !== "";
    return hasMin && hasMax && Number(max) <= Number(min);
  };

  const hasInvalidRange = fields.some(
    (f) => f.kind === "numberRange" && isRangeInvalid(f.key),
  );

  const handleApply = () => {
    if (hasInvalidRange) return;
    onApply(draft);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-[#1F2430] border-l border-gray-700 text-white w-[360px] sm:max-w-[360px]"
      >
        <SheetHeader className="pb-4 border-b border-gray-700">
          <SheetTitle className="text-lg text-white">{title}</SheetTitle>
          <SheetDescription className="text-sm text-gray-400">
            {description}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {fields.map((field, i) => {
            if (field.kind === "datePreset") {
              const presetValue = (draft.datePreset as string) ?? "all";
              return (
                <div key={`preset-${i}`} className="space-y-2">
                  <Label className="text-gray-300">{field.label ?? "Quick Range"}</Label>
                  <Select
                    value={presetValue}
                    onValueChange={(v) => {
                      if (v === "custom") {
                        setDraft((prev) => ({ ...prev, datePreset: v }));
                        return;
                      }
                      const range = resolvePreset(v);
                      setDraft((prev) => ({ ...prev, ...range, datePreset: v }));
                    }}
                  >
                    <SelectTrigger className="w-full bg-[#242B35] border-gray-700 text-white">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a2030] text-white border-gray-700 max-h-64">
                      {DATE_PRESETS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            }

            if (field.kind === "dateRange") {
              return (
                <div key={`date-${i}`} className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-300">Start Date</Label>
                    <DatePicker
                      date={draft.startDate}
                      maxDate={draft.endDate}
                      onChange={(date) =>
                        setDraft((prev) => ({
                          ...prev,
                          startDate: date,
                          datePreset: "custom",
                          endDate:
                            prev.endDate && date && prev.endDate < date
                              ? undefined
                              : prev.endDate,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">End Date</Label>
                    <DatePicker
                      date={draft.endDate}
                      minDate={draft.startDate}
                      onChange={(date) =>
                        setDraft((prev) => ({
                          ...prev,
                          endDate: date,
                          datePreset: "custom",
                          startDate:
                            prev.startDate && date && prev.startDate > date
                              ? undefined
                              : prev.startDate,
                        }))
                      }
                    />
                  </div>
                </div>
              );
            }

            if (field.kind === "numberRange") {
              const minKey = `${field.key}Min`;
              const maxKey = `${field.key}Max`;
              const minVal = draft[minKey];
              const maxVal = draft[maxKey];
              const invalid = isRangeInvalid(field.key);
              return (
                <div key={field.key} className="space-y-2">
                  <Label className="text-gray-300">{field.label}</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={minVal === undefined || minVal === null ? "" : String(minVal)}
                      onChange={(e) =>
                        setField(
                          minKey,
                          e.target.value === "" ? undefined : Number(e.target.value),
                        )
                      }
                      className="bg-[#242B35] border-gray-700 text-white"
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={maxVal === undefined || maxVal === null ? "" : String(maxVal)}
                      onChange={(e) =>
                        setField(
                          maxKey,
                          e.target.value === "" ? undefined : Number(e.target.value),
                        )
                      }
                      className={`bg-[#242B35] text-white ${invalid ? "border-red-500" : "border-gray-700"}`}
                    />
                  </div>
                  {invalid && (
                    <p className="text-[11px] text-red-400">
                      Max must be greater than Min. Leave Max empty to match everything above Min.
                    </p>
                  )}
                </div>
              );
            }

            const current = (draft[field.key] as string) ?? "";
            return (
              <div key={field.key} className="space-y-2">
                <Label className="text-gray-300">{field.label}</Label>
                <Select
                  value={current}
                  onValueChange={(v) => setField(field.key, v)}
                >
                  <SelectTrigger className="w-full bg-[#242B35] border-gray-700 text-white">
                    <SelectValue placeholder={field.placeholder ?? field.label} />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a2030] text-white border-gray-700 max-h-64">
                    {field.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>

        <div className="mt-auto p-4 border-t border-gray-700 flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            className="flex-1 bg-[#2A3240] border-gray-700 cursor-pointer text-white hover:bg-[#313B4A]"
          >
            Reset Filters
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={hasInvalidRange}
            className="flex-1 bg-purple-500 cursor-pointer hover:bg-purple-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Apply Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
