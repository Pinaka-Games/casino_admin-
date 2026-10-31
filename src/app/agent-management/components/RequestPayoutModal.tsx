"use client";

import { useEffect, useState } from "react";
import { X, Loader2, Wallet, CreditCard, Coins, ArrowLeft, Lock } from "lucide-react";
import toast from "react-hot-toast";
import { agentBreezeApi } from "@/api/agent-payment/agent-breeze.api";
import { agentCoinflowApi } from "@/api/agent-payment/agent-coinflow.api";
import {
  agentPaymentApi,
  PayoutLockState,
} from "@/api/agent-payment/agent-payment.api";
import { CoinflowLinkWaiter } from "./CoinflowLinkWaiter";
import { usePaymentAvailability } from "@/hooks/use-payment-availability";

/** "2h 5m" / "45s" — matches the wording of the server-side lock error. */
const formatRemaining = (seconds: number) => {
  const total = Math.max(0, Math.ceil(seconds));
  if (total < 60) return `${total}s`;
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return (
    [days && `${days}d`, hours && `${hours}h`, minutes && `${minutes}m`]
      .filter(Boolean)
      .join(" ") || `${total}s`
  );
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  maxAmount?: number;
}

/**
 * Shown on both steps while the admin payout lock is running, so the reason a
 * payout cannot be started is visible before the provider is even picked.
 */
function PayoutLockBanner({ remainingSec }: { remainingSec: number }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <Lock size={16} className="mt-0.5 shrink-0 text-amber-300" />
      <div>
        <p className="text-sm font-bold text-amber-200">Payout locked</p>
        <p className="text-[11px] text-amber-300/80">
          A payout lock is active on your account after your last payout. You can
          request your next payout in {formatRemaining(remainingSec)}.
        </p>
      </div>
    </div>
  );
}

type Provider = "BREEZE" | "COINFLOW";
// COINFLOW_TAB → hosted Coinflow form opened in a new tab (same as Breeze), for
// BOTH direct agents and sub-agents. The modal stays on this step only to run
// the confirm poll, because Coinflow links the destination solely through
// POST payouts/:id/confirm — there's no return bridge or webhook for it.
type Step = "PROVIDER" | "AMOUNT" | "COINFLOW_TAB";

/**
 * Provider floors. Breeze rejects pages < 100 minor units; Coinflow accepts
 * the claim but refuses to RELEASE below 3.00 (it then sat "Awaiting Admin"
 * for good). The backend enforces both (AGENT_COINFLOW_MIN_PAYOUT overrides
 * Coinflow's) — this only spares the round-trip.
 */
const MIN_PAYOUT: Record<string, number> = { BREEZE: 1, COINFLOW: 3 };

