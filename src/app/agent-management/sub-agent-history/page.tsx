"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Search, Eye, Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NoData from "@/components/NoData";
import TableSkeleton from "@/components/TableSkeleton";
import Pagination from "@/components/Pagination";
import ExportCSV from "@/components/ExportCSV";
import CopyButton from "@/components/CopyButton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AgentFilterSheet, FilterState } from "@/app/agent-management/components/AgentFilterSheet";
import { profileApi } from "@/api/users/users";
import { FeatureGate } from "@/app/agent-management/components/FeatureGate";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useAgentPackageStore } from "@/store/agent-package.store";
import { useAuth } from "@/context/AuthContext";
import {
  PAGE_HEAD,
  PAGE_SHELL,
  PAGE_TITLE,
  TOOLBAR,
  TOOLBAR_SEARCH,
} from "@/app/agent-management/components/responsive";

const PAGE_SIZE = 10;

/** Column template for the pseudo-table below. The header and every row are
 *  separate grid containers, so they only stay aligned while they share this
 *  one string — inlining it in one place and not the other is exactly how the
 *  columns drift apart. */
/** Sentence-case row statuses — "SUCCESS" reads as "Paid" to an agent. */
const STATUS_TEXT: Record<string, string> = {
  SUCCESS: "Paid",
  REJECTED: "Rejected",
  PENDING: "Pending",
};

const ROW_GRID =
  "grid-cols-[120px_1fr_0.8fr_1fr_1fr_80px]";

