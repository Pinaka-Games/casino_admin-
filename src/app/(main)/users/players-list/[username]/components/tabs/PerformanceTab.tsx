"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { formatDistance } from "date-fns";
import { AlertTriangle, RefreshCw } from "lucide-react";
import {
  playerPerformanceApi,
  type PlayerPerformanceDetail,
} from "@/api/player-performance/player-performance.api";
import type { ReportCurrency } from "@/api/reports/reports";
import CurrencyToggle from "@/components/report/CurrencyToggle";
import { StatCardsSkeleton, TableSkeletonRows } from "@/components/report/ReportSkeleton";
import DatePicker from "@/components/DatePicker";
import NoData from "@/components/NoData";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toReportDay } from "@/lib/utils";
import { num, useNow } from "./PerformanceFormat";
import {
  BalancesSection,
  DepositFacts,
  GameplaySection,
  MoneySection,
  PerformanceHeader,
  ReferralsSection,
  RewardsSection,
} from "./PerformanceCards";
import PerformanceIntent from "./PerformanceIntent";
import PerformanceTrendChart from "./PerformanceTrendChart";
import { BonusBreakdown, TopGamesTable } from "./PerformanceTables";

type Preset =
  | "all"
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "thisMonth"
  | "lastMonth"
  | "custom";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "thisMonth", label: "This month" },
  { value: "lastMonth", label: "Last month" },
  { value: "custom", label: "Custom" },
];

interface DayRange {
  startDate?: string;
  endDate?: string;
}

/**
 * Presets resolve on the admin's local calendar, the same way the report
 * filter drawer does, and go out as yyyy-MM-dd days — never instants, which
 * the API would read as a different UTC window.
 */
function resolvePreset(preset: Preset): DayRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const day = (date: Date) => toReportDay(date);
  switch (preset) {
    case "today":
      return { startDate: day(now), endDate: day(now) };
    case "yesterday": {
      const yd = new Date(y, m, d - 1);
      return { startDate: day(yd), endDate: day(yd) };
    }
    case "last7":
      return { startDate: day(new Date(y, m, d - 6)), endDate: day(now) };
    case "last30":
      return { startDate: day(new Date(y, m, d - 29)), endDate: day(now) };
    case "thisMonth":
      return { startDate: day(new Date(y, m, 1)), endDate: day(now) };
    case "lastMonth":
      return {
        startDate: day(new Date(y, m - 1, 1)),
        endDate: day(new Date(y, m, 0)),
      };
    default:
      return {};
  }
}

/** Local midnight of a yyyy-MM-dd day, which is what DatePicker compares against. */
function parseDay(day?: string): Date | undefined {
  if (!day) return undefined;
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const isCancelled = (err: unknown) =>
  axios.isCancel(err) || (err as { code?: string })?.code === "ERR_CANCELED";

function describeError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const raw = (err.response?.data as { message?: unknown } | undefined)?.message;
    const message = Array.isArray(raw) ? raw.join(", ") : typeof raw === "string" ? raw : "";
    if (status === 403) return "You don't have permission to view player performance.";
    if (status === 404) {
      // Nest answers a route it doesn't have with "Cannot GET …": the API was
      // deployed without this endpoint, which is not "no such player".
      return /^Cannot [A-Z]+ /.test(message)
        ? "Player Performance isn't available on this server yet — the backend needs deploying."
        : "This player could not be found.";
    }
    if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
      return "The request timed out. Long ranges take longer to aggregate — retry, or pick a shorter range.";
    }
    return message || err.message || "Could not load performance.";
  }
  return err instanceof Error ? err.message : "Could not load performance.";
}

/** The rollup refreshes every few minutes; past this it has probably stalled. */
const ROLLUP_STALE_MS = 30 * 60_000;

function DataAsOf({ value }: { value: string | null }) {
  const now = useNow(30_000);
  if (!value) {
    return <span className="text-xs text-amber-400">Gameplay rollup has not run yet</span>;
  }
  const at = new Date(value).getTime();
  if (!Number.isFinite(at)) return null;
  // A server clock slightly ahead would otherwise read "in a few seconds".
  const shown = Math.min(at, now);
  const stale = now - at > ROLLUP_STALE_MS;
  return (
    <span
      className={`text-xs ${stale ? "text-amber-400" : "text-gray-400"}`}
      title={`${new Date(at).toUTCString()}${stale ? " — older than expected, gameplay may be behind" : ""}`}
    >
      Gameplay updated {formatDistance(shown, now, { addSuffix: true })}
      {/* Said in words too: the amber alone, and the title, reach neither
          colour-blind nor keyboard users. */}
      {stale ? " · may be behind" : null}
    </span>
  );
}

