"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Coins,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  agentCoinflowApi,
  type AgentCoinflowPayoutMethod,
  type AgentCoinflowPayoutMethodsResponse,
} from "@/api/agent-payment/agent-coinflow.api";
import {
  AgentCoinflowPayoutMethodPicker,
  type AgentPayoutMethodSelection,
} from "./AgentCoinflowPayoutMethodPicker";
import { onCoinflowReturn } from "@/lib/coinflow-return";

/**
 * Agent / sub-agent Coinflow payout details.
 *
 * The hosted Coinflow page opens in a SEPARATE TAB, so there is no iframe to hear
 * from: this polls `payouts/:id/methods` until a destination shows up, then hands
 * over to the picker so the requester chooses WHICH destination gets paid and —
 * for a bank account — over which rail. `confirm` is sent only from that choice.
 * The tab does signal back when it lands on our return route (see
 * `lib/coinflow-return`), which only shortens the wait; the poll remains the
 * thing that must work.
 *
 * It used to poll `confirm` itself with an empty body, which let the backend take
 * whichever destination Coinflow listed first: a requester with a bank AND a card
 * was never asked, and every bank payout went out over the default ACH rail with
 * no way to pick same-day, RTP or wire. Same flow for both audiences — direct
 * agents (draft payout, request created on confirm) and sub-agents (payout bound
 * to an existing request).
 */

const POLL_INTERVAL_MS = 4000;
// ~10 minutes. Long enough for identity checks + linking a bank, short enough
// that an abandoned tab stops polling instead of running for the whole session.
const MAX_ATTEMPTS = 150;

interface Props {
  payoutId: string | null;
  url: string | null;
  amount: number;
  /** Called once the destination is confirmed and the request has been updated. */
  onConfirmed: () => void;
  onClose: () => void;
  /** True when the tab was already opened for the requester (post-claim flow). */
  openedAutomatically?: boolean;
}

/** What one read of the methods endpoint told us. */
interface MethodsProbe {
  methods: AgentCoinflowPayoutMethod[];
  verificationLink: string | null;
  error: string | null;
}

/**
 * How many of the destinations Coinflow returned can actually be paid to.
 *
 * A destination the requester dropped or replaced stays on the withdrawer flagged
 * unavailable — it belongs in the list (so they can re-link it) but it cannot
 * carry a payout, so it must not be what decides the picker is usable.
 */
function payableCount(methods: AgentCoinflowPayoutMethod[]): number {
  return methods.filter((m) => m.available !== false).length;
}

/** The message Coinflow/our API sent back, if it sent one we can show. */
function apiMessage(err: unknown): string | null {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? null
  );
}

function toProbe(data: AgentCoinflowPayoutMethodsResponse): MethodsProbe {
  return {
    methods: Array.isArray(data?.methods) ? data.methods : [],
    // Coinflow answered 451: nothing can be linked or paid until the requester
    // verifies, and this is the link Coinflow expects us to send them to.
    verificationLink: data?.verificationRequired
      ? (data?.verificationLink ?? null)
      : null,
    error: data?.error ?? null,
  };
}

