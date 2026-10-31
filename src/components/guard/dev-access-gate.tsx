"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";

import {
  getLogsAccessStatus,
  hasLogsAccess,
  unlockLogs,
} from "@/api/system-logs/logs-access";

/**
 * Passphrase wall for pages that are reached by URL only.
 *
 * It reuses the System Logs development passphrase and its session token, so a
 * developer unlocks once per tab and every gated page opens. Unlike System
 * Logs the API does not (yet) require that token on the pages wrapped here, so
 * this stops someone who lands on the page from the browser, not someone
 * calling the endpoint directly — the page's own permission rule is what keeps
 * doing that job.
 */

const inputClass =
  "bg-[#242B35] border border-[#2C323D] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#B93DEB]";
const panelClass = "rounded-xl border border-white/10 bg-[#161A21]";

const apiErrorMessage = (error: unknown, fallback: string) => {
  const message = (error as { response?: { data?: { message?: unknown } } })
    ?.response?.data?.message;
  if (Array.isArray(message)) return message.join(", ");
  if (typeof message === "string") return message;
  return fallback;
};

export default function DevAccessGate({
  title,
  children,
}: {
  /** Shown on the lock screen so the developer knows what they are opening. */
  title: string;
  children: React.ReactNode;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [checked, setChecked] = useState(false);

  // sessionStorage is not readable during SSR, so the first paint has to wait
  // for the client — otherwise the page would flash unlocked and then relock.
  useEffect(() => {
    setUnlocked(hasLogsAccess());
    setChecked(true);
  }, []);

  if (!checked) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-purple-400" size={26} />
      </div>
    );
  }

  if (!unlocked) {
    return <LockScreen title={title} onUnlocked={() => setUnlocked(true)} />;
  }

  return <>{children}</>;
}

function LockScreen({
  title,
  onUnlocked,
}: {
  title: string;
  onUnlocked: () => void;
}) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);

  // Tells the developer "not enabled on this environment" instead of letting
  // them retype a passphrase that could never work here.
  useEffect(() => {
    getLogsAccessStatus()
      .then((status) => setConfigured(status.configured))
      .catch(() => setConfigured(null));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || submitting) return;
    try {
      setSubmitting(true);
      setError(null);
      await unlockLogs(password);
      setPassword("");
      onUnlocked();
    } catch (err) {
      setError(apiErrorMessage(err, "Incorrect passphrase"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <form onSubmit={submit} className={`${panelClass} w-full max-w-md space-y-4 p-6`}>
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#B93DEB]/15 p-2.5">
            <Lock size={20} className="text-[#B93DEB]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">{title}</h1>
            <p className="text-xs text-white/45">
              Development access only. Enter the passphrase to continue.
            </p>
          </div>
        </div>

        {configured === false && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
            Development access is not configured on this environment. Set
            SYSTEM_LOGS_ACCESS_KEY in the API environment to enable it.
          </p>
        )}

        <div className="space-y-1">
          <label className="block text-xs text-white/60" htmlFor="dev-passphrase">
            Passphrase
          </label>
          <input
            id="dev-passphrase"
            type="password"
            autoFocus
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            className={`${inputClass} w-full`}
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!password || submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#B93DEB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#a032d0] disabled:opacity-40"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
          Unlock
        </button>

        <p className="text-[11px] leading-relaxed text-white/30">
          The unlock lasts 8 hours and is cleared when this tab closes. The
          passphrase is held in the API environment — it cannot be read or changed
          from the admin panel.
        </p>
      </form>
    </div>
  );
}
