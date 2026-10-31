"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  SortableTh,
  useSortedRows,
  useTableSort,
} from "@/components/filters/tableSort";
import FilterToolbar from "@/components/filters/FilterToolbar";
import EntityFilterSheet from "@/components/filters/EntityFilterSheet";
import { useEntityFilters } from "@/components/filters/useEntityFilters";
import { applyClientFilters } from "@/components/filters/applyClientFilters";
import type { FilterField, FilterValues } from "@/components/filters/types";
import { profileApi } from "@/api/users/users";
import {
  ReferralStats,
  ReferralDetail,
  UserWithProfile,
  EarningRecord,
} from "@/types/profile.type";
import NoData from "@/components/NoData";
import { format, parseISO } from "date-fns";
import Pagination from "@/components/Pagination/Pagination";
import { 
  CircleDollarSign, 
  Loader2, 
  Calendar, 
  User as UserIcon 
} from "lucide-react";

interface RevenueTabProps {
  agent: UserWithProfile;
}


const EARNINGS_FILTER_DEFAULTS: FilterValues = {
  search: "",
  result: "all",
  from: "",
  to: "",
  minCommission: "",
  maxCommission: "",
  minBet: "",
  maxBet: "",
};

const EARNINGS_FILTER_FIELDS: FilterField[] = [
  {
    type: "select",
    key: "result",
    label: "Commission",
    options: [
      { label: "All Entries", value: "all" },
      { label: "Earned (positive)", value: "positive" },
      { label: "Clawed back (negative)", value: "negative" },
      { label: "Zero", value: "zero" },
    ],
  },
  { type: "dateRange", fromKey: "from", toKey: "to", label: "Date Range" },
  { type: "numberRange", minKey: "minCommission", maxKey: "maxCommission", label: "Commission" },
  { type: "numberRange", minKey: "minBet", maxKey: "maxBet", label: "Bet Amount" },
];
const RevenueTab = ({ agent }: RevenueTabProps) => {
  const agentId = agent?.id;
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [earnings, setEarnings] = useState<EarningRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [earningsPage, setEarningsPage] = useState(1);

  const {
    values: filters,
    setValues: setFilters,
    searchInput,
    setSearchInput,
    sheetOpen,
    setSheetOpen,
    chips,
    activeCount,
    hasAnyFilter,
    reset: resetFilters,
  } = useEntityFilters({
    fields: EARNINGS_FILTER_FIELDS,
    defaults: EARNINGS_FILTER_DEFAULTS,
  });
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchData = async () => {
      if (!agentId) return;
      try {
        setLoading(true);
        const [statsRes, earningsRes] = await Promise.all([
           profileApi.getAgentReferralStatsById(agentId),
           profileApi.getAgentEarningHistoryById(agentId)
        ]);
        setStats(statsRes.data);
        setEarnings(earningsRes.data || []);
      } catch (error) {
        console.error("Failed to fetch referral data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [agentId]);

  const filteredEarnings = useMemo(
    () =>
      applyClientFilters(earnings || [], filters, {
        search: (r) => [r.id, r.gameLogId, r.referee?.username, r.refereeId, r.status],
        selects: [
          {
            key: "result",
            match: (r, v) => {
              const commission = Number(r.commissionAmount || 0);
              if (v === "positive") return commission > 0;
              if (v === "negative") return commission < 0;
              return commission === 0;
            },
          },
        ],
        dateRange: { fromKey: "from", toKey: "to", get: (r) => r.createdAt },
        numberRanges: [
          {
            minKey: "minCommission",
            maxKey: "maxCommission",
            get: (r) => Number(r.commissionAmount || 0),
          },
          {
            minKey: "minBet",
            maxKey: "maxBet",
            get: (r) => Number(r.betTotalAmount ?? r.wagerAmount ?? 0),
          },
        ],
      }),
    [earnings, filters],
  );

  // The earning history is loaded whole, so sorting covers every row.
  const { sort, toggle } = useTableSort<"date" | "bet" | "ggr" | "ngr" | "commission">();
  const visibleEarnings = useSortedRows(filteredEarnings, sort, {
    date: (row) => new Date(row.createdAt).getTime(),
    bet: (row) => Number(row.betTotalAmount ?? row.wagerAmount ?? 0),
    // GGR is the house result: stake minus payout, i.e. −netProfit.
    ggr: (row) => -Number(row.netProfit || 0),
    // Same derivation the NGR cell renders: GGR − purchase fee − platform fee,
    // preferring the server's own figure when it sent one.
    ngr: (row) => {
      const ggr = -Number(row.netProfit || 0);
      const purchaseFee = Number((row as any).purchaseFeeAllocated || 0);
      const platformFee = Number((row as any).platformFeeApplied || 0);
      return Number((row as any).ngrAmount ?? ggr - purchaseFee - platformFee);
    },
    commission: (row) => Number(row.commissionAmount || 0),
  });

  // A narrowed filter can leave fewer pages than the one being viewed.
  useEffect(() => {
    setEarningsPage(1);
  }, [filters]);

  const totalPages = Math.ceil(visibleEarnings.length / itemsPerPage);
  const currentEarnings = visibleEarnings.slice(
    (earningsPage - 1) * itemsPerPage,
    earningsPage * itemsPerPage,
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#B93DEB]" />
      </div>
    );
  }

  if (!stats) {
    return <NoData title="No revenue data found" />;
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500 md:space-y-8">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Affiliate wallet's claimable balance — the Wallet tab's
            "Available". `agent.wallet.wulfCash` is the PLAYER wallet, which
            commission never lands in, so this card sat at 0.00 for agents. */}
        <StatCard
          title="Wallet Balance"
          value={Math.max(0, Number(stats.availableBalance ?? 0)).toFixed(2)}
          sub="Available Cash"
        />
        <StatCard
          title="Total Downline Members"
          value={stats.totalReferrals.toString()}
        />
        {/* Ledger truth, so the card reconciles with the Commission column
            below and with the Downline per-player totals. `totalEarnings` is
            the affiliate WALLET balance — a different system that does not
            add up to the rows on this page. */}
        <StatCard
          title="Total Earnings"
          value={Number(
            stats.totalEarnedAllTime ?? stats.totalEarnings ?? 0,
          ).toFixed(2)}
          sub="All time"
        />
        <StatCard
          title="Pending Income"
          value={stats.pendingIncome.toFixed(2)}
          sub="Wait to claim"
        />
      </div>

      {/* Earnings Table */}
      <div className="bg-[#191D24] rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-3 py-4 border-b border-gray-800 bg-black/10 md:px-6">
          <FilterToolbar
            title="Earnings Overview"
            countLabel={`${visibleEarnings.length} ${visibleEarnings.length === 1 ? "entry" : "entries"}`}
            searchValue={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder="Search entry, player or round"
            activeCount={activeCount}
            chips={chips}
            hasAnyFilter={hasAnyFilter}
            onOpenFilters={() => setSheetOpen(true)}
            onResetAll={resetFilters}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left border-collapse">
            <thead className="bg-black/20 border-b border-gray-800">
              <tr>
                <SortableTh
                  label="Date"
                  sortKey="date"
                  sort={sort}
                  onToggle={toggle}
                  align="left"
                  className="px-6 py-3 text-[10px] font-black text-gray-500 uppercase tracking-widest"
                />
                <th className="px-6 py-3 text-[10px] font-black text-gray-500 uppercase tracking-widest">Player</th>
                <SortableTh
                  label="Bet"
                  sortKey="bet"
                  sort={sort}
                  onToggle={toggle}
                  align="right"
                  className="px-6 py-3 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right"
                />
                <th className="px-6 py-3 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right" title="What the house paid back on this round (0 on a full loss).">Payout</th>
                <th className="px-6 py-3 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right" title="Bonus cash the player staked — granted credit, not real money, so it is not part of GGR or NGR.">Bonus</th>
                <th className="px-6 py-3 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right" title="Real Wulf Cash staked on this round = Bet − Bonus. The 6% purchase-fee base and the only part that generates GGR.">Real Stake</th>
                <SortableTh
                  label="GGR"
                  sortKey="ggr"
                  sort={sort}
                  onToggle={toggle}
                  align="right"
                  className="px-6 py-3 text-[10px] font-black text-yellow-500/80 uppercase tracking-widest text-right"
                />
                <th className="px-6 py-3 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Platform Fee</th>
                <SortableTh
                  label="NGR"
                  sortKey="ngr"
                  sort={sort}
                  onToggle={toggle}
                  align="right"
                  className="px-6 py-3 text-[10px] font-black text-emerald-400 uppercase tracking-widest text-right"
                />
                <SortableTh
                  label="Commission"
                  sortKey="commission"
                  sort={sort}
                  onToggle={toggle}
                  align="right"
                  className="px-6 py-3 text-[10px] font-black text-green-500 uppercase tracking-widest text-right"
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 font-medium">
              {currentEarnings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-20 text-center">
                    <p className="text-gray-500 text-sm italic">
                      {hasAnyFilter
                        ? "No earnings match these filters."
                        : "No earnings recorded for this agent."}
                    </p>
                  </td>
                </tr>
              ) : (
                currentEarnings.map((record: EarningRecord) => {
                  // GGR = stake − payout = −netProfit (the house's real result).
                  // Negative when the player won. Bonus is NOT part of GGR.
                  const bonus = Number((record as any).bonusWagerAmount || 0);
                  // Full round turnover (real + bonus stake) and the payout,
                  // both server-resolved from the gameplay log. `wagerAmount`
                  // is only the commissionable real share, so it is not "Bet".
                  const betTotal = Number(
                    (record as any).betTotalAmount ?? record.wagerAmount ?? 0,
                  );
                  const payout = Number((record as any).payoutAmount ?? 0);
                  // Real Wulf Cash staked — the commissionable, fee-bearing
                  // share of the bet (server-resolved).
                  const realStake = Number(
                    (record as any).realWager ?? Math.max(0, betTotal - bonus),
                  );
                  // Rate the accrual actually used for this round.
                  const commissionPct = Number(record.commissionPercent || 0);
                  const grossAmount = -(Number((record as any).netProfit) || 0);
                  const isPositiveGGR = grossAmount > 0;
                  // Purchase-processing fee: 6% of the REAL Wulf Cash staked
                  // on this round (server-computed; bonus stake carries no
                  // fee). Per-round basis — product decision 2026-08-17.
                  const purchaseFee = Number((record as any).purchaseFeeAllocated || 0);
                  // Platform fee % actually applied to this round (resolved server-side).
                  const feePct = Number((record as any).platformFeePercent || 0);
                  // Platform fee is charged on GGR — the same base the accrual uses.
                  // Signed: a player win returns it as a credit.
                  const platformFee = Number((record as any).platformFeeApplied || 0);
                  // NGR = GGR − Purchase Fee − Platform Fee (bonus already excluded from GGR).
                  const ngr = Number(
                    (record as any).ngrAmount ?? grossAmount - purchaseFee - platformFee,
                  );
                  // Commission is the LEDGER value the backend accrued for this
                  // round (commission% × GGR + plan bonus, net of platform fees) —
                  // the amount that actually credits the affiliate wallet.
                  //
                  // It used to be re-derived here as `ngr × (commissionAmount /
                  // GGR)`, which is a third basis: it silently re-applied the
                  // purchase + platform fees on top of a rate that had already
                  // been netted of them. The same rounds therefore showed one
                  // number here, a different one in the Wallet tab (raw
                  // commissionAmount) and a third per player in the Downline tab
                  // (totalIncome = SUM of commissionAmount). Reading the ledger
                  // makes all three agree.
                  //
                  // Forfeited rows (accrued while the agent was inactive) are
                  // reporting-only and count as 0, matching the backend's
                  // getEffectiveCommissionSql used by the totals.
                  const commission = (record as any).forfeitReason
                    ? 0
                    : Number(record.commissionAmount || 0);

                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <span className="text-[11px] text-gray-400 block">
                          {format(parseISO(record.createdAt), "MMM dd, yyyy")}
                        </span>
                        <span className="text-[9px] text-gray-600">
                          {format(parseISO(record.createdAt), "HH:mm")}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-black text-white truncate max-w-[120px]">
                          {record.referee?.username ||
                            record.refereeId.slice(0, 8)}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-[11px] font-bold text-gray-300 font-mono">
                          {betTotal.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-[11px] font-bold text-gray-300 font-mono">
                          {payout.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-[11px] font-bold text-gray-300 font-mono">
                          {bonus ? bonus.toFixed(2) : "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-[11px] font-bold text-gray-300 font-mono">
                          {realStake ? realStake.toFixed(2) : "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span
                          className={`text-[12px] font-black font-mono ${isPositiveGGR ? "text-orange-500" : "text-red-500"}`}
                        >
                          {grossAmount > 0 ? "+" : ""}
                          {grossAmount.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {platformFee !== 0 ? (
                          <span className={`text-[11px] font-bold font-mono ${platformFee > 0 ? "text-red-400" : "text-green-400"}`}>
                            {platformFee > 0 ? "−" : "+"}{Math.abs(platformFee).toFixed(2)}
                            <span className="text-[9px] opacity-70 ml-1">
                              ({feePct.toFixed(1)}%)
                            </span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold text-gray-500 font-mono">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span
                          className={`text-[12px] font-black font-mono ${ngr >= 0 ? "text-emerald-400" : "text-red-400"}`}
                        >
                          {ngr.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span
                          className={`text-[13px] font-black italic tracking-tighter ${
                            commission > 0
                              ? "text-green-400"
                              : commission < 0
                                ? "text-red-400"
                                : "text-gray-400"
                          }`}
                        >
                          {commission > 0 ? "+" : ""}
                          {commission.toFixed(2)}
                          {commissionPct > 0 && (
                            <span className="text-[9px] not-italic font-bold opacity-70 ml-1">
                              ({commissionPct.toFixed(1)}%)
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-4 bg-black/10 border-t border-gray-800 md:px-6">
            <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest hidden sm:block">
              Showing {(earningsPage - 1) * itemsPerPage + 1} to {Math.min(earningsPage * itemsPerPage, visibleEarnings.length)} of {visibleEarnings.length} entries
            </p>
            <Pagination
              currentPage={earningsPage}
              totalPages={totalPages}
              onPageChange={setEarningsPage}
            />
          </div>
        )}
      </div>

      <EntityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Earnings Filters"
        description="Filter this agent's earning entries"
        fields={EARNINGS_FILTER_FIELDS}
        values={filters}
        defaults={EARNINGS_FILTER_DEFAULTS}
        onApply={setFilters}
      />
    </div>
  );
};

/* ================= STAT CARD ================= */
const StatCard = ({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub?: string;
}) => {
  return (
    <div className="bg-[#15181E] rounded-xl p-4 space-y-2 border md:p-5 border-gray-800/50 hover:border-gray-700 transition-colors">
      <div className="flex justify-between items-center">
        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">
          {title}
        </p>
        {sub && (
          <p className="text-gray-500 text-[10px] whitespace-nowrap bg-gray-800/40 px-2 py-0.5 rounded uppercase">
            {sub}
          </p>
        )}
      </div>

      <p className="text-white text-2xl font-black tracking-tight">{value}</p>
    </div>
  );
};

export default RevenueTab;