function hasActivity(d: PlayerPerformanceDetail): boolean {
  const t = d.totals;
  return (
    (d.daily?.length ?? 0) > 0 ||
    (d.games?.length ?? 0) > 0 ||
    (d.bonusBreakdown?.length ?? 0) > 0 ||
    [
      t.depositCount,
      t.redeemCount,
      t.rounds,
      t.bonus,
      t.manualCredit,
      t.adjustments,
      t.otherCredits,
      t.referrals,
      t.referralCommission,
      // Pending redeems are a snapshot and chargebacks all-time, but hiding
      // money owed or clawed back behind "no activity" would be worse than
      // showing an otherwise empty range.
      t.pendingRedeemUsd,
      d.deposits?.chargebackCount,
    ].some((v) => num(v) !== 0)
  );
}

function PerformanceSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading performance">
      <div className="space-y-4 rounded-xl border border-[#242B35] bg-[#191D24] p-4">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-40 animate-pulse rounded-lg bg-[#242B35]/60" />
          ))}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-white/5 pt-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-6 w-28 animate-pulse rounded-full bg-[#242B35]/60" />
          ))}
        </div>
      </div>
      <StatCardsSkeleton count={4} />
      <StatCardsSkeleton count={4} />
      <div className="h-90 animate-pulse rounded-xl border border-[#242B35] bg-[#191D24]" />
      <div className="overflow-hidden rounded-xl border border-[#242B35] bg-[#191D24]">
        <table className="w-full min-w-[760px]">
          <tbody>
            <TableSkeletonRows rows={5} cols={8} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── client cache ─────────────────────────────────────────────────────────────

interface Selection {
  preset: Preset;
  range: DayRange;
  currency: ReportCurrency;
}

interface CacheEntry {
  data: PlayerPerformanceDetail;
  /** Client clock when it arrived. */
  at: number;
}

/** Served from cache at all within this… */
const CACHE_TTL_MS = 5 * 60_000;
/** …and quietly re-asked for in the background once older than this. */
const REVALIDATE_AFTER_MS = 10_000;
const CACHE_MAX_ENTRIES = 40;

/**
 * Per (player, range, currency). Module scope so it outlives the tab being
 * switched away from and back — the point is that returning is instant.
 * Only effects, event handlers and the state initialiser touch it, never
 * render: the React Compiler memoises render on props and state and would not
 * see this map change.
 */
const detailCache = new Map<string, CacheEntry>();
/** The range and currency last looked at per player, restored on return. */
const lastSelection = new Map<string, Selection>();

const cacheKey = (userId: string, s: Selection) =>
  [userId, s.range.startDate ?? "", s.range.endDate ?? "", s.currency].join("|");

function readCache(key: string): CacheEntry | null {
  const hit = detailCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    detailCache.delete(key);
    return null;
  }
  return hit;
}

function writeCache(key: string, data: PlayerPerformanceDetail): CacheEntry {
  const entry = { data, at: Date.now() };
  // Re-inserting moves the key to the end, so the least recently loaded goes first.
  detailCache.delete(key);
  detailCache.set(key, entry);
  while (detailCache.size > CACHE_MAX_ENTRIES) {
    const oldest = detailCache.keys().next().value;
    if (oldest === undefined) break;
    detailCache.delete(oldest);
  }
  return entry;
}

let requestSeq = 0;

interface Shown {
  key: string;
  data: PlayerPerformanceDetail;
}

interface Pending {
  id: number;
  key: string;
  selection: Selection;
  /** Sent as `fresh=true`: the server skips its own response cache too. */
  fresh: boolean;
}

interface TabState {
  selection: Selection;
  /** What is on screen. Its key trails the selection while a load runs. */
  shown: Shown | null;
  /** The request the effect should be running; null when nothing is needed. */
  pending: Pending | null;
  failure: { key: string; message: string } | null;
}

interface PlanOptions {
  /** Ignore the client cache for this load. */
  bypassCache?: boolean;
  /** Also ask the server to skip its cache (Refresh). */
  fresh?: boolean;
}

/**
 * What selecting `selection` means right now: a cached answer is shown at
 * once (and re-asked for quietly when it is over a minute old); otherwise the
 * previous figures stay up, dimmed, until the new ones land.
 */
function plan(
  userId: string,
  selection: Selection,
  prevShown: Shown | null,
  opts: PlanOptions = {},
): Omit<TabState, "selection"> {
  const key = cacheKey(userId, selection);
  const hit = opts.bypassCache ? null : readCache(key);
  if (hit) {
    const stale = Date.now() - hit.at > REVALIDATE_AFTER_MS;
    return {
      shown: { key, data: hit.data },
      pending: stale ? { id: ++requestSeq, key, selection, fresh: false } : null,
      failure: null,
    };
  }
  return {
    shown: prevShown,
    pending: { id: ++requestSeq, key, selection, fresh: Boolean(opts.fresh) },
    failure: null,
  };
}

