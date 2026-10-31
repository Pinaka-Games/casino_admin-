import { create } from "zustand";
import axios from "axios";
import {
  playerPerformanceApi,
  type PerformanceActivity,
  type PerformanceSortKey,
  type PerformanceThresholdKey,
  type PerformanceThresholds,
  type PlayerPerformanceListResponse,
  type PlayerPerformanceQuery,
  type PlayerSource,
  type PlayerTag,
  type PlayerTrend,
} from "@/api/player-performance/player-performance.api";
import type { ReportCurrency } from "@/api/reports/reports";
import { toReportDay } from "@/lib/utils";

export type ThresholdParam = `${PerformanceThresholdKey}${"Min" | "Max"}`;
export type Thresholds = PerformanceThresholds;
export type SortDir = "asc" | "desc";

export interface PerformanceFilters {
  /** ReportFilterDrawer preset key ("all", "last7", …, "custom"). */
  datePreset: string;
  startDate?: Date;
  endDate?: Date;
  /** VIP tier by NAME across all its levels ("Silver" = Silver L1–L3), or "all". */
  tierName: string;
  status: "all" | NonNullable<PlayerPerformanceQuery["status"]>;
  rgStatus: "all" | NonNullable<PlayerPerformanceQuery["rgStatus"]>;
  kyc: "all" | NonNullable<PlayerPerformanceQuery["kyc"]>;
  source: "all" | PlayerSource;
  activity: PerformanceActivity;
  /** Only players carrying this behaviour tag. */
  tag: "all" | PlayerTag;
  /** Only players heading this way. */
  trend: "all" | PlayerTrend;
  /** Played a game whose name contains this (trimmed); "" = any game. */
  game: string;
  thresholds: Thresholds;
}

export const DEFAULT_PERFORMANCE_FILTERS: PerformanceFilters = {
  datePreset: "all",
  startDate: undefined,
  endDate: undefined,
  tierName: "all",
  status: "all",
  rgStatus: "all",
  kyc: "all",
  source: "all",
  activity: "active",
  tag: "all",
  trend: "all",
  game: "",
  thresholds: {},
};

export type PresetId =
  | "all"
  | "topDepositors"
  | "highestWagered"
  | "biggestWinners"
  | "biggestLosers"
  | "topRedeemers"
  | "netRevenue";

export interface PerformancePreset {
  id: PresetId;
  label: string;
  /** Chip tooltip: what the view answers. */
  description: string;
  sortBy: PerformanceSortKey;
  sortDir: SortDir;
  activity: PerformanceActivity;
  thresholds?: Thresholds;
  /** Narrows to one behaviour tag; the next preset takes it back out. */
  tag?: PlayerTag;
  /** Narrows to one trend; the next preset takes it back out. */
  trend?: PlayerTrend;
  /** Bonus/deposit ratio only exists for Wulf Cash. */
  cashOnly?: boolean;
}

export const PERFORMANCE_PRESETS: PerformancePreset[] = [
  {
    id: "all",
    label: "All Players",
    description: "Everyone active in the range, biggest depositors first.",
    sortBy: "depositUsd",
    sortDir: "desc",
    activity: "active",
  },
  {
    id: "topDepositors",
    label: "Top Depositors",
    description: "Players who deposited in the range, by USD deposited.",
    sortBy: "depositUsd",
    sortDir: "desc",
    activity: "depositors",
  },
  {
    id: "highestWagered",
    label: "Highest Wagered",
    description: "Players by amount wagered in the range.",
    sortBy: "stake",
    sortDir: "desc",
    activity: "players",
  },
  // A 0.01 floor rather than 0 so break-even players don't pad either list.
  {
    id: "biggestWinners",
    label: "Biggest Winners",
    description: "Players who won more than they wagered, biggest profit first.",
    sortBy: "playerPl",
    sortDir: "desc",
    activity: "active",
    thresholds: { playerPlMin: 0.01 },
  },
  {
    id: "biggestLosers",
    label: "Biggest Losers",
    description: "Players the platform won the most from (GGR).",
    sortBy: "ggr",
    sortDir: "desc",
    activity: "active",
    thresholds: { ggrMin: 0.01 },
  },
  {
    id: "topRedeemers",
    label: "Top Redeemers",
    description: "Players by USD redeemed in the range.",
    sortBy: "redeemUsd",
    sortDir: "desc",
    activity: "redeemers",
  },
  {
    id: "netRevenue",
    label: "Net Revenue",
    description: "Players by net gaming revenue (GGR − bonus).",
    sortBy: "ngr",
    sortDir: "desc",
    activity: "active",
  },
];

