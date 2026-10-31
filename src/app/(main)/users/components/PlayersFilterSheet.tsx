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

export type PlayerSource = "all" | "direct" | "agent" | "subagent" | "user";

export type DateRange = "all" | "7d" | "30d" | "custom";

export interface PlayersFilters {
  source: PlayerSource;
  accountStatus: "all" | "active" | "inactive";
  kyc:
    | "all"
    | "started"
    | "not_started"
    | "approved"
    | "in_progress"
    | "pending"
    | "rejected";
  vipTierId: string; // "" = all
  online: "all" | "online" | "offline";
  dateRange: DateRange;
  startDate: string; // yyyy-mm-dd (custom only)
  endDate: string; // yyyy-mm-dd (custom only)
}

export const DEFAULT_PLAYER_FILTERS: PlayersFilters = {
  source: "all",
  accountStatus: "all",
  kyc: "all",
  vipTierId: "",
  online: "all",
  dateRange: "all",
  startDate: "",
  endDate: "",
};

interface TierOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: PlayersFilters;
  onApply: (filters: PlayersFilters) => void;
  tierOptions: TierOption[];
}

export function PlayersFilterSheet({
  open,
  onOpenChange,
  filters,
  onApply,
  tierOptions,
}: Props) {
  const [draft, setDraft] = React.useState<PlayersFilters>(filters);

  React.useEffect(() => {
    if (open) setDraft({ ...DEFAULT_PLAYER_FILTERS, ...filters });
  }, [filters, open]);

  const set = <K extends keyof PlayersFilters>(k: K, v: PlayersFilters[K]) =>
    setDraft((prev) => ({ ...prev, [k]: v }));

  const handleApply = () => {
    onApply(draft);
    onOpenChange(false);
  };

  const handleReset = () => {
    setDraft(DEFAULT_PLAYER_FILTERS);
    onApply(DEFAULT_PLAYER_FILTERS);
  };

  const triggerCls =
    "w-full bg-[#242B35] border-gray-700 text-white";
  const contentCls = "bg-[#1a2030] text-white border-gray-700";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-[#1F2430] border-l border-gray-700 text-white w-[360px] sm:max-w-[360px] flex flex-col"
      >
        <SheetHeader className="pb-4 border-b border-gray-700">
          <SheetTitle className="text-lg text-white">Player Filters</SheetTitle>
          <SheetDescription className="text-sm text-gray-400">
            Filter players by source, status, KYC and tier
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-gray-300">Source</Label>
            <Select value={draft.source} onValueChange={(v) => set("source", v as PlayerSource)}>
              <SelectTrigger className={triggerCls}><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent className={contentCls}>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="direct">Normal (Direct)</SelectItem>
                <SelectItem value="agent">Referred by Agent</SelectItem>
                <SelectItem value="subagent">Referred by Sub-Agent</SelectItem>
                <SelectItem value="user">Referred by User</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Account Status</Label>
            <Select value={draft.accountStatus} onValueChange={(v) => set("accountStatus", v as PlayersFilters["accountStatus"])}>
              <SelectTrigger className={triggerCls}><SelectValue /></SelectTrigger>
              <SelectContent className={contentCls}>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">KYC</Label>
            <Select value={draft.kyc} onValueChange={(v) => set("kyc", v as PlayersFilters["kyc"])}>
              <SelectTrigger className={triggerCls}><SelectValue /></SelectTrigger>
              <SelectContent className={contentCls}>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="not_started">Not Started</SelectItem>
                <SelectItem value="started">KYC Started (any)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">VIP Tier</Label>
            <Select
              value={draft.vipTierId || "all"}
              onValueChange={(v) => set("vipTierId", v === "all" ? "" : v)}
            >
              <SelectTrigger className={triggerCls}><SelectValue placeholder="All Tiers" /></SelectTrigger>
              <SelectContent className={contentCls}>
                <SelectItem value="all">All Tiers</SelectItem>
                {tierOptions.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Online Status</Label>
            <Select value={draft.online} onValueChange={(v) => set("online", v as PlayersFilters["online"])}>
              <SelectTrigger className={triggerCls}><SelectValue /></SelectTrigger>
              <SelectContent className={contentCls}>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-gray-500">Online status filters the current page only (it&apos;s live).</p>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-300">Registered</Label>
            <Select value={draft.dateRange || "all"} onValueChange={(v) => set("dateRange", v as DateRange)}>
              <SelectTrigger className={triggerCls}><SelectValue placeholder="All time" /></SelectTrigger>
              <SelectContent className={contentCls}>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
            {draft.dateRange === "custom" && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-1">
                  <span className="text-[11px] text-gray-500">From</span>
                  <input
                    type="date"
                    value={draft.startDate}
                    max={draft.endDate || undefined}
                    onChange={(e) => set("startDate", e.target.value)}
                    className="w-full rounded-md bg-[#242B35] border border-gray-700 text-white text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500/40 [color-scheme:dark]"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-gray-500">To</span>
                  <input
                    type="date"
                    value={draft.endDate}
                    min={draft.startDate || undefined}
                    onChange={(e) => set("endDate", e.target.value)}
                    className="w-full rounded-md bg-[#242B35] border border-gray-700 text-white text-sm px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500/40 [color-scheme:dark]"
                  />
                </div>
              </div>
            )}
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