export function CoinflowLinkWaiter({
  payoutId,
  url,
  amount,
  onConfirmed,
  onClose,
  openedAutomatically = false,
}: Props) {
  const [opened, setOpened] = useState(openedAutomatically);
  const [gaveUp, setGaveUp] = useState(false);
  // null = the first read has not landed yet.
  const [methods, setMethods] = useState<AgentCoinflowPayoutMethod[] | null>(
    null,
  );
  const [verificationLink, setVerificationLink] = useState<string | null>(null);
  // Set only when the lookup failed on OUR side (credentials, Coinflow down).
  // Kept apart from "nothing linked yet" so the requester is told to retry
  // rather than to add a method they may already have.
  const [lookupError, setLookupError] = useState<string | null>(null);
  // Set when the requester explicitly asks to link another destination, so the
  // open-the-page view stays up even though they already have one on file.
  const [addingAnother, setAddingAnother] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [removingToken, setRemovingToken] = useState<string | null>(null);
  const submittedRef = useRef(false);

  const openTab = () => {
    if (!url) return;
    window.open(url, "_blank");
    setOpened(true);
    setGaveUp(false);
  };

  // Deliberately does no setState of its own: every caller owns when the result
  // is applied, which keeps state updates out of effect bodies.
  const fetchMethods = useCallback(async (): Promise<MethodsProbe> => {
    if (!payoutId) return { methods: [], verificationLink: null, error: null };
    try {
      return toProbe((await agentCoinflowApi.getMethods(payoutId)).data);
    } catch (err) {
      // A refusal the API explained — Coinflow payouts switched off in Payment
      // Manager is the common one — is shown as-is. Sending someone to the
      // Coinflow page for that would waste their time on a payout the backend
      // will refuse anyway.
      const message = apiMessage(err);
      if (message) {
        return { methods: [], verificationLink: null, error: message };
      }
      // Anything else (a network blip) is treated as "nothing linked yet": the
      // Coinflow page is the safe place to leave the requester, and the poll
      // tries again.
      return { methods: [], verificationLink: null, error: null };
    }
  }, [payoutId]);

  const applyProbe = useCallback((probe: MethodsProbe) => {
    setMethods(probe.methods);
    setVerificationLink(probe.verificationLink);
    setLookupError(probe.error);
  }, []);

  // First read: a requester who linked a destination on an earlier request goes
  // straight to the picker instead of being sent to Coinflow again.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const probe = await fetchMethods();
      if (!cancelled) applyProbe(probe);
    })();
    return () => {
      cancelled = true;
    };
  }, [applyProbe, fetchMethods]);

  const showingLinkStep =
    addingAnother || methods === null || payableCount(methods) === 0;

  // The Coinflow tab tells us the moment the requester finishes linking, so the
  // picker appears at once instead of on the next four-second poll. It is only a
  // shortcut — the poll below still covers a tab that was closed early, opened
  // from somewhere else, or blocked from signalling.
  useEffect(
    () =>
      onCoinflowReturn(() => {
        if (submittedRef.current) return;
        void fetchMethods().then((probe) => {
          applyProbe(probe);
          if (payableCount(probe.methods) > 0) setAddingAnother(false);
          setGaveUp(false);
        });
      }),
    [applyProbe, fetchMethods],
  );

  // Poll while the requester is on the Coinflow page in the other tab. Read-only,
  // so it costs nothing until a destination appears.
  useEffect(() => {
    // `gaveUp` is a dependency so that clearing it (the "Check again" button)
    // restarts the poll rather than leaving a dead timer behind.
    if (!payoutId || !opened || !showingLinkStep || gaveUp) return;
    if (submittedRef.current) return;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      attempts += 1;
      const probe = await fetchMethods();
      if (stopped) return;
      applyProbe(probe);
      if (payableCount(probe.methods) > 0) {
        // Something is linked — the picker takes over from here.
        setAddingAnother(false);
        return;
      }
      if (probe.verificationLink) return; // Waiting on KYC, not on a link.
      if (attempts >= MAX_ATTEMPTS) {
        setGaveUp(true);
        return;
      }
      timer = setTimeout(() => void tick(), POLL_INTERVAL_MS);
    };

    timer = setTimeout(() => void tick(), POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [applyProbe, fetchMethods, payoutId, opened, showingLinkStep, gaveUp]);

  const handleRemove = useCallback(
    async (method: AgentCoinflowPayoutMethod) => {
      if (!payoutId || removingToken) return;
      setRemovingToken(method.token);
      try {
        // The endpoint answers with the refreshed list, so the picker updates
        // from Coinflow's own view rather than from a local guess.
        const res = await agentCoinflowApi.deleteMethod(payoutId, method.token);
        applyProbe(toProbe(res.data));
        toast.success(`${method.label} removed.`);
      } catch (err) {
        toast.error(
          apiMessage(err) ?? "We couldn't remove that payout method.",
        );
      } finally {
        setRemovingToken(null);
      }
    },
    [applyProbe, payoutId, removingToken],
  );

  const handleConfirm = useCallback(
    async ({ method, speed }: AgentPayoutMethodSelection) => {
      if (!payoutId || submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      try {
        const res = await agentCoinflowApi.confirm(payoutId, {
          account: method.token,
          payoutMethod: method.type,
          ...(speed ? { payoutSpeed: speed } : {}),
        });
        // Under the auto-approval threshold the backend releases it within this
        // same call — "awaiting admin release" was wrong for those. The final
        // "processed successfully" toast comes from PayoutStatusToaster.
        const sent = Boolean((res?.data as any)?.releasedAt);
        toast.success(
          sent
            ? "Payout method submitted — your payout is on its way."
            : "Payout method submitted. Awaiting approval and admin release.",
          { id: `agent-coinflow-submitted:${payoutId}` },
        );
        onConfirmed();
      } catch (err) {
        submittedRef.current = false;
        setSubmitting(false);
        toast.error(
          apiMessage(err) ??
            "We couldn't submit that payout method. Please try again.",
        );
      }
    },
    [onConfirmed, payoutId],
  );

  const header = (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center shrink-0">
        <Coins size={18} className="text-yellow-400" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase text-yellow-400">
          Coinflow
        </p>
        <h3 className="text-lg font-bold text-white uppercase tracking-tight">
          Add your payout method
        </h3>
      </div>
    </div>
  );

  // Coinflow answered 451 — nothing can be linked or paid until KYC is done.
  if (verificationLink) {
    return (
      <div className="space-y-4">
        {header}
        <div className="flex flex-col items-center gap-3 text-center py-2">
          <ShieldAlert size={30} className="text-amber-400" />
          <div>
            <p className="text-sm font-bold text-white">
              Verify your identity to continue
            </p>
            <p className="text-[11px] text-gray-500 mt-1">
              Coinflow needs to verify you before a payout method can be added.
              This usually takes a couple of minutes.
            </p>
          </div>
          <a
            href={verificationLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#B93DEB] hover:bg-[#A32DD4] text-white font-bold uppercase text-xs transition-all"
          >
            <ExternalLink size={14} /> Start verification
          </a>
          <button
            type="button"
            onClick={() => void fetchMethods().then(applyProbe)}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-white"
          >
            <RefreshCw size={12} /> I&apos;ve finished — check again
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-full py-2 text-xs font-bold text-gray-500 hover:text-gray-300"
        >
          I&apos;ll do it later
        </button>
      </div>
    );
  }

  // Our problem (credentials / Coinflow unreachable), not the requester's.
  // Telling them to "add a payout method" here would be a lie.
  if (lookupError) {
    return (
      <div className="space-y-4">
        {header}
        <p className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/25 rounded-lg p-3">
          {lookupError}
        </p>
        <button
          type="button"
          onClick={() => void fetchMethods().then(applyProbe)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold uppercase text-[10px] tracking-wider transition-all"
        >
          <RefreshCw size={13} /> Try again
        </button>
        <button
          onClick={onClose}
          className="w-full py-2 text-xs font-bold text-gray-500 hover:text-gray-300"
        >
          I&apos;ll do it later
        </button>
      </div>
    );
  }

  if (!showingLinkStep && methods) {
    return (
      <div className="space-y-4">
        <AgentCoinflowPayoutMethodPicker
          methods={methods}
          submitting={submitting}
          onConfirm={(selection) => void handleConfirm(selection)}
          onAddAnother={() => {
            setAddingAnother(true);
            openTab();
          }}
          onRemove={(method) => void handleRemove(method)}
          removingToken={removingToken}
        />
        <button
          onClick={onClose}
          disabled={submitting}
          className="w-full py-2 text-xs font-bold text-gray-500 hover:text-gray-300 disabled:opacity-50"
        >
          I&apos;ll do it later
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}

      {/* Without this, "add another method" is a one-way door for anyone who
          changes their mind: nothing new gets linked, so the poll never returns
          and the destination they already had is out of reach. */}
      {addingAnother && methods && payableCount(methods) > 0 && (
        <button
          type="button"
          onClick={() => setAddingAnother(false)}
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-white"
        >
          <ArrowLeft size={12} /> Back to your payout methods
        </button>
      )}

      <p className="text-[11px] text-gray-400 leading-relaxed">
        Link a bank account, debit card, or wallet to receive{" "}
        <span className="text-white font-semibold">
          {Number(amount).toFixed(2)}
        </span>{" "}
        on the Coinflow page. You don&apos;t need to finish a withdrawal there —
        come back here to pick the destination and how fast you want it.
      </p>

      {!url ? (
        <div className="py-8 flex flex-col items-center gap-3 text-gray-400">
          <Loader2 size={22} className="animate-spin text-yellow-400" />
          <span className="text-[11px] uppercase">Preparing Coinflow…</span>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={openTab}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#B93DEB] hover:bg-[#A32DD4] text-white font-bold uppercase text-xs transition-all"
          >
            <ExternalLink size={14} />
            {opened ? "Re-open the Coinflow page" : "Open the Coinflow page"}
          </button>

          {opened && !gaveUp && (
            <div className="flex items-center justify-center gap-2 text-[11px] text-gray-400">
              <Loader2 size={13} className="animate-spin text-yellow-400" />
              Waiting for your payout method…
            </div>
          )}

          {gaveUp && (
            <div className="space-y-2">
              <p className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/25 rounded-lg p-3">
                Still no linked payout method. Finish the steps on the Coinflow
                page, then check again.
              </p>
              <button
                type="button"
                onClick={() => {
                  setGaveUp(false);
                  void fetchMethods().then(applyProbe);
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold uppercase text-[10px] tracking-wider transition-all"
              >
                <RefreshCw size={13} /> Check again
              </button>
            </div>
          )}
        </>
      )}

      <button
        onClick={onClose}
        className="w-full py-2 text-xs font-bold text-gray-500 hover:text-gray-300"
      >
        I&apos;ll do it later
      </button>

      <p className="text-center text-[10px] text-gray-500">
        Powered by Coinflow. Funds are released by admin to your linked
        destination.
      </p>
    </div>
  );
}
