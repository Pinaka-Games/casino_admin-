"use client";

import { useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";

export interface PaymentProcessorFilterValues {
  provider: string;
  method: string;
  depositable: string;
  withdrawable: string;
  currency: string;
}

export const DEFAULT_PAYMENT_PROCESSOR_FILTERS: PaymentProcessorFilterValues = {
  provider: "all",
  method: "all",
  depositable: "all",
  withdrawable: "all",
  currency: "all",
};

interface Props {
  values: PaymentProcessorFilterValues;
  onApply: (next: PaymentProcessorFilterValues) => void;
  onReset: () => void;
}

const triggerClass =
  "w-full h-10 px-3 border-none bg-[#242B35] rounded-lg text-white text-sm";
const contentClass = "bg-[#1a2030] text-white";

export function PaymentProcessorFilters({ values, onApply, onReset }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PaymentProcessorFilterValues>(values);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraft(values);
    }
    setOpen(next);
  };

  const handleApply = () => {
    onApply(draft);
    setOpen(false);
  };

  const handleReset = () => {
    setDraft(DEFAULT_PAYMENT_PROCESSOR_FILTERS);
    onReset();
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#242B35] px-3 text-sm text-white hover:bg-[#2c3543]"
          aria-label="Open payment processor filters"
        >
          <Filter size={20} className="text-[#B93DEB]" />
        </button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full max-w-sm border-l border-[#242B35] bg-[#15181E] text-white p-6"
      >
        <SheetHeader className="p-0">
          <SheetTitle className="text-base font-medium text-white">
            Payment Processor Filters
          </SheetTitle>
          <p className="text-xs text-gray-400">
            Filter processors by provider, method, and availability.
          </p>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <label className="text-xs text-white">Payment Provider</label>
            <Select
              value={draft.provider}
              onValueChange={(value) =>
                setDraft((prev) => ({ ...prev, provider: value }))
              }
            >
              <SelectTrigger className={triggerClass}>
                <SelectValue placeholder="All Providers" />
              </SelectTrigger>
              <SelectContent className={contentClass}>
                <SelectItem value="all">All Providers</SelectItem>
                <SelectItem value="breeze">Breeze</SelectItem>
                <SelectItem value="coinflow">Coinflow</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-white">Payment Method</label>
            <Select
              value={draft.method}
              onValueChange={(value) =>
                setDraft((prev) => ({ ...prev, method: value }))
              }
            >
              <SelectTrigger className={triggerClass}>
                <SelectValue placeholder="All Methods" />
              </SelectTrigger>
              <SelectContent className={contentClass}>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="crypto">Crypto</SelectItem>
                <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-white">Depositable</label>
            <Select
              value={draft.depositable}
              onValueChange={(value) =>
                setDraft((prev) => ({ ...prev, depositable: value }))
              }
            >
              <SelectTrigger className={triggerClass}>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent className={contentClass}>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-white">Withdrawable</label>
            <Select
              value={draft.withdrawable}
              onValueChange={(value) =>
                setDraft((prev) => ({ ...prev, withdrawable: value }))
              }
            >
              <SelectTrigger className={triggerClass}>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent className={contentClass}>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-white">Currency</label>
            <Select
              value={draft.currency}
              onValueChange={(value) =>
                setDraft((prev) => ({ ...prev, currency: value }))
              }
            >
              <SelectTrigger className={triggerClass}>
                <SelectValue placeholder="All Currency" />
              </SelectTrigger>
              <SelectContent className={contentClass}>
                <SelectItem value="all">All Currency</SelectItem>
                <SelectItem value="usd">USD</SelectItem>
                <SelectItem value="sgd">SGD</SelectItem>
                <SelectItem value="coin">Wolf Coin</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2">
          <Button
            onClick={handleApply}
            className="bg-[#B93DEB] text-white hover:bg-purple-500"
          >
            Apply Filters
          </Button>
          <Button
            onClick={handleReset}
            variant="outline"
            className="border-[#242B35] bg-transparent text-white hover:bg-[#242B35]"
          >
            Reset Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
