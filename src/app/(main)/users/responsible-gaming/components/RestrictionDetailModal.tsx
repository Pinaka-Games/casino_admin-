"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldAlert, X } from "lucide-react";
import toast from "react-hot-toast";

import {
  responsibleGamingApi,
  endDateLabel,
  RESTRICTION_STATUS_STYLE,
  RESTRICTION_TYPE_LABEL,
  type PlayerRestrictionDetail,
  type RestrictionRow,
} from "@/api/responsible-gaming/responsible-gaming.api";
import { usePermissions } from "@/hooks/user-permissions";

function fmt(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : "—";
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-white/50">{label}</span>
      <span className="text-right text-white/90">{value}</span>
    </div>
  );
}

/**
 * One player's restriction history — feature 14.
 *
 * Shows the active restriction, then every restriction ever placed. Nothing is
 * deleted from that history: "has this player self-excluded before" is a
 * question compliance and regulators both ask, and a row removed on expiry
 * answers it wrongly.
 */
export default function RestrictionDetailModal({
  userId,
  onClose,
  onChanged,
}: {
  userId: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canLift = isSuperAdmin || hasPermission("responsible-gaming:lift");

  const [data, setData] = useState<PlayerRestrictionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [lifting, setLifting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");

  const load = () => {
    setLoading(true);
    responsibleGamingApi
      .detail(userId, { limit: 50 })
      .then(setData)
      .catch(() => toast.error("Could not load this player's restrictions."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [userId]);

  const submitLift = async () => {
    if (reason.trim().length < 3) {
      toast.error("Please enter at least 3 characters explaining why.");
      return;
    }
    setLifting(true);
    try {
      setData(await responsibleGamingApi.lift(userId, reason.trim()));
      setConfirming(false);
      setReason("");
      toast.success("Restriction lifted.");
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not lift that restriction.");
    } finally {
      setLifting(false);
    }
  };

  const active = data?.active ?? null;
  // The projection on `users` and the restriction row should always agree. When
  // they do not, the compliance screen is exactly where that should be visible
  // rather than quietly reconciled away.
  const projectionMismatch =
    !!data &&
    ((active && data.player.rgStatus === "ACTIVE") ||
      (!active && data.player.rgStatus !== "ACTIVE"));

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#191D24]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-white/10 p-5">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-white">
              {data?.player.username || data?.player.entity || "Player"}
            </h3>
            <p className="mt-0.5 text-xs text-white/50">
              Responsible Gaming history
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-white/60">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : !data ? (
            <p className="py-12 text-center text-white/60">Could not load.</p>
          ) : (
            <>
              {projectionMismatch && (
                <div className="mb-4 flex gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    The cached account flag (<code>{data.player.rgStatus}</code>)
                    disagrees with the restriction records. The 10-minute sweep
                    repairs this automatically — if it persists, the sweep is not
                    running.
                  </span>
                </div>
              )}

              {active ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      {RESTRICTION_TYPE_LABEL[active.type]}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${RESTRICTION_STATUS_STYLE[active.status].cls}`}
                    >
                      {RESTRICTION_STATUS_STYLE[active.status].label}
                    </span>
                    {active.reviewDue && (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                        Review due
                      </span>
                    )}
                  </div>
                  <Row label="Period" value={active.periodLabel} />
                  <Row label="Started" value={fmt(active.startsAt)} />
                  <Row
                    label={endDateLabel(active)}
                    value={fmt(active.endsAt)}
                  />
                  <Row label="Chosen by" value={active.source} />
                  <Row label="IP at request" value={active.ipAddress || "—"} />
                  {active.type === "SELF_EXCLUSION" && (
                    <p className="mt-2 text-[11px] text-white/40">
                      A self-exclusion never lifts on its own. The date above is
                      the earliest a review may be requested.
                    </p>
                  )}
                </div>
              ) : (
                <p className="rounded-xl border border-white/10 bg-[#0F141E] p-4 text-sm text-white/60">
                  No active restriction on this account.
                </p>
              )}

              <h4 className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">
                History ({data.total})
              </h4>
              {data.history.length === 0 ? (
                <p className="text-sm text-white/50">Nothing recorded.</p>
              ) : (
                <ul className="space-y-2">
                  {data.history.map((r: RestrictionRow) => (
                    <li
                      key={r.id}
                      className="rounded-lg border border-white/10 bg-[#0F141E] p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm text-white/90">
                          {RESTRICTION_TYPE_LABEL[r.type]} · {r.periodLabel}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${RESTRICTION_STATUS_STYLE[r.status].cls}`}
                        >
                          {RESTRICTION_STATUS_STYLE[r.status].label}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-white/45">
                        {fmt(r.startsAt)} → {fmt(r.endsAt)} · by {r.source}
                      </p>
                      {r.liftReason && (
                        <p className="mt-1 text-[11px] text-emerald-300/80">
                          Lifted {fmt(r.liftedAt)}: {r.liftReason}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {active && (
          <div className="border-t border-white/10 bg-[#161A21] p-4">
            {confirming ? (
              <div className="space-y-3">
                <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    This reopens the account immediately.
                    {active.type === "SELF_EXCLUSION" &&
                      " If the player asked to come back, use their support ticket instead so the ask and the decision stay on one record."}
                  </span>
                </div>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  placeholder="Why is this being lifted? e.g. Opened in error — player confirmed by phone on 26 Aug"
                  aria-invalid={reason.length > 0 && reason.trim().length < 3}
                  className={`w-full rounded-lg border bg-[#242B35] p-2 text-sm text-white outline-none focus:border-[#B93DEB] ${reason.length > 0 && reason.trim().length < 3
                    ? "border-red-500/50"
                    : "border-white/10"
                    }`}
                />
                {/* Says WHY the button is dead. Without this the form just sat
                    there with Confirm greyed out and no explanation, which reads
                    as broken rather than as a validation rule — the reason is
                    audited and has to be a sentence somebody can act on months
                    later, not a keystroke to get past the field. */}
                <p
                  className={`mt-1 text-xs ${reason.trim().length < 3 ? "text-amber-300" : "text-gray-500"
                    }`}
                >
                  {reason.trim().length < 3
                    ? `Enter at least 3 characters — ${3 - reason.trim().length} more to go. This is recorded against your name.`
                    : "Recorded in the audit trail against your name."}
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setConfirming(false)}
                    className="rounded-lg bg-[#3A4150] px-4 py-2 text-sm font-semibold text-white hover:bg-[#454d5e]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitLift}
                    disabled={lifting || reason.trim().length < 3}
                    className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {lifting ? "Lifting…" : "Confirm lift"}
                  </button>
                </div>
              </div>
            ) : canLift ? (
              <div className="flex justify-end">
                <button
                  onClick={() => setConfirming(true)}
                  className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20"
                >
                  Lift restriction
                </button>
              </div>
            ) : (
              // Shown rather than hidden, so an agent knows the action exists
              // and who to ask instead of wondering where the button went.
              <p className="text-right text-xs text-white/40">
                Lifting a restriction needs the Responsible Gaming Lift
                permission.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
