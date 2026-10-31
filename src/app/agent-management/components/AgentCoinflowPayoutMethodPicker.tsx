"use client";

import { useMemo, useState } from "react";
import {
  Banknote,
  Bolt,
  Check,
  CreditCard,
  Landmark,
  Loader2,
  Plus,
  Smartphone,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  PAYOUT_SPEED_INFO,
  normalizeDestinationType,
  speedsForDestination,
  type CoinflowDestinationType,
  type CoinflowWithdrawSpeed,
} from "./coinflow-payout-rails";
import type { AgentCoinflowPayoutMethod } from "@/api/agent-payment/agent-coinflow.api";

/**
 * Lets an agent or sub-agent choose WHICH linked destination gets paid, and —
 * when that destination supports more than one Coinflow rail — how fast. The
 * agent-panel twin of the player's `CoinflowPayoutMethodPicker`.
 *
 * Before this the agent flow polled `confirm` and submitted whatever destination
 * the backend happened to prefer, so a requester with both a bank and a card
 * never got a say and every bank payout went out over the default rail. Only a US
 * bank offers a choice (standard / same-day / RTP / wire); every other destination
 * has exactly one legal rail, so its speed section is hidden rather than shown as
 * a single dead option.
 */

export interface AgentPayoutMethodSelection {
  method: AgentCoinflowPayoutMethod;
  speed: CoinflowWithdrawSpeed | null;
}

interface Props {
  methods: AgentCoinflowPayoutMethod[];
  submitting: boolean;
  onConfirm: (selection: AgentPayoutMethodSelection) => void;
  /** Re-open the hosted Coinflow page to link (or re-link) a destination. */
  onAddAnother: () => void;
  /** Unlink a destination at Coinflow. */
  onRemove: (method: AgentCoinflowPayoutMethod) => void;
  /** Token currently being removed, so its row can show progress. */
  removingToken?: string | null;
}

const DESTINATION_ICONS: Record<CoinflowDestinationType, React.ReactNode> = {
  BANK_ACCOUNT: <Landmark size={16} />,
  IBAN: <Landmark size={16} />,
  CARD: <CreditCard size={16} />,
  PAYPAL: <Wallet size={16} />,
  VENMO: <Smartphone size={16} />,
  PIX: <Bolt size={16} />,
  EFT: <Banknote size={16} />,
  INTERAC: <Smartphone size={16} />,
};

function iconFor(type: string): React.ReactNode {
  const key = normalizeDestinationType(type);
  return key ? DESTINATION_ICONS[key] : <Wallet size={16} />;
}

/** Rails the backend reported, falling back to the local catalogue. */
function railsFor(method: AgentCoinflowPayoutMethod): CoinflowWithdrawSpeed[] {
  return method.speeds?.length ? method.speeds : speedsForDestination(method.type);
}

/**
 * Coinflow keeps a destination on the withdrawer after the link is dropped or
 * replaced (PayPal and Venmo hold one slot each, so re-linking overwrites) and
 * flags it rather than removing it. Those are listed but not payable.
 * `undefined` means a backend that predates the flag — assume payable.
 */
function isPayable(method: AgentCoinflowPayoutMethod): boolean {
  return method.available !== false;
}

