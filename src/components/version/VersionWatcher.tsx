"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Tells an admin their tab is running a build that is no longer deployed, and
 * offers the one-click fix.
 *
 * This is the proactive half of the deploy-skew story. The reactive half —
 * lib/chunk-error.ts — only fires once something has already failed to load,
 * which is a blank screen the user sees before the recovery reloads it. This
 * catches the same condition earlier, while the page is still working, so the
 * reload happens at a moment the user chooses.
 *
 * Deliberately never reloads on its own. An automatic reload here would throw
 * away a half-filled settings form or an unsaved edit, for a page that is
 * still perfectly functional — the failure is only latent. The chunk-error path
 * reloads without asking precisely because there is nothing left to lose by
 * then.
 */

/**
 * Poll interval. Long on purpose — a deploy is a rare event and this is a
 * courtesy notice, not a health check. The focus listener below is what makes
 * it feel immediate.
 */
const POLL_INTERVAL_MS = 5 * 60 * 1000;

/** Don't re-check on every alt-tab. */
const MIN_CHECK_GAP_MS = 60 * 1000;

/**
 * `buildId` arrives as a prop from the root layout, which reads it on the
 * server. It is therefore the build that RENDERED this page — exactly what a
 * later /api/version answer has to be compared against. It is not read from
 * `process.env` here because a NEXT_PUBLIC_ value does not survive into the
 * client bundle under Turbopack; see lib/build-id.ts.
 */
export default function VersionWatcher({ buildId }: { buildId: string | null }) {
  const BUILD_ID = buildId ?? "";
  const [outdated, setOutdated] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const check = useCallback(async (lastChecked: { at: number }) => {
    // No id means the server could not read its own build. Comparing against ""
    // would flag every page as outdated forever, so stand down instead.
    if (!BUILD_ID) return;

    const now = Date.now();
    if (now - lastChecked.at < MIN_CHECK_GAP_MS) return;
    lastChecked.at = now;

    try {
      const response = await fetch("/api/version", { cache: "no-store" });
      if (!response.ok) return;

      const payload = (await response.json()) as { buildId?: string | null };
      // A null id means the server could not determine its own build. Silence is
      // the right response — nagging on a value we do not have is worse than
      // missing a deploy.
      if (!payload?.buildId) return;

      if (payload.buildId !== BUILD_ID) setOutdated(true);
    } catch {
      // Offline, or mid-deploy. Either way this is not evidence of anything.
    }
  }, [BUILD_ID]);

  useEffect(() => {
    // Not checked on mount. A page that has just loaded was served by the build
    // that is running, so it is current by definition — and calling it here
    // would put a setState on the effect's synchronous path for no gain.
    const lastChecked = { at: 0 };

    const onFocus = () => void check(lastChecked);
    const interval = window.setInterval(() => void check(lastChecked), POLL_INTERVAL_MS);
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [check]);

  if (!outdated || dismissed) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-4 z-[9999] flex justify-center px-4"
    >
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-[#B93DEB]/30 bg-[#1A1F27] px-4 py-3 shadow-2xl">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">A new version is available</p>
          <p className="mt-0.5 text-xs text-gray-400">
            Reload to get the latest updates.
          </p>
        </div>
        <button
          // Default button type is "submit" — inside any surrounding form this
          // would submit it rather than reload.
          type="button"
          onClick={() => window.location.reload()}
          className="shrink-0 rounded-lg bg-[#cf4cff] px-4 py-2 text-sm font-semibold text-white hover:bg-[#B93DEB]"
        >
          Reload
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 rounded-lg px-2 py-2 text-gray-500 hover:text-gray-300"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
