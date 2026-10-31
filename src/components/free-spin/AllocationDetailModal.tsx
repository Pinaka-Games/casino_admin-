"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import toast from "react-hot-toast";

import { FreeSpinAPI } from "@/api";
import { parseGrantSource } from "@/lib/free-spin-source";
import { getApiErrorMessage } from "@/api/messaging/error-message";
import type { GrantAllocation } from "@/lib/free-spin-grants";

interface Props {
  allocation: GrantAllocation | null;
  onClose: () => void;
  /** Refresh the parent list after a cancel. */
  onChanged?: () => void;
  /** Hide cancel actions on read-only screens (the activity log). */
  readOnly?: boolean;
}

const statusClass = (status: string) => {
  const s = status.toLowerCase();
  if (s === "granted" || s === "active") return "bg-green-500/20 text-green-400";
  if (s === "cancelled") return "bg-red-500/20 text-red-400";
  if (s === "completed" || s === "used") return "bg-blue-500/20 text-blue-400";
  if (s === "partial") return "bg-amber-500/20 text-amber-300";
  return "bg-gray-500/20 text-gray-400";
};

const fmt = (val?: string) => {
  if (!val) return "-";
  const d = new Date(val);
  return isNaN(d.getTime())
    ? "-"
    : new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(d);
};

/** One labelled, copyable identifier. Blank values are called out, not hidden. */
function IdRow({
  label,
  value,
  missingHint,
}: {
  label: string;
  value?: string;
  missingHint?: string;
}) {
  if (!value) {
    return (
      <p className="truncate text-[10px] text-amber-400" title={missingHint}>
        <span className="text-gray-500">{label}:</span> not returned
      </p>
    );
  }

  return (
    <button
      type="button"
      title={value}
      onClick={() => {
        navigator.clipboard.writeText(value);
        toast.success(`${label} bonus ID copied`);
      }}
      className="block max-w-full truncate text-left font-mono text-[10px] text-purple-300 hover:text-purple-200"
    >
      <span className="font-sans text-gray-500">{label}:</span> {value}
    </button>
  );
}

/**
 * What one assignment actually produced.
 *
 * The collapsed table row says "3 games, 21 spins"; this shows the three
 * AleaPlay bonuses behind it — each with its own game, spin count, transaction
 * id and status, because those are what support and AleaPlay talk in.
 */