export const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

/** Text columns read A→Z on the first click; every metric asks "who has the most". */
const ASC_FIRST = new Set<PerformanceSortKey>(["email", "username"]);

/**
 * What a request is replacing, which decides what dims while it runs:
 *  - full       : the filters, sort or currency changed — cards, totals and table
 *  - page       : only the rows (page / page size); the summary cannot change
 *  - background : the view on screen is being revalidated — nothing dims
 */
export type LoadingKind = "full" | "page" | "background";

interface PlayerPerformanceState {
  filters: PerformanceFilters;
  /** The applied (debounced, trimmed) search — the input's live text lives on the page. */
  search: string;
  sortBy: PerformanceSortKey;
  sortDir: SortDir;
  preset: PresetId | "custom";
  /** Thresholds the last preset put in place, so the next preset can take them back out. */
  presetThresholds: Thresholds;
  /** Tag / trend the last preset put in place, likewise. */
  presetTag: PlayerTag | null;
  presetTrend: PlayerTrend | null;
  currency: ReportCurrency;
  page: number;
  limit: number;
  /**
   * What is on screen. Kept through every refetch so nothing blanks — the page
   * dims it while `loading` says it no longer answers the current query.
   */
  data: PlayerPerformanceListResponse | null;
  /** Cache key of the query `data` answers. */
  dataKey: string | null;
  loading: LoadingKind | null;
  /** The current query failed and nothing on screen answers it. */
  error: string | null;
  /** Revalidating the view on screen failed: its rows stay, but may be behind. */
  updateError: string | null;
}

interface PlayerPerformanceActions {
  fetch: (kind?: LoadingKind, opts?: { fresh?: boolean }) => Promise<void>;
  /** Aborts the in-flight request and every prefetch; the page calls it on unmount. */
  cancel: () => void;
  /** Re-reads the current view past both caches (server and client). */
  refresh: () => void;
  setFilters: (filters: PerformanceFilters) => void;
  setSearch: (search: string) => void;
  setGame: (game: string) => void;
  /** Filter to this tag; the same tag again clears it. */
  toggleTag: (tag: PlayerTag) => void;
  /** Filter to this trend; the same trend again clears it. */
  toggleTrend: (trend: PlayerTrend) => void;
  /** Search and every filter back to default, in one request. */
  clearAll: () => void;
  toggleSort: (key: PerformanceSortKey) => void;
  applyPreset: (id: PresetId) => void;
  setCurrency: (currency: ReportCurrency) => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  /** Hover intent: warm the cache with what a click would load. Silent, best-effort. */
  prefetchPreset: (id: PresetId) => void;
  prefetchTag: (tag: PlayerTag) => void;
  prefetchTrend: (trend: PlayerTrend) => void;
}

type PlayerPerformanceStore = PlayerPerformanceState & PlayerPerformanceActions;

const allPlayers = PERFORMANCE_PRESETS[0];

const initialState: PlayerPerformanceState = {
  filters: DEFAULT_PERFORMANCE_FILTERS,
  search: "",
  sortBy: allPlayers.sortBy,
  sortDir: allPlayers.sortDir,
  preset: "all",
  presetThresholds: {},
  presetTag: null,
  presetTrend: null,
  currency: "wulfCash",
  page: 1,
  limit: PAGE_SIZE_OPTIONS[0],
  data: null,
  dataKey: null,
  loading: null,
  error: null,
  updateError: null,
};

