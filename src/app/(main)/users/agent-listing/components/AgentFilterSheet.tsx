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

export interface AgentFilters {
  status: string;
  provider: string;
  category: string;
  startDate?: Date;
  endDate?: Date;
  title?: string;
  description?: string;
  showStatus?: boolean;
}

interface AgentFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: AgentFilters;
  onApply: (filters: AgentFilters) => void;
  title?: string;
  description?: string;
  showStatus?: boolean;
}

const DEFAULT_FILTERS: AgentFilters = {
  status: "all",
  provider: "all",
  category: "all",
  startDate: undefined,
  endDate: undefined,
};

export default function AgentFilterSheet({
  open,
  onOpenChange,
  filters,
  onApply,
  title = "Agent Filters",
  description = "Filter the agent listing by status, date, or category.",
  showStatus = true,
}: AgentFilterSheetProps) {
  const [draftFilters, setDraftFilters] = React.useState<AgentFilters>(filters);

  React.useEffect(() => {
    if (open) {
      setDraftFilters(filters);
    }
  }, [filters, open]);

  const handleReset = () => {
    setDraftFilters(DEFAULT_FILTERS);
    onApply(DEFAULT_FILTERS);
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
            {title}
          </SheetTitle>
          <SheetDescription className="text-sm text-gray-400">
            {description}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {showStatus && (
            <div className="space-y-2">
              <Label className="text-gray-300 text-xs font-normal">
                Status
              </Label>
              <Select
                value={draftFilters.status}
                onValueChange={(value) =>
                  setDraftFilters((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger className="w-full bg-[#1A1F2B] border-white/5 text-gray-200 h-10 rounded-lg">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1F2B] border-white/5 text-gray-200">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* DATE RANGE */}
          <div className="space-y-1">
            <Label className="text-gray-300 text-xs font-normal">
              Date Range
            </Label>

            <div className="grid grid-cols-2 gap-0">
              <div className="space-y-1">
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

              <div className="space-y-1">
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
            Apply Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
