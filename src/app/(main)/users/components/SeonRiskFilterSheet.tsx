"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import UsDateInput from "@/components/UsDateInput";
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

export type DecisionFilter = "" | "ALLOW" | "BLOCK" | "STEP_UP";
export type VpnFilter = "all" | "true" | "false";

export interface SeonRiskFilterValues {
  actionType: string;
  decision: DecisionFilter;
  countryCode: string;
  vpn: VpnFilter;
  dateFrom: string;
  dateTo: string;
  scoreMin: string;
  scoreMax: string;
}

interface SeonRiskFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: SeonRiskFilterValues;
  onApply: (filters: SeonRiskFilterValues) => void;
}

const DEFAULT_FILTERS: SeonRiskFilterValues = {
  actionType: "",
  decision: "",
  countryCode: "",
  vpn: "all",
  dateFrom: "",
  dateTo: "",
  scoreMin: "",
  scoreMax: "",
};

export default function SeonRiskFilterSheet({
  open,
  onOpenChange,
  filters,
  onApply,
}: SeonRiskFilterSheetProps) {
  const [draftFilters, setDraftFilters] = React.useState<SeonRiskFilterValues>(filters);

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
    onApply({
      ...draftFilters,
      countryCode: draftFilters.countryCode.toUpperCase(),
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-[#1F2430] border-l border-gray-700 text-white w-[360px] sm:max-w-[360px]"
      >
        <SheetHeader className="pb-4 border-b border-gray-700">
          <SheetTitle className="text-lg text-white">SEON Filters</SheetTitle>
          <SheetDescription className="text-sm text-gray-400">
            Filter SEON risk decisions by required fields
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-gray-300">Decision</Label>
            <Select
              value={draftFilters.decision || "all"}
              onValueChange={(value) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  decision: value === "all" ? "" : (value as DecisionFilter),
                }))
              }
            >
              <SelectTrigger className="w-full bg-[#242B35] border-gray-700 text-white">
                <SelectValue placeholder="Select decision" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2030] text-white border-gray-700">
                <SelectItem value="all">All Decisions</SelectItem>
                <SelectItem value="ALLOW">Allow</SelectItem>
                <SelectItem value="BLOCK">Block</SelectItem>
                <SelectItem value="STEP_UP">Review</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">VPN / Proxy</Label>
            <Select
              value={draftFilters.vpn}
              onValueChange={(value) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  vpn: value as VpnFilter,
                }))
              }
            >
              <SelectTrigger className="w-full bg-[#242B35] border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2030] text-white border-gray-700">
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Action Type</Label>
            <Input
              value={draftFilters.actionType}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  actionType: event.target.value,
                }))
              }
              placeholder="login, registration..."
              className="bg-[#242B35] border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Country Code</Label>
            <Input
              value={draftFilters.countryCode}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  countryCode: event.target.value.toUpperCase(),
                }))
              }
              placeholder="US, IN..."
              className="bg-[#242B35] border-gray-700 text-white placeholder:text-gray-500 uppercase"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Date From</Label>
            <UsDateInput
              value={draftFilters.dateFrom}
              onChange={(iso) =>
                setDraftFilters((prev) => ({ ...prev, dateFrom: iso }))
              }
              className="bg-[#242B35] border border-gray-700 rounded-md h-9 px-3 flex items-center text-white"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Date To</Label>
            <UsDateInput
              value={draftFilters.dateTo}
              onChange={(iso) =>
                setDraftFilters((prev) => ({ ...prev, dateTo: iso }))
              }
              className="bg-[#242B35] border border-gray-700 rounded-md h-9 px-3 flex items-center text-white"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Score Min</Label>
            <Input
              type="number"
              value={draftFilters.scoreMin}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  scoreMin: event.target.value,
                }))
              }
              placeholder="Minimum score"
              className="bg-[#242B35] border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Score Max</Label>
            <Input
              type="number"
              value={draftFilters.scoreMax}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  scoreMax: event.target.value,
                }))
              }
              placeholder="Maximum score"
              className="bg-[#242B35] border-gray-700 text-white placeholder:text-gray-500"
            />
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
