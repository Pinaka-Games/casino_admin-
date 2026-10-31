"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownCircle, ArrowUpCircle, CircleDollarSign, Coins, Users, Filter } from "lucide-react";

import ExportCSV from "@/components/ExportCSV";
import Pagination from "@/components/Pagination";
import { formatStat } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import CurrencyToggle from "@/components/report/CurrencyToggle";
import { TableSkeletonRows, StatCardsSkeleton } from "@/components/report/ReportSkeleton";
import ReportFilterDrawer, { FilterField } from "@/components/report/ReportFilterDrawer";
import { useDailyReportStore } from "@/store/daily-report-store";
import { DailyWinLossRow } from "@/api/reports/reports";

/** Counts — players, rounds. Whole numbers by definition. */
const formatAmount = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);

/*
  Money columns keep their cents.

  Bet Amt, Player Win and GGR were rounded to whole numbers here while the KPI
  cards above print the exact figure, so a day reading "444 − 362 = 82" could
  not be reconciled against a card reading 11,493.23 — and the rounding of each
  column hid up to a unit of drift in the GGR beside them.
*/
const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const parseReportDate = (value: string) => {
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date;
  return new Date(`${value}T00:00:00`);
};

const formatReportDate = (value: string) => {
  const date = parseReportDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const PAGE_SIZE = 10;

// Numeric range filters offered in the drawer. `field` is the row property each
// Min/Max pair is compared against; `key` namespaces the `${key}Min`/`${key}Max`
// values carried by the filter drawer.
const METRIC_FILTERS: { key: string; label: string; field: keyof DailyWinLossRow }[] = [
  { key: "players", label: "Player Count", field: "totalPlayers" },
  { key: "bets", label: "Total Bets", field: "totalBets" },
  { key: "betAmt", label: "Bet Amount", field: "totalBetAmt" },
  { key: "win", label: "Total Player Win", field: "totalWin" },
  { key: "ggr", label: "GGR", field: "ggr" },
  { key: "purchase", label: "Purchase Amount", field: "purchaseAmt" },
  { key: "redeem", label: "Redeem Amount", field: "redeemAmt" },
];

export default function DailyReportPage() {
  const {
    rows: storeRows,
    summary,
    isLoading,
    currentPage,
    filters: storeFilters,
    currency,
    fetchReport,
    setPage,
    setFilters,
    setCurrency,
  } = useDailyReportStore();

  const [filterOpen, setFilterOpen] = useState(false);
  // Client-side numeric range filters ({ playersMin, playersMax, ... }). These
  // narrow the already-fetched rows; they don't hit the backend.
  const [metricFilters, setMetricFilters] = useState<Record<string, number | undefined>>({});

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const sortedData = useMemo(() => {
    return [...storeRows].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [storeRows]);

  const hasMetricFilter = useMemo(
    () => Object.values(metricFilters).some((v) => v !== undefined),
    [metricFilters],
  );

  // Apply the numeric range filters. A row is kept only when every metric with
  // a Min/Max set falls within [min, max].
  const filteredData = useMemo(() => {
    if (!hasMetricFilter) return sortedData;
    return sortedData.filter((row) =>
      METRIC_FILTERS.every(({ key, field }) => {
        const min = metricFilters[`${key}Min`];
        const max = metricFilters[`${key}Max`];
        const val = Number(row[field] ?? 0);
        if (min !== undefined && val < min) return false;
        if (max !== undefined && val > max) return false;
        return true;
      }),
    );
  }, [sortedData, metricFilters, hasMetricFilter]);

  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredData.slice(start, start + PAGE_SIZE);
  }, [filteredData, currentPage]);

  const totals = useMemo(() => {
    return filteredData.reduce(
      (acc, row) => {
        acc.totalPlayers += row.totalPlayers;
        acc.totalBets += row.totalBets;
        acc.totalBetAmount += row.totalBetAmt;
        acc.totalWin += row.totalWin;
        acc.ggr += row.ggr;
        acc.totalPurchase += row.purchaseAmt ?? 0;
        acc.totalRedeem += row.redeemAmt ?? 0;
        return acc;
      },
      {
        totalPlayers: 0,
        totalBets: 0,
        totalBetAmount: 0,
        totalWin: 0,
        ggr: 0,
        totalPurchase: 0,
        totalRedeem: 0,
      },
    );
  }, [filteredData]);

  // Top cards summarise the report and match the table's "Total" footer row
  // exactly. With no metric filter active we prefer the backend summary (its
  // aggregate is authoritative); once rows are filtered we fall back to the
  // client-side totals so the cards keep matching the visible rows.
  const overview = useMemo(() => {
    const useSummary = summary && !hasMetricFilter;
    return {
      grossRevenue: useSummary ? summary.totalBet : totals.totalBetAmount,
      ggr: useSummary ? summary.ggr : totals.ggr,
      totalBets: totals.totalBets,
      activePlayers: useSummary ? summary.totalPlayers : totals.totalPlayers,
      purchase: useSummary ? summary.totalPurchase ?? 0 : totals.totalPurchase,
      redeem: useSummary ? summary.totalRedeem ?? 0 : totals.totalRedeem,
    };
  }, [summary, totals, hasMetricFilter]);

  /*
    Card figures.

    Wulf Cash prints in full — a real-money total of 11,485.03 compacted to
    "11.49K" hides 485 dollars from an admin reconciling it against the rows
    below, which have always shown the whole figure. Wulf Coins are virtual and
    run orders of magnitude larger, so they keep the compact K / M form.

    Counts (rounds, players) are never compacted either way: "14.33K rounds"
    costs precision for no gain, and the toggle does not apply to them.
  */
  const statMoney = (num: number) =>
    currency === "wulfCoin"
      ? formatStat(num)
      : num.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

  // Labels are chosen to be accurate: "Turnover" is total wagered (NOT profit);
  // GGR (Gross Gaming Revenue) is the real revenue = wagers − winnings.
  const cards = [
    {
      title: "Total Bet Amount",
      caption: "Total amount wagered",
      value: statMoney(overview.grossRevenue),
      icon: CircleDollarSign,
    },
    {
      title: "Total GGR",
      caption: "Revenue = wagers − winnings",
      value: statMoney(overview.ggr),
      icon: Coins,
    },
    {
      title: "Total Bets",
      caption: "Rounds played",
      value: formatAmount(overview.totalBets),
      icon: Activity,
    },
    {
      title: "Purchase Amount",
      // Real money in, so it never follows the Wulf Coins toggle.
      caption: "Bundles, subscriptions & payins",
      value: overview.purchase.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      icon: ArrowDownCircle,
    },
    {
      title: "Redeem Amount",
      caption: "Paid out to players",
      value: overview.redeem.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      icon: ArrowUpCircle,
    },
    {
      title: "Total Players",
      // Each day contributes its own distinct-player count, so a player active
      // on three days is counted three times. This is player-days, not people.
      caption: "Player days (sum of daily distinct)",
      value: formatAmount(overview.activePlayers),
      icon: Users,
    },
  ];

  return (
    <div className="h-full bg-[#15181E] p-3 md:p-6 space-y-4 md:space-y-6 overflow-y-auto">
      <div className="bg-[#161A21] px-5 py-3 rounded-lg text-md font-mono font-semibold text-gray-100 border border-[#242B35]">
        Report / <span className="text-white">Daily Report</span>
      </div>

      <div className="bg-[#191D24] rounded-xl p-2 flex flex-wrap items-center justify-between gap-2 shrink-0 border border-[#242B35]">
        <div className="flex items-center gap-3">
          <CurrencyToggle value={currency} onChange={setCurrency} />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="bg-[#1A2030] border-white/10 rounded-lg w-10 h-10 text-white hover:bg-[#252b3d] flex items-center justify-center shrink-0"
            onClick={() => setFilterOpen(true)}
          >
            <Filter size={20} className="text-[#B93DEB]" />
          </Button>

          <ExportCSV
            data={filteredData}
            fileName="daily_report.csv"
            getRowDate={(row) => row.date}
            headers={[
              "Date",
              "Total Players",
              "Total Bets",
              "Total Bet Amount",
              "Total Player Win",
              "GGR",
              "Purchase Amount",
              "Redeem Amount",
            ]}
            mapRow={(row) => [
              row.date ? row.date.slice(0, 10) : "",
              row.totalPlayers,
              row.totalBets,
              Number(row.totalBetAmt).toFixed(2),
              Number(row.totalWin).toFixed(2),
              Number(row.ggr).toFixed(2),
              Number(row.purchaseAmt ?? 0).toFixed(2),
              Number(row.redeemAmt ?? 0).toFixed(2),
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <StatCardsSkeleton count={4} />
      ) : (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.title}
              className="rounded-xl border border-[#242B35] bg-[#191D24] p-4 md:p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-500">
                    {card.title}
                  </p>
                  <p className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                    {card.value}
                  </p>
                  <p className="mt-2 text-xs text-gray-500">{card.caption}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-[#242B35] text-[#F59E0B]">
                  <Icon size={20} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      <div className="rounded-xl border border-[#242B35] bg-[#191D24] overflow-hidden scrollbar-hide">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[1200px] scrollbar-hide">
            <thead className="bg-[#242B35]">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-medium text-white">
                  Date
                </th>
                <th className="px-5 py-4 text-left text-xs font-medium text-white">
                  Total Players
                </th>
                <th className="px-5 py-4 text-left text-xs font-medium text-white">
                  Total Bets
                </th>
                <th className="px-5 py-4 text-left text-xs font-medium text-white">
                  Total Bet Amt
                </th>
                <th className="px-5 py-4 text-left text-xs font-medium text-white">
                  Total Player Win
                </th>
                <th className="px-5 py-4 text-left text-xs font-medium text-white">
                  GGR
                </th>
                <th className="px-5 py-4 text-left text-xs font-medium text-white">
                  Purchase Amt
                </th>
                <th className="px-5 py-4 text-left text-xs font-medium text-white">
                  Redeem Amt
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeletonRows rows={8} cols={8} />
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-sm text-gray-500"
                  >
                     <div className="text-gray-400">No report data found.</div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, index) => (
                  <tr
                    key={row.date}
                    className={
                      index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                    }
                  >
                    <td className="px-5 py-4 text-sm text-white">
                      {formatReportDate(row.date)}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-300">
                      {formatAmount(row.totalPlayers)}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-300">
                      {formatAmount(row.totalBets)}
                    </td>
                    <td className="px-5 py-4 text-sm text-white">
                      {formatMoney(row.totalBetAmt)}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-300">
                      {formatMoney(row.totalWin)}
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-[#F59E0B]">
                      {formatMoney(row.ggr)}
                    </td>
                    {/* Purchase and redeem are real money — always printed in
                        full, never through the Wulf Coins compaction. */}
                    <td className="px-5 py-4 text-sm text-emerald-400">
                      {(row.purchaseAmt ?? 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-5 py-4 text-sm text-rose-400">
                      {(row.redeemAmt ?? 0).toLocaleString(undefined, {
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
      {totalPages > 1 && (
        <div className="mt-4 rounded-xl border border-[#242B35] bg-[#191D24] px-3 py-3 md:px-5 flex justify-end">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}

      <ReportFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title="Daily Report Filters"
        description="Filter the daily report by date range and metric ranges."
        fields={[
          { kind: "datePreset" },
          { kind: "dateRange" },
          ...METRIC_FILTERS.map((m) => ({
            kind: "numberRange" as const,
            key: m.key,
            label: m.label,
          })),
        ] as FilterField[]}
        values={{
          startDate: storeFilters.startDate,
          endDate: storeFilters.endDate,
          userStatus: storeFilters.userStatus ?? "all",
          ...metricFilters,
        }}
        defaults={{ startDate: undefined, endDate: undefined, userStatus: "all", datePreset: "all" }}
        onApply={(v) => {
          // Split the drawer payload: date/status go to the store (they refetch),
          // the metric Min/Max pairs stay client-side.
          const nextMetrics: Record<string, number | undefined> = {};
          for (const m of METRIC_FILTERS) {
            nextMetrics[`${m.key}Min`] = v[`${m.key}Min`] as number | undefined;
            nextMetrics[`${m.key}Max`] = v[`${m.key}Max`] as number | undefined;
          }
          setMetricFilters(nextMetrics);
          setPage(1);
          setFilters({
            startDate: v.startDate,
            endDate: v.endDate,
            userStatus: (v.userStatus as string) ?? "all",
          });
        }}
      />
    </div>
  );
}
