"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, CheckCircle, XCircle, Percent } from "lucide-react";
import toast from "react-hot-toast";
import TableSkeleton from "@/components/TableSkeleton";
import NoData from "@/components/NoData";
import {
  commissionChangeRequestApi,
  CommissionChangeRequest,
  CommissionChangeStatus,
} from "@/api/commission-change-request/commission-change-request.api";
import {
  PAGE_HEAD,
  PAGE_SHELL,
  PAGE_TITLE,
} from "@/app/agent-management/components/responsive";

const STATUS_BADGE: Record<CommissionChangeStatus, string> = {
  PENDING: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  APPROVED: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  REJECTED: "bg-red-500/10 text-red-300 border-red-500/30",
};

const TABS: { label: string; value: CommissionChangeStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
];

export default function CommissionRequestsPage() {
  const [tab, setTab] = useState<CommissionChangeStatus | "ALL">("PENDING");
  const [rows, setRows] = useState<CommissionChangeRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState<CommissionChangeRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [counter, setCounter] = useState<Record<string, number>>({});
  const [approveTarget, setApproveTarget] = useState<CommissionChangeRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await commissionChangeRequestApi.inbox(
        tab === "ALL" ? undefined : tab,
      );
      setRows(res.data || []);
    } catch {
      toast.error("Failed to load requests");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const doApprove = async () => {
    const r = approveTarget;
    if (!r) return;
    setActingId(r.id);
    try {
      await commissionChangeRequestApi.approve(r.id);
      toast.success("Approved — new commission applied");
      setApproveTarget(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to approve");
    } finally {
      setActingId(null);
    }
  };

  const openReject = (r: CommissionChangeRequest) => {
    setRejectTarget(r);
    setRejectReason("");
    // Prefill counter with the proposed values so the sub-agent can adjust.
    setCounter({ ...r.proposedCommissions });
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      toast.error("Reason is required");
      return;
    }
    setActingId(rejectTarget.id);
    try {
      await commissionChangeRequestApi.reject(
        rejectTarget.id,
        rejectReason.trim(),
        counter,
      );
      toast.success("Rejected with your counter-proposal");
      setRejectTarget(null);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to reject");
    } finally {
      setActingId(null);
    }
  };

  const fmt = (d?: string) =>
    d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

  return (
    <div className={`${PAGE_SHELL} text-white`}>
      <div className={PAGE_HEAD}>
        <h1 className={PAGE_TITLE}>Agent Management / Commission Requests</h1>
      </div>

      <div className="flex flex-wrap gap-1 mb-3 md:mb-4 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              tab === t.value
                ? "bg-purple-600 text-white"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="md:flex-1 md:min-h-0 md:overflow-y-auto scrollbar-hide">
        {loading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : rows.length === 0 ? (
          // `-mt-2` pulled the caption up into the title; `py-10` replaces the
          // `h-full` centring, which had nothing to centre against on a phone
          // where the parent is content-height.
          <div className="flex flex-col items-center justify-center gap-2 py-10 md:h-full text-center">
            <NoData title="No commission requests" />
            <p className="text-gray-400 text-xs max-w-xs leading-relaxed">
              Commission-rate change requests from your agents will show up here
              for review.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((r) => (
              <RequestCard
                key={r.id}
                r={r}
                acting={actingId === r.id}
                onApprove={() => setApproveTarget(r)}
                onReject={() => openReject(r)}
                fmt={fmt}
              />
            ))}
          </div>
        )}
      </div>

      {/* Approve confirm modal */}
      {approveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#15181E] border border-gray-800 shadow-2xl p-4 sm:p-6 space-y-4 max-h-[92dvh] overflow-y-auto">
            <h2 className="text-white text-lg font-bold">Approve commission change</h2>
            <p className="text-gray-400 text-sm">
              Approve the proposal from{" "}
              <span className="text-white font-medium">
                {approveTarget.requestedBy?.username ?? "your agent"}
              </span>
              ? Your commission rates update <span className="text-white">immediately</span>.
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

      {/* Reject + counter modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#15181E] border border-gray-800 shadow-2xl p-4 sm:p-6 space-y-4 max-h-[92dvh] overflow-y-auto">
            <h2 className="text-white text-lg font-bold">Reject & propose counter</h2>
            <div className="space-y-2">
              <label className="text-gray-300 text-sm font-medium">
                Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Why are you rejecting this proposal?"
                className="w-full resize-none rounded-xl bg-[#1C2128] border border-gray-800 text-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-gray-300 text-sm font-medium">
                Your counter-rates (optional)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.keys(rejectTarget.proposedCommissions).map((cat) => (
                  <div key={cat} className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-gray-500">{cat}</span>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={counter[cat] ?? 0}
                        onChange={(e) =>
                          setCounter((p) => ({ ...p, [cat]: Number(e.target.value) }))
                        }
                        className="w-full rounded-lg bg-[#12161D] border border-gray-800 text-white px-3 py-2 pr-8 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                      />
                      <Percent size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setRejectTarget(null)}
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
    </div>
  );
}

function RequestCard({
  r,
  acting,
  onApprove,
  onReject,
  fmt,
}: {
  r: CommissionChangeRequest;
  acting: boolean;
  onApprove: () => void;
  onReject: () => void;
  fmt: (d?: string) => string;
}) {
  const cats = useMemo(() => {
    const keys = new Set([
      ...Object.keys(r.proposedCommissions || {}),
      ...Object.keys(r.previousCommissions || {}),
    ]);
    return Array.from(keys);
  }, [r]);

  return (
    <div className="bg-[#191D24] rounded-xl border border-gray-800 p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
        <div>
          <p className="text-sm text-white font-semibold">
            Proposal from {r.requestedBy?.username ?? r.requestedBy?.email ?? "your agent"}
          </p>
          <p className="text-xs text-gray-500">{fmt(r.createdAt)}</p>
        </div>
        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${STATUS_BADGE[r.status]}`}>
          {r.status}
        </span>
      </div>

      {r.note && (
        <p className="text-xs text-gray-400 mb-3">“{r.note}”</p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
        {cats.map((cat) => {
          const prev = r.previousCommissions?.[cat] ?? 0;
          const next = r.proposedCommissions?.[cat] ?? 0;
          const changed = prev !== next;
          return (
            <div key={cat} className="bg-[#12161D] rounded-lg px-3 py-2 border border-gray-800/60">
              <p className="text-[10px] uppercase font-bold text-gray-500 truncate">{cat}</p>
              <p className="text-sm font-mono">
                <span className="text-gray-500">{prev}%</span>
                <span className="text-gray-600 mx-1">→</span>
                <span className={changed ? "text-purple-300 font-bold" : "text-gray-400"}>{next}%</span>
              </p>
            </div>
          );
        })}
      </div>

      {r.status === "REJECTED" && (
        <div className="text-xs text-red-300 bg-red-500/5 border border-red-500/20 rounded-lg p-2 mb-2">
          Rejected: {r.rejectionReason}
        </div>
      )}

      {r.status === "PENDING" && (
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
          <button
            onClick={onReject}
            disabled={acting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-red-500/10 active:scale-95 disabled:opacity-50"
          >
            <XCircle size={14} /> Reject
          </button>
          <button
            onClick={onApprove}
            disabled={acting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-green-500/10 active:scale-95 disabled:opacity-50"
          >
            {acting ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle size={14} />} Approve
          </button>
        </div>
      )}
    </div>
  );
}
