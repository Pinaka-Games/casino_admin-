"use client";
import React, { useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Wrench, Pencil, ShieldCheck, ChevronDown, History, Wallet, Percent, Loader2, CheckCircle, XCircle, Eye, Clock, ChevronsUpDown, ChevronUp, Trash2, ArrowRight, Filter } from "lucide-react";
import Link from "next/link";
import { connectSocket } from "@/lib/socket";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import ExportCSV from "@/components/ExportCSV";
import Pagination from "@/components/Pagination";
import NoData from "@/components/NoData";
import { Skeleton } from "@/components/ui/skeleton";
import EditAgentModal from "../components/agent-list/EditAgentModal";
import AgentActivityModal from "../components/agent-list/AgentActivityModal";
import AgentDownlineModal from "../components/agent-list/AgentDownlineModal";
import AgentTransactionModal from "../components/agent-list/AgentTransactionModal";
import AgentCommissionModal from "../components/agent-list/AgentCommissionModal";
import AgentFilterSheet from "./components/AgentFilterSheet";
import ReferralSettingsModal from "../components/ReferralSettingsModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useRouter } from "next/navigation";
import AgentPermissionModal from "../components/agent-list/AgentPermissionModal";
import toast from "react-hot-toast";

import { useAgentStore } from "@/store/agent-store";
import { useClearSearchOnLeave } from "@/hooks/use-clear-search-on-leave";
import { usePresence, resolvePresence } from "@/hooks/use-presence";
import OnlineStatus, { formatOnlineStatus } from "@/components/OnlineStatus";
import ListSearch from "@/components/TableSearch/ListSearch";
import CopyButton from "@/components/CopyButton";
import { profileApi } from "@/api/users/users";
import { usePayoutRequestStore, PayoutTabStatus } from "@/store/payout-request-store";
import { BreezePayoutInfo } from "./BreezePayoutInfo";
import { CoinflowPayoutInfo } from "./CoinflowPayoutInfo";

/* ============================
   PAYOUT ACTION GATING
   Agent-payment requests follow the real status machine (rawStatus); legacy
   commission claims keep their original behavior.
============================ */
const isAgentPay = (r: any) => r?._source === "AGENT_PAYMENT";
const apRaw = (r: any): string => r?.rawStatus || "";
const providerOf = (r: any): string | undefined => r?.paymentDetails?.provider;
const isProviderReq = (r: any) =>
  providerOf(r) === "BREEZE" || providerOf(r) === "COINFLOW";

// Concrete payout destination exists: bank/crypto fields, or a provider payout
// the payee actually CONFIRMED and that hasn't failed. The server decides this
// (AgentPaymentService.getPayoutReadiness) and ships the verdict on every admin
// row, because the client can't see provider state: an agent request carries
// paymentDetails = { provider } from the moment it is raised — before the
// Breeze/Coinflow page is finished — and keeps them after the payout FAILS, so
// an id on the request never meant there was somewhere to send money.
const hasPayoutDestination = (r: any): boolean => {
  if (!isAgentPay(r)) return true; // legacy commission claims have no details step
  if (typeof r?.payoutReady === "boolean") return r.payoutReady;
  // Pre-flag API response: fall back to the old id heuristic rather than
  // hiding every action.
  const d = r?.paymentDetails;
  if (!d) return false;
  if (d.provider === "BREEZE") return Boolean(d.agentBreezePageId);
  if (d.provider === "COINFLOW") return Boolean(d.coinflowPayoutId);
  return Boolean(d.accountNumber || d.address);
};
// Admin "Approve" = sign off on a request that already cleared its parent agent
// and has payout details (PENDING_ADMIN -> ADMIN_APPROVED). It moves no money —
// Release (provider panel) still sends it — but it is the admin's record that
// the request was reviewed, and without it a sub-agent request the agent already
// approved offered the admin nothing but Reject. Never offered while the
// payment step is unfinished: approving a request with no destination only
// queues a payout that can't be sent.
const showApprove = (r: any) =>
  isAgentPay(r)
    ? apRaw(r) === "PENDING_ADMIN" && hasPayoutDestination(r)
    : !(r?.status === "APPROVED" || r?.status === "PROCESSING");
// "Complete & Settle" books a request as paid — it consumes the agent's frozen
// funds and marks COMPLETED WITHOUT calling the provider. Sitting next to
// "Release Payout" that made it trivial to close a request while Breeze/Coinflow
// never sent the money, leaving the agent debited and unpaid. Removed for agent
// payouts: Release is the only way to complete one. Legacy commission claims
// (no provider page) still use it.
const showComplete = (r: any) =>
  isAgentPay(r)
    ? false
    : r?.status === "APPROVED" || r?.status === "PROCESSING";
// Admin can reject any pre-completion stage (incl. AGENT_APPROVED, so a stuck
// request can be returned and the sub-agent can request again).
const showReject = (r: any) =>
  isAgentPay(r)
    ? ["AGENT_APPROVED", "PENDING_ADMIN", "ADMIN_APPROVED"].includes(apRaw(r))
    : true;
// Provider release panel shows once details exist (PENDING_ADMIN / ADMIN_APPROVED).
const showReleasePanel = (r: any) =>
  isAgentPay(r) &&
  isProviderReq(r) &&
  ["PENDING_ADMIN", "ADMIN_APPROVED"].includes(apRaw(r));

