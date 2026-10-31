"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Loader2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

import {
  getAleaSyncStatus,
  startAleaSync,
  verifyAleaFreeSpins,
  type AleaSyncStatus,
} from "@/api/games/games";
import { getApiErrorMessage } from "@/api/messaging/error-message";

/** Poll only while something is running — see the effect below. */
const POLL_MS = 5000;

const fmt = (value?: string) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
};

/**
 * Manual controls and status for the AleaPlay catalog jobs.
 *
 * The catalog decides which games an admin may build a free-spin template
 * around, and it only refreshes on a nightly cron — so after adding a provider,
 * or when AleaPlay disables a game, there was no way to catch up without a
 * server-side call and no way to see whether the last run had even worked.
 */
export default function SyncSettingsPanel() {
  const [status, setStatus] = useState<AleaSyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Guards the poll against a response landing after unmount.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const next = await getAleaSyncStatus();
      if (mounted.current) setStatus(next);
    } catch (err) {
      if (!silent && mounted.current) {
        toast.error(getApiErrorMessage(err, "Could not read sync status"));
      }
    } finally {
      if (mounted.current && !silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Poll ONLY while a sync is in flight. A sync runs for minutes and then
  // nothing changes for a day, so polling an idle panel is pure noise.
  useEffect(() => {
    if (!status?.running) return;
    const id = setInterval(() => void load(true), POLL_MS);
    return () => clearInterval(id);
  }, [status?.running, load]);

  const handleSync = async () => {
    setStarting(true);
    try {
      const res = await startAleaSync();
      toast.success(res.message);
      await load(true);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not start the sync"));
    } finally {
      setStarting(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await verifyAleaFreeSpins();
      // A refusal is a real outcome, not an error: it means the catalog just
      // learned those games cannot be granted.
      toast.success(res.message);
      await load(true);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Verification failed"));
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-10 w-10 animate-spin text-purple-400" />
      </div>
    );
  }

  const last = status?.lastRun;
  const verification = status?.verification;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* ── Catalog sync ── */}
      <section className="rounded-lg border border-gray-800 bg-[#191D24] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Game Catalog</h2>
            <p className="mt-1 text-xs text-gray-400">
              Refreshes AleaPlay and SA Gaming games, provider names and which
              are live. The free-spin picker is built from this. Your on/off
              switches, featured/new flags and ordering are never changed by it.
            </p>
          </div>

          <button
            onClick={handleSync}
            disabled={starting || status?.running}
            className="flex h-9 shrink-0 items-center gap-2 rounded-lg bg-purple-600 px-4 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={status?.running || starting ? "animate-spin" : ""}
            />
            {status?.running ? "Running..." : "Sync now"}
          </button>
        </div>

        {status?.running ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-xs text-purple-200">
            <Loader2 size={14} className="animate-spin" />
            Running for {status.runningForSeconds ?? 0}s — this takes a few minutes.
          </div>
        ) : last ? (
          <div
            className={`mt-4 rounded-lg border px-3 py-2 text-xs ${
              last.success
                ? "border-green-500/30 bg-green-500/10 text-green-200"
                : "border-red-500/30 bg-red-500/10 text-red-200"
            }`}
          >
            <p className="flex items-center gap-2 font-medium">
              {last.success ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {last.success
                ? `${last.count} game(s) refreshed in ${last.durationSeconds}s`
                : "Last run failed"}
            </p>
            {last.error && <p className="mt-1 break-words text-red-300">{last.error}</p>}
            {last.providers && (
              <ul className="mt-1 space-y-0.5 text-gray-400">
                {(
                  [
                    ["aleaplay", "AleaPlay"],
                    ["sagames", "SA Gaming"],
                  ] as const
                ).map(([key, label]) => {
                  const run = last.providers?.[key];
                  if (!run) return null;
                  return (
                    <li key={key}>
                      {label}:{" "}
                      {run.success ? `${run.count} game(s)` : `failed${run.error ? ` — ${run.error}` : ""}`}
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-1 text-gray-400">
              {fmt(last.finishedAt)} · triggered by {last.trigger}
            </p>
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-gray-700 bg-[#12151B] px-3 py-2 text-xs text-gray-400">
            No run recorded yet. Status is kept in memory, so it resets when the
            API restarts.
          </p>
        )}

        {status?.schedule && (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-500">
            <Clock size={12} />
            Runs automatically {status.schedule.description.toLowerCase()}
          </p>
        )}

        <div className="mt-3 rounded-lg border border-gray-800 bg-[#12151B] px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Run it when
          </p>
          <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-gray-400">
            <li>• AleaPlay adds a provider or new games you cannot find yet</li>
            <li>• A game is missing, renamed, or shows the wrong provider</li>
            <li>• A free-spin grant fails with &quot;rollout disabled&quot;</li>
            <li>• After AleaPlay tells you something changed on their side</li>
          </ul>
          <p className="mt-2 text-[11px] text-gray-500">
            Takes a few minutes and is safe to run at any time — it only refreshes
            the catalogue. Players, templates and existing grants are untouched.
          </p>
        </div>
      </section>

      {/* ── Free-spin verification ── */}
      <section className="rounded-lg border border-gray-800 bg-[#191D24] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Free-Spin Verification</h2>
            <p className="mt-1 text-xs text-gray-400">
              Asks AleaPlay, game by game, whether free spins can actually be
              granted. Refused games leave the template picker.
            </p>
          </div>

          <button
            onClick={handleVerify}
            disabled={verifying}
            className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-gray-600 bg-[#242B35] px-4 text-sm font-medium text-white hover:bg-[#2b3340] disabled:opacity-50"
          >
            <RefreshCw size={14} className={verifying ? "animate-spin" : ""} />
            {verifying ? "Verifying..." : "Verify batch"}
          </button>
        </div>

        {verification ? (
          <>
            <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-[#242B35]">
              {[
                { label: "Supported", value: verification.supported, tone: "text-green-400" },
                { label: "Refused", value: verification.refused, tone: "text-orange-300" },
                { label: "Pending", value: verification.pending, tone: "text-gray-300" },
              ].map((s) => (
                <div key={s.label} className="bg-[#12151B] px-3 py-3">
                  <p className="text-[11px] text-gray-500">{s.label}</p>
                  <p className={`text-lg font-semibold ${s.tone}`}>{s.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-[#242B35]">
                <div
                  className="h-full rounded-full bg-purple-500 transition-all"
                  style={{
                    width: `${
                      verification.candidates
                        ? Math.round((verification.verified / verification.candidates) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-gray-500">
                {verification.verified} of {verification.candidates} candidate games
                verified. The nightly sync verifies a batch at a time.
              </p>

              <div className="mt-3 rounded-lg border border-gray-800 bg-[#12151B] px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Run it when
                </p>
                <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-gray-400">
                  <li>• Pending is above zero and you need the picker accurate now</li>
                  <li>• A template you expected to build has games missing</li>
                  <li>• Straight after a catalogue sync that added games</li>
                </ul>
                <p className="mt-2 text-[11px] text-gray-500">
                  <span className="text-gray-400">Supported</span> can be granted.{" "}
                  <span className="text-gray-400">Refused</span> is AleaPlay saying no
                  — those leave the picker so a template cannot be built on them.{" "}
                  <span className="text-gray-400">Pending</span> is not yet asked, and
                  stays selectable meanwhile.
                </p>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-4 rounded-lg border border-gray-700 bg-[#12151B] px-3 py-2 text-xs text-gray-400">
            Progress unavailable.
          </p>
        )}
      </section>
    </div>
  );
}