type QueryState = Pick<
  PlayerPerformanceState,
  "filters" | "search" | "sortBy" | "sortDir" | "currency" | "page" | "limit"
>;

/** Every query param the list endpoint reads, from the store's current state. */
export function buildPerformanceQuery(s: QueryState): PlayerPerformanceQuery {
  const f = s.filters;
  const query: PlayerPerformanceQuery = {
    // Report days are yyyy-MM-dd from the LOCAL picked date — never an instant.
    startDate: toReportDay(f.startDate),
    endDate: toReportDay(f.endDate),
    currency: s.currency,
    page: s.page,
    limit: s.limit,
    sortBy: s.sortBy,
    sortDir: s.sortDir,
    search: s.search || undefined,
    tierName: f.tierName !== "all" ? f.tierName : undefined,
    status: f.status !== "all" ? f.status : undefined,
    rgStatus: f.rgStatus !== "all" ? f.rgStatus : undefined,
    kyc: f.kyc !== "all" ? f.kyc : undefined,
    source: f.source !== "all" ? f.source : undefined,
    activity: f.activity,
    tag: f.tag !== "all" ? f.tag : undefined,
    trend: f.trend !== "all" ? f.trend : undefined,
    game: f.game || undefined,
  };
  for (const [param, value] of Object.entries(f.thresholds) as [ThresholdParam, number | undefined][]) {
    if (typeof value === "number" && Number.isFinite(value)) query[param] = value;
  }
  return query;
}

/**
 * Cache identity of a query: real values only, keys in a stable order, and
 * never `fresh` — a Refresh answers the same question, just newer.
 */
export function performanceQueryKey(query: PlayerPerformanceQuery): string {
  return JSON.stringify(
    Object.entries(query)
      .filter(([k, v]) => k !== "fresh" && v !== undefined && v !== null && v !== "")
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}

/**
 * The preset chip to highlight. A preset stays lit only while the state still
 * says what it set — once a header click or a drawer edit changes its sort,
 * activity, thresholds, tag or trend, the view is "custom" and the chip must
 * not claim it.
 */
export function resolveActivePreset(
  s: Pick<PlayerPerformanceState, "preset" | "sortBy" | "sortDir" | "filters">,
): PresetId | "custom" {
  if (s.preset === "custom") return "custom";
  const p = PERFORMANCE_PRESETS.find((x) => x.id === s.preset);
  if (!p) return "custom";
  const matches =
    p.sortBy === s.sortBy &&
    p.sortDir === s.sortDir &&
    p.activity === s.filters.activity &&
    (p.tag === undefined || s.filters.tag === p.tag) &&
    (p.trend === undefined || s.filters.trend === p.trend) &&
    (Object.entries(p.thresholds ?? {}) as [ThresholdParam, number][]).every(
      ([k, v]) => s.filters.thresholds[k] === v,
    );
  return matches ? p.id : "custom";
}

/** A message an admin can act on; the report pages used to swallow these. */
export function describePerformanceError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
      return "The leaderboard took too long to load. Try a narrower date range, or retry.";
    }
    if (!err.response) {
      return "Could not reach the server. Check your connection and retry.";
    }
    const status = err.response.status;
    if (status === 401 || status === 403) {
      return "You do not have permission to view player performance.";
    }
    const message = (err.response.data as { message?: unknown } | undefined)?.message;
    if (typeof message === "string" && message.trim()) return message;
    if (Array.isArray(message) && message.length) return message.join(", ");
    return `The server returned an error (${status}).`;
  }
  return err instanceof Error && err.message ? err.message : "Something went wrong.";
}

/* ------------------------------------------------------------------ */
/* Pure state transitions — shared by the actions and their prefetch   */
/* ------------------------------------------------------------------ */

