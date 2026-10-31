"use client";

import { useState, useMemo, useEffect } from "react";
import { format, parseISO, isSameDay } from "date-fns";
import { Calendar, FilterX } from "lucide-react";
import { ReferralDetail } from "@/types/profile.type";
import { Input } from "@/components/ui/input";
import AgentDatePicker from "./AgentDatePicker";
import EmptyStatePage from "@/components/emptystatePage";
import { notfound } from "@/assets/icons";
import Pagination from "@/components/Pagination/Pagination";
import { FeatureGate } from "./FeatureGate";
import { useFeatureAccess } from "@/hooks/use-feature-access";

interface DownlineTableProps {
  referrals: ReferralDetail[];
  isLoading: boolean;
  /** Rendered inline with the filter bar so both share one row. */
  heading?: React.ReactNode;
}

// The header and EVERY data row are separate grid containers, so the columns
// only line up if all of them resolve to identical widths. A bare `1.4fr` means
// `minmax(auto, 1.4fr)`, and that `auto` floor is the min-content of whatever
// sits in the column — so any cell wider than its share silently widens the
// column in ONE grid and not the others. That is what knocked the header out of
// step with the data: unbreakable labels like "COMMISSION" and "PLATFORM FEE"
// are wider than their fr share, so the header grid resolved wider columns than
// the rows below it and every value drifted left of its heading.
//
// minmax(0, …) drops the min-content floor, making the fr share authoritative
// in all twelve columns of all grids. Keep these two constants the single
// source of truth — inlining the template in one place and not the other is
// exactly how the drift comes back.
const DESKTOP_GRID =
  "grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.5fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]";

const TABLE_MIN_WIDTH = "min-w-[1180px]";

