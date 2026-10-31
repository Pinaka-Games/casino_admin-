"use client";

import React, { useState, useMemo } from "react";
import { Search, Eye, Sliders } from "lucide-react";
import TableSkeleton from "@/components/TableSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import NoData from "@/components/NoData";
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
import { transactionsApi, Transaction } from "@/api/transactions/transactions.api";
import {
  agentPaymentApi,
  AgentPaymentRequest,
} from "@/api/agent-payment/agent-payment.api";
import { useEffect } from "react";
import { profileApi } from "@/api/users/users";
import { ReferralStats } from "@/types/profile.type";
import { FeatureGate } from "@/app/agent-management/components/FeatureGate";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useAgentPackageStore } from "@/store/agent-package.store";
import {
  PAGE_HEAD,
  PAGE_SHELL,
  PAGE_TITLE,
  TOOLBAR,
  TOOLBAR_SEARCH,
} from "@/app/agent-management/components/responsive";

const PAGE_SIZE = 10;

// Humanize a transaction source into a readable type label. Payout rows carry
// source = `PAYOUT_<status>`, so collapse those to a single "Payout" label;
// every other ledger source (REFERRAL_COMMISSION, REDEEM, …) is title-cased.
const getTypeLabel = (row: Transaction): string => {
  const source = row.source || "";
  if (source.startsWith("PAYOUT_")) return "Payout";
  const humanized = source
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return humanized || (row.type === "CREDIT" ? "Credit" : "Debit");
};

// Coarse, user-facing status. Agent-payment rows carry a granular status
// (PENDING_AGENT, ADMIN_APPROVED, …); plain ledger transactions have none and
// are always settled → "Completed".
const getStatusInfo = (
  row: Transaction,
): { label: string; className: string } => {
  const status = (row.status || "").toUpperCase();
  if (status.includes("REJECT"))
    return {
      label: "Rejected",
      className: "bg-red-600/10 text-red-400 border-red-500/20",
    };
  if (status.includes("PENDING"))
    return {
      label: "Pending",
      className: "bg-yellow-600/10 text-yellow-400 border-yellow-500/20",
    };
  if (status.includes("APPROVED"))
    return {
      label: "Approved",
      className: "bg-blue-600/10 text-blue-400 border-blue-500/20",
    };
  return {
    label: "Completed",
    className: "bg-green-600/10 text-green-400 border-green-500/20",
  };
};

// Reference shown to the user — the real gateway/ledger reference only. We never
// fall back to the provider name (that lives in the Type subtitle), so the
// column always reads as an identifier or a clear "---".
const getRefId = (row: Transaction): string => row.referenceId || "---";

// Status-aware "entry type" for the detail modal. A pending/approved payout has
// NOT moved money yet, so "Funds Debited" (past tense) is wrong — reflect the
// real state instead. Credits are always settled commission additions.
const getEntryTypeLabel = (row: Transaction): string => {
  if (row.type === "CREDIT") return "Commission Added";
  const status = getStatusInfo(row).label;
  if (status === "Completed") return "Funds Debited";
  if (status === "Rejected") return "Withdrawal Rejected";
  return "Withdrawal Pending"; // Pending / Approved — money still frozen
};

/** Column template for the pseudo-table below. The header and every row are
 *  separate grid containers, so they only stay aligned while they share this
 *  one string — inlining it in one place and not the other is exactly how the
 *  columns drift apart. */
const ROW_GRID =
  "grid-cols-[120px_1fr_1fr_1fr_120px_1fr_80px]";

