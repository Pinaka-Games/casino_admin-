"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DatePicker from "@/components/DatePicker";
import { Calendar } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { FilterField, FilterValues, checkedValues } from "./types";

interface EntityFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: FilterField[];
  values: FilterValues;
  defaults: FilterValues;
  onApply: (values: FilterValues) => void;
}

const triggerClass = "w-full bg-[#242B35] border-gray-700 text-white";
const contentClass = "bg-[#1a2030] text-white border-gray-700";
const inputClass = "bg-[#242B35] border-gray-700 text-white placeholder:text-gray-500";

/** "YYYY-MM-DD" -> Date at local midday, so a timezone shift can't roll the day. */
const isoToDate = (iso?: string): Date | undefined => {
  if (!iso) return undefined;
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  const d = new Date(year, month - 1, day, 12, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

/** Date -> "YYYY-MM-DD", read off the local calendar rather than UTC. */
const dateToIso = (date?: Date): string => {
  if (!date) return "";
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

/**
 * Renders a tab's `FilterField[]` as the platform's right-side filter sheet.
 * Edits a draft so nothing refetches until Apply.
 */
export default function EntityFilterSheet({
  open,
  onOpenChange,
  title,
  description,
  fields,
  values,
  defaults,
  onApply,
}: EntityFilterSheetProps) {
  const [draft, setDraft] = React.useState<FilterValues>(values);

  React.useEffect(() => {
    if (open) setDraft(values);
  }, [values, open]);

  const patch = (partial: FilterValues) =>
    setDraft((prev) => ({ ...prev, ...partial }));

  const handleApply = () => {
    onApply(draft);
    onOpenChange(false);
  };

  const handleReset = () => {
    // Search lives in the toolbar, not this sheet, so it survives a reset.
    const cleared = { ...defaults, search: draft.search ?? "" };
    setDraft(cleared);
    onApply(cleared);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-[#1F2430] border-l border-gray-700 text-white w-[360px] sm:max-w-[360px] flex flex-col"
      >
        <SheetHeader className="pb-4 border-b border-gray-700">
          <SheetTitle className="text-lg text-white">{title}</SheetTitle>
          {description && (
            <SheetDescription className="text-sm text-gray-400">
              {description}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {fields.map((field) => {
            if (field.showWhen && !field.showWhen(draft)) return null;

            if (field.type === "select") {
              return (
                <div key={field.key} className="space-y-2">
                  <Label className="text-gray-300">{field.label}</Label>
                  <Select
                    value={draft[field.key] ?? ""}
                    onValueChange={(value) => patch({ [field.key]: value })}
                  >
                    <SelectTrigger className={triggerClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={contentClass}>
                      {field.options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {field.hint && (
                    <p className="text-[11px] text-gray-500">{field.hint}</p>
                  )}
                </div>
              );
            }

            if (field.type === "text") {
              return (
                <div key={field.key} className="space-y-2">
                  <Label className="text-gray-300">{field.label}</Label>
                  <Input
                    value={draft[field.key] ?? ""}
                    onChange={(event) => patch({ [field.key]: event.target.value })}
                    placeholder={field.placeholder}
                    className={inputClass}
                  />
                  {field.hint && (
                    <p className="text-[11px] text-gray-500">{field.hint}</p>
                  )}
                </div>
              );
            }

            if (field.type === "checkboxGroup") {
              const selected = checkedValues(draft[field.key]);
              const toggle = (value: string, checked: boolean) => {
                // Order follows the field's own option list, not click order,
                // so the same selection always produces the same param string
                // and the same chip.
                const next = field.options
                  .map((option) => option.value)
                  .filter((option) =>
                    option === value ? checked : selected.includes(option),
                  );
                patch({ [field.key]: next.join(",") });
              };

              return (
                <div key={field.key} className="space-y-2">
                  <Label className="text-gray-300">{field.label}</Label>
                  <div className="space-y-2 rounded-md border border-gray-700 bg-[#242B35] p-3">
                    {field.options.map((option) => (
                      <label
                        key={option.value}
                        className="flex cursor-pointer items-center gap-2.5 text-sm text-gray-200"
                      >
                        <Checkbox
                          checked={selected.includes(option.value)}
                          onCheckedChange={(checked) =>
                            toggle(option.value, checked === true)
                          }
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-500">
                    {field.hint ?? "Leave all unticked to include everything."}
                  </p>
                </div>
              );
            }

            if (field.type === "dateRange") {
              const from = isoToDate(draft[field.fromKey]);
              const to = isoToDate(draft[field.toKey]);

              return (
                <div key={`${field.fromKey}-${field.toKey}`} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                    <Label className="text-gray-300">{field.label}</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-3 bg-[#191D24] p-3 rounded-xl border border-gray-800/50">
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-gray-500 uppercase font-bold px-1">
                        From
                      </p>
                      <DatePicker
                        date={from}
                        maxDate={to}
                        onChange={(d) =>
                          patch(
                            // Clear a "to" that the new "from" would have passed,
                            // instead of leaving an empty range behind.
                            d && to && d > to
                              ? { [field.fromKey]: dateToIso(d), [field.toKey]: "" }
                              : { [field.fromKey]: dateToIso(d) },
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-gray-500 uppercase font-bold px-1">
                        To
                      </p>
                      <DatePicker
                        date={to}
                        minDate={from}
                        onChange={(d) =>
                          patch(
                            d && from && d < from
                              ? { [field.toKey]: dateToIso(d), [field.fromKey]: "" }
                              : { [field.toKey]: dateToIso(d) },
                          )
                        }
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    {field.hint ?? "Both days are included in full."}
                  </p>
                </div>
              );
            }

            return (
              <div key={`${field.minKey}-${field.maxKey}`} className="space-y-2">
                <Label className="text-gray-300">{field.label}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="any"
                    value={draft[field.minKey] ?? ""}
                    onChange={(event) => patch({ [field.minKey]: event.target.value })}
                    placeholder="Min"
                    className={inputClass}
                  />
                  <span className="text-gray-500 text-xs">-</span>
                  <Input
                    type="number"
                    step="any"
                    value={draft[field.maxKey] ?? ""}
                    onChange={(event) => patch({ [field.maxKey]: event.target.value })}
                    placeholder="Max"
                    className={inputClass}
                  />
                </div>
                {field.hint && (
                  <p className="text-[11px] text-gray-500">{field.hint}</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-auto p-4 border-t border-gray-700 space-y-3">
          <Button
            type="button"
            onClick={handleApply}
            className="w-full bg-purple-500 hover:bg-purple-600 text-white"
          >
            Apply Filters
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            className="w-full bg-[#2A3240] border-gray-700 text-white hover:bg-[#313B4A]"
          >
            Reset Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
