"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Search } from "lucide-react";
import { format, parseISO, isSameDay } from "date-fns";
import { X, User as UserIcon, Calendar, Loader2, FilterX } from "lucide-react";
import AgentDatePicker from "../../../components/AgentDatePicker";
import NoData from "@/components/NoData";
import Pagination from "@/components/Pagination";
import ModalPortal from "./ModalPortal";
import { referralApi } from "@/api/referral/referral.api";
import CopyButton from "@/components/CopyButton";

const PAGE_SIZE = 10;


interface Props {
  open: boolean;
  onClose: () => void;
  subAgentId: string;
}

interface DownlineRow {
  refereeId: string;
  username: string;
  email: string;
  joinedAt: string;
  totalWagered: number;
  totalLoss: number;
  /**
   * LEDGER commission — SUM of commissionAmount actually credited for this
   * player (forfeits excluded). The same field the sub-agent's own Downline
   * table now reads, so both sides show one number per player, and that number
   * matches the wallet. (Was commissionDisplay = rate × NGR, which deducts the
   * display-only 6% purchase fee and disagreed with every wallet figure.)
   */
  totalIncome: number;
}

export default function SubAgentDownlineModal({ open, onClose, subAgentId }: Props) {
  const [rows, setRows] = useState<DownlineRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchData = async () => {
      if (open && subAgentId) {
        try {
          setLoading(true);
          const res = await referralApi.getAgentStatsById(subAgentId);
          setRows(res.data.referrals || []);
        } catch (error) {
          console.error("Failed to fetch sub-agent downline:", error);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchData();
  }, [open, subAgentId]);

  const displayRows = useMemo(() => {
    let result = [...rows].sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());
    if (dateFilter) {
      result = result.filter((item) => {
        try { return isSameDay(parseISO(item.joinedAt), parseISO(dateFilter)); }
        catch { return true; }
      });
    }
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((item) =>
        [item.username, item.email].filter(Boolean).join(" ").toLowerCase().includes(q),
      );
    }
    return result;
  }, [rows, dateFilter, search]);

  const totalPages = Math.ceil(displayRows.length / PAGE_SIZE);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return displayRows.slice(start, start + PAGE_SIZE);
  }, [displayRows, currentPage]);

  if (!open) return null;

  return (
    <ModalPortal onClose={onClose}>
      <div className="fixed inset-0 z-[9999] bg-[#15181E] animate-in fade-in">
        <div className="w-full h-full bg-[#15181E] flex flex-col overflow-hidden">
          {/* HEADER */}
          <div className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5 shrink-0 border-b border-gray-800">
            <h2 className="text-white text-base sm:text-xl font-bold">Sub-Agent Downline</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-8 sm:pt-6 scrollbar-hide space-y-4 sm:space-y-6">
            {/* FILTER BAR */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 bg-[#191D24] border border-gray-800 rounded-2xl p-3 sm:p-4">
              <div className="relative min-w-[12rem] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  placeholder="Search username or email"
                  className="h-11 w-full rounded-xl border border-gray-800 bg-[#1C2128] pl-9 pr-3 text-sm text-white placeholder:text-gray-600"
                />
              </div>
              <div className="relative group flex-1 min-w-[9rem] max-w-full sm:max-w-xs">
                <AgentDatePicker
                  value={dateFilter}
                  onChange={(iso) => { setDateFilter(iso); setCurrentPage(1); }}
                  className="bg-[#1C2128] border border-gray-800 text-gray-300 px-3 h-11 rounded-xl flex items-center"
                />
              </div>
              {dateFilter && (
                <button
                  onClick={() => { setDateFilter(""); setCurrentPage(1); }}
                  className="px-4 h-11 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 flex items-center gap-2 text-xs font-bold uppercase transition-all"
                >
                  <FilterX size={14} /> Clear Filter
                </button>
              )}
              <div className="sm:ml-auto text-[11px] font-bold text-gray-400 uppercase tracking-widest bg-[#1C2128] px-4 sm:px-5 py-2 sm:py-2.5 rounded-full border border-gray-800/50">
                Found <span className="text-purple-400 font-black">{displayRows.length}</span> Members
              </div>
            </div>

            {/* DATA TABLE */}
            <div className="bg-[#191D24] rounded-2xl border border-gray-800 overflow-hidden shadow-inner">
              <div className="overflow-x-auto agent-x-scroll">
              <table className="w-full text-left border-collapse min-w-[720px] lg:min-w-0">
                <thead className="bg-[#15181E]/80 border-b border-gray-800">
                  <tr>
                    <th className="px-4 sm:px-6 py-4 sm:py-5 text-gray-400 font-bold uppercase text-[10px] tracking-[0.15em]">Member Info</th>
                    <th className="px-4 sm:px-6 py-4 sm:py-5 text-gray-400 font-bold uppercase text-[10px] tracking-[0.15em]">Joined At</th>
                    <th className="px-4 sm:px-6 py-4 sm:py-5 text-right text-gray-400 font-bold uppercase text-[10px] tracking-[0.15em]">Total Wagered</th>
                    <th className="px-4 sm:px-6 py-4 sm:py-5 text-right text-gray-400 font-bold uppercase text-[10px] tracking-[0.15em]">GGR (Net Loss)</th>
                    <th className="px-4 sm:px-6 py-4 sm:py-5 text-right text-gray-400 font-bold uppercase text-[10px] tracking-[0.15em]">Earnings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-24 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
                          <p className="text-gray-500 text-sm animate-pulse">Scanning downline database...</p>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-24">
                        <NoData title="No players found in this downline" />
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row) => (
                      <tr key={row.refereeId} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-600/10 flex items-center justify-center border border-purple-500/20 group-hover:bg-purple-600/20 transition-all">
                              <UserIcon size={18} className="text-purple-400" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors uppercase tracking-tight">{row.username}</div>
                                <CopyButton value={row.username} size={14} />
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-[10px] text-gray-500 font-medium">{row.email}</div>
                                <CopyButton value={row.email} size={14} />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-gray-300 text-sm font-medium">
                            <Calendar size={14} className="text-gray-600 shrink-0" />
                            {row.joinedAt ? format(new Date(row.joinedAt), "MMM dd, yyyy") : "N/A"}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-gray-300 text-sm font-bold font-mono tracking-tighter">{row.totalWagered.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right text-red-500/90 font-black text-sm font-mono tracking-tighter animate-pulse-slow">{row.totalLoss.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right">
                          <span
                            className={`font-black text-sm px-3 py-1 rounded-lg border tracking-tighter font-mono ${
                              Number(row.totalIncome || 0) >= 0
                                ? "text-green-400 bg-green-500/5 border-green-500/10"
                                : "text-red-400 bg-red-500/5 border-red-500/10"
                            }`}
                            title="Commission actually credited for this player's play (ledger)."
                          >
                            {Number(row.totalIncome || 0).toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center pt-2">
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
