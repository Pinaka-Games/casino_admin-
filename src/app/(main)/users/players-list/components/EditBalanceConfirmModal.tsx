"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import { AlertTriangle, ArrowRight, Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { coingold, coingreen, coinpurple } from "@/assets/icons";
import {
  balanceAdjustmentApi,
  type BalanceAdjustmentRequest,
  type EditSnapshot,
} from "@/api/wallet/balance-adjustment.api";

const REASON_MAX = 500;
/** Same ceiling the API enforces on wageringMultiplier. */
const MULTIPLIER_MAX = 1000;
/** Up to 2 decimals, digits only. */
const MULTIPLIER_INPUT = /^\d*\.?\d{0,2}$/;

const ROWS: Array<{
  key: keyof EditSnapshot;
  label: string;
  icon: any;
  tone: string;
  whole?: boolean;
}> = [
  {
    key: "xp",
    label: "Total XP",
    icon: null,
    tone: "text-sky-300",
  },
  {
    key: "wulfCash",
    label: "WulfCash",
    icon: coingreen,
    tone: "text-green-400",
  },
  {
    key: "wulfCoin",
    label: "WulfCoin",
    icon: coingold,
    tone: "text-yellow-500",
  },
  {
    key: "bonusWulfCash",
    label: "Bonus Balance",
    icon: coinpurple,
    tone: "text-purple-300",
  },
];

const round2 = (v: number) => Math.round(v * 100) / 100;
const fmtFor = (whole?: boolean) => (v: number) =>
  v.toLocaleString(undefined, {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  });

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  username: string;
  /** Balances + XP captured when the admin clicked Edit — sent as `expected`. */
  current: EditSnapshot;
  /** Balances + XP the admin typed. */
  target: EditSnapshot;
  onSuccess: (res: BalanceAdjustmentRequest) => void;
  /** The wallet moved while editing (409): the caller should reload it. */
  onConflict: () => void;
}

/**
 * Last stop before an admin's balance edit is submitted: shows what changes,
 * collects an optional reason the player will read, and requires an explicit
 * acknowledgement. Confirm raises a PENDING request on the Manual Deposit
 * Listing — the wallet only changes once it is approved there.
 */
