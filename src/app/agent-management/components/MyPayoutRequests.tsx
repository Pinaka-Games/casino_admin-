"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Sliders } from "lucide-react";
import { AgentFilterSheet, type FilterState } from "./AgentFilterSheet";
import {
  Banknote,
  Calendar,
  Loader2,
  Hash,
  AlertCircle,
} from "lucide-react";
import {
  agentPaymentApi,
  AgentPaymentRequest,
  AgentPaymentStatus,
  PayoutAttempt,
  PayoutAttemptStatus,
} from "@/api/agent-payment/agent-payment.api";
import { agentBreezeApi } from "@/api/agent-payment/agent-breeze.api";
import { connectSocket } from "@/lib/socket";
import Pagination from "@/components/Pagination/Pagination";
import { format, parseISO } from "date-fns";
import toast from "react-hot-toast";
import EmptyStatePage from "@/components/emptystatePage";
import { notfound } from "@/assets/icons";

interface MyPayoutRequestsProps {
  /** Dashboard date range. Requests are filtered by their creation date. */
  range?: { fromDate?: Date; toDate?: Date };
  /** Bumped by the dashboard after a payout action — triggers a silent refetch. */
  refreshSignal?: number;
}

/** Statuses where the money is still moving — nothing final has happened yet. */
const OPEN_STATUSES: AgentPaymentStatus[] = [
  AgentPaymentStatus.PENDING_AGENT,
  AgentPaymentStatus.AGENT_APPROVED,
  AgentPaymentStatus.PENDING_ADMIN,
  AgentPaymentStatus.ADMIN_APPROVED,
];

const STATUS_LABEL: Record<AgentPaymentStatus, string> = {
  [AgentPaymentStatus.PENDING_AGENT]: "Awaiting Agent",
  [AgentPaymentStatus.AGENT_APPROVED]: "Agent Approved",
  [AgentPaymentStatus.PENDING_ADMIN]: "Awaiting Admin",
  [AgentPaymentStatus.ADMIN_APPROVED]: "Approved — Processing",
  [AgentPaymentStatus.COMPLETED]: "Completed",
  [AgentPaymentStatus.REJECTED_BY_AGENT]: "Rejected by Agent",
  [AgentPaymentStatus.REJECTED_BY_ADMIN]: "Rejected by Admin",
};

const STATUS_STYLE: Record<AgentPaymentStatus, string> = {
  [AgentPaymentStatus.PENDING_AGENT]:
    "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
  [AgentPaymentStatus.AGENT_APPROVED]:
    "bg-blue-500/10 border-blue-500/20 text-blue-400",
  [AgentPaymentStatus.PENDING_ADMIN]:
    "bg-blue-500/10 border-blue-500/20 text-blue-400",
  [AgentPaymentStatus.ADMIN_APPROVED]:
    "bg-orange-500/10 border-orange-500/20 text-orange-400",
  [AgentPaymentStatus.COMPLETED]:
    "bg-green-500/10 border-green-500/20 text-green-400",
  [AgentPaymentStatus.REJECTED_BY_AGENT]:
    "bg-red-500/10 border-red-500/20 text-red-400",
  [AgentPaymentStatus.REJECTED_BY_ADMIN]:
    "bg-red-500/10 border-red-500/20 text-red-400",
};


const ATTEMPT_LABEL: Record<PayoutAttemptStatus, string> = {
  INITIATED: "Payout Requested",
  PROCESSING: "In Progress",
  NEEDS_REVIEW: "Needs Review",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
  ABANDONED: "Not Completed",
};

const ATTEMPT_STYLE: Record<PayoutAttemptStatus, string> = {
  INITIATED: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
  PROCESSING: "bg-blue-500/10 border-blue-500/20 text-blue-400",
  NEEDS_REVIEW: "bg-orange-500/10 border-orange-500/20 text-orange-400",
  FAILED: "bg-red-500/10 border-red-500/20 text-red-400",
  CANCELLED: "bg-gray-500/10 border-gray-500/20 text-gray-400",
  EXPIRED: "bg-gray-500/10 border-gray-500/20 text-gray-400",
  ABANDONED: "bg-gray-500/10 border-gray-500/20 text-gray-400",
};

