import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * The calendar day a picked Date names, as `yyyy-MM-dd`.
 *
 * Report endpoints cut their days in UTC and read a date-only value as that
 * calendar day outright. Sending `date.toISOString()` instead handed them an
 * INSTANT: local midnight east of Greenwich is the previous UTC day, so a
 * "Yesterday" preset asked the API for a two-day window while the report
 * screens — which send `yyyy-MM-dd` — asked for one. Same preset, two windows,
 * and the Dashboard's GGR could never match the Win/Loss report's.
 *
 * Formatting from the LOCAL parts keeps the day the admin actually picked.
 */
export function toReportDay(date?: Date | null): string | undefined {
  if (!date) return undefined;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Inclusive start of the picked day, as a UTC instant. */
export function utcDayStartISO(date?: Date | null): string | undefined {
  const day = toReportDay(date ?? undefined);
  return day ? `${day}T00:00:00.000Z` : undefined;
}

/**
 * Inclusive end of the picked day, as a UTC instant.
 *
 * Endpoints that compare the value raw (`createdAt <= :end`) need the last
 * millisecond of the day: handed a bare date they parse it as midnight and drop
 * everything that happened after it — the whole day, in practice.
 */
export function utcDayEndISO(date?: Date | null): string | undefined {
  const day = toReportDay(date ?? undefined);
  return day ? `${day}T23:59:59.999Z` : undefined;
}

/**
 * A timestamp rendered in UTC — the zone every report cuts its days in.
 *
 * Money screens are read against the reports: a deposit listed at "Sep 5 02:29"
 * in IST is UTC Sep 4, so it counts on the Daily Report's previous row. Showing
 * these logs in the viewer's zone made two correct screens look like they
 * disagreed — 280 of purchases on the log against 70 on the report for the same
 * "today". Rendering in UTC, labelled, means a row's visible date is the day it
 * is counted in.
 */
export function formatUtcDateTime(value?: string | Date | null): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date}, ${time} UTC`;
}

/** Same instant with seconds, for detail panes. */
export function formatUtcDateTimeFull(value?: string | Date | null): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleString("en-US", { timeZone: "UTC" })} UTC`;
}

/**
 * Compact number for stat cards. Shows the full number while it fits in 4 digits
 * (abs < 10,000, e.g. 8,352), then abbreviates with K / M / B / T keeping ~4
 * significant digits (e.g. 24,326 → 24.33K, 7,305,714 → 7.31M).
 */
export function formatStat(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs < 10_000) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
  }
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(n);
}

export const formatDate = (dateString :string | undefined, useColumn = true) => {
    if (!dateString) return 'TBA';
    const date = new Date(dateString);

    // Local Format: DD MMM YYYY, HH:mm
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day} ${month} ${year}, ${hours}:${minutes}`;
};
