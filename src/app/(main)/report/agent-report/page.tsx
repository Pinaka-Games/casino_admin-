"use client";

import React, { useEffect, useMemo } from "react";
import { utcDayEndISO, utcDayStartISO } from "@/lib/utils";
import { format } from "date-fns";
import { Users, Banknote, Clock, DollarSign, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import Pagination from "@/components/Pagination";
import ListSearch from "@/components/TableSearch/ListSearch";
import ExportCSV from "@/components/ExportCSV";
import AgentFilterSheet from "../../users/agent-listing/components/AgentFilterSheet";
import { useAgentReportStore, type AgentReportRow } from "@/store/agent-report-store";
import { useClearSearchOnLeave } from "@/hooks/use-clear-search-on-leave";
import { TableSkeletonRows } from "@/components/report/ReportSkeleton";

export default function AgentReportPage() {
  const {
    agentData,
    summary,
    totalAgents,
    loading: agentsLoading,
    statsLoading,
    currentPage,
    totalPages,
    totalItems,
    searchQuery,
    filterOpen,
    filters,
    fetchTotalAgents,
    fetchAgents,
    fetchAllAgentsForExport,
    setPage,
    setFilters,
    setSearchQuery,
    setFilterOpen,
  } = useAgentReportStore();

  // Search text lives in a module-level store, so it survives navigation —
  // clear it on the way out or the next visit opens pre-filtered.
  useClearSearchOnLeave(() =>
    useAgentReportStore.setState({ searchQuery: "" }),
  );

  useEffect(() => {
    fetchTotalAgents();
    fetchAgents();
  }, [fetchTotalAgents, fetchAgents]);

  const safeNumber = (value: number | undefined | null): number =>
    Number.isFinite(value as number) ? (value as number) : 0;

  const activeAgentsCount = totalItems || agentData.length;
  const totalAgentsCount = totalAgents || activeAgentsCount;

  // Calculate total players from agentData (sum of all players)
  const totalPlayers = useMemo(
    () => agentData.reduce((sum, row) => sum + safeNumber(row.players), 0),
    [agentData],
  );

  // Calculate total sub-agents from agentData
  const totalSubAgents = useMemo(
    () => agentData.reduce((sum, row) => sum + safeNumber(row.subAgents), 0),
    [agentData],
  );

  const loading = agentsLoading || statsLoading;

  // The API sends card totals for every agent matching the current search /
  // status / date filter, across all pages. Summing `agentData` here made
  // Total Bet change with each page, and the network-wide referral stats
  // counted non-agent referrers' payouts too.
  const isFiltered =
    !!searchQuery ||
    filters.status === "active" ||
    filters.status === "inactive" ||
    !!filters.startDate ||
    !!filters.endDate;
  const cardAgents = summary ? summary.totalAgents : totalAgents || 0;
  const cardPaid = summary?.revSharePaid ?? 0;
  const cardBet = summary?.totalBet ?? 0;
  const cardPending = summary?.pendingPayout ?? 0;
  const money = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const exportHeaders = [
    "Agent",
    "Sub-Agents",
    "Players",
    "Total Bet Amount",
    "GGR",
    "Rev Share %",
    "Commission",
  ];

  const mapExportRow = (row: AgentReportRow): (string | number)[] => [
    row.agentName,
    row.subAgents,
    row.players,
    row.totalBet?.toFixed(2),
    row.ggr?.toFixed(2),
    row.revShareStr,
    row.commission?.toFixed(2),
  ];

  return (
    <div className="h-full bg-[#15181E] p-3 md:p-6 space-y-4 md:space-y-6 overflow-y-auto w-full">
      {/* BREADCRUMB HEADER */}
      <div className="bg-[#161A21] px-3 py-3 md:px-5 rounded-lg text-md font-mono font-semibold text-gray-100 border border-[#242B35]">
        Report / <span className="text-white">Agent Report</span>
      </div>

      {/* SEARCH OR FILTER BAR (TOP SECTION) */}
      <div className="bg-[#191D24] rounded-xl p-2 flex items-center gap-2 shrink-0 border border-[#242B35]">
        <div className="flex-1 flex items-center gap-2">
          <ListSearch
            value={searchQuery}
            onChange={(val) => {
              setSearchQuery(val);
            }}
            placeholder="Search agent by name..."
            showButton={false}
          />
          <Button
            variant="outline"
            size="icon"
            className="bg-[#1A2030] border-white/10 rounded-lg w-10 h-10 text-white hover:bg-[#252b3d] flex items-center justify-center shrink-0"
            onClick={() => setFilterOpen(true)}
          >
            <Filter size={20} className="text-[#B93DEB]" />
          </Button>

          <ExportCSV<AgentReportRow>
            data={agentData}
            headers={exportHeaders}
            mapRow={mapExportRow}
            fileName="agent_report.csv"
            fetchAll={(range) =>
              fetchAllAgentsForExport({
                // A bare date parses as midnight, which dropped the whole
                // end day from the export.
                startDate: utcDayStartISO(range.from),
                endDate: utcDayEndISO(range.to),
              })
            }
            locked={loading || totalAgents === 0}
          />
        </div>
      </div>

      {/* OVERVIEW CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 - Total Agents */}
        <div className="bg-[#191D24] border border-[#242B35] rounded-xl p-4 md:p-5 shadow-sm relative overflow-hidden group">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex flex-center text-blue-400">
              <Users className="w-5 h-5 m-auto" />
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Total Agents
            </p>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-white pl-1 mt-1">
            {cardAgents}
          </h3>
          <p className="text-xs text-gray-500 font-bold mt-2 pl-1">
            {isFiltered ? "Matching filter" : "Total in network"}
          </p>
        </div>

        {/* Card 2 - Players Only */}
        {/* <div className="bg-[#191D24] border border-[#242B35] rounded-xl p-5 shadow-sm relative overflow-hidden group">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex flex-center text-purple-400">
              <UserPlus className="w-5 h-5 m-auto" />
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Players
            </p>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-white pl-1 mt-1">
            {totalPlayers.toLocaleString()}
          </h3>
          <p className="text-xs text-green-400 font-bold mt-2 pl-1">players</p>
        </div> */}

        {/* Card 3 */}
        <div className="bg-[#191D24] border border-[#242B35] rounded-xl p-4 md:p-5 shadow-sm relative overflow-hidden group">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex flex-center text-green-400">
              <Banknote className="w-5 h-5 m-auto" />
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Rev Share Paid
            </p>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-white pl-1 mt-1">
            {money(cardPaid)}
          </h3>
          <p className="text-xs text-green-400 font-bold mt-2 pl-1">
            Completed Payouts
          </p>
        </div>

        {/* Card 4 - Total Bet Amount */}
        <div className="bg-[#191D24] border border-[#242B35] rounded-xl p-4 md:p-5 shadow-sm relative overflow-hidden group">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex flex-center text-yellow-400">
              <DollarSign className="w-5 h-5 m-auto" />
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Total Bet Amount
            </p>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-white pl-1 mt-1">
            {money(cardBet)}
          </h3>
          <p className="text-xs text-yellow-400 font-bold mt-2 pl-1">
            Total wagered
          </p>
        </div>

        {/* Card 5 - Pending Payout Amount: what agents have actually REQUESTED
            and is still awaiting approval, not commission merely accrued.
            Paired with "Rev Share Paid" beside it, the row reads as payouts
            already completed vs payouts still in the queue. */}
        <div className="bg-[#191D24] border border-[#242B35] rounded-xl p-4 md:p-5 shadow-sm relative overflow-hidden group">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/20 flex flex-center text-orange-400">
              <Clock className="w-5 h-5 m-auto" />
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Pending Payout Amount
            </p>
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-white pl-1 mt-1">
            {money(cardPending)}
          </h3>
          <p className="text-xs text-orange-400 font-bold mt-2 pl-1">
            Awaiting approval
          </p>
        </div>
      </div>

      <div className="bg-[#191D24] rounded-xl border border-[#242B35] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-left min-w-[1000px]">
            <thead className="bg-[#1E232B]">
              <tr>
                <th className="px-5 py-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-[260px]">
                  Agent
                </th>
                <th className="whitespace-nowrap px-5 py-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-center">
                  Sub-Agents
                </th>
                <th className="px-4 py-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-center">
                  Players
                </th>
                <th
                  className="px-5 py-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-right"
                  title="Total amount wagered by this agent's players (real + bonus stake, settled Sweep Coin rounds). Same figure as the agent dashboard's Total Wagered."
                >
                  Total Bet Amount
                </th>
                <th className="px-5 py-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-right">
                  GGR
                </th>
                <th className="px-4 py-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-center">
                  Rev Share %
                </th>
                <th className="px-5 py-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-right">
                  Commission
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#242B35]">
              {loading && agentData.length === 0 ? (
                <TableSkeletonRows rows={8} cols={7} />
              ) : agentData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-gray-500 font-medium">
                    No agent data available for this selection.
                  </td>
                </tr>
              ) : (
                agentData.map((row) => (
                  <tr
                    key={row.agentId}
                    className="hover:bg-[#161A21] transition-colors group"
                  >
                    <td className="px-5 py-4">
                      <span
                        className="block truncate text-sm font-bold text-gray-200 group-hover:text-purple-400 transition-colors"
                        title={row.agentName}
                      >
                        {row.agentName}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-400 text-center font-medium">
                      {row.subAgents}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-400 text-center font-medium">
                      {row.players}
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-gray-300 font-mono text-right tracking-tight">
                      {(row.totalBet || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-orange-400 font-mono text-right tracking-tight">
                      {(row.ggr || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-4 text-sm font-bold text-gray-400 text-center">
                      {row.revShareStr || "0%"}
                    </td>
                    <td className="px-5 py-4 text-sm font-black text-green-400 font-mono text-right tracking-tighter">
                      {(row.commission || 0).toLocaleString(undefined, {
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

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="mt-4 rounded-xl border border-[#242B35] bg-[#191D24] px-3 py-3 md:px-5 flex justify-end">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}

      <AgentFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onApply={(newFilters) => setFilters(newFilters)}
      />
    </div>
  );
}
