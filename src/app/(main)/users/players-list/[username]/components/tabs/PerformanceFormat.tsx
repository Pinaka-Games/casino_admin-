import { useEffect, useState } from "react";
import type { StaticImageData } from "next/image";
import { coingold, coingreen } from "@/assets/icons";
import { formatStat } from "@/lib/utils";
import type { ReportCurrency } from "@/api/reports/reports";

/**
 * Number and date formatting shared by the Performance tab's pieces.
 *
 * USD (deposits, redeems) always prints in full with cents; Wulf Cash prints in
 * full with 2 decimals; Wulf Coins are compacted like every other report does,
 * because coin balances run to millions and nobody reads them to the cent.
 */

export const EMPTY = "—";

/**
 * Coerces an API figure to a finite number. Postgres numerics can arrive as
 * strings if a query forgets its cast, and `-0` would otherwise print "-0".
 */
export function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n || 0 : 0;
}

const isMissing = (value: unknown) =>
  value === null || value === undefined || value === "";

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const CASH = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const COUNT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const PCT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const fmtUsd = (v: number | null | undefined) =>
  isMissing(v) ? EMPTY : USD.format(num(v));

export const fmtCount = (v: number | null | undefined) =>
  isMissing(v) ? EMPTY : COUNT.format(num(v));

export const fmtPct = (v: number | null | undefined) =>
  isMissing(v) ? EMPTY : `${PCT.format(num(v))}%`;

/** A figure in the selected bucket: Wulf Cash in full, Wulf Coins compact. */
export function fmtAmount(
  v: number | null | undefined,
  currency: ReportCurrency,
): string {
  if (isMissing(v)) return EMPTY;
  return currency === "wulfCoin" ? formatStat(num(v)) : CASH.format(num(v));
}

/**
 * Leading "+" on gains, so a signed figure reads the same without its colour.
 * Skipped when the text rounds to zero (0.4 coins compacts to "0"): "+0" reads
 * as a gain that is not there.
 */
export const withSign = (text: string, v: number | null | undefined) =>
  num(v) > 0 && /[1-9]/.test(text) ? `+${text}` : text;

export const signedTone = (v: number | null | undefined) => {
  const n = num(v);
  if (n > 0) return "text-[#04AD37]";
  if (n < 0) return "text-red-500";
  return "text-white";
};

export const CURRENCY_META: Record<
  ReportCurrency,
  { label: string; short: string; icon: StaticImageData }
> = {
  wulfCash: { label: "Wulf Cash", short: "SC", icon: coingreen },
  wulfCoin: { label: "Wulf Coins", short: "GC", icon: coingold },
};

/**
 * Dates render in UTC: the ranges and daily buckets are cut in UTC, so a
 * deposit shown as "Sep 4" must be the one counted on the Sep 4 bar.
 */
export function fmtUtcDate(value: string | null | undefined): string {
  if (!value) return EMPTY;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return EMPTY;
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── yyyy-MM-dd day keys, handled as UTC epoch days so DST never shifts them ──

const DAY_MS = 86_400_000;

export function dayKeyToMs(day: string): number {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, (m || 1) - 1, d || 1);
}

export function msToDayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export const addDays = (day: string, n: number) =>
  msToDayKey(dayKeyToMs(day) + n * DAY_MS);

export const daysBetween = (from: string, to: string) =>
  Math.round((dayKeyToMs(to) - dayKeyToMs(from)) / DAY_MS);

export function fmtDayKey(
  day: string,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
): string {
  return new Date(dayKeyToMs(day)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    ...opts,
  });
}

/**
 * Whole UTC days from a date (yyyy-MM-dd or an ISO instant) to `now`. Counted
 * on day boundaries, the way the server counts `daysInactive`, so "yesterday"
 * never turns into "0 days" a few hours after midnight.
 */
export function daysSince(value: string | null | undefined, now: number): number | null {
  if (!value) return null;
  const at = /^\d{4}-\d{2}-\d{2}$/.test(value) ? dayKeyToMs(value) : new Date(value).getTime();
  if (!Number.isFinite(at)) return null;
  return Math.max(0, daysBetween(msToDayKey(at), msToDayKey(now)));
}

export function fmtDaysAgo(days: number | null | undefined): string {
  if (days == null) return EMPTY;
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${COUNT.format(days)} days ago`;
}

/**
 * VIP tier as its NAME only ("Silver", never "Silver L3"). The API sends the
 * level separately; the suffix strip is a guard in case a name ever carries it.
 */
export function tierNameOnly(name: string | null | undefined): string | null {
  const clean = (name ?? "").replace(/\s*[·-]?\s*L\d+$/i, "").trim();
  return clean || null;
}

/** Re-renders on an interval so "updated 3 minutes ago" does not freeze. */
export function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