export function DownlineTable({ referrals, isLoading, heading }: DownlineTableProps) {
  const [dateFilter, setDateFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 8;
  const { canCreateSubAgent } = useFeatureAccess();

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter, referrals.length]);

  // Memoized filtered and sorted referrals
  const displayReferrals = useMemo(() => {
    let result = [...referrals];

    // 1. Sort by joinedAt descending (Latest Top)
    result.sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());

    // 2. Filter by date if selected
    if (dateFilter) {
      result = result.filter(item => {
        try {
          const itemDate = parseISO(item.joinedAt);
          const filterDate = parseISO(dateFilter);
          return isSameDay(itemDate, filterDate);
        } catch (e) {
          return true;
        }
      });
    }

    return result;
  }, [referrals, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(displayReferrals.length / itemsPerPage));
  const paginatedReferrals = displayReferrals.slice(
    (currentPage - 1) * itemsPerPage,
    (currentPage * itemsPerPage)
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 w-full bg-white/5 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* FILTER BAR — heading left, date filter right, one row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
        {heading}
        <div className="flex items-center gap-3">
          <div className="relative group">
            <AgentDatePicker
              value={dateFilter}
              onChange={(iso) => setDateFilter(iso)}
              className="bg-[#191D24] border border-white/5 text-gray-300 px-3 h-10 rounded-xl flex items-center w-full md:w-48"
            />
          </div>
          {dateFilter && (
            <button 
              onClick={() => setDateFilter("")}
              className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
            >
              <FilterX size={14} />
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="bg-[#191D24] rounded-xl border border-gray-800 overflow-hidden relative">
        {/* Scrolls horizontally instead of crushing the twelve columns into the
            wrapper's overflow-hidden, which used to clip the trailing NGR column. */}
        <div className="overflow-x-auto agent-x-scroll">
          <div className={TABLE_MIN_WIDTH}>
          {/* Table Header */}
          <div className={`grid ${DESKTOP_GRID} gap-3 px-5 py-3 bg-black/20 border-b border-gray-800`}>
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Player Identity</span>
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Referral Code</span>
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Create Date</span>
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Referred Via</span>
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest text-center">Bets</span>
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest text-right">Wagered</span>
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest text-right">Win/Loss</span>
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest text-right">GGR</span>
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest text-right" title="Bonus granted to this referee's play.">Bonus</span>
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest text-right" title="Platform fees deducted.">Platform Fee</span>
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest text-right" title="Commission charged on NGR (display figure). Real-time payouts are unchanged.">Commission</span>
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest text-right" title="NGR = GGR − Purchase Fee − Platform Fee. GGR = stake − payout (house result); negative when players won. Purchase Fee = 6% of the real Wulf Cash this player staked in the period (bonus stake carries no fee). Commission = rate × NGR.">NGR</span>
          </div>

          <FeatureGate allowed={canCreateSubAgent} showHeader={false}>
            {displayReferrals.length === 0 ? (
                <div className="bg-[#191D24] p-12 rounded-[32px] border border-dashed border-white/5">
                    <EmptyStatePage 
                        title="No matches found"
                        description="Try adjusting your date filter or share your link to get more referrals."
                        image={notfound}
                        imageWidth={160}
                        imageHeight={80}
                    />
                </div>
            ) : (
                <>
                    {/* The 400px floor keeps the desktop card from jumping as pages
                        of 8 rows load. On a phone a short page (2–3 rows) left a
                        ~300px void under the last row, so the floor starts at lg. */}
                    <div className="divide-y divide-gray-800/60 lg:min-h-[400px]">
                        {paginatedReferrals.map((player) => (
                            <div
                                key={player.refereeId}
                                className={`grid ${DESKTOP_GRID} gap-3 px-5 py-4 items-center hover:bg-white/[0.02] transition-colors`}
                            >
                                {/* Player Identity */}
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[12px] font-bold text-white leading-tight truncate">
                                            {player.username}
                                        </span>
                                        <span className="text-[10px] text-gray-500 font-medium truncate mt-0.5">
                                            {player.email}
                                        </span>
                                    </div>
                                </div>

                                {/* Referral Code */}
                                <div className="flex items-center">
                                    <span className="text-[10px] font-bold text-purple-400 bg-purple-500/5 px-2 py-1 rounded border border-purple-500/10 uppercase tracking-tight shadow-sm">
                                        {player.referralCode || "---"}
                                    </span>
                                </div>

                                {/* Create Date */}
                                <div className="flex items-center gap-2 min-w-0">
                                    <Calendar size={12} className="text-purple-500/50 hidden sm:block shrink-0" />
                                    <span className="text-[10px] font-bold text-gray-400">
                                        {format(parseISO(player.joinedAt), "MMM dd, yyyy")}
                                    </span>
                                </div>

                                {/* Referred Via */}
                                <div className="flex flex-col min-w-0">
                                    {player.referredBySubAgent ? (
                                        <>
                                            <span className="text-[11px] font-bold text-orange-400 uppercase tracking-tight">Sub-Agent</span>
                                            <span className="text-[11px] font-bold text-white truncate">{player.referredBySubAgent}</span>
                                        </>
                                    ) : (
                                        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-tight mt-1">Direct</span>
                                    )}
                                </div>

                                {/* Total Bets */}
                                <div className="text-center">
                                    <span className="text-[11px] font-bold text-gray-300">
                                        {player.totalBets ?? 0}
                                    </span>
                                </div>

                                {/* Total Wagered */}
                                <div className="text-right">
                                    <span className="text-[11px] font-bold text-gray-300">
                                        {Number(player.totalWagered || 0).toFixed(2)}
                                    </span>
                                </div>

                                {/* Player Win/Loss (player perspective: + = player won,
                                    − = player lost). Loss shown in red, win in green. */}
                                <div className="text-right">
                                    <span className={`text-[11px] font-bold ${Number(player.userWinLoss || 0) < 0 ? "text-red-400" : "text-emerald-400"}`}>
                                        {Number(player.userWinLoss || 0) > 0 ? "+" : ""}
                                        {Number(player.userWinLoss || 0).toFixed(2)}
                                    </span>
                                </div>

                                {/* GGR = real house result + bonus staked (ledger-consistent). */}
                                <div className="text-right">
                                    <span className={`text-[11px] font-bold ${Number(player.ggrDisplay || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                        {Number(player.ggrDisplay || 0).toFixed(2)}
                                    </span>
                                </div>

                                {/* Bonus GRANTED to this referee — the same figure the
                                    Costs tile sums, and what the column tooltip promises.
                                    This used to show bonusDisplay (bonus STAKED in settled
                                    rounds), which stays 0.00 until the player wagers the
                                    grant — so the tile said "3.00 bonus" while every row
                                    read 0.00, which QA reported as "bonus not updating".
                                    Informational either way: bonus is not in GGR/NGR. */}
                                <div className="text-right">
                                    <span className="text-[11px] font-bold text-gray-300">
                                        {Number(player.bonusGranted ?? player.bonusDisplay ?? 0).toFixed(2)}
                                    </span>
                                </div>

                                {/* Platform Fee — the amount charged, and the RATE it was
                                    charged at (server-supplied). The rate must not be
                                    derived as fee ÷ GGR: on a sub-agent split round the
                                    fee covers only that earner's share of the GGR while
                                    the row carries the full round GGR, so the division
                                    showed a sub-agent "7.5%" where the configured
                                    platform fee was 10%. */}
                                <div className="text-right">
                                    {Number(player.platformFeeDisplay || 0) > 0 ? (
                                        <span className="text-[11px] font-bold text-red-400">
                                            −{Number(player.platformFeeDisplay || 0).toFixed(2)}
                                            {Number(player.platformFeePercentDisplay || 0) > 0 && (
                                                <span className="text-[11px] text-red-400/70 ml-1">
                                                    ({Number(player.platformFeePercentDisplay || 0).toFixed(1)}%)
                                                </span>
                                            )}
                                        </span>
                                    ) : (
                                        <span className="text-[11px] font-bold text-gray-300">0.00</span>
                                    )}
                                </div>

                                {/* Commission = LEDGER total for this player (SUM of
                                    commissionAmount, forfeits excluded) — the money that
                                    actually credited the wallet. commissionDisplay
                                    (rate × NGR) disagreed with the wallet and the
                                    commission ledger for the same player. */}
                                <div className="text-right">
                                    <span className={`text-[11px] font-semibold ${Number(player.totalIncome || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`} title="Commission actually credited for this player's play (ledger).">
                                        {Number(player.totalIncome || 0).toFixed(2)}
                                    </span>
                                </div>

                                {/* NGR = GGR − Purchase Fee − Platform Fee (bonus is
                                    already out of GGR). Purchase Fee = 6% of the real
                                    Wulf Cash staked in the period (per-round basis,
                                    product decision 2026-08-17). */}
                                <div className="text-right">
                                    <span className={`text-[11px] font-semibold ${Number(player.ngrDisplay || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                        {Number(player.ngrDisplay || 0).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* PAGINATION */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 bg-black/10 border-t border-gray-800">
                           <p className="text-[10px] text-gray-500 uppercase font-bold hidden sm:block">
                                Showing {((currentPage - 1) * itemsPerPage + 1)} to{" "}
                                {Math.min((currentPage * itemsPerPage), displayReferrals.length)}{" "}
                                of {displayReferrals.length} results
                           </p>
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={setCurrentPage}
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
