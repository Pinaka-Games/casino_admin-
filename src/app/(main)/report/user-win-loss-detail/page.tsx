"use client";

import React, { useEffect, useState } from "react";
import { FileText, Activity, Coins, CircleDollarSign, Filter, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Pagination from "@/components/Pagination";
import GameSlipDetailModal from "./components/gamesplit";
import { GameReportRow } from "@/api/reports/reports";
import { format } from "date-fns";
import {
  GameReportFilterSheet,
  GameReportFilters,
} from "./components/game-report-filter-sheet";
import NoData from "@/components/NoData";

import { formatStat } from "@/lib/utils";
import { useUserWinLossDetailStore } from "@/store/user-win-loss-detail-store";
import ExportCSV from "@/components/ExportCSV";
import CurrencyToggle from "@/components/report/CurrencyToggle";
import { TableSkeletonRows } from "@/components/report/ReportSkeleton";

/* ============================
   PAGE
 ============================ */
export default function UserWinLoseDetailPage() {
  const {
    reportData: filteredData,
    isLoading,
    totals,
    openSlipModal,
    selectedSlip,
    currentPage,
    totalCount,
    itemsPerPage,
    filterOpen,
    filters,
    providerOptions,
    gameTypeOptions,
    currency,
    fetchReport,
    fetchAllForExport,
    setCurrentPage,
    setFilters,
    setCurrency,
    setFilterOpen,
    setOpenSlipModal,
    setSelectedSlip,
  } = useUserWinLossDetailStore();

  useEffect(() => {
    const controller = new AbortController();
    fetchReport(currentPage, controller.signal);
    return () => controller.abort();
  }, [currentPage, filters, currency, fetchReport]);

  /*
    Player search.

    The lookup runs SERVER-side (user id / username / email), so it searches
    the whole book rather than the twenty rows this page happens to hold —
    which is the point: an admin pasting a player id is looking for rounds that
    are almost never on page 1. Typing is debounced so a term is one request,
    not one per character.
  */
  const [playerQuery, setPlayerQuery] = useState(filters.player ?? "");

  // Follow the store when something else changes it — Reset Filters, mainly.
  useEffect(() => {
    setPlayerQuery(filters.player ?? "");
  }, [filters.player]);

  useEffect(() => {
    if (playerQuery === (filters.player ?? "")) return;
    const timer = setTimeout(
      () => setFilters({ ...filters, player: playerQuery }),
      400,
    );
    return () => clearTimeout(timer);
  }, [playerQuery, filters, setFilters]);

  const handleBetClick = (row: GameReportRow) => {
    setSelectedSlip({
      username: row.username,
      userId: row.playerId,
      slipId: row.roundId,
      dateTime: row.date,
      provider: row.gameProvider,
      gameName: row.game,
      gameImage: row.gameImage || "/sugar-rush.png",
      buyIn: row.totalBetAmount,
      payout: row.totalWin,
      profit: row.totalWin - row.totalBetAmount,
    });

    setOpenSlipModal(true);
  };

  function formatCurrency(num: number) {
    return `${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Player column shows contact only (email / phone) — drop the "User_xxx" name.
  // Backend sends "User_xxx (email-or-phone)"; prefer the row's email, else the
  // parenthesized contact, else the raw value.
  const playerContact = (r: GameReportRow) => {
    if (r.email) return r.email;
    const m = r.player?.match(/\(([^)]+)\)\s*$/);
    return m ? m[1] : r.player;
  };

  /*
    Figures print bare — no "$" and no "₩C" prefix.

    Which bucket is in view is already stated by the Wulf Cash / Wulf Coins
    toggle at the top of the page, and it governs every number below it, so
    repeating the unit on each of the five money columns added a symbol per
    cell without adding information. The KPI cards above the table have always
    printed bare figures; the table now matches them.
  */
  const money = (num: number) =>
    num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /*
    KPI card figures.

    Wulf Cash prints in full. The cards used to compact anything past 10,000 —
    a real-money total of 11,490.25 read as "11.49K", hiding 490 dollars from an
    admin trying to reconcile it against the rows below, which have always shown
    every cent. Wulf Coins are virtual and run orders of magnitude larger, so
    they keep the compact K / M form that makes them readable.
  */
  const statMoney = (num: number) =>
    currency === "wulfCoin" ? formatStat(num) : money(num);

  // Signed for House Earning, e.g. +100.00 (house win) / -100.00 (house loss).
  const signedMoney = (num: number) =>
    `${num > 0 ? "+" : num < 0 ? "-" : ""}${Math.abs(num).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  /*
    Total Win is the GROSS payout — every chip the house handed back on that
    round — which is the only reading under which this screen's own arithmetic
    closes: GGR is bet − win, and the Total Player Win card has always
    headlined the gross figure.

    It used to print net win (profit above stake). A 10.00 bet paying 20.00
    then read "Bet 10.00 / Win 10.00 / GGR -10.00" — a row that cannot be
    reconciled, since 10 − 10 is 0, not -10 — and the column summed to 30.00
    under a card reading 60.00. Profit above stake is still available as
    Win − Bet, and the sign is already carried by GGR.
  */
  const playerWin = (r: GameReportRow) => r.totalWin;

  // Promotional free spins stake 0.00 by design; the Type column says so
  // rather than leaving the zero to look like missing data.
  const entryType = (r: GameReportRow) => (r.isFreeSpin ? "Free Spin" : "Real Spin");

  // Profit above stake, kept for the Player Win range filter in the sheet.
  const netWin = (r: GameReportRow) => Math.max(0, r.totalWin - r.totalBetAmount);

  // GGR (house earning) for one row: handle − payout, the same definition the
  // API totals, the Daily Report and the Game Report aggregate use. It used to
  // be `totalLose − netWin`, which agrees with this only while a row's stored
  // netProfit is exactly win − bet; where it is not, the column drifted away
  // from the money actually staked and paid out on that round.
  const houseEarning = (r: GameReportRow) => r.totalBetAmount - r.totalWin;

  // Client-side numeric range filters (Bet Amount / Player Win / GGR). These
  // narrow the rows already loaded for the current page — they don't refetch.
  const inRange = (v: number, min?: number, max?: number) =>
    (min === undefined || v >= min) && (max === undefined || v <= max);

  const numericActive = [
    filters.betMin,
    filters.betMax,
    filters.winMin,
    filters.winMax,
    filters.ggrMin,
    filters.ggrMax,
  ].some((v) => v !== undefined);

  const visibleData = numericActive
    ? filteredData.filter(
        (r) =>
          inRange(r.totalBetAmount, filters.betMin, filters.betMax) &&
          inRange(netWin(r), filters.winMin, filters.winMax) &&
          inRange(houseEarning(r), filters.ggrMin, filters.ggrMax),
      )
    : filteredData;

  // Cards + footer follow the server totals normally; once a numeric range is
  // active they recompute from the visible (filtered) rows so everything agrees.
  const displayTotals = numericActive
    ? visibleData.reduce(
        (acc, r) => {
          acc.totalBetAmount += r.totalBetAmount;
          acc.validBet += r.validBet;
          acc.totalPayout += r.totalWin;
          acc.totalWin += netWin(r);
          acc.totalLose += r.totalLose;
          acc.ggr += houseEarning(r);
          return acc;
        },
        {
          totalBetAmount: 0,
          validBet: 0,
          totalPayout: 0,
          totalWin: 0,
          totalLose: 0,
          ggr: 0,
        },
      )
    : totals;

  return (
    <div className="h-full bg-[#15181E] p-3 md:p-6 space-y-4 md:space-y-6 overflow-y-auto w-full scrollbar-hide">
      {/* HEADER */}
      <div className="bg-[#161A21] px-3 py-3 md:px-5 rounded-lg text-md font-mono font-semibold text-gray-100 border border-[#242B35]">
        Report / <span className="text-white">User Win Lose Detail</span>
      </div>

      {/* FILTER BAR */}
      <div className="bg-[#191D24] rounded-xl p-2 flex flex-wrap items-center justify-between gap-2 shrink-0 border border-[#242B35]">
        <CurrencyToggle value={currency} onChange={setCurrency} />
        {/* Own full-width row on a phone, so "Filters applied" and the
            Filter/Export buttons share the next row instead of being squeezed
            beside a fixed 256px box. */}
        <div className="relative w-full md:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <Input
            value={playerQuery}
            onChange={(e) => setPlayerQuery(e.target.value)}
            placeholder="Search player id / email..."
            className="pl-9 h-10 w-full md:w-64 bg-[#1A2030] border-white/10 text-gray-200 text-sm rounded-lg focus-visible:ring-0 placeholder:text-gray-500"
          />
        </div>

        <div className="flex-1 flex items-center gap-2">
          <span className="text-gray-400 text-sm pl-2">Filters applied:</span>
          <span className="text-white/70 text-sm font-medium">
            {filters.provider !== "all" ||
            filters.gameType !== "all" ||
            filters.result !== "all" ||
            (filters.freeSpin ?? "all") !== "all" ||
            filters.startDate ||
            filters.endDate ||
            filters.player?.trim() ||
            numericActive
              ? "Active Filters"
              : "None"}
          </span>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            className="bg-[#1A2030] border-white/10 rounded-lg w-10 h-10 text-white hover:bg-[#252b3d] flex items-center justify-center shrink-0"
            onClick={() => setFilterOpen(true)}
          >
            <Filter size={20} className="text-[#B93DEB]" />
          </Button>

          <ExportCSV<GameReportRow>
            data={filteredData}
            headers={[
              "Statement Date",
              "Player",
              "Type",
              "Total Bet Amount",
              "Total Win",
              "Total Lose",
              "GGR",
              "Jackpot Amount",
              "Round ID",
              "Ticket IDs",
              "Bet ID",
              "Game Provider",
              "Game",
            ]}
            mapRow={(r) => [
              r.statementDate ? r.statementDate.slice(0, 10) : "",
              playerContact(r),
              entryType(r),
              r.totalBetAmount,
              playerWin(r).toFixed(2),
              r.totalLose,
              houseEarning(r).toFixed(2),
              r.jackpotAmount,
              r.roundId,
              r.ticketIds,
              r.betId,
              r.gameProvider,
              r.game,
            ]}
            fileName="user_win_lose_detail.csv"
            fetchAll={(range) => fetchAllForExport(range)}
          />
        </div>
      </div>

      {/* STAT CARDS

          The same three the Win/Loss report headlines, in the same order and on
          the same definitions, so the two screens can be read against each
          other. Total Player Win is the GROSS payout — what actually left the
          house — which is the figure GGR subtracts: bet - win = GGR, on every
          screen. The card used to show net win (profit above stake), which is a
          different quantity and made this page's own three numbers look like
          they did not add up. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* GGR — Gross Gaming Revenue = total wagered - total paid out */}
        <div className="rounded-xl border border-[#242B35] bg-[#191D24] p-4 md:p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
                Total GGR
              </p>
              <p
                className={`mt-3 text-2xl sm:text-3xl font-semibold tracking-tight ${
                  displayTotals.ggr >= 0 ? "text-[#04AD37]" : "text-red-500"
                }`}
              >
                {statMoney(displayTotals.ggr)}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-[#242B35] text-[#F59E0B]">
              <Activity size={20} />
            </div>
          </div>
          <p className="text-sm font-medium text-[#04AD37]">house earning</p>
        </div>

        {/* Total Bet Amount (handle) */}
        <div className="rounded-xl border border-[#242B35] bg-[#191D24] p-4 md:p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
                Total Bet Amount
              </p>
              <p className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                {statMoney(displayTotals.totalBetAmount)}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-[#242B35] text-[#F59E0B]">
              <Coins size={20} />
            </div>
          </div>
          <p className="text-sm font-medium text-gray-500">total wagered</p>
        </div>

        {/* Total Player Win — gross payout, not profit above stake */}
        <div className="rounded-xl border border-[#242B35] bg-[#191D24] p-4 md:p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
                Total Player Win
              </p>
              <p className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                {statMoney(displayTotals.totalPayout)}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-[#242B35] text-[#F59E0B]">
              <CircleDollarSign size={20} />
            </div>
          </div>
          <p className="text-sm font-medium text-red-500">paid out to players</p>
        </div>
      </div>

      {/* TABLE */}
      <div className="rounded-xl border border-[#242B35] bg-[#191D24] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1500px]">
            <thead className="bg-[#242B35]">
              <tr>
                {[
                  "Statement Date",
                  "Provider",
                  "Game",
                  "Player",
                  "Type",
                  "Total Bet Amount",
                  "Total Win",
                  "Total Lose",
                  "GGR",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-4 text-left text-xs font-medium text-white uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <TableSkeletonRows rows={10} cols={9} />
              ) : visibleData.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-12 text-center text-sm text-gray-500"
                  >
                    <div className="text-gray-400">
                      <NoData />
                    </div>
                  </td>
                </tr>
              ) : (
                visibleData.map((row, i) => (
                  <tr
                    key={i}
                    className={i % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"}
                  >
                    <td className="px-5 py-3 text-sm text-gray-400 whitespace-nowrap">
                      {row.statementDate
                        ? format(
                            new Date(row.statementDate),
                            "yyyy-MM-dd HH:mm",
                          )
                        : "-"}
                    </td>
                    <td className="px-5 py-3 text-sm text-white">
                      {row.gameProvider}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-300 whitespace-nowrap">
                      {row.game}
                    </td>
                    <td className="px-5 py-3 text-sm text-white">
                      {playerContact(row)}
                    </td>
                    <td className="px-5 py-3 text-sm whitespace-nowrap">
                      {row.isFreeSpin ? (
                        <span className="inline-flex items-center rounded-md border border-[#B93DEB]/40 bg-[#B93DEB]/15 px-2 py-0.5 text-xs font-medium text-[#D58BF5]">
                          Free Spin
                        </span>
                      ) : (
                        <span className="text-gray-400">Real Spin</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-white">
                      {money(row.totalBetAmount)}
                    </td>
                    <td
                      className={`px-5 py-3 text-sm font-medium ${row.totalWin > 0 ? "text-[#04AD37]" : "text-gray-400"}`}
                    >
                      {money(playerWin(row))}
                    </td>
                    <td
                      className={`px-5 py-3 text-sm font-medium ${row.totalLose > 0 ? "text-red-500" : "text-gray-400"}`}
                    >
                      {money(row.totalLose)}
                    </td>
                    <td
                      className={`px-5 py-3 text-sm font-semibold ${
                        houseEarning(row) > 0
                          ? "text-[#04AD37]"
                          : houseEarning(row) < 0
                            ? "text-red-500"
                            : "text-gray-400"
                      }`}
                    >
                      {signedMoney(houseEarning(row))}
                    </td>
                    {/* <td className="px-5 py-3 text-sm text-gray-400 whitespace-nowrap">
                        {row.roundId}
                      </td> */}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGINATION */}
      {Math.ceil(totalCount / itemsPerPage) > 1 && !isLoading && (
        <div className="mt-4 rounded-xl border border-[#242B35] bg-[#191D24] px-3 py-3 md:px-5 flex justify-end">
          <Pagination
            currentPage={currentPage}
            totalPages={Math.ceil(totalCount / itemsPerPage)}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      <GameReportFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters as GameReportFilters}
        onApply={(nextFilters) => {
          setFilters(nextFilters as any);
        }}
        providerOptions={providerOptions}
        gameTypeOptions={gameTypeOptions}
      />

      {openSlipModal && selectedSlip && (
        <GameSlipDetailModal
          open={openSlipModal}
          onClose={() => setOpenSlipModal(false)}
          data={selectedSlip}
        />
      )}
    </div>
  );
}
