"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Sliders } from "lucide-react";
import { AgentFilterSheet, type FilterState } from "./AgentFilterSheet";
import {
  History,
  Calendar,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Hash,
} from "lucide-react";
import { ClaimRecord } from "@/types/profile.type";
import { profileApi } from "@/api/users/users";
import {
  agentPaymentApi,
  AgentPaymentStatus,
} from "@/api/agent-payment/agent-payment.api";
import { format, parseISO } from "date-fns";
import toast from "react-hot-toast";
import EmptyStatePage from "@/components/emptystatePage";
import { notfound } from "@/assets/icons";
import Pagination from "@/components/Pagination/Pagination";
import { connectSocket } from "@/lib/socket";

const PAGE_SIZE = 10;

interface ClaimHistoryProps {
  /** Dashboard date range. Claims are filtered by their claim date. */
  range?: { fromDate?: Date; toDate?: Date };
  /** Bumped by the dashboard after a payout action — triggers a silent refetch. */
  refreshSignal?: number;
}

export function ClaimHistory({ range, refreshSignal }: ClaimHistoryProps = {}) {
  const [allClaims, setAllClaims] = useState<ClaimRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ status: "All" });
  const [page, setPage] = useState(1);
  // Back to the first page whenever the visible set changes shape.
  useEffect(() => {
    setPage(1);
  }, [search, filters, range?.fromDate, range?.toDate]);

  const fetchHistory = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      // Two settlement systems. `referral_claims` (getClaimHistory) is the
      // LEGACY one — the claim → agent/admin approval → complete flow has
      // written only `agent_payment_requests` since June 2026, so an admin
      // completing a payout never produced a row here and this tab sat at
      // zero forever. Completed payout requests are merged in as settlement
      // records; in-flight and rejected ones stay on the Payout Requests tab.
      const [legacyRes, requestsRes] = await Promise.allSettled([
        profileApi.getClaimHistory(),
        agentPaymentApi.myRequests(),
      ]);

      const legacy: ClaimRecord[] =
        legacyRes.status === "fulfilled" ? legacyRes.value.data || [] : [];
      const completedPayouts: ClaimRecord[] =
        requestsRes.status === "fulfilled"
          ? (requestsRes.value.data || [])
              .filter((r) => r.status === AgentPaymentStatus.COMPLETED)
              .map(
                (r) =>
                  ({
                    id: r.id,
                    // Settlement moment, not request creation — the range
                    // filter and "Last Claim" card should reflect when the
                    // money actually went out.
                    createdAt: r.completedAt || r.updatedAt || r.createdAt,
                    amount: Number(r.amount),
                    status: "COMPLETED",
                    transactionId: r.transactionRef || null,
                    referrerName: "Payout Request",
                    referrerEmail: r.paymentMethod || "—",
                  }) as unknown as ClaimRecord,
              )
          : [];

      if (legacyRes.status === "rejected" && requestsRes.status === "rejected") {
        throw legacyRes.reason;
      }

      setAllClaims(
        [...legacy, ...completedPayouts].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      );
    } catch (error) {
      console.error("Failed to fetch claim history:", error);
      if (!silent) toast.error("Failed to load claim history");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    // A payout completing (e.g. auto-approved) adds a row here. Coalesce the
    // event burst into one silent refetch instead of reloading the table.
    const socket = connectSocket();
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const onUpdated = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void fetchHistory(true), 600);
    };
    socket.on("agent-payment:updated", onUpdated);
    return () => {
      socket.off("agent-payment:updated", onUpdated);
      clearTimeout(debounce);
    };
  }, []);

  // Dashboard-driven refresh (skips the initial mount, covered above).
  const firstSignal = useRef(true);
  useEffect(() => {
    if (firstSignal.current) {
      firstSignal.current = false;
      return;
    }
    void fetchHistory(true);
  }, [refreshSignal]);

  // Rows are filtered client-side: the claim endpoint takes no date params,
  // but every claim carries its own timestamp so this stays truthful.
  const claims = allClaims.filter((c) => {
    if (range?.fromDate || range?.toDate) {
      const claimedAt = new Date(c.createdAt);
      if (!Number.isNaN(claimedAt.getTime())) {
        if (range.fromDate && claimedAt < range.fromDate) return false;
        if (range.toDate && claimedAt > range.toDate) return false;
      }
    }

    // The dashboard range above is the outer bound; the sheet narrows within it.
    if (filters.startDate || filters.endDate) {
      const claimedAt = new Date(c.createdAt);
      if (Number.isNaN(claimedAt.getTime())) return false;
      if (filters.startDate && claimedAt < filters.startDate) return false;
      if (filters.endDate && claimedAt > filters.endDate) return false;
    }

    if (filters.status && filters.status !== "All") {
      if ((c.status ?? "").toUpperCase() !== filters.status) return false;
    }

    const q = search.trim().toLowerCase();
    if (q) {
      const haystack = [c.id, c.transactionId, c.status, c.referrerName, c.referrerEmail]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });

  // Summary stats
  const totalClaimed = claims.reduce((acc, c) => acc + Number(c.amount), 0);
  const totalPages = Math.max(1, Math.ceil(claims.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageClaims = claims.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white uppercase tracking-tight flex items-center gap-2">
            <History className="text-purple-500" size={20} />
            Claim History
          </h2>
          <p className="text-gray-500 text-xs mt-1">All your past commission settlement records</p>
        </div>
        {/* <button
          onClick={fetchHistory}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all text-[11px] font-bold uppercase active:scale-95"
        >
          <RefreshCw size={12} className={loading ? "animate-spin text-purple-400" : ""} />
          Refresh
        </button> */}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-[#191D24] rounded-xl border border-gray-800 p-5">
          <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">Total Claims</p>
          <p className="text-2xl font-bold text-white">{claims.length}</p>
        </div>
        <div className="bg-[#191D24] rounded-xl border border-gray-800 p-5">
          <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">Total Settled</p>
          <p className="text-2xl font-bold text-white tracking-tight">
            {totalClaimed.toFixed(2)}
          </p>
        </div>
        <div className="bg-[#191D24] rounded-xl border border-gray-800 p-5">
          <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">Last Claim</p>
          <p className="text-sm font-bold text-white">
            {claims.length > 0
              ? format(parseISO(claims[0].createdAt), "MMM dd, yyyy")
              : "—"}
          </p>
        </div>
      </div>

      {/* Search + filters, same controls as the rest of the agent portal. */}
      <div className="flex items-center gap-2">
        <div className="relative group flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-purple-500 transition-colors" />
          <Input
            placeholder="Search claim, transaction or user..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
      </div>

      {/* Table */}
      <div className="bg-[#191D24] rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto agent-x-scroll">
          <table className="w-full text-left border-collapse">
            <thead className="bg-black/20 border-b border-gray-800">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase">SR.</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase">Date & Time</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase">User / Team</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase text-right">Amount</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase text-right hidden sm:table-cell">Transaction ID</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase text-right">Status</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-gray-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-20">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                      <p className="text-gray-500 font-bold uppercase text-[10px]">Loading settlements...</p>
                    </div>
                  </td>
                </tr>
              ) : claims.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16">
                    <EmptyStatePage
                      title="No settlements yet"
                      description="Your claim history will appear here after your first commission settlement."
                      image={notfound}
                      imageWidth={140}
                      imageHeight={70}
                    />
                  </td>
                </tr>
              ) : (
                pageClaims.map((claim, idx) => (
                  <tr
                    key={claim.id}
                    className="hover:bg-white/[0.02] transition-colors group"
                  >
                    <td className="px-6 py-4 text-gray-600 text-[10px] font-mono">
                      #{(currentPage - 1) * PAGE_SIZE + idx + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-gray-300 text-[12px] font-bold">
                        <Calendar size={12} className="text-purple-500/60" />
                        {format(parseISO(claim.createdAt), "MMM dd, yyyy · HH:mm")}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-white text-[13px] font-bold tracking-tight">
                          {claim.referrerName || "System Settlement"}
                        </p>
                        <p className="text-gray-500 text-[10px] font-bold">{claim.referrerEmail || "Admin"}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-white font-bold text-base tracking-tight">
                        {Number(claim.amount).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right hidden sm:table-cell">
                      <span className="text-gray-600 text-[10px] font-mono tracking-tight flex items-center justify-end gap-1">
                        <Hash size={9} />
                        {claim.transactionId || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase border ${
                            claim.status === "SUCCESS" || claim.status === "COMPLETED"
                              ? "bg-green-500/10 border-green-500/20 text-green-400"
                            : claim.status === "PENDING_APPROVAL" || claim.status === "PENDING"
                              ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                            : claim.status === "PROCESSING"
                              ? "bg-orange-500/10 border-orange-500/20 text-orange-400"
                            : claim.status === "REJECTED"
                              ? "bg-red-500/10 border-red-500/20 text-red-400"
                              : "bg-gray-500/10 border-gray-500/20 text-gray-400"
                          }`}
                        >
                          {claim.status === "PROCESSING" ? "Lock-in Period" : (claim.status === "PENDING_APPROVAL" || claim.status === "PENDING") ? "Awaiting Approval" : claim.status}
                        </span>
                        
                        {/* 45-DAY COUNTDOWN */}
                        {claim.status === "PROCESSING" && claim.approvedAt && (
                          (() => {
                            const approvedAt = new Date(claim.approvedAt);
                            const now = new Date();
                            const diffSecs = now.getTime() - approvedAt.getTime();
                            const daysPassed = Math.floor(diffSecs / (1000 * 60 * 60 * 24));
                            const daysRemaining = Math.max(0, 45 - daysPassed);
                            return (
                               <div className="flex items-center gap-1.5 pr-1">
                                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
                                  <span className="text-[10px] text-orange-400 font-bold tracking-tight">
                                     Wait {daysRemaining} days
                                  </span>
                               </div>
                            );
                          })()
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 bg-black/10 border-t border-gray-800">
            <p className="text-[10px] text-gray-500 uppercase font-bold hidden sm:block">
              Showing {(currentPage - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(currentPage * PAGE_SIZE, claims.length)} of{" "}
              {claims.length} entries
            </p>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    <AgentFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onApply={setFilters}
        title="Claim Filters"
        statusOptions={[
          { label: "All Statuses", value: "All" },
          { label: "Completed", value: "COMPLETED" },
          { label: "Approved", value: "APPROVED" },
          { label: "Processing", value: "PROCESSING" },
          { label: "Pending", value: "PENDING" },
          { label: "Rejected", value: "REJECTED" },
        ]}
      />

    </div>
  );
}