// Human-readable status. The store collapses statuses to a coarse bucket for tab
// filtering, but the badge should disambiguate WHO a request is pending on —
// e.g. a sub-agent request awaiting its parent reads "Pending from Agent", not a
// bare "Pending". Falls back to the coarse status for legacy commission claims.
const AGENT_PAY_STATUS_LABELS: Record<string, string> = {
  PENDING_AGENT: "Pending from Agent",
  AGENT_APPROVED: "Awaiting Details",
  PENDING_ADMIN: "Pending from Admin",
  ADMIN_APPROVED: "Approved",
  COMPLETED: "Completed",
  REJECTED_BY_AGENT: "Rejected by Agent",
  REJECTED_BY_ADMIN: "Rejected by Admin",
};
const displayStatusLabel = (r: any): string => {
  // A direct agent's request is raised straight into PENDING_ADMIN, before its
  // payout destination is added. Until then the ball is in the agent's court
  // (their dashboard shows "Add Payment Details"), so don't call it pending
  // on the admin — the admin can't approve it yet anyway.
  if (isAgentPay(r) && apRaw(r) === "PENDING_ADMIN" && !hasPayoutDestination(r)) {
    return "Awaiting Details from Agent";
  }
  // REJECTED_BY_AGENT also records closes nobody decided: the requester's own
  // cancel, a superseded claim, a claim whose form was never finished, a page
  // that failed to open. Labelling those "Rejected by Agent" blamed an agent
  // who never saw the request.
  if (isAgentPay(r) && apRaw(r) === "REJECTED_BY_AGENT") {
    const reason = String(r?.rejectionReason ?? "").toLowerCase();
    if (reason.startsWith("cancelled by the requester")) return "Cancelled";
    if (reason.startsWith("superseded")) return "Replaced";
    if (reason.startsWith("duplicate request")) return "Duplicate — Refunded";
    if (reason.startsWith("payout form was not completed")) return "Not Completed";
    if (reason.includes("could not be opened") || reason.startsWith("payout too small")) return "Failed";
  }
  if (isAgentPay(r) && AGENT_PAY_STATUS_LABELS[apRaw(r)]) {
    return AGENT_PAY_STATUS_LABELS[apRaw(r)];
  }
  return String(r?.status || "").replace(/_/g, " ");
};


/* ============================
   CONSTANTS
============================ */
const PAGE_SIZE = 10;

