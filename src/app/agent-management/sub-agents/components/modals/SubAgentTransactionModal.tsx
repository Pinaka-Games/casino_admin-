"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Search } from "lucide-react";
import { X, Loader2, ArrowUpRight, Calendar, CircleDollarSign } from "lucide-react";
import NoData from "@/components/NoData";
import Pagination from "@/components/Pagination";
import { format } from "date-fns";
import DatePicker from "@/components/DatePicker";
import ModalPortal from "./ModalPortal";
import { profileApi } from "@/api/users/users";
import { EarningRecord } from "@/types/profile.type";
import CopyButton from "@/components/CopyButton";

const PAGE_SIZE = 10;

interface Props {
  open: boolean;
  onClose: () => void;
  subAgentId: string;
}

export default function SubAgentTransactionModal({ open, onClose, subAgentId }: Props) {
  const [rows, setRows] = useState<(EarningRecord & { refereeUsername: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await profileApi.getAgentEarningHistoryById(subAgentId);
      // Flatten the referee username for easy display
      const formatted = (res.data || []).map((row: EarningRecord) => ({
          ...row,
          refereeUsername: row.referee?.username || 'Anonymous',
          refereeId: row.refereeId || 'N/A'
      }));
      setRows(formatted);
    } catch (err) {
      console.error("Failed to fetch sub-agent transactions:", err);
    } finally {
      setLoading(false);
    }
  }, [subAgentId]);

  useEffect(() => {
    if (open && subAgentId) {
      fetchData();
    }
  }, [open, subAgentId, fetchData]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const date = new Date(row.createdAt);
      if (startDate && date < startDate) return false;
      if (endDate && date > endDate) return false;

      if (q) {
        const haystack = [row.id, row.gameLogId, row.refereeUsername, row.status]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [rows, startDate, endDate, search]);

  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  if (!open) return null;

  return (
    <ModalPortal onClose={onClose}>
      <div className="fixed inset-0 z-[9999] bg-[#15181E] animate-in fade-in">
        <div className="w-full h-full bg-[#15181E] flex flex-col overflow-hidden">
          {/* HEADER */}
          <div className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-5 shrink-0 border-b border-gray-800">
            <h2 className="text-white text-base sm:text-xl font-bold">Transaction History</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* FILTER BAR */}
          <div className="px-3 sm:px-8 mt-3 sm:mt-4 shrink-0">
            <div className="bg-[#191D24] border border-gray-800 rounded-2xl p-3 sm:p-4 flex flex-wrap items-center gap-3 sm:gap-6">
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">From</span>
                  <DatePicker date={startDate} onChange={setStartDate} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">To</span>
                  <DatePicker date={endDate} onChange={setEndDate} />
                </div>
              </div>
              <div className="relative min-w-[12rem] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  placeholder="Search entry, round or player"
                  className="h-11 w-full rounded-xl border border-gray-800 bg-[#1C2128] pl-9 pr-3 text-sm text-white placeholder:text-gray-600"
                />
              </div>
              <div className="sm:ml-auto text-[11px] font-bold text-gray-400 uppercase tracking-widest bg-[#1C2128] px-4 sm:px-5 py-2 sm:py-2.5 rounded-full border border-gray-800/50">
                Found <span className="text-purple-400 font-black">{filteredRows.length}</span> Records
              </div>
            </div>
          </div>

          {/* DATA TABLE */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-8 sm:pt-6 scrollbar-hide space-y-4">
            <div className="bg-[#191D24] rounded-2xl border border-gray-800 overflow-hidden shadow-inner">
              <div className="overflow-x-auto agent-x-scroll">
              <table className="w-full text-left border-collapse min-w-[800px] lg:min-w-0">
                <thead className="bg-[#15181E]/80 border-b border-gray-800">
                  <tr>
                    <th className="px-4 sm:px-6 py-4 sm:py-5 text-gray-400 font-bold uppercase text-[10px] tracking-[0.15em]">Logged At</th>
                    <th className="px-4 sm:px-6 py-4 sm:py-5 text-gray-400 font-bold uppercase text-[10px] tracking-[0.15em]">Type</th>
                    <th className="px-4 sm:px-6 py-4 sm:py-5 text-gray-400 font-bold uppercase text-[10px] tracking-[0.15em]">Ref. Player</th>
                    <th className="px-4 sm:px-6 py-4 sm:py-5 text-right text-gray-400 font-bold uppercase text-[10px] tracking-[0.15em]">Bet Amount</th>
                    <th className="px-4 sm:px-6 py-4 sm:py-5 text-right text-gray-400 font-bold uppercase text-[10px] tracking-[0.15em]">Earnings</th>
                    <th className="px-4 sm:px-6 py-4 sm:py-5 text-center text-gray-400 font-bold uppercase text-[10px] tracking-[0.15em]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-24 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <Loader2 className="h-10 w-10 animate-spin text-purple-500" />
                          <p className="text-gray-500 text-sm animate-pulse">Retrieving ledger data...</p>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-24">
                        <NoData title="No transaction history found" />
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row) => (
                      <tr key={row.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-gray-300 text-sm font-medium">
                            <Calendar size={14} className="text-gray-600" />
                            {format(new Date(row.createdAt), "MMM dd, HH:mm")}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500 border border-green-500/10 group-hover:bg-green-500/20 transition-all">
                              <ArrowUpRight size={16} />
                            </div>
                            <span className="text-sm font-bold text-white tracking-tight uppercase">Earning</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-gray-200 font-bold group-hover:text-purple-400 transition-colors">{row.refereeUsername}</p>
                            <CopyButton value={row.refereeUsername} size={14} />
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-gray-500 font-mono tracking-tighter uppercase opacity-60">ID: {row.refereeId.substring(0, 8)}</p>
                            <CopyButton value={row.refereeId} size={14} />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-gray-400 text-sm font-mono font-bold tracking-tighter">{row.wagerAmount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 text-green-400 font-black text-sm font-mono tracking-tighter">
                            +{row.commissionAmount.toLocaleString()}
                            <CircleDollarSign size={14} className="text-green-500/30" />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                            row.status === "UNCLAIMED"
                              ? "bg-yellow-500/5 text-yellow-500 border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.05)]"
                              : "bg-green-500/5 text-green-500 border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.05)]"
                          }`}>
                            {row.status}
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
