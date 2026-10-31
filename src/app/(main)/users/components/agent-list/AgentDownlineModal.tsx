"use client";

import React, { useMemo, useState, useEffect } from "react";
import { format, parseISO, isSameDay } from "date-fns";
import { X, User as UserIcon, Calendar, CircleDollarSign, Loader2, Download, FilterX } from "lucide-react";
import UsDateInput from "@/components/UsDateInput";
import { Search } from "lucide-react";
import NoData from "@/components/NoData";
import { Skeleton } from "@/components/ui/skeleton";
import Pagination from "@/components/Pagination";
import ExportCSV from "@/components/ExportCSV";
import { profileApi } from "@/api/users/users";
import { ReferralDetail, ReferralStats } from "@/types/profile.type";

const PAGE_SIZE = 10;

interface Props {
  open: boolean;
  onClose: () => void;
  agentId: string;
}

export default function AgentDownlineModal({ open, onClose, agentId }: Props) {
  const [currentPage, setCurrentPage] = useState(1);
  const [rows, setRows] = useState<ReferralDetail[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open && agentId) {
      fetchDownline();
    }
  }, [open, agentId]);

  const fetchDownline = async () => {
    try {
      setLoading(true);
      const res = await profileApi.getAgentReferralStatsById(agentId);
      setStats(res.data);
      setRows(res.data.referrals || []);
    } catch (err) {
      console.error("Failed to fetch downline", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  /* ============================
     FILTER & SORTING logic
  ============================ */
  const displayRows = useMemo(() => {
    let result = [...rows];

    // 1. Sort by joinedAt descending (Latest First)
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

    // 3. Free-text match on the player's own identifiers
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((item) =>
        [item.username, item.email]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }

    return result;
  }, [rows, dateFilter, search]);

  /* ============================
     PAGINATION
  ============================ */
  const totalPages = Math.ceil(displayRows.length / PAGE_SIZE);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return displayRows.slice(start, start + PAGE_SIZE);
  }, [displayRows, currentPage]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-[#15181E] animate-in fade-in duration-300">
      <div className="w-full h-full bg-[#15181E] flex flex-col relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1" />

        {/* HEADER */}
        <div className="flex items-center justify-between gap-3 px-4 py-4 shrink-0 border-b border-gray-800 md:px-8 md:py-5">
          <div>
            <h2 className="text-white text-xl font-black tracking-tight uppercase">Agent Downline</h2>
            <p className="text-gray-500 text-[10px] mt-0.5">Manage and track referred players for this agent.</p>
          </div>

          <div className="flex items-center gap-4">
            {/* EXPORT */}
            <ExportCSV
              data={rows}
              fileName={`downline_${agentId.substring(0,8)}.csv`}
              headers={[
                "Username",
                "Email",
                "Total Wagered",
                "Net Loss",
                "Commission",
                "Joined At",
              ]}
              mapRow={(row) => [
                row.username,
                row.email || "N/A",
                row.totalWagered,
                row.totalLoss,
                row.totalIncome,
                row.joinedAt,
              ]}
              getRowDate={(row) => row.joinedAt}
            />

            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all border border-white/5"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide md:p-8 md:space-y-8">
          {/* STATS SUMMARY - Premium Style */}
          {stats && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-4 md:gap-4">
              <StatCard
                title="Total Referrals"
                value={stats.totalReferrals.toString()}
                icon={<UserIcon size={18} className="text-purple-400" />}
              />
              <StatCard
                title="Total Earnings"
                // Lifetime ledger commission for the agent's whole team — the
                // agent dashboard's "Total Team Earnings". `totalEarnings` is
                // the wallet balance (what's still claimable), not all-time.
                value={Math.max(
                  0,
                  Number(stats.totalEarnedAllTime ?? stats.totalEarnings ?? 0) +
                    Number(stats.subAgentsEarnedAllTime ?? 0),
                ).toFixed(2)}
                icon={<CircleDollarSign size={18} className="text-green-400" />}
                sub="All-time"
              />
              <StatCard
                title="Pending Income"
                // Wallet withdrawable balance — what the agent can claim right
                // now, the same figure as their Wallet Ledger "Available
                // Balance". `pendingIncome` is a ledger bucket that stays 0
                // once earnings have been released to the wallet.
                value={Number(stats.availableBalance ?? stats.pendingIncome ?? 0).toFixed(2)}
                icon={<Loader2 size={18} className="text-yellow-400" />}
                sub="Unclaimed"
              />
              <StatCard
                title="Total Claimed"
                value={stats.totalClaimed.toFixed(2)}
                icon={<Download size={18} className="text-blue-400" />}
              />
            </div>
          )}

          {/* TABLE SECTION */}
          <div className="space-y-4">
            {/* FILTER BAR */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="relative w-full md:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search username or email"
                    className="h-10 w-full rounded-xl border border-gray-800 bg-[#191D24] pl-9 pr-3 text-sm text-white placeholder:text-gray-600"
                  />
                </div>
                <div className="relative group">
                  <UsDateInput
                    value={dateFilter}
                    onChange={(iso) => {
                      setDateFilter(iso);
                      setCurrentPage(1); // Reset to first page on filter
                    }}
                    className="bg-[#191D24] border border-gray-800 text-gray-300 px-3 h-10 rounded-xl flex items-center w-full md:w-48"
                  />
                </div>
                {dateFilter && (
                  <button 
                    onClick={() => {
                      setDateFilter("");
                      setCurrentPage(1);
                    }}
                    className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
                  >
                    <FilterX size={14} />
                    Clear
                  </button>
                )}
              </div>

              <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest bg-[#191D24] px-4 py-2 rounded-full border border-gray-800">
                Found <span className="text-purple-500">{displayRows.length}</span> Matching Players
              </div>
            </div>

            <div className="bg-[#191D24] rounded-2xl border border-gray-800 overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left border-collapse">
                  <thead className="bg-[#15181E] border-b border-gray-800">
                    <tr>
                      <th className="px-6 py-4 text-gray-400 font-bold uppercase text-[10px] tracking-wider">Player Info</th>
                      <th className="px-6 py-4 text-gray-400 font-bold uppercase text-[10px] tracking-wider">Join Date</th>
                      <th className="px-6 py-4 text-right text-gray-400 font-bold uppercase text-[10px] tracking-wider">Wagered</th>
                      <th className="px-6 py-4 text-right text-gray-400 font-bold uppercase text-[10px] tracking-wider">GGR (Loss)</th>
                      <th className="px-6 py-4 text-right text-gray-400 font-bold uppercase text-[10px] tracking-wider">Commission</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-800/50">
                    {loading ? (
                      Array.from({ length: PAGE_SIZE }).map((_, i) => (
                        <tr key={`downline-skeleton-${i}`}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <Skeleton className="w-9 h-9 rounded-full bg-gray-700/40 shrink-0" />
                              <div className="space-y-1.5">
                                <Skeleton className="h-3 w-28 bg-gray-700/40" />
                                <Skeleton className="h-2 w-36 bg-gray-700/30" />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4"><Skeleton className="h-3 w-24 bg-gray-700/40" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-3 w-16 bg-gray-700/40 ml-auto" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-3 w-16 bg-gray-700/40 ml-auto" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-3 w-16 bg-gray-700/40 ml-auto" /></td>
                        </tr>
                      ))
                    ) : paginatedRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-24">
                          <NoData title="No players found in this downline" />
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((row) => (
                        <tr key={row.refereeId} className="hover:bg-white/5 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600/20 to-blue-600/20 flex items-center justify-center border border-white/5">
                                <UserIcon size={16} className="text-purple-400" />
                              </div>
                              <div>
                                <div className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">
                                  {row.username}
                                </div>
                                <div className="text-[10px] text-gray-500 font-medium">
                                  {row.email || "No email provided"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-gray-300 text-sm">
                              <Calendar size={14} className="text-gray-600" />
                              {row.joinedAt ? format(new Date(row.joinedAt), "MMM dd, yyyy") : "N/A"}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right text-gray-300 font-medium text-sm">
                            {Number(row.totalWagered).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-right text-red-500/90 font-bold text-sm">
                            {Number(row.totalLoss).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className={`flex items-center justify-end gap-2 font-black text-sm italic ${
                              Number(row.totalIncome) < 0 ? 'text-red-500' : 'text-green-400'
                            }`}>
                              {Number(row.totalIncome).toFixed(2)}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PAGINATION */}
            {totalPages > 1 && (
              <div className="flex justify-center pt-2">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= STAT CARD ================= */
const StatCard = ({
  title,
  value,
  icon,
  sub,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  sub?: string;
}) => {
  return (
    <div className="bg-[#15181E] rounded-2xl p-4 border border-gray-800/50 hover:border-gray-700 transition-all group md:p-6">
      <div className="flex justify-between items-start mb-4">
        <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">{title}</p>
        <div className="p-2 rounded-lg bg-gray-800/40 group-hover:bg-gray-800 transition-colors">
          {icon}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-x-2">
        <p className="text-white text-xl font-black tracking-tight md:text-2xl">{value}</p>
        {sub && <span className="text-[10px] text-gray-600 font-bold uppercase mb-1.5">{sub}</span>}
      </div>
    </div>
  );
}
