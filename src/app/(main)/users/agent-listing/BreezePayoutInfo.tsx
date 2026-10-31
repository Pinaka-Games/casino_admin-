"use client";

import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  CreditCard,
  ExternalLink,
  AlertTriangle,
  Clock,
  RefreshCw,
  Send,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  agentBreezeApi,
  AgentBreezePage,
} from "@/api/agent-payment/agent-breeze.api";

const FAILURE_STATUSES = ["FAILED", "REFUNDED", "CANCELED", "CANCELLED"];

const prettyMethod = (m?: string | null) => {
  if (!m) return "Not selected yet";
  return m
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 shrink-0">
        {label}
      </span>
      <span className="text-gray-200 text-xs text-right break-all">{value}</span>
    </div>
  );
}

/**
 * Shows the Breeze hosted-payout details a sub-agent entered (bank / card /
 * crypto wallet), the live page status, a failure reason if Breeze rejected the
 * payout, and a processing-time note. Used inside the admin payout review modal.
 */
export function BreezePayoutInfo({
  requestId,
  onReleased,
  onPaid,
}: {
  requestId: string;
  onReleased?: () => void;
  /** Breeze reports the payout as paid (PROCESSED / COMPLETED). The backend
   *  completes the request on the same sync, so the parent's copy is stale. */
  onPaid?: () => void;
}) {
  const [page, setPage] = useState<AgentBreezePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [releasing, setReleasing] = useState(false);

  // An AUTOMATIC page (amount at or under the agent auto-release threshold)
  // is paid by Breeze the moment the payee confirms — no admin step. The
  // modal around this panel was opened from a list fetched before that, so
  // tell it once, and it reloads instead of offering Approve on a request the
  // backend has already completed ("Cannot approve from status COMPLETED").
  const paidNotified = useRef(false);
  useEffect(() => {
    const s = (page?.status || "").toUpperCase();
    if (!paidNotified.current && (s === "PROCESSED" || s === "COMPLETED")) {
      paidNotified.current = true;
      onPaid?.();
    }
  }, [page?.status, onPaid]);

  // Pull the live status straight from Breeze (bypasses the webhook). Useful
  // when the page still shows CREATED/null but the sub-agent may have just
  // completed the hosted page.
  const handleRefresh = async () => {
    if (!page) return;
    try {
      setRefreshing(true);
      const res = await agentBreezeApi.adminRefresh(page.id);
      setPage(res.data);
      toast.success("Breeze status refreshed");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  // Actually send the money. MANUAL pages sit at "Pending Merchant Release"
  // until this is called — releasing tells Breeze to pay out the sub-agent.
  const handleRelease = async () => {
    if (!page) return;
    try {
      setReleasing(true);
      const res = await agentBreezeApi.adminRelease(page.id);
      setPage(res.data);
      toast.success("Breeze payout released — funds are being sent.");
      onReleased?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Release failed");
    } finally {
      setReleasing(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    agentBreezeApi
      .getByRequest(requestId)
      .then(async (res) => {
        if (!active) return;
        setPage(res.data);
        // Sync live from Breeze on open: the confirm timestamp / pending stage
        // arrive via webhook, which is unreliable in dev, so pull the current
        // state once so the Release gate reflects reality without a manual click.
        const p = res.data;
        const terminal =
          !!p?.releasedAt ||
          ["PROCESSED", "COMPLETED", ...FAILURE_STATUSES].includes(
            (p?.status || "").toUpperCase(),
          );
        if (p?.id && !terminal) {
          try {
            const live = await agentBreezeApi.adminRefresh(p.id);
            if (active) setPage(live.data);
          } catch {
            /* keep the stored page if the live refresh fails */
          }
        }
      })
      .catch(() => {
        if (active) setNotFound(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [requestId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500 bg-[#12151A] p-4 rounded-lg border border-[#242B35]">
        <Loader2 size={13} className="animate-spin" /> Loading Breeze payout details…
      </div>
    );
  }

  if (notFound || !page) {
    return (
      <div className="text-xs text-gray-500 bg-[#12151A] p-4 rounded-lg border border-[#242B35]">
        Sub-agent has not opened the Breeze payout page yet — no details submitted.
      </div>
    );
  }

  const status = (page.status || "").toUpperCase();
  const isFailure = FAILURE_STATUSES.includes(status);
  // PENDING_MERCHANT_RELEASE (and sibling release stages) mean the sub-agent
  // already confirmed a payout method and Breeze is waiting on US to release —
  // so treat that as confirmed even if the customerConfirmedAt timestamp never
  // synced via webhook. Otherwise the Release button never renders.
  const releaseReadyStage = [
    "PENDING_MERCHANT_RELEASE",
    "MERCHANT_RELEASE",
    "PENDING_RELEASE",
  ].includes((page.pendingStatus || "").toUpperCase());
  // `releaseReady` is the backend's own verdict — the exact condition
  // adminReleasePage enforces. Prefer it; the local derivation stays as a
  // fallback for a page fetched before the field existed.
  const confirmed =
    page.releaseReady ?? (!!page.customerConfirmedAtMs || releaseReadyStage);
  const alreadyDone = ["PROCESSED", "COMPLETED"].includes(status);
  // Release sends the money. Only MANUAL pages the sub-agent has confirmed,
  // not yet released, not already paid/failed.
  const canRelease =
    page.releaseMethod === "MANUAL" &&
    confirmed &&
    !page.releasedAt &&
    !alreadyDone &&
    !isFailure;

  return (
    <div className="space-y-3">
      <div className="bg-[#12151A] border border-[#242B35] rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#B93DEB] flex items-center gap-1.5">
            <CreditCard size={12} /> Breeze Payout Details
          </p>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-white disabled:opacity-50"
          >
            <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
        <Row label="Payout Method" value={prettyMethod(page.payoutMethod)} />
        {page.walletAddress && (
          <Row label="Crypto Wallet" value={page.walletAddress} />
        )}
        {page.bankAccountLast4 && (
          <Row label="Bank ····" value={page.bankAccountLast4} />
        )}
        {page.cardLast4 && <Row label="Card ····" value={page.cardLast4} />}
        <Row label="Page Status" value={page.status} />
        <Row
          label="Release"
          value={
            page.releaseMethod === "AUTOMATIC"
              ? "Automatic (under auto-release threshold)"
              : "Manual (admin releases)"
          }
        />
        {page.pendingStatus && !alreadyDone && (
          <Row label="Stage" value={prettyMethod(page.pendingStatus)} />
        )}
        <Row label="Details Confirmed" value={confirmed ? "Yes" : "No"} />
        <Row label="Released" value={page.releasedAt ? "Yes" : "No"} />
        {page.url && (
          <a
            href={page.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[#B93DEB] hover:underline text-xs pt-1"
          >
            <ExternalLink size={12} /> Open hosted page
          </a>
        )}
      </div>

      {canRelease && (
        <button
          onClick={handleRelease}
          disabled={releasing}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#B93DEB] hover:bg-[#A32DD4] text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-60"
        >
          {releasing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Send size={14} />
          )}
          Release Breeze Payout
        </button>
      )}

      {isFailure ? (
        <div className="bg-red-500/5 border border-red-500/25 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-red-400">
              Payout Failed
            </p>
            <p className="text-[11px] text-red-300/90 mt-0.5">
              Breeze reported status <b>{page.status}</b>
              {page.pendingStatus ? ` (${prettyMethod(page.pendingStatus)})` : ""}.
              Reject this request so the funds return to the sub-agent's
              withdrawable balance, then ask them to retry.
            </p>
          </div>
        </div>
      ) : alreadyDone ? (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 flex items-start gap-2">
          <Clock size={13} className="text-emerald-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-emerald-300/90">
            Breeze has paid this payout
            {page.releaseMethod === "AUTOMATIC"
              ? " automatically — it was at or under the auto-release threshold, so no admin approval was needed."
              : "."}{" "}
            The request is completed.
          </p>
        </div>
      ) : (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 flex items-start gap-2">
          <Clock size={13} className="text-blue-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-blue-300/90">
            After you approve &amp; release, Breeze processes the payout within a
            few business days. The status updates automatically when complete.
          </p>
        </div>
      )}
    </div>
  );
}
