"use client";

import { useEffect, useState } from "react";
import { formatDistance } from "date-fns";
import { formatUtcDateTime } from "@/lib/utils";

/** The rollup refreshes every few minutes; an hour behind means it has stalled. */
const STALE_AFTER_MS = 60 * 60 * 1000;

const clock = () => Date.now();

/**
 * "Gameplay figures updated 4 minutes ago". The current time is state, ticked
 * every 30s, so the phrase ages on screen — the React Compiler would otherwise
 * memoise it against `value` alone and freeze it at first render.
 */
export default function DataAsOf({
  value,
  loading,
}: {
  /** undefined = no response yet; null = the rollup has never run. */
  value: string | null | undefined;
  loading: boolean;
}) {
  const [now, setNow] = useState(clock);

  useEffect(() => {
    const id = setInterval(() => setNow(clock()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (value === undefined) {
    return <p className="text-xs text-gray-500">{loading ? "Loading gameplay figures…" : " "}</p>;
  }

  if (value === null) {
    return (
      <p className="text-xs text-amber-400">
        Gameplay figures have not been rolled up yet — gameplay columns may read zero.
      </p>
    );
  }

  const asOf = new Date(value);
  if (Number.isNaN(asOf.getTime())) {
    return <p className="text-xs text-gray-500">Gameplay figures: update time unknown</p>;
  }

  // A clock slightly behind the server would otherwise read "in a few seconds".
  const reference = Math.max(now, asOf.getTime());
  const stale = reference - asOf.getTime() > STALE_AFTER_MS;

  return (
    <p
      className={`text-xs ${stale ? "text-amber-400" : "text-gray-400"}`}
      title={`Gameplay rollup last refreshed ${formatUtcDateTime(value)}`}
    >
      Gameplay figures updated {formatDistance(asOf, reference, { addSuffix: true })}
      {stale && " — the rollup may be behind"}
    </p>
  );
}
