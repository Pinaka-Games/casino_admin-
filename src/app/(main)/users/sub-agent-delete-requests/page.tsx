"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle, XCircle, Search } from "lucide-react";
import toast from "react-hot-toast";
import { connectSocket } from "@/lib/socket";
import {
  subAgentDeleteRequestApi,
  SubAgentDeleteRequest,
  SubAgentDeleteRequestStatus,
} from "@/api/sub-agent-delete-request/sub-agent-delete-request.api";
import {
  agentActivityApi,
  ActivityItem,
  ActivitySource,
} from "@/api/agent-activity/agent-activity.api";
import {
  getAllPromoCodes,
  approvePromoCode,
  rejectPromoCode,
  PromoCode,
} from "@/api/promo-codes/promo-codes.api";
import { profileApi } from "@/api/users/users";
import {
  agentPaymentApi,
  AgentPaymentRequest,
  AgentPaymentStatus,
} from "@/api/agent-payment/agent-payment.api";
import Pagination from "@/components/Pagination";

const ACTIVITY_PER_PAGE = 10;

type TabValue =
  | SubAgentDeleteRequestStatus
  | "ALL"
  | "ACTIVITY"
  | "PROMO"
  | "PAYOUT";

// All first (default view), then the request lifecycle, then the other queues
// that need an admin decision, with the broader activity log last.
//
// The status tabs above only ever covered sub-agent delete/status tickets, so a
// payout sitting in PENDING_ADMIN showed up in All Activity — read-only — and
// nowhere actionable. Its own tab is why the Pending tab read "No requests
// found" while a payout waited.
const STATUS_TABS: { label: string; value: TabValue }[] = [
  { label: "All", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Promo Codes", value: "PROMO" },
  { label: "Payouts", value: "PAYOUT" },
  { label: "All Activity", value: "ACTIVITY" },
];

const PROMO_PER_PAGE = 10;
const PAYOUT_PER_PAGE = 10;

const PAYOUT_STATUS_BADGE: Record<string, string> = {
  PENDING_AGENT: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  AGENT_APPROVED: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  PENDING_ADMIN: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  ADMIN_APPROVED: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  COMPLETED: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  REJECTED_BY_AGENT: "bg-red-500/10 text-red-300 border-red-500/30",
  REJECTED_BY_ADMIN: "bg-red-500/10 text-red-300 border-red-500/30",
};

const PROMO_STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  approved: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  rejected: "bg-red-500/10 text-red-300 border-red-500/30",
};

const ACTIVITY_SOURCE_BADGE: Record<ActivitySource, string> = {
  DELETE_REQUEST: "bg-red-500/10 text-red-300 border-red-500/30",
  STATUS_REQUEST: "bg-orange-500/10 text-orange-300 border-orange-500/30",
  COMMISSION_CHANGE: "bg-purple-500/10 text-purple-300 border-purple-500/30",
  PAYOUT_REQUEST: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  REGISTRATION: "bg-sky-500/10 text-sky-300 border-sky-500/30",
};

const ACTIVITY_STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  APPROVED: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  REJECTED: "bg-red-500/10 text-red-300 border-red-500/30",
  COMPLETED: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  INFO: "bg-gray-500/10 text-gray-300 border-gray-500/30",
};

const ACTIVITY_ROLE_LABEL: Record<ActivityItem["actorRole"], string> = {
  AGENT: "Agent",
  SUBAGENT: "Sub-Agent",
  ADMIN: "Admin",
  SYSTEM: "System",
};

