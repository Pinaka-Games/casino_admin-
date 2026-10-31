"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AdminMessageStatus,
  MessageAudience,
} from "@/api/messaging/messaging.api";

export interface HistoryFilters {
  audience: MessageAudience | "all";
  status: AdminMessageStatus | "all";
  dateFrom: string;
  dateTo: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  filters: HistoryFilters;
  onChange: (next: Partial<HistoryFilters>) => void;
  onReset: () => void;
  audienceOptions: { label: string; value: MessageAudience | "all" }[];
  statusOptions: { label: string; value: AdminMessageStatus | "all" }[];
}

/**
 * The secondary filters, moved off the toolbar into a right-hand panel.
 *
 * Channel and search stay on the bar because they are used on nearly every
 * visit; audience, status and the date range are occasional, and inline they
 * pushed the row to wrap on anything narrower than a desktop monitor.
 *
 * Changes apply immediately — there is no Apply button, so the table behind the
 * panel updates as each filter is set.
 */
export default function HistoryFiltersPanel({
  open,
  onClose,
  filters,
  onChange,
  onReset,
  audienceOptions,
  statusOptions,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />

      <aside className="relative w-full max-w-sm h-full bg-[#15181E] border-l border-[#242B35] flex flex-col">
        <header className="px-5 py-4 border-b border-[#242B35] flex items-center justify-between">
          <h2 className="text-white text-base">Filters</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            aria-label="Close filters"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div>
            <Label className="text-white text-sm">Audience</Label>
            <Select
              value={filters.audience}
              onValueChange={(v) =>
                onChange({ audience: v as MessageAudience | "all" })
              }
            >
              <SelectTrigger className="h-10 w-full mt-2 px-3 border border-[#3b414d] bg-[#242B35] rounded text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2030] text-white">
                {audienceOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-white text-sm">Status</Label>
            <Select
              value={filters.status}
              onValueChange={(v) =>
                onChange({ status: v as AdminMessageStatus | "all" })
              }
            >
              <SelectTrigger className="h-10 w-full mt-2 px-3 border border-[#3b414d] bg-[#242B35] rounded text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2030] text-white">
                {statusOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-white text-sm">Sent between</Label>
            <div className="grid grid-cols-1 gap-2 mt-2">
              <input
                type="date"
                value={filters.dateFrom}
                max={filters.dateTo || undefined}
                onChange={(e) => onChange({ dateFrom: e.target.value })}
                className="h-10 w-full bg-[#242B35] border border-[#3b414d] rounded px-3 text-white text-sm outline-none"
              />
              <input
                type="date"
                value={filters.dateTo}
                min={filters.dateFrom || undefined}
                onChange={(e) => onChange({ dateTo: e.target.value })}
                className="h-10 w-full bg-[#242B35] border border-[#3b414d] rounded px-3 text-white text-sm outline-none"
              />
            </div>
            <p className="text-gray-500 text-xs mt-2">
              Both ends are inclusive — a send made today matches a range ending
              today.
            </p>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[#242B35] flex items-center justify-between gap-3">
          <Button variant="outline" className="h-10" onClick={onReset}>
            Clear all
          </Button>
          <Button
            className="h-10 px-6 bg-purple-500 hover:bg-purple-600 text-white"
            onClick={onClose}
          >
            Done
          </Button>
        </div>
      </aside>
    </div>
  );
}
