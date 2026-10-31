"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Coins, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import {
  agentCoinflowApi,
  AgentCoinflowPayout,
} from "@/api/agent-payment/agent-coinflow.api";

// Embeds Coinflow's hosted Bank Authentication / Withdraw UI. Inside the iframe
// the requester completes KYC and links a payout destination — a bank account,
// debit card, or on-chain wallet. They only need to LINK a destination (not run
// a self-withdrawal, which would show "Withdraw up to 0.00" since they hold no
// Coinflow balance). Once linked, "Continue" captures the destination via Get
// Withdrawer (backend) and the admin releases the funds via the delegated
// merchant payout. Mirrors the user-side CoinflowPayoutEmbed.

interface Props {
  // Omit for the direct-agent "draft" flow: the hosted page opens without an
  // agent payment request, and the request is created on confirm. Pass it for
  // the sub-agent flow where the approved request already exists.
  requestId?: string;
  amount: number;
  note?: string;
  onConfirmed: () => void;
}

function parseMethod(data: unknown): string | null {
  try {
    if (typeof data === "string") {
      return data.includes("accountLinked")
        ? (JSON.parse(data) as { method?: string })?.method ?? null
        : null;
    }
    if (data && typeof data === "object" && "method" in data) {
      return (data as { method?: string }).method ?? null;
    }
  } catch {
    /* non-JSON message — ignore */
  }
  return null;
}

export function AgentCoinflowPayoutEmbed({ requestId, amount, note, onConfirmed }: Props) {
  const [payout, setPayout] = useState<AgentCoinflowPayout | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Bumping this remounts the iframe so a fresh Coinflow form loads — used to
  // recover from in-iframe validation errors like "Invalid state".
  const [reloadKey, setReloadKey] = useState(0);
  const handledRef = useRef(false);

  // Reload the hosted form from scratch (clears any half-filled / invalid
  // address or card the user entered) so they can re-enter details correctly.
  const resetForm = () => {
    handledRef.current = false;
    setSubmitting(false);
    setReloadKey((k) => k + 1);
  };

  // Create (or reuse) the hosted payout page. With a requestId we bind to an
  // existing request (sub-agent flow); without one we open a draft page and the
  // request is created later on confirm (direct-agent flow).
  useEffect(() => {
    let alive = true;
    setLoadError(null);
    const create = requestId
      ? agentCoinflowApi.createPayout(requestId)
      : agentCoinflowApi.createDraftPayout(amount, { note });
    create
      .then((res) => {
        if (alive) setPayout(res.data);
      })
      .catch((err: any) => {
        if (alive)
          setLoadError(
            err?.response?.data?.message || "Failed to start Coinflow payout",
          );
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  const payoutId = payout?.id ?? null;
  const baseUrl = payout?.url ?? null;
  const src =
    baseUrl && typeof window !== "undefined"
      ? `${baseUrl}&origins=${encodeURIComponent(
          JSON.stringify([window.location.origin]),
        )}`
      : baseUrl;

  const captureLinkedAccount = async () => {
    if (handledRef.current || !payoutId) return;
    handledRef.current = true;
    setSubmitting(true);
    try {
      await agentCoinflowApi.confirm(payoutId, {});
      toast.success("Payout method submitted. Awaiting admin release.");
      onConfirmed();
    } catch (err: any) {
      handledRef.current = false;
      setSubmitting(false);
      toast.error(
        err?.response?.data?.message ||
          "We couldn't find a linked payout method yet. Finish the steps above (identity + bank/card/wallet), then press Continue.",
      );
    }
  };

  // Auto-capture when Coinflow signals a successful link.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: MessageEvent) => {
      try {
        if (!/coinflow\.cash$/.test(new URL(event.origin).hostname)) return;
      } catch {
        return;
      }
      if (parseMethod(event.data) === "accountLinked") {
        void captureLinkedAccount();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payoutId]);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center shrink-0">
          <Coins size={16} className="text-yellow-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-white uppercase tracking-tight">
            Add your Coinflow payout method
          </h3>
          <p className="text-[11px] text-gray-500">
            Link a bank account, debit card, or wallet to receive{" "}
            <span className="text-white font-semibold">
              {Number(amount).toFixed(2)}
            </span>
            . Then press Continue — you don&apos;t need to finish a withdrawal.
          </p>
        </div>
        {src && !loadError && (
          <button
            type="button"
            onClick={resetForm}
            title="Clear the form and start over"
            className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-[10px] font-bold uppercase tracking-wider transition-all"
          >
            <RotateCcw size={12} /> Reset
          </button>
        )}
      </div>

      {loadError ? (
        <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-md p-3">
          {loadError}
        </div>
      ) : !src ? (
        <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
          <Loader2 size={26} className="animate-spin text-yellow-400" />
          <span className="text-[11px] uppercase">
            Loading Coinflow…
          </span>
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden border border-white/10 bg-white">
          <iframe
            key={`coinflow-${reloadKey}`}
            src={src}
            title="Coinflow payout details"
            className="w-full border-0 bg-white h-[70dvh] min-h-[360px] sm:h-[460px]"
            style={{ display: "block", width: "100%" }}
            allow="payment; clipboard-write; camera; geolocation"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      )}

      {src && !loadError && (
        <p className="mt-2 text-[10px] text-gray-500 text-center">
          Saw an error like &quot;Invalid state&quot; or a wrong card/address?
          Press{" "}
          <button
            type="button"
            onClick={resetForm}
            className="text-yellow-400 hover:underline font-bold"
          >
            Reset
          </button>{" "}
          to clear the form and enter your details again.
        </p>
      )}

      {src && !loadError && (
        <button
          type="button"
          disabled={submitting}
          onClick={() => void captureLinkedAccount()}
          className="mt-4 w-full py-3 rounded-lg bg-[#B93DEB] hover:bg-[#A32DD4] text-white font-bold uppercase text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          {submitting ? "Submitting" : "Continue — I've added my payout method"}
        </button>
      )}
      <p className="mt-2 text-center text-[10px] text-gray-500">
        Powered by Coinflow. Funds are released by admin to your linked
        destination.
      </p>
    </div>
  );
}