type Patch = Partial<PlayerPerformanceState>;

/** New filters from anywhere but a preset: whatever the admin changed is theirs now. */
function filtersPatch(s: PlayerPerformanceState, filters: PerformanceFilters): Patch {
  const stillPresets = Object.fromEntries(
    (Object.entries(s.presetThresholds) as [ThresholdParam, number][]).filter(
      ([k, v]) => filters.thresholds[k] === v,
    ),
  ) as Thresholds;
  return {
    filters,
    presetThresholds: stillPresets,
    presetTag: s.presetTag && filters.tag === s.presetTag ? s.presetTag : null,
    presetTrend: s.presetTrend && filters.trend === s.presetTrend ? s.presetTrend : null,
    page: 1,
  };
}

function presetPatch(s: PlayerPerformanceState, id: PresetId): Patch | null {
  const preset = PERFORMANCE_PRESETS.find((p) => p.id === id);
  if (!preset) return null;
  if (preset.cashOnly && s.currency === "wulfCoin") return null;

  // Take back only what the previous preset added and nobody edited since,
  // so "Biggest Winners" → "Top Depositors" doesn't keep the P/L floor and
  // "Dormant" → "Top Depositors" doesn't keep listing dormant players only.
  const thresholds: Thresholds = { ...s.filters.thresholds };
  for (const [k, v] of Object.entries(s.presetThresholds) as [ThresholdParam, number][]) {
    if (thresholds[k] === v) delete thresholds[k];
  }
  Object.assign(thresholds, preset.thresholds ?? {});

  let tag = s.filters.tag;
  if (s.presetTag && tag === s.presetTag) tag = "all";
  if (preset.tag) tag = preset.tag;

  let trend = s.filters.trend;
  if (s.presetTrend && trend === s.presetTrend) trend = "all";
  if (preset.trend) trend = preset.trend;

  return {
    preset: preset.id,
    sortBy: preset.sortBy,
    sortDir: preset.sortDir,
    filters: { ...s.filters, activity: preset.activity, thresholds, tag, trend },
    presetThresholds: { ...(preset.thresholds ?? {}) },
    presetTag: preset.tag ?? null,
    presetTrend: preset.trend ?? null,
    page: 1,
  };
}

const tagPatch = (s: PlayerPerformanceState, tag: PlayerTag) =>
  filtersPatch(s, { ...s.filters, tag: s.filters.tag === tag ? "all" : tag });

const trendPatch = (s: PlayerPerformanceState, trend: PlayerTrend) =>
  filtersPatch(s, { ...s.filters, trend: s.filters.trend === trend ? "all" : trend });

/* ------------------------------------------------------------------ */
/* Client cache + prefetch                                             */
/* ------------------------------------------------------------------ */

/** Older than this, an entry is never shown. */
const CACHE_TTL_MS = 5 * 60_000;
/**
 * Younger than this, an entry is shown and trusted; older, it is shown and
 * re-asked. Matches the server: yesterday and today are read live, so a view
 * is only worth trusting for seconds.
 */
const REVALIDATE_AFTER_MS = 10_000;
const CACHE_MAX_ENTRIES = 60;
const MAX_PREFETCHES = 2;

interface CacheEntry {
  data: PlayerPerformanceListResponse;
  at: number;
}

interface Flight {
  key: string;
  controller: AbortController;
  promise: Promise<PlayerPerformanceListResponse>;
}

// Module scope, not state: they change on every request and nothing renders them.
// They also outlive the page, so coming back from a player is instant.
const cache = new Map<string, CacheEntry>();
/** Speculative requests nobody is waiting on yet. */
const prefetches = new Map<string, Flight>();
let mainFlight: Flight | null = null;
let requestSeq = 0;

function readCache(key: string): CacheEntry | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit;
}

