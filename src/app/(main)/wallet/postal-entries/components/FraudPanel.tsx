"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, ShieldAlert } from "lucide-react";

import {
  PostalFraudStats,
  REJECTION_REASON_LABELS,
  PostalRejectionReason,
  postalRequestApi,
} from "@/api/postal-request/postal-request.api";

import { ACCENT, INSET, PANEL, TEXT_FAINT, TEXT_MUTED } from "../theme";

const WINDOWS = [7, 30, 90];

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

const Stat = ({
  label,
  value,
  hint,
  alarming,
}: {
  label: string;
  value: string;
  hint?: string;
  alarming?: boolean;
}) => (
  <div className="rounded-lg border border-[#2F3743] bg-[#242B35] p-3">
    <p className={`text-xs ${TEXT_MUTED}`}>{label}</p>
    <p
      className={`mt-1 text-xl font-semibold ${
        alarming ? "text-red-400" : "text-white"
      }`}
    >
      {value}
    </p>
    {hint && <p className={`mt-1 text-xs ${TEXT_FAINT}`}>{hint}</p>}
  </div>
);

/**
 * The patterns no single entry can show you.
 *
 * Collapsed by default: none of it is needed to process today's post, and it is
 * read when somebody has a question ("are we suddenly refusing more cards?"),
 * not on every page load.
 */
export default function FraudPanel() {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<PostalFraudStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    postalRequestApi
      .fraudStats(days)
      .then((res) => setStats(res.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [open, days]);

  return (
    <div className={PANEL}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between p-4"
      >
        <span className="flex items-center gap-2 font-medium text-white">
          <ShieldAlert className={`h-4 w-4 ${ACCENT}`} /> Fraud review
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-white/60" />
        ) : (
          <ChevronDown className="h-4 w-4 text-white/60" />
        )}
      </button>

      {open && (
        <div className="space-y-4 border-t border-[#242B35] p-4">
          <div className="flex gap-2">
            {WINDOWS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setDays(w)}
                className={`rounded-md border px-3 py-1 text-sm transition-colors ${
                  days === w
                    ? "border-purple-500 bg-purple-600 font-medium text-white"
                    : "border-[#2F3743] bg-[#242B35] text-white/70 hover:text-white"
                }`}
              >
                {w} days
              </button>
            ))}
          </div>

          {loading && (
            <p className={`flex items-center gap-2 text-sm ${TEXT_MUTED}`}>
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          )}

          {!loading && !stats && (
            <p className={`text-sm ${TEXT_MUTED}`}>
              No figures available for this window.
            </p>
          )}

          {!loading && stats && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  label="Cards received"
                  value={String(stats.entries.received)}
                  hint={`${stats.entries.pending} still pending`}
                />
                <Stat
                  label="Accepted"
                  value={pct(stats.rates.approvalRate)}
                  hint={`${stats.entries.approved} of ${stats.entries.received}`}
                />
                <Stat
                  label="Expired codes"
                  value={pct(stats.rates.expiredCodeRate)}
                  // High means players are not posting within the validity window —
                  // usually a window set too short, or unclear instructions, not fraud.
                  hint="Cards whose code had already expired"
                  alarming={stats.rates.expiredCodeRate > 0.15}
                />
                <Stat
                  label="Unrecognised codes"
                  value={pct(stats.rates.unknownCodeRate)}
                  // A climbing unknown-code rate is the signature of somebody
                  // mailing guessed codes rather than of players making typos.
                  hint="Rising means someone is guessing codes"
                  alarming={stats.rates.unknownCodeRate > 0.1}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className={`${INSET} rounded-lg p-3`}>
                  <p className="mb-2 text-sm font-medium text-white">
                    Why cards were refused
                  </p>
                  {stats.rejectionsByReason.length === 0 ? (
                    <p className={`text-sm ${TEXT_MUTED}`}>
                      Nothing was refused in this window.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-sm text-white">
                      {stats.rejectionsByReason.map((r) => (
                        <li key={r.reason} className="flex justify-between gap-4">
                          <span className={TEXT_MUTED}>
                            {REJECTION_REASON_LABELS[
                              r.reason as PostalRejectionReason
                            ] ?? r.reason}
                          </span>
                          <span className="font-medium">{r.count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className={`${INSET} rounded-lg p-3`}>
                  <p className="mb-2 text-sm font-medium text-white">
                    Addresses serving more than one account
                  </p>
                  {stats.sharedIps.length === 0 ? (
                    <p className={`text-sm ${TEXT_MUTED}`}>
                      No shared addresses in this window.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-sm text-white">
                      {stats.sharedIps.map((row) => (
                        <li key={row.ip} className="flex justify-between gap-4">
                          <span className="font-mono text-xs">{row.ip}</span>
                          <span>
                            {row.accounts} accounts / {row.codes} codes
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className={`${INSET} rounded-lg p-3 text-sm`}>
                <span className={TEXT_MUTED}>Codes minted: </span>
                <span className="font-medium text-white">{stats.codes.issued}</span>
                <span className={TEXT_MUTED}> · posted back: </span>
                <span className="font-medium text-white">{stats.codes.used}</span>
                <span className={TEXT_MUTED}>
                  {" "}
                  ({pct(stats.codes.conversionRate)})
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