export default function AllocationDetailModal({
  allocation,
  onClose,
  onChanged,
  readOnly,
}: Props) {
  const [cancelling, setCancelling] = useState<string | null>(null);

  if (!allocation) return null;

  const source = parseGrantSource(allocation.bonusLabel);
  const cancellable = allocation.grants.filter((g) =>
    ["granted", "active"].includes((g.status ?? "").toLowerCase()),
  );

  const cancelOne = async (txId: string) => {
    setCancelling(txId);
    try {
      const res = await FreeSpinAPI.cancelFreeSpins(txId);
      toast.success(res.message);
      onChanged?.();
      onClose();
    } catch (err) {
      // Spins the player already used cannot be revoked — say which, rather
      // than reporting a cancel that did not happen.
      toast.error(getApiErrorMessage(err, "Failed to cancel grant"));
    } finally {
      setCancelling(null);
    }
  };

  /** Cancels every bonus of the assignment — the backend resolves the pool id. */
  const cancelAll = async () => {
    if (!allocation.key || allocation.key.startsWith("grant:")) {
      // No pool id: fall back to cancelling the single grant it represents.
      return cancelOne(allocation.grants[0]?.sourceTransactionId ?? "");
    }
    setCancelling("all");
    try {
      const res = await FreeSpinAPI.cancelFreeSpins(allocation.key);
      toast.success(res.message);
      onChanged?.();
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to cancel this assignment"));
    } finally {
      setCancelling(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-gray-700 bg-[#1C2127] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-700 px-4 py-4 md:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-semibold text-white">
                {allocation.configName}
              </h2>
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${source.badgeClass}`}
              >
                {source.label}
                {source.detail ? ` · ${source.detail}` : ""}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {allocation.contact || allocation.username || allocation.userId} · granted{" "}
              {fmt(allocation.grantedAt)}
              {allocation.expiresAt ? ` · expires ${fmt(allocation.expiresAt)}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-px bg-[#242B35] sm:grid-cols-5">
          {[
            { label: "Games", value: allocation.gameCount },
            { label: "Total spins", value: allocation.totalSpins },
            {
              label: "Used",
              value: `${allocation.totalSpinsUsed}/${allocation.totalSpins}`,
            },
            {
              label: "Currency",
              value: (allocation.grants[0]?.currency ?? "SC").toUpperCase(),
            },
            { label: "Provider", value: allocation.softwareName ?? "-" },
          ].map((s) => (
            <div key={s.label} className="bg-[#191D24] px-4 py-3">
              <p className="text-[11px] text-gray-500">{s.label}</p>
              <p className="truncate text-sm text-white">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Why it failed, in full — the row can only show a truncated line. */}
        {allocation.failureReason && (
          <div className="mx-6 mt-4 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-300">
              Why it failed
              {allocation.grantAttempts
                ? ` · ${allocation.grantAttempts} attempt${allocation.grantAttempts === 1 ? "" : "s"}`
                : ""}
            </p>
            <p className="mt-1 break-words text-xs text-orange-100">
              {allocation.failureReason}
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
          <p className="mb-2 text-[11px] uppercase tracking-wider text-gray-500">
            AleaPlay bonuses ({allocation.gameCount})
          </p>

          <div className="overflow-hidden rounded-lg border border-gray-700">
            {allocation.grants.map((g, i) => {
              const txId = g.sourceTransactionId ?? "";
              const isOpen = ["granted", "active"].includes((g.status ?? "").toLowerCase());
              return (
                <div
                  key={g.id}
                  className={`flex items-center gap-2 px-3 py-3 md:gap-3 md:px-4 ${
                    i % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-sm text-white">
                      {g.gameName ?? g.config?.gameName ?? `Game ${g.gameId}`}
                      <span className="ml-2 text-[10px] text-gray-500">
                        #{g.gameId}
                      </span>
                    </p>

                    {/* AleaPlay's own id first — it is the one their support
                        searches on. Ours is shown underneath because cancel and
                        our logs key off it. */}
                    <IdRow
                      label="AleaPlay"
                      value={g.aleaBonusId}
                      missingHint="AleaPlay returned no bonus id — payouts for this grant cannot be matched by id"
                    />
                    <IdRow label="Ours" value={txId} />
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-purple-300">
                      {g.spinsGranted ?? "-"} spins
                    </p>
                    {typeof g.spinsUsed === "number" && g.spinsUsed > 0 && (
                      <p className="text-[10px] text-gray-500">
                        {g.spinsUsed} used
                      </p>
                    )}
                    {g.level ? (
                      <p className="text-[10px] text-gray-500">level {g.level}</p>
                    ) : null}
                  </div>

                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClass(g.status ?? "")}`}
                  >
                    {(g.status ?? "unknown").toUpperCase()}
                  </span>

                  {!readOnly && (
                    <button
                      type="button"
                      disabled={!isOpen || cancelling === txId}
                      onClick={() => cancelOne(txId)}
                      className="shrink-0 rounded border border-gray-600 px-2 py-1 text-[11px] text-gray-300 hover:text-white disabled:opacity-30"
                    >
                      {cancelling === txId ? "…" : "Cancel"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-700 bg-[#191D24] px-4 py-4 md:px-6">
          <span className="text-xs text-gray-500">
            {cancellable.length
              ? `${cancellable.length} of ${allocation.gameCount} still cancellable`
              : "Nothing left to cancel"}
          </span>
          <div className="flex gap-3">
            {!readOnly && cancellable.length > 0 && (
              <button
                onClick={cancelAll}
                disabled={cancelling !== null}
                className="flex items-center gap-2 rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-40"
              >
                {cancelling === "all" && <Loader2 size={14} className="animate-spin" />}
                Cancel all {cancellable.length}
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
