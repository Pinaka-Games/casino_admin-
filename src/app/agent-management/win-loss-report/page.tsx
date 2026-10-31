"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Search, Eye, FilterX } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DatePicker from "@/components/DatePicker";
import NoData from "@/components/NoData";
import Pagination from "@/components/Pagination";
import ExportCSV from "@/components/ExportCSV";
import CopyButton from "@/components/CopyButton";
import TableSkeleton from "@/components/TableSkeleton";
import { reportsApi, PlayerWinLossRow } from "@/api/reports/reports";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useAgentPackageStore } from "@/store/agent-package.store";
import {
  FeatureGate,
} from "@/app/agent-management/components/FeatureGate";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PAGE_HEAD,
  PAGE_SHELL,
  PAGE_TITLE,
} from "@/app/agent-management/components/responsive";

const PAGE_SIZE = 10;

/** Column template for the pseudo-table below. The header and every row are
 *  separate grid containers, so they only stay aligned while they share this
 *  one string — inlining it in one place and not the other is exactly how the
 *  columns drift apart. */
const ROW_GRID =
  "grid-cols-[1.5fr_1fr_1fr_1fr_1fr_80px]";

export default function WinLossReportPage() {
  const { user: authUser, hasRole } = useAuth();
  const { canViewWinLoss, canExportReports } = useFeatureAccess();
  const { currentPackage, fetchCurrentPackage } = useAgentPackageStore();

  useEffect(() => {
    fetchCurrentPackage();
  }, [fetchCurrentPackage]);

  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [reports, setReports] = useState<PlayerWinLossRow[]>([]);

  const [selectedReport, setSelectedReport] = useState<PlayerWinLossRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const isAdmin = hasRole("ADMIN") || hasRole("superadmin") || hasRole("admin");

  useEffect(() => {
    fetchWinLossReport();
  }, [startDate, endDate, canViewWinLoss, isAdmin]);

  const fetchWinLossReport = async () => {
    try {
      setLoading(true);
      // Only skip fetch if NOT admin and NO access
      if (!canViewWinLoss) {
         setReports([]);
         setLoading(false);
         return;
      }

      const response = await reportsApi.getPlayerWinLossReport({
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        search,
      });
      setReports(response.data || []);
    } catch (error) {
      console.error("Failed to fetch win-loss report:", error);
      toast.error("Failed to load win-loss report");
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    let result = [...reports];
    if (search) {
      result = result.filter(item => 
        item.username.toLowerCase().includes(search.toLowerCase()) || 
        item.email.toLowerCase().includes(search.toLowerCase())
      );
    }
    return result;
  }, [search, reports]);

  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredData.slice(start, start + PAGE_SIZE);
  }, [filteredData, currentPage]);

  const resetFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setSearch("");
    setCurrentPage(1);
  };

  return (
    <div className={PAGE_SHELL}>
      {/* HEADER BREADCRUMB */}
      <div className={PAGE_HEAD}>
        <h1 className={PAGE_TITLE}>
          Agent Management / Win Loss Report
        </h1>
      </div>

      <div className="flex flex-col gap-4 md:gap-6 md:flex-1 md:min-h-0">
        {/* TOOLBAR */}
        <div className="bg-[#191D24] rounded-lg p-2 flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
          <div className="w-full md:flex-1 md:w-auto md:min-w-[200px] relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-purple-500 transition-colors" />
            <Input
              placeholder="Search by player name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="bg-[#242B35]! border-none text-white placeholder:text-gray-500 text-sm h-10 pl-10 focus:ring-1 focus:ring-purple-500/30 font-medium"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <DatePicker date={startDate} onChange={setStartDate} />
            <span className="text-gray-600 text-[10px] font-black uppercase">to</span>
            <DatePicker date={endDate} onChange={setEndDate} />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={resetFilters}
            className="h-10 bg-[#242B35] border-none hover:bg-[#2d3540] text-gray-400 font-bold px-4"
          >
            <FilterX size={14} className="mr-2" /> Reset
          </Button>

          <div className="h-6 w-px bg-gray-800 mx-1" />

          <ExportCSV
            data={filteredData}
            locked={!canExportReports}
            lockedTitle="Upgrade plan to export"
            fileName="win_loss_report.csv"
            headers={["Player", "Total Bet", "Total Win", "Net GGR (Loss)", "W/L Count"]}
            mapRow={(row) => [row.username, row.totalBet, row.totalWin, row.netLoss, `W:${row.winCount} L:${row.lossCount}`]}
            getRowDate={(row) => row.lastPlayed}
          />
        </div>

        {/* DATA SECTION */}
        <div className="flex flex-col md:flex-1 md:min-h-0 bg-[#191D24] rounded-xl border border-gray-800 overflow-x-auto agent-x-scroll">
            <div className="flex flex-col md:flex-1 md:min-h-0">
                {/* Table Header — Always Visible */}
                <div className={`grid ${ROW_GRID} gap-3 sm:gap-4 px-4 sm:px-6 py-3 bg-[#242B35] border-b border-gray-800 shrink-0 min-w-[900px] lg:min-w-0`}>
                    <span className="text-xs font-normal text-gray-300">Player</span>
                    <span className="text-xs font-normal text-gray-300 text-right">Total Bet</span>
                    <span className="text-xs font-normal text-gray-300 text-right">Total Win</span>
                    <span className="text-xs font-normal text-gray-300 text-right">Net GGR (Loss)</span>
                    <span className="text-xs font-normal text-gray-300">W/L Count</span>
                    <span className="text-xs font-normal text-gray-300 text-center">Action</span>
                </div>

                <FeatureGate allowed={canViewWinLoss} showHeader={false}>
                    <div className="md:flex-1 lg:overflow-y-auto scrollbar-hide min-w-[900px] lg:min-w-0">
                        <div className="divide-y divide-gray-800/30">
                        {loading ? (
                            <TableSkeleton rows={10} cols={6} />
                        ) : paginatedData.length === 0 ? (
                            <div className="py-20 text-center"><NoData title="No data found" /></div>
                        ) : (
                            paginatedData.map((row, index) => (
                            <div key={row.id} className={`grid ${ROW_GRID} gap-3 sm:gap-4 px-4 sm:px-6 py-4 items-center hover:bg-[#1a2030] transition-colors border-b border-gray-800/30 ${index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"}`}>
                                <div className="truncate">
                                    <div className="flex items-center gap-1.5">
                                        <div className="text-gray-300 text-xs font-bold uppercase truncate">{row.username}</div>
                                        <CopyButton value={row.username} />
                                    </div>
                                    <div className="text-[10px] text-gray-500 lowercase truncate">{row.email}</div>
                                </div>
                                <div className="text-gray-300 text-xs font-mono font-bold text-right">{row.totalBet.toLocaleString()}</div>
                                <div className="text-gray-300 text-xs font-mono text-right">{row.totalWin.toLocaleString()}</div>
                                <div className={`text-xs font-black font-mono tracking-tighter text-right ${row.netLoss > 0 ? "text-red-400" : "text-green-500"}`}>
                                    {row.netLoss.toLocaleString()}
                                </div>
                                <div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-green-500 text-[10px] font-black">W:{row.winCount}</span>
                                        <span className="text-red-500 text-[10px] font-black">L:{row.lossCount}</span>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <button onClick={() => { setSelectedReport(row); setDetailOpen(true); }} className="text-gray-400 hover:text-white transition-colors bg-[#242B35] p-2 rounded-lg border border-gray-800 inline-flex items-center justify-center"><Eye size={16} /></button>
                                </div>
                            </div>
                            ))
                        )}
                        </div>
                    </div>
                    {totalPages > 1 && (
                        <div className="sticky left-0 p-4 bg-black/10 border-t border-gray-800 agent-safe-bottom">
                        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                        </div>
                    )}
                </FeatureGate>
            </div>
        </div>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-[#191D24] text-white border-gray-800 w-[calc(100vw-1.5rem)] max-w-sm p-0 overflow-hidden rounded-xl shadow-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader className="p-6 pb-2 border-b border-gray-800 text-left">
            <DialogTitle className="text-base sm:text-lg font-semibold text-white">Player Performance Analytics</DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <div className="p-4 sm:p-6 space-y-4">
                {/* `justify-end` used to push the name and email to the right of
                    their own column, away from the avatar they belong to. */}
                <div className="flex items-center gap-3 sm:gap-4">
                   <div className="w-12 h-12 shrink-0 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                      <span className="text-purple-400 font-semibold uppercase text-xl">{selectedReport.username.charAt(0)}</span>
                   </div>
                   <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="text-sm font-semibold text-white truncate">{selectedReport.username}</h3>
                        <CopyButton value={selectedReport.username} size={14} />
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-[11px] text-gray-500 truncate">{selectedReport.email}</p>
                        <CopyButton value={selectedReport.email} size={14} />
                      </div>
                   </div>
                </div>
                <div className="h-px bg-gray-800" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   <div className="bg-black/20 p-3 rounded-lg border border-gray-800/50">
                      <p className="text-[11px] text-gray-500 mb-1">Total Wager</p>
                      <p className="text-sm font-semibold tabular-nums text-white">{selectedReport.totalBet.toLocaleString()}</p>
                   </div>
                   <div className="bg-black/20 p-3 rounded-lg border border-gray-800/50 text-right">
                      <p className="text-[11px] text-gray-500 mb-1">Total Payout</p>
                      <p className="text-sm font-semibold tabular-nums text-green-400">{selectedReport.totalWin.toLocaleString()}</p>
                   </div>
                </div>
                <div className={`p-4 rounded-lg border flex flex-col items-center gap-1 ${selectedReport.netLoss > 0 ? "bg-red-500/5 border-red-500/20" : "bg-green-500/5 border-green-500/20"}`}>
                    <p className="text-[11px] text-gray-500 uppercase tracking-wide">Net Revenue (GGR)</p>
                    <p className={`text-2xl font-semibold tabular-nums ${selectedReport.netLoss > 0 ? "text-red-400" : "text-green-500"}`}>
                      {selectedReport.netLoss.toLocaleString()}
                    </p>
                </div>
                <div className="pt-2 text-center">
                   <p className="text-[11px] text-gray-500">Last activity: {new Date(selectedReport.lastPlayed).toLocaleDateString()}</p>
                </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
