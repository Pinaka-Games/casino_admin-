"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Coins,
  AlertTriangle,
  Clock,
  RefreshCw,
  Send,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  agentCoinflowApi,
  AgentCoinflowPayout,
} from "@/api/agent-payment/agent-coinflow.api";
import {
  PAYOUT_SPEED_INFO,
  speedLabel,
  type CoinflowWithdrawSpeed,
} from "@/app/agent-management/components/coinflow-payout-rails";

const FAILURE_STATUSES = ["FAILED", "REFUNDED", "CANCELED", "CANCELLED"];
const DONE_STATUSES = ["PROCESSED", "PROCESSING", "COMPLETED"];

const prettyMethod = (m?: string | null) => {
  if (!m) return "Not linked yet";
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
 * Shows the Coinflow hosted-payout destination a sub-agent linked (bank / card /
 * on-chain wallet), the live status, and a "Release Payout" action that sends the
 * money via the delegated merchant payout. Mirrors {@link BreezePayoutInfo}; used
 * inside the admin payout review modal.
 */
export function CoinflowPayoutInfo({
  requestId,
  onReleased,
}: {
  requestId: string;
  onReleased?: () => void;
}) {
  const [payout, setPayout] = useState<AgentCoinflowPayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [releasing, setReleasing] = useState(false);

  const handleRefresh = async () => {
    if (!payout) return;
    try {
      setRefreshing(true);
      const res = await agentCoinflowApi.adminRefresh(payout.id);
      setPayout(res.data);
      toast.success("Coinflow status refreshed");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  // Send the money — delegated merchant payout to the linked destination.
  const handleRelease = async () => {
    if (!payout) return;
    try {
      setReleasing(true);
      const res = await agentCoinflowApi.adminRelease(payout.id);
      setPayout(res.data);
      toast.success("Coinflow payout released — funds are being sent.");
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
    agentCoinflowApi
      .getByRequest(requestId)
      .then((res) => {
        if (active) setPayout(res.data);
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
        <Loader2 size={13} className="animate-spin" /> Loading Coinflow payout details…
      </div>
    );
  }

  if (notFound || !payout) {
    return (
      <div className="text-xs text-gray-500 bg-[#12151A] p-4 rounded-lg border border-[#242B35]">
        Recipient hasn&apos;t linked a Coinflow payout method yet — no details submitted.
      </div>
    );
  }

  const status = (payout.status || "").toUpperCase();
  const isFailure = FAILURE_STATUSES.includes(status);
  const confirmed = !!payout.customerConfirmedAtMs;
  const alreadyDone = DONE_STATUSES.includes(status);
  // Release sends the money. Only MANUAL payouts the recipient has linked, not
  // yet released, not already paid/failed.
  const canRelease =
    payout.releaseMethod === "MANUAL" &&
    confirmed &&
    !payout.releasedAt &&
    !alreadyDone &&
    !isFailure;

  return (
    <div className="space-y-3">
      <div className="bg-[#12151A] border border-[#242B35] rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-400 flex items-center gap-1.5">
            <Coins size={12} /> Coinflow Payout Details
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
        <Row label="Payout Method" value={prettyMethod(payout.payoutMethod)} />
        {payout.payoutSpeed && (
          // Which rail the release will use — the requester picks it in the
          // payout picker, and only a bank account offers more than one.
          <Row
            label="Speed"
            value={`${speedLabel(payout.payoutSpeed)}${
              PAYOUT_SPEED_INFO[payout.payoutSpeed as CoinflowWithdrawSpeed]
                ? ` · ${PAYOUT_SPEED_INFO[payout.payoutSpeed as CoinflowWithdrawSpeed].rail}`
                : ""
            }`}
          />
        )}
        {payout.last4 && <Row label="Account ····" value={payout.last4} />}
        {payout.walletAddress && (
          <Row label="Wallet" value={payout.walletAddress} />
        )}
        <Row label="Payout Status" value={payout.status} />
        <Row label="Details Confirmed" value={confirmed ? "Yes" : "No"} />
        <Row label="Released" value={payout.releasedAt ? "Yes" : "No"} />
        {payout.coinflowSessionId && (
          <Row label="Withdrawal ID" value={payout.coinflowSessionId} />
        )}
      </div>

      {canRelease && (
        <button
          onClick={handleRelease}
          disabled={releasing}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black text-xs font-black uppercase tracking-wider transition-all disabled:opacity-60"
        >
          {releasing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Send size={14} />
          )}
          Release Coinflow Payout
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
              Coinflow reported status <b>{payout.status}</b>. Reject this request
              so the funds return to the sub-agent&apos;s withdrawable balance,
              then ask them to retry.
            </p>
          </div>
        </div>
      ) : !confirmed ? (
        <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-3 flex items-start gap-2">
          <Clock size={13} className="text-orange-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-orange-300/90">
            Recipient must link a bank account, debit card or wallet on the
            Coinflow page before you can release the payout.
          </p>
        </div>
      ) : (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 flex items-start gap-2">
          <Clock size={13} className="text-blue-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-blue-300/90">
            After you release, Coinflow processes the payout to the linked
            destination. The status updates automatically when complete.
          </p>
        </div>
      )}
    </div>
  );
}
