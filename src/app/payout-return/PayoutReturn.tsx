"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { announceCoinflowReturn } from "@/lib/coinflow-return";

/**
 * The last step of the Coinflow linking detour.
 *
 * Coinflow sends the agent here in the tab it opened. The panel tab they started
 * from is still sitting behind it waiting for a linked destination to appear, so
 * the job is: tell that tab, then get out of the way. `window.close()` is
 * attempted because the tab was script-opened; when the browser refuses (or the
 * opener was severed by Coinflow's COOP) the agent gets an explicit way back
 * rather than a dead end.
 */
export default function PayoutReturn() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status") === "failed" ? "failed" : "success";
  const next = searchParams.get("next");

  // Only ever back into this panel: `next` arrives in a URL the agent could have
  // edited, and it is rendered as a link.
  const returnHref = useMemo(() => {
    if (typeof window === "undefined") return "/agent-management";
    try {
      const url = next
        ? new URL(next, window.location.origin)
        : new URL("/agent-management", window.location.origin);
      return url.origin === window.location.origin
        ? url.toString()
        : "/agent-management";
    } catch {
      return "/agent-management";
    }
  }, [next]);

  const [closeBlocked, setCloseBlocked] = useState(false);

  useEffect(() => {
    announceCoinflowReturn(status);

    // A beat before closing so the message is delivered and the agent sees the
    // confirmation rather than a tab that blinks out of existence.
    const closeTimer = window.setTimeout(() => {
      try {
        window.close();
      } catch {
        /* not script-closable */
      }
      // Still here means the browser refused. Nothing else can be done from
      // script, so hand it back to the agent.
      setCloseBlocked(true);
    }, 1200);

    return () => window.clearTimeout(closeTimer);
  }, [status]);

  const isSuccess = status === "success";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0E121A] px-4 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#151A24] p-8 text-center shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5">
          {isSuccess ? (
            <CheckCircle2 className="h-10 w-10 text-green-400" />
          ) : (
            <XCircle className="h-10 w-10 text-red-400" />
          )}
        </div>

        <h1 className="mt-6 text-2xl font-semibold">
          {isSuccess ? "Payout method added" : "Payout method not added"}
        </h1>

        <p className="mt-3 text-sm leading-6 text-gray-400">
          {isSuccess
            ? "Coinflow has your details. Head back to the payout window to choose this destination and how fast you want the money."
            : "Coinflow returned without linking a destination. Go back to the payout window and try again."}
        </p>

        {closeBlocked ? (
          <a
            href={returnHref}
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#B93DEB] px-5 py-3 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-[#A32DD4]"
          >
            Back to your payout request
          </a>
        ) : (
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Closing this tab
          </div>
        )}

        <p className="mt-4 text-[11px] text-gray-500">
          You can close this tab — your payout window is still open behind it.
        </p>
      </div>
    </main>
  );
}
