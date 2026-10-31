"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import {
  TrendingUp,
} from "lucide-react";
import {
  ReferralStats,
  EarningRecord,
} from "@/types/profile.type";
import { format, parseISO } from "date-fns";
import { useAgentPackageStore } from "@/store/agent-package.store";
import { useEffect, useMemo } from "react";
import EmptyStatePage from "@/components/emptystatePage";
import { notfound } from "@/assets/icons";
import Pagination from "@/components/Pagination/Pagination";
import {
  getDisplayCommissionAmount,
  getDisplayCommissionPercent,
  getPlatformGrossAmount,
} from "./earning-display";
import { FeatureGate, FeatureBadge } from "./FeatureGate";
import { useFeatureAccess } from "@/hooks/use-feature-access";

interface MyRewardsProps {
  stats: ReferralStats | null;
  isLoading: boolean;
  earnings?: EarningRecord[];
}

export function MyRewards({
  stats,
  isLoading,
  earnings = [],
}: MyRewardsProps) {
  const { user } = useAuthStore();
  const { canViewDailyEarnings } = useFeatureAccess();
  
  const [earningsPage, setEarningsPage] = useState(1);
  const itemsPerPage = 8;
  const totalPages = Math.ceil((earnings?.length || 0) / itemsPerPage);
  const isSubAgent =
    user?.roles?.some((role) => role.name.toLowerCase().includes("sub")) ??
    false;
  const effectiveCanViewDailyEarnings = isSubAgent || canViewDailyEarnings;
    
  const { currentPackage, fetchCurrentPackage } = useAgentPackageStore();

  useEffect(() => {
    if (!isSubAgent && !currentPackage) {
      fetchCurrentPackage();
    }
  }, [isSubAgent, currentPackage, fetchCurrentPackage]);

  const packageRates = useMemo(() => {
    if (isSubAgent) return {};
    return currentPackage?.package?.features?.ggrRates || {};
  }, [isSubAgent, currentPackage]);

  const currentEarnings = (earnings || []).slice(
    ((earningsPage - 1) * itemsPerPage),
    (earningsPage * itemsPerPage),
  );

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-64 bg-[#191D24] rounded-xl border border-gray-800" />
      </div>
    );
  }
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Earnings Table Section */}
      <div className="bg-[#191D24] border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800 bg-black/10">
          <div className="w-8 h-8 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <TrendingUp size={14} className="text-green-500" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-3">
              <p className="text-[11px] font-bold text-white uppercase">
                Daily Earnings Overview
              </p>
              {!effectiveCanViewDailyEarnings && (
                <FeatureBadge />
              )}
            </div>
            <p className="text-[11px] text-gray-600 font-bold uppercase">
              Recent bet-by-bet commission records
            </p>
          </div>
        </div>

        <div className="p-0 lg:min-h-[300px]">
          <div className="bg-[#191D24] overflow-hidden">
            {/* Table Header — Desktop */}
            <div className="hidden lg:grid grid-cols-[1fr_1.1fr_0.8fr_1fr_0.8fr_0.9fr] gap-3 px-5 py-3 bg-black/20 border-b border-gray-800">
              <span className="text-[10px] font-bold text-gray-500 uppercase">
                Date
              </span>
              <span className="text-[10px] font-bold text-gray-500 uppercase">
                Player
              </span>
              <span className="text-[10px] font-bold text-gray-500 uppercase text-right">
                Bet (B)
              </span>
              <span className="text-[10px] font-bold text-gray-500 uppercase text-right">
                User Win/Loss
              </span>
              <span className="text-[10px] font-bold text-yellow-500/80 uppercase text-right">
                GGR
              </span>
              <span className="text-[10px] font-bold text-green-500 uppercase text-right">
                Commission
              </span>
            </div>
            
            {/* Mobile Header */}
            <div className="grid lg:hidden grid-cols-[1fr_0.8fr_0.8fr_0.8fr] gap-3 px-5 py-3 bg-black/20 border-b border-gray-800">
              <span className="text-[10px] font-bold text-gray-500 uppercase">
                Player
              </span>
              <span className="text-[10px] font-bold text-gray-500 text-right uppercase">
                Bet
              </span>
              <span className="text-[10px] font-bold text-yellow-500/80 text-right uppercase">
                GGR
              </span>
              <span className="text-[10px] font-bold text-green-500 text-right uppercase">
                Comm.
              </span>
            </div>

            <FeatureGate allowed={effectiveCanViewDailyEarnings} showHeader={false}>
              {earnings.length === 0 ? (
                <div className="py-12">
                  <EmptyStatePage
                    title="No Earnings Yet"
                    description="Your network hasn't generated any commission yet."
                    image={notfound}
                    imageWidth={140}
                    imageHeight={70}
                  />
                </div>
              ) : (
                <>
                  <div className="divide-y divide-gray-800/60 lg:min-h-[400px]">
                    {currentEarnings.map((record) => {
                      const B = Number(record.wagerAmount);
                      const np = Number(record.netProfit);
                      const displayCommissionPercent = getDisplayCommissionPercent(record);
                      const platformPL = -np;
                      const grossAmount = getPlatformGrossAmount(record);
                      const cat = record.gameType || record.category || "";
                      let pkgRate = 0;
                      
                      if (cat) {
                        const slugU = cat.toLowerCase().replace(/[^a-z0-9]+/g, '_');
                        const slugD = cat.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                        pkgRate = packageRates[cat] || packageRates[cat.toLowerCase()] || packageRates[slugU] || packageRates[slugD] || 0;
                      }

                      const rawCommission = Number(record.commissionAmount || 0);
                      const bonusAmount = Number(record.deductionAmount || 0);
                      const bonusRate = Number(record.deductionPercent || 0);

                      // SUB_AGENT-source earnings: the agent earns the full gross rate
                      // (record.grossPercent) and the sub-agent's cut (deductionPercent)
                      // is funded out of it, leaving the net (commissionPercent). Show it
                      // as a subtraction, not an additive plan bonus.
                      const earningSource = (record as any).source || "";
                      const isSubAgentEarning = earningSource === "SUB_AGENT";
                      const grossRate = Number((record as any).grossPercent || 0);

                      // bonusRate (deductionPercent) > 0 means this is a new record where
                      // commissionAmount already includes the plan bonus (positive or negative).
                      // bonusAmount (deductionAmount) can be negative for player-win records,
                      // so we use bonusRate as the "new record" indicator, not bonusAmount.
                      const packageCommissionBonus = bonusRate > 0
                        ? bonusAmount
                        : (!isSubAgent && pkgRate > 0 ? grossAmount * (pkgRate / 100) : 0);

                      const totalCommissionAmount = bonusRate > 0
                        ? rawCommission
                        : (rawCommission + packageCommissionBonus);

                      const baseCommissionPercent = bonusRate > 0 
                        ? (Number(record.commissionPercent) || 0)
                        : displayCommissionPercent;
                        
                      const effectivePkgRate = bonusRate > 0 ? bonusRate : pkgRate;
                      
                      const platPos = platformPL > 0;
                      const userWon = np > 0;

                      return (
                        <div
                          key={record.id}
                          className="grid lg:grid-cols-[1fr_1.1fr_0.8fr_1fr_0.8fr_0.9fr] grid-cols-[1fr_0.8fr_0.8fr_0.8fr] gap-3 px-5 py-4 items-center hover:bg-white/[0.02] transition-colors"
                        >
                          {/* Date */}
                          <div className="hidden lg:block">
                            <span className="text-[11px] font-bold text-gray-400">
                              {format(parseISO(record.createdAt), "MMM dd, yyyy")}
                            </span>
                            <p className="text-[11px] text-gray-600 mt-0.5">
                              {format(parseISO(record.createdAt), "HH:mm")}
                            </p>
                          </div>

                          {/* Player */}
                          <div>
                            <p className="text-sm font-bold text-white truncate max-w-[120px]">
                              {record.referee?.username || record.refereeId.slice(0, 8)}
                            </p>
                            {cat && (
                              <p className="text-[11px] text-gray-500 font-bold uppercase truncate max-w-[100px] mt-0.5">
                                {cat}
                              </p>
                            )}
                          </div>

                          {/* Bet Column */}
                          <div className="text-right">
                            <span className="text-[11px] font-bold text-gray-300 font-mono">
                              {B.toFixed(2)}
                            </span>
                          </div>

                          {/* User Win/Loss (Net) */}
                          <div className="text-right hidden lg:block">
                            <span
                              className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded ${
                                userWon
                                  ? "text-green-400 bg-green-500/10"
                                  : "text-red-400 bg-red-500/10"
                              }`}
                            >
                              {np > 0 ? "+" : ""}
                              {np.toFixed(2)}
                            </span>
                          </div>

                          {/* GGR Column */}
                          <div className="text-right">
                            <span
                              className={`text-[12px] font-bold font-mono ${platPos ? "text-orange-500" : "text-red-500"}`}
                            >
                              {grossAmount > 0 ? "+" : ""}
                              {grossAmount.toFixed(2)}
                            </span>
                          </div>

                          {/* Commission Reward */}
                          <div className="text-right flex flex-col items-end gap-0.5">
                            <span
                              className={`text-[13px] font-bold tracking-tight ${
                                totalCommissionAmount > 0
                                  ? "text-green-400"
                                  : totalCommissionAmount < 0
                                    ? "text-red-400"
                                    : "text-gray-400"
                              }`}
                            >
                              {totalCommissionAmount > 0 ? "+" : totalCommissionAmount < 0 ? "-" : ""}
                              {Math.abs(totalCommissionAmount).toFixed(2)}
                            </span>
                            
                            {isSubAgentEarning ? (
                              <p className="text-[11px] font-bold text-gray-400 tracking-tight bg-white/5 px-1.5 py-0.5 rounded flex items-center justify-center gap-1">
                                {grossRate.toFixed(1)}% <span className="text-gray-600">−</span> <span className="text-red-400 font-bold">{bonusRate.toFixed(1)}%</span> <span className="text-gray-600">=</span> <span className="text-purple-400 font-bold">{baseCommissionPercent.toFixed(1)}%</span>
                              </p>
                            ) : !isSubAgent && effectivePkgRate > 0 ? (
                              <p className="text-[11px] font-bold text-gray-400 tracking-tight bg-white/5 px-1.5 py-0.5 rounded flex items-center justify-center gap-1">
                                {baseCommissionPercent.toFixed(1)}% <span className="text-gray-600">+</span> <span className="text-green-500 font-bold">{effectivePkgRate.toFixed(1)}%</span>
                              </p>
                            ) : (
                              <p className="text-[10px] text-gray-600 font-bold">
                                {baseCommissionPercent.toFixed(1)}%
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 bg-black/10 border-t border-gray-800">
                      <p className="text-[10px] text-gray-500 uppercase font-bold hidden sm:block">
                        Showing {((earningsPage - 1) * itemsPerPage + 1)} to{" "}
                        {Math.min((earningsPage * itemsPerPage), earnings.length)}{" "}
                        of {earnings.length} entries
                      </p>
                      <Pagination
                        currentPage={earningsPage}
                        totalPages={totalPages}
                        onPageChange={setEarningsPage}
                      />
                    </div>
                  )}
                </>
              )}
            </FeatureGate>
          </div>
        </div>
      </div>
    </div>
  );
}