export function AgentCoinflowPayoutMethodPicker({
  methods,
  submitting,
  onConfirm,
  onAddAnother,
  onRemove,
  removingToken = null,
}: Props) {
  // Removing a destination cannot be undone from here — it has to be linked
  // again through Coinflow — so the trash icon arms an inline confirm rather
  // than unlinking on a single stray tap.
  const [confirmingToken, setConfirmingToken] = useState<string | null>(null);
  // Both selections are stored as overrides and resolved against the current
  // list rather than synced with effects: the list changes underneath us
  // whenever the requester links something new, and deriving means a stale token
  // simply falls back instead of needing a correction pass.
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [speedOverride, setSpeedOverride] =
    useState<CoinflowWithdrawSpeed | null>(null);

  // Only a payable destination can be selected, so the default never lands on
  // one that needs re-linking just because it sorts first.
  const selected = useMemo(() => {
    const payable = methods.filter(isPayable);
    return payable.find((m) => m.token === selectedToken) ?? payable[0] ?? null;
  }, [methods, selectedToken]);

  const rails = useMemo(() => (selected ? railsFor(selected) : []), [selected]);

  // Falls back to the destination's default rail the moment the destination
  // changes — carrying 'same_day' from a bank over to a debit card would be
  // rejected by Coinflow.
  const speed =
    rails.length > 1
      ? speedOverride && rails.includes(speedOverride)
        ? speedOverride
        : rails[0]
      : null;

  if (!selected) return null;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase text-yellow-400">
          Coinflow
        </p>
        <h3 className="text-lg font-bold text-white uppercase tracking-tight">
          Choose where to receive your payout
        </h3>
        <p className="text-[11px] text-gray-500 mt-0.5">
          {methods.length > 1
            ? "These are the destinations you have linked with Coinflow."
            : "This is the destination you linked with Coinflow."}
        </p>
      </div>

      <div className="space-y-2">
        {methods.map((method) => {
          const payable = isPayable(method);
          const isSelected = payable && method.token === selected.token;
          const removing = removingToken === method.token;
          const confirming = confirmingToken === method.token;
          return (
            // A row, not a button: it carries its own remove control, and a
            // button inside a button is invalid markup that browsers resolve by
            // dropping one of them.
            <div
              key={method.token}
              className={`flex w-full items-center rounded-xl border pr-2 transition-all ${
                isSelected
                  ? "border-[#B93DEB]/60 bg-[#B93DEB]/10"
                  : payable
                    ? "border-white/10 bg-white/[0.03] hover:border-white/20"
                    : "border-dashed border-white/10 bg-white/[0.02] hover:border-white/20"
              }`}
            >
              <button
                type="button"
                disabled={removing}
                // Re-linking is the only action left on a dropped destination,
                // and it is the action the requester wants — send them straight
                // to the Coinflow page instead of leaving a dead row.
                onClick={() =>
                  payable ? setSelectedToken(method.token) : onAddAnother()
                }
                className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left disabled:opacity-60"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                    isSelected
                      ? "bg-[#B93DEB]/20 border-[#B93DEB]/30 text-[#B93DEB]"
                      : "bg-white/5 border-white/10 text-gray-400"
                  }`}
                >
                  {iconFor(method.type)}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-sm font-bold ${
                      payable ? "text-white" : "text-gray-400"
                    }`}
                  >
                    {method.label}
                  </span>
                  <span className="block text-[11px] text-gray-500">
                    {payable
                      ? (PAYOUT_SPEED_INFO[railsFor(method)[0]]?.rail ??
                        method.type)
                      : `${
                          PAYOUT_SPEED_INFO[railsFor(method)[0]]?.rail ??
                          method.type
                        } — no longer linked, tap to add it again`}
                  </span>
                </span>
                {isSelected && (
                  <Check size={16} className="shrink-0 text-[#B93DEB]" />
                )}
                {!payable && (
                  <Plus size={14} className="shrink-0 text-gray-500" />
                )}
              </button>

              {confirming ? (
                <span className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setConfirmingToken(null)}
                    className="rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 transition-all hover:bg-white/10 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingToken(null);
                      onRemove(method);
                    }}
                    className="rounded-lg bg-red-500/15 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-red-300 transition-all hover:bg-red-500/25"
                  >
                    Remove
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  disabled={removing || submitting}
                  onClick={() => setConfirmingToken(method.token)}
                  aria-label={`Remove ${method.label}`}
                  title="Remove this payout method"
                  className="shrink-0 rounded-lg p-2 text-gray-500 transition-all hover:bg-red-500/10 hover:text-red-400 disabled:cursor-wait disabled:opacity-60"
                >
                  {removing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Only a US bank reaches here — everything else has a single rail. */}
      {rails.length > 1 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            How fast do you want it?
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {rails.map((rail) => {
              const info = PAYOUT_SPEED_INFO[rail];
              const isSelected = speed === rail;
              return (
                <button
                  key={rail}
                  type="button"
                  onClick={() => setSpeedOverride(rail)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
                    isSelected
                      ? "border-[#B93DEB]/60 bg-[#B93DEB]/10"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20"
                  }`}
                >
                  <span className="block text-xs font-bold text-white">
                    {info.label}
                  </span>
                  <span className="block text-[11px] text-gray-400">
                    {info.delivery}
                  </span>
                  <span className="block text-[10px] text-gray-600">
                    {info.rail}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <button
          type="button"
          disabled={submitting}
          onClick={() => onConfirm({ method: selected, speed })}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#B93DEB] hover:bg-[#A32DD4] text-white font-bold uppercase text-xs transition-all disabled:cursor-wait disabled:opacity-50"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          {submitting ? "Submitting" : "Continue with this method"}
        </button>

        <button
          type="button"
          disabled={submitting}
          onClick={onAddAnother}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold uppercase text-[10px] tracking-wider transition-all disabled:opacity-60"
        >
          <Plus size={13} />
          {/* "Another" alone read as "a different kind" — re-linking the same one
              (a replaced PayPal, a second bank) is the common case. */}
          Add or re-link a payout method
        </button>
      </div>

      <p className="text-center text-[10px] text-gray-500">
        Your bank and card details stay with Coinflow — we never see or store
        them.
      </p>
    </div>
  );
}