// Per-category commission diff (previous → proposed, plus sub-agent counter
// when present) for the activity detail modal — mirrors the Commission
// Requests page layout.
function CommissionDiff({
  commissions,
}: {
  commissions: {
    proposed?: Record<string, number>;
    previous?: Record<string, number>;
    counter?: Record<string, number>;
  };
}) {
  const { proposed = {}, previous = {}, counter = {} } = commissions;
  const cats = Array.from(
    new Set([
      ...Object.keys(previous),
      ...Object.keys(proposed),
      ...Object.keys(counter),
    ]),
  );
  if (cats.length === 0) return null;

  const pct = (v?: number) => {
    if (v == null) return "—";
    const n = Number(v);
    return `${Number.isInteger(n) ? n : n.toFixed(1)}%`;
  };

  return (
    <div className="pt-1">
      <div className="text-[10px] text-gray-500 uppercase font-bold mb-1.5">
        Commission (previous → proposed)
      </div>
      <div className="grid grid-cols-2 gap-2">
        {cats.map((cat) => {
          const prev = previous[cat];
          const prop = proposed[cat];
          const cnt = counter[cat];
          const changed =
            prop != null && (prev == null || Number(prop) !== Number(prev));
          return (
            <div
              key={cat}
              className="rounded-lg bg-white/5 border border-gray-800 p-2"
            >
              <div className="text-[9px] text-gray-500 uppercase font-bold tracking-wide">
                {cat}
              </div>
              <div className="flex items-center gap-1 text-xs mt-0.5">
                <span className="text-gray-400">{pct(prev)}</span>
                <span className="text-gray-600">→</span>
                <span className={changed ? "text-purple-400 font-bold" : "text-gray-300"}>
                  {pct(prop)}
                </span>
              </div>
              {cnt != null && (
                <div className="text-[10px] text-amber-300 mt-0.5">
                  counter {pct(cnt)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const STATUS_BADGE: Record<SubAgentDeleteRequestStatus, string> = {
  PENDING: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  APPROVED: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  REJECTED: "bg-red-500/10 text-red-300 border-red-500/30",
};

export default function SubAgentDeleteRequestsPage() {
  const [tab, setTab] = useState<TabValue>("PENDING");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<SubAgentDeleteRequest[]>([]);
  const [activityRows, setActivityRows] = useState<ActivityItem[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  // Agent-created promo codes awaiting approval. Surfaced here because this is
  // where an admin looks for anything needing a decision — the approval also
  // lives under Revenue Sharing Package, two levels deep, where it went unfound.
  const [promoRows, setPromoRows] = useState<PromoCode[]>([]);
  const [promoPage, setPromoPage] = useState(1);

  // Agent / sub-agent payout requests. Server-paginated (unlike the promo and
  // activity tabs) because this table grows with every payout ever made.
  const [payoutRows, setPayoutRows] = useState<AgentPaymentRequest[]>([]);
  const [payoutPage, setPayoutPage] = useState(1);
  const [payoutTotal, setPayoutTotal] = useState(0);
  const [agentMap, setAgentMap] = useState<
    Record<string, { name: string; email: string }>
  >({});

  // Promo codes carry an agent id, not a name. Same lookup the promo listing
  // uses, so both screens label an agent identically.
  useEffect(() => {
    profileApi
      .getAllAgents({ limit: 1000 })
      .then((res) => {
        const map: Record<string, { name: string; email: string }> = {};
        for (const a of res.data.data ?? []) {
          const email = (a as any).entity ?? a.email ?? a.profile?.email ?? "";
          map[a.id] = { name: a.username ?? a.profile?.fullName ?? a.id, email };
        }
        setAgentMap(map);
      })
      .catch(() => {});
  }, []);

  // Reset activity paging when the tab or search changes.
  useEffect(() => {
    setActivityPage(1);
    setPromoPage(1);
    setPayoutPage(1);
  }, [tab, search]);

  const activityTotalPages = Math.max(
    1,
    Math.ceil(activityRows.length / ACTIVITY_PER_PAGE),
  );
  const pagedActivity = activityRows.slice(
    (activityPage - 1) * ACTIVITY_PER_PAGE,
    activityPage * ACTIVITY_PER_PAGE,
  );

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState<SubAgentDeleteRequest | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  // Approve confirm modal
  const [approveTarget, setApproveTarget] = useState<SubAgentDeleteRequest | null>(null);
  // Payout reject modal — replaces window.prompt(), which rendered as a bare
  // browser alert. Reason is required (the API rejects without one).
  const [payoutRejectTarget, setPayoutRejectTarget] =
    useState<AgentPaymentRequest | null>(null);
  const [payoutRejectReason, setPayoutRejectReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "ACTIVITY") {
        const res = await agentActivityApi.list({
          search: search.trim() || undefined,
          limit: 100,
        });
        setActivityRows(res.data.items || []);
      } else if (tab === "PAYOUT") {
        // Every status, not just PENDING_ADMIN — an admin needs to see what they
        // already decided, and ADMIN_APPROVED rows still need "Complete".
        const res = await agentPaymentApi.adminList({
          search: search.trim() || undefined,
          page: payoutPage,
          limit: PAYOUT_PER_PAGE,
        });
        setPayoutRows(res.data.items || []);
        setPayoutTotal(res.data.total || 0);
      } else if (tab === "PROMO") {
        // Agent-created only (`agent` set) — admin-authored codes are managed in
        // Promo Code Listing and never wait on an approval.
        const data = await getAllPromoCodes();
        setPromoRows(data.filter((p) => !!p.agent));
      } else {
        const res = await subAgentDeleteRequestApi.adminList({
          status: tab === "ALL" ? undefined : tab,
          search: search.trim() || undefined,
          limit: 100,
        });
        setRows(res.data.items || []);
      }
    } catch {
      toast.error(
        tab === "ACTIVITY"
          ? "Failed to load activity"
          : tab === "PROMO"
            ? "Failed to load agent promo codes"
            : tab === "PAYOUT"
              ? "Failed to load payout requests"
              : "Failed to load requests",
      );
    } finally {
      setLoading(false);
    }
  }, [tab, search, payoutPage]);

  useEffect(() => {
    load();
  }, [load]);

  // Live updates — refetch when any ticket is created/approved/rejected.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  useEffect(() => {
    const s = connectSocket();
    const handler = () => loadRef.current();
    s.on("sub-agent-ticket:changed", handler);
    s.on("agent-activity:changed", handler);
    // Broadcast to every admin on create/approve/reject/complete, so a payout
    // raised while this page is open lands in the queue without a reload.
    s.on("agent-payment:updated", handler);
    return () => {
      s.off("sub-agent-ticket:changed", handler);
      s.off("agent-activity:changed", handler);
      s.off("agent-payment:updated", handler);
    };
  }, []);

  const doApprove = async () => {
    const r = approveTarget;
    if (!r) return;
    setActingId(r.id);
    try {
      await subAgentDeleteRequestApi.approve(r.id);
      toast.success(
        r.type === "DELETE"
          ? "Approved — sub-agent deleted"
          : `Approved — sub-agent ${r.targetBlocked ? "deactivated" : "activated"}`,
      );
      setApproveTarget(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to approve");
    } finally {
      setActingId(null);
    }
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    setActingId(rejectTarget.id);
    try {
      await subAgentDeleteRequestApi.reject(rejectTarget.id, rejectNote.trim() || undefined);
      toast.success("Request rejected");
      setRejectTarget(null);
      setRejectNote("");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to reject");
    } finally {
      setActingId(null);
    }
  };

  // Patch the row in place rather than refetching: the decision is already in
  // the response, and a reload would drop the admin's scroll position.
  const decidePromo = async (id: string, decision: "approve" | "reject") => {
    setActingId(id);
    try {
      const updated =
        decision === "approve"
          ? await approvePromoCode(id)
          : await rejectPromoCode(id);
      setPromoRows((prev) => prev.map((p) => (p.id === id ? updated : p)));
      toast.success(
        decision === "approve" ? "Promo code approved" : "Promo code rejected",
      );
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message ||
          `Failed to ${decision === "approve" ? "approve" : "reject"}`,
      );
    } finally {
      setActingId(null);
    }
  };

  /**
   * Admin decision on a payout request.
   *
   * `approve` is review-and-confirm only — it moves PENDING_ADMIN →
   * ADMIN_APPROVED and does NOT send money. Breeze/Coinflow payouts are
   * released through the provider; manual ones are finalized with `complete`,
   * which is when the frozen funds actually settle.
   */
  const decidePayout = async (
    r: AgentPaymentRequest,
    decision: "approve" | "reject" | "complete",
  ) => {
    if (decision === "reject") {
      setPayoutRejectTarget(r);
      setPayoutRejectReason("");
      return;
    }

    setActingId(r.id);
    try {
      if (decision === "approve") {
        await agentPaymentApi.adminApprove(r.id);
        toast.success("Payout approved — release it via the provider or Complete");
      } else {
        await agentPaymentApi.adminComplete(r.id);
        toast.success("Payout marked completed");
      }
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || `Failed to ${decision}`);
    } finally {
      setActingId(null);
    }
  };

  const submitPayoutReject = async () => {
    const r = payoutRejectTarget;
    const reason = payoutRejectReason.trim();
    // The API requires a reason — rejecting a payout without one leaves the
    // agent with no explanation. Button is disabled while empty; this is the
    // backstop.
    if (!r || !reason) return;
    setActingId(r.id);
    try {
      await agentPaymentApi.adminReject(r.id, reason);
      toast.success("Payout rejected");
      setPayoutRejectTarget(null);
      setPayoutRejectReason("");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to reject");
    } finally {
      setActingId(null);
    }
  };

  const payoutTotalPages = Math.max(1, Math.ceil(payoutTotal / PAYOUT_PER_PAGE));

  const agentLabel = (id?: string) => {
    if (!id) return { name: "—", email: "" };
    return agentMap[id] ?? { name: id, email: "" };
  };

  // Pending first — this is a queue, so what needs a decision sits at the top
  // regardless of when it was created. Settled rows stay visible underneath as
  // the audit trail of what was already decided.
  const visiblePromos = (() => {
    const q = search.trim().toLowerCase();
    const matched = q
      ? promoRows.filter((p) => {
          const a = agentLabel(p.agent);
          return (
            p.code?.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q) ||
            a.email.toLowerCase().includes(q)
          );
        })
      : promoRows;
    return [...matched].sort((a, b) => {
      const aPending = a.approvalStatus === "pending" ? 0 : 1;
      const bPending = b.approvalStatus === "pending" ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });
  })();

  const promoTotalPages = Math.max(
    1,
    Math.ceil(visiblePromos.length / PROMO_PER_PAGE),
  );
  const pagedPromos = visiblePromos.slice(
    (promoPage - 1) * PROMO_PER_PAGE,
    promoPage * PROMO_PER_PAGE,
  );

  const discountLabel = (p: PromoCode) =>
    p.discountType === "percentage"
      ? `${p.discountValue}%`
      : `${p.currency ?? "$"}${p.discountValue}`;

  const fmt = (d?: string) =>
    d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

  const typeLabel = (r: SubAgentDeleteRequest) =>
    r.type === "STATUS" ? (r.targetBlocked ? "Deactivate" : "Activate") : "Delete";

  const typeBadge = (r: SubAgentDeleteRequest) =>
    r.type === "STATUS"
      ? r.targetBlocked
        ? "bg-orange-500/10 text-orange-300 border-orange-500/30"
        : "bg-sky-500/10 text-sky-300 border-sky-500/30"
      : "bg-red-500/10 text-red-300 border-red-500/30";

  return (
    <div className="min-h-full w-full bg-[#15181E] p-3 md:p-6">
      <div className="bg-[#191D24] mb-3 px-3 py-3 rounded-lg md:mb-4 md:px-4">
        <h1 className="text-sm text-white">Dashboard / All Tickets</h1>
      </div>

      {/* Tabs + search */}
      <div className="bg-[#191D24] rounded-lg px-3 py-2 mb-3 flex items-center justify-between gap-3 flex-wrap md:mb-4">
        <div className="flex w-full gap-1 overflow-x-auto scrollbar-hide md:w-auto md:overflow-visible">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                tab === t.value
                  ? "bg-purple-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative w-full md:w-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              tab === "PROMO"
                ? "Search code / agent"
                : tab === "PAYOUT"
                  ? "Search requester / email / request id"
                  : "Search username / email / id"
            }
            className="h-9 w-full md:w-[260px] rounded-md bg-[#242B35] border-none pl-8 pr-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500/50"
          />
        </div>
      </div>

      {/* Table */}
      {tab === "PAYOUT" ? (
        <>
        <div className="bg-[#191D24] rounded-lg overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-[#242B35]">
              <tr className="border-b border-gray-800 text-gray-400 text-xs">
                <th className="px-4 py-3">Requester</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Note / Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
                    <Loader2 className="animate-spin text-purple-400 inline" size={24} />
                  </td>
                </tr>
              ) : payoutRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-500 text-sm">
                    No payout requests found
                  </td>
                </tr>
              ) : (
                payoutRows.map((r) => {
                  const provider = r.paymentDetails?.provider as string | undefined;
                  return (
                    <tr key={r.id} className="border-b border-gray-800/60 hover:bg-[#1a2030] text-xs">
                      <td className="px-4 py-3">
                        <div className="text-white">{r.requester?.username ?? "—"}</div>
                        <div className="text-gray-500">{r.requester?.email ?? ""}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${
                          r.requesterType === "SUBAGENT"
                            ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                            : "bg-sky-500/10 text-sky-300 border-sky-500/30"
                        }`}>
                          {r.requesterType === "SUBAGENT" ? "Sub-Agent" : "Agent"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-200 font-mono font-bold">
                        {Number(r.amount).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        <div>{r.paymentMethod ?? "—"}</div>
                        {provider && (
                          <div className="text-gray-500 text-[10px]">{provider}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-300 max-w-[240px]">
                        <span className="line-clamp-2">{r.rejectionReason || r.note || "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${PAYOUT_STATUS_BADGE[r.status] ?? ""}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmt(r.createdAt)}</td>
                      <td className="px-4 py-3">
                        {r.status === AgentPaymentStatus.PENDING_ADMIN ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => decidePayout(r, "approve")}
                              disabled={actingId === r.id}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-green-500/10 transition-all active:scale-95 disabled:opacity-50"
                            >
                              {actingId === r.id ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle size={14} />}
                              Approve
                            </button>
                            <button
                              onClick={() => decidePayout(r, "reject")}
                              disabled={actingId === r.id}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-red-500/10 transition-all active:scale-95 disabled:opacity-50"
                            >
                              <XCircle size={14} />
                              Reject
                            </button>
                          </div>
                        ) : r.status === AgentPaymentStatus.ADMIN_APPROVED ? (
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => decidePayout(r, "complete")}
                              disabled={actingId === r.id}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-purple-500/10 transition-all active:scale-95 disabled:opacity-50"
                              title="Settles the frozen funds. Use only after the payout has actually been sent."
                            >
                              {actingId === r.id ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle size={14} />}
                              Complete
                            </button>
                          </div>
                        ) : r.status === AgentPaymentStatus.PENDING_AGENT ? (
                          <div className="text-center text-gray-500 text-[10px] uppercase tracking-wider">
                            Awaiting parent agent
                          </div>
                        ) : (
                          <div className="text-center text-gray-600">—</div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {payoutTotal > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 mt-3">
            <p className="text-[11px] text-gray-500">
              Showing {(payoutPage - 1) * PAYOUT_PER_PAGE + 1}–
              {Math.min(payoutPage * PAYOUT_PER_PAGE, payoutTotal)} of {payoutTotal}
            </p>
            <Pagination
              currentPage={payoutPage}
              totalPages={payoutTotalPages}
              onPageChange={setPayoutPage}
            />
          </div>
        )}
        </>
      ) : tab === "PROMO" ? (
        <>
        <div className="bg-[#191D24] rounded-lg overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-[#242B35]">
              <tr className="border-b border-gray-800 text-gray-400 text-xs">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Purchase (Min – Max)</th>
                <th className="px-4 py-3">Validity</th>
                <th className="px-4 py-3">Approval</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
                    <Loader2 className="animate-spin text-purple-400 inline" size={24} />
                  </td>
                </tr>
              ) : visiblePromos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-500 text-sm">
                    No agent promo codes found
                  </td>
                </tr>
              ) : (
                pagedPromos.map((p) => {
                  const a = agentLabel(p.agent);
                  const status = p.approvalStatus ?? "approved";
                  return (
                    <tr key={p.id} className="border-b border-gray-800/60 hover:bg-[#1a2030] text-xs">
                      <td className="px-4 py-3">
                        <div className="text-purple-300 font-mono font-semibold">{p.code}</div>
                        {p.description && (
                          <div className="text-gray-500 max-w-[220px] line-clamp-2">{p.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-white">{a.name}</div>
                        <div className="text-gray-500">{a.email}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{discountLabel(p)}</td>
                      <td className="px-4 py-3 text-gray-300">
                        {p.minPurchaseAmount ?? 0} – {p.maxDiscountAmount ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                        <div>{fmt(p.startDate ?? undefined)}</div>
                        <div className="text-gray-600 text-[10px]">→ {fmt(p.endDate ?? undefined)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase ${PROMO_STATUS_BADGE[status] ?? PROMO_STATUS_BADGE.approved}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmt(p.createdAt)}</td>
                      <td className="px-4 py-3">
                        {status === "pending" ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => decidePromo(p.id, "approve")}
                              disabled={actingId === p.id}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-green-500/10 transition-all active:scale-95 disabled:opacity-50"
                            >
                              {actingId === p.id ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle size={14} />}
                              Approve
                            </button>
                            <button
                              onClick={() => decidePromo(p.id, "reject")}
                              disabled={actingId === p.id}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-red-500/10 transition-all active:scale-95 disabled:opacity-50"
                            >
                              <XCircle size={14} />
                              Reject
                            </button>
                          </div>
                        ) : (
                          <div className="text-center text-gray-600">—</div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {visiblePromos.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 mt-3">
            <p className="text-[11px] text-gray-500">
              Showing {(promoPage - 1) * PROMO_PER_PAGE + 1}–
              {Math.min(promoPage * PROMO_PER_PAGE, visiblePromos.length)} of{" "}
              {visiblePromos.length}
            </p>
            <Pagination
              currentPage={promoPage}
              totalPages={promoTotalPages}
              onPageChange={setPromoPage}
            />
          </div>
        )}
        </>
      ) : tab === "ACTIVITY" ? (
        <>
        <div className="bg-[#191D24] rounded-lg overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-[#242B35]">
              <tr className="border-b border-gray-800 text-gray-400 text-xs">
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Reason / Note</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <Loader2 className="animate-spin text-purple-400 inline" size={24} />
                  </td>
                </tr>
              ) : activityRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500 text-sm">
                    No activity found
                  </td>
                </tr>
              ) : (
                pagedActivity.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => setSelectedActivity(a)}
                    className="border-b border-gray-800/60 hover:bg-[#1a2030] text-xs cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${ACTIVITY_SOURCE_BADGE[a.source]}`}>
                        {a.typeLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-300">{a.actorName ?? "—"}</div>
                      <div className="text-gray-500 text-[10px]">
                        {ACTIVITY_ROLE_LABEL[a.actorRole]}
                        {a.actorEmail ? ` · ${a.actorEmail}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-white">{a.subjectName ?? "—"}</div>
                      <div className="text-gray-500">{a.subjectEmail ?? ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${ACTIVITY_STATUS_BADGE[a.status]}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300 font-mono">
                      {a.amount != null ? Number(a.amount).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-300 max-w-[280px]">
                      <span className="line-clamp-3">{a.reason || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                      <div>{fmt(a.createdAt)}</div>
                      {a.reviewedAt && (
                        <div className="text-gray-600 text-[10px]">reviewed {fmt(a.reviewedAt)}</div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {activityRows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 mt-3">
            <p className="text-[11px] text-gray-500">
              Showing {(activityPage - 1) * ACTIVITY_PER_PAGE + 1}–
              {Math.min(activityPage * ACTIVITY_PER_PAGE, activityRows.length)} of{" "}
              {activityRows.length}
            </p>
            <Pagination
              currentPage={activityPage}
              totalPages={activityTotalPages}
              onPageChange={setActivityPage}
            />
          </div>
        )}
        </>
      ) : (
      <div className="bg-[#191D24] rounded-lg overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead className="bg-[#242B35]">
            <tr className="border-b border-gray-800 text-gray-400 text-xs">
              <th className="px-4 py-3">Sub-Agent</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Requested By</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Requested</th>
              <th className="px-4 py-3">Reviewed</th>
              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center">
                  <Loader2 className="animate-spin text-purple-400 inline" size={24} />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-500 text-sm">
                  No requests found
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-800/60 hover:bg-[#1a2030] text-xs">
                  <td className="px-4 py-3">
                    <div className="text-white">{r.subAgentUsername ?? "—"}</div>
                    <div className="text-gray-500">{r.subAgentEmail ?? ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${typeBadge(r)}`}>
                      {typeLabel(r)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {r.requestedBy?.username ?? r.requestedBy?.email ?? r.requestedByEmployeeId}
                  </td>
                  <td className="px-4 py-3 text-gray-300 max-w-[280px]">
                    <span className="line-clamp-3">{r.reason}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${STATUS_BADGE[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmt(r.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    {r.status === "PENDING" ? "—" : (
                      <div>
                        <div>{fmt(r.reviewedAt)}</div>
                        {r.adminNote && <div className="text-gray-500 italic whitespace-normal">“{r.adminNote}”</div>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "PENDING" ? (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setApproveTarget(r)}
                          disabled={actingId === r.id}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-green-500/10 transition-all active:scale-95 disabled:opacity-50"
                        >
                          {actingId === r.id ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle size={14} />}
                          Approve
                        </button>
                        <button
                          onClick={() => setRejectTarget(r)}
                          disabled={actingId === r.id}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-red-500/10 transition-all active:scale-95 disabled:opacity-50"
                        >
                          <XCircle size={14} />
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="block text-center text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* Approve confirm modal */}
      {approveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#15181E] border border-gray-800 shadow-2xl p-4 md:p-6 space-y-4">
            <h2 className="text-white text-lg font-bold">
              Approve {typeLabel(approveTarget).toLowerCase()} request
            </h2>
            <p className="text-gray-400 text-sm">
              {approveTarget.type === "DELETE" ? (
                <>
                  Permanently delete{" "}
                  <span className="text-white font-medium">
                    {approveTarget.subAgentUsername ?? "this sub-agent"}
                  </span>
                  ? This removes the sub-agent account and cannot be undone.
                </>
              ) : (
                <>
                  {approveTarget.targetBlocked ? "Deactivate" : "Activate"}{" "}
                  <span className="text-white font-medium">
                    {approveTarget.subAgentUsername ?? "this sub-agent"}
                  </span>
                  ?
                </>
              )}
            </p>
            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => setApproveTarget(null)}
                disabled={actingId === approveTarget.id}
                className="px-5 py-2 rounded-xl border border-gray-700 text-white hover:bg-white/5 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={doApprove}
                disabled={actingId === approveTarget.id}
                className="px-6 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {actingId === approveTarget.id && <Loader2 className="animate-spin" size={16} />}
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#15181E] border border-gray-800 shadow-2xl p-4 md:p-6 space-y-4">
            <h2 className="text-white text-lg font-bold">Reject deletion request</h2>
            <p className="text-gray-400 text-sm">
              Rejecting request for{" "}
              <span className="text-white">{rejectTarget.subAgentUsername ?? "sub-agent"}</span>. The sub-agent stays active.
            </p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              placeholder="Note (optional)"
              className="w-full resize-none rounded-xl bg-[#1C2128] border border-gray-800 text-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setRejectTarget(null); setRejectNote(""); }}
                disabled={actingId === rejectTarget.id}
                className="px-5 py-2 rounded-xl border border-gray-700 text-white hover:bg-white/5 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={submitReject}
                disabled={actingId === rejectTarget.id}
                className="px-6 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm flex items-center gap-2"
              >
                {actingId === rejectTarget.id && <Loader2 className="animate-spin" size={16} />}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payout reject modal */}
      {payoutRejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#15181E] border border-gray-800 shadow-2xl p-4 md:p-6 space-y-4">
            <h2 className="text-white text-lg font-bold">Reject payout request</h2>
            <p className="text-gray-400 text-sm">
              Rejecting the{" "}
              <span className="text-white font-mono">
                {Number(payoutRejectTarget.amount).toFixed(2)}
              </span>{" "}
              payout for{" "}
              <span className="text-white">
                {payoutRejectTarget.requester?.username ?? "this requester"}
              </span>
              . The reason is shown to them, so make it actionable.
            </p>
            <textarea
              value={payoutRejectReason}
              onChange={(e) => setPayoutRejectReason(e.target.value)}
              rows={3}
              autoFocus
              placeholder="Reason for rejecting this payout (required)"
              className="w-full resize-none rounded-xl bg-[#1C2128] border border-gray-800 text-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setPayoutRejectTarget(null); setPayoutRejectReason(""); }}
                disabled={actingId === payoutRejectTarget.id}
                className="px-5 py-2 rounded-xl border border-gray-700 text-white hover:bg-white/5 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={submitPayoutReject}
                disabled={
                  actingId === payoutRejectTarget.id || !payoutRejectReason.trim()
                }
                className="px-6 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {actingId === payoutRejectTarget.id && (
                  <Loader2 className="animate-spin" size={16} />
                )}
                Reject payout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity detail modal */}
      {selectedActivity && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setSelectedActivity(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#15181E] border border-gray-800 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-4 md:px-6 border-b border-gray-800">
              <h2 className="text-white text-base font-bold">Activity Detail</h2>
              <button
                onClick={() => setSelectedActivity(null)}
                className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
              >
                <XCircle size={18} />
              </button>
            </div>
            <div className="p-4 md:p-6 space-y-3 text-sm">
              {(() => {
                const a = selectedActivity;
                const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-[11px] text-gray-500 uppercase font-bold shrink-0">{label}</span>
                    <span className="text-gray-200 text-right break-words">{value ?? "—"}</span>
                  </div>
                );
                return (
                  <>
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${ACTIVITY_SOURCE_BADGE[a.source]}`}
                      >
                        {a.typeLabel}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${ACTIVITY_STATUS_BADGE[a.status]}`}
                      >
                        {a.status}
                      </span>
                    </div>
                    <div className="h-px bg-gray-800" />
                    <Row
                      label="Actor"
                      value={
                        <>
                          {a.actorName ?? "—"}
                          <div className="text-[10px] text-gray-500">
                            {ACTIVITY_ROLE_LABEL[a.actorRole]}
                            {a.actorEmail ? ` · ${a.actorEmail}` : ""}
                          </div>
                        </>
                      }
                    />
                    <Row
                      label="Subject"
                      value={
                        <>
                          {a.subjectName ?? "—"}
                          {a.subjectEmail && (
                            <div className="text-[10px] text-gray-500">{a.subjectEmail}</div>
                          )}
                        </>
                      }
                    />
                    {a.amount != null && (
                      <Row label="Amount" value={Number(a.amount).toLocaleString()} />
                    )}
                    <Row label="Reason / Note" value={a.reason || "—"} />
                    {a.source === "COMMISSION_CHANGE" && a.commissions && (
                      <CommissionDiff commissions={a.commissions} />
                    )}
                    <Row label="Created" value={fmt(a.createdAt)} />
                    {a.reviewedAt && <Row label="Reviewed" value={fmt(a.reviewedAt)} />}
                    <div className="h-px bg-gray-800" />
                    <Row
                      label="ID"
                      value={<span className="font-mono text-[11px] break-all">{a.id}</span>}
                    />
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
