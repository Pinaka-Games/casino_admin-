"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { connectSocket } from "@/lib/socket";
import {
  Search,
  Eye,
  CheckCircle,
  XCircle,
  Wrench,
  Loader2,
  Banknote,
  Bitcoin,
  Coins,
  CreditCard,
  RefreshCw,
  Send,
  ExternalLink,
  AlertTriangle,
  Clock,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CopyButton from "@/components/CopyButton";
import NoData from "@/components/NoData";
import Pagination from "@/components/Pagination";
import TableSkeleton from "@/components/TableSkeleton";
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
import { FeatureGate } from "@/app/agent-management/components/FeatureGate";
import { useFeatureAccess } from "@/hooks/use-feature-access";
import { useAgentPackageStore } from "@/store/agent-package.store";
import { useAuth } from "@/context/AuthContext";
import {
  agentPaymentApi,
  AgentPaymentRequest,
  AgentPaymentRequesterType,
  AgentPaymentStatus,
  AgentPaymentMethod,
} from "@/api/agent-payment/agent-payment.api";
import {
  agentBreezeApi,
  AgentBreezePage,
} from "@/api/agent-payment/agent-breeze.api";
import {
  agentCoinflowApi,
  AgentCoinflowPayout,
} from "@/api/agent-payment/agent-coinflow.api";
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
  "grid-cols-[120px_1fr_90px_0.8fr_1.5fr_120px_110px_80px]";

type TabKey = "ALL" | AgentPaymentRequesterType;

const STATUS_COLORS: Record<string, string> = {
  PENDING_AGENT: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  AGENT_APPROVED: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  PENDING_ADMIN: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  ADMIN_APPROVED: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  COMPLETED: "text-green-400 bg-green-500/10 border-green-500/20",
  REJECTED_BY_AGENT: "text-red-400 bg-red-500/10 border-red-500/20",
  REJECTED_BY_ADMIN: "text-red-400 bg-red-500/10 border-red-500/20",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_AGENT: "Pending Agent",
  AGENT_APPROVED: "Agent Approved",
  PENDING_ADMIN: "Pending Admin",
  ADMIN_APPROVED: "Admin Approved",
  COMPLETED: "Completed",
  REJECTED_BY_AGENT: "Rejected by Agent",
  REJECTED_BY_ADMIN: "Rejected by Admin",
};

/**
 * Status pill text/colour. A claim is created the moment the Breeze/Coinflow
 * page opens, so "Pending Admin" alone would claim it is in the admin's hands
 * while the payee is still filling the form (`payoutReady === false`).
 * REJECTED_BY_AGENT also stores the requester's own cancel and supersede — read
 * the reason rather than blaming an agent.
 */
function statusPill(r: { status: string; payoutReady?: boolean; rejectionReason?: string }) {
  if (
    (r.status === AgentPaymentStatus.PENDING_ADMIN ||
      r.status === AgentPaymentStatus.PENDING_AGENT) &&
    r.payoutReady === false
  ) {
    return {
      label: "Awaiting Payment Details",
      color: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    };
  }
  if (r.status === AgentPaymentStatus.REJECTED_BY_AGENT) {
    const reason = (r.rejectionReason ?? "").toLowerCase();
    const grey = "text-gray-400 bg-gray-500/10 border-gray-500/20";
    if (reason.startsWith("cancelled by the requester")) return { label: "Cancelled", color: grey };
    if (reason.startsWith("superseded")) return { label: "Replaced", color: grey };
    if (reason.startsWith("duplicate request")) return { label: "Duplicate — Refunded", color: grey };
    if (reason.startsWith("payout form was not completed")) return { label: "Not Completed", color: grey };
    if (reason.includes("could not be opened") || reason.startsWith("payout too small")) return { label: "Failed", color: STATUS_COLORS.REJECTED_BY_AGENT };
  }
  return {
    label: STATUS_LABEL[r.status] || r.status,
    color: STATUS_COLORS[r.status] || "text-gray-400 bg-gray-500/10 border-gray-500/20",
  };
}

export default function PayoutRequestsPage() {
  const { hasRole, user } = useAuth();
  /*
    Roles arrive after the first render. Until then hasRole() is false for
    everything, so isAdmin (derived by exclusion below) read TRUE for an agent:
    the page fired the admin list, then the agent list once roles loaded, and
    whichever answered last won — usually the bigger admin list, so an agent
    saw every agent's payout requests. Nothing is fetched until roles are in.
  */
  const rolesReady = Boolean(user?.roles?.length);
  // Only the newest fetch may write the table, so a slow earlier response
  // cannot overwrite a later one.
  const fetchSeq = useRef(0);
  const isAgent = hasRole("agent");
  // Sub-agents see this page too — scoped to their OWN requests, so they can
  // check the status of a past payout instead of only ever seeing the dashboard
  // banner for the newest one.
  const isSubAgent = hasRole("subagent");
  // Anyone signed in here who is NOT an agent / sub-agent is back-office staff.
  //
  // This used to be an allow-list of three literal role names
  // (ADMIN / admin / superadmin). Roles are admin-created in this product, so a
  // staff account on any other role ("manager", "finance", "support" — the
  // backend itself treats `manager` as an admin role) matched nothing, fell
  // through to the final `else`, and had `requests` set to an empty array: the
  // payout queue rendered "no data" with no error and no way to tell why.
  // Deriving it by exclusion keeps every staff role working; the backend
  // remains the authority on what they may actually do.
  const isAdmin = !isAgent && !isSubAgent;
  const { currentPackage, fetchCurrentPackage } = useAgentPackageStore();
  const { canWithdraw } = useFeatureAccess();

  useEffect(() => {
    if (!currentPackage) fetchCurrentPackage();
  }, [currentPackage, fetchCurrentPackage]);

  const [requests, setRequests] = useState<AgentPaymentRequest[]>([]);
  const [loading, setLoading] = useState(false);
  // Non-null when the last load failed, so the table can say so instead of
  // rendering the same "no requests" empty state a genuinely empty queue shows.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKey>("ALL");

  const [selectedReq, setSelectedReq] = useState<AgentPaymentRequest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [actioning, setActioning] = useState(false);

  // Breeze payout page tied to the selected request (provider === "BREEZE")
  const [breezePage, setBreezePage] = useState<AgentBreezePage | null>(null);
  const [breezeLoading, setBreezeLoading] = useState(false);
  const [breezeActioning, setBreezeActioning] = useState(false);

  // Coinflow payout tied to the selected request (provider === "COINFLOW")
  const [coinflowPayout, setCoinflowPayout] = useState<AgentCoinflowPayout | null>(null);
  const [coinflowLoading, setCoinflowLoading] = useState(false);
  const [coinflowActioning, setCoinflowActioning] = useState(false);

  const isBreeze = (r: AgentPaymentRequest | null) =>
    !!r && (r.paymentDetails as any)?.provider === "BREEZE";

  const isCoinflow = (r: AgentPaymentRequest | null) =>
    !!r && (r.paymentDetails as any)?.provider === "COINFLOW";

  // A sub-agent request carries `paymentDetails.provider` from the moment it is
  // created — before the payee has entered anything on the hosted page — so the
  // provider panel showing up says nothing about whether there is a destination
  // to pay. Release is only real once the provider confirms one; the backend
  // refuses otherwise, so the button must follow the same rule.
  const BREEZE_RELEASE_READY_STAGES = [
    "PENDING_MERCHANT_RELEASE",
    "MERCHANT_RELEASE",
    "PENDING_RELEASE",
  ];
  const breezeReleaseReady =
    !!breezePage &&
    (breezePage.releaseReady ??
      (!!breezePage.customerConfirmedAtMs ||
        BREEZE_RELEASE_READY_STAGES.includes(
          (breezePage.pendingStatus || "").toUpperCase(),
        )));
  const coinflowReleaseReady = !!coinflowPayout?.customerConfirmedAtMs;

  const loadBreezePage = async (requestId: string) => {
    try {
      setBreezeLoading(true);
      const res = await agentBreezeApi.getByRequest(requestId);
      setBreezePage(res.data);
    } catch {
      setBreezePage(null);
    } finally {
      setBreezeLoading(false);
    }
  };

  const loadCoinflowPayout = async (requestId: string) => {
    try {
      setCoinflowLoading(true);
      const res = await agentCoinflowApi.getByRequest(requestId);
      setCoinflowPayout(res.data);
    } catch {
      setCoinflowPayout(null);
    } finally {
      setCoinflowLoading(false);
    }
  };

  // When the review panel opens, fetch the provider payout tied to the request.
  useEffect(() => {
    if (detailOpen && isBreeze(selectedReq)) {
      loadBreezePage(selectedReq!.id);
    } else {
      setBreezePage(null);
    }
    if (detailOpen && isCoinflow(selectedReq)) {
      loadCoinflowPayout(selectedReq!.id);
    } else {
      setCoinflowPayout(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailOpen, selectedReq]);

  const handleCoinflowAction = async (action: "RELEASE" | "REFRESH") => {
    if (!coinflowPayout) return;
    try {
      setCoinflowActioning(true);
      const res =
        action === "RELEASE"
          ? await agentCoinflowApi.adminRelease(coinflowPayout.id)
          : await agentCoinflowApi.adminRefresh(coinflowPayout.id);
      setCoinflowPayout(res.data);
      toast.success(
        action === "RELEASE"
          ? "Coinflow payout released"
          : "Coinflow status refreshed",
      );
      await fetchRequests();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Coinflow action failed");
    } finally {
      setCoinflowActioning(false);
    }
  };

  const handleBreezeAction = async (action: "RELEASE" | "REFRESH") => {
    if (!breezePage) return;
    try {
      setBreezeActioning(true);
      const res =
        action === "RELEASE"
          ? await agentBreezeApi.adminRelease(breezePage.id)
          : await agentBreezeApi.adminRefresh(breezePage.id);
      setBreezePage(res.data);
      toast.success(
        action === "RELEASE" ? "Breeze payout released" : "Breeze status refreshed",
      );
      await fetchRequests();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Breeze action failed");
    } finally {
      setBreezeActioning(false);
    }
  };

  useEffect(() => {
    if (!rolesReady) return;
    fetchRequests();
  }, [rolesReady, isAdmin, isAgent, isSubAgent]);

  /**
   * An agent's own payout requests plus the ones their sub-agents raised
   * (which wait on the agent's approval) — and nobody else's. Newest first.
   */
  const loadAgentRows = async (): Promise<AgentPaymentRequest[]> => {
    const [own, subs] = await Promise.all([
      agentPaymentApi.myRequests(),
      agentPaymentApi.agentSubRequests(),
    ]);
    const byId = new Map<string, AgentPaymentRequest>();
    [...(own.data || []), ...(subs.data || [])].forEach((r) => byId.set(r.id, r));
    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  };

  const fetchRequests = async () => {
    const seq = ++fetchSeq.current;
    try {
      setLoading(true);
      setLoadError(null);
      let rows: AgentPaymentRequest[];
      if (isAgent) {
        rows = await loadAgentRows();
      } else if (isSubAgent) {
        rows = (await agentPaymentApi.myRequests()).data || [];
      } else {
        rows = (await agentPaymentApi.adminList({ page: 1, limit: 200 })).data.items || [];
      }
      if (seq !== fetchSeq.current) return;
      setRequests(rows);
    } catch (error: any) {
      if (seq !== fetchSeq.current) return;
      console.error("Failed to fetch payout requests:", error);
      // A failed load must not look like an empty queue — that is how a broken
      // request reads as "there are no payout requests".
      setRequests([]);
      setLoadError(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to load payout requests",
      );
      toast.error("Failed to fetch requests");
    } finally {
      setLoading(false);
    }
  };

  // Live list: the backend emits `agent-payment:updated` after every committed
  // state change (create / agent approve-reject / admin release / complete), to
  // the requester's room, the parent agent's room, and every admin. Refetching
  // on that event keeps this table current without a manual refresh.
  //
  // A silent refetch (no spinner) so an incoming event doesn't blank the table
  // the user is reading.
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    const onUpdated = () => {
      if (!rolesReady) return;
      void (async () => {
        try {
          if (isAdmin) {
            const res = await agentPaymentApi.adminList({ page: 1, limit: 200 });
            setRequests(res.data.items || []);
          } else if (isAgent) {
            setRequests(await loadAgentRows());
          } else if (isSubAgent) {
            const res = await agentPaymentApi.myRequests();
            setRequests(res.data || []);
          }
        } catch {
          /* transient — the next event or a manual refresh recovers */
        }
      })();
    };

    socket.on("agent-payment:updated", onUpdated);
    return () => {
      socket.off("agent-payment:updated", onUpdated);
    };
  }, [rolesReady, isAdmin, isAgent, isSubAgent]);

  const filteredData = useMemo(() => {
    let result = requests;
    if (isAdmin && tab !== "ALL") {
      result = result.filter((r) => r.requesterType === tab);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.id.toLowerCase().includes(q) ||
          r.requester?.username?.toLowerCase().includes(q) ||
          r.requester?.email?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [search, requests, tab, isAdmin]);

  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredData.slice(start, start + PAGE_SIZE);
  }, [filteredData, currentPage]);

  const pendingCount = useMemo(() => {
    if (isAdmin) {
      return requests.filter((r) => r.status === AgentPaymentStatus.PENDING_ADMIN).length;
    }
    return requests.filter((r) => r.status === AgentPaymentStatus.PENDING_AGENT).length;
  }, [requests, isAdmin]);

  const handleAction = async (
    row: AgentPaymentRequest,
    action: "APPROVE" | "REJECT" | "COMPLETE",
  ) => {
    try {
      setActioning(true);
      if (isAdmin) {
        if (action === "APPROVE") await agentPaymentApi.adminApprove(row.id);
        else if (action === "REJECT")
          await agentPaymentApi.adminReject(row.id, "Admin rejection");
        else await agentPaymentApi.adminComplete(row.id);
      } else if (isAgent) {
        if (action === "APPROVE") await agentPaymentApi.agentApprove(row.id);
        else if (action === "REJECT")
          await agentPaymentApi.agentReject(row.id, "Agent rejection");
      }
      toast.success(`Request ${action.toLowerCase()}ed`);
      await fetchRequests();
      setDetailOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Action failed");
    } finally {
      setActioning(false);
    }
  };

  const canApprove = (row: AgentPaymentRequest) => {
    // The parent agent must not wave through a sub-agent request whose payment
    // step is unfinished — approving one is how a claim with no destination
    // reached the admin queue. The endpoint refuses it too.
    if (isAgent)
      return (
        row.status === AgentPaymentStatus.PENDING_AGENT &&
        row.payoutReady !== false
      );
    // Admin sign-off on a request the parent agent already approved
    // (PENDING_ADMIN -> ADMIN_APPROVED). It moves no money — Release still
    // sends it — but without it a request that has cleared its agent leaves the
    // admin nothing to do but Reject, which is what "no approve button" meant.
    // ...and never before the payee finished the payment step. `payoutReady` is
    // the server's verdict (confirmed destination, payout not failed) — the same
    // one adminApprove enforces. Only admin list responses carry it, so a
    // missing flag on an agent's own view is not treated as "not ready".
    if (isAdmin)
      return (
        row.status === AgentPaymentStatus.PENDING_ADMIN &&
        row.payoutReady !== false
      );
    return false;
  };

  // "Mark Completed" settled the frozen funds WITHOUT calling the provider, so it
  // could close a request as paid while Breeze/Coinflow never sent the money —
  // agent debited, nothing received. Removed: Release (in the provider payout
  // panel) is the only way to complete an agent payout, and it completes the
  // request automatically once the provider confirms.
  const canComplete = (_row: AgentPaymentRequest) => false;

  const canReject = (row: AgentPaymentRequest) => {
    if (isAdmin)
      return (
        row.status === AgentPaymentStatus.PENDING_ADMIN ||
        row.status === AgentPaymentStatus.AGENT_APPROVED ||
        row.status === AgentPaymentStatus.ADMIN_APPROVED
      );
    if (isAgent) return row.status === AgentPaymentStatus.PENDING_AGENT;
    return false;
  };

  const renderPaymentDetails = (r: AgentPaymentRequest) => {
    if ((r.paymentDetails as any)?.provider === "BREEZE") return "Breeze payout";
    if (isCoinflow(r)) {
      const d = r.paymentDetails as any;
      const method = d.payoutMethod || "method pending";
      return `Coinflow · ${method}${d.last4 ? ` ••${d.last4}` : ""}`;
    }
    if (!r.paymentMethod || !r.paymentDetails) return "—";
    if (r.paymentMethod === AgentPaymentMethod.BANK) {
      const d = r.paymentDetails;
      return `${d.holderName || "?"} · ${d.accountNumber || "?"} · ${d.ifsc || "?"}`;
    }
    const d = r.paymentDetails;
    return `${d.coin || "?"}/${d.network || "?"} · ${d.address || "?"}`;
  };

  return (
    <div className={PAGE_SHELL}>
      <div className={PAGE_HEAD}>
        <h1 className={PAGE_TITLE}>
          Agent Management / Payout Requests
        </h1>
        <div className="shrink-0 whitespace-nowrap bg-orange-500/10 text-orange-500 px-2.5 py-1 rounded-full text-[11px] font-medium border border-orange-500/20">
          {pendingCount} Pending
        </div>
      </div>

      <div className="flex flex-col gap-4 md:gap-6 md:flex-1 md:min-h-0">
        {/* TABS (admin only) */}
        {isAdmin && (
          <div className="flex flex-wrap gap-2 shrink-0">
            {(["ALL", AgentPaymentRequesterType.AGENT, AgentPaymentRequesterType.SUBAGENT] as TabKey[]).map(
              (t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTab(t);
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all border ${
                    tab === t
                      ? "bg-[#B93DEB] border-[#B93DEB] text-white"
                      : "bg-[#191D24] border-gray-800 text-gray-400 hover:text-white"
                  }`}
                >
                  {t === "ALL" ? "All" : t === AgentPaymentRequesterType.AGENT ? "Agents" : "Sub-Agents"}
                </button>
              ),
            )}
          </div>
        )}

        {/* TOOLBAR */}
        <div className={TOOLBAR}>
          <div className={TOOLBAR_SEARCH}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-purple-500 transition-colors" />
            <Input
              placeholder="Search request ID, username, or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-[#242B35]! border-none text-white placeholder:text-gray-500 text-sm h-10 pl-10 focus:ring-1 focus:ring-purple-500/30 font-medium"
            />
          </div>
        </div>

        {/* TABLE */}
        <div className="flex flex-col md:flex-1 md:min-h-0 bg-[#191D24] rounded-xl border border-gray-800 overflow-x-auto agent-x-scroll">
          <div className="flex flex-col md:flex-1 md:min-h-0">
            <div className={`grid ${ROW_GRID} gap-3 sm:gap-4 px-4 sm:px-6 py-3 bg-[#242B35] border-b border-gray-800 shrink-0 min-w-[1150px] lg:min-w-0`}>
              <span className="text-xs font-normal text-gray-300">Request ID</span>
              <span className="text-xs font-normal text-gray-300">User</span>
              <span className="text-xs font-normal text-gray-300">Type</span>
              <span className="text-xs font-normal text-gray-300">Amount</span>
              <span className="text-xs font-normal text-gray-300">Payment Details</span>
              <span className="text-xs font-normal text-gray-300">Date</span>
              <span className="text-xs font-normal text-gray-300">Status</span>
              <span className="text-xs font-normal text-gray-300 text-center">Action</span>
            </div>

            <FeatureGate allowed={canWithdraw} showHeader={false}>
              <div className="md:flex-1 lg:overflow-y-auto scrollbar-hide min-w-[1150px] lg:min-w-0">
                <div className="divide-y divide-gray-800/30">
                  {loading ? (
                    <TableSkeleton rows={10} cols={8} />
                  ) : loadError ? (
                    <div className="py-20 text-center space-y-4">
                      <p className="text-sm text-red-400 font-medium">
                        {loadError}
                      </p>
                      <Button
                        onClick={fetchRequests}
                        className="bg-[#B93DEB] hover:bg-[#A030D0] text-white text-xs font-bold uppercase tracking-wider"
                      >
                        <RefreshCw size={14} className="mr-2" />
                        Retry
                      </Button>
                    </div>
                  ) : paginatedData.length === 0 ? (
                    <div className="py-20 text-center">
                      <NoData title="No requests found" />
                    </div>
                  ) : (
                    paginatedData.map((row, index) => (
                      <div
                        key={row.id}
                        className={`grid ${ROW_GRID} gap-3 sm:gap-4 px-4 sm:px-6 py-4 items-center hover:bg-[#1a2030] transition-colors border-b border-gray-800/30 ${
                          index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-300 text-xs font-mono uppercase truncate">
                            {row.id.slice(0, 8)}
                          </span>
                          <CopyButton value={row.id} />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-300 text-xs font-bold truncate">
                            {row.requester?.username || row.requester?.email || "Unknown"}
                          </span>
                          <CopyButton value={row.requester?.username || row.requester?.email || "Unknown"} />
                        </div>
                        <div>
                          <span
                            className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                              row.requesterType === AgentPaymentRequesterType.AGENT
                                ? "text-cyan-400 bg-cyan-500/10 border-cyan-500/20"
                                : "text-pink-400 bg-pink-500/10 border-pink-500/20"
                            }`}
                          >
                            {row.requesterType === AgentPaymentRequesterType.AGENT ? "Agent" : "Sub"}
                          </span>
                        </div>
                        <div className="text-orange-400 text-xs font-black font-mono">
                          {Number(row.amount).toFixed(2)}
                        </div>
                        <div className="text-gray-400 text-[10px] truncate font-medium flex items-center gap-1">
                          {isBreeze(row) ? (
                            <CreditCard size={11} className="text-[#B93DEB]" />
                          ) : isCoinflow(row) ? (
                            <Coins size={11} className="text-yellow-400" />
                          ) : (
                            <>
                              {row.paymentMethod === AgentPaymentMethod.BANK && <Banknote size={11} />}
                              {row.paymentMethod === AgentPaymentMethod.CRYPTO && <Bitcoin size={11} />}
                            </>
                          )}
                          <span className="truncate">{renderPaymentDetails(row)}</span>
                        </div>
                        <div className="text-gray-400 text-xs tabular-nums">
                          {new Date(row.createdAt).toLocaleDateString()}
                        </div>
                        <div>
                          {/* STATUS_LABEL is already sentence case ("Rejected by
                              Agent"); `uppercase` + `font-black` was shouting
                              over it and forcing the pill to wrap. */}
                          <span
                            className={`inline-block text-[11px] font-medium px-2 py-1 rounded whitespace-nowrap border ${
                              statusPill(row).color
                            }`}
                          >
                            {statusPill(row).label}
                          </span>
                        </div>
                        <div className="text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="text-gray-400 hover:text-white transition-colors bg-[#242B35] p-2 rounded-lg border border-gray-800 inline-flex items-center justify-center">
                                <Wrench size={16} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="bg-[#1a2030] text-white border border-gray-700 p-2 min-w-[180px] shadow-2xl"
                            >
                              <DropdownMenuLabel className="text-gray-500 text-[10px] uppercase font-black px-2 py-1.5">
                                Action Menu
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator className="bg-gray-700 my-1 mx-1" />
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedReq(row);
                                  setDetailOpen(true);
                                }}
                                className="text-xs hover:bg-white/5 cursor-pointer rounded-md py-2"
                              >
                                <Eye className="mr-2 h-4 w-4 text-blue-400" /> View Details
                              </DropdownMenuItem>
                              {canApprove(row) && (
                                <DropdownMenuItem
                                  onClick={() => handleAction(row, "APPROVE")}
                                  className="text-xs hover:bg-green-500/10 text-green-400 cursor-pointer rounded-md py-2 font-bold"
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" /> Approve
                                </DropdownMenuItem>
                              )}
                              {/* Say why Approve is missing — an unfinished or
                                  failed payment step, not a broken menu. */}
                              {((isAdmin &&
                                row.status ===
                                  AgentPaymentStatus.PENDING_ADMIN) ||
                                (isAgent &&
                                  row.status ===
                                    AgentPaymentStatus.PENDING_AGENT)) &&
                                row.payoutReady === false && (
                                  <DropdownMenuItem
                                    disabled
                                    title={row.payoutBlockReason ?? undefined}
                                    className="text-xs text-gray-500 rounded-md py-2 italic cursor-not-allowed"
                                  >
                                    <Clock className="mr-2 h-4 w-4" /> Payment not
                                    completed
                                  </DropdownMenuItem>
                                )}
                              {canComplete(row) && (
                                <DropdownMenuItem
                                  onClick={() => handleAction(row, "COMPLETE")}
                                  className="text-xs hover:bg-blue-500/10 text-blue-400 cursor-pointer rounded-md py-2 font-black"
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" /> Mark Completed
                                </DropdownMenuItem>
                              )}
                              {canReject(row) && (
                                <DropdownMenuItem
                                  onClick={() => handleAction(row, "REJECT")}
                                  className="text-xs hover:bg-red-500/10 text-red-400 cursor-pointer rounded-md py-2 font-bold"
                                >
                                  <XCircle className="mr-2 h-4 w-4" /> Reject Request
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              {totalPages > 1 && (
                <div className="sticky left-0 p-4 bg-black/10 border-t border-gray-800 agent-safe-bottom">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </FeatureGate>
          </div>
        </div>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-[#191D24] text-white border-gray-800 w-[calc(100vw-1.5rem)] max-w-md p-0 overflow-hidden rounded-xl shadow-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-gray-800">
            <DialogTitle className="text-base sm:text-lg font-semibold text-white">
              Payout Review Panel
            </DialogTitle>
          </DialogHeader>
          {selectedReq && (
            <div className="p-4 sm:p-6 space-y-4">
              {/* Status sits ABOVE the id on phones. Inline, a long label like
                  "Rejected by Agent" broke onto three lines beside the UUID —
                  it needs its own row before it has room to stay on one. */}
              <div className="flex flex-col-reverse items-start gap-2 sm:flex-row sm:justify-between sm:items-start">
                <div className="space-y-1 min-w-0 w-full sm:w-auto">
                  <p className="text-[11px] text-gray-500">Request ID</p>
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-xs font-mono text-purple-400 truncate">
                      {selectedReq.id}
                    </p>
                    <CopyButton value={selectedReq.id} size={14} />
                  </div>
                </div>
                <span
                  className={`shrink-0 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded border ${
                    STATUS_COLORS[selectedReq.status] || ""
                  }`}
                >
                  {STATUS_LABEL[selectedReq.status] || selectedReq.status}
                </span>
              </div>
              <div className="h-px bg-gray-800" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 min-w-0">
                  <p className="text-[11px] text-gray-500">Requester</p>
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {selectedReq.requester?.username || "Unknown"}
                    </p>
                    <CopyButton value={selectedReq.requester?.username || "Unknown"} size={14} />
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-[11px] text-gray-500 truncate">
                      {selectedReq.requester?.email}
                    </p>
                    <CopyButton value={selectedReq.requester?.email || ""} size={14} />
                  </div>
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="text-[11px] text-gray-500">Type</p>
                  <p className="text-sm font-semibold text-white">
                    {selectedReq.requesterType}
                  </p>
                </div>
              </div>
              <div className="bg-orange-500/5 p-4 rounded-lg border border-orange-500/10 flex flex-col items-center gap-1">
                <span className="text-[11px] text-orange-200/60 uppercase tracking-wide">
                  Amount
                </span>
                <span className="text-2xl font-semibold tabular-nums text-orange-400">
                  {Number(selectedReq.amount).toFixed(2)}
                </span>
              </div>
              {isBreeze(selectedReq) ? (
                <div className="pt-2">
                  <p className="text-[11px] text-[#B93DEB] uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <CreditCard size={11} /> Breeze Payout
                  </p>
                  {breezeLoading ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500 bg-black/30 p-3 rounded border border-gray-800">
                      <Loader2 size={12} className="animate-spin" /> Loading Breeze payout…
                    </div>
                  ) : breezePage ? (
                    <div className="text-[11px] text-gray-300 bg-black/30 p-3 rounded border border-gray-800 space-y-1.5">
                      <Row label="Page Status" value={breezePage.status} />
                      <Row label="Release" value={breezePage.releaseMethod} />
                      <Row
                        label="Payout Method"
                        value={breezePage.payoutMethod || "Not selected yet"}
                      />
                      {breezePage.bankAccountLast4 && (
                        <Row label="Bank ····" value={breezePage.bankAccountLast4} />
                      )}
                      {breezePage.cardLast4 && (
                        <Row label="Card ····" value={breezePage.cardLast4} />
                      )}
                      {breezePage.walletAddress && (
                        <Row label="Wallet" value={breezePage.walletAddress} />
                      )}
                      <Row
                        label="Customer Confirmed"
                        value={breezePage.customerConfirmedAtMs ? "Yes" : "No"}
                      />
                      <Row
                        label="Released"
                        value={breezePage.releasedAt ? "Yes" : "No"}
                      />
                      {breezePage.url && (
                        <a
                          href={breezePage.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#B93DEB] hover:underline pt-1"
                        >
                          <ExternalLink size={11} /> Open hosted page
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 bg-black/30 p-3 rounded border border-gray-800">
                      No Breeze payout page found for this request.
                    </div>
                  )}
                </div>
              ) : isCoinflow(selectedReq) ? (
                <div className="pt-2">
                  <p className="text-[11px] text-yellow-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <Coins size={11} /> Coinflow Payout
                  </p>
                  {coinflowLoading ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500 bg-black/30 p-3 rounded border border-gray-800">
                      <Loader2 size={12} className="animate-spin" /> Loading Coinflow payout…
                    </div>
                  ) : coinflowPayout ? (
                    <div className="text-[11px] text-gray-300 bg-black/30 p-3 rounded border border-gray-800 space-y-1.5">
                      <Row label="Payout Status" value={coinflowPayout.status} />
                      <Row label="Release" value={coinflowPayout.releaseMethod} />
                      <Row
                        label="Payout Method"
                        value={coinflowPayout.payoutMethod || "Not linked yet"}
                      />
                      {coinflowPayout.last4 && (
                        <Row label="Account ····" value={coinflowPayout.last4} />
                      )}
                      {coinflowPayout.walletAddress && (
                        <Row label="Wallet" value={coinflowPayout.walletAddress} />
                      )}
                      <Row
                        label="Recipient Confirmed"
                        value={coinflowPayout.customerConfirmedAtMs ? "Yes" : "No"}
                      />
                      <Row
                        label="Released"
                        value={coinflowPayout.releasedAt ? "Yes" : "No"}
                      />
                      {coinflowPayout.coinflowSessionId && (
                        <Row label="Withdrawal ID" value={coinflowPayout.coinflowSessionId} />
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 bg-black/30 p-3 rounded border border-gray-800">
                      Recipient hasn&apos;t linked a Coinflow payout method yet.
                    </div>
                  )}
                </div>
              ) : (
                selectedReq.paymentMethod && (
                  <div className="pt-2">
                    <p className="text-[11px] text-gray-500 mb-1.5">
                      Payment Details ({selectedReq.paymentMethod})
                    </p>
                    <pre className="text-[11px] text-gray-300 leading-relaxed bg-black/30 p-2 rounded border border-gray-800 whitespace-pre-wrap break-all">
                      {JSON.stringify(selectedReq.paymentDetails ?? {}, null, 2)}
                    </pre>
                  </div>
                )
              )}
              {selectedReq.note && (
                <div className="pt-2">
                  <p className="text-[11px] text-gray-500 mb-1.5">Note</p>
                  <p className="text-xs text-gray-400 bg-black/20 p-2 rounded border border-gray-800">
                    {selectedReq.note}
                  </p>
                </div>
              )}
              {selectedReq.rejectionReason && (
                <div className="pt-2">
                  <p className="text-[11px] text-red-400 mb-1.5">
                    Rejection Reason
                  </p>
                  <p className="text-xs text-red-300 bg-red-500/5 p-2 rounded border border-red-500/20">
                    {selectedReq.rejectionReason}
                  </p>
                </div>
              )}

              {/* Why Release is missing. Without this the panel just silently
                  lacks the button, which reads as a broken screen rather than
                  "the payee never finished their payout form". */}
              {isAdmin &&
                ((isBreeze(selectedReq) && breezePage && !breezeReleaseReady) ||
                  (isCoinflow(selectedReq) &&
                    coinflowPayout &&
                    !coinflowReleaseReady)) && (
                  <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-3 flex items-start gap-2">
                    <AlertTriangle
                      size={14}
                      className="text-orange-400 mt-0.5 shrink-0"
                    />
                    <p className="text-[11px] text-orange-300/90">
                      No payout destination confirmed yet — the recipient opened
                      the payout page but never finished it. Refresh the status,
                      or reject the request so the funds return to their
                      withdrawable balance.
                    </p>
                  </div>
                )}

              {isAdmin && isBreeze(selectedReq) && breezePage && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {breezePage.releaseMethod === "MANUAL" &&
                    breezeReleaseReady &&
                    !breezePage.releasedAt &&
                    breezePage.status !== "PROCESSED" &&
                    breezePage.status !== "COMPLETED" && (
                      <Button
                        onClick={() => handleBreezeAction("RELEASE")}
                        disabled={breezeActioning}
                        className="bg-[#B93DEB] hover:bg-[#A32DD4] text-white rounded-xl h-11 text-xs font-semibold shadow-lg shadow-purple-500/10"
                      >
                        {breezeActioning ? (
                          <Loader2 size={14} className="mr-2 animate-spin" />
                        ) : (
                          <Send size={14} className="mr-2" />
                        )}
                        Release Breeze Payout
                      </Button>
                    )}
                  <Button
                    onClick={() => handleBreezeAction("REFRESH")}
                    disabled={breezeActioning}
                    className="bg-[#242B35] hover:bg-[#2d3540] text-gray-300 rounded-xl h-11 text-xs font-semibold border border-gray-800"
                  >
                    <RefreshCw size={14} className="mr-2" /> Refresh Status
                  </Button>
                </div>
              )}

              {isAdmin && isCoinflow(selectedReq) && coinflowPayout && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {coinflowPayout.releaseMethod === "MANUAL" &&
                    coinflowReleaseReady &&
                    !coinflowPayout.releasedAt &&
                    coinflowPayout.status !== "PROCESSED" &&
                    coinflowPayout.status !== "COMPLETED" && (
                      <Button
                        onClick={() => handleCoinflowAction("RELEASE")}
                        disabled={coinflowActioning}
                        className="bg-yellow-500 hover:bg-yellow-600 text-black rounded-xl h-11 text-xs font-semibold shadow-lg shadow-yellow-500/10 disabled:opacity-50"
                      >
                        {coinflowActioning ? (
                          <Loader2 size={14} className="mr-2 animate-spin" />
                        ) : (
                          <Send size={14} className="mr-2" />
                        )}
                        Release Coinflow Payout
                      </Button>
                    )}
                  <Button
                    onClick={() => handleCoinflowAction("REFRESH")}
                    disabled={coinflowActioning}
                    className="bg-[#242B35] hover:bg-[#2d3540] text-gray-300 rounded-xl h-11 text-xs font-semibold border border-gray-800"
                  >
                    <RefreshCw size={14} className="mr-2" /> Refresh Status
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {canReject(selectedReq) && (
                  <Button
                    onClick={() => handleAction(selectedReq, "REJECT")}
                    disabled={actioning}
                    variant="destructive"
                    className="rounded-xl h-11 text-xs font-semibold shadow-lg shadow-red-500/10"
                  >
                    <XCircle size={14} className="mr-2" /> Reject
                  </Button>
                )}
                {canApprove(selectedReq) && (
                  <Button
                    onClick={() => handleAction(selectedReq, "APPROVE")}
                    disabled={actioning}
                    className="bg-green-600 hover:bg-green-700 text-white rounded-xl h-11 text-xs font-semibold shadow-lg shadow-green-500/10"
                  >
                    <CheckCircle size={14} className="mr-2" /> Approve
                  </Button>
                )}
                {canComplete(selectedReq) && (
                  <Button
                    onClick={() => handleAction(selectedReq, "COMPLETE")}
                    disabled={actioning}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 text-xs font-semibold shadow-lg shadow-blue-500/10 sm:col-span-2"
                  >
                    <CheckCircle size={14} className="mr-2" /> Mark Completed
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500 text-[11px] shrink-0">{label}</span>
      <span className="text-gray-200 text-[11px] text-right break-all">
        {value}
      </span>
    </div>
  );
}
