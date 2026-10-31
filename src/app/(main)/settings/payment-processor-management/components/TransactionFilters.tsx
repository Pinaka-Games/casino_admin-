"use client";

import { useEffect, useState } from "react";
import { Filter } from "lucide-react";
import DatePicker from "@/components/DatePicker";
import { utcDayEndISO, utcDayStartISO } from "@/lib/utils";

import {
  Sheet,
  SheetContent,
  SheetDescription,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface TransactionFilterValues {
  flow: "pay-in" | "pay-out" | "all";
  provider: "breeze" | "coinflow" | "all";
  status: string;
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
}

export const DEFAULT_TRANSACTION_FILTERS: TransactionFilterValues = {
  flow: "pay-in",
  provider: "all",
  status: "all",
  dateFrom: "",
  dateTo: "",
  amountMin: "",
  amountMax: "",
};

interface Props {
  values: TransactionFilterValues;
  onApply: (next: TransactionFilterValues) => void;
  onReset: () => void;
}

/**
 * Pay-ins and pay-outs have different status sets. Offering the union for both
 * meant six of the eleven options could never match a pay-in row, so choosing
 * one silently returned an empty table.
 */
const PAY_IN_STATUSES: Array<[string, string]> = [
  ["PAID", "Paid"],
  ["UNPAID", "Unpaid"],
  ["EXPIRED", "Expired"],
  ["FAILED", "Failed"],
  ["CANCELED", "Canceled"],
];

const PAY_OUT_STATUSES: Array<[string, string]> = [
  ["CREATED", "Created"],
  ["PENDING", "Pending"],
  ["PROCESSING", "Processing"],
  ["PROCESSED", "Processed"],
  ["COMPLETED", "Completed"],
  ["REFUNDED", "Refunded"],
  ["EXPIRED", "Expired"],
  ["FAILED", "Failed"],
  ["CANCELED", "Canceled"],
  // Provider sent a status the mapper has no case for — worth being able to
  // filter for, since those rows need looking at.
  ["UNKNOWN", "Unknown"],
];

const statusOptions = (flow: TransactionFilterValues["flow"]) => {
  if (flow === "pay-in") return PAY_IN_STATUSES;
  if (flow === "pay-out") return PAY_OUT_STATUSES;
  const merged = new Map([...PAY_IN_STATUSES, ...PAY_OUT_STATUSES]);
  return Array.from(merged.entries());
};

// Shared control classes, matching the other filter sheets in the admin panel
// (see report/user-win-loss-detail → game-report-filter-sheet).
const selectTriggerCls = "w-full bg-[#242B35] border-gray-700 text-white";
const selectContentCls = "bg-[#1a2030] text-white border-gray-700";
const inputCls = "bg-[#242B35] border-gray-700 text-white";

/**
 * The filter keeps its dates as ISO strings (that is what the query builder
 * sends), while DatePicker works in `Date`. These convert between the two.
 *
 * `dateTo` is stored at END of day: the API compares `createdAt <= dateTo`, so a
 * midnight bound silently excluded every transaction on the chosen day.
 *
 * Bounds are whole UTC days, the zone the rows print in — same as User Deposit
 * logs, so one picked range returns the same rows on both screens.
 */
const toDate = (iso: string): Date | undefined => {
  if (!iso) return undefined;
  // Rebuild the picked calendar day as LOCAL midnight; `new Date(iso)` on a
  // UTC-midnight bound shows the previous day west of Greenwich.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

const fromDateStart = (d?: Date): string => utcDayStartISO(d) ?? "";

const fromDateEnd = (d?: Date): string => utcDayEndISO(d) ?? "";

export function TransactionFilters({ values, onApply, onReset }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<TransactionFilterValues>(values);

  // Re-seed the draft whenever the sheet opens, so it always reflects what is
  // actually applied rather than an abandoned edit.
  useEffect(() => {
    if (open) setDraft(values);
  }, [open, values]);

  const handleApply = () => {
    onApply(draft);
    setOpen(false);
  };

  const handleReset = () => {
    setDraft(DEFAULT_TRANSACTION_FILTERS);
    onReset();
    setOpen(false);
  };

  const draftFrom = toDate(draft.dateFrom);
  const draftTo = toDate(draft.dateTo);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {/* Same icon button as every other filter in the panel. */}
        <Button
          variant="outline"
          size="sm"
          className="h-10 gap-2 rounded-md border-gray-700/50 bg-[#1a2030]/50 px-4 text-gray-300 shrink-0 transition-all hover:border-purple-500/50 hover:bg-[#1a2030] hover:text-white"
          aria-label="Open filters"
        >
          <Filter className="h-4 w-4 text-purple-400" />
          Filters
        </Button>
      </SheetTrigger>

      {/* Fixed header, SCROLLING body, pinned footer. The body used to grow
          unbounded, so on shorter viewports the Reset button fell off the bottom
          of the sheet with no way to reach it. */}
      <SheetContent
        side="right"
        className="bg-[#1F2430] border-l border-gray-700 text-white w-[360px] sm:max-w-[360px]"
      >
        <SheetHeader className="pb-4 border-b border-gray-700">
          <SheetTitle className="text-lg text-white">
            Transaction Filters
          </SheetTitle>
          <SheetDescription className="text-sm text-gray-400">
            Filter transactions by provider, status, date and amount
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* DATE RANGE */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Date From</Label>
              <DatePicker
                date={draftFrom}
                maxDate={draftTo}
                onChange={(date) =>
                  setDraft((p) => ({ ...p, dateFrom: fromDateStart(date) }))
                }
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Date To</Label>
              <DatePicker
                date={draftTo}
                minDate={draftFrom}
                onChange={(date) =>
                  setDraft((p) => ({ ...p, dateTo: fromDateEnd(date) }))
                }
                className="w-full"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Flow</Label>
            <Select
              value={draft.flow}
              onValueChange={(v) =>
                setDraft((p) => {
                  const flow = v as TransactionFilterValues["flow"];
                  // Drop a status the new flow cannot have (e.g. PROCESSED
                  // selected, then switching to pay-ins) — it would otherwise
                  // stay applied and return nothing.
                  const stillValid = statusOptions(flow).some(
                    ([value]) => value === p.status,
                  );
                  return {
                    ...p,
                    flow,
                    status: stillValid ? p.status : "all",
                  };
                })
              }
            >
              <SelectTrigger className={selectTriggerCls}>
                <SelectValue placeholder="Select flow" />
              </SelectTrigger>
              <SelectContent className={selectContentCls}>
                <SelectItem value="all">All Flows</SelectItem>
                <SelectItem value="pay-in">Pay-ins</SelectItem>
                <SelectItem value="pay-out">Pay-outs</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Provider</Label>
            <Select
              value={draft.provider}
              onValueChange={(v) =>
                setDraft((p) => ({
                  ...p,
                  provider: v as TransactionFilterValues["provider"],
                }))
              }
            >
              <SelectTrigger className={selectTriggerCls}>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent className={selectContentCls}>
                <SelectItem value="all">All Providers</SelectItem>
                <SelectItem value="breeze">Breeze</SelectItem>
                <SelectItem value="coinflow">Coinflow</SelectItem>
                <SelectItem value="coinswitch">CoinSwitch</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Status</Label>
            <Select
              value={draft.status}
              onValueChange={(v) => setDraft((p) => ({ ...p, status: v }))}
            >
              <SelectTrigger className={selectTriggerCls}>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent className={selectContentCls}>
                <SelectItem value="all">All Status</SelectItem>
                {statusOptions(draft.flow).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* AMOUNT RANGE — Min/Max pair, same shape as the other sheets. */}
          <div className="space-y-2">
            <Label className="text-gray-300">Amount</Label>
            <div className="grid grid-cols-2 gap-4">
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Min"
                value={draft.amountMin}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, amountMin: e.target.value }))
                }
                className={inputCls}
              />
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Max"
                value={draft.amountMax}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, amountMax: e.target.value }))
                }
                className={inputCls}
              />
            </div>
          </div>
        </div>

        <div className="mt-auto p-4 border-t border-gray-700 flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            className="flex-1 bg-[#2A3240] border-gray-700 cursor-pointer text-white hover:bg-[#313B4A]"
          >
            Reset Filters
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            className="flex-1 bg-purple-500 cursor-pointer hover:bg-purple-600 text-white"
          >
            Apply Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
