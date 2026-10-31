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

export interface RoleFilters {
  status: "all" | "active" | "inactive";
  createdWindow: "all" | "last_1_day" | "last_1_week";
}

interface RoleFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: RoleFilters;
  onApply: (filters: RoleFilters) => void;
}

const DEFAULT_FILTERS: RoleFilters = {
  status: "all",
  createdWindow: "all",
};

export function RoleFilterSheet({
  open,
  onOpenChange,
  filters,
  onApply,
}: RoleFilterSheetProps) {
  const [draftFilters, setDraftFilters] = React.useState<RoleFilters>(filters);

  React.useEffect(() => {
    if (open) {
      setDraftFilters(filters);
    }
  }, [filters, open]);

  const handleReset = () => {
    setDraftFilters(DEFAULT_FILTERS);
    onApply(DEFAULT_FILTERS);
  };

  const handleApply = () => {
    onApply(draftFilters);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-[#1F2430] border-l border-gray-700 text-white w-[360px] sm:max-w-[360px]"
      >
        <SheetHeader className="pb-4 border-b border-gray-700">
          <SheetTitle className="text-lg text-white">Role Filters</SheetTitle>
          <SheetDescription className="text-sm text-gray-400">
            Filter roles by required fields
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-gray-300">Status</Label>
            <Select
              value={draftFilters.status}
              onValueChange={(value) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  status: value as RoleFilters["status"],
                }))
              }
            >
              <SelectTrigger className="w-full bg-[#242B35] border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2030] text-white border-gray-700">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Created</Label>
            <Select
              value={draftFilters.createdWindow}
              onValueChange={(value) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  createdWindow: value as RoleFilters["createdWindow"],
                }))
              }
            >
              <SelectTrigger className="w-full bg-[#242B35] border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2030] text-white border-gray-700">
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="last_1_day">Last 1 Day</SelectItem>
                <SelectItem value="last_1_week">Last 1 Week</SelectItem>
              </SelectContent>
            </Select>
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