function writeCache(key: string, data: PlayerPerformanceListResponse) {
  // Re-inserted so Map order stays oldest-first for eviction.
  cache.delete(key);
  cache.set(key, { data, at: Date.now() });
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Aborts every prefetch except the one for `keep` (which the next load may adopt). */
function cancelPrefetches(keep: string | null) {
  for (const [key, flight] of prefetches) {
    if (key === keep) continue;
    flight.controller.abort();
    prefetches.delete(key);
  }
}

function prefetchQuery(query: PlayerPerformanceQuery, shownKey: string | null) {
  const key = performanceQueryKey(query);
  if (key === shownKey || key === mainFlight?.key) return;
  if (prefetches.has(key) || prefetches.size >= MAX_PREFETCHES) return;
  const hit = readCache(key);
  if (hit && Date.now() - hit.at < REVALIDATE_AFTER_MS) return;

  const controller = new AbortController();
  const flight: Flight = {
    key,
    controller,
    promise: playerPerformanceApi.list(query, controller.signal),
  };
  prefetches.set(key, flight);
  flight.promise
    .then((data) => writeCache(key, data))
    .catch(() => {
      // Speculative: a failure costs nothing — the click just loads normally.
    })
    .finally(() => {
      if (prefetches.get(key) === flight) prefetches.delete(key);
    });
}

function prefetchState(s: PlayerPerformanceState, patch: Patch | null) {
  if (!patch) return;
  prefetchQuery(buildPerformanceQuery({ ...s, ...patch }), s.dataKey);
}

function prefetchNextPage(s: PlayerPerformanceState) {
  if (!s.data || s.page >= s.data.totalPages) return;
  prefetchQuery(buildPerformanceQuery({ ...s, page: s.page + 1 }), s.dataKey);
}

export const usePlayerPerformanceStore = create<PlayerPerformanceStore>((set, get) => ({
  ...initialState,

  /*
    The single place a request starts. Actions change state and call this
    exactly once; the page has no effect keyed on filters/page, which is what
    made the Win/Loss Detail page fetch every page change twice.

    Cached views render at once; older than a minute they are re-asked in the
    background. A prefetch already running for this exact view is adopted
    rather than started again, so a hover-then-click costs one request.
  */
  fetch: async (kind = "full", opts = {}) => {
    const fresh = opts.fresh === true;
    const query = buildPerformanceQuery(get());
    const key = performanceQueryKey(query);
    const seq = ++requestSeq;

    mainFlight?.controller.abort();
    mainFlight = null;
    // The view moved on: speculative loads for other views are now just load on the server.
    cancelPrefetches(fresh ? null : key);

    let loadKind = kind;
    if (fresh) {
      // Everything else cached predates what Refresh is about to show.
      cache.clear();
    } else {
      const hit = readCache(key);
      if (hit) {
        const trusted = Date.now() - hit.at < REVALIDATE_AFTER_MS;
        set({
          data: hit.data,
          dataKey: key,
          error: null,
          updateError: null,
          loading: trusted ? null : "background",
        });
        if (trusted) {
          prefetchNextPage(get());
          return;
        }
        loadKind = "background";
      }
    }
    set({ loading: loadKind, error: null, updateError: null });

    const adopted = fresh ? undefined : prefetches.get(key);
    let flight: Flight;
    if (adopted) {
      prefetches.delete(key);
      flight = adopted;
    } else {
      const controller = new AbortController();
      flight = {
        key,
        controller,
        promise: playerPerformanceApi.list(fresh ? { ...query, fresh: true } : query, controller.signal),
      };
    }
    mainFlight = flight;

    try {
      const data = await flight.promise;
      // Worth keeping even if superseded: going back to this view is then instant.
      writeCache(key, data);
      if (seq !== requestSeq) return;

      // The result set shrank under the current page (a refresh after players
      // dropped out of a threshold): land on the last real page, not a blank one.
      if (
        data.items.length === 0 &&
        data.total > 0 &&
        data.totalPages >= 1 &&
        get().page > data.totalPages
      ) {
        set({ page: data.totalPages });
        return get().fetch("page");
      }

      set({ data, dataKey: key, loading: null });
      prefetchNextPage(get());
    } catch (err) {
      // A superseded or cancelled request must not overwrite the newer one.
      if (seq !== requestSeq || axios.isCancel(err)) return;
      const message = describePerformanceError(err);
      if (get().dataKey === key) {
        // The rows on screen answer this very query (a cached view being
        // revalidated, or Refresh): keep them and say they may be behind.
        set({ loading: null, updateError: message });
      } else {
        // Drop the old rows: leaving them under the new filters would make a
        // failed request look like one that succeeded and matched the same players.
        set({ data: null, dataKey: null, loading: null, error: message });
      }
    } finally {
      if (mainFlight === flight) mainFlight = null;
    }
  },

  cancel: () => {
    mainFlight?.controller.abort();
    mainFlight = null;
    cancelPrefetches(null);
    requestSeq++;
    set({ loading: null });
  },

  refresh: () => {
    void get().fetch("full", { fresh: true });
  },

  setFilters: (filters) => {
    set(filtersPatch(get(), filters));
    void get().fetch("full");
  },

  setSearch: (search) => {
    const next = search.trim();
    if (next === get().search) return;
    set({ search: next, page: 1 });
    void get().fetch("full");
  },

  setGame: (game) => {
    const s = get();
    const next = game.trim();
    if (next === s.filters.game) return;
    set(filtersPatch(s, { ...s.filters, game: next }));
    void get().fetch("full");
  },

  toggleTag: (tag) => {
    set(tagPatch(get(), tag));
    void get().fetch("full");
  },

  toggleTrend: (trend) => {
    set(trendPatch(get(), trend));
    void get().fetch("full");
  },

  clearAll: () => {
    set({
      filters: DEFAULT_PERFORMANCE_FILTERS,
      presetThresholds: {},
      presetTag: null,
      presetTrend: null,
      search: "",
      page: 1,
    });
    void get().fetch("full");
  },

  toggleSort: (key) => {
    const { sortBy, sortDir, currency } = get();
    // Null on every Wulf Coin row, so the server's order would be arbitrary.
    if (key === "bonusRatioPct" && currency === "wulfCoin") return;
    const first: SortDir = ASC_FIRST.has(key) ? "asc" : "desc";
    const dir: SortDir = sortBy === key ? (sortDir === "desc" ? "asc" : "desc") : first;
    set({ sortBy: key, sortDir: dir, preset: "custom", page: 1 });
    void get().fetch("full");
  },

  applyPreset: (id) => {
    const patch = presetPatch(get(), id);
    if (!patch) return;
    set(patch);
    void get().fetch("full");
  },

  setCurrency: (currency) => {
    if (currency === get().currency) return;
    // Bonus/deposit % is null for every Wulf Coin row; keep the "who got the
    // most bonus" question by sorting on the coin bonus itself instead.
    const cashOnlySort = currency === "wulfCoin" && get().sortBy === "bonusRatioPct";
    set({
      currency,
      page: 1,
      ...(cashOnlySort ? { sortBy: "bonus" as const, sortDir: "desc" as const, preset: "custom" as const } : {}),
    });
    void get().fetch("full");
  },

  setPage: (page) => {
    if (page === get().page || page < 1) return;
    set({ page });
    void get().fetch("page");
  },

  setLimit: (limit) => {
    if (limit === get().limit) return;
    set({ limit, page: 1 });
    void get().fetch("page");
  },

  prefetchPreset: (id) => {
    const s = get();
    prefetchState(s, presetPatch(s, id));
  },

  prefetchTag: (tag) => {
    const s = get();
    prefetchState(s, tagPatch(s, tag));
  },

  prefetchTrend: (trend) => {
    const s = get();
    prefetchState(s, trendPatch(s, trend));
  },
}));