export default function PayoutHistoryPage() {
  const { canViewPayoutHistory, canExportReports } = useFeatureAccess();
  const { currentPackage, fetchCurrentPackage } = useAgentPackageStore();
  const { hasRole } = useAuth();

  useEffect(() => {
    fetchCurrentPackage();
  }, [fetchCurrentPackage]);

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    status: "All",
    startDate: undefined,
    endDate: undefined
  });

  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const isAdmin = hasRole("ADMIN") || hasRole("superadmin") || hasRole("admin");

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const response = await profileApi.getSubHistory();
      setData(response.data || []);
    } catch (error) {
      console.error("Failed to fetch payout history:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filteredData = useMemo(() => {
    let result = [...data];
    if (search) {
      result = result.filter(item => 
        item.id.toLowerCase().includes(search.toLowerCase()) || 
        (item.subAgent?.username && item.subAgent.username.toLowerCase().includes(search.toLowerCase())) ||
        (item.username && item.username.toLowerCase().includes(search.toLowerCase()))
      );
    }
    
    if (filters.status !== "All") {
      result = result.filter(item => item.status === filters.status);
    }
    
    if (filters.startDate) {
      const start = new Date(filters.startDate).setHours(0, 0, 0, 0);
      result = result.filter(item => new Date(item.createdAt).getTime() >= start);
    }
    
    if (filters.endDate) {
      const end = new Date(filters.endDate).setHours(23, 59, 59, 999);
      result = result.filter(item => new Date(item.createdAt).getTime() <= end);
    }
    
    return result;
  }, [search, filters, data]);

  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredData.slice(start, start + PAGE_SIZE);
  }, [filteredData, currentPage]);

  const handleApplyFilters = (newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  return (
    <div className={PAGE_SHELL}>
      {/* HEADER BREADCRUMB */}
      <div className={PAGE_HEAD}>
        <h1 className={PAGE_TITLE}>Payout History</h1>
        <div className="shrink-0 whitespace-nowrap bg-green-500/10 text-green-500 px-2.5 py-1 rounded-full text-[11px] font-medium border border-green-500/20">
          {filteredData.length} Records
        </div>
      </div>

      <div className="flex flex-col gap-4 md:gap-6 md:flex-1 md:min-h-0">
        {/* TOOLBAR */}
        <div className={TOOLBAR}>
          <div className={TOOLBAR_SEARCH}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-purple-500 transition-colors" />
            <Input
              placeholder="Search Payout ID or account..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="bg-[#242B35]! border-none text-white placeholder:text-gray-500 text-sm h-10 pl-10 focus:ring-1 focus:ring-purple-500/30 font-medium"
            />
          </div>
          
          <Button
            onClick={() => setFilterOpen(true)}
            className={`h-10 w-10 p-0 bg-[#242B35] border-none text-gray-400 hover:text-white transition-all flex items-center justify-center shrink-0 ${
              filters.status !== "All" || filters.startDate || filters.endDate ? "border border-purple-500/50 text-purple-500" : ""
            }`}
          >
            <Sliders size={18} />
          </Button>

          <div className="hidden sm:block h-6 w-px bg-gray-800 mx-1" />

          <ExportCSV
            data={filteredData}
            locked={!canExportReports}
            lockedTitle="Upgrade plan to export"
            fileName="payout_history.csv"
            headers={["Payout ID", "Sub-Agent", "Amount", "Status", "Date"]}
            mapRow={(row) => [
              row.id, 
              row.subAgent?.username || row.username || 'N/A', 
              row.amount, 
              row.status, 
              new Date(row.createdAt).toLocaleString()
            ]}
            getRowDate={(row) => row.createdAt}
          />
        </div>

        <AgentFilterSheet
          open={filterOpen}
          onOpenChange={setFilterOpen}
          filters={filters}
          onApply={handleApplyFilters}
          title="Payout Filters"
          statusOptions={[
            { label: "All Status", value: "All" },
            { label: "Paid", value: "SUCCESS" },
            { label: "Rejected", value: "REJECTED" },
            { label: "Failed", value: "FAILED" }
          ]}
        />

        {/* DATA AREA */}
        <div className="flex flex-col md:flex-1 md:min-h-0 bg-[#191D24] rounded-xl border border-gray-800 overflow-x-auto agent-x-scroll">
            <div className="flex flex-col md:flex-1 md:min-h-0">
                {/* Table Header — Always Visible */}
                <div className={`grid ${ROW_GRID} gap-3 sm:gap-4 px-4 sm:px-6 py-3 bg-[#242B35] border-b border-gray-800 shrink-0 min-w-[900px] lg:min-w-0`}>
                    <span className="text-xs font-normal text-gray-300">Payout ID</span>
                    <span className="text-xs font-normal text-gray-300">Account</span>
                    <span className="text-xs font-normal text-gray-300">Amount</span>
                    <span className="text-xs font-normal text-gray-300">Status</span>
                    <span className="text-xs font-normal text-gray-300">Date</span>
                    <span className="text-xs font-normal text-gray-300 text-center">Action</span>
                </div>

                <FeatureGate allowed={canViewPayoutHistory} showHeader={false}>
                    <div className="md:flex-1 lg:overflow-y-auto scrollbar-hide min-w-[900px] lg:min-w-0">
                        <div className="divide-y divide-gray-800/30">
                        {loading ? (
                            <TableSkeleton rows={10} cols={6} />
                        ) : paginatedData.length === 0 ? (
                            <div className="py-20 text-center"><NoData title="No payout history found" /></div>
                        ) : (
                            paginatedData.map((row, index) => {
                                const dateObj = new Date(row.createdAt);
                                const dateStr = dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                                const timeStr = dateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

                                return (
                                    <div key={row.id} className={`grid ${ROW_GRID} gap-3 sm:gap-4 px-4 sm:px-6 py-4 items-center hover:bg-[#1a2030] transition-colors ${index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"}`}>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-gray-300 text-[11px] truncate font-medium uppercase font-mono">{row.id.slice(0, 8)}...</span>
                                            <CopyButton value={row.id} />
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-gray-300 text-xs font-medium truncate">{row.subAgent?.username || row.username || 'System'}</span>
                                            <CopyButton value={row.subAgent?.username || row.username || 'System'} />
                                        </div>
                                        <div className="text-orange-400 text-xs font-semibold tabular-nums">{(row.amount || 0).toLocaleString()}</div>
                                        <div>
                                            <span className={`inline-block text-[11px] font-medium whitespace-nowrap px-2 py-0.5 rounded-full border ${
                                            row.status === "SUCCESS" ? "bg-green-600/10 text-green-400 border-green-500/20" 
                                            : row.status === "REJECTED" ? "bg-red-600/10 text-red-400 border-red-500/20" 
                                            : "bg-gray-600/10 text-gray-400 border-gray-500/20"
                                            }`}>
                                            {STATUS_TEXT[row.status] ?? row.status}
                                            </span>
                                        </div>
                                        <div className="text-gray-300 text-[11px] leading-4 tabular-nums">
                                            <span className="block">{dateStr}</span>
                                            <span className="block text-gray-500">{timeStr}</span>
                                        </div>
                                        <div className="text-center">
                                            <button onClick={() => { setSelectedLog(row); setDetailOpen(true); }} className="p-2 bg-[#242B35] rounded-lg text-blue-400 hover:text-white transition-colors border border-gray-800 inline-flex items-center justify-center shrink-0"><Eye size={16} /></button>
                                        </div>
                                    </div>
                                );
                            })
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
          <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-gray-800 text-left">
            <DialogTitle className="text-base sm:text-lg font-semibold text-white">Payout Receipt</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="p-4 sm:p-6 space-y-4">
              <div className="bg-[#15181E] p-3 sm:p-4 rounded-xl border border-gray-800 space-y-4 shadow-inner">
                <div className="flex flex-col-reverse items-start gap-2 sm:flex-row sm:justify-between sm:items-start">
                   <div className="space-y-1 min-w-0 w-full sm:w-auto">
                      <p className="text-[11px] text-gray-500">Reference ID</p>
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-xs font-mono text-purple-400 truncate">{selectedLog.id}</p>
                        <CopyButton value={selectedLog.id} size={14} />
                      </div>
                   </div>
                   <span className={`shrink-0 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded ${selectedLog.status === "SUCCESS" ? "text-green-500 bg-green-500/5" : "text-red-500 bg-red-500/5"}`}>{selectedLog.status}</span>
                </div>
                <div className="h-px bg-gray-800" />
                <div className="bg-orange-500/5 p-5 rounded-lg border border-orange-500/10 flex flex-col items-center gap-1">
                  <span className="text-[11px] text-orange-200/60 uppercase tracking-wide">Settlement Amount</span>
                  <span className="text-2xl sm:text-3xl font-semibold tabular-nums text-orange-400">{(selectedLog.amount || 0).toLocaleString()}</span>
                </div>
                <div className="space-y-2">
                   <div className="flex justify-between gap-3 text-[11px]">
                      <span className="text-gray-500 shrink-0">Recipient</span>
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-white">{selectedLog.subAgent?.username || selectedLog.username || 'System'}</span>
                        <CopyButton value={selectedLog.subAgent?.username || selectedLog.username || 'System'} size={14} />
                      </div>
                   </div>
                   <div className="flex justify-between gap-3 text-[11px]">
                      <span className="text-gray-500 shrink-0">Timestamp</span>
                      <span className="text-gray-400 text-right">{new Date(selectedLog.updatedAt || selectedLog.createdAt).toLocaleString()}</span>
                   </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
