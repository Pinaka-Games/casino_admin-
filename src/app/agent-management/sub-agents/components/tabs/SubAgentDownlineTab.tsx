"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { User as UserIcon, Calendar } from "lucide-react";
import NoData from "@/components/NoData";
import { Skeleton } from "@/components/ui/skeleton";
import Pagination from "@/components/Pagination";
import { referralApi } from "@/api/referral/referral.api";
import { FeatureGate } from "@/app/agent-management/components/FeatureGate";
import { useFeatureAccess } from "@/hooks/use-feature-access";

const PAGE_SIZE = 10;

interface DownlineRow {
  refereeId: string;
  username: string;
  email: string;
  joinedAt: string;
  totalWagered: number;
  totalLoss: number;
  /**
   * LEDGER commission — SUM of commissionAmount actually credited for this
   * player's play (forfeits excluded, platform fee already taken at accrual).
   * The same basis as the Revenue tab, the Wallet tab, the sub-agent listing
   * and the commission ledger, so every surface reads one number per player.
   *
   * NOT `commissionDisplay` (rate × NGR): that formula deducts the 6%-of-stake
   * purchase fee, which is display-only and never charged to wallets, so it
   * showed roughly a third of what agents were really paid on cash play — and
   * flipped sign on some players (wallet +60, display −166).
   */
  totalIncome: number;
}

interface DownlineSummary {
  totalIncome: number;
  totalWagered: number;
  totalLoss: number;
}

/** Single source of truth for the five-column template — see the comment on
 *  the table below for why the header and the rows must share it. */
const ROW_GRID = "grid-cols-[1.5fr_1fr_1fr_1fr_1fr]";

