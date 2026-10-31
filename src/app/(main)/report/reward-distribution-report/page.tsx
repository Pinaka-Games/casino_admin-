"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Search, Gift, Crown, Ticket, Coins, Wallet, Trophy, Award, Sparkles, Flag, Package, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import Pagination from "@/components/Pagination";
import ExportCSV from "@/components/ExportCSV";
import EngagementFilterSheet from "./components/EngagementFilterSheet";
import {
  useExpenseReportStore,
  type ExpenseDetailItem,
} from "@/store/expense-report-store";
import { TableSkeletonRows, StatCardsSkeleton } from "@/components/report/ReportSkeleton";
import CopyButton from "@/components/CopyButton";

const CURRENCY_LABEL: Record<string, string> = {
  wulf_coin: "Wulf Coin",
  wulf_cash: "Wulf Cash",
  wulfCoin: "Wulf Coin",
  wulfCash: "Wulf Cash",
  GC: "Wulf Coin",
  SC: "Wulf Cash",
};

const CARD_ICON: Record<string, React.ElementType> = {
  all: Wallet,
  bonus: Coins,
  bundle_bonus: Package,
  promotion: Gift,
  vip_tier: Crown,
  promo_code: Ticket,
  jackpot: Trophy,
  tournament: Award,
  free_spin: Sparkles,
  race: Flag,
};

const CATEGORY_BADGE: Record<string, string> = {
  bonus: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  bundle_bonus: "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20",
  promotion: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  vip_tier: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  promo_code: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  jackpot: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  tournament: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  free_spin: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  race: "bg-lime-500/10 text-lime-400 border-lime-500/20",
};