export default function UserAgentListing() {
  const router = useRouter();
  const {
    agents: rows,
    isLoading: loading,
    totalPages,
    currentPage,
    searchQuery,
    fetchAgents,
    setPage: changePage,
    updateAgent: updateUser,
    setSearch: handleSearch,
    filters,
    setFilters,
  } = useAgentStore();

  // Search text lives in a module-level store, so it survives navigation —
  // clear it on the way out or the next visit opens pre-filtered.
  useClearSearchOnLeave(() =>
    useAgentStore.setState({ searchQuery: "", currentPage: 1 }),
  );

  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [referralSort, setReferralSort] = useState<'asc' | 'desc' | null>(null);
  const [ggrSort, setGgrSort] = useState<'asc' | 'desc' | null>(null);

  // Online Status updates live — an agent signing in or closing their last tab
  // flips the column without a refresh. `row.id` IS the employee id here (see
  // the agent listing mapper in the API), which is what presence is keyed on.
  const presence = usePresence(() => fetchAgents());
  const rowPresence = (row: any) => resolvePresence(presence, row?.id, row);

  /* ============================
     FETCH DATA
  ============================ */
  React.useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleGgrSort = () => {
    const next = ggrSort === 'desc' ? 'asc' : 'desc';
    setGgrSort(next);
    setReferralSort(null);
    fetchAgents({ page: 1, sortField: 'ggr', sortOrder: next });
  };

  const handleReferralSort = () => {
    const next = referralSort === 'desc' ? 'asc' : 'desc';
    setReferralSort(next);
    setGgrSort(null);
    fetchAgents({ page: 1, sortField: 'referralsCount', sortOrder: next });
  };

  /* ============================
     EDIT MODAL STATE
  ============================ */
  const [openEditModal, setOpenEditModal] = useState(false);
  const [editAgent, setEditAgent] = useState<any | null>(null);
  const [openActivity, setOpenActivity] = useState(false);
  const [activityUser, setActivityUser] = useState("");
  const [openDownline, setOpenDownline] = useState(false);
  const [openRollover, setOpenRollover] = useState(false);
  const [openTransaction, setOpenTransaction] = useState(false);

  const [openPermission, setOpenPermission] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [openCommission, setOpenCommission] = useState(false);
  const [commissionAgent, setCommissionAgent] = useState<{
    id: string;
    username: string;
  } | null>(null);
  const [openReferralSettings, setOpenReferralSettings] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    const agent = deleteTarget;
    if (!agent) return;
    try {
      setIsDeleting(true);
      await profileApi.deleteUserProfile(agent.id);
      toast.success("Agent deleted");
      setDeleteTarget(null);
      fetchAgents();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to delete agent");
    } finally {
      setIsDeleting(false);
    }
  };

  const {
    requests: payoutRequests,
    isLoading: payoutLoading,
    activeTab: payoutActiveTab,
    searchQuery: payoutSearch,
    openPayoutRequests,
    selectedPayoutReq,
    payoutDetailOpen,
    fetchRequests: fetchPayoutRequests,
    setActiveTab: setPayoutActiveTab,
    setSearchQuery: setPayoutSearch,
    setOpenPayoutRequests,
    setSelectedPayoutReq,
    setPayoutDetailOpen,
    handlePayoutAction,
  } = usePayoutRequestStore();

  const [payoutPage, setPayoutPage] = useState(1);
  const paginatedRows = rows;

  const filteredPayoutRequests = useMemo(() => {
    return payoutRequests
      .filter((request) => request.claimType === "AGENT")
      .filter((request) => {
        if (payoutActiveTab === "ALL") return true;
        if (payoutActiveTab === "PENDING") {
          return ["PENDING", "REQUESTED", "PENDING_APPROVAL"].includes(request.status);
        }
        return request.status === payoutActiveTab;
      })
      .filter((request) => {
        if (!payoutSearch) return true;
        const query = payoutSearch.toLowerCase();
        return (
          request.id?.toLowerCase().includes(query) ||
          request.subAgent?.username?.toLowerCase().includes(query) ||
          request.referrerUsername?.toLowerCase().includes(query) ||
          request.username?.toLowerCase().includes(query)
        );
      });
  }, [payoutRequests, payoutSearch, payoutActiveTab]);

  const payoutTotalPages = Math.ceil(filteredPayoutRequests.length / PAGE_SIZE);

  const paginatedPayoutRequests = useMemo(() => {
    const start = (payoutPage - 1) * PAGE_SIZE;
    return filteredPayoutRequests.slice(start, start + PAGE_SIZE);
  }, [filteredPayoutRequests, payoutPage]);

  React.useEffect(() => {
    if (openPayoutRequests) {
      fetchPayoutRequests();
    }
  }, [openPayoutRequests, fetchPayoutRequests]);

  // Live list while the modal is open. The backend emits
  // `agent-payment:updated` after every committed change (create, details
  // added, auto-release, complete, reject). Without this the modal kept the
  // snapshot taken when it opened — a Breeze payout that auto-released and
  // completed still read "Pending from Admin" here while the agent's own
  // ledger already showed it Completed.
  React.useEffect(() => {
    if (!openPayoutRequests) return;
    const socket = connectSocket();
    if (!socket) return;
    const onUpdated = () => {
      void fetchPayoutRequests({ silent: true });
    };
    socket.on("agent-payment:updated", onUpdated);
    return () => {
      socket.off("agent-payment:updated", onUpdated);
    };
  }, [openPayoutRequests, fetchPayoutRequests]);

  const handleAccountStatusToggle = async (
    userId: string,
    nextIsActive: boolean,
  ) => {
    setUpdatingStatusId(userId);

    try {
      await updateUser(userId, { isActive: nextIsActive });
      toast.success(
        nextIsActive
          ? "Agent account activated successfully"
          : "Agent account deactivated. The user has been logged out.",
      );
      await fetchAgents({
        page: currentPage,
        limit: PAGE_SIZE,
        search: searchQuery,
      });
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to update account status",
      );
    } finally {
      setUpdatingStatusId(null);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#15181E] p-3 md:p-6 overflow-hidden relative">
      {/* HEADER */}
      <div className="bg-[#191D24] px-3 py-3 rounded-lg flex flex-col items-stretch gap-2 md:flex-row md:items-center md:justify-between md:gap-4 md:px-4">
        <h1 className="text-white text-base font-normal ">
          User / Agent Listing
        </h1>
        {/* Creating an agent is what an admin reaches for while looking at this
            list — the sidebar row stays too. */}
        <Link href="/users/register-agent" className="shrink-0">
          <Button
            variant="outline"
            className="h-9 w-full border-gray-700 bg-[#242B35] text-white hover:bg-[#2c3441] hover:text-white md:w-auto"
          >
            Register Agent
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="bg-[#191D24] rounded-lg p-2 mb-3 mt-3! flex items-center gap-2 shrink-0 md:mb-4 md:mt-4!">
        {/* On a phone the search takes its own row and the buttons become one
            sideways-scrolling strip; `md:contents` dissolves that strip so the
            desktop row is laid out exactly as before. */}
        <div className="flex-1 flex flex-wrap items-center gap-2 md:flex-nowrap">
          <ListSearch
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Search by username / email"
            showButton={false}
          />
          <div className="flex w-full items-center gap-2 overflow-x-auto scrollbar-hide md:contents">
          <Button
            variant="outline"
            className="gap-2 bg-[#1A2030] border-white/10 rounded-lg h-9 text-white hover:bg-[#252b3d] hover:text-white flex items-center justify-center shrink-0"
            onClick={() => setFilterOpen(true)}
          >
            <Filter size={18} className="text-[#B93DEB]" />
            Filters
          </Button>

          <Button
            variant="outline"
            className="bg-[#1A2030] border-white/10 rounded-lg h-9 text-white hover:bg-[#252b3d] px-4"
            onClick={() => setOpenReferralSettings(true)}
          >
            Affiliate Manage
          </Button>

          <Button
            variant="outline"
            className="bg-[#1A2030] border-white/10 rounded-lg h-9 text-white hover:bg-[#252b3d] px-4"
            onClick={() => setOpenPayoutRequests(true)}
          >
            Payout Requests
          </Button>

          <ExportCSV
            data={rows}
            fileName="agent_users.csv"
            getRowDate={(row: any) => row.createdAt}
            fetchAll={async (range) => {
              // Server-paginated list: pull every matching page so export is
              // not limited to the current page. Replicates the store's active
              // filters (search + status + GGR sort); popover range narrows by
              // date on top.
              const isActive =
                filters.status === "active"
                  ? true
                  : filters.status === "inactive"
                    ? false
                    : undefined;
              const EXPORT_LIMIT = 500;
              const all: typeof rows = [];
              let page = 1;
              // Safety valve: cap at 100 pages.
              for (let i = 0; i < 100; i++) {
                const res = await profileApi.getAllAgents({
                  page,
                  limit: EXPORT_LIMIT,
                  search: searchQuery,
                  isActive,
                  ...(ggrSort ? { sortField: "ggr", sortOrder: ggrSort } : {}),
                  ...(range.from ? { startDate: range.from.toISOString() } : {}),
                  ...(range.to ? { endDate: range.to.toISOString() } : {}),
                });
                all.push(...res.data.data);
                const total =
                  res.data.meta?.totalItems ?? res.data.meta?.total ?? 0;
                if (all.length >= total || res.data.data.length === 0) break;
                page += 1;
              }
              return all;
            }}
            headers={[
              "Username",
              "Email",
              "Referral Code",
              "Total Referrals",
              "GGR",
              "Sub Agents",
              "Account Status",
              "Online Status",
              "Created",
            ]}
            mapRow={(row: any) => [
              row.username || "-",
              row.email || row.entity || "-",
              row.agent?.referralCode || row.referralCode || "-",
              row.referralsCount ?? 0,
              Number(row.ggr ?? 0).toFixed(2),
              row.subAgentsCount ?? 0,
              row.isActive ? "Active" : "Inactive",
              formatOnlineStatus(rowPresence(row)),
              new Date(row.createdAt).toLocaleDateString(),
            ]}
          />
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="flex-1 flex flex-col rounded-lg bg-[#15181E] overflow-hidden">
        <div className="flex-1 overflow-x-auto overflow-y-auto scrollbar-hide">
        <table className="w-full min-w-[1080px] table-fixed">
          <thead className="bg-[#242B35] sticky top-0 z-10">
            <tr className="border-b border-gray-800">
              <th className="whitespace-nowrap px-4 py-3 text-left text-white text-xs">
                Username
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-white text-xs">Email</th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-white text-xs">
                Referral Code
              </th>

              <th className="whitespace-nowrap px-4 py-3 text-left text-white text-xs">
                <button
                  onClick={handleReferralSort}
                  className="flex items-center gap-1 hover:text-[#B93DEB] transition-colors"
                >
                  Total Referrals
                  {referralSort === null && <ChevronsUpDown size={12} className="text-gray-400" />}
                  {referralSort === 'desc' && <ChevronDown size={12} className="text-[#B93DEB]" />}
                  {referralSort === 'asc' && <ChevronUp size={12} className="text-[#B93DEB]" />}
                </button>
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-white text-xs">
                <button
                  onClick={handleGgrSort}
                  className="flex items-center gap-1 hover:text-[#B93DEB] transition-colors"
                >
                  GGR
                  {ggrSort === null && <ChevronsUpDown size={12} className="text-gray-400" />}
                  {ggrSort === 'desc' && <ChevronDown size={12} className="text-[#B93DEB]" />}
                  {ggrSort === 'asc' && <ChevronUp size={12} className="text-[#B93DEB]" />}
                </button>
              </th>
              <th className="px-4 py-3 text-center text-white text-xs">
                Sub Agents
              </th>
              <th className="px-4 py-3 text-center text-white text-xs">
                Account Status
              </th>
              <th className="px-4 py-3 text-center text-white text-xs">
                Online Status
              </th>

              <th className="whitespace-nowrap px-4 py-3 text-left text-white text-xs">
                Date
              </th>
              <th className="px-4 py-3 text-center text-white text-xs">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="py-16 text-center text-gray-400">
                  <Loader2 className="animate-spin w-10 h-10 mx-auto text-purple-500 " />
                </td>
              </tr>
            ) : paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-16">
                  <NoData title="No agents found" />
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, index) => (
                <tr
                  onClick={() => router.push(`/users/agent-listing/${row.id}`)}
                  key={row.id}
                  className={`hover:bg-[#1a2030] cursor-pointer ${
                    index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                  }`}
                >
                  <td className="px-4 py-3 text-gray-300 text-xs truncate">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate">{row?.username || "-"}</span>
                        <CopyButton value={row?.username} />
                      </div>
                      {(row as any).commissionMode === "FLAT" ? (
                        <span className="w-fit px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 text-[9px] font-black tracking-wider border border-purple-500/30">
                          FLAT {Number((row as any).flatCommissionRate || 0)}%
                        </span>
                      ) : (
                        <span className="w-fit px-1.5 py-0.5 rounded bg-white/5 text-gray-500 text-[9px] font-black tracking-wider border border-white/10">
                          CATEGORY
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-gray-300 text-xs truncate">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{row?.email || row?.entity || "-"}</span>
                      <CopyButton value={row?.email || row?.entity} />
                    </div>
                  </td>
                  <td className="px-4 py-3  text-gray-300 text-xs truncate">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{row?.agent?.referralCode || row?.referralCode || "-"}</span>
                      <CopyButton value={row?.agent?.referralCode || row?.referralCode} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs truncate text-center">
                    {row.referralsCount ?? 0}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold">
                    {(() => {
                      const ggr = (row as any).ggr ?? 0;
                      const val = Number(ggr).toFixed(2);
                      return (
                        <span className={ggr >= 0 ? "text-emerald-400" : "text-red-400"}>
                          {ggr >= 0 ? "+" : ""}{val}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs truncate text-center">

                    {(row as any).subAgentsCount > 0 ? (
                      <span className="text-xs  px-2 py-0.5">
                        {(row as any).subAgentsCount}
                      </span>
                    ) : (
                      <span className="text-gray-500">0</span>
                    )}

                    {/* <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      (row as any).subAgentsCount > 0
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        : 'text-gray-500'
                    }`}>
                      {(row as any).subAgentsCount ?? 0}
                    </span> */}
                  </td>
                  <td
                    onClick={(e) => e.stopPropagation()}
                    className="px-4 py-3 text-xs text-center font-medium"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Switch
                        checked={Boolean(row?.isActive)}
                        disabled={updatingStatusId === row.id}
                        onCheckedChange={(checked) =>
                          handleAccountStatusToggle(row.id, checked)
                        }
                        className="data-[state=checked]:bg-purple-500 data-[state=unchecked]:bg-gray-600"
                      />
                      <span
                        className={
                          row?.isActive ? "text-[#04AD37]" : "text-red-400"
                        }
                      >
                        {updatingStatusId === row.id
                          ? "Updating..."
                          : row?.isActive
                            ? "Active"
                            : "Inactive"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <OnlineStatus {...rowPresence(row)} />
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs truncate">
                    {new Date((row as any)?.createdAt)?.toLocaleDateString()}
                  </td>

                  <td
                    onClick={(e) => e.stopPropagation()}
                    className="px-4 py-3 w-[60px] text-center shrink-0"
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="text-red-400 hover:text-orange-400">
                          <Wrench size={16} />
                        </button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent
                        align="end"
                        className="bg-[#1a2030] text-white border border-gray-700 p-2 min-w-[160px]"
                      >
                        <DropdownMenuLabel className="text-gray-400 text-xs px-2 py-1.5">
                          Actions
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-gray-700 mx-1 My-1" />

                        <DropdownMenuItem
                          onClick={() => {
                            setEditAgent({ id: row.id });
                            setOpenEditModal(true);
                          }}
                          className="text-sm hover:bg-[#242B35] cursor-pointer rounded-md transition-colors"
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedAgent(row);
                            setOpenPermission(true);
                          }}
                          className="text-sm hover:bg-[#242B35] cursor-pointer rounded-md transition-colors"
                        >
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          Permission
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => {
                            setCommissionAgent({
                              id: row.id,
                              username: row.username || "-",
                            });
                            setOpenCommission(true);
                          }}
                          className="text-sm hover:bg-[#242B35] cursor-pointer rounded-md transition-colors"
                        >
                          <Percent className="mr-2 h-4 w-4" />
                          Commission
                        </DropdownMenuItem>

                        {/* <DropdownMenuItem
                          onClick={() => {
                            setActivityUser(row.name || row.id);
                            setOpenActivity(true);
                          }}
                          className="text-sm hover:bg-[#242B35] cursor-pointer rounded-md transition-colors"
                        >
                          <Activity className="mr-2 h-4 w-4" />
                          Activity
                        </DropdownMenuItem> */}

                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedAgentId(row.id);
                            setOpenDownline(true);
                          }}
                          className="text-sm hover:bg-[#242B35] cursor-pointer rounded-md transition-colors"
                        >
                          <ChevronDown className="mr-2 h-4 w-4" />
                          View Downline
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedAgentId(row.id);
                            setOpenTransaction(true);
                          }}
                          className="text-sm hover:bg-[#242B35] cursor-pointer rounded-md transition-colors"
                        >
                          <History className="mr-2 h-4 w-4" />
                          Transaction
                        </DropdownMenuItem>

                        <DropdownMenuSeparator className="bg-gray-700 mx-1 my-1" />

                        <DropdownMenuItem
                          onClick={() => setDeleteTarget(row)}
                          className="text-sm text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 focus:text-red-300 cursor-pointer rounded-md transition-colors"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="shrink-0 mt-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={changePage}
            />
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      <EditAgentModal
        open={openEditModal}
        agentId={editAgent?.id || null}
        onClose={() => {
          setOpenEditModal(false);
          setEditAgent(null);
        }}
        onUpdateSuccess={() => {
          fetchAgents({
            page: currentPage,
            limit: PAGE_SIZE,
            search: searchQuery,
          });
        }}
      />

      {/* ACTIVITY MODAL */}
      <AgentActivityModal
        open={openActivity}
        username={activityUser}
        onClose={() => {
          setOpenActivity(false);
          setActivityUser("");
        }}
      />
      {/* DOWNLINE MODAL */}
      <AgentDownlineModal
        open={openDownline}
        onClose={() => {
          setOpenDownline(false);
          setSelectedAgentId("");
        }}
        agentId={selectedAgentId}
      />
      {/* ROLLOVER MODAL */}

      {/* TRANSACTION MODAL */}
      <AgentTransactionModal
        open={openTransaction}
        onClose={() => {
          setOpenTransaction(false);
          setSelectedAgentId("");
        }}
        agentId={selectedAgentId}
      />
      {/* PERMISSION MODAL */}
      <AgentPermissionModal
        open={openPermission}
        user={selectedAgent}
        onClose={() => {
          setOpenPermission(false);
          setSelectedAgent(null);
        }}
        onSubmit={async (data: any) => {
          try {
            if (selectedAgent?.id) {
              await updateUser(selectedAgent.id, data);
              setOpenPermission(false);
              fetchAgents({
                page: currentPage,
                limit: PAGE_SIZE,
                search: searchQuery,
              });
            }
          } catch (err) {
            console.error("Failed to update permissions", err);
          }
        }}
      />

      {/* COMMISSION MODAL */}
      <AgentCommissionModal
        open={openCommission}
        agentId={commissionAgent?.id || ""}
        username={commissionAgent?.username || ""}
        onClose={() => {
          setOpenCommission(false);
          setCommissionAgent(null);
        }}
        onUpdate={() => {
          fetchAgents({
            page: currentPage,
            limit: PAGE_SIZE,
            search: searchQuery,
          });
        }}
      />

      <ReferralSettingsModal
        open={openReferralSettings}
        onClose={() => setOpenReferralSettings(false)}
      />

      {/* DELETE CONFIRM MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#15181E] rounded-2xl border border-gray-800 shadow-2xl p-4 md:p-6 space-y-4">
            <h2 className="text-white text-lg font-bold">Delete agent?</h2>
            <p className="text-gray-400 text-sm">
              Permanently delete{" "}
              <span className="text-white font-medium">
                {deleteTarget.username || deleteTarget.name || "this agent"}
              </span>
              ? This removes the agent account and cannot be undone. Past
              earnings/records are kept.
            </p>
            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl border border-gray-700 text-white hover:bg-white/5 text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-6 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="animate-spin" size={16} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={openPayoutRequests} onOpenChange={setOpenPayoutRequests}>
        <DialogContent className="bg-[#12151A] text-white p-0 overflow-hidden shadow-2xl top-0 left-0 translate-x-0 translate-y-0 w-screen h-screen max-w-none sm:max-w-none rounded-none border-0 flex flex-col gap-0">
          <DialogHeader className="p-4 shrink-0 border-b border-[#242B35]">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <Wallet className="w-5 h-5 text-purple-400" />
              Agent Payout Requests
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 pt-3 flex-1 min-h-0 flex flex-col">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4 shrink-0">
              {/* TABS MENU */}
              <div className="flex w-full gap-2 overflow-x-auto scrollbar-hide sm:w-auto">
                {["ALL", "PENDING", "PROCESSING", "APPROVED", "COMPLETED", "REJECTED"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setPayoutActiveTab(tab as PayoutTabStatus);
                      setPayoutPage(1);
                    }}
                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      payoutActiveTab === tab
                        ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                        : "text-gray-400 hover:text-gray-200 hover:bg-[#191D24] border border-transparent"
                    }`}
                  >
                    {tab === "PENDING" ? "Pending" : tab === "PROCESSING" ? "Processing" : tab === "APPROVED" ? "Approved" : tab === "COMPLETED" ? "Completed" : tab === "REJECTED" ? "Rejected" : "All"}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-[350px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Search by ID or username..."
                  value={payoutSearch}
                  onChange={(e) => setPayoutSearch(e.target.value)}
                  className="bg-[#191D24] border-[#242B35] text-white placeholder:text-gray-500 text-sm h-9 pl-9 rounded-lg focus-visible:ring-1 focus-visible:ring-purple-500/50 transition-all"
                />
              </div>
            </div>

            <div className="rounded-xl border border-[#242B35] bg-[#191D24] overflow-hidden flex-1 min-h-0 flex flex-col">
              <div className="overflow-auto scrollbar-hide flex-1">
                <table className="w-full min-w-[1140px] table-fixed text-left">
                  <thead className="bg-[#1E232B] sticky top-0 z-10 shadow-sm">
                    <tr className="border-b border-[#242B35]">
                      <th className="whitespace-nowrap px-4 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-[290px]">
                        Request ID
                      </th>
                      <th className="whitespace-nowrap px-4 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-[160px]">
                        User / Agent
                      </th>
                      <th className="whitespace-nowrap px-4 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-[130px]">
                        Amount
                      </th>
                      <th className="whitespace-nowrap px-4 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-[160px]">
                        Request Date
                      </th>
                      <th className="whitespace-nowrap px-4 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-[260px]">
                        Status
                      </th>
                      <th className="px-4 py-2 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-[80px]">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#242B35]">
                    {payoutLoading ? (
                      Array.from({ length: PAGE_SIZE }).map((_, rowIndex) => (
                        <tr key={`payout-skeleton-${rowIndex}`}>
                          <td className="px-4 py-2.5">
                            <Skeleton className="h-6 w-full rounded-lg bg-gray-700/40" />
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-3">
                              <Skeleton className="w-8 h-8 rounded-full bg-gray-700/40 shrink-0" />
                              <Skeleton className="h-3 w-24 bg-gray-700/40" />
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <Skeleton className="h-3 w-16 bg-gray-700/40" />
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="space-y-1.5">
                              <Skeleton className="h-3 w-20 bg-gray-700/40" />
                              <Skeleton className="h-2 w-12 bg-gray-700/30" />
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <Skeleton className="h-4 w-20 rounded-md bg-gray-700/40" />
                          </td>
                          <td className="px-4 py-2.5">
                            <Skeleton className="h-6 w-6 rounded-lg bg-gray-700/40 mx-auto" />
                          </td>
                        </tr>
                      ))
                    ) : filteredPayoutRequests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10">
                          <NoData title={`No ${payoutActiveTab === "ALL" ? "" : payoutActiveTab.toLowerCase()} payout requests`} />
                        </td>
                      </tr>
                    ) : (
                      paginatedPayoutRequests.map((request, index) => {
                        let statusClasses =
                          "bg-gray-500/10 text-gray-400 border-gray-500/20";
                        if (request.status === "APPROVED")
                          statusClasses =
                            "bg-green-500/10 text-green-400 border-green-500/20";
                        else if (request.status === "PROCESSING")
                          statusClasses =
                            "bg-blue-500/10 text-blue-400 border-blue-500/20";
                        else if (
                          request.status.includes("PENDING") ||
                          request.status === "REQUESTED"
                        )
                          statusClasses =
                            "bg-orange-500/10 text-orange-400 border-orange-500/20";
                        else if (request.status === "COMPLETED")
                          statusClasses =
                            "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                        else if (request.status === "REJECTED")
                          statusClasses =
                            "bg-red-500/10 text-red-400 border-red-500/20";

                        const displayUsername =
                          request.subAgent?.username ||
                          request.referrerUsername ||
                          request.username ||
                          "Unknown";

                        return (
                          <tr
                            key={request.id}
                            className="hover:bg-[#1E232B]/50 transition-colors group"
                          >
                            <td className="px-4 py-2.5">
                              <span className="text-gray-300 text-[11px] font-mono bg-[#12151A] border border-[#242B35] px-2 py-1 rounded-lg select-all tracking-wide">
                                {request.id}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-xs uppercase shrink-0">
                                  {displayUsername[0]}
                                </div>
                                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-200 truncate">
                                  {displayUsername}
                                  <CopyButton value={displayUsername} size={12} />
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-orange-400 font-bold tracking-tight text-[14px]">
                                  {(request.amount || 0).toLocaleString(
                                    undefined,
                                    {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    },
                                  )}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-col">
                                <span className="text-[13px] text-gray-300">
                                  {new Date(
                                    request.createdAt,
                                  ).toLocaleDateString(undefined, {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                                <span className="text-[11px] text-gray-500 font-medium">
                                  {new Date(
                                    request.createdAt,
                                  ).toLocaleTimeString(undefined, {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`whitespace-nowrap px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${statusClasses}`}
                              >
                                {displayStatusLabel(request)}
                              </span>
                              {/* Provider refused the release (retried every 5 min). */}
                              {request.payoutReleaseError && (
                                <p
                                  className="mt-1 max-w-[260px] text-[10px] font-semibold text-orange-400/90"
                                  title={request.payoutReleaseError}
                                >
                                  {request.payoutReleaseError}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500/50">
                                    <Wrench size={14} />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="bg-[#191D24] text-white border border-[#242B35] p-1.5 min-w-[170px] rounded-xl shadow-xl"
                                >
                                  <DropdownMenuLabel className="text-gray-400 text-[10px] uppercase font-bold px-2 py-1.5 tracking-wider">
                                    Actions
                                  </DropdownMenuLabel>
                                  <DropdownMenuSeparator className="bg-[#242B35] my-1 mx-1" />

                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedPayoutReq(request);
                                      setPayoutDetailOpen(true);
                                    }}
                                    className="text-xs hover:bg-[#242B35] focus:bg-[#242B35] cursor-pointer rounded-lg py-2 transition-colors"
                                  >
                                    <Eye className="mr-2 h-4 w-4 text-purple-400" />
                                    <span className="font-medium text-gray-200">
                                      View Details
                                    </span>
                                  </DropdownMenuItem>

                                  {showApprove(request) && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handlePayoutAction(request.id, "APPROVE")
                                      }
                                      className="text-xs hover:bg-green-500/10 focus:bg-green-500/10 text-green-400 cursor-pointer rounded-lg py-2 transition-colors mt-0.5"
                                    >
                                      <CheckCircle className="mr-2 h-4 w-4" />
                                      <span className="font-medium">Approve</span>
                                    </DropdownMenuItem>
                                  )}

                                  {/* Explain the missing Approve instead of a
                                      silently shorter menu: the requester has
                                      not finished the payment step, so there is
                                      nothing to send money to yet. */}
                                  {isAgentPay(request) &&
                                    apRaw(request) === "PENDING_ADMIN" &&
                                    !hasPayoutDestination(request) && (
                                      <DropdownMenuItem
                                        disabled
                                        title={
                                          request.payoutBlockReason ?? undefined
                                        }
                                        className="text-xs text-gray-500 rounded-lg py-2 cursor-not-allowed italic"
                                      >
                                        <Clock className="mr-2 h-4 w-4" />
                                        <span className="font-medium">
                                          {request.payoutProviderStatus ===
                                            "FAILED" ||
                                          request.payoutProviderStatus ===
                                            "CANCELED" ||
                                          request.payoutProviderStatus ===
                                            "REFUNDED"
                                            ? `Payout ${request.payoutProviderStatus} — reject to refund`
                                            : "Awaiting payment details"}
                                        </span>
                                      </DropdownMenuItem>
                                    )}

                                  {showComplete(request) && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handlePayoutAction(
                                          request.id,
                                          "COMPLETE",
                                        )
                                      }
                                      className="text-xs hover:bg-blue-500/10 focus:bg-blue-500/10 text-blue-400 cursor-pointer rounded-lg py-2 transition-colors mt-0.5"
                                    >
                                      <CheckCircle className="mr-2 h-4 w-4" />
                                      <span className="font-medium">
                                        Complete & Settle
                                      </span>
                                    </DropdownMenuItem>
                                  )}

                                  {showReject(request) && (
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handlePayoutAction(request.id, "REJECT")
                                      }
                                      className="text-xs hover:bg-red-500/10 focus:bg-red-500/10 text-red-500 cursor-pointer rounded-lg py-2 transition-colors mt-0.5"
                                    >
                                      <XCircle className="mr-2 h-4 w-4" />
                                      <span className="font-medium">
                                        Reject Request
                                      </span>
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {payoutTotalPages > 1 && (
              <div className="pt-4 flex justify-end shrink-0">
                <Pagination
                  currentPage={payoutPage}
                  totalPages={payoutTotalPages}
                  onPageChange={setPayoutPage}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={payoutDetailOpen} onOpenChange={setPayoutDetailOpen}>
        {/* max-h + flex column so a tall request (provider panel + action row)
            scrolls inside the dialog instead of overflowing the viewport and
            clipping the title and the Reject/Release buttons. */}
        <DialogContent className="bg-[#12151A] text-white border border-[#242B35] w-[95vw] max-w-sm p-0 overflow-hidden shadow-2xl rounded-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="p-4 bg-gradient-to-b from-[#191D24] to-[#12151A] border-b border-[#242B35] shrink-0 md:p-6">
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              Review Payout Detail
            </DialogTitle>
          </DialogHeader>
          {selectedPayoutReq && (
            <div className="p-4 space-y-6 flex-1 min-h-0 overflow-y-auto md:p-6">
              <div className="bg-[#191D24] border border-[#242B35] rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold text-lg uppercase shadow-inner">
                    {
                      (selectedPayoutReq.subAgent?.username ||
                        selectedPayoutReq.referrerUsername ||
                        selectedPayoutReq.username ||
                        "U")[0]
                    }
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-0.5">
                      User / Agent
                    </p>
                    <p className="font-semibold text-gray-200 text-base">
                      {selectedPayoutReq.subAgent?.username ||
                        selectedPayoutReq.referrerUsername ||
                        selectedPayoutReq.username ||
                        "Unknown"}
                    </p>
                  </div>
                </div>

                <div className="bg-[#12151A] p-4 rounded-lg flex justify-between items-center border border-[#242B35]">
                  <div>
                    <p className="text-[11px] text-gray-500 uppercase font-bold tracking-wider mb-1">
                      Requested Amount
                    </p>
                    <p className="text-2xl font-black text-orange-400 tracking-tight">
                      {(selectedPayoutReq.amount || 0).toLocaleString(
                        undefined,
                        { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center px-2">
                <span className="text-xs text-gray-400 font-medium">
                  Current Status
                </span>
                {(() => {
                  let statusClasses =
                    "bg-gray-500/10 text-gray-400 border-gray-500/20";
                  if (selectedPayoutReq.status === "APPROVED")
                    statusClasses =
                      "bg-green-500/10 text-green-400 border-green-500/20";
                  else if (selectedPayoutReq.status === "PROCESSING")
                    statusClasses =
                      "bg-blue-500/10 text-blue-400 border-blue-500/20";
                  else if (
                    selectedPayoutReq.status.includes("PENDING") ||
                    selectedPayoutReq.status === "REQUESTED"
                  )
                    statusClasses =
                      "bg-orange-500/10 text-orange-400 border-orange-500/20";
                  else if (selectedPayoutReq.status === "COMPLETED")
                    statusClasses =
                      "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                  else if (selectedPayoutReq.status === "REJECTED")
                    statusClasses =
                      "bg-red-500/10 text-red-400 border-red-500/20";

                  return (
                    <span
                      className={`whitespace-nowrap px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${statusClasses}`}
                    >
                      {displayStatusLabel(selectedPayoutReq)}
                    </span>
                  );
                })()}
              </div>

              {/* Provider payout panel — review the linked destination and
                  release the money (Breeze / Coinflow). */}
              {showReleasePanel(selectedPayoutReq) &&
                providerOf(selectedPayoutReq) === "BREEZE" && (
                  <BreezePayoutInfo
                    requestId={selectedPayoutReq.id}
                    onReleased={() => {
                      fetchPayoutRequests();
                      setPayoutDetailOpen(false);
                    }}
                    onPaid={async () => {
                      // Breeze already paid it (auto-release) — the backend
                      // completed the request, so reload and show that instead
                      // of Approve / Reject on the stale PENDING copy.
                      const id = selectedPayoutReq.id;
                      const before = selectedPayoutReq.rawStatus;
                      await fetchPayoutRequests();
                      const fresh = usePayoutRequestStore
                        .getState()
                        .requests.find((r) => r.id === id);
                      if (!fresh || fresh.rawStatus === before) return;
                      setSelectedPayoutReq(fresh);
                      if (fresh.rawStatus === "COMPLETED") {
                        toast.success(
                          "Breeze already paid this payout — moved to Completed.",
                        );
                      }
                    }}
                  />
                )}
              {showReleasePanel(selectedPayoutReq) &&
                providerOf(selectedPayoutReq) === "COINFLOW" && (
                  <CoinflowPayoutInfo
                    requestId={selectedPayoutReq.id}
                    onReleased={() => {
                      fetchPayoutRequests();
                      setPayoutDetailOpen(false);
                    }}
                  />
                )}

              {/* Sub-agent approved by the agent but hasn't added payout details
                  yet — nothing to release; admin can only reject. */}
              {isAgentPay(selectedPayoutReq) &&
                apRaw(selectedPayoutReq) === "AGENT_APPROVED" && (
                  <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-3 text-[11px] text-orange-300/90">
                    Waiting for the sub-agent to add their payout details (Breeze
                    / Coinflow). You can reject this request to return the funds
                    so they can request again.
                  </div>
                )}

              {(showReject(selectedPayoutReq) ||
                showApprove(selectedPayoutReq) ||
                showComplete(selectedPayoutReq)) && (
                <div className="flex flex-wrap gap-3 pt-4 border-t border-[#242B35]">
                  {showReject(selectedPayoutReq) && (
                    <Button
                      onClick={() =>
                        handlePayoutAction(selectedPayoutReq.id, "REJECT")
                      }
                      variant="outline"
                      className="flex-1 min-w-[140px] rounded-xl h-[46px] text-xs font-semibold bg-transparent border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/50 transition-all"
                    >
                      <XCircle size={16} className="mr-2" />
                      Reject
                    </Button>
                  )}

                  {showApprove(selectedPayoutReq) && (
                    <Button
                      onClick={() =>
                        handlePayoutAction(selectedPayoutReq.id, "APPROVE")
                      }
                      className="flex-1 min-w-[140px] bg-green-600 hover:bg-green-700 text-white rounded-xl h-[46px] text-xs font-semibold shadow-[0_4px_14px_0_rgba(22,163,74,0.39)] transition-all"
                    >
                      <CheckCircle size={16} className="mr-2" />
                      Approve
                    </Button>
                  )}

                  {showComplete(selectedPayoutReq) && (
                    <Button
                      onClick={() =>
                        handlePayoutAction(selectedPayoutReq.id, "COMPLETE")
                      }
                      className="flex-1 min-w-[140px] bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-[46px] text-xs font-semibold shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] transition-all"
                    >
                      <CheckCircle size={16} className="mr-2" />
                      Complete &amp; Settle
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AgentFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onApply={(nextFilters) => {
          setFilters(nextFilters);
        }}
      />
    </div>
  );
}