export function RequestPayoutModal({ isOpen, onClose, onCreated, maxAmount }: Props) {
  const [step, setStep] = useState<Step>("PROVIDER");
  const [provider, setProvider] = useState<Provider>("BREEZE");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Coinflow: the hosted page lives in another tab, so keep the payout id + url
  // here to run the confirm poll and to re-open the tab. Set for both flows —
  // sub-agents bind to an existing request, direct agents to a draft payout.
  const [coinflowPayoutId, setCoinflowPayoutId] = useState<string | null>(null);
  const [coinflowUrl, setCoinflowUrl] = useState<string | null>(null);
  // Only gateways the admin enabled for AGENT payouts (Settings → Payment
  // Manager) are offered. The request is refused server-side as well, so this
  // is presentation rather than the gate itself.
  const payoutAvailability = usePaymentAvailability("agent", "payout");
  // The admin payout lock (Payout/Days Settings → "Payout Lock"). The server
  // refuses a locked request outright — this is so the requester sees WHY and
  // how long is left, instead of clicking through the provider chooser and
  // collecting an error after the popup is already open.
  const [payoutLock, setPayoutLock] = useState<PayoutLockState | null>(null);
  const [lockNow, setLockNow] = useState(Date.now());

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    agentPaymentApi
      .myPayoutLock()
      .then((res) => {
        if (!cancelled) setPayoutLock(res.data);
      })
      // A failed lock read must not block a payout — the server is still the
      // gate, so fall through to the normal flow and let it decide.
      .catch(() => {
        if (!cancelled) setPayoutLock(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Ticks the countdown so the banner clears itself the moment the lock lapses.
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setInterval(() => setLockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isOpen]);

  const lockRemainingSec =
    payoutLock?.locked && payoutLock.lockedUntil
      ? Math.max(
          0,
          Math.ceil((new Date(payoutLock.lockedUntil).getTime() - lockNow) / 1000),
        )
      : 0;
  const isPayoutLocked = Boolean(payoutLock?.locked) && lockRemainingSec > 0;

  if (!isOpen) return null;

  const resetAndClose = () => {
    setStep("PROVIDER");
    setProvider("BREEZE");
    setAmount("");
    setNote("");
    setCoinflowPayoutId(null);
    setCoinflowUrl(null);
    onClose();
  };

  const validateAmount = (): number | null => {
    const n = Number(amount);
    if (!n || n <= 0) {
      toast.error("Enter a valid amount");
      return null;
    }
    // Provider minimum, before the popup opens (see MIN_PAYOUT).
    const min = MIN_PAYOUT[provider];
    if (min && n < min) {
      const name = provider === "BREEZE" ? "Breeze" : "Coinflow";
      toast.error(
        `Minimum ${name} payout is ${min.toFixed(2)}. Enter ${min.toFixed(2)} or more${
          provider === "COINFLOW" ? ", or choose Breeze" : ""
        }.`,
      );
      return null;
    }
    if (n < 0.01) {
      toast.error("Minimum payout is 0.01");
      return null;
    }
    // Validate against available balance BEFORE opening any hosted page.
    // Every payout now opens a Breeze/Coinflow draft that the server only turns
    // into a payout request if it can freeze the amount from the withdrawable
    // balance — so a draft that exceeds it silently fails to materialize. Block
    // here (and require a loaded balance) so nobody opens an unfundable page.
    const balanceKnown =
      typeof maxAmount === "number" && Number.isFinite(maxAmount);
    if (!balanceKnown) {
      toast.error("Balance not loaded yet. Please reopen and try again.");
      return null;
    }
    if (balanceKnown && n > (maxAmount as number)) {
      toast.error(`Insufficient balance. Available: ${(maxAmount as number).toFixed(2)}`);
      return null;
    }
    return n;
  };

  // Provider-tagged note so the request (created later, once details exist) keeps
  // the same `[BREEZE]`/`[COINFLOW]` convention used elsewhere.
  const composedNote = note ? `[${provider}] ${note}` : `[${provider}]`;

  const handleSubmit = async () => {
    // Checked before validateAmount opens anything: a locked requester must not
    // get as far as the popup, which is claimed inside the click gesture below
    // and cannot be reopened after an await.
    if (isPayoutLocked) {
      toast.error(
        `Payout locked — you can request your next payout in ${formatRemaining(lockRemainingSec)}.`,
      );
      return;
    }

    const n = validateAmount();
    if (n === null) return;

    // The server creates the payout request (and holds the amount) as soon as
    // the hosted page opens; it stays "Awaiting Payment Details" — and cannot be
    // released by an admin — until the payee finishes the form. An unfinished
    // claim can be cancelled from the dashboard banner, and is returned
    // automatically after an hour.
    // Popup claimed inside the click gesture for BOTH providers — after an
    // await the browser blocks it.
    const popup = window.open("about:blank", "_blank");

    if (provider === "COINFLOW") {
      // Draft page: no request exists until confirm() links a real destination,
      // so abandoning the tab leaves nothing behind. Opens in a new tab like
      // Breeze instead of an embedded iframe.
      try {
        setSubmitting(true);
        const payout = (
          await agentCoinflowApi.createDraftPayout(n, { note: composedNote })
        ).data;
        const cfUrl = payout?.url ?? null;
        setCoinflowPayoutId(payout?.id ?? null);
        setCoinflowUrl(cfUrl);
        // The request (and the hold) exists from this moment — refresh the
        // dashboard now, not only after confirm, or the "Add Payment Details"
        // banner and the open-request guard lag behind.
        onCreated();

        if (cfUrl && popup && !popup.closed) popup.location.href = cfUrl;
        else if (popup && !popup.closed) popup.close();

        // Stay open on the waiter: Coinflow only attaches the destination via
        // confirm(), which for a draft is also what creates the request.
        setStep("COINFLOW_TAB");
      } catch (err: any) {
        if (popup && !popup.closed) popup.close();
        toast.error(
          err?.response?.data?.message || "Failed to start Coinflow payout",
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // BREEZE — open a draft hosted page (no request yet). The request is
    // materialized server-side when Breeze reports the payee linked a method.
    try {
      setSubmitting(true);
      const url = (await agentBreezeApi.createDraftPage(n, { note: composedNote }))
        .data?.url;
      if (url) {
        if (popup && !popup.closed) popup.location.href = url;
        else window.open(url, "_blank");
        toast.success(
          "Breeze page ready — enter your payout details there to submit the request.",
        );
        onCreated();
        resetAndClose();
      } else {
        if (popup && !popup.closed) popup.close();
        toast.error("Breeze payout page created but no URL returned.");
      }
    } catch (err: any) {
      if (popup && !popup.closed) popup.close();
      toast.error(
        err?.response?.data?.message || "Failed to start Breeze payout",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div
        // Wider on the Coinflow step: that one carries the destination list and
        // the speed grid, which are cramped at the chooser's width.
        className={`bg-[#191D24] w-full ${
          step === "COINFLOW_TAB" ? "max-w-2xl" : "max-w-md"
        } rounded-lg border border-white/5 shadow-2xl overflow-hidden relative animate-in zoom-in-90 duration-300 max-h-[92dvh] overflow-y-auto`}
      >
        <button
          onClick={resetAndClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
        >
          <X size={18} />
        </button>

        {step === "COINFLOW_TAB" ? (
          <div className="p-4 sm:p-6">
            <CoinflowLinkWaiter
              payoutId={coinflowPayoutId}
              url={coinflowUrl}
              amount={Number(amount)}
              openedAutomatically
              onConfirmed={() => {
                onCreated();
                resetAndClose();
              }}
              onClose={() => {
                onCreated();
                resetAndClose();
              }}
            />
          </div>
        ) : step === "PROVIDER" ? (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#B93DEB]/15 border border-[#B93DEB]/30 flex items-center justify-center">
                <Wallet size={18} className="text-[#B93DEB]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white uppercase tracking-tight">
                  Choose a payment method
                </h3>
                <p className="text-[11px] text-gray-500">
                  Select how you would like to receive your payout.
                </p>
              </div>
            </div>

            {isPayoutLocked && <PayoutLockBanner remainingSec={lockRemainingSec} />}

            {payoutAvailability.breeze && (
            <button
              onClick={() => {
                setProvider("BREEZE");
                setStep("AMOUNT");
              }}
              className="w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-[#B93DEB]/10 hover:border-[#B93DEB]/40 transition-all text-left"
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
              <span className="text-[#B93DEB] text-sm font-bold">Continue</span>
            </button>
            )}

            {payoutAvailability.coinflow && (
            <button
              onClick={() => {
                setProvider("COINFLOW");
                setStep("AMOUNT");
              }}
              className="w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-yellow-500/10 hover:border-yellow-500/40 transition-all text-left"
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
        ) : (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStep("PROVIDER")}
                className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
              >
                <ArrowLeft size={14} />
              </button>
              <div>
                <p className="text-[10px] font-bold uppercase text-[#B93DEB]">
                  {provider}
                </p>
                <h3 className="text-lg font-bold text-white uppercase tracking-tight">
                  Request Payout
                </h3>
                {/* The request is raised only once the payout method is
                    submitted — say so, so nobody closes the next step thinking
                    the claim is already in. */}
                <p className="text-[11px] text-gray-500">
                  {provider === "COINFLOW"
                    ? "Next: link your bank / card / wallet and pick where the money goes. Your request is raised when you submit it."
                    : "Next: enter your payout details on the Breeze page. Your request is raised once they are submitted."}
                </p>
              </div>
            </div>

            <label className="block">
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Amount
                  {MIN_PAYOUT[provider] && (
                    <span className="ml-2 normal-case tracking-normal font-semibold text-gray-600">
                      Min: {MIN_PAYOUT[provider].toFixed(2)}
                    </span>
                  )}
                </span>
                {typeof maxAmount === "number" && maxAmount > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(maxAmount))}
                    className="text-[10px] font-bold text-[#B93DEB] uppercase tracking-wider hover:underline"
                  >
                    Max: {maxAmount.toFixed(2)}
                  </button>
                )}
              </div>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="mt-1 w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-lg text-lg font-bold text-white placeholder-gray-600 focus:outline-none focus:border-[#B93DEB] focus:ring-1 focus:ring-[#B93DEB]/30 transition-all"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Note (optional)
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="mt-1 w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#B93DEB] focus:ring-1 focus:ring-[#B93DEB]/30 transition-all resize-none"
              />
            </label>

            {isPayoutLocked && <PayoutLockBanner remainingSec={lockRemainingSec} />}

            <button
              onClick={handleSubmit}
              disabled={submitting || isPayoutLocked}
              className="w-full py-3 rounded-lg bg-[#B93DEB] hover:bg-[#A32DD4] text-white font-bold uppercase text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {isPayoutLocked
                ? `Locked — ${formatRemaining(lockRemainingSec)} left`
                : submitting
                  ? "Submitting"
                  : provider === "BREEZE"
                    ? "Continue to Breeze Details"
                    : "Continue to Coinflow Method"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
