"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Search, Eye, FilterX, Gamepad2 } from "lucide-react";
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
import { reportsApi, GameReportRow } from "@/api/reports/reports";
import {
  FeatureGate,
} from "@/app/agent-management/components/FeatureGate";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useAgentPackageStore } from "@/store/agent-package.store";
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
  "grid-cols-[1fr_1fr_1fr_1fr_1fr_80px]";

export default function GameReportPage() {
  const { user: authUser, hasRole } = useAuth();
  const { canViewAnalytics } = useFeatureAccess();
  const { currentPackage, fetchCurrentPackage } = useAgentPackageStore();

  useEffect(() => {
    fetchCurrentPackage();
  }, [fetchCurrentPackage]);

  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [gameLogs, setGameLogs] = useState<GameReportRow[]>([]);

  const [selectedLog, setSelectedLog] = useState<GameReportRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    fetchGameLogs();
  }, [startDate, endDate]);

  const fetchGameLogs = async () => {
    try {
      setLoading(true);
      const response = await reportsApi.getGameReport({
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
      });
      setGameLogs(response.data.items || []);
    } catch (error) {
      console.error("Failed to fetch game logs:", error);
      toast.error("Failed to load game report");
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    let result = [...gameLogs];
    if (search) {
      result = result.filter(item => 
        item.username.toLowerCase().includes(search.toLowerCase()) || 
        item.game.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (categoryFilter !== "All") result = result.filter(item => item.gameType === categoryFilter);
    return result;
  }, [search, categoryFilter, gameLogs]);

  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredData.slice(start, start + PAGE_SIZE);
  }, [filteredData, currentPage]);

  const resetFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setSearch("");
    setCategoryFilter("All");
    setCurrentPage(1);
  };

  const isAdmin = hasRole("ADMIN") || hasRole("superadmin") || hasRole("admin");

  return (
    <div className={PAGE_SHELL}>
      {/* HEADER BREADCRUMB */}
      <div className={PAGE_HEAD}>
        <h1 className={PAGE_TITLE}>
          Agent Management / Game Report
        </h1>
      </div>

      <div className="flex flex-col gap-4 md:gap-6 md:flex-1 md:min-h-0">
        {/* TOOLBAR */}
        <div className="bg-[#191D24] rounded-lg p-2 flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
          <div className="w-full md:flex-1 md:w-auto md:min-w-[200px] relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-purple-500 transition-colors" />
            <Input
              placeholder="Search game or player..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-[#242B35]! border-none text-white placeholder:text-gray-500 text-sm h-10 pl-10 focus:ring-1 focus:ring-purple-500/30 font-medium"
            />
          </div>

          <select
            className="bg-[#242B35] border-none rounded-md h-10 px-3 text-xs text-white outline-none cursor-pointer focus:ring-1 focus:ring-purple-500/30"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="All">All Categories</option>
            <option value="Slot">Slot Games</option>
            <option value="Crash">Crash Games</option>
            <option value="Live Casino">Live Casino</option>
          </select>

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
            locked={!canViewAnalytics}
            lockedTitle="Upgrade plan to export"
            fileName="game_report.csv"
            headers={["Game", "Category", "Player", "Bet", "Win", "Status"]}
            mapRow={(row) => [
              row.game,
              row.gameType,
              row.username,
              row.totalBetAmount,
              row.totalWin,
              row.status,
            ]}
            getRowDate={(row) => row.date}
            fetchAll={async (range) => {
              // Pull the COMPLETE matching dataset (all pages), not just the
              // default server page. Popover range overrides the toolbar dates.
              const fromDate = (range.from ?? startDate)?.toISOString();
              const toDate = (range.to ?? endDate)?.toISOString();
              const EXPORT_LIMIT = 500;
              const all: GameReportRow[] = [];
              let page = 1;
              // Safety valve: cap at 100 pages.
              for (let i = 0; i < 100; i++) {
                const res = await reportsApi.getGameReport({
                  startDate: fromDate,
                  endDate: toDate,
                  page,
                  limit: EXPORT_LIMIT,
                });
                all.push(...(res.data.items || []));
                if (all.length >= res.data.total || (res.data.items || []).length === 0) break;
                page += 1;
              }
              // Replicate the page's client-side search + category filters.
              return all.filter((item) => {
                const matchesSearch =
                  !search ||
                  item.username.toLowerCase().includes(search.toLowerCase()) ||
                  item.game.toLowerCase().includes(search.toLowerCase());
                const matchesCategory =
                  categoryFilter === "All" || item.gameType === categoryFilter;
                return matchesSearch && matchesCategory;
              });
            }}
          />
        </div>

        {/* DATA SECTION */}
        <div className="flex flex-col md:flex-1 md:min-h-0 bg-[#191D24] rounded-xl border border-gray-800 overflow-x-auto agent-x-scroll">
            <div className="flex flex-col md:flex-1 md:min-h-0">
                {/* Table Header — Always Visible */}
                <div className={`grid ${ROW_GRID} gap-3 sm:gap-4 px-4 sm:px-6 py-3 bg-[#242B35] border-b border-gray-800 shrink-0 min-w-[900px] lg:min-w-0`}>
                    <span className="text-xs font-normal text-gray-300">Game Info</span>
                    <span className="text-xs font-normal text-gray-300">Player</span>
                    <span className="text-xs font-normal text-gray-300 text-right">Bet Amount</span>
                    <span className="text-xs font-normal text-gray-300 text-right">Payout</span>
                    <span className="text-xs font-normal text-gray-300">Status</span>
                    <span className="text-xs font-normal text-gray-300 text-center">Action</span>
                </div>

                <FeatureGate allowed={canViewAnalytics} showHeader={false}>
                    <div className="md:flex-1 lg:overflow-y-auto scrollbar-hide min-w-[900px] lg:min-w-0">
                        <div className="divide-y divide-gray-800/30">
                        {loading ? (
                            <TableSkeleton rows={10} cols={6} />
                        ) : paginatedData.length === 0 ? (
                            <div className="py-20 text-center"><NoData title="No game logs found" /></div>
                        ) : (
                            paginatedData.map((row, index) => (
                            <div key={row.betId} className={`grid ${ROW_GRID} gap-3 sm:gap-4 px-4 sm:px-6 py-4 items-center hover:bg-[#1a2030] transition-colors border-b border-gray-800/30 ${index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"}`}>
                                <div className="flex items-center gap-2 min-w-0">
                                    <Gamepad2 size={14} className="text-purple-500/50 shrink-0" />
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <p className="text-gray-300 text-xs font-bold uppercase truncate">{row.game}</p>
                                            <CopyButton value={row.betId} />
                                        </div>
                                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest truncate">{row.gameType}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 text-gray-400 text-xs font-black uppercase font-mono min-w-0">
                                    <span className="truncate">{row.username}</span>
                                    <CopyButton value={row.username} />
                                </div>
                                <div className="text-gray-300 text-xs font-mono font-bold text-right">{row.totalBetAmount.toLocaleString()}</div>
                                <div className="text-green-400 text-xs font-mono font-black text-right">{row.totalWin.toLocaleString()}</div>
                                <div>
                                    <span className={`text-[10px] font-black uppercase tracking-tighter ${row.totalWin > row.totalBetAmount ? "text-green-500" : "text-red-500"}`}>{row.status}</span>
                                </div>
                                <div className="text-center">
                                    <button onClick={() => { setSelectedLog(row); setDetailOpen(true); }} className="text-gray-400 hover:text-white transition-colors bg-[#242B35] p-2 rounded-lg border border-gray-800 inline-flex items-center justify-center"><Eye size={16} /></button>
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
            <DialogTitle className="text-base sm:text-lg font-semibold text-white">Game Audit Log</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="p-4 sm:p-6 space-y-4 min-w-0 w-full">
                <div className="flex justify-between items-center gap-3 text-[11px] text-gray-500 min-w-0">
                  <span className="shrink-0">Round ID</span>
                  <div className="flex items-center gap-2 min-w-0 max-w-[65%] sm:max-w-[75%]">
                    <span className="text-purple-400 font-mono text-xs select-all truncate min-w-0">#{selectedLog.roundId || "N/A"}</span>
                    <CopyButton value={selectedLog.roundId} size={14} className="shrink-0" />
                  </div>
                </div>
                <div className="h-px bg-gray-800" />
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1 min-w-0">
                    <p className="text-[11px] text-gray-500">Game</p>
                    <p className="text-xs font-medium text-white truncate">{selectedLog.game}</p>
                  </div>
                  <div className="space-y-1 min-w-0 text-right">
                    <p className="text-[11px] text-gray-500">Category</p>
                    <p className="text-xs font-medium text-gray-300 truncate">{selectedLog.gameType}</p>
                  </div>
                </div>
                <div className="bg-black/20 p-4 rounded-lg border border-gray-800/50 space-y-2">
                  <div className="flex justify-between items-center gap-3 text-[11px]">
                    <span className="text-gray-500">Wager</span>
                    <span className="text-white tabular-nums font-medium">{selectedLog.totalBetAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center gap-3 text-[11px]">
                    <span className="text-gray-500">Payout</span>
                    <span className="text-green-400 tabular-nums font-medium">{selectedLog.totalWin.toLocaleString()}</span>
                  </div>
                  <div className="h-px bg-gray-800/50" />
                  <div className="flex justify-between items-center gap-3 text-[11px]">
                    <span className="text-gray-500">Profit/Loss</span>
                    <span className={`tabular-nums font-semibold ${selectedLog.totalWin - selectedLog.totalBetAmount >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {(selectedLog.totalWin - selectedLog.totalBetAmount).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center gap-3 pt-1 text-[11px]">
                   <span className="text-gray-500 shrink-0">Player</span>
                   <div className="flex items-center gap-2 min-w-0">
                     <span className="text-purple-400 font-medium truncate">{selectedLog.username}</span>
                     <CopyButton value={selectedLog.username} size={14} />
                   </div>
                </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