/**
 * REJECTED_BY_AGENT is also what the backend stores when the requester cancels
 * their own request or a new claim supersedes it — "Rejected by Agent" is wrong
 * for both (a direct agent has no parent agent at all). Read the reason.
 */
function requestLabel(r: AgentPaymentRequest): { label: string; style: string } {
  if (r.status === AgentPaymentStatus.REJECTED_BY_AGENT) {
    const reason = (r.rejectionReason ?? "").toLowerCase();
    if (reason.startsWith("cancelled by the requester")) {
      return { label: "Cancelled", style: ATTEMPT_STYLE.CANCELLED };
    }
    if (reason.startsWith("superseded")) {
      return { label: "Replaced", style: ATTEMPT_STYLE.CANCELLED };
    }
    if (reason.startsWith("duplicate request")) {
      return { label: "Duplicate — Refunded", style: ATTEMPT_STYLE.CANCELLED };
    }
    if (reason.startsWith("payout form was not completed")) {
      return { label: "Not Completed", style: ATTEMPT_STYLE.ABANDONED };
    }
    if (reason.includes("could not be opened") || reason.startsWith("payout too small")) {
      return { label: "Failed", style: ATTEMPT_STYLE.FAILED };
    }
  }
  return {
    label: STATUS_LABEL[r.status] || r.status,
    style:
      STATUS_STYLE[r.status] ||
      "bg-gray-500/10 border-gray-500/20 text-gray-400",
  };
}

/** Attempts that may still turn into a payout. */
// NEEDS_REVIEW excluded: its request could not be created, so it is not moving
// and no longer reserves balance (mirrors the backend hold).
const OPEN_ATTEMPT_STATUSES: PayoutAttemptStatus[] = [
  "INITIATED",
  "PROCESSING",
];

/** One table row: a payment request, or a provider attempt not yet a request. */
type PayoutRow =
  | { kind: "request"; request: AgentPaymentRequest }
  | { kind: "attempt"; attempt: PayoutAttempt };

const rowCreatedAt = (r: PayoutRow) =>
  r.kind === "request" ? r.request.createdAt : r.attempt.createdAt;
const rowStatus = (r: PayoutRow): string =>
  r.kind === "request" ? r.request.status : r.attempt.status;

/**
 * Full history of the logged-in agent's / sub-agent's own payout requests.
 *
 * The dashboard already fetches these, but only renders in-flight ones as
 * banners — and the rejected banner is dismissible, with the dismissal kept in
 * localStorage. Completed, cancelled and dismissed-rejected requests therefore
 * disappeared from every surface the requester could see. This is the list that
 * keeps them, mirroring what the parent agent sees in Sub-Agent Settlements.
 */
