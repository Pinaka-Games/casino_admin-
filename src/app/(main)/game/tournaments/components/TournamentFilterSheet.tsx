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
import { TournamentStatus } from "@/types/tournament";
import Image from "next/image";
import { coingreen, coingold } from "@/assets/icons";

export interface TournamentFilters {
  status: "all" | TournamentStatus;
  currency: "all" | "WulfCash" | "WulfCoin";
  isPaid: "all" | "paid" | "pending";
}

interface TournamentFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: TournamentFilters;
  onApply: (filters: TournamentFilters) => void;
}

export const DEFAULT_TOURNAMENT_FILTERS: TournamentFilters = {
  status: "all",
  currency: "all",
  isPaid: "all",
};

export function TournamentFilterSheet({
  open,
  onOpenChange,
  filters,
  onApply,
}: TournamentFilterSheetProps) {
  const [draftFilters, setDraftFilters] = React.useState<TournamentFilters>(filters);

  React.useEffect(() => {
    if (open) {
      setDraftFilters(filters);
    }
  }, [filters, open]);

  const handleReset = () => {
    setDraftFilters(DEFAULT_TOURNAMENT_FILTERS);
    onApply(DEFAULT_TOURNAMENT_FILTERS);
  };

  const handleApply = () => {
    onApply(draftFilters);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-[#1F2430] border-l border-gray-700 text-white w-[300px] sm:w-[360px] sm:max-w-[360px]"
      >
        <SheetHeader className="pb-4 border-b border-gray-700">
          <SheetTitle className="text-lg text-white">Tournament Filters</SheetTitle>
          <SheetDescription className="text-sm text-gray-400">
            Refine the tournament list by specific criteria
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 mt-4">
          {/* STATUS */}
          <div className="space-y-2">
            <Label className="text-gray-400 text-xs uppercase font-bold tracking-wider">Tournament Status</Label>
            <Select
              value={draftFilters.status}
              onValueChange={(value) =>
                setDraftFilters((prev) => ({ ...prev, status: value as any }))
              }
            >
              <SelectTrigger className="w-full bg-[#242B35] border-none text-white h-10">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2030] text-white border-gray-700">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value={TournamentStatus.IN_PROGRESS}>In Progress</SelectItem>
                <SelectItem value={TournamentStatus.STOPPED}>Stopped</SelectItem>
                <SelectItem value={TournamentStatus.COMPLETED}>Completed</SelectItem>
                <SelectItem value={TournamentStatus.UPCOMING}>Upcoming</SelectItem>
                <SelectItem value={TournamentStatus.CANCELLED}>Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* CURRENCY */}
          <div className="space-y-2">
            <Label className="text-gray-400 text-xs uppercase font-bold tracking-wider">Prize Currency</Label>
            <Select
              value={draftFilters.currency}
              onValueChange={(value) =>
                setDraftFilters((prev) => ({ ...prev, currency: value as any }))
              }
            >
              <SelectTrigger className="w-full bg-[#242B35] border-none text-white h-10">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2030] text-white border-gray-700">
                <SelectItem value="all">All Currencies</SelectItem>
                <SelectItem value="WulfCash">
                   <div className="flex items-center gap-2">
                      <Image src={coingreen} alt="WulfCash" width={14} height={14} />
                      <span>WulfCash</span>
                   </div>
                </SelectItem>
                <SelectItem value="WulfCoin">
                   <div className="flex items-center gap-2">
                      <Image src={coingold} alt="WulfCoin" width={14} height={14} />
                      <span>WulfCoin</span>
                   </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* PAYOUT STATUS */}
          <div className="space-y-2">
            <Label className="text-gray-400 text-xs uppercase font-bold tracking-wider">Payout Status</Label>
            <Select
              value={draftFilters.isPaid}
              onValueChange={(value) =>
                setDraftFilters((prev) => ({ ...prev, isPaid: value as any }))
              }
            >
              <SelectTrigger className="w-full bg-[#242B35] border-none text-white h-10">
                <SelectValue placeholder="Select payout state" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2030] text-white border-gray-700">
                <SelectItem value="all">Any Payout</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-auto p-4 border-t border-gray-700 space-y-3 pt-6">
          <Button
            type="button"
            onClick={handleApply}
            className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold h-11"
          >
            Apply Filters
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            className="w-full bg-[#2A3240] border-gray-700 text-white hover:bg-[#313B4A] border"
          >
            Reset All
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
