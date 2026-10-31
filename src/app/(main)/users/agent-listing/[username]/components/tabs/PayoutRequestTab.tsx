"use client";

import { useEffect, useState, useMemo } from "react";
import CopyButton from "@/components/CopyButton";
import FilterToolbar from "@/components/filters/FilterToolbar";
import EntityFilterSheet from "@/components/filters/EntityFilterSheet";
import { useEntityFilters } from "@/components/filters/useEntityFilters";
import { applyClientFilters } from "@/components/filters/applyClientFilters";
import type { FilterField, FilterValues } from "@/components/filters/types";
import { ClaimRecord, UserWithProfile } from "@/types/profile.type";
import { profileApi } from "@/api/users/users";
import { connectSocket } from "@/lib/socket";
import {
  agentPaymentApi,
  AgentPaymentRequest,
  AgentPaymentStatus,
} from "@/api/agent-payment/agent-payment.api";
import {
  Loader2,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Wrench,
  Eye,
} from "lucide-react";
import Pagination from "@/components/Pagination";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * ADMIN MONEY-ACTION GATING
 *
 * A payout request carries `paymentDetails = { provider }` from the moment it is
 * raised — before the Breeze/Coinflow form is filled in — and keeps them after a
 * provider payout FAILS. So status alone never meant "payable": an agent who
 * raised a claim and abandoned the payment step still landed in this table with
 * Approve (and then Complete) enabled, and Complete consumes their frozen funds
 * without any money leaving. `payoutReady` is the server's answer to "is there a
 * confirmed destination on a payout that hasn't died?" — the same check
 * adminApprove / adminComplete enforce. Older API responses omit the flag; treat
 * a missing flag as not-ready rather than silently re-opening the hole.
 */
const payoutReady = (r: AgentPaymentRequest) => r.payoutReady === true;

/**
 * Statuses where an admin still has something to decide. AGENT_APPROVED is
 * included so a request stranded there (parent agent approved, payee never
 * finished the payment step) can at least be rejected — its funds are frozen
 * until someone does.
 */
const isActionable = (r: AgentPaymentRequest) =>
  r.status === AgentPaymentStatus.PENDING_ADMIN ||
  r.status === AgentPaymentStatus.ADMIN_APPROVED ||
  r.status === AgentPaymentStatus.AGENT_APPROVED;


const PAYOUT_FILTER_DEFAULTS: FilterValues = {
  search: "",
  status: "all",
  method: "all",
  from: "",
  to: "",
  minAmount: "",
  maxAmount: "",
};

