"use client";

import { useAuthStore } from "@/store/auth-store";
import { ReferralStats, EarningRecord } from "@/types/profile.type";
import { EarningsChart } from "./EarningsChart";
import { getDisplayCommissionAmount } from "./earning-display";
import { useAgentPackageStore } from "@/store/agent-package.store";
import { useEffect } from "react";
import { CircleHelp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface AgentOverviewProps {
  stats: ReferralStats | null;
  earnings: EarningRecord[];
  isLoading: boolean;
  activePeriod: string;
  onPeriodChange: (period: string) => void;
}

export function AgentOverview({
  stats,
  earnings,
  isLoading,
  activePeriod,
  onPeriodChange,
}: AgentOverviewProps) {
  const user = useAuthStore((state) => state.user);
  const isSubAgent =
    user?.roles?.some((role) => role.name.toLowerCase().includes("sub")) ??
    false;

  const { currentPackage, fetchCurrentPackage } = useAgentPackageStore();

  useEffect(() => {
    fetchCurrentPackage();
  }, [fetchCurrentPackage]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-32 bg-[#191D24] rounded-xl border border-gray-800"
            />
          ))}
        </div>
        <div className="h-80 bg-[#191D24] rounded-xl border border-gray-800" />
      </div>
    );
  }

  const periodRevenue = earnings
    .reduce(
      (acc, curr) =>
        acc + getDisplayCommissionAmount(curr, isSubAgent),
      0,
    )
    .toLocaleString(undefined, { minimumFractionDigits: 2 });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ---------- PERFORMANCE & TASKS ---------- */}
      <div className="grid grid-cols-1 gap-8">
        <div className="space-y-10">
          <div className="bg-[#191D24] p-6 rounded-xl border border-gray-800">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-white uppercase tracking-tight">
                    Growth Velocity
                  </h3>
                  <Dialog>
                    <DialogTrigger asChild>
                      <button
                        type="button"
                        aria-label="Open growth velocity information"
                        className="inline-flex items-center justify-center rounded-full text-gray-400 hover:text-white transition-colors"
                      >
                        <CircleHelp className="h-4 w-4" />
                      </button>
                    </DialogTrigger>
                    <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md bg-[#0F1420] border border-white/10 text-white max-h-[90dvh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-white">How Growth Velocity Works</DialogTitle>
                        <DialogDescription className="text-gray-300 leading-relaxed">
                          This chart shows your earnings by day. Each point represents the total
                          income for that specific date. If there is no earning on a date, it is
                          shown as 0. Hover over a point to see the exact date and earning amount.
                        </DialogDescription>
                      </DialogHeader>
                    </DialogContent>
                  </Dialog>
                </div>
                <p className="text-gray-500 text-xs font-bold uppercase">
                  Analysis of your revenue generation over time.
                </p>
              </div>

              <div className="flex items-center gap-6">
                {/* Period highlight */}
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-gray-500 uppercase font-bold leading-none mb-1">
                    Period Revenue
                  </span>
                  {/* <span className="text-xl font-bold text-white tracking-tight">
                    {periodRevenue}
                  </span> */}
                </div>

                {/* <div className="flex gap-2 bg-black/20 p-1 rounded-lg border border-white/5">
                  {['D', 'W', 'M'].map((p) => (
                    <button
                      key={p}
                      onClick={() => onPeriodChange(p)}
                      className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${
                        activePeriod === p
                          ? "bg-purple-600 text-white border border-purple-500 shadow-lg shadow-purple-500/20"
                          : "bg-black/40 text-gray-400 border border-white/5 hover:bg-white/5"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div> */}
              </div>
            </div>
            
            <div className="h-[240px] sm:h-[320px]">
              <EarningsChart earnings={earnings} isLoading={isLoading} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
