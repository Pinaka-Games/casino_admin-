"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import DatePicker from "@/components/DatePicker";

export interface EngagementFilters {
  startDate?: Date;
  endDate?: Date;
}

interface EngagementFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: EngagementFilters;
  onApply: (filters: EngagementFilters) => void;
}

export default function EngagementFilterSheet({
  open,
  onOpenChange,
  filters,
  onApply,
}: EngagementFilterSheetProps) {
  const [draftFilters, setDraftFilters] = React.useState<EngagementFilters>(filters);

  React.useEffect(() => {
    if (open) {
      setDraftFilters(filters);
    }
  }, [filters, open]);

  const handleReset = () => {
    const resetFilters = { startDate: undefined, endDate: undefined };
    setDraftFilters(resetFilters);
    onApply(resetFilters);
    onOpenChange(false);
  };

  const handleApply = () => {
    onApply(draftFilters);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-[#1F2430] border-l border-gray-700 text-white w-[360px] sm:max-w-[360px] flex flex-col h-full p-0"
      >
        <SheetHeader className="p-4 border-b border-gray-700">
          <SheetTitle className="text-lg text-white font-normal">
            Engagement Filters
          </SheetTitle>
          <SheetDescription className="text-sm text-gray-400">
            Filter engagement data by date range.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-4">
            <Label className="text-gray-300 text-xs font-normal">
              Select Date Range
            </Label>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-500 text-[10px] uppercase">
                  Start Date
                </Label>
                <DatePicker
                  date={draftFilters.startDate}
                  maxDate={draftFilters.endDate}
                  onChange={(date) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      startDate: date,
                      endDate: prev.endDate && date && prev.endDate < date ? undefined : prev.endDate,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-500 text-[10px] uppercase">
                  End Date
                </Label>
                <DatePicker
                  date={draftFilters.endDate}
                  minDate={draftFilters.startDate}
                  onChange={(date) =>
                    setDraftFilters((prev) => ({
                      ...prev,
                      endDate: date,
                      startDate: prev.startDate && date && prev.startDate > date ? undefined : prev.startDate,
                    }))
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-700 flex gap-3">
          <Button
            variant="outline"
            className="flex-1 bg-transparent cursor-pointer border-gray-600 text-white hover:bg-gray-700 h-11 rounded-xl"
            onClick={handleReset}
          >
            Reset
          </Button>
          <Button
            className="flex-1 bg-purple-600 cursor-pointer hover:bg-purple-700 text-white h-11 rounded-xl"
            onClick={handleApply}
          >
            Apply
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