const PAYOUT_FILTER_FIELDS: FilterField[] = [
  {
    type: "select",
    key: "status",
    label: "Status",
    options: [
      { label: "All Statuses", value: "all" },
      { label: "Pending Agent", value: "PENDING_AGENT" },
      { label: "Agent Approved", value: "AGENT_APPROVED" },
      { label: "Pending Admin", value: "PENDING_ADMIN" },
      { label: "Admin Approved", value: "ADMIN_APPROVED" },
      { label: "Completed", value: "COMPLETED" },
      { label: "Rejected by Agent", value: "REJECTED_BY_AGENT" },
      { label: "Rejected by Admin", value: "REJECTED_BY_ADMIN" },
    ],
  },
  {
    type: "select",
    key: "method",
    label: "Method",
    options: [
      { label: "All Methods", value: "all" },
      { label: "Bank", value: "BANK" },
      { label: "Crypto", value: "CRYPTO" },
    ],
  },
  { type: "dateRange", fromKey: "from", toKey: "to", label: "Requested Between" },
  { type: "numberRange", minKey: "minAmount", maxKey: "maxAmount", label: "Amount" },
];
const PayoutRequestTab = ({ agent }: { agent: UserWithProfile }) => {
  const { user, hasRole } = useAuth();
  // This tab only renders inside the admin area, so any viewer who is not an
  // agent / sub-agent is back-office staff. Matching three literal role names
  // instead left staff on admin-created roles ("manager", "finance", …) with a
  // read-only view — the requests listed but every Approve / Reject / Complete
  // action hidden, with nothing on screen explaining why.
  const isAdmin = !hasRole("agent") && !hasRole("subagent");
  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedReq, setSelectedReq] = useState<ClaimRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const PAGE_SIZE = 10;

  /**
   * Payout REQUESTS (`agent_payment_requests`) — the table the Request Payout
   * flow actually writes to. This tab used to render referral CLAIMS only, so a
   * sub-agent with real payout requests and no claims saw "No payout requests
   * found" while a PENDING_ADMIN request sat waiting. Two separate systems;
   * both belong on this tab.
   */
  const [requests, setRequests] = useState<AgentPaymentRequest[]>([]);

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
    fields: PAYOUT_FILTER_FIELDS,
    defaults: PAYOUT_FILTER_DEFAULTS,
  });

  // Only the live request queue is filtered; the legacy claim history below is
  // a frozen pre-June-2026 record and is left exactly as it is.
  const visibleRequests = useMemo(
    () =>
      applyClientFilters(requests, filters, {
        search: (r) => [r.id, r.status, r.transactionRef, r.note, r.requester?.username],
        selects: [
          { key: "status", match: (r, v) => r.status === v },
          { key: "method", match: (r, v) => r.paymentMethod === v },
        ],
        dateRange: { fromKey: "from", toKey: "to", get: (r) => r.createdAt },
        numberRanges: [
          { minKey: "minAmount", maxKey: "maxAmount", get: (r) => Number(r.amount || 0) },
        ],
      }),
    [requests, filters],
  );
  const [reqLoading, setReqLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  // Shared reject-reason modal — replaces window.prompt(), which rendered as a
  // bare browser alert. Serves both flows on this tab: payout requests
  // (agent_payment_requests) and legacy claims (referral_claims).
  const [rejectPrompt, setRejectPrompt] = useState<
    | { kind: "request"; req: AgentPaymentRequest }
    | { kind: "claim"; id: string }
    | null
  >(null);
  const [rejectReason, setRejectReason] = useState("");

  /**
   * Load failures used to leave both tables on their "nothing here" empty state,
   * which is indistinguishable from a genuinely empty queue — a 403/500 read as
   * "this agent has no payout requests". Track the error so the table can say so
   * and offer a retry.
   */
  const [reqError, setReqError] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  const readError = (error: any, fallback: string) =>
    error?.response?.data?.message || error?.message || fallback;

  const fetchClaims = async () => {
    try {
      setLoading(true);
      setClaimError(null);
      const res = await profileApi.getAgentClaimHistoryById(agent.id);
      setClaims(res.data || []);
    } catch (error: any) {
      console.error("Failed to fetch claim history:", error);
      setClaims([]);
      setClaimError(readError(error, "Failed to load claim history"));
      toast.error("Failed to load payout history");
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async (opts: { silent?: boolean } = {}) => {
    try {
      if (!opts.silent) setReqLoading(true);
      const res = await agentPaymentApi.adminList({
        requesterEmployeeId: agent.id,
        limit: 100,
      });
      setRequests(res.data.items || []);
      setReqError(null);
    } catch (error: any) {
      console.error("Failed to fetch payout requests:", error);
      // A silent (socket-triggered) refresh must not wipe the table the admin
      // is reading, nor pop a toast they did not ask for.
      if (!opts.silent) {
        setRequests([]);
        setReqError(readError(error, "Failed to load payout requests"));
        toast.error("Failed to load payout requests");
      }
    } finally {
      if (!opts.silent) setReqLoading(false);
    }
  };

  /**
   * Admin decision on a payout request. `approve` is review-and-confirm only
   * (PENDING_ADMIN → ADMIN_APPROVED) — it does not move money. Breeze/Coinflow
   * payouts are released via the provider; manual ones settle on `complete`,
   * which is when the frozen funds are actually released.
   */
  const handleRequestAction = async (
    r: AgentPaymentRequest,
    action: "approve" | "reject" | "complete",
  ) => {
    // Completing books the request as paid and consumes the agent's frozen
    // funds without calling the provider — the one action here that is wrong to
    // take on a hunch.
    if (
      action === "complete" &&
      !window.confirm(
        `Mark ${Number(r.amount).toFixed(2)} as PAID?\n\nThis settles the agent's frozen funds and closes the request WITHOUT sending money through the payment provider. Only do this if the payout has already been sent by other means.`,
      )
    ) {
      return;
    }

    // The API requires a reject reason, and rejecting without one leaves the
    // agent with no explanation — collect it in the modal, then submit via
    // submitRejectPrompt.
    if (action === "reject") {
      setRejectPrompt({ kind: "request", req: r });
      setRejectReason("");
      return;
    }

    setActingId(r.id);
    try {
      if (action === "approve") await agentPaymentApi.adminApprove(r.id);
      else await agentPaymentApi.adminComplete(r.id);
      toast.success(
        action === "approve" ? "Payout approved" : "Payout marked completed",
      );
      fetchRequests();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || `Failed to ${action}`);
    } finally {
      setActingId(null);
    }
  };

  const submitRejectPrompt = async () => {
    const target = rejectPrompt;
    const reason = rejectReason.trim();
    if (!target || !reason) return;

    if (target.kind === "claim") {
      // Legacy claim flow — handleAction owns its own toast lifecycle.
      handleAction(target.id, "REJECT", reason);
      setRejectPrompt(null);
      setRejectReason("");
      return;
    }

    const r = target.req;
    setActingId(r.id);
    try {
      await agentPaymentApi.adminReject(r.id, reason);
      toast.success("Payout rejected");
      setRejectPrompt(null);
      setRejectReason("");
      fetchRequests();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to reject");
    } finally {
      setActingId(null);
    }
  };

  const handleAction = (id: string, action: "APPROVE" | "REJECT" | "COMPLETE", customReason?: string) => {
    let call;
    if (isAdmin) {
        if (action === "APPROVE") call = profileApi.adminApprovePayout(id);
        else if (action === "REJECT") call = profileApi.adminRejectPayout(id, customReason || "Admin rejection");
        else call = profileApi.adminCompletePayout(id);
    } else {
        if (action === "APPROVE") call = profileApi.approvePayout(id);
        else call = profileApi.rejectPayout(id);
    }

    toast.promise(
      call,
      {
        loading: `${action === "APPROVE" ? "Approving" : action === "REJECT" ? "Rejecting" : "Completing"} request...`,
        success: () => {
          fetchClaims();
          return `Request ${action === "APPROVE" ? "approved" : action === "REJECT" ? "rejected" : "completed"} successfully!`;
        },
        error: "Action failed",
      }
    );
  };

  useEffect(() => {
    if (agent.id) {
      fetchClaims();
      fetchRequests();
    }
  }, [agent.id]);

  /**
   * The backend emits `agent-payment:updated` to every admin after each
   * committed state change (create / agent approve-reject / admin release /
   * complete). Without this the tab only ever showed the snapshot taken when it
   * mounted, so a request raised while an admin sat on the page kept reading
   * "No payout requests found" until a manual reload.
   */
  useEffect(() => {
    if (!agent.id) return;
    const socket = connectSocket();
    if (!socket) return;

    const onUpdated = (payload: any) => {
      // Other agents' requests reach this room too — ignore anything that is
      // not the agent currently on screen.
      if (payload?.requesterEmployeeId && payload.requesterEmployeeId !== agent.id) {
        return;
      }
      void fetchRequests({ silent: true });
    };

    socket.on("agent-payment:updated", onUpdated);
    return () => {
      socket.off("agent-payment:updated", onUpdated);
    };
  }, [agent.id]);

  const totalPages = Math.max(1, Math.ceil(claims.length / PAGE_SIZE));
  const paginatedClaims = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return claims.slice(start, start + PAGE_SIZE);
  }, [claims, currentPage]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle className="text-green-400 w-4 h-4" />;
      case "REJECTED":
        return <XCircle className="text-red-400 w-4 h-4" />;
      case "PENDING":
      case "REQUESTED":
        return <Clock className="text-orange-400 w-4 h-4" />;
      case "APPROVED":
      case "PROCESSING":
        return <AlertCircle className="text-blue-400 w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-500/10 text-green-400 border-green-500/20";
      case "REJECTED":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "PENDING":
      case "REQUESTED":
        return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      case "APPROVED":
      case "PROCESSING":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      default:
        return "bg-gray-500/10 text-gray-400 border-gray-500/20";
    }
  };

  const REQUEST_STATUS_STYLES: Record<string, string> = {
    PENDING_AGENT: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    PENDING_ADMIN: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    AGENT_APPROVED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    ADMIN_APPROVED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    COMPLETED: "bg-green-500/10 text-green-400 border-green-500/20",
    REJECTED_BY_AGENT: "bg-red-500/10 text-red-500 border-red-500/20",
    REJECTED_BY_ADMIN: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500 md:space-y-6">
      {/* PAYOUT REQUESTS — agent_payment_requests */}
      <div className="bg-[#191D24] rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
        <div className="bg-white/5 px-3 py-4 border-b border-white/5 md:px-6">
          <FilterToolbar
            title="Payout Requests"
            countLabel={
              loading
                ? undefined
                : `${visibleRequests.length} ${visibleRequests.length === 1 ? "request" : "requests"}`
            }
            searchValue={searchInput}
            onSearchChange={setSearchInput}
            searchPlaceholder="Search request id, ref or note"
            activeCount={activeCount}
            chips={chips}
            hasAnyFilter={hasAnyFilter}
            onOpenFilters={() => setSheetOpen(true)}
            onResetAll={resetFilters}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-[#15181E] border-b border-white/5">
              <tr>
                {["Request ID", "Date", "Amount", "Method", "Status", "Action"].map(
                  (h, i) => (
                    <th
                      key={h}
                      className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 ${
                        i === 2 ? "text-right" : i >= 4 ? "text-center" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {reqLoading ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center">
                    <Loader2 className="mx-auto animate-spin text-[#B93DEB]" size={24} />
                  </td>
                </tr>
              ) : reqError ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center">
                    <p className="text-sm text-red-400 font-medium">{reqError}</p>
                    <button
                      onClick={() => fetchRequests()}
                      className="mt-3 px-4 py-1.5 rounded-lg bg-[#B93DEB] hover:bg-[#A030D0] text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ) : visibleRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-gray-500">
                    {hasAnyFilter
                      ? "No payout requests match these filters."
                      : "No payout requests found."}
                      <span className="mt-1 block text-[11px] text-gray-600">
                        Requests appear here once the agent submits one. Money
                        held in the wallet is not a request — fresh commission
                        sits on a safety hold until it matures.
                      </span>
                  </td>
                </tr>
              ) : (
                visibleRequests.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono text-gray-400 bg-black/30 px-2 py-1 rounded-md">
                        {r.id.slice(0, 12)}...
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-gray-600" />
                        {new Date(r.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-black text-white">
                        {Number(r.amount).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300">
                      <div>{r.paymentMethod ?? "—"}</div>
                      {r.paymentDetails?.provider && (
                        <div className="text-[10px] text-gray-500">
                          {String(r.paymentDetails.provider)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <div
                          className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${
                            REQUEST_STATUS_STYLES[r.status] ??
                            "bg-gray-500/10 text-gray-400 border-gray-500/20"
                          }`}
                        >
                          {r.status}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex justify-center gap-2">
                          {isAdmin && isActionable(r) ? (
                            <>
                              {payoutReady(r) &&
                                r.status === AgentPaymentStatus.PENDING_ADMIN && (
                                  <button
                                    onClick={() => handleRequestAction(r, "approve")}
                                    disabled={actingId === r.id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
                                  >
                                    {actingId === r.id ? (
                                      <Loader2 className="animate-spin" size={12} />
                                    ) : (
                                      <CheckCircle size={12} />
                                    )}
                                    Approve
                                  </button>
                                )}
                              {payoutReady(r) &&
                                r.status === AgentPaymentStatus.ADMIN_APPROVED && (
                                  <button
                                    onClick={() => handleRequestAction(r, "complete")}
                                    disabled={actingId === r.id}
                                    title="Settles the frozen funds WITHOUT calling the payment provider. Use only after the payout has actually been sent."
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
                                  >
                                    {actingId === r.id ? (
                                      <Loader2 className="animate-spin" size={12} />
                                    ) : (
                                      <CheckCircle size={12} />
                                    )}
                                    Complete
                                  </button>
                                )}
                              {/* Reject stays available on every open admin-side
                                  status — it is the only way to hand a stuck
                                  request's frozen funds back to the agent. */}
                              <button
                                onClick={() => handleRequestAction(r, "reject")}
                                disabled={actingId === r.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
                              >
                                <XCircle size={12} />
                                Reject
                              </button>
                            </>
                          ) : r.status === AgentPaymentStatus.PENDING_AGENT ? (
                            <span className="text-[10px] uppercase tracking-wider text-gray-500">
                              Awaiting parent agent
                            </span>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </div>
                        {/* Why Approve / Complete are missing. Without this the
                            unfinished-payment case reads as a UI bug. */}
                        {isAdmin && isActionable(r) && !payoutReady(r) && (
                          <span
                            title={r.payoutBlockReason ?? undefined}
                            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-orange-400 text-center max-w-[220px]"
                          >
                            <AlertCircle size={11} className="shrink-0" />
                            Payment not completed
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CLAIM HISTORY — LEGACY referral_claims. Agent payouts moved to the
          agent-payment flow (the Payout Requests table above) in June 2026;
          referral_claims has received no agent/sub-agent rows since. Rendering
          the full table with a permanent "No claims found." made the tab look
          broken for every agent on the current flow, so the table only appears
          when there is legacy data (or the fetch failed and a retry is due). */}
      {!loading && !claimError && claims.length === 0 ? (
        <p className="text-[11px] text-gray-500 px-2">
          No legacy claim history for this account — payouts made through the
          current flow are all listed under Payout Requests above.
        </p>
      ) : (
      <div className="bg-[#191D24] rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
        <div className="bg-white/5 px-3 py-4 border-b border-white/5 md:px-6">
          <h3 className="text-white font-black uppercase tracking-[0.2em] text-[11px]">
            Claim History
            <span className="ml-2 text-gray-500 normal-case tracking-normal font-bold">
              (legacy claims — before June 2026)
            </span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead className="bg-[#15181E] border-b border-white/5">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                  Request ID
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                  Date
                </th>
                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                  Amount
                </th>
                <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                  Transaction
                </th>
                <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center">
                    <Loader2
                      className="mx-auto animate-spin text-[#B93DEB]"
                      size={24}
                    />
                  </td>
                </tr>
              ) : claimError ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center">
                    <p className="text-sm text-red-400 font-medium">{claimError}</p>
                    <button
                      onClick={fetchClaims}
                      className="mt-3 px-4 py-1.5 rounded-lg bg-[#B93DEB] hover:bg-[#A030D0] text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95"
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              ) : paginatedClaims.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-gray-500">
                    No claims found.
                  </td>
                </tr>
              ) : (
                paginatedClaims.map((claim) => (
                  <tr
                    key={claim.id}
                    className="hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono text-gray-400 bg-black/30 px-2 py-1 rounded-md">
                        {claim.id.slice(0, 12)}...
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-gray-600" />
                        {new Date(claim.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-black text-white">
                        {Number(claim.amount).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <div
                          className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${getStatusStyles(claim.status)}`}
                        >
                          {getStatusIcon(claim.status)}
                          {claim.status}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-gray-500 truncate block max-w-[150px]">
                        {claim.transactionId || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="text-red-400 hover:text-orange-400 transition-colors bg-[#1a2030] p-2 rounded-lg border border-gray-800">
                              <Wrench size={16} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="bg-[#1a2030] text-white border border-gray-700 p-2 min-w-[160px]"
                          >
                            <DropdownMenuLabel className="text-gray-400 text-[10px] uppercase font-black px-2 py-1.5">
                              Action Menu
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-gray-700 my-1 mx-1" />

                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedReq(claim);
                                setDetailOpen(true);
                              }}
                              className="text-xs hover:bg-white/5 cursor-pointer rounded-md py-2"
                            >
                              <Eye className="mr-2 h-4 w-4 text-blue-400" /> View Details
                            </DropdownMenuItem>

                            {(claim.status === "PENDING" || claim.status === "REQUESTED") && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleAction(claim.id, "APPROVE")}
                                  className="text-xs hover:bg-green-500/10 text-green-400 cursor-pointer rounded-md py-2"
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" /> Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setRejectPrompt({ kind: "claim", id: claim.id });
                                    setRejectReason("");
                                  }}
                                  className="text-xs hover:bg-red-500/10 text-red-400 cursor-pointer rounded-md py-2"
                                >
                                  <XCircle className="mr-2 h-4 w-4" /> Reject Request
                                </DropdownMenuItem>
                              </>
                            )}

                            {isAdmin && (claim.status === "APPROVED" || claim.status === "PROCESSING") && (
                              <DropdownMenuItem
                                onClick={() => handleAction(claim.id, "COMPLETE")}
                                className="text-xs hover:bg-blue-500/10 text-blue-400 cursor-pointer rounded-md py-2 font-bold"
                              >
                                <CheckCircle className="mr-2 h-4 w-4" /> Complete & Settle
                              </DropdownMenuItem>
                            )}

                            {(claim.status === "COMPLETED" || claim.status === "REJECTED") && (
                              <DropdownMenuItem disabled className="text-xs text-gray-500 cursor-not-allowed rounded-md py-2 font-bold italic">
                                Action Completed
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && totalPages > 1 && (
          <div className="flex justify-center px-3 py-5 md:px-6">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="w-[calc(100%-2rem)] bg-[#191D24] text-white border-gray-800 max-w-sm p-0 overflow-hidden rounded-xl">
          <DialogHeader className="p-4 pb-2 border-b border-gray-800 flex flex-row items-center justify-between md:p-6 md:pb-2">
            <DialogTitle className="text-base font-bold uppercase tracking-tight">Review Payout Request</DialogTitle>
          </DialogHeader>
          {selectedReq && (
            <div className="p-4 space-y-5 animate-in fade-in duration-300 md:p-6">
              {/* Request Summary Block */}
              <div className="bg-[#15181E] p-4 rounded-xl border border-gray-800 space-y-4">
                <div className="flex justify-between items-center text-[10px] uppercase font-black text-gray-500">
                  <span>User / Agent</span>
                  <span className="flex items-center gap-1.5 text-purple-400 font-mono tracking-tighter">
                    {agent.username || 'Unknown'}
                    <CopyButton value={agent.username} size={12} />
                  </span>
                </div>
                
                <div className="bg-orange-500/5 p-3 rounded-lg border border-orange-500/10 flex justify-between items-center">
                  <span className="text-[10px] text-orange-200/60 uppercase font-black tracking-widest">Requested Amt</span>
                  {/* Two decimals, like every other money figure in the portal:
                      bare toLocaleString() printed 1.0284 as "1.028", which
                      reads as 1,028 on an amount an admin is about to approve. */}
                  <span className="text-lg font-black text-orange-400 italic font-mono tracking-tighter">
                    {Number(selectedReq.amount || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex justify-between items-center px-1">
                 <span className="text-[10px] text-gray-500 uppercase font-bold">Current Status</span>
                 <span className="text-[10px] font-black uppercase text-orange-500">{selectedReq.status}</span>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  onClick={() => {
                     setRejectPrompt({ kind: "claim", id: selectedReq.id });
                     setRejectReason("");
                     setDetailOpen(false);
                  }}
                  variant="destructive" 
                  className="rounded-xl h-12 uppercase text-[10px] font-black group"
                >
                  <XCircle size={14} className="mr-2 group-hover:animate-bounce" /> Reject
                </Button>
                
                {isAdmin && (selectedReq.status === "APPROVED" || selectedReq.status === "PROCESSING") ? (
                   (() => {
                      const approvedAt = selectedReq.approvedAt ? new Date(selectedReq.approvedAt) : null;
                      const now = new Date();
                      const daysPassed = approvedAt ? Math.floor((now.getTime() - approvedAt.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                      const daysRemaining = Math.max(0, 45 - daysPassed);
                      const isLocked = daysRemaining > 0;

                      return (
                        <div className="w-full space-y-2">
                           {isLocked && (
                             <p className="text-[10px] text-center text-orange-400 font-bold animate-pulse">
                               Locked for {daysRemaining} days
                             </p>
                           )}
                           <Button 
                              disabled={isLocked}
                              onClick={() => { handleAction(selectedReq.id, "COMPLETE"); setDetailOpen(false); }} 
                              className={`${isLocked ? "bg-gray-600 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"} text-white rounded-xl h-12 w-full uppercase text-[10px] font-black group shadow-blue-500/10 shadow-lg`}
                           >
                              <CheckCircle size={14} className="mr-2 group-hover:scale-125 transition-transform" /> 
                              {isLocked ? `Wait ${daysRemaining} Days` : "Complete & Pay"}
                           </Button>
                        </div>
                      );
                   })()
                ) : (
                   <Button onClick={() => { handleAction(selectedReq.id, "APPROVE"); setDetailOpen(false); }} className="bg-green-600 hover:bg-green-700 text-white rounded-xl h-12 uppercase text-[10px] font-black group shadow-green-500/10 shadow-lg">
                      <CheckCircle size={14} className="mr-2 group-hover:scale-125 transition-transform" /> Approve
                   </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject-reason modal (both payout requests and legacy claims) */}
      {rejectPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#15181E] border border-gray-800 shadow-2xl p-4 md:p-6 space-y-4">
            <h2 className="text-white text-lg font-bold">Reject payout request</h2>
            <p className="text-gray-400 text-sm">
              {rejectPrompt.kind === "request" ? (
                <>
                  Rejecting the{" "}
                  <span className="text-white font-mono">
                    {Number(rejectPrompt.req.amount).toFixed(2)}
                  </span>{" "}
                  payout request. The reason is shown to the agent, so make it
                  actionable.
                </>
              ) : (
                <>Rejecting this claim. The reason is shown to the agent.</>
              )}
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              autoFocus
              placeholder="Reason for rejection (required)"
              className="w-full resize-none rounded-xl bg-[#1C2128] border border-gray-800 text-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setRejectPrompt(null); setRejectReason(""); }}
                className="px-5 py-2 rounded-xl border border-gray-700 text-white hover:bg-white/5 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => void submitRejectPrompt()}
                disabled={
                  !rejectReason.trim() ||
                  (rejectPrompt.kind === "request" &&
                    actingId === rejectPrompt.req.id)
                }
                className="px-6 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {rejectPrompt.kind === "request" &&
                  actingId === rejectPrompt.req.id && (
                    <Loader2 className="animate-spin" size={16} />
                  )}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      <EntityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Payout Filters"
        description="Filter this agent's payout requests"
        fields={PAYOUT_FILTER_FIELDS}
        values={filters}
        defaults={PAYOUT_FILTER_DEFAULTS}
        onApply={setFilters}
      />
    </div>
  );
};

export default PayoutRequestTab;
