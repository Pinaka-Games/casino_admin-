"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from "lucide-react";
import { redeemApi, type PayoutFundingAlert } from "@/api/redeem/redeem.api";
import { formatUtcDateTimeFull } from "@/lib/utils";

/**
 * Sits above the withdrawal table when a provider is refusing payouts for lack
 * of funds.
 *
 * Neither Breeze nor Coinflow exposes a payout wallet balance — Breeze
 * confirmed in writing that no endpoint and no webhook exist for it — so an
 * empty wallet is invisible until a release is actually refused. Until this
 * banner, that refusal reached exactly one admin as a toast and died there,
 * while every other queued payout failed the same way.
 *
 * Always renders one of three states rather than hiding when healthy. Hiding
 * was the original design, and it was wrong: a broken endpoint looked exactly
 * like "no provider is blocked", so a wrong API path went unnoticed through a
 * full deploy cycle. An explicit "healthy" line costs one row of screen and
 * makes the difference between working and broken obvious at a glance.
 *
 *   blocked  — loud red, details behind a click
 *   healthy  — one quiet line
 *   unknown  — amber; the status check itself failed
 *
 * The blocked state clears on its own the moment a payout succeeds. There is
 * deliberately no dismiss button — a funding outage that can be waved away
 * reads as resolved when it is not.
 */
export default function PayoutFundingBanner({
  refreshKey,
}: {
  /** Bump to re-check after an admin releases a payout. */
  refreshKey?: number;
}) {
  const [alerts, setAlerts] = useState<PayoutFundingAlert[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await redeemApi.getPayoutFundingStatus();
      setAlerts(Array.isArray(res.data) ? res.data : []);
      setProblem(null);
      setState("ok");
    } catch (error) {
      // Never block the listing behind this — but never pretend all is well
      // either. An unreachable check is its own state, shown as such.
      const err = error as {
        response?: { status?: number };
        message?: string;
      };
      const status = err?.response?.status;
      console.warn("[PayoutFundingBanner] status check failed", error);
      setProblem(
        status ? `HTTP ${status}` : (err?.message ?? "request failed"),
      );
      setAlerts([]);
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  // Nothing on the very first load, so the page does not flash a status it has
  // not actually checked yet.
  if (state === "loading") return null;

  if (state === "error") {
    return (
      <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
        <HelpCircle className="h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-xs text-amber-200">
          Payout funding status unavailable
          {problem ? ` (${problem})` : ""} — this check is not reporting, so a
          blocked payout wallet would not be flagged here.
        </p>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
        <p className="text-xs text-emerald-200/80">
          Payouts healthy — Breeze and Coinflow are accepting payouts.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4 flex flex-col gap-3">
      {alerts.map((alert) => {
        const name = alert.provider === "BREEZE" ? "Breeze" : "Coinflow";
        const isOpen = expanded === alert.id;

        return (
          <div
            key={alert.id}
            className="rounded-lg border border-red-500/40 bg-red-500/10"
          >
            <div className="flex flex-wrap items-center gap-3 p-3 md:p-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-red-200">
                  Payouts are blocked — {name} wallet is short
                </p>
                <p className="mt-0.5 text-xs text-red-200/70">
                  {alert.failureCount} payout
                  {alert.failureCount === 1 ? "" : "s"} refused since{" "}
                  {formatUtcDateTimeFull(alert.openedAt)}. Top up the {name}{" "}
                  payout wallet, then release again — this clears automatically
                  once one payout succeeds.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : alert.id)}
                aria-expanded={isOpen}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-red-400/40 px-2.5 py-1 text-xs font-medium text-red-200 transition-colors hover:bg-red-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                {isOpen ? "Hide details" : "View details"}
                {isOpen ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            {isOpen && (
              <div className="border-t border-red-500/25 px-3 pb-3 pt-3 md:px-4 md:pb-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-red-200/60">
                  First payout refused
                </p>
                <div className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                  <Field label="Player" value={alert.firstUsername} />
                  <Field label="Email" value={alert.firstUserEmail} />
                  <Field
                    label="Amount"
                    value={
                      alert.firstAmount === null
                        ? null
                        : `$${Number(alert.firstAmount).toFixed(2)}`
                    }
                  />
                  <Field
                    label="Last refused"
                    value={formatUtcDateTimeFull(alert.lastFailureAt)}
                  />
                  <Field
                    label="Redeem request"
                    value={alert.firstRedeemRequestId}
                    mono
                  />
                  <Field
                    label="Payout page"
                    value={alert.firstPayoutPageId}
                    mono
                  />
                </div>

                {alert.reason && (
                  <>
                    <p className="mb-1 mt-4 text-xs font-medium uppercase tracking-wider text-red-200/60">
                      {name} said
                    </p>
                    <p className="break-words font-mono text-xs text-red-100/90">
                      {alert.reason}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-red-200/60">{label}</p>
      <p
        className={`truncate text-red-50 ${mono ? "font-mono text-xs" : ""}`}
        title={value ?? undefined}
      >
        {value || "—"}
      </p>
    </div>
  );
}
