"use client";

import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import DatePicker from "@/components/DatePicker";

export interface FilterState {
  status?: string;
  startDate?: Date;
  endDate?: Date;
}

interface AgentFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FilterState;
  onApply: (filters: FilterState) => void;
  statusOptions?: { label: string; value: string }[];
  title?: string;
  description?: string;
}

const startOfDay = (d: Date) => {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
};

/** Ranges are inclusive of the end day — consumers compare with `<= endDate`. */
const endOfDay = (d: Date) => {
  const next = new Date(d);
  next.setHours(23, 59, 59, 999);
  return next;
};

export function AgentFilterSheet({
  open,
  onOpenChange,
  filters,
  onApply,
  statusOptions,
  title = "Audit Filters",
  description = "Narrow down your transaction audit logs.",
}: AgentFilterSheetProps) {
  const defaultStatus = statusOptions?.[0]?.value ?? "All";
  const [draftFilters, setDraftFilters] = useState<FilterState>(filters);

  // Re-seed the draft each time the sheet opens. Adjusting state during render
  // is React's documented alternative to a setState-in-effect.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraftFilters(filters);
  }

  const handleReset = () => {
    // Must reset to the first status option, not a hardcoded string — consumers
    // compare against their own option values and an unknown one filters everything out.
    const refreshed: FilterState = {
      status: defaultStatus,
      startDate: undefined,
      endDate: undefined,
    };
    setDraftFilters(refreshed);
    onApply(refreshed);
    onOpenChange(false);
  };

  const handleApply = () => {
    const { startDate, endDate } = draftFilters;
    onApply({
      ...draftFilters,
      startDate: startDate ? startOfDay(startDate) : undefined,
      endDate: endDate ? endOfDay(endDate) : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-[#191D24] border-l border-gray-800 text-white w-[88vw] max-w-[360px] sm:w-[360px] p-0 flex flex-col"
      >
        <SheetHeader className="p-4 border-b border-gray-800">
          <SheetTitle className="text-lg text-white font-normal">
            {title}
          </SheetTitle>
          {/* Kept for Radix a11y (SheetContent warns without it), visually hidden. */}
          <SheetDescription className="sr-only">{description}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
          {statusOptions && statusOptions.length > 0 && (
            <div className="space-y-3">
              <Label className="text-[10px] text-gray-500 uppercase font-bold px-1">
                Status
              </Label>
              <Select
                value={draftFilters.status ?? statusOptions[0]?.value}
                onValueChange={(value) =>
                  setDraftFilters((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger className="h-11 bg-[#10141B] border border-[#2A3340] text-white rounded-xl">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="bg-[#191D24] border-gray-800 text-white">
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* DATE RANGE */}
          <div className="space-y-3">
            <Label className="text-[10px] text-gray-500 uppercase font-bold px-1">
              Date Range
            </Label>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-600 mb-1 ml-1">
                  Start Date
                </p>
                <DatePicker
                  date={draftFilters.startDate}
                  onChange={(date) =>
                    setDraftFilters((prev) => ({ ...prev, startDate: date }))
                  }
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-600 mb-1 ml-1">End Date</p>
                <DatePicker
                  date={draftFilters.endDate}
                  onChange={(date) =>
                    setDraftFilters((prev) => ({ ...prev, endDate: date }))
                  }
                />
              </div>
            </div>
          </div>

        </div>

        <div className="p-4 border-t border-gray-800 flex gap-3">
          <Button
            variant="outline"
            className="flex-1 bg-transparent border-gray-700 text-gray-400 hover:text-white hover:bg-[#242B35] h-11 rounded-xl text-xs uppercase"
            onClick={handleReset}
          >
            Reset
          </Button>
          <Button
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white h-11 rounded-xl text-xs uppercase font-bold"
            onClick={handleApply}
          >
            Apply Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
