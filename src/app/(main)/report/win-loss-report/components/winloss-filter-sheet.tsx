"use client";

import React from "react";
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
import { Input } from "@/components/ui/input";

export interface WinLossFilters {
  startDate?: Date;
  endDate?: Date;
  userStatus: string;
  parentId: string;
}

interface WinLossFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: WinLossFilters;
  onApply: (filters: WinLossFilters) => void;
}

const DEFAULT_FILTERS: WinLossFilters = {
  startDate: undefined,
  endDate: undefined,
  userStatus: "all",
  parentId: "",
};

export function WinLossFilterSheet({
  open,
  onOpenChange,
  filters,
  onApply,
}: WinLossFilterSheetProps) {
  const [draftFilters, setDraftFilters] =
    React.useState<WinLossFilters>(filters);

  React.useEffect(() => {
    if (open) {
      setDraftFilters(filters);
    }
  }, [filters, open]);

  const handleReset = () => {
    const reset = { ...DEFAULT_FILTERS };
    setDraftFilters(reset);
    onApply(reset);
  };

  const handleApply = () => {
    onApply(draftFilters);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-[#191D24] border-l border-[#242B35] text-white w-[360px] sm:max-w-[360px] flex flex-col h-full p-0"
      >
        <SheetHeader className="p-6 border-b border-[#242B35]">
          <SheetTitle className="text-xl text-white font-semibold">
            Win/Loss Report Filters
          </SheetTitle>
          <SheetDescription className="text-sm text-gray-400">
            Narrow down your win-loss analytics view.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* DATE RANGE */}
          <div className="space-y-4">
            <Label className="text-gray-400 text-xs uppercase tracking-wider font-bold">
              Time Period
            </Label>

            <div className="flex gap-1">
              {/* START DATE */}
              <div className="w-1/2 space-y-1">
                <Label className="text-gray-300 text-xs font-normal">
                  Start Date
                </Label>
                <div className="bg-[#15181E] rounded-lg border border-[#242B35] overflow-hidden">
                  <DatePicker
                    className="w-full"
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
              </div>

              {/* END DATE */}
              <div className="w-1/2 space-y-1">
                <Label className="text-gray-300 text-xs font-normal">
                  End Date
                </Label>
                <div className="bg-[#15181E] rounded-lg border border-[#242B35] overflow-hidden">
                  <DatePicker
                    className="w-full"
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
        </div>
        <div className="p-6 border-t border-[#242B35] flex gap-3 bg-[#161A21]">
          <Button
            variant="outline"
            className="flex-1 bg-transparent border-[#242B35] text-white hover:bg-[#242B35] h-12 rounded-xl text-sm font-medium transition-colors"
            onClick={handleReset}
          >
            Reset All
          </Button>
          <Button
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-xl text-sm font-semibold shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]"
            onClick={handleApply}
          >
            Apply Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