export default function EditBalanceConfirmModal({
  isOpen,
  onClose,
  userId,
  username,
  current,
  target,
  onSuccess,
  onConflict,
}: Props) {
  const [reason, setReason] = useState("");
  const [applyWagering, setApplyWagering] = useState(true);
  // Blank = the system's default deposit wagering multiplier.
  const [multiplier, setMultiplier] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fresh form every time the dialog opens — a reason typed for one edit must
  // never ride along on the next.
  useEffect(() => {
    if (isOpen) {
      setReason("");
      setApplyWagering(true);
      setMultiplier("");
      setAcknowledged(false);
      setSubmitting(false);
    }
  }, [isOpen]);

  const changes = useMemo(
    () =>
      ROWS.map((row) => ({
        ...row,
        before: round2(current[row.key]),
        after: round2(target[row.key]),
        delta: round2(target[row.key] - current[row.key]),
      })),
    [current, target],
  );

  const changed = changes.filter((c) => c.delta !== 0);
  const hasDebit = changed.some((c) => c.key !== "xp" && c.delta < 0);
  const cashChange = changed.find((c) => c.key === "wulfCash" && c.delta > 0);
  const xpChange = changed.find((c) => c.key === "xp");
  const bonusChange = changed.find((c) => c.key === "bonusWulfCash");
  const bonusIncrease = bonusChange && bonusChange.delta > 0 ? bonusChange : undefined;
  // Wagering applies to anything that adds Sweep Coin or Bonus.
  const wagerable = !!cashChange || !!bonusIncrease;
  const trimmed = reason.trim();
  const multiplierValue = multiplier.trim() === "" ? null : Number(multiplier);
  const multiplierInvalid =
    applyWagering &&
    wagerable &&
    multiplierValue !== null &&
    !(Number.isFinite(multiplierValue) && multiplierValue >= 1 && multiplierValue <= MULTIPLIER_MAX);
  // Reason is optional — only the acknowledgement (and a valid multiplier) gates Confirm.
  const canConfirm = changed.length > 0 && acknowledged && !submitting && !multiplierInvalid;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    try {
      const pick = (s: EditSnapshot) => ({
        wulfCash: s.wulfCash,
        wulfCoin: s.wulfCoin,
        // Bonus moves on bonus-funded bets, so like XP it is only sent (and
        // drift-checked) when the admin actually changed it.
        ...(bonusChange ? { bonusWulfCash: s.bonusWulfCash } : {}),
      });
      const res = await balanceAdjustmentApi.adjust({
        userId,
        expected: pick(current),
        target: pick(target),
        ...(trimmed ? { reason: trimmed } : {}),
        ...(wagerable ? { applyWagering } : {}),
        ...(wagerable && applyWagering && multiplierValue !== null
          ? { wageringMultiplier: round2(multiplierValue) }
          : {}),
        // XP moves on every sweeps bet, so it is only sent (and checked) when
        // the admin actually changed it — a balance-only edit must not 409 on it.
        ...(xpChange ? { expectedXp: current.xp, targetXp: target.xp } : {}),
      });
      // Nothing has moved yet — say so plainly, and say where it is going.
      toast.success(
        "Sent for approval — approve it on the Manual Deposit Listing to apply it",
      );
      onSuccess(res.data);
    } catch (e: any) {
      const status = e?.response?.status;
      const raw = e?.response?.data?.message;
      const message = Array.isArray(raw) ? raw.join(", ") : raw;
      if (status === 409) {
        toast.error(
          message ??
            "The balance changed while you were editing. Reloaded — please try again.",
        );
        onConflict();
        return;
      }
      toast.error(message ?? "Failed to update balance");
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && !submitting && onClose()}
    >
      {/* Bound to the viewport: header and footer stay put, only the body
          scrolls, so Confirm is always reachable on short screens. Two columns
          from lg up (what changes | why), one column below. */}
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-[920px] max-h-[90dvh] flex flex-col gap-0 p-0 overflow-hidden bg-[#15181E] border-gray-800 text-white">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4 pr-12 border-b border-gray-800">
          <DialogTitle className="text-xl font-semibold text-white wrap-break-word">
            Confirm Balance Change - {username}
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-sm">
            Review the changes below. They are sent for approval to the Manual
            Deposit Listing and applied only once approved.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
            <div className="space-y-4 min-w-0">
              {/* Comparison */}
              <div className="rounded-lg border border-gray-800 overflow-x-auto">
                <div className="min-w-[440px]">
                  <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr] bg-[#242B35] text-xs text-gray-300 px-3 py-2">
                    <span>Balance</span>
                    <span className="text-right">Current</span>
                    <span className="text-right">New</span>
                    <span className="text-right">Change</span>
                  </div>
                  {changes.map((c) => {
                    const fmt = fmtFor(c.whole);
                    return (
                      <div
                        key={c.key}
                        className={`grid grid-cols-[1.3fr_1fr_1fr_1fr] items-center px-3 py-2.5 text-sm border-t border-gray-800 ${
                          c.delta === 0 ? "opacity-50" : "bg-[#191D24]"
                        }`}
                      >
                        <span className="inline-flex items-center gap-2">
                          {c.icon ? (
                            <Image
                              src={c.icon}
                              alt={c.label}
                              width={18}
                              height={18}
                            />
                          ) : (
                            <Sparkles className="h-[18px] w-[18px] text-sky-300" />
                          )}
                          <span className={c.tone}>{c.label}</span>
                        </span>
                        <span className="text-right text-gray-300">
                          {fmt(c.before)}
                        </span>
                        <span className="text-right font-semibold inline-flex items-center justify-end gap-1">
                          <ArrowRight className="h-3 w-3 text-gray-500" />
                          {fmt(c.after)}
                        </span>
                        <span
                          className={`text-right font-medium ${
                            c.delta > 0
                              ? "text-green-400"
                              : c.delta < 0
                                ? "text-red-400"
                                : "text-gray-500"
                          }`}
                        >
                          {c.delta === 0
                            ? "—"
                            : `${c.delta > 0 ? "+" : "-"}${fmt(Math.abs(c.delta))}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {xpChange && (
                <div className="flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
                  <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    The VIP tier is recalculated from the new XP (1 SC wagered =
                    1 XP).{" "}
                    {xpChange.delta < 0
                      ? "Lowering XP can move the player to a lower tier. Already-claimed tier rewards are not taken back."
                      : "Raising XP past a tier milestone unlocks that tier's reward once, the same as gameplay."}
                  </span>
                </div>
              )}

              {hasDebit && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Once approved, this removes funds from the player&apos;s
                    wallet. Redeemable balance is reduced if it would exceed the
                    new WulfCash.
                  </span>
                </div>
              )}

              {bonusIncrease && !applyWagering && (
                <div className="flex items-start gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-xs text-purple-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Wagering is off, so the added bonus gets no rollover of its
                    own. It stays in the bonus balance until the player completes
                    another active bonus rollover, which converts it to WulfCash.
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-4 min-w-0">
              {wagerable && (
                <div className="bg-[#242B35] rounded-lg p-4 space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={applyWagering}
                      onChange={(e) => setApplyWagering(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-[#B93DEB]"
                    />
                    <span>
                      <span className="block text-white text-sm font-medium">
                        Apply Wagering
                      </span>
                      <span className="block text-gray-500 text-xs mt-0.5">
                        If enabled, the added WulfCash gets a rollover lock (same
                        as a manual deposit) and added bonus gets its own bonus
                        rollover. If disabled, added WulfCash is immediately
                        redeemable.
                      </span>
                    </span>
                  </label>

                  {applyWagering && (
                    <div className="pl-7 space-y-1.5">
                      <label className="block text-xs font-medium text-gray-300">
                        Wagering Multiplier
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={multiplier}
                          onChange={(e) =>
                            MULTIPLIER_INPUT.test(e.target.value) &&
                            setMultiplier(e.target.value)
                          }
                          placeholder="Default"
                          className={`w-28 rounded-md bg-[#15181E] px-3 py-1.5 text-sm text-white outline-none border ${
                            multiplierInvalid ? "border-red-500" : "border-gray-700 focus:border-[#B93DEB]"
                          }`}
                        />
                        <span className="text-sm text-gray-400">×</span>
                      </div>
                      {multiplierInvalid ? (
                        <p className="text-[11px] text-red-400">
                          Enter a multiplier from 1 to {MULTIPLIER_MAX}.
                        </p>
                      ) : multiplierValue !== null ? (
                        <div className="text-[11px] text-gray-400 space-y-0.5">
                          {cashChange && (
                            <p>
                              WulfCash rollover: wager{" "}
                              <b className="text-green-400">
                                {fmtFor()(round2(cashChange.delta * multiplierValue))}
                              </b>
                            </p>
                          )}
                          {bonusIncrease && (
                            <p>
                              Bonus rollover: wager{" "}
                              <b className="text-purple-300">
                                {fmtFor()(round2(bonusIncrease.delta * multiplierValue))}
                              </b>
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-gray-500">
                          Leave blank to use the system default multiplier.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Reason */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-400">
                  Reason <span className="text-gray-500">(optional)</span>
                </label>
                <Textarea
                  value={reason}
                  onChange={(e) =>
                    setReason(e.target.value.slice(0, REASON_MAX))
                  }
                  placeholder="Why is this balance being changed? If given, the player will see this."
                  className="bg-[#242B35] border-none text-white resize-none min-h-[110px] lg:min-h-[150px]"
                />
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-500">
                    Optional. Shown to the player in the notification and transaction detail.
                  </span>
                  <span className="text-gray-500">
                    {trimmed.length}/{REASON_MAX}
                  </span>
                </div>
              </div>

              {/* Acknowledgement */}
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#B93DEB]"
                />
                <span className="text-sm text-gray-300">
                  I have checked the values and want to submit this balance change for{" "}
                  <b>{username}</b>.
                </span>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 px-6 py-4 border-t border-gray-800 bg-[#15181E]">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
            className="text-gray-400 hover:text-white hover:bg-white/5"
          >
            Back to edit
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="bg-[#B93DEB] hover:bg-[#a32cd6] text-white px-8"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Submit for Approval"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
