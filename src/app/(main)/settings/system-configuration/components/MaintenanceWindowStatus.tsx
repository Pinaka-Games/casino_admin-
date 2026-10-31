"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Clock } from "lucide-react";

const pad = (value: number) => String(value).padStart(2, "0");

const clockFrom = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  return `${pad(Math.floor(totalSeconds / 3600))}:${pad(
    Math.floor((totalSeconds % 3600) / 60),
  )}:${pad(totalSeconds % 60)}`;
};

type Tone = "live" | "armed" | "broken";

const TONES: Record<Tone, string> = {
  live: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  armed: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  broken: "border-red-500/40 bg-red-500/10 text-red-200",
};

const ICON_TONES: Record<Tone, string> = {
  live: "text-amber-400",
  armed: "text-sky-400",
  broken: "text-red-400",
};

/**
 * What the maintenance switch is actually doing right now, for whoever is
 * running the window.
 *
 * Three states, not one. With scheduled windows the switch being ON no longer
 * means the site is down — it can be armed for hours while players carry on —
 * and an operator who reads "on" as "down" will either panic or, worse, assume
 * the site is safely closed while money is still moving through it.
 *
 * Deliberately driven by the SAVED config rather than the draft: the end time
 * is stamped by the backend when the switch is saved, so a draft value would
 * show a clock for a window that has not started. Typing a new duration or
 * start time changes the fields above this; it does not move this clock until
 * Save.
 */
export default function MaintenanceWindowStatus({
  maintenanceOn,
  maintenanceType,
  startsAt,
  endsAt,
}: {
  maintenanceOn: boolean;
  maintenanceType?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!maintenanceOn) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [maintenanceOn]);

  if (!maintenanceOn) return null;

  const scheduled = maintenanceType === "scheduled";
  const start = startsAt ? new Date(startsAt).getTime() : NaN;
  const hasStart = Number.isFinite(start);

  let tone: Tone = "live";
  let body: string;

  if (scheduled && !hasStart) {
    // The backend refuses to save this combination, so it means a config
    // written elsewhere. Say it plainly: the operator believes the site is
    // closing and it is not.
    tone = "broken";
    body =
      "Scheduled, but no valid start time is set — the site will NOT close. Pick a Scheduled Start, or switch the type to Instant.";
  } else if (scheduled && now < start) {
    // The state the whole feature exists for: armed, site still serving.
    tone = "armed";
    const startLabel = new Date(start).toLocaleString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      day: "numeric",
      month: "short",
    });
    body = `Armed — the site is still LIVE. It closes on its own in ${clockFrom(
      start - now,
    )}, at ${startLabel}. Players inside the warning lead see a countdown banner.`;
  } else {
    const end = endsAt ? new Date(endsAt).getTime() : NaN;
    const remainingMs = Number.isFinite(end) ? end - now : NaN;

    if (!endsAt) {
      // No duration was set. Saying so is more useful than showing nothing —
      // otherwise the missing clock reads as a bug.
      body = "Live — no countdown set. Players see the curtain with no clock.";
    } else if (Number.isFinite(remainingMs) && remainingMs > 0) {
      body = `Live — ${clockFrom(remainingMs)} remaining on the countdown players see.`;
    } else {
      // Overrun. The player-facing clock has already hidden itself; this is the
      // reminder that nothing lifts the curtain automatically.
      body =
        "Live — the estimated window has passed. The site stays down until you switch this off.";
    }
  }

  const Icon = tone === "broken" ? AlertTriangle : Clock;

  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 ${TONES[tone]}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${ICON_TONES[tone]}`} />
      <p className="text-xs leading-relaxed tabular-nums">{body}</p>
    </div>
  );
}