function initialSelection(userId: string): Selection {
  const saved = lastSelection.get(userId);
  if (!saved) return { preset: "all", range: {}, currency: "wulfCash" };
  // A preset is re-resolved so a range saved yesterday still means "today".
  return saved.preset === "custom" ? saved : { ...saved, range: resolvePreset(saved.preset) };
}

/**
 * Thin indeterminate bar across the top of the body while a load runs.
 *
 * `.animate-shimmer` is plain CSS in globals.css, outside any cascade layer,
 * so a layered `motion-reduce:animate-none` utility cannot override it. With
 * reduced motion the moving strip is hidden instead and a still bar shows.
 */
function LoadingBar() {
  return (
    <div
      role="progressbar"
      aria-label="Updating performance"
      className="relative h-0.5 w-full overflow-hidden rounded-full bg-[#B93DEB]/15"
    >
      <div className="absolute inset-0 animate-shimmer bg-linear-to-r from-transparent via-[#B93DEB] to-transparent motion-reduce:hidden" />
      <div className="absolute inset-0 hidden bg-[#B93DEB]/60 motion-reduce:block" />
    </div>
  );
}

/**
 * One player's performance over a range: money in and out, gameplay, rewards
 * and referrals, where they rank, what they are doing now, and how it moved
 * day by day.
 *
 * `username` is the player's UUID — the route segment is misnamed (see
 * PlayerTabs). Everything comes from one server aggregate; the other tabs pull
 * whole histories to the browser, which is too heavy to total here.
 */
export default function PerformanceTab({ username }: { username: string }) {
  // Keyed so moving to another player (e.g. the referrer link) starts clean
  // instead of showing the previous player's figures under the new one.
  return <PlayerPerformance key={username} userId={username} />;
}

