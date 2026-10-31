"use client";

import React, { useEffect } from "react";
import { Wrench, Activity, Target, ShieldCheck, History, CircleDollarSign, TrendingUp, TrendingDown, RefreshCw, Search, Filter } from "lucide-react";

import { formatStat } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import PlayerSummaryModal from "../components/winloss-viewmodel";
import ExportCSV from "@/components/ExportCSV";
import { format } from "date-fns";
import Pagination from "@/components/Pagination";
import NoData from "@/components/NoData";
import { useWinLossReportStore } from "@/store/win-loss-report-store";
import CurrencyToggle from "@/components/report/CurrencyToggle";
import { TableSkeletonRows, StatCardsSkeleton } from "@/components/report/ReportSkeleton";
import ReportFilterDrawer, { FilterField } from "@/components/report/ReportFilterDrawer";

/* ============================
   PAGE
 ============================ */
export default function WinLoseReportPage() {
  const {
    rows: reportData,
    summary,
    isLoading: loading,
    currentPage,
    pageSize: itemsPerPage,
    filters,
    filterOpen,
    openView,
    viewData,
    currency,
    fetchData,
    setPage: setCurrentPage,
    setFilters,
    setCurrency,
    setFilterOpen,
    setOpenView,
    setViewData,
  } = useWinLossReportStore();

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="h-full bg-[#15181E] p-3 md:p-6 space-y-4 md:space-y-6 overflow-y-auto w-full scrollbar-hide">
      <div className="flex flex-col gap-6">
        {/* HEADER */}
        <div className="bg-[#161A21] px-3 py-3 md:px-5 rounded-lg text-md font-mono font-semibold text-gray-100 border border-[#242B35]">
          Report / Win Loss Report
        </div>

        {/* FILTER BAR */}
        <div className="bg-[#191D24] p-3 md:p-4 rounded-xl border border-[#242B35] flex flex-wrap items-center gap-3 md:gap-4">
          <div className="flex items-center gap-3">
            <CurrencyToggle value={currency} onChange={setCurrency} />
            <span className="hidden md:inline text-xs text-gray-500">
              {currency === "wulfCash"
                ? "Real-money (Wulf Cash) figures"
                : "Virtual (Wulf Coins) figures"}
            </span>
          </div>
          {/* <div className="flex items-center gap-2">
            <Input
              placeholder="Search in Loss Report"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-[550px] bg-[#15181E] border-[#242B35] text-white text-xs h-10 placeholder:text-gray-500"
            />
            <Button
              size="icon"
              className="h-10 w-10 bg-[#15181E] border border-[#242B35] hover:bg-[#242b35]"
              onClick={handleSearch}
            >
              <Search size={16} className="text-gray-300" />
            </Button>
          </div> */}

          <div className="ml-auto flex gap-3">
            <Button
              variant="outline"
              className="px-4 bg-[#15181E] border-[#242B35] text-white hover:bg-[#242B35] h-10 flex items-center gap-2 rounded-lg"
              onClick={() => setFilterOpen(true)}
            >
              <Filter size={20} className="text-[#B93DEB]" />
              <span className="text-xs font-medium">Filter</span>
              {(filters.userStatus !== "all" || filters.parentId) && (
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 bg-[#15181E] border-[#242B35]"
              onClick={() => fetchData()}
              title="Refresh"
            >
              <RefreshCw size={16} className="text-gray-300" />
            </Button>
            <ExportCSV
              data={reportData}
              getRowDate={(row) => row.date}
              headers={[
                "Date",
                "Total Players",
                "Total Bets",
                "Total Bet Amt",
                "Total Win",
                "GGR",
                "Hold %",
              ]}
              mapRow={(row) => [
                format(new Date(row.date), "MMM dd, yyyy"),
                row.totalPlayers,
                row.totalBets,
                Number(row.totalBetAmt).toFixed(2),
                Number(row.totalWin).toFixed(2),
                Number(row.ggr).toFixed(2),
                (row.hold || 0).toFixed(2),
              ]}
              fileName="daily_win_loss_report.csv"
            />
          </div>
        </div>

        {/* SUMMARY CARDS */}
        {loading ? (
          <StatCardsSkeleton count={3} />
        ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 shrink-0">
          {/* Bet Amount */}
          <div className="rounded-xl border border-[#242B35] bg-[#191D24] p-4 md:p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-400 font-medium">
                  Bet Amount
                </p>
                <div className="mt-2 flex items-baseline gap-1">
                  {/* <span className="text-sm text-gray-500 font-medium">$</span> */}
                  <p className="text-2xl font-semibold tracking-tight text-white">
                    {formatStat(summary.totalBet)}
                  </p>
                </div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-[#242B35] text-[#3B82F6]">
                <Activity size={20} />
              </div>
            </div>
            {/* <div className="flex items-center gap-1 text-xs font-medium text-[#04AD37]">
              <TrendingUp size={12} />
              <span>all time</span>
            </div> */}
          </div>

          {/* Player Win */}
          <div className="rounded-xl border border-[#242B35] bg-[#191D24] p-4 md:p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-400 font-medium">
                  Player Win
                </p>
                <div className="mt-2 flex items-baseline gap-1">
                  {/* <span className="text-sm text-gray-500 font-medium">$</span> */}
                  <p className="text-2xl font-semibold tracking-tight text-white">
                    {formatStat(summary.playerWin)}
                  </p>
                </div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-[#242B35] text-[#10B981]">
                <Target size={20} />
              </div>
            </div>
            {/* <div className="flex items-center gap-1 text-xs font-medium text-[#04AD37]">
              <TrendingUp size={12} />
              <span>all time</span>
            </div> */}
          </div>

          {/* GGR */}
          <div className="rounded-xl border border-[#242B35] bg-[#191D24] p-4 md:p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-gray-400 font-medium">
                  GGR
                </p>
                <div className="mt-2 flex items-baseline gap-1">
                  {/* <span className="text-sm text-gray-500 font-medium">$</span> */}
                  <p className="text-2xl font-semibold tracking-tight text-white">
                    {formatStat(summary.ggr)}
                  </p>
                </div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-[#242B35] text-[#F59E0B]">
                <ShieldCheck size={20} />
              </div>
            </div>
            {/* <div className="flex items-center gap-1 text-xs font-medium text-[#04AD37]">
              <TrendingUp size={12} />
              <span>all time</span>
            </div> */}
          </div>

        </div>
        )}

        {/* DETAILED DATA LABEL */}

        {/* TABLE CONTAINER */}
        <div className="rounded-xl border border-[#242B35] bg-[#191D24] overflow-hidden">
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full min-w-[1200px]">
              <thead className="bg-[#242B35]">
                <tr>
                  <th className="px-5 py-4 text-xs font-semibold text-white uppercase tracking-wider text-start">
                    Date
                  </th>
                  <th className="px-5 py-4 text-xs font-semibold text-white uppercase tracking-wider text-center">
                    Total Players
                  </th>
                  <th className="px-5 py-4 text-xs font-semibold text-white uppercase tracking-wider text-center">
                    Total Bets
                  </th>
                  <th className="px-5 py-4 text-xs font-semibold text-white uppercase tracking-wider text-center">
                    Total Bet Amt
                  </th>
                  <th className="px-5 py-4 text-xs font-semibold text-white uppercase tracking-wider text-center">
                    Total Win
                  </th>
                  <th className="px-5 py-4 text-xs font-semibold text-white uppercase tracking-wider text-center">
                    GGR
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242B35]">
                {loading ? (
                  <TableSkeletonRows rows={8} cols={6} />
                ) : reportData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center">
                      <NoData title="No gaming data found for the selected period." />
                    </td>
                  </tr>
                ) : (
                  reportData
                    .slice(
                      (currentPage - 1) * itemsPerPage,
                      currentPage * itemsPerPage,
                    )
                    .map((row, index) => (
                      <tr
                        key={index}
                        className="hover:bg-[#242B35]/30 transition-colors"
                      >
                        <td className="px-5 py-4 text-sm text-gray-300 whitespace-nowrap">
                          {format(new Date(row.date), "MMM dd, yyyy")}
                        </td>
                        <td className="px-5 py-4 text-sm text-white font-medium text-center">  
                          {row.totalPlayers.toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-sm text-white font-medium text-center">
                          {row.totalBets.toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-sm text-white font-mono text-center">
                          {row.totalBetAmt.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-5 py-4 text-sm text-white font-mono text-center">
                          {row.totalWin.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-5 py-4 text-sm text-white font-mono text-center font-bold">
                          {row.ggr.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* FOOTER / PAGINATION */}
        <div className="mt-4 rounded-xl border border-[#242B35] bg-[#191D24] px-3 py-3 md:px-5 flex justify-end">
          {reportData.length > itemsPerPage && (
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(reportData.length / itemsPerPage)}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      </div>

      <ReportFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title="Win/Loss Report Filters"
        description="Narrow down your win-loss analytics view."
        fields={[
          { kind: "datePreset" },
          { kind: "dateRange" },
          {
            kind: "select",
            key: "userStatus",
            label: "Player Status",
            options: [
              { value: "all", label: "All Players" },
              { value: "active", label: "Active Players" },
              { value: "inactive", label: "Inactive Players" },
            ],
          },
        ] as FilterField[]}
        values={{
          startDate: filters.startDate,
          endDate: filters.endDate,
          userStatus: filters.userStatus ?? "all",
        }}
        defaults={{ startDate: undefined, endDate: undefined, userStatus: "all", datePreset: "all" }}
        onApply={(v) =>
          setFilters({
            startDate: v.startDate,
            endDate: v.endDate,
            userStatus: (v.userStatus as string) ?? "all",
            parentId: filters.parentId,
          })
        }
      />

      <PlayerSummaryModal
        open={openView}
        onClose={() => setOpenView(false)}
        data={viewData}
      />
    </div>
  );
}
