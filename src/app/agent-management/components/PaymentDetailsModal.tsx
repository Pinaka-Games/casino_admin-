"use client";

import { useEffect, useState } from "react";
import { X, Loader2, CreditCard, Coins } from "lucide-react";
import toast from "react-hot-toast";
import { AgentPaymentRequest } from "@/api/agent-payment/agent-payment.api";
import { agentBreezeApi } from "@/api/agent-payment/agent-breeze.api";
import {
  agentCoinflowApi,
  AgentCoinflowPayout,
} from "@/api/agent-payment/agent-coinflow.api";
import { CoinflowLinkWaiter } from "./CoinflowLinkWaiter";
import { usePaymentAvailability } from "@/hooks/use-payment-availability";

interface Props {
  request: AgentPaymentRequest;
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

type Provider = "BREEZE" | "COINFLOW";
type Step = "PROVIDER" | "BREEZE" | "COINFLOW";

// The requester already picked Breeze/Coinflow when they created the request, so
// re-prompting "choose a payment method" here is wrong. The provider is recorded
// in the note tag (`[BREEZE]`/`[COINFLOW]`) and, for direct agents, in
// paymentDetails.provider — recover it so we can jump straight to that provider's
// hosted payout page.
function resolveLockedProvider(request: AgentPaymentRequest): Provider | null {
  const tag = /\[(BREEZE|COINFLOW)\]/i.exec(request.note ?? "")?.[1]?.toUpperCase();
  if (tag === "BREEZE" || tag === "COINFLOW") return tag;
  const p = (request.paymentDetails as any)?.provider;
  if (p === "BREEZE" || p === "COINFLOW") return p;
  return null;
}

const initialStep = (locked: Provider | null): Step =>
  locked === "COINFLOW" ? "COINFLOW" : locked === "BREEZE" ? "BREEZE" : "PROVIDER";

export function PaymentDetailsModal({ request, isOpen, onClose, onSubmitted }: Props) {
  const lockedProvider = resolveLockedProvider(request);

  // Initialise straight on the chosen provider's step so the chooser never even
  // flashes (the modal mounts fresh per request). The effect below re-syncs if
  // the request changes while the modal stays mounted.
  const [step, setStep] = useState<Step>(initialStep(lockedProvider));
  const [submitting, setSubmitting] = useState(false);
  // Hosted Breeze payout URL — shown as a clickable fallback if the popup is blocked
  const [breezeUrl, setBreezeUrl] = useState<string | null>(null);
  // Coinflow now opens in its own tab (same as Breeze) instead of an iframe, so
  // the payout is created here and <CoinflowLinkWaiter /> handles open + confirm.
  const [coinflowPayout, setCoinflowPayout] =
    useState<AgentCoinflowPayout | null>(null);
  const [coinflowError, setCoinflowError] = useState<string | null>(null);
  // Only reached when the request carries no locked provider (the chooser step).
  // Gateways the admin disabled for agent payouts are not offered here either.
  const payoutAvailability = usePaymentAvailability("agent", "payout");

  useEffect(() => {
    if (!isOpen) return;
    setBreezeUrl(null);
    setCoinflowPayout(null);
    setCoinflowError(null);
    setStep(initialStep(lockedProvider));
  }, [isOpen, request.id, lockedProvider]);

  // Mint (or reuse) the hosted Coinflow payout as soon as we land on that step.
  useEffect(() => {
    if (!isOpen || step !== "COINFLOW" || coinflowPayout) return;
    let alive = true;
    agentCoinflowApi
      .createPayout(request.id)
      .then((res) => {
        if (alive) setCoinflowPayout(res.data);
      })
      .catch((err: any) => {
        if (alive)
          setCoinflowError(
            err?.response?.data?.message || "Failed to start Coinflow payout",
          );
      });
    return () => {
      alive = false;
    };
  }, [isOpen, step, request.id, coinflowPayout]);

  if (!isOpen) return null;

  // Create the hosted Breeze payout page and open it. We do NOT submit payment
  // details here — doing so would push the request to PENDING_ADMIN before the
  // agent enters anything, so closing the form would "submit" an empty request.
  // The request is promoted to PENDING_ADMIN server-side only once Breeze
  // confirms a linked method (via the return bridge / webhook). The popup is
  // opened synchronously inside the click gesture so the browser popup-blocker
  // doesn't kill it; if it's blocked we fall back to a clickable link (breezeUrl).
  const startBreeze = async () => {
    const popup = window.open("about:blank", "_blank");
    try {
      setSubmitting(true);
      const pageRes = await agentBreezeApi.createPage(request.id);
      const url = pageRes.data?.url;
      if (url) {
        if (popup && !popup.closed) {
          popup.location.href = url;
        } else {
          // Popup was blocked — surface a clickable link instead
          setBreezeUrl(url);
        }
        toast.success("Breeze payout page ready. Complete your payment details there.");
        onSubmitted();
      } else {
        if (popup && !popup.closed) popup.close();
        toast.error("Breeze payout page created but no URL returned.");
      }
    } catch (err: any) {
      if (popup && !popup.closed) popup.close();
      toast.error(err?.response?.data?.message || "Failed to start Breeze payout");
    } finally {
      setSubmitting(false);
    }
  };

  const amount = Number(request.amount).toFixed(2);
  const isCoinflow = step === "COINFLOW";
  const maxWidth = isCoinflow ? "max-w-2xl" : "max-w-md";

  return (
    <div className="fixed inset-0 z-[1000] flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div
        className={`bg-[#191D24] w-full ${maxWidth} rounded-lg border border-white/5 shadow-2xl overflow-hidden relative animate-in zoom-in-90 duration-300 max-h-[92dvh] overflow-y-auto`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
        >
          <X size={18} />
        </button>

        {breezeUrl ? (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
            <div>
              <p className="text-[10px] font-bold uppercase text-[#B93DEB] mb-2">
                Breeze
              </p>
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">
                Open your payment page
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Your browser blocked the popup. Click below to open the Breeze
                page and enter your bank / card / crypto details.
              </p>
            </div>
            <a
              href={breezeUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                onSubmitted();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-[#B93DEB] hover:bg-[#A32DD4] text-white text-sm font-bold uppercase tracking-wider transition-all"
            >
              <CreditCard size={16} /> Open Breeze Payment Page
            </a>
            <button
              onClick={onClose}
              className="w-full py-2 text-xs font-bold text-gray-500 hover:text-gray-300"
            >
              I'll do it later
            </button>
          </div>
        ) : step === "BREEZE" ? (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
            <div>
              <p className="text-[10px] font-bold uppercase text-[#B93DEB] mb-2">
                Breeze · Agent Approved
              </p>
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">
                Open your payment page
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Continue to Breeze to enter your bank / card / crypto details.
                Amount: <span className="text-white font-semibold">{amount}</span>
              </p>
            </div>
            <button
              onClick={startBreeze}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-[#B93DEB] hover:bg-[#A32DD4] text-white text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CreditCard size={16} />
              )}
              Continue to Breeze Payment Page
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-xs font-bold text-gray-500 hover:text-gray-300"
            >
              I'll do it later
            </button>
          </div>
        ) : step === "COINFLOW" ? (
          <div className="p-4 sm:p-6">
            <CoinflowLinkWaiter
              payoutId={coinflowPayout?.id ?? null}
              url={coinflowPayout?.url ?? null}
              amount={Number(request.amount)}
              onConfirmed={() => {
                onSubmitted();
                onClose();
              }}
              onClose={onClose}
            />
            {coinflowError && (
              <p className="mt-3 text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-md p-3">
                {coinflowError}
              </p>
            )}
          </div>
        ) : (
          // Fallback chooser — only reached if no provider was recorded on the
          // request. Both providers open their own hosted page.
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
            <div>
              <p className="text-[10px] font-bold uppercase text-[#B93DEB] mb-2">
                Agent Approved
              </p>
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">
                Choose a payment method
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Select how you would like to receive this payout. Amount:{" "}
                <span className="text-white font-semibold">{amount}</span>
              </p>
            </div>

            {payoutAvailability.breeze && (
            <button
              onClick={startBreeze}
              disabled={submitting}
              className="w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-[#B93DEB]/10 hover:border-[#B93DEB]/40 transition-all text-left disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#B93DEB]/20 border border-[#B93DEB]/30 flex items-center justify-center">
                  <CreditCard size={18} className="text-[#B93DEB]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Breeze</p>
                  <p className="text-[11px] text-gray-500">
                    Card, Apple Pay, Google Pay, or crypto
                  </p>
                </div>
              </div>
              <span className="text-[#B93DEB] text-sm font-bold flex items-center gap-1">
                {submitting && <Loader2 size={14} className="animate-spin" />}
                Continue
              </span>
            </button>
            )}

            {payoutAvailability.coinflow && (
            <button
              onClick={() => setStep("COINFLOW")}
              disabled={submitting}
              className="w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-yellow-500/10 hover:border-yellow-500/40 transition-all text-left disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center">
                  <Coins size={18} className="text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Coinflow</p>
                  <p className="text-[11px] text-gray-500">
                    Bank, debit card, or on-chain wallet
                  </p>
                </div>
              </div>
              <span className="text-yellow-400 text-sm font-bold">Continue</span>
            </button>
            )}

            {!payoutAvailability.breeze && !payoutAvailability.coinflow && (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                Payouts are temporarily unavailable. Please check back shortly.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
