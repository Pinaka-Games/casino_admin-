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

import { Calendar } from "lucide-react";
import DatePicker from "@/components/DatePicker";

export type DateRangePreset = "all" | "7d" | "30d" | "custom";

export interface PromoCodesFilters {
  discountType: "all" | "percentage" | "flat";
  status: "all" | "active" | "inactive";
  startDateRange: DateRangePreset;
  startDateFrom: string; // yyyy-mm-dd (custom only)
  startDateTo: string; // yyyy-mm-dd (custom only)
  endDateRange: DateRangePreset;
  endDateFrom: string; // yyyy-mm-dd (custom only)
  endDateTo: string; // yyyy-mm-dd (custom only)
  createdAtRange: DateRangePreset;
  createdAtFrom: string; // yyyy-mm-dd (custom only)
  createdAtTo: string; // yyyy-mm-dd (custom only)
}

export const DEFAULT_PROMO_FILTERS: PromoCodesFilters = {
  discountType: "all",
  status: "all",
  startDateRange: "all",
  startDateFrom: "",
  startDateTo: "",
  endDateRange: "all",
  endDateFrom: "",
  endDateTo: "",
  createdAtRange: "all",
  createdAtFrom: "",
  createdAtTo: "",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: PromoCodesFilters;
  onApply: (filters: PromoCodesFilters) => void;
}

const stringToDate = (s?: string) => {
  if (!s) return undefined;
  const parts = s.split("-");
  if (parts.length !== 3) return undefined;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  return new Date(y, m, d);
};

const dateToString = (d?: Date) => {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const r = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${r}`;
};

export function PromoCodesFilterSheet({
  open,
  onOpenChange,
  filters,
  onApply,
}: Props) {
  const [draft, setDraft] = React.useState<PromoCodesFilters>(filters);

  React.useEffect(() => {
    if (open) setDraft({ ...DEFAULT_PROMO_FILTERS, ...filters });
  }, [filters, open]);

  const set = <K extends keyof PromoCodesFilters>(k: K, v: PromoCodesFilters[K]) =>
    setDraft((prev) => ({ ...prev, [k]: v }));

  const handleApply = () => {
    onApply(draft);
    onOpenChange(false);
  };

  const handleReset = () => {
    setDraft(DEFAULT_PROMO_FILTERS);
    onApply(DEFAULT_PROMO_FILTERS);
  };

  const triggerCls = "w-full bg-[#242B35] border-gray-700 text-white";
  const contentCls = "bg-[#1a2030] text-white border-gray-700";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-[#1F2430] border-l border-gray-700 text-white w-[360px] sm:max-w-[360px] flex flex-col h-full"
        onInteractOutside={(e) => {
          // The date pickers portal their calendar to <body>; a click inside
          // one counts as "outside" the sheet and would close it before Apply.
          // Keep the sheet open when the interaction targets a Radix popper.
          const target = e.target as HTMLElement | null;
          if (target?.closest("[data-radix-popper-content-wrapper]")) {
            e.preventDefault();
          }
        }}
      >
        <SheetHeader className="pb-4 border-b border-gray-700">
          <SheetTitle className="text-lg text-white">Promo Code Filters</SheetTitle>
          <SheetDescription className="text-sm text-gray-400">
            Filter promo codes by type, status, dates, and creation time
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TYPE */}
          <div className="space-y-2">
            <Label className="text-gray-300">Type</Label>
            <Select
              value={draft.discountType}
              onValueChange={(v) => set("discountType", v as PromoCodesFilters["discountType"])}
            >
              <SelectTrigger className={triggerCls}>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className={contentCls}>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="flat">Flat</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* STATUS */}
          <div className="space-y-2">
            <Label className="text-gray-300">Status</Label>
            <Select
              value={draft.status}
              onValueChange={(v) => set("status", v as PromoCodesFilters["status"])}
            >
              <SelectTrigger className={triggerCls}>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className={contentCls}>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* DATE RANGE */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-purple-400" />
              <Label className="text-gray-300">Date Range</Label>
            </div>
            <div className="grid grid-cols-2 gap-3 bg-[#191D24] p-3 rounded-xl border border-gray-800/50">
              <div className="space-y-1.5">
                <p className="text-[10px] text-gray-500 uppercase font-bold px-1">From</p>
                <DatePicker
                  date={stringToDate(draft.startDateFrom)}
                  maxDate={stringToDate(draft.endDateTo)}
                  onChange={(d) => {
                    set("startDateFrom", dateToString(d));
                  }}
                  className="w-full"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] text-gray-500 uppercase font-bold px-1">To</p>
                <DatePicker
                  date={stringToDate(draft.endDateTo)}
                  minDate={stringToDate(draft.startDateFrom)}
                  onChange={(d) => {
                    set("endDateTo", dateToString(d));
                  }}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* CREATED AT */}
          <div className="space-y-2">
            <Label className="text-gray-300">Created At</Label>
            <Select
              value={draft.createdAtRange}
              onValueChange={(v) => set("createdAtRange", v as DateRangePreset)}
            >
              <SelectTrigger className={triggerCls}>
                <SelectValue placeholder="Created At" />
              </SelectTrigger>
              <SelectContent className={contentCls}>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
            {draft.createdAtRange === "custom" && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-1">
                  <span className="text-[11px] text-gray-500">From</span>
                  <input
                    type="date"
                    value={draft.createdAtFrom}
                    max={draft.createdAtTo || undefined}
                    onChange={(e) => set("createdAtFrom", e.target.value)}
                    className="w-full rounded-md bg-[#242B35] border border-gray-700 text-white text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500/40 [color-scheme:dark]"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-gray-500">To</span>
                  <input
                    type="date"
                    value={draft.createdAtTo}
                    min={draft.createdAtFrom || undefined}
                    onChange={(e) => set("createdAtTo", e.target.value)}
                    className="w-full rounded-md bg-[#242B35] border border-gray-700 text-white text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500/40 [color-scheme:dark]"
                  />
                </div>
              </div>
            )}
          </div>
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