export default function SubAgentDownlineTab({ subAgentId }: { subAgentId: string }) {
  const { canCreateSubAgent } = useFeatureAccess();
  const isGated = !canCreateSubAgent;

  const [rows, setRows] = useState<DownlineRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [summary, setSummary] = useState<DownlineSummary>({ totalIncome: 0, totalWagered: 0, totalLoss: 0 });

  const fetchDownline = useCallback(async () => {
    try {
        setLoading(true);
        const res = await referralApi.getAgentStatsById(subAgentId);
        const data = res.data;
        const referrals: DownlineRow[] = data.referrals || [];
        setRows(referrals);

        // Calculate summary from referrals
        const totals = referrals.reduce<DownlineSummary>((acc, curr) => ({
            totalIncome: acc.totalIncome + (curr.totalIncome || 0),
            totalWagered: acc.totalWagered + (curr.totalWagered || 0),
            totalLoss: acc.totalLoss + (curr.totalLoss || 0)
        }), { totalIncome: 0, totalWagered: 0, totalLoss: 0 });

        setSummary(totals);
    } catch (err) {
        console.error("Failed to fetch sub-agent downline:", err);
    } finally {
        setLoading(false);
    }
  }, [subAgentId]);

  useEffect(() => {
    if (subAgentId) {
      fetchDownline();
    }
  }, [subAgentId, fetchDownline]);

  const displayRows = useMemo(
    () =>
      [...rows].sort(
        (a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime(),
      ),
    [rows],
  );

  const totalPages = Math.ceil(displayRows.length / PAGE_SIZE);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return displayRows.slice(start, start + PAGE_SIZE);
  }, [displayRows, currentPage]);

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* SUMMARY CARDS */}
      <div className="relative">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#191D24] p-4 rounded-2xl border border-gray-800 shadow-sm transition-all hover:border-green-500/20 group">
                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1 group-hover:text-gray-400 transition-colors">Total Revenue (Loss)</p>
                <h3 className={`text-xl font-bold text-green-400 transition-all ${isGated ? 'blur-md select-none' : ''}`}>{summary.totalLoss.toFixed(2)}</h3>
            </div>
            <div className="bg-[#191D24] p-4 rounded-2xl border border-gray-800 shadow-sm transition-all hover:border-orange-500/20 group">
                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1 group-hover:text-gray-400 transition-colors">Sub-Agent Commission</p>
                <h3 className={`text-xl font-bold text-orange-400 transition-all ${isGated ? 'blur-md select-none' : ''}`}>{summary.totalIncome.toFixed(2)}</h3>
            </div>
            <div className="bg-[#191D24] p-4 rounded-2xl border border-gray-800 shadow-sm transition-all hover:border-purple-500/20 group">
                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1 group-hover:text-gray-400 transition-colors">Downline Players</p>
                <h3 className={`text-xl font-bold text-purple-400 transition-all ${isGated ? 'blur-md select-none' : ''}`}>{displayRows.length}</h3>
            </div>
        </div>
        
        {isGated && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                <div className="pointer-events-auto bg-[#191D24]/90 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full flex items-center gap-3 shadow-2xl">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Upgrade plan to see summary</span>
                    <button onClick={() => window.dispatchEvent(new CustomEvent('OPEN_PACKAGE_MODAL'))} className="bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full transition-all">Activate</button>
                </div>
            </div>
        )}
      </div>

      {/* TABLE */}
      <div className="bg-[#191D24] rounded-2xl border border-gray-800 overflow-hidden">
        {/* Header, skeleton row and data row are separate grid containers, so
            they only line up while they share one template — hence ROW_GRID.
            The floor plus horizontal scroll keeps all five columns readable on
            a phone; it is released at `lg`, where the layout already had the
            room, so desktop is unchanged. */}
        <div className="overflow-x-auto agent-x-scroll">
        <div className="min-w-[760px] lg:min-w-0">
        {/* Table Header — Always Visible */}
        <div className={`grid ${ROW_GRID} gap-3 sm:gap-4 px-4 sm:px-6 py-4 bg-[#15181E] border-b border-gray-800 shrink-0`}>
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Player Info</span>
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Join Date</span>
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Wagered</span>
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">GGR (Loss)</span>
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Commission</span>
        </div>

        <FeatureGate allowed={canCreateSubAgent} showHeader={false}>
            <div className="divide-y divide-gray-800/50">
                {loading ? (
                    Array.from({ length: PAGE_SIZE }).map((_, i) => (
                        <div key={`downline-skeleton-${i}`} className={`grid ${ROW_GRID} gap-3 sm:gap-4 px-4 sm:px-6 py-4 items-center`}>
                            <div className="flex items-center gap-3">
                                <Skeleton className="w-9 h-9 rounded-full bg-gray-700/40 shrink-0" />
                                <div className="space-y-1.5 flex-1">
                                    <Skeleton className="h-3 w-24 bg-gray-700/40" />
                                    <Skeleton className="h-2 w-32 bg-gray-700/30" />
                                </div>
                            </div>
                            <Skeleton className="h-3 w-24 bg-gray-700/40" />
                            <Skeleton className="h-3 w-16 bg-gray-700/40 ml-auto" />
                            <Skeleton className="h-3 w-16 bg-gray-700/40 ml-auto" />
                            <Skeleton className="h-3 w-16 bg-gray-700/40 ml-auto" />
                        </div>
                    ))
                ) : paginatedRows.length === 0 ? (
                    <div className="py-16"><NoData title="No players found in downline" /></div>
                ) : (
                    paginatedRows.map((row) => (
                        <div key={row.refereeId} className={`grid ${ROW_GRID} gap-3 sm:gap-4 px-4 sm:px-6 py-4 items-center hover:bg-white/5 transition-colors group`}>
                            <div className="flex items-center gap-3 truncate">
                                <div className="w-9 h-9 rounded-full bg-purple-600/20 flex items-center justify-center border border-white/5 shrink-0">
                                    <UserIcon size={16} className="text-purple-400" />
                                </div>
                                <div className="truncate">
                                    <div className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors truncate">{row.username}</div>
                                    <div className="text-[10px] text-gray-500 truncate">{row.email}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-gray-300 text-sm">
                                <Calendar size={14} className="text-gray-600" />
                                {format(new Date(row.joinedAt), "MMM dd, yyyy")}
                            </div>
                            <div className="text-right text-gray-300 text-sm font-medium">{row.totalWagered.toFixed(2)}</div>
                            <div className="text-right text-red-500/90 font-bold text-sm tracking-tighter">{row.totalLoss.toFixed(2)}</div>
                            <div className={`text-right font-black text-sm ${Number(row.totalIncome || 0) >= 0 ? "text-green-400" : "text-red-400"}`} title="Commission actually credited for this player's play (ledger).">{Number(row.totalIncome || 0).toFixed(2)}</div>
                        </div>
                    ))
                )}
            </div>
        </FeatureGate>
        </div>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center pt-2">
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      )}
    </div>
  );
}
