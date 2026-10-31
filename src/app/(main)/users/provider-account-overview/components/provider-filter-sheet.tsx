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
import { ProviderStats } from "@/store/provider-store";

export interface ProviderFilters {
  status: ProviderStats["status"] | "all";
}

interface ProviderFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ProviderFilters;
  onApply: (filters: ProviderFilters) => void;
}

const DEFAULT_FILTERS: ProviderFilters = {
  status: "all",
};

export function ProviderFilterSheet({
  open,
  onOpenChange,
  filters,
  onApply,
}: ProviderFilterSheetProps) {
  const [draftFilters, setDraftFilters] =
    React.useState<ProviderFilters>(filters);

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
            Provider Filters
          </SheetTitle>
          <SheetDescription className="text-sm text-gray-400">
            Refine the provider overview data.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* STATUS FILTER */}
          <div className="space-y-4">
            <Label className="text-gray-400 text-xs uppercase tracking-wider font-bold">
              Provider Status
            </Label>
            <Select
              value={draftFilters.status}
              onValueChange={(val: any) =>
                setDraftFilters((prev) => ({ ...prev, status: val }))
              }
            >
              <SelectTrigger className="bg-[#15181E] border-[#242B35] text-white rounded-lg h-11 focus:ring-0">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent className="bg-[#191D24] border-[#242B35] text-white">
                <SelectItem value="all">All Providers</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
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