export function MyPayoutRequests({ range, refreshSignal }: MyPayoutRequestsProps = {}) {
  const [allRequests, setAllRequests] = useState<AgentPaymentRequest[]>([]);
  const [attempts, setAttempts] = useState<PayoutAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({ status: "All" });

  const fetchRequests = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      // Attempts are a separate endpoint: a payout opened on Breeze/Coinflow is
      // not a request until the provider confirms it, and used to be invisible
      // here in the meantime. Its failure must not hide the requests.
      const [res, att] = await Promise.all([
        agentPaymentApi.myRequests(),
        agentPaymentApi.myPayoutAttempts().catch(() => null),
      ]);
      setAllRequests(res.data || []);
      if (att) setAttempts(att.data || []);
    } catch (error) {
      console.error("Failed to fetch payout requests:", error);
      if (!silent) toast.error("Failed to load payout requests");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    // Live: the backend emits this on every request change and every draft
    // attempt change (initiated, failed to materialize, expired).
    const socket = connectSocket();
    // Coalesce an event burst (e.g. auto-approval) into one silent refetch.
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const onUpdated = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void fetchRequests(true), 600);
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
    void fetchRequests(true);
  }, [refreshSignal]);

  // Backstop while something is in flight: the provider callback can land
  // minutes later via the reconcile cron, and a socket event can be missed.
  // A Breeze claim still "Awaiting Payment Details" is also re-pulled from
  // Breeze (syncMine), so finishing the form shows here within seconds.
  const hasLiveAttempt = attempts.some((a) =>
    OPEN_ATTEMPT_STATUSES.includes(a.status),
  );
  const awaitingBreeze = allRequests.some(
    (r) =>
      (r.status === AgentPaymentStatus.PENDING_ADMIN ||
        r.status === AgentPaymentStatus.PENDING_AGENT) &&
      r.payoutReady === false &&
      r.paymentDetails?.provider === "BREEZE",
  );
  useEffect(() => {
    if (!hasLiveAttempt && !awaitingBreeze) return;
    let ticks = 0;
    const t = setInterval(async () => {
      // ~5 min of fast polling; the server cron covers anything slower.
      if (++ticks > 20) return clearInterval(t);
      if (awaitingBreeze) {
        try {
          await agentBreezeApi.syncMine();
        } catch {
          // best effort
        }
      }
      void fetchRequests(true);
    }, 15000);
    return () => clearInterval(t);
  }, [hasLiveAttempt, awaitingBreeze]);

  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  // Back to the first page whenever the visible set changes shape.
  useEffect(() => {
    setPage(1);
  }, [search, filters, range?.fromDate, range?.toDate]);

  // Filtered client-side: the endpoint takes no date params, but every request
  // carries its own timestamp, so the dashboard range still applies honestly.
  const allRows: PayoutRow[] = [
    ...allRequests.map((request) => ({ kind: "request" as const, request })),
    ...attempts.map((attempt) => ({ kind: "attempt" as const, attempt })),
  ];

  const requests = allRows
    .filter((r) => {
      if (!range?.fromDate && !range?.toDate) return true;
      const createdAt = new Date(rowCreatedAt(r));
      if (Number.isNaN(createdAt.getTime())) return true;
      if (range.fromDate && createdAt < range.fromDate) return false;
      if (range.toDate && createdAt > range.toDate) return false;
      return true;
    })
    // The dashboard range above is the outer bound; these narrow within it.
    .filter((r) => {
      if (filters.startDate || filters.endDate) {
        const createdAt = new Date(rowCreatedAt(r));
        if (Number.isNaN(createdAt.getTime())) return false;
        if (filters.startDate && createdAt < filters.startDate) return false;
        if (filters.endDate && createdAt > filters.endDate) return false;
      }

      if (filters.status && filters.status !== "All" && rowStatus(r) !== filters.status) {
        return false;
      }

      const q = search.trim().toLowerCase();
      if (q) {
        const fields =
          r.kind === "request"
            ? [r.request.id, r.request.transactionRef, r.request.note, r.request.status, r.request.rejectionReason]
            : [r.attempt.id, r.attempt.transactionRef, r.attempt.note, r.attempt.status, r.attempt.reason, r.attempt.provider];
        const haystack = fields
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    })
    .sort(
      (a, b) =>
        new Date(rowCreatedAt(b)).getTime() - new Date(rowCreatedAt(a)).getTime(),
    );

  const totalPaid = requests.reduce(
    (acc, r) =>
      r.kind === "request" && r.request.status === AgentPaymentStatus.COMPLETED
        ? acc + Number(r.request.amount || 0)
        : acc,
    0,
  );
  const totalPages = Math.max(1, Math.ceil(requests.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = requests.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const openCount = requests.filter((r) =>
    r.kind === "request"
      ? OPEN_STATUSES.includes(r.request.status)
      : OPEN_ATTEMPT_STATUSES.includes(r.attempt.status),
  ).length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white uppercase tracking-tight flex items-center gap-2">
            <Banknote className="text-purple-500" size={20} />
            Payout Requests
          </h2>
          <p className="text-gray-500 text-xs mt-1">
            Every payout you have requested, including completed and rejected ones
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-[#191D24] rounded-xl border border-gray-800 p-5">
          <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">
            Total Requests
          </p>
          <p className="text-2xl font-bold text-white">{requests.length}</p>
        </div>
        <div className="bg-[#191D24] rounded-xl border border-gray-800 p-5">
          <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">
            Total Paid Out
          </p>
          <p className="text-2xl font-bold text-white tracking-tight">
            {totalPaid.toFixed(2)}
          </p>
        </div>
        <div className="bg-[#191D24] rounded-xl border border-gray-800 p-5">
          <p className="text-[10px] text-gray-500 uppercase font-bold mb-2">
            In Progress
          </p>
          <p className="text-2xl font-bold text-white">{openCount}</p>
        </div>
      </div>

      {/* Search + filters, same controls as the rest of the agent portal. */}
      <div className="flex items-center gap-2">
        <div className="relative group flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-purple-500 transition-colors" />
          <Input
            placeholder="Search request, reference or note..."
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
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase">
                  SR.
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase">
                  Requested On
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase">
                  Method
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase text-right">
                  Amount
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase text-right hidden sm:table-cell">
                  Transaction Ref
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase text-right">
                  Status
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-20">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                      <p className="text-gray-500 font-bold uppercase text-[10px]">
                        Loading payout requests...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16">
                    <EmptyStatePage
                      title="No payout requests yet"
                      description="Requests you raise from My Rewards will be listed here with their status."
                      image={notfound}
                      imageWidth={140}
                      imageHeight={70}
                    />
                  </td>
                </tr>
              ) : (
                pageRows.map((row, idx) => {
                  if (row.kind === "attempt") {
                    const a = row.attempt;
                    return (
                      <tr
                        key={`attempt-${a.id}`}
                        className="hover:bg-white/[0.02] transition-colors group"
                      >
                        <td className="px-6 py-4 text-gray-600 text-[10px] font-mono align-top">
                          #{(currentPage - 1) * PAGE_SIZE + idx + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap align-top">
                          <div className="flex items-center gap-2 text-gray-300 text-[12px] font-bold">
                            <Calendar size={12} className="text-purple-500/60" />
                            {format(parseISO(a.createdAt), "MMM dd, yyyy · HH:mm")}
                          </div>
                          {a.updatedAt !== a.createdAt && (
                            <p className="text-gray-600 text-[10px] font-bold mt-1 pl-5">
                              Updated{" "}
                              {format(parseISO(a.updatedAt), "MMM dd, yyyy · HH:mm")}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 align-top">
                          <p className="text-white text-[12px] font-bold tracking-tight">
                            {a.paymentMethod}
                          </p>
                          <p className="text-gray-500 text-[10px] font-bold">
                            [{a.provider}]
                          </p>
                          {/* The note is often just the "[BREEZE]" provider
                              tag, already shown on the line above. */}
                          {a.note && !/^\s*\[(BREEZE|COINFLOW)\]\s*$/i.test(a.note) && (
                            <p className="text-gray-500 text-[10px] font-bold max-w-[220px] truncate">
                              {a.note}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right align-top">
                          <span className="text-white font-bold text-base tracking-tight">
                            {Number(a.amount).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right hidden sm:table-cell align-top">
                          <span className="text-gray-600 text-[10px] font-mono tracking-tight flex items-center justify-end gap-1">
                            <Hash size={9} />
                            {a.transactionRef || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right align-top">
                          <div className="flex flex-col items-end gap-1">
                            <span
                              className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase border ${ATTEMPT_STYLE[a.status]}`}
                            >
                              {ATTEMPT_LABEL[a.status] || a.status}
                            </span>
                            {a.status === "INITIATED" && (
                              <span className="text-[10px] text-gray-500 font-bold max-w-[220px] text-right">
                                Amount reserved — finish the{" "}
                                {a.provider === "BREEZE" ? "Breeze" : "Coinflow"} form
                              </span>
                            )}
                            {a.status === "PROCESSING" && (
                              <span className="text-[10px] text-gray-500 font-bold max-w-[220px] text-right">
                                Details received — syncing with{" "}
                                {a.provider === "BREEZE" ? "Breeze" : "Coinflow"}
                              </span>
                            )}
                            {a.reason && (
                              <span className="flex items-start justify-end gap-1 text-[10px] text-red-400/80 font-bold max-w-[220px] text-right">
                                <AlertCircle size={10} className="mt-0.5 shrink-0" />
                                {a.reason}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  const request = row.request;
                  const settledAt =
                    request.completedAt ||
                    request.adminApprovedAt ||
                    request.agentApprovedAt;
                  return (
                    <tr
                      key={request.id}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      <td className="px-6 py-4 text-gray-600 text-[10px] font-mono align-top">
                        #{(currentPage - 1) * PAGE_SIZE + idx + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-top">
                        <div className="flex items-center gap-2 text-gray-300 text-[12px] font-bold">
                          <Calendar size={12} className="text-purple-500/60" />
                          {format(
                            parseISO(request.createdAt),
                            "MMM dd, yyyy · HH:mm",
                          )}
                        </div>
                        {settledAt && (
                          <p className="text-gray-600 text-[10px] font-bold mt-1 pl-5">
                            Updated{" "}
                            {format(parseISO(settledAt), "MMM dd, yyyy · HH:mm")}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <p className="text-white text-[12px] font-bold tracking-tight">
                          {request.paymentMethod || "—"}
                        </p>
                        {request.note && (
                          <p className="text-gray-500 text-[10px] font-bold max-w-[220px] truncate">
                            {request.note}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right align-top">
                        <span className="text-white font-bold text-base tracking-tight">
                          {Number(request.amount).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right hidden sm:table-cell align-top">
                        <span className="text-gray-600 text-[10px] font-mono tracking-tight flex items-center justify-end gap-1">
                          <Hash size={9} />
                          {request.transactionRef || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right align-top">
                        <div className="flex flex-col items-end gap-1">
                          {/* Before the payee finishes the Breeze/Coinflow
                              form the request is not in anyone else's hands —
                              say so instead of "Awaiting Admin". */}
                          {request.status === AgentPaymentStatus.PENDING_ADMIN &&
                          request.payoutReady === false ? (
                            <span className="px-3 py-1 rounded-full text-[11px] font-bold uppercase border bg-[#B93DEB]/10 border-[#B93DEB]/30 text-[#D98BFF]">
                              Awaiting Payment Details
                            </span>
                          ) : (
                            <span
                              className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase border ${
                                requestLabel(request).style
                              }`}
                            >
                              {requestLabel(request).label}
                            </span>
                          )}

                          {/* Ready, but the provider refused the release (e.g.
                              Coinflow on a small amount) — say why it is
                              still waiting instead of a bare "Awaiting Admin". */}
                          {request.payoutReleaseError && (
                            <span className="flex items-start justify-end gap-1 text-[10px] text-orange-400/90 font-bold max-w-[240px] text-right">
                              <AlertCircle size={10} className="mt-0.5 shrink-0" />
                              {request.payoutReleaseError}
                            </span>
                          )}

                          {/* The reason a rejection happened is the whole point
                              of keeping rejected rows visible. */}
                          {request.rejectionReason && (
                            <span className="flex items-start justify-end gap-1 text-[10px] text-red-400/80 font-bold max-w-[220px] text-right">
                              <AlertCircle size={10} className="mt-0.5 shrink-0" />
                              {request.rejectionReason}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 bg-black/10 border-t border-gray-800">
            <p className="text-[10px] text-gray-500 uppercase font-bold hidden sm:block">
              Showing {(currentPage - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(currentPage * PAGE_SIZE, requests.length)} of{" "}
              {requests.length} entries
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
        title="Payout Filters"
        statusOptions={[
          { label: "All Statuses", value: "All" },
          { label: "Pending Agent", value: "PENDING_AGENT" },
          { label: "Agent Approved", value: "AGENT_APPROVED" },
          { label: "Pending Admin", value: "PENDING_ADMIN" },
          { label: "Admin Approved", value: "ADMIN_APPROVED" },
          { label: "Completed", value: "COMPLETED" },
          { label: "Rejected by Agent", value: "REJECTED_BY_AGENT" },
          { label: "Rejected by Admin", value: "REJECTED_BY_ADMIN" },
          { label: "Payout Requested", value: "INITIATED" },
          { label: "In Progress", value: "PROCESSING" },
          { label: "Needs Review", value: "NEEDS_REVIEW" },
          { label: "Failed", value: "FAILED" },
          { label: "Cancelled", value: "CANCELLED" },
          { label: "Expired", value: "EXPIRED" },
          { label: "Not Completed", value: "ABANDONED" },
        ]}
      />

    </div>
  );
}
