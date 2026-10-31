"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Search, LayoutGrid, TrendingUp, DollarSign, Trophy, Sparkles, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ExportCSV from "@/components/ExportCSV";
import Pagination from "@/components/Pagination";
import { useGameReportStore, GameRow } from "@/store/game-report-store";
import CurrencyToggle from "@/components/report/CurrencyToggle";
import { TableSkeletonRows } from "@/components/report/ReportSkeleton";
import ReportFilterDrawer, { FilterField } from "@/components/report/ReportFilterDrawer";
import { formatStat } from "@/lib/utils";

export default function GameReportPage() {
  const {
    gameRows,
    isLoading,
    currentPage,
    pageSize: itemsPerPage,
    filters,
    providerOptions,
    categoryOptions,
    filterOpen,
    currency,
    fetchReport,
    fetchRowsForRange,
    setPage: setCurrentPage,
    setFilters,
    setCurrency,
    setFilterOpen,
  } = useGameReportStore();

  const [searchQuery, setSearchQuery] = useState("");

  /*
    Card money figures.

    Wulf Cash prints in full — compacting 11,485.03 to "11.49K" hides 485
    dollars from an admin reconciling the card against the per-game rows below,
    which have always shown the whole figure. Wulf Coins are virtual and run
    orders of magnitude larger, so they keep the compact K / M form.
  */
  function fmt(n: number) {
    return currency === "wulfCoin"
      ? formatStat(n)
      : n.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  }

  // Row money cells always print the full figure with two decimals, so
  // 83,120.10 doesn't drop its trailing zero and read as 83,120.1.
  function fmtRow(n: number) {
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // Active provider/category/search predicate — shared by the visible table and
  // the export so both reflect exactly the same rows.
  const matchesFilters = React.useCallback(
    (g: GameRow) => {
      const q = searchQuery.trim().toLowerCase();
      const matchProvider = filters.provider === "all" || g.provider === filters.provider;
      const matchCategory = filters.category === "all" || g.category === filters.category;
      const matchSearch = !q || g.gameName.toLowerCase().includes(q) || g.provider.toLowerCase().includes(q);
      return matchProvider && matchCategory && matchSearch;
    },
    [filters.provider, filters.category, searchQuery],
  );

  // Filter + search (provider/category from the drawer, plus the quick search)
  const filteredRows = useMemo(() => gameRows.filter(matchesFilters), [gameRows, matchesFilters]);

  // Summary totals reflect the ACTIVE filters (provider / category / search),
  // so the cards always match the rows shown in the table below.
  const totalGames = filteredRows.length;
  const totalGGR = useMemo(() => filteredRows.reduce((s, g) => s + g.ggr, 0), [filteredRows]);
  const totalBet = useMemo(() => filteredRows.reduce((s, g) => s + g.totalBet, 0), [filteredRows]);
  const totalWin = useMemo(() => filteredRows.reduce((s, g) => s + g.totalWin, 0), [filteredRows]);

  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => { fetchReport(); }, [fetchReport]);

  return (
    <div className="h-full bg-[#15181E] p-3 md:p-6 space-y-4 md:space-y-6 overflow-y-auto w-full scrollbar-hide">
      {/* HEADER */}
      <div className="bg-[#161A21] px-3 py-3 md:px-5 rounded-lg border border-[#242B35] flex items-center justify-between gap-3 flex-wrap">
        <span className="text-md font-mono font-semibold text-gray-100">
          Report / <span className="text-white">Game Report</span>
        </span>

        {/* Full width on a phone so the search box can take the row it wraps
            onto; a fixed w-52 there left Filter/Export on a line of their own. */}
        <div className="flex w-full items-center gap-2 flex-wrap md:w-auto">
          <CurrencyToggle value={currency} onChange={setCurrency} />
          <div className="relative min-w-[140px] flex-1 md:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search game name..."
              className="pl-9 h-9 w-full md:w-52 bg-[#1A2030] border-white/10 text-gray-200 text-sm rounded-lg focus-visible:ring-0 placeholder:text-gray-500"
            />
          </div>
          <Button variant="outline" size="sm"
            className="h-9 px-3 bg-[#1A2030] border-white/10 text-gray-300 hover:bg-[#252b3d] rounded-lg flex items-center gap-1.5"
            onClick={() => setFilterOpen(true)}
          >
            <Filter size={20} className="text-[#B93DEB]" /> Filter
            {(filters.provider !== "all" ||
              filters.category !== "all" ||
              filters.startDate ||
              filters.endDate) && (
              <span className="w-2 h-2 rounded-full bg-[#B93DEB]" />
            )}
          </Button>
          <ExportCSV<GameRow>
            data={filteredRows}
            headers={["Game Name", "Provider", "Category", "RTP %", "Total Players", "Total Bets", "Total Bet Amount", "Total Win", "GGR"]}
            mapRow={(g) => [
              g.gameName,
              g.provider,
              g.category,
              g.rtp === null ? "" : g.rtp,
              g.totalPlayers,
              g.betCounts,
              g.totalBet.toFixed(2),
              g.totalWin.toFixed(2),
              g.ggr.toFixed(2),
            ]}
            fileName="game_report.csv"
            // Rows are per-game aggregates with no per-row date, so the chosen
            // range is applied server-side, then the active provider/category/
            // search filters are re-applied to match the table.
            fetchAll={async (range) => (await fetchRowsForRange(range)).filter(matchesFilters)}
          />
        </div>
      </div>

      {/* FILTER DRAWER */}
      <ReportFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title="Game Report Filters"
        description="Filter game performance by date, provider and category."
        fields={[
          { kind: "dateRange" },
          {
            kind: "select",
            key: "provider",
            label: "Provider",
            options: [
              { value: "all", label: "All Providers" },
              ...providerOptions.map((p) => ({ value: p, label: p })),
            ],
          },
          {
            kind: "select",
            key: "category",
            label: "Category",
            options: [
              { value: "all", label: "All Categories" },
              ...categoryOptions.map((c) => ({ value: c, label: c })),
            ],
          },
        ] as FilterField[]}
        values={{
          startDate: filters.startDate,
          endDate: filters.endDate,
          provider: filters.provider,
          category: filters.category,
        }}
        defaults={{ startDate: undefined, endDate: undefined, provider: "all", category: "all" }}
        onApply={(v) =>
          setFilters({
            startDate: v.startDate,
            endDate: v.endDate,
            provider: (v.provider as string) ?? "all",
            category: (v.category as string) ?? "all",
          })
        }
      />

      {/* SUMMARY CARDS */}
      {/* One per row on a phone: two columns left ~130px for a full-cents
          Wulf Cash total, which ran out of its card. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[#242B35] bg-[#191D24] p-4 md:p-5">
          <div className="mb-3 flex items-start justify-between">
            <p className="text-xs uppercase tracking-widest text-gray-400">Total Games</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-[#242B35] text-[#F59E0B]">
              <LayoutGrid size={16} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-semibold text-white">{isLoading ? "—" : totalGames.toLocaleString()}</p>
          <p className="mt-2 text-xs text-gray-400">all providers</p>
        </div>

        <div className="rounded-xl border border-[#242B35] bg-[#191D24] p-4 md:p-5">
          <div className="mb-3 flex items-start justify-between">
            <p className="text-xs uppercase tracking-widest text-gray-400">Total GGR</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-[#242B35] text-[#F59E0B]">
              <TrendingUp size={16} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-semibold text-white">{isLoading ? "—" : fmt(totalGGR)}</p>
          <p className="mt-2 text-xs text-[#04AD37]">all games combined</p>
        </div>

        <div className="rounded-xl border border-[#242B35] bg-[#191D24] p-4 md:p-5">
          <div className="mb-3 flex items-start justify-between">
            <p className="text-xs uppercase tracking-widest text-gray-400">Total Bet Amount</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-[#242B35] text-[#F59E0B]">
              <DollarSign size={16} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-semibold text-white">{isLoading ? "—" : fmt(totalBet)}</p>
          <p className="mt-2 text-xs text-gray-400">all providers</p>
        </div>

        <div className="rounded-xl border border-[#242B35] bg-[#191D24] p-4 md:p-5">
          <div className="mb-3 flex items-start justify-between">
            <p className="text-xs uppercase tracking-widest text-gray-400">Total Player Win</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-[#242B35] text-[#F59E0B]">
              <Trophy size={16} />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-semibold text-white">{isLoading ? "—" : fmt(totalWin)}</p>
          <p className="mt-2 text-xs text-red-400">paid out to players</p>
        </div>
      </div>

      {/* TABLE */}
      <div className="rounded-xl border border-[#242B35] bg-[#191D24] overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[900px]">
            <thead className="bg-[#242B35]">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Game</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Provider</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-white uppercase tracking-wider">Category</th>
                <th className="px-5 py-4 text-center text-xs font-medium text-white uppercase tracking-wider">RTP</th>
                <th className="px-5 py-4 text-center text-xs font-medium text-white uppercase tracking-wider">Total Players</th>
                <th className="px-5 py-4 text-center text-xs font-medium text-white uppercase tracking-wider">Total Bets</th>
                <th className="px-5 py-4 text-center text-xs font-medium text-white uppercase tracking-wider">Total Bet Amount</th>
                <th className="px-5 py-4 text-center text-xs font-medium text-white uppercase tracking-wider">Total Win</th>
                <th className="px-5 py-4 text-center text-xs font-medium text-white uppercase tracking-wider">GGR</th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <TableSkeletonRows rows={10} cols={9} />
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-sm text-gray-500">
                    No games found for the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((game, i) => {
                  return (
                    <tr
                      key={game.id}
                      className={`border-b border-[#242B35]/40 hover:bg-[#1E2330] transition-colors ${
                        i % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                      }`}
                    >
                      {/* Game */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {game.thumbnail ? (
                            <img
                              src={game.thumbnail}
                              alt={game.gameName}
                              className="h-10 w-10 rounded-lg object-cover shrink-0 bg-[#242B35]"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-[#242B35] flex items-center justify-center shrink-0">
                              <Sparkles size={14} className="text-gray-600" />
                            </div>
                          )}
                          <span className="text-sm text-white font-medium line-clamp-2 max-w-[200px]">
                            {game.gameName}
                          </span>
                        </div>
                      </td>

                      {/* Provider */}
                      <td className="px-5 py-3 text-sm text-gray-300 whitespace-nowrap">{game.provider}</td>

                      {/* Category */}
                      <td className="px-5 py-3 text-sm text-gray-300 whitespace-nowrap">{game.category}</td>

                      {/* RTP — blank for games the provider publishes none for,
                          rather than a 0% that would read as a real figure. */}
                      <td className="px-5 py-3 text-sm text-gray-300 text-center whitespace-nowrap">
                        {game.rtp !== null ? `${game.rtp}%` : <span className="text-gray-600">—</span>}
                      </td>

                      {/* Total Players */}
                      <td className="px-5 py-3 text-sm text-gray-300 text-center">
                        {game.totalPlayers > 0 ? game.totalPlayers.toLocaleString() : <span className="text-gray-600">—</span>}
                      </td>

                      {/* Bet Counts */}
                      <td className="px-5 py-3 text-sm text-gray-300 text-center">
                        {game.betCounts > 0 ? game.betCounts.toLocaleString() : <span className="text-gray-600">—</span>}
                      </td>

                      {/* Total Bet */}
                      <td className="px-5 py-3 text-sm text-white text-center font-medium">
                        {game.totalBet > 0
                          ? fmtRow(game.totalBet)
                          : <span className="text-gray-600">—</span>}
                      </td>

                      {/* Total Win */}
                      <td className="px-5 py-3 text-sm text-[#4B8EF1] text-center font-medium">
                        {game.totalWin > 0
                          ? fmtRow(game.totalWin)
                          : <span className="text-gray-600">—</span>}
                      </td>

                      {/* GGR */}
                      <td className={`px-5 py-3 text-sm text-center font-medium ${
                        game.ggr > 0 ? "text-[#04AD37]" : game.ggr < 0 ? "text-red-400" : "text-gray-600"
                      }`}>
                        {game.ggr !== 0
                          ? fmtRow(game.ggr)
                          : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGINATION */}
      {Math.ceil(filteredRows.length / itemsPerPage) > 1 && !isLoading && (
        <div className="mt-4 rounded-xl border border-[#242B35] bg-[#191D24] px-3 py-3 md:px-5 flex flex-wrap items-center justify-between gap-2">
          {/* Counts only on a phone — the framing words wrapped and pushed the
              pager sideways. */}
          <span className="text-xs text-gray-500">
            <span className="hidden sm:inline">Showing </span>
            {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredRows.length)} of {filteredRows.length}
            <span className="hidden sm:inline"> games</span>
          </span>
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(filteredRows.length / itemsPerPage)}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
}