function PlayerPerformance({ userId }: { userId: string }) {
  const [state, setState] = useState<TabState>(() => {
    const selection = initialSelection(userId);
    return { selection, ...plan(userId, selection, null) };
  });
  const { selection, shown, pending, failure } = state;
  const { preset, currency } = selection;
  const { startDate, endDate } = selection.range;

  useEffect(() => {
    if (!userId || !pending) return;
    const { id, key, fresh } = pending;
    const { range, currency: bucket } = pending.selection;
    const controller = new AbortController();

    playerPerformanceApi
      .detail(
        userId,
        {
          startDate: range.startDate,
          endDate: range.endDate,
          currency: bucket,
          fresh: fresh || undefined,
        },
        controller.signal,
      )
      .then((data) => {
        if (controller.signal.aborted) return;
        writeCache(key, data);
        setState((s) =>
          s.pending?.id === id
            ? { ...s, shown: { key, data }, pending: null, failure: null }
            : s,
        );
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isCancelled(err)) return;
        setState((s) =>
          s.pending?.id === id
            ? { ...s, pending: null, failure: { key, message: describeError(err) } }
            : s,
        );
      });

    // Aborting drops the superseded request; the id check above also keeps
    // any response that still lands from being shown against newer filters.
    return () => controller.abort();
  }, [pending, userId]);

  const key = cacheKey(userId, selection);
  const detail = shown?.data ?? null;
  /** The figures on screen are for what the controls say. */
  const current = shown?.key === key;
  const busy = pending !== null;
  const error = failure?.key === key ? failure.message : null;
  // Label the figures with the bucket they are in: while a currency switch
  // loads, the dimmed numbers on screen are still the previous currency's.
  const shownCurrency: ReportCurrency = detail?.currency ?? currency;

  const select = (next: Selection, opts?: PlanOptions) => {
    lastSelection.set(userId, next);
    setState({ selection: next, ...plan(userId, next, shown, opts) });
  };

  const changePreset = (next: Preset) => {
    if (next !== "custom") {
      select({ ...selection, preset: next, range: resolvePreset(next) });
      return;
    }
    // Custom opens on the range already on screen so both pickers are filled
    // and the query never goes out half-open.
    select({
      ...selection,
      preset: next,
      range: startDate && endDate ? selection.range : resolvePreset("last30"),
    });
  };

  // Clicking the selected day again clears it in the calendar; a range with
  // one open end is not something this tab asks for.
  const changeDay = (edge: "startDate" | "endDate", day: Date | undefined) => {
    if (!day) return;
    select({ ...selection, range: { ...selection.range, [edge]: toReportDay(day) } });
  };

  /**
   * Presets are re-resolved so a tab left open past midnight moves with the
   * day, and both caches are skipped so the button always means "right now".
   */
  const refresh = () => {
    const range = preset === "custom" ? selection.range : resolvePreset(preset);
    select({ ...selection, range }, { bypassCache: true, fresh: true });
  };

  const retry = () => select(selection, { bypassCache: true });

  return (
    <div className="min-w-0 space-y-5">
      {/* CONTROLS */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#242B35] bg-[#191D24] p-3">
        <Select value={preset} onValueChange={(v) => changePreset(v as Preset)}>
          <SelectTrigger
            aria-label="Date range"
            className="w-40 border-[#2A3340] bg-[#1A2027] text-white"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-[#2A3340] bg-[#1A2027] text-white">
            {PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {preset === "custom" ? (
          <div className="flex flex-wrap items-center gap-2">
            <DatePicker
              date={parseDay(startDate)}
              maxDate={parseDay(endDate)}
              onChange={(d) => changeDay("startDate", d)}
              className="w-[150px]"
            />
            <span className="text-xs text-gray-500">to</span>
            <DatePicker
              date={parseDay(endDate)}
              minDate={parseDay(startDate)}
              onChange={(d) => changeDay("endDate", d)}
              className="w-[150px]"
            />
          </div>
        ) : null}

        <div className="max-w-full overflow-x-auto">
          <CurrencyToggle
            value={currency}
            onChange={(next) => select({ ...selection, currency: next })}
          />
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={pending?.fresh === true}
          title="Reload from the server, skipping cached figures"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-[#2A3340] bg-[#1A2027] px-3 text-sm font-medium text-white transition-colors hover:bg-[#242B35] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={14} className={busy ? "animate-spin" : ""} aria-hidden="true" />
          Refresh
        </button>

        <div className="basis-full sm:ml-auto sm:basis-auto">
          {detail ? <DataAsOf value={detail.dataAsOf} /> : null}
        </div>
      </div>

      {/* BODY */}
      {error && !current ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-400" />
            <div>
              <p className="text-sm font-semibold text-red-200">
                Couldn&apos;t load this player&apos;s performance
              </p>
              <p className="mt-1 text-xs text-red-300/90">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={retry}
            className="shrink-0 rounded-md bg-red-500/20 px-4 py-2 text-xs font-semibold text-red-100 hover:bg-red-500/30"
          >
            Retry
          </button>
        </div>
      ) : !detail ? (
        // Skeletons only on the very first load; after that the last figures
        // stay on screen while the next ones arrive.
        <PerformanceSkeleton />
      ) : (
        <div className="space-y-3" aria-busy={busy}>
          <div className="h-0.5">{busy ? <LoadingBar /> : null}</div>

          {error ? (
            // A background re-check failed. The figures shown are this
            // range's, just not re-confirmed, so they stay up.
            <div
              role="status"
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
            >
              <span className="flex min-w-0 items-center gap-2">
                <AlertTriangle size={14} className="shrink-0 text-amber-400" />
                <span className="min-w-0">
                  Couldn&apos;t refresh — showing the figures loaded earlier. {error}
                </span>
              </span>
              <button
                type="button"
                onClick={retry}
                className="shrink-0 rounded-md bg-amber-500/20 px-3 py-1 font-semibold text-amber-100 hover:bg-amber-500/30"
              >
                Retry
              </button>
            </div>
          ) : null}

          <div
            className={`space-y-6 transition-opacity duration-200 ${
              current ? "opacity-100" : "pointer-events-none select-none opacity-50"
            }`}
          >
            <PerformanceHeader detail={detail} currency={shownCurrency} />

            <PerformanceIntent detail={detail} currency={shownCurrency} />

            {hasActivity(detail) ? (
              <>
                <MoneySection detail={detail} />
                <DepositFacts detail={detail} />
                <GameplaySection detail={detail} currency={shownCurrency} />
                <RewardsSection detail={detail} currency={shownCurrency} />
                <ReferralsSection detail={detail} />
                <PerformanceTrendChart detail={detail} currency={shownCurrency} />
                <div className="grid grid-cols-1 gap-4 2xl:grid-cols-3">
                  <div className="min-w-0 2xl:col-span-2">
                    <TopGamesTable games={detail.games ?? []} currency={shownCurrency} />
                  </div>
                  <BonusBreakdown lines={detail.bonusBreakdown ?? []} currency={shownCurrency} />
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-[#242B35] bg-[#191D24] py-10">
                <NoData title="No activity for this player in the selected range" />
              </div>
            )}

            <BalancesSection detail={detail} />
          </div>
        </div>
      )}
    </div>
  );
}