const money = (n: number) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function ExpenseReportPage() {
  const {
    categories,
    byType,
    summaryLoading,
    detailOpen,
    activeCategory,
    activeLabel,
    detailItems,
    detailTotal,
    categoryTotal,
    categoryPendingTotal,
    categoryPendingCount,
    detailStatus,
    setDetailStatus,
    detailLoading,
    detailPage,
    pageSize,
    filters,
    search,
    filterOpen,
    fetchSummary,
    openDetail,
    fetchAllDetail,
    closeDetail,
    setDetailPage,
    setFilters,
    setSearch,
    setFilterOpen,
  } = useExpenseReportStore();

  const [searchInput, setSearchInput] = useState("");

  const visibleDetail = detailItems;
  // Bundle rows sum a bonus and a discount; list both parts in their own columns.
  const isBundle = detailOpen && activeCategory === "bundle_bonus";
  const detailCols = isBundle ? 8 : 6;

  useEffect(() => {
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  return (
    <div className="h-full bg-[#15181E] p-3 md:p-6">
      <div className="h-full flex flex-col gap-4">
        {/* HEADER */}
        <div className="bg-[#191D24] px-3 py-3 md:px-4 rounded-lg flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-white text-base font-normal">
            Report / Reward Distribution Report
          </h1>
        </div>

        {/* FILTER BAR */}
        <div className="bg-[#15181E] p-2 rounded-xl flex items-center gap-3 border border-white/5">
          <Button
            variant="outline"
            size="icon"
            className="bg-[#1A2030] border-white/10 rounded-lg w-10 h-10 text-white hover:bg-[#252b3d] flex items-center justify-center shrink-0"
            onClick={() => setFilterOpen(true)}
          >
            <Filter size={20} className="text-[#B93DEB]" />
          </Button>

          <span className="text-gray-500 text-xs">
            {filters.startDate || filters.endDate
              ? `${
                  filters.startDate
                    ? format(filters.startDate, "MMM dd, yyyy")
                    : "…"
                } → ${
                  filters.endDate
                    ? format(filters.endDate, "MMM dd, yyyy")
                    : "…"
                }`
              : "All time"}
          </span>

          <div className="ml-auto flex gap-2">
            <ExportCSV<ExpenseDetailItem>
              data={detailItems}
              headers={[
                "Date",
                "User",
                "User ID",
                "Bonus (Where)",
                "Type",
                "Category",
                "Amount",
                "Currency",
                "Coin Amount",
                "Bundle Bonus",
                "Bundle Discount",
                "Status",
              ]}
              mapRow={(r) => [
                r.date ? format(new Date(r.date), "yyyy-MM-dd HH:mm") : "N/A",
                r.username,
                r.userId ?? "N/A",
                r.bonusName,
                r.bonusTypeLabel,
                r.category,
                r.amount,
                r.currency ? CURRENCY_LABEL[r.currency] ?? r.currency : "",
                r.secondaryAmount ?? "",
                r.bundleBonus ?? "",
                r.bundleDiscount ?? "",
                r.status,
              ]}
              fileName={`reward_distribution_report_${
                detailOpen ? activeCategory : "all"
              }.csv`}
              fetchAll={(range) =>
                fetchAllDetail({
                  startDate: range.from
                    ? format(range.from, "yyyy-MM-dd")
                    : undefined,
                  endDate: range.to
                    ? format(range.to, "yyyy-MM-dd")
                    : undefined,
                })
              }
              // On the overview the button exports every stream, so it is only
              // dead when the whole report is empty. It used to be disabled
              // until a card was opened, which left no way to export the lot.
              locked={
                detailOpen
                  ? detailTotal === 0
                  : (categories.find((c) => c.key === "all")?.count ?? 0) === 0
              }
              lockedTitle="Nothing to export for this range"
            />
          </div>
        </div>

        {/* SUMMARY CARDS */}
        {summaryLoading && categories.length === 0 ? (
          <StatCardsSkeleton count={10} />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {categories.map((c) => {
                const Icon = CARD_ICON[c.key] ?? Wallet;
                const isTotal = c.key === "all";
                const active = isTotal
                  ? !detailOpen
                  : detailOpen && activeCategory === c.key;
                return (
                  <button
                    key={c.key}
                    onClick={() =>
                      isTotal ? closeDetail() : openDetail(c.key, c.label)
                    }
                    className={`text-left p-4 md:p-5 rounded-xl border transition-all duration-300 cursor-pointer hover:border-[#B93DEB]/40 hover:-translate-y-0.5 ${
                      isTotal ? "bg-[#1A1420]" : "bg-[#15181E]"
                    } ${
                      active
                        ? "border-[#B93DEB] ring-1 ring-[#B93DEB]/40"
                        : "border-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-gray-400 text-xs font-bold uppercase tracking-tight">
                        {c.label}
                      </p>
                      <Icon
                        className={`w-4 h-4 ${
                          isTotal ? "text-[#B93DEB]" : "text-gray-500"
                        }`}
                      />
                    </div>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-xl sm:text-2xl font-black text-white tabular-nums">
                        {summaryLoading ? "---" : money(c.total)}
                      </h3>
                    </div>
                    <p className="text-gray-500 text-[10px] font-bold mt-1">
                      {c.count.toLocaleString()} grants ·{" "}
                      {isTotal ? "overview" : "click to view"}
                    </p>
                    {!summaryLoading && c.bundleBonusTotal != null && (
                      <p className="mt-1 text-[10px] font-bold text-gray-400 tabular-nums">
                        Bonus {money(c.bundleBonusTotal)} · Discount{" "}
                        {money(c.bundleDiscountTotal ?? 0)}
                      </p>
                    )}
                    {/* Rewards a player has been offered but not taken. Shown
                        apart from the headline because the platform has not
                        spent it — a pending VIP tier may never be claimed. */}
                    {!summaryLoading && (c.pendingTotal ?? 0) > 0 && (
                      <p className="mt-1 text-[10px] font-bold text-amber-400/80">
                        {money(c.pendingTotal ?? 0)} pending ·{" "}
                        {(c.pendingCount ?? 0).toLocaleString()} unclaimed
                      </p>
                    )}
                  </button>
                );
              })}
          </div>
        )}

        {/* MAIN PANEL: type breakdown OR detail drill-down */}
        {!detailOpen ? (
          // ── PER-TYPE BREAKDOWN ──
          <div className="bg-[#15181E] rounded-xl overflow-hidden border border-white/5 shadow-2xl">
            <div className="bg-[#1C2128] px-5 py-3 border-b border-white/5">
              <h2 className="text-[11px] font-black text-gray-300 uppercase tracking-widest">
                Expense by Stream
              </h2>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-[#1C2128]">
                  <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">
                    Expense Stream
                  </th>
                  <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">
                    Grants
                  </th>
                  <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">
                    Total Expense
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {summaryLoading ? (
                  <TableSkeletonRows rows={6} cols={3} />
                ) : byType.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="py-24 text-center text-gray-500 uppercase text-[10px] font-bold tracking-widest"
                    >
                      No expense for this range.
                    </td>
                  </tr>
                ) : (
                  byType.map((t) => {
                    const Icon = CARD_ICON[t.key] ?? Wallet;
                    return (
                      <tr
                        key={t.key}
                        onClick={() => openDetail(t.key, t.label)}
                        className="group hover:bg-[#1E252E] transition-all duration-150 cursor-pointer"
                      >
                        <td className="px-5 py-4">
                          <span className="flex items-center gap-2 text-xs font-bold text-white">
                            <Icon className="w-4 h-4 text-gray-500" />
                            {t.label}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-400 tabular-nums">
                          {t.count.toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-xs font-bold text-[#B93DEB] tabular-nums text-right">
                          {money(t.total)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          // ── DETAIL DRILL-DOWN ──
          <div className="bg-[#15181E] rounded-xl overflow-hidden border border-white/5 shadow-2xl">
            {/* Wraps on a phone: back, title, status tabs and search could not
                share one ~350px row, so the search box ran off the card. */}
            <div className="bg-[#1C2128] px-3 py-3 md:px-5 border-b border-white/5 flex flex-wrap items-center gap-3 md:flex-nowrap">
              <Button
                variant="outline"
                size="icon"
                onClick={closeDetail}
                className="h-8 w-8 bg-[#1a2030] text-gray-300 border-gray-700 hover:bg-[#252b3d] shrink-0"
                title="Back to overview"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex flex-col">
                <h2 className="text-[11px] font-black text-white uppercase tracking-widest">
                  {activeLabel} — Detail
                </h2>
                <span className="text-[10px] text-gray-500 font-bold">
                  {detailTotal.toLocaleString()} rows · Total{" "}
                  {money(categoryTotal)}
                  {categoryPendingTotal > 0 && (
                    <span className="text-amber-400/80">
                      {" "}· {money(categoryPendingTotal)} pending (
                      {categoryPendingCount.toLocaleString()})
                    </span>
                  )}
                </span>
              </div>

              {/* Claimed by default: the report states what the platform SPENT,
                  and a reward the player has not taken is a promise, not an
                  expense. The other two views are one click away. */}
              <div className="ml-auto flex items-center gap-1 rounded-lg border border-white/5 bg-[#15181E] p-0.5">
                {(["claimed", "pending", "all"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDetailStatus(s)}
                    className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                      detailStatus === s
                        ? "bg-[#B93DEB] text-white"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-auto">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setSearch(searchInput.trim());
                  }}
                  onBlur={() => {
                    if (searchInput.trim() !== search)
                      setSearch(searchInput.trim());
                  }}
                  placeholder="Search user / bonus..."
                  className="bg-[#1a2030] border border-gray-700 rounded-lg pl-9 pr-3 h-9 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-[#B93DEB]/50 w-full md:w-56"
                />
              </div>
            </div>

            {/* Own scroller: the card clipped the table on a phone with no way
                to reach the Amount column. The header above stays put. */}
            <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-[#1C2128]">
                  <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">
                    Date
                  </th>
                  <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">
                    User
                  </th>
                  <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">
                    Bonus (Where)
                  </th>
                  <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">
                    Type
                  </th>
                  <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">
                    Status
                  </th>
                  {isBundle && (
                    <>
                      <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">
                        Bundle Bonus
                      </th>
                      <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">
                        Bundle Discount
                      </th>
                    </>
                  )}
                  <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {detailLoading ? (
                  <TableSkeletonRows rows={8} cols={detailCols} />
                ) : visibleDetail.length === 0 ? (
                  <tr>
                    <td
                      colSpan={detailCols}
                      className="py-24 text-center text-gray-500 uppercase text-[10px] font-bold tracking-widest"
                    >
                      No records found.
                    </td>
                  </tr>
                ) : (
                  visibleDetail.map((r) => (
                    <tr
                      key={r.id}
                      className="group hover:bg-[#1E252E] transition-all duration-150"
                    >
                      <td className="px-5 py-4 text-xs text-white/50 group-hover:text-white transition-colors whitespace-nowrap">
                        {r.date
                          ? format(new Date(r.date), "MMM dd, HH:mm")
                          : "N/A"}
                      </td>
                      <td className="px-5 py-4 text-xs">
                        <div className="flex flex-col">
                          <span className="flex items-center gap-1.5 text-white font-bold">
                            {r.username}
                            <CopyButton value={r.username} />
                          </span>
                          <span className="flex items-center gap-1.5 text-gray-600 text-[10px]">
                            {r.userId
                              ? `ID: ${r.userId.slice(0, 8)}…`
                              : "N/A"}
                            <CopyButton value={r.userId} />
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-300">
                        {r.bonusName}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-1 rounded-md border uppercase ${
                            CATEGORY_BADGE[r.category] ?? CATEGORY_BADGE.bonus
                          }`}
                        >
                          {r.bonusTypeLabel}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-400 capitalize">
                        {r.status}
                      </td>
                      {isBundle && (
                        <>
                          <td className="px-5 py-4 text-xs text-white/80 tabular-nums text-right whitespace-nowrap">
                            {money(r.bundleBonus ?? 0)}
                          </td>
                          <td className="px-5 py-4 text-xs text-white/80 tabular-nums text-right whitespace-nowrap">
                            {money(r.bundleDiscount ?? 0)}
                          </td>
                        </>
                      )}
                      <td className="px-5 py-4 text-xs font-bold text-[#B93DEB] tabular-nums text-right whitespace-nowrap">
                        {money(r.amount)}
                        {r.currency && (
                          <span className="text-gray-500 ml-1 font-normal">
                            {CURRENCY_LABEL[r.currency] ?? r.currency}
                          </span>
                        )}
                        {/* The grant's non-cash half. A tier that hands out only
                            Wulf Coin would otherwise read as a bare 0.00. */}
                        {(r.secondaryAmount ?? 0) > 0 && (
                          <div className="text-[10px] font-normal text-amber-400/70">
                            {(r.secondaryAmount ?? 0).toLocaleString("en-US", {
                              maximumFractionDigits: 0,
                            })}{" "}
                            {r.secondaryCurrency
                              ? CURRENCY_LABEL[r.secondaryCurrency] ??
                                r.secondaryCurrency
                              : ""}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {detailOpen && !detailLoading && detailTotal > pageSize && (
          <div className="mt-4 rounded-xl border border-[#242B35] bg-[#191D24] px-3 py-3 md:px-5 flex justify-end">
            <Pagination
              currentPage={detailPage}
              totalPages={Math.ceil(detailTotal / pageSize)}
              onPageChange={setDetailPage}
            />
          </div>
        )}
      </div>

      <EngagementFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onApply={(newFilters) => setFilters(newFilters)}
      />
    </div>
  );
}
