"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Eye,
  Sliders,
  Info,
  X,
} from "lucide-react";
import TableSkeleton from "@/components/TableSkeleton";
import CopyButton from "@/components/CopyButton";
import {
  FeatureGate,
} from "@/app/agent-management/components/FeatureGate";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useAgentPackageStore } from "@/store/agent-package.store";
import { connectSocket } from "@/lib/socket";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NoData from "@/components/NoData";
import Pagination from "@/components/Pagination";
import ExportCSV from "@/components/ExportCSV";
import { EarningRecord } from "@/types/profile.type";
import { profileApi } from "@/api/users/users";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  AgentFilterSheet,
  FilterState,
} from "@/app/agent-management/components/AgentFilterSheet";
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
const ROW_GRID =
  "grid-cols-[120px_1fr_0.8fr_0.8fr_0.8fr_0.8fr_1fr_0.9fr_1fr_0.8fr_1fr_1fr_80px]";

export default function CommissionLedger() {
  const { user: authUser, hasRole } = useAuth();
  const { canViewWalletTransactions, canExportReports } = useFeatureAccess();
  const { currentPackage, fetchCurrentPackage } = useAgentPackageStore();
  const isSubAgent =
    authUser?.roles?.some((r) => r.name.toLowerCase().includes("sub")) ?? false;
  const effectiveCanViewWalletTransactions = isSubAgent || canViewWalletTransactions;

  useEffect(() => {
    fetchCurrentPackage();
  }, [fetchCurrentPackage]);

  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [earnings, setEarnings] = useState<EarningRecord[]>([]);

  // Sidebar Filter State
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    status: "All",
    startDate: undefined,
    endDate: undefined,
  });

  const [selectedLog, setSelectedLog] = useState<EarningRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    fetchEarnings();
  }, []);

  // Live-refresh the ledger when a new commission is recorded for this agent.
  // Backend emits to both user:{id} and admin:{id} rooms (emitToUserAndAdmin),
  // so agents/sub-agents on the admin panel receive it too.
  useEffect(() => {
    const socket = connectSocket();
    const refresh = () => fetchEarnings();
    socket.on("affiliate.earning.created", refresh);
    socket.on("affiliate.stats.updated", refresh);
    return () => {
      socket.off("affiliate.earning.created", refresh);
      socket.off("affiliate.stats.updated", refresh);
    };
  }, []);

  const fetchEarnings = async () => {
    try {
      setLoading(true);
      const response = await profileApi.getEarningHistory();
      setEarnings(response.data || []);
    } catch (error) {
      console.error("Failed to fetch earnings:", error);
      toast.error("Failed to load commission logs");
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    let result = [...earnings];
    if (search) {
      result = result.filter(
        (item) =>
          item.referee?.username
            ?.toLowerCase()
            .includes(search.toLowerCase()) ||
          item.id.toLowerCase().includes(search.toLowerCase()) ||
          item.gameLogId?.toLowerCase().includes(search.toLowerCase()),
      );
    }

    if (filters.startDate) {
      result = result.filter(
        (item) => new Date(item.createdAt) >= filters.startDate!,
      );
    }

    if (filters.endDate) {
      result = result.filter(
        (item) => new Date(item.createdAt) <= filters.endDate!,
      );
    }

    return result;
  }, [search, filters, earnings]);

  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredData.slice(start, start + PAGE_SIZE);
  }, [filteredData, currentPage]);

  const handleApplyFilters = (newFilters: FilterState) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const isAdmin = hasRole("ADMIN") || hasRole("superadmin") || hasRole("admin");
  // null = closed, "ALL" = every column, or a single column key.
  const [formulaKey, setFormulaKey] = useState<string | null>(null);

  return (
    <div className={PAGE_SHELL}>
      {/* HEADER BREADCRUMB */}
      <div className={PAGE_HEAD}>
        <h1 className={PAGE_TITLE}>
          {authUser?.roles?.some((r) => r.name.toLowerCase().includes("sub"))
            ? "Sub-Agent Management"
            : "Agent Management"}{" "}
          / Commission Ledger
        </h1>
        <button
          onClick={() => setFormulaKey("ALL")}
          title="How each column is calculated"
          className="shrink-0 flex items-center gap-1.5 text-purple-400 hover:text-purple-300 text-xs font-medium"
        >
          <Info size={16} className="shrink-0" />
          {/* Label is the first thing worth dropping when the breadcrumb needs
              the room — the icon plus its tooltip still explains the control. */}
          <span className="hidden sm:inline">How it&apos;s calculated</span>
        </button>
      </div>

      <div className="flex flex-col gap-4 md:gap-6 md:flex-1 md:min-h-0">
        {/* TOOLBAR */}
        <div className={TOOLBAR}>
          <div className={TOOLBAR_SEARCH}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-purple-500 transition-colors" />
            <Input
              placeholder="Search Player, Game or ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-[#242B35]! border-none text-white placeholder:text-gray-500 text-sm h-10 pl-10 focus:ring-1 focus:ring-purple-500/30 font-medium"
            />
          </div>

          <Button
            onClick={() => setFilterOpen(true)}
            className={`h-10 w-10 p-0 bg-[#242B35] border-none text-gray-400 hover:text-white hover:bg-transparent transition-all flex items-center justify-center shrink-0 ${
              filters.status !== "All" || filters.startDate || filters.endDate
                ? "border border-purple-500/50 text-purple-500"
                : ""
            }`}
          >
            <Sliders size={18} />
          </Button>

          <div className="hidden sm:block h-6 w-px bg-gray-800 mx-1" />

          <ExportCSV
            data={filteredData}
            locked={!canExportReports}
            lockedTitle="Upgrade plan to export"
            fileName="commission_ledger.csv"
            headers={["ID", "User", "Bet Amount", "Payout", "Bonus", "Real Stake", "GGR", "Platform Fee", "NGR", "Comm %", "Commission", "Date"]}
            mapRow={(row) => {
              const bonus = Number((row as any).bonusWagerAmount || 0);
              // Server-resolved round turnover (from the gameplay log); the
              // real+bonus sum stays as the fallback for pre-column rows.
              const betAmount = Number(
                (row as any).betTotalAmount ?? Number((row as any).realWager || 0) + bonus,
              );
              const payoutAmount = Number((row as any).payoutAmount || 0);
              const ggr = -(Number(row.netProfit) || 0); // GGR = −netProfit (house result)
              // Server-computed NGR economics — see the table below for why the
              // fee is charged on GGR and not on the bet.
              const fee = Number((row as any).platformFeeApplied || 0);
              const purchaseFee = Number((row as any).purchaseFeeAllocated || 0);
              const ngr = Number((row as any).ngrAmount ?? ggr - purchaseFee - fee);
              // Ledger commission — what actually credited the wallet (0 when
              // forfeited), NOT rate × NGR. Matches the on-screen column.
              const commission = (row as any).forfeitReason
                ? 0
                : Number(row.commissionAmount || 0);
              return [
                row.id,
                row.referee?.username || row.refereeId,
                betAmount,
                payoutAmount,
                bonus,
                Number((row as any).realWager || 0),
                ggr,
                fee,
                ngr,
                row.commissionPercent,
                commission,
                row.createdAt,
              ];
            }}
            getRowDate={(row) => row.createdAt}
          />
        </div>

        {/* DATA SECTION */}
        <div className="flex flex-col md:flex-1 md:min-h-0 bg-[#191D24] rounded-xl border border-gray-800 overflow-x-auto agent-x-scroll">
          <div className="flex flex-col md:flex-1 md:min-h-0">
            {/* Table Header — Always Visible */}
            <div className={`grid ${ROW_GRID} gap-3 sm:gap-4 px-4 sm:px-6 py-3 bg-[#242B35] border-b border-gray-800 shrink-0 min-w-[1740px] lg:min-w-0`}>
                <span className="text-xs font-normal text-gray-300">Entry ID</span>
                <span className="text-xs font-normal text-gray-300">Game / Player</span>
                <ColHeader label="Bet Amount" tip="Total staked on this round = real Wulf Cash + bonus cash. The real portion is what carries the 6% purchase fee and generates GGR." onInfo={() => setFormulaKey("Bet Amount")} />
                <ColHeader label="Payout" tip="What the house paid back on this round — 0 on a full loss. GGR = real stake − payout." onInfo={() => setFormulaKey("Payout")} />
                <ColHeader label="Bonus" tip="Bonus cash the player staked — informational only. It is granted credit, not real money, so it is not part of GGR or NGR." onInfo={() => setFormulaKey("Bonus")} />
                <ColHeader label="Real Stake" tip="Real Wulf Cash staked on this round = Bet Amount − Bonus. It is the 6% purchase-fee base and the only part that generates GGR." onInfo={() => setFormulaKey("Real Stake")} />
                <ColHeader label="GGR" tip="GGR = real money staked − payout = −netProfit (the house's result on real money). POSITIVE when the house won (player lost), NEGATIVE when the player won. Bonus is not part of GGR." onInfo={() => setFormulaKey("GGR")} />
                <ColHeader label="Platform Fee" tip="Platform Fee = fee% × GGR — the base the commission engine actually charges. Applies every round; a player win (negative GGR) returns it as a credit. The % is shown in brackets." onInfo={() => setFormulaKey("Platform Fee")} />
                <ColHeader label="NGR" tip="NGR = GGR − Purchase Fee − Platform Fee. The Purchase Fee is 6% of the REAL Wulf Cash staked on this round (bonus stake carries no fee) — e.g. a 200 real bet carries a 12.00 fee. Negative when the player won (agent clawback)." onInfo={() => setFormulaKey("NGR")} />
                <ColHeader label="Comm %" tip="The agent's commission rate for this game category (base rate + any package plan bonus)." onInfo={() => setFormulaKey("Comm %")} />
                <ColHeader label="Commission" tip="The commission actually credited to the wallet for this round (net of the platform fee taken at accrual). For sub-agent rounds, the agent's cut after the sub-agent's split. Forfeited rounds show 0." onInfo={() => setFormulaKey("Commission")} />
                <span className="text-xs font-normal text-gray-300">Date</span>
                <span className="text-xs font-normal text-gray-300 text-center">Action</span>
            </div>

            <FeatureGate allowed={effectiveCanViewWalletTransactions} showHeader={false}>
                <div className="md:flex-1 md:min-h-0 lg:overflow-y-auto scrollbar-hide min-w-[1740px] lg:min-w-0">
                    <div className="divide-y divide-gray-800/30">
                        {loading ? (
                            <TableSkeleton rows={10} cols={7} />
                        ) : paginatedData?.length === 0 ? (
                            <div className="py-20 text-center"><NoData title="No commissions found" /></div>
                        ) : (
                            paginatedData.map((row, index) => {
                                const dateObj = new Date(row.createdAt);
                                // Sub-agent split (rate-derived, consistent with the detail popup).
                                const isSubAgentRow =
                                  (row as any).source === "SUB_AGENT" &&
                                  Number((row as any).deductionPercent || 0) > 0;
                                // Bonus cash staked on this round.
                                const bonusRow = Number((row as any).bonusWagerAmount || 0);
                                // GGR = stake − payout = −netProfit (the house's real result).
                                // Positive when the house won (player lost), NEGATIVE when the
                                // player won (house paid out). Bonus is NOT part of GGR.
                                const ggrRowVal = -(Number(row.netProfit) || 0);
                                // Platform fee % actually applied to this round (recorded
                                // breakdown %, else current active %) — resolved server-side.
                                const feePctRow = Number((row as any).platformFeePercent || 0);
                                // Platform fee is charged on GGR, the same base the accrual
                                // uses, so the ledger shows the fee that was really deducted.
                                // Deriving it from the bet overstated it on every partially
                                // lost round (bet 10, GGR 4 → 1.0 shown, 0.4 charged).
                                const platformFeeRow = Number((row as any).platformFeeApplied || 0);
                                // Purchase-processing fee: 6% of the REAL Wulf Cash
                                // staked on this round (server-computed; bonus stake
                                // carries no fee). Product decision 2026-08-17: per-round
                                // basis, so every row is self-explanatory — a 200 real
                                // bet carries a 12.00 fee, regardless of what bundle
                                // the player bought.
                                const purchaseFeeRow = Number((row as any).purchaseFeeAllocated || 0);
                                // Total stake on the round: real + bonus. realWager is
                                // server-resolved (persisted realWagerAmount, or a
                                // fallback for pre-column rows); 0 + 0 → "—".
                                const realWagerRow = Number((row as any).realWager || 0);
                                // Turnover as the player saw it. Prefer the
                                // server value read from the gameplay log; rows
                                // recorded before it existed fall back to the
                                // real + bonus split.
                                const betAmountRow = Number(
                                  (row as any).betTotalAmount ?? realWagerRow + bonusRow,
                                );
                                const payoutRow = Number((row as any).payoutAmount || 0);
                                // NGR = GGR − Purchase Fee − Platform Fee. Bonus is already
                                // excluded from GGR, so it is NOT subtracted again.
                                const ngrBaseRow = Number(
                                  (row as any).ngrAmount ??
                                    ggrRowVal - purchaseFeeRow - platformFeeRow,
                                );
                                // Forfeited rows (accrued while the referrer was
                                // inactive, or fully bonus-funded) are reporting-only:
                                // the money stayed with the platform, so the
                                // commission columns must read 0 — matching
                                // getEffectiveCommissionSql and the Revenue tab.
                                // GGR/NGR keep their values; only the payout is void.
                                const isForfeited = !!(row as any).forfeitReason;
                                // Commission = the LEDGER value (commissionAmount /
                                // deductionAmount), the money that actually credited
                                // the wallets — already net of the platform fee taken
                                // at accrual. Deriving it as rate × NGR here showed a
                                // figure ~3× smaller than what agents were really paid
                                // on cash play (the 6%-of-stake purchase fee is a
                                // display-only deduction, never charged to wallets)
                                // and disagreed with the dashboard, the agent/sub-agent
                                // admin views and the Wallet tab, which all read the
                                // ledger. NGR stays in its own column as the revenue
                                // metric; commission is a real payment, not a formula.
                                const agentNetRow = isForfeited
                                  ? 0
                                  : Number(row.commissionAmount || 0);
                                const subPayoutRow =
                                  isSubAgentRow && !isForfeited
                                    ? Number((row as any).deductionAmount || 0)
                                    : 0;
                                const sign = (n: number) => (n >= 0 ? "+" : "−");
                                // Two decimals like every other money figure in
                                // the portal (QA #43): bare toLocaleString()
                                // printed the raw stored precision — the agent's
                                // own list said +3.44 while this ledger said
                                // +3.445 for the same row.
                                const money2 = (n: number) =>
                                    Math.abs(n).toLocaleString(undefined, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    });
                                // GGR / NGR / platform fee: four decimals, matching the admin ledger.
                                const money4 = (n: number) =>
                                    Math.abs(n).toLocaleString(undefined, {
                                        minimumFractionDigits: 4,
                                        maximumFractionDigits: 4,
                                    });
                                // Commission only: a low rate on a small round earns
                                // fractions of a cent (0.5% × 0.42 = 0.0021) that the
                                // ledger stores at 8 decimals — 2 decimals read "+0.00".
                                const money5 = (n: number) =>
                                    Math.abs(n).toLocaleString(undefined, {
                                        minimumFractionDigits: 5,
                                        maximumFractionDigits: 5,
                                    });
                                return (
                                    <div key={row.id} className={`grid ${ROW_GRID} gap-3 sm:gap-4 px-4 sm:px-6 py-4 items-center hover:bg-[#1a2030] transition-colors ${index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"}`}>
                                        <div className="flex items-center gap-1.5"><span className="text-gray-300 text-xs font-mono truncate uppercase">{row.id.slice(0, 8)}</span><CopyButton value={row.id} /></div>
                                        <div className="min-w-0 flex flex-col justify-center">
                                            <div className="text-gray-300 text-xs font-bold uppercase truncate">{row.gameLogId ? "Game Play" : "Platform"}</div>
                                            <div className="text-[10px] text-gray-500 flex items-center gap-1.5 min-w-0">
                                                <span className="truncate">P: {row.referee?.username || row.refereeId.slice(0, 8)}</span>
                                                <CopyButton value={row.referee?.username || row.refereeId} />
                                            </div>
                                        </div>
                                        {/* Bet Amount = real + bonus stake. Hover spells the split. */}
                                        <div
                                            className="text-gray-300 text-xs font-mono font-bold"
                                            title={betAmountRow ? `Real ${money2(realWagerRow)} + Bonus ${money2(bonusRow)}` : undefined}
                                        >
                                            {betAmountRow ? money2(betAmountRow) : "—"}
                                        </div>
                                        {/* Payout — what the house paid back on this round. A
                                            staked round that returned nothing is a real 0.00, not
                                            missing data, so only rounds with no stake show "—". */}
                                        <div className="text-gray-300 text-xs font-mono font-bold">
                                            {payoutRow || betAmountRow ? money2(payoutRow) : "—"}
                                        </div>
                                        {/* Bonus cash staked on this round. */}
                                        <div className="text-gray-300 text-xs font-mono font-bold">{bonusRow ? `${sign(bonusRow)}${money2(bonusRow)}` : "—"}</div>
                                        {/* Real stake — the commissionable, fee-bearing share of the bet. */}
                                        <div className="text-gray-300 text-xs font-mono font-bold">{realWagerRow ? money2(realWagerRow) : "—"}</div>
                                        {/* GGR = real house result + bonus staked. Green = house ahead, red = house behind. */}
                                        <div className={`text-xs font-mono font-bold ${ggrRowVal >= 0 ? "text-green-400" : "text-red-400"}`}>{sign(ggrRowVal)}{money4(ggrRowVal)}</div>
                                        {/* Platform Fee deducted (amount + fee % of GGR). Signed:
                                            negative GGR (player won) gives a credit back, so it
                                            renders green with a + instead of vanishing. */}
                                        <div className={`text-xs font-mono font-bold ${platformFeeRow > 0 ? "text-red-400" : platformFeeRow < 0 ? "text-green-400" : "text-gray-500"}`}>
                                            {platformFeeRow !== 0 ? (
                                                <>
                                                    {platformFeeRow > 0 ? "−" : "+"}{money4(platformFeeRow)}
                                                    <span className="text-[9px] opacity-70 ml-1">
                                                        ({feePctRow.toFixed(1)}%)
                                                    </span>
                                                </>
                                            ) : (
                                                "—"
                                            )}
                                        </div>
                                        {/* NGR = GGR − purchaseFee − platformFee (bonus is
                                            already out of GGR). Commission is a share OF this
                                            NGR, not subtracted from it. Shown before Commission.
                                            Hovering spells the three terms out, so a row where
                                            NGR sits below GGR can be read without guessing which
                                            deduction moved it. */}
                                        {(() => {
                                            const ngrRow = ngrBaseRow;
                                            const realStake = Number((row as any).realWager || 0);
                                            return (
                                                <div
                                                    className={`text-xs font-mono font-black ${ngrRow >= 0 ? "text-green-400" : "text-red-400"}`}
                                                    title={`NGR ${sign(ngrRow)}${money4(ngrRow)} = GGR ${sign(ggrRowVal)}${money4(ggrRowVal)} − purchase fee ${purchaseFeeRow.toFixed(2)}${realStake ? ` (6% of ${realStake.toFixed(2)} real stake)` : ""} − platform fee ${platformFeeRow.toFixed(4)}`}
                                                >
                                                    {sign(ngrRow)}{money4(ngrRow)}
                                                </div>
                                            );
                                        })()}
                                        {/* Comm % — the rate applied to NGR. When a sub-agent
                                            takes a cut, show the split: agent gross − sub = net. */}
                                        {(() => {
                                            const dedPct = Number((row as any).deductionPercent || 0);
                                            const netPct = Number(row.commissionPercent || 0);
                                            return dedPct > 0 ? (
                                                <div className="font-bold leading-tight">
                                                    <div className="text-gray-300 text-[10px]">
                                                        {netPct}% <span className="text-[8px] text-gray-500">AGENT</span>
                                                    </div>
                                                    <div className="text-purple-400/80 text-[9px] mt-0.5">
                                                        {dedPct}% <span className="text-[8px] text-gray-500">SUB-AGENT</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-gray-500 text-[10px] font-bold uppercase">{netPct}%</div>
                                            );
                                        })()}
                                        <div className="font-mono leading-tight">
                                            <div className={`text-xs font-black ${isForfeited ? "text-gray-500" : agentNetRow >= 0 ? "text-green-400" : "text-red-400"}`}>
                                                {sign(agentNetRow)}{money5(agentNetRow)}
                                                {isSubAgentRow && <span className="text-[8px] text-gray-500 font-bold ml-1">AGENT</span>}
                                            </div>
                                            {/* Why the 0: the round was recorded but never paid. */}
                                            {isForfeited && (
                                                <div className="text-[8px] text-gray-500 font-bold uppercase mt-0.5" title={`Forfeited: ${(row as any).forfeitReason}`}>
                                                    {(row as any).forfeitReason === "BONUS_FUNDED"
                                                        ? "Bonus-funded"
                                                        : "Forfeited"}
                                                </div>
                                            )}
                                            {isSubAgentRow && (
                                                <div className="text-[9px] text-purple-400/80 font-bold mt-0.5">
                                                    {sign(subPayoutRow)}{money5(subPayoutRow)} <span className="text-[8px] text-gray-500">SUB-AGENT</span>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-gray-300 text-xs font-mono leading-tight">
                                                <span className="block">{dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
                                                <span className="block text-gray-500 text-[10px]">{dateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}</span>
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <button onClick={() => { setSelectedLog(row); setDetailOpen(true); }} className="text-blue-400 hover:text-white transition-colors bg-[#242B35] p-2 rounded-lg border border-gray-800 inline-flex items-center justify-center"><Eye size={16} /></button>
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
          <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-gray-800">
            <DialogTitle className="text-base sm:text-lg font-semibold text-white">Entry Detailed Analysis</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="p-4 sm:p-6 space-y-3 min-w-0 w-full">
                <div className="flex justify-between items-center gap-3 text-[11px] text-gray-500 min-w-0">
                  <span className="shrink-0">Entry ID</span>
                  <span className="flex items-center gap-2 min-w-0 max-w-[65%] sm:max-w-[75%]">
                    <span className="text-purple-400 font-mono text-xs select-all truncate min-w-0">{selectedLog.id}</span>
                    <CopyButton value={selectedLog.id} size={14} className="shrink-0" />
                  </span>
                </div>
                <div className="h-px bg-gray-800" />
                <div className="flex justify-between items-center pt-1 gap-3 min-w-0">
                  <span className="text-[11px] text-gray-500 shrink-0">Player Name</span>
                  <span className="text-xs font-medium text-white truncate max-w-[65%] sm:max-w-[75%]">{selectedLog.referee?.username || "Guest Player"}</span>
                </div>
                <div className="flex justify-between items-center gap-3 min-w-0">
                  <span className="text-[11px] text-gray-500 shrink-0">GGR Contribution</span>
                  <span className="text-xs tabular-nums text-gray-300 font-medium truncate">{Number(selectedLog.netProfit).toFixed(2)}</span>
                </div>
                {(selectedLog as any).source === "SUB_AGENT" &&
                Number((selectedLog as any).deductionPercent || 0) > 0 ? (
                  (() => {
                    // LEDGER split — the recorded amounts that actually moved:
                    // net = commissionAmount (credited to the agent, fee already
                    // taken), sub = deductionAmount (funded out of the agent's
                    // gross), gross = their sum. Recomputing rate × NGR here made
                    // the popup disagree with the wallet for the same round.
                    const grossPct = Number((selectedLog as any).grossPercent || 0);
                    const subPct = Number((selectedLog as any).deductionPercent || 0);
                    const netPct = Number(selectedLog.commissionPercent || 0);
                    // Forfeited (inactive referrer / bonus-funded): nothing was paid.
                    const paidOut = (selectedLog as any).forfeitReason ? 0 : 1;
                    const netAmt = paidOut * Number(selectedLog.commissionAmount || 0);
                    const subAmt =
                      paidOut * Number((selectedLog as any).deductionAmount || 0);
                    const grossAmt = netAmt + subAmt;
                    return (
                      <>
                        {/* SUB-AGENT SPLIT: agent earns the full gross rate, the
                            sub-agent's cut is funded out of it, agent keeps the net. */}
                        <div className="flex justify-between items-center pt-1 gap-3 min-w-0">
                          <span className="text-[11px] text-gray-500 shrink-0">
                            Gross Commission ({grossPct.toFixed(1)}%)
                          </span>
                          <span className="text-xs tabular-nums text-gray-300 font-medium truncate">
                            {grossAmt >= 0 ? "+" : "−"}{Math.abs(grossAmt).toFixed(5)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center gap-3 min-w-0">
                          <span className="text-[11px] text-red-400/80 shrink-0">
                            Sub-Agent Payout (−{subPct.toFixed(1)}%)
                          </span>
                          <span className="text-xs tabular-nums text-red-400 font-medium truncate">
                            {subAmt >= 0 ? "−" : "+"}{Math.abs(subAmt).toFixed(5)}
                          </span>
                        </div>
                        <div className="h-px bg-gray-800" />
                        <div className="bg-green-500/5 p-4 rounded-lg border border-green-500/10 flex flex-col items-center gap-1 mt-2">
                          <span className="text-[11px] text-green-500/70 uppercase tracking-wide">
                            Agent Net ({netPct.toFixed(1)}%)
                          </span>
                          <span className={`text-2xl font-semibold tabular-nums ${netAmt >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {netAmt >= 0 ? "+" : "−"}{Math.abs(netAmt).toFixed(5)}
                          </span>
                        </div>
                      </>
                    );
                  })()
                ) : (
                  (() => {
                    // LEDGER commission — the amount that actually credited the
                    // wallet (fee already taken at accrual); 0 when forfeited.
                    const netAmt = (selectedLog as any).forfeitReason
                      ? 0
                      : Number(selectedLog.commissionAmount || 0);
                    return (
                      <>
                        <div className="flex justify-between items-center gap-3 min-w-0">
                          <span className="text-[11px] text-gray-500 shrink-0">Plan Multiplier</span>
                          <span className="text-[11px] font-medium text-gray-300 bg-gray-800 px-1.5 py-0.5 rounded tabular-nums truncate">{selectedLog.commissionPercent}%</span>
                        </div>
                        <div className="bg-green-500/5 p-4 rounded-lg border border-green-500/10 flex flex-col items-center gap-1 mt-2">
                          <span className="text-[11px] text-green-500/70 uppercase tracking-wide">Agent Earnings</span>
                          <span className={`text-2xl font-semibold tabular-nums ${netAmt >= 0 ? "text-green-400" : "text-red-400"}`}>{netAmt >= 0 ? "+" : "−"}{Math.abs(netAmt).toFixed(5)}</span>
                        </div>
                      </>
                    );
                  })()
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AgentFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onApply={handleApplyFilters}
        title="Ledger Filters"
        statusOptions={[
          { label: "All Sources", value: "All" },
          { label: "Direct", value: "DIRECT" },
          { label: "Sub Agent", value: "SUB_AGENT" },
        ]}
      />

      {/* HOW-IT'S-CALCULATED MODAL — focused on the clicked column, or all. */}
      {formulaKey && (() => {
        const ALL_FORMULAS = [
          { k: "Bet Amount", d: "Total staked on the round = real Wulf Cash + bonus cash. Only the real portion carries the 6% purchase fee and counts toward GGR; the bonus portion is granted credit (see Bonus)." },
          { k: "Real Stake", d: "Real Wulf Cash staked on the round = Bet Amount − Bonus. Only this portion carries the 6% purchase fee and produces GGR; the bonus portion is granted credit." },
          { k: "Payout", d: "What the house paid back on this round — the player's winnings, 0 on a full loss. GGR = real money staked − payout, so a payout above the stake makes GGR negative." },
          { k: "GGR", d: "Gross Gaming Revenue = real money staked − payout = −netProfit. It's the house's real result: POSITIVE when the house won (player lost), NEGATIVE when the player won. Bonus stake is granted credit, not real money, so it never counts toward GGR." },
          { k: "Comm %", d: "The agent's commission rate for this game category (base rate + any package plan bonus)." },
          { k: "Bonus", d: "Bonus cash the player staked — informational only. Granted credit, not real money, so it is not part of GGR or NGR." },
          { k: "Platform Fee", d: "Platform Fee = fee% × GGR — the same base the commission engine charges, so this is the fee actually deducted. Charged on every round; when the player won, GGR is negative so the fee comes back as a credit (+). The % is shown in brackets." },
          { k: "Commission", d: "The commission actually credited to the agent's wallet for this round — the ledger value, net of the platform fee taken at accrual. For sub-agent rounds it is the agent's cut after the sub-agent's split. Forfeited rounds (inactive referrer, bonus-funded) show 0: the round is recorded but nothing was paid. NGR remains a revenue metric and is not the commission base." },
          { k: "NGR", d: "NGR = GGR − Purchase Fee − Platform Fee. GGR = −netProfit (house result); Purchase Fee = 6% of the REAL Wulf Cash staked on this round (bonus stake carries no fee) — a 200 real bet carries a 12.00 fee; Platform Fee = fee% × GGR. Positive on a house win, negative when the player won (agent clawback)." },
        ];
        const isAll = formulaKey === "ALL";
        const rows = isAll ? ALL_FORMULAS : ALL_FORMULAS.filter((r) => r.k === formulaKey);
        return (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setFormulaKey(null)}
        >
          <div
            className="w-full max-w-lg bg-[#15181E] rounded-2xl border border-gray-800 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="text-white text-base font-bold flex items-center gap-2">
                <Info size={18} className="text-purple-400" />
                {isAll ? "How each column is calculated" : `How ${formulaKey} is calculated`}
              </h2>
              <button
                onClick={() => setFormulaKey(null)}
                className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-3 text-sm max-h-[70vh] overflow-y-auto">
              {rows.map((row) => (
                <div
                  key={row.k}
                  className="rounded-lg bg-white/[0.03] border border-white/5 p-3"
                >
                  <div className="text-purple-400 font-bold text-xs uppercase tracking-wide mb-1">
                    {row.k}
                  </div>
                  <p className="text-gray-300 text-xs leading-relaxed">{row.d}</p>
                </div>
              ))}
              {isAll && (
                <div className="rounded-lg bg-purple-500/5 border border-purple-500/20 p-3">
                  <p className="text-[11px] text-gray-300 leading-relaxed">
                    <span className="text-white font-bold">Purchase fee:</span>{" "}
                    6% of the real Wulf Cash staked on each round — a $200 real bet
                    carries a $12 fee, a $100 bet a $6 fee. Bonus-funded stake carries
                    no fee. Charged per round, so a replayed balance is billed on every
                    round it is staked.{" "}
                    <span className="text-white font-bold">Loss example:</span>{" "}
                    $6 real bet, player loses, rate 20%, platform 10%. GGR = 6 (stake kept).
                    Purchase fee 6%×6 = 0.36, platform 10%×6 = 0.6. NGR = 6 − 0.36 − 0.6 = 5.04
                    (revenue metric). Commission credited = 20% × 6 − fee = 1.2 − 0.6 = 0.6.{" "}
                    <span className="text-white font-bold">Mixed-funded loss:</span>{" "}
                    bet 25 = 10 real + 15 bonus, player loses it all. Only the real part
                    counts: GGR = 10, bonus 15 is informational, and only the 10 real
                    carries the 6% purchase fee (0.60).{" "}
                    <span className="text-white font-bold">Bonus-only loss:</span>{" "}
                    the platform is recovering its own grant — GGR 0, commission 0, the
                    round is marked Bonus-funded.{" "}
                    <span className="text-white font-bold">Win:</span>{" "}
                    the house paid out, so GGR and the credited commission go negative
                    (clawback against the weekly total).
                  </p>
                </div>
              )}
              {!isAll && (
                <button
                  onClick={() => setFormulaKey("ALL")}
                  className="text-[11px] text-purple-400 hover:text-purple-300 font-bold"
                >
                  View all columns →
                </button>
              )}
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

/* Column header with an inline ⓘ — native title tooltip on hover, opens the
   full formula modal on click. */
function ColHeader({
  label,
  tip,
  onInfo,
}: {
  label: string;
  tip: string;
  onInfo: () => void;
}) {
  return (
    <span className="text-xs font-normal text-gray-300 flex items-center gap-1">
      {label}
      <button
        type="button"
        onClick={onInfo}
        title={tip}
        className="text-gray-500 hover:text-purple-400 transition-colors"
      >
        <Info size={12} />
      </button>
    </span>
  );
}