export default function WalletTransactionsPage() {
  const { user: authUser, hasRole } = useAuth();
  const { currentPackage, fetchCurrentPackage } = useAgentPackageStore();
  const { canViewSettlementHistory, canExportReports } = useFeatureAccess();
  const isSubAgent =
    authUser?.roles?.some((r) => r.name.toLowerCase().includes("sub")) ?? false;
  const effectiveCanViewSettlementHistory =
    isSubAgent || canViewSettlementHistory;

  React.useEffect(() => {
    if (!currentPackage) fetchCurrentPackage();
  }, [currentPackage, fetchCurrentPackage]);

  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payouts, setPayouts] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  
  // Sidebar Filter State
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    status: "All",
    startDate: undefined,
    endDate: undefined
  });

  const [selectedLog, setSelectedLog] = useState<Transaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchTransactions();
    fetchPayouts();
  }, []);

  // Sub-agent / agent payout requests are tracked in AffiliateWallet, not the
  // transactions table, so they never appear in /transactions/me. Pull them
  // here and render each as a DEBIT row so released payouts show in the ledger.
  const mapPayoutToRow = (r: AgentPaymentRequest): Transaction =>
    ({
      id: r.id,
      userId: r.requesterEmployeeId,
      type: "DEBIT",
      source: `PAYOUT_${r.status}`,
      // Ref ID is the real gateway reference only. Do NOT fall back to the
      // provider name ("BREEZE"/"COINFLOW") — that surfaces in the Type
      // subtitle instead, so the column always reads as a true identifier.
      referenceId: r.transactionRef || undefined,
      paymentMethod: r.paymentDetails?.provider ?? r.paymentMethod ?? null,
      description: r.note || "",
      createdAt: r.completedAt || r.createdAt,
      status: r.status,
      wulfCashAdded: Number(r.amount),
    } as unknown as Transaction);

  const fetchPayouts = async () => {
    try {
      const res = await agentPaymentApi.myRequests();
      setPayouts((res.data || []).map(mapPayoutToRow));
    } catch (error) {
      console.error("Failed to fetch payout requests:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await profileApi.getReferralStats();
      setStats(response.data);
    } catch (error) {
      console.error("Failed to fetch referral stats:", error);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await transactionsApi.getMyTransactions();
      setTransactions(response.data.data);
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    let result = [...payouts, ...transactions].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    if (search) {
      result = result.filter(item => 
        item.id.toLowerCase().includes(search.toLowerCase()) || 
        (item.referenceId && item.referenceId.toLowerCase().includes(search.toLowerCase())) ||
        item.source.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    if (filters.status !== "All") {
      result = result.filter(item => item.type === filters.status);
    }
    
    if (filters.startDate) {
      result = result.filter(item => new Date(item.createdAt) >= filters.startDate!);
    }
    
    if (filters.endDate) {
      result = result.filter(item => new Date(item.createdAt) <= filters.endDate!);
    }
    
    return result;
  }, [search, filters, transactions, payouts]);

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

  return (
    <div className={PAGE_SHELL}>
      {/* HEADER BREADCRUMB */}
      <div className={PAGE_HEAD}>
        <h1 className={PAGE_TITLE}>
          {authUser?.roles?.some(r => r.name.toLowerCase().includes('sub')) ? 'Sub-Agent Management' : 'Agent Management'} / Wallet Ledger
        </h1>
      </div>

      <div className="flex flex-col gap-3 sm:gap-4 md:flex-1 md:overflow-hidden md:min-h-0">
        {/* SUMMARY CARDS — plain style, matches the Sub-Agents page */}
        <div className="shrink-0 bg-[#191D24] rounded-lg p-3 sm:p-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
            {[{
               label: "Total Earnings",
               // Lifetime ledger commission — the same figure as the
               // dashboard's "Total Team Earnings" (own + sub-agents; a
               // sub-agent has no team). `totalEarnings` is the wallet
               // balance, which drops with every claim, so it read the same
               // as Available Balance here.
               value: Math.max(
                 0,
                 Number(stats?.totalEarnedAllTime ?? stats?.totalEarnings ?? 0) +
                   (isSubAgent ? 0 : Number(stats?.subAgentsEarnedAllTime ?? 0)),
               ).toFixed(2),
            }, {
               label: "Freeze Amount",
               // Everything earned but not yet claimable — the SAME figure as
               // the dashboard's "On Hold" (WalletOverview): commission still
               // awaiting the settlement run plus the release hold, floored at
               // the frozen bucket. It showed `requestedAmount` (payouts already
               // requested) only, so with the Affiliate freeze enabled the
               // dashboard read On Hold 20.54 while this card read 0.00.
               value: Math.max(
                 Number(stats?.freezePending ?? stats?.frozenBalance ?? 0),
                 Number(stats?.frozenBalance ?? 0),
               ).toFixed(2),
            }, {
               label: "Available Balance",
               // Withdrawable wallet balance (matches AgentStats/WalletOverview);
               // pendingIncome is a claimable-but-not-yet-withdrawable bucket.
               value: (stats?.availableBalance ?? stats?.pendingIncome)?.toFixed(2) || "0.00",
            }, {
               label: "Total Claimed",
               value: stats?.totalClaimed?.toFixed(2) || "0.00",
            }].map((card, i) => (
               <div key={i} className="bg-[#242B35] rounded-lg p-3 sm:p-4">
                  <div className="text-gray-400 text-xs sm:text-sm">{card.label}</div>
                  <div className="text-white text-lg sm:text-2xl font-bold">{card.value}</div>
               </div>
            ))}
          </div>
        </div>

        {/* TOOLBAR — separate card, search outside the table (like Sub-Agents) */}
        <div className={TOOLBAR}>
                <div className={TOOLBAR_SEARCH}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-purple-500 transition-colors" />
                    <Input
                        placeholder="Search TX ID, Ref ID or Type..."
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
                    fileName="wallet_transactions.csv"
                    headers={["TX ID", "Type", "Amount", "Status", "Ref ID", "Date"]}
                    mapRow={(row) => [row.id, getTypeLabel(row), row.wulfCashAdded || 0, getStatusInfo(row).label, getRefId(row), row.createdAt]}
                    getRowDate={(row) => row.createdAt}
                />
            </div>

        {/* TABLE CARD */}
        <div className="flex flex-col md:flex-1 md:min-h-0 bg-[#191D24] rounded-xl border border-gray-800 overflow-x-auto agent-x-scroll">
            {/* TABLE HEADER - Always Visible */}
            <div className={`grid ${ROW_GRID} gap-3 sm:gap-4 px-4 sm:px-6 py-3 bg-[#242B35] border-b border-gray-800 shrink-0 min-w-[1000px] lg:min-w-0`}>
                <span className="text-xs font-normal text-gray-300">Transaction ID</span>
                <span className="text-xs font-normal text-gray-300">Type</span>
                <span className="text-xs font-normal text-gray-300">Amount</span>
                <span className="text-xs font-normal text-gray-300">Status</span>
                <span className="text-xs font-normal text-gray-300">Ref ID</span>
                <span className="text-xs font-normal text-gray-300">Date</span>
                <span className="text-xs font-normal text-gray-300 text-center">Action</span>
            </div>

            <FeatureGate allowed={effectiveCanViewSettlementHistory} showHeader={false}>
                {/* Visible scrollbar (not scrollbar-hide) so it's clear more rows
                    exist below the fold; the count footer reinforces the total. */}
                <div className="flex flex-col md:flex-1 md:min-h-0 lg:overflow-y-auto scrollbar-hide min-w-[1000px] lg:min-w-0">
                    <div className="divide-y divide-gray-800/30">
                        {loading ? (
                            <TableSkeleton rows={10} cols={7} />
                        ) : paginatedData.length === 0 ? (
                            <div className="py-20 text-center"><NoData title="No transactions found" /></div>
                        ) : (
                            paginatedData.map((row, index) => {
                                const statusInfo = getStatusInfo(row);
                                return (
                                <div key={row.id} className={`grid ${ROW_GRID} gap-3 sm:gap-4 px-4 sm:px-6 py-4 items-center hover:bg-[#1a2030] transition-colors ${index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"}`}>
                                    <div className="flex items-center gap-1.5">
                                        <div className="text-gray-300 text-xs font-mono truncate uppercase">{row.id.slice(0, 8)}</div>
                                        <CopyButton value={row.id} />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="block text-gray-200 text-xs font-bold uppercase truncate">{getTypeLabel(row)}</span>
                                        {row.paymentMethod && (
                                            <span className="block text-[9px] text-gray-500 font-bold uppercase truncate">{row.paymentMethod}</span>
                                        )}
                                    </div>
                                    <div className={`text-xs font-black font-mono ${row.type === "CREDIT" ? "text-green-400" : "text-red-400"}`}>
                                        {row.type === "CREDIT" ? "+" : "-"}{(row.wulfCashAdded || 0).toLocaleString()}
                                    </div>
                                    <div>
                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${statusInfo.className}`}>
                                            {statusInfo.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="text-gray-500 text-[10px] truncate font-mono uppercase">{getRefId(row)}</div>
                                        <CopyButton value={getRefId(row)} />
                                    </div>
                                    <div className="text-gray-300 text-sm font-mono leading-tight">
                                        {new Date(row.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                    </div>
                                    <div className="text-center">
                                        <button onClick={() => { setSelectedLog(row); setDetailOpen(true); }} className="text-blue-400 hover:text-white transition-colors bg-[#242B35] p-2 rounded-lg border border-gray-800 inline-flex items-center justify-center shrink-0"><Eye size={16} /></button>
                                    </div>
                                </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Always-visible count + pagination so the list never looks
                    "empty"/incomplete — users can see how many records exist. */}
                {!loading && filteredData.length > 0 && (
                    <div className="sticky left-0 flex items-center justify-between gap-3 px-4 py-3 bg-black/10 border-t border-gray-800 shrink-0 agent-safe-bottom">
                        <span className="text-[10px] font-bold text-gray-500">
                            Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredData.length)} of {filteredData.length}
                        </span>
                        {totalPages > 1 && (
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                onPageChange={setCurrentPage}
                            />
                        )}
                    </div>
                )}
            </FeatureGate>
        </div>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-[#191D24] text-white border-gray-800 w-[calc(100vw-1.5rem)] max-w-sm p-0 overflow-hidden rounded-xl shadow-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-gray-800 text-left">
            <DialogTitle className="text-base sm:text-lg font-semibold text-white">Transaction Summary</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            /* No inner card — this used to be a bordered box sitting inside the
               dialog panel, which read as a box in a box. The `h-px` rules do
               the separating instead. */
            <div className="p-4 sm:p-6 space-y-3">
                  {/* The ids sit under their own labels. They were `justify-end`,
                      which pushed each value to the far right of the panel, away
                      from the label naming it. */}
                  <div className="space-y-1">
                    <p className="text-[11px] text-gray-500">Transaction ID</p>
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-xs font-mono text-purple-400 break-all">{selectedLog.id}</p>
                      <CopyButton value={selectedLog.id} size={14} />
                    </div>
                  </div>
                  <div className="h-px bg-gray-800/50" />
                  <div className="space-y-1">
                    <p className="text-[11px] text-gray-500">Reference ID</p>
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-xs font-mono text-gray-300 break-all">{getRefId(selectedLog)}</p>
                      <CopyButton value={getRefId(selectedLog)} size={14} />
                    </div>
                  </div>
                  <div className="h-px bg-gray-800/50" />
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-[11px] text-gray-500 shrink-0">Type</span>
                    <span className="text-xs font-medium text-gray-200 text-right">
                      {getTypeLabel(selectedLog)}
                      {selectedLog.paymentMethod ? ` · ${selectedLog.paymentMethod}` : ""}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-[11px] text-gray-500 shrink-0">Status</span>
                    <span className={`text-[11px] font-medium whitespace-nowrap px-2 py-0.5 rounded-full border ${getStatusInfo(selectedLog).className}`}>
                      {getStatusInfo(selectedLog).label}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-[11px] text-gray-500 shrink-0">Entry Type</span>
                    <span className={`text-[11px] font-medium whitespace-nowrap px-2 py-0.5 rounded ${selectedLog.type === "CREDIT" ? "text-green-500 bg-green-500/10" : "text-red-500 bg-red-500/10"}`}>
                      {getEntryTypeLabel(selectedLog)}
                    </span>
                  </div>
                  <div className="bg-orange-500/5 p-4 rounded-lg border border-orange-500/10 flex flex-col items-center gap-1">
                    <span className="text-[11px] text-orange-200/60 uppercase tracking-wide">Final Amount</span>
                    <span className={`text-2xl font-semibold tabular-nums ${selectedLog.type === "CREDIT" ? "text-green-400" : "text-red-400"}`}>
                      {selectedLog.type === "CREDIT" ? "+" : "-"}{(selectedLog.wulfCashAdded || 0).toLocaleString()}
                    </span>
                  </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AgentFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onApply={handleApplyFilters}
        title="Wallet Filters"
        statusOptions={[
          { label: "All Types", value: "All" },
          { label: "Credit (+)", value: "CREDIT" },
          { label: "Debit (-)", value: "DEBIT" }
        ]}
      />
    </div>
  );
}
