import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { reportsApi } from "@/api/reports/reports";
import { toReportDay } from "@/lib/utils";

export interface DashboardStats {
  totalWinLoss?: string;
  totalWinLossCoins?: string;
  totalWinLossCash?: string;
  totalDeposits?: string;
  /** Gross Deposits split by source; the parts sum to totalDeposits. */
  depositBreakdown?: {
    payin: string;
    bundlePurchase: string;
    subscription: string;
    /** The same total split by the rail it was charged through. */
    breeze: string;
    coinflow: string;
    /**
     * Deposits whose payment reference matches neither rail.
     * breeze + coinflow + other === totalDeposits.
     */
    other?: string;
    /** Subscription revenue named per plan; empty when none sold. */
    subscriptionPlans?: { plan: string; amount: string }[];
    /** Admin-entered credits — reported beside Gross Deposits, not inside it. */
    manualDeposit: string;
    /** Approved manual deposits + balance-edit increases (SC). */
    manualCredit?: string;
    /** Balance-edit decreases / top outs (SC). */
    manualDebit?: string;
  };
  /** Gross Deposits per rail, per day; the days sum to depositBreakdown. */
  depositRailSeries?: { date: string; breeze: string; coinflow: string; other?: string }[];
  totalWithdrawals?: string;
  /** Gross Withdrawals split by payout rail; the parts sum to totalWithdrawals. */
  withdrawalBreakdown?: {
    breeze: string;
    coinflow: string;
    other: string;
  };
  /** Gross Withdrawals per rail, per day the money left. */
  withdrawalRailSeries?: { date: string; breeze: string; coinflow: string }[];
  /** The two sides of GGR per day, Wulf Cash only. */
  ggrSeries?: { date: string; bet: string; win: string }[];
  // Slice of totalWithdrawals already released to the payout provider but not
  // yet confirmed settled — money gone, not yet landed in the player's account.
  withdrawalsInFlight?: string;
  // Redeems requested and owed but NOT yet released to a payout provider.
  // Deliberately NOT date-scoped by the backend — an outstanding liability does
  // not stop existing because the dashboard is showing "Today".
  pendingPayouts?: string;
  /**
   * Live totals across every player wallet (not period-bound). `redeemable` is
   * the sum of each player's "Available to Withdraw".
   */
  playerBalances?: {
    wulfCash: string;
    wulfCoin: string;
    bonusWulfCash: string;
    redeemable: string;
    holders: number;
  };
  pendingPayoutCount?: number;
  /** What the pending money is waiting for; the parts sum to pendingPayouts. */
  pendingPayoutBreakdown?: {
    awaitingReview: string;
    awaitingReviewCount: number;
    awaitingRelease: string;
    awaitingReleaseCount: number;
    /** The same total split by the rail it is headed for. */
    breeze: string;
    coinflow: string;
    unassigned: string;
  };
  /** Outstanding amount by the day it was requested, oldest first. */
  pendingPayoutSeries?: {
    date: string;
    amount: string;
    count: number;
    /** The two queues behind `amount`; they sum to it exactly. */
    awaitingReview: string;
    awaitingRelease: string;
  }[];
  // Wager volume and winnings are reported per money bucket — Wulf Cash (real
  // money, incl. bonus Wulf Cash) and Wulf Coins (virtual). The plain fields are
  // the legacy combined totals and must never be shown as a money figure.
  totalValidBuyIn?: string;
  totalValidBuyInCoins?: string;
  totalValidBuyInCash?: string;
  totalBetCoins?: string;
  totalBetCash?: string;
  /** Handle per game category, biggest first; cash and coin kept apart. */
  betCategoryBreakdown?: { category: string; cash: string; coin: string }[];
  totalWin?: string;
  totalWinCoins?: string;
  totalWinCash?: string;
  totalUserCount?: number;
  newRegisteredCount?: number;
  firstDepositUserCount?: number;
  totalAgentCount?: number;
  /** The network behind the headline count. */
  agentBreakdown?: {
    agents: number;
    subAgents: number;
    playersByAgent: number;
    playersBySubAgent: number;
    /** The referral programme: players who refer, and their reach. */
    playerReferrers: number;
    playersByPlayer: number;
  };
  totalProviderCount?: number;
  activePlayerCount?: number;
  totalApprovedKycCount?: number;
  totalMedalClaimsCount?: number;
  totalGameCount?: number;
  totalTaxVerifiedCount?: number;
  totalSeonAllowCount?: number;
  totalSeonBlockCount?: number;
  /** Period bonus spend, as strings with 2 decimals. */
  totalBonusAmount?: string;
  totalBonusCount?: number;
  totalBundleBonusAmount?: string;
  totalBundleDiscountAmount?: string;
  totalBundleGrantCount?: number;
  totalFreeSpinAmount?: string;
  totalFreeSpinCount?: number;
  activities?: any[];
  /**
   * When the backend computed these figures, and whether that copy is older
   * than its freshness window (a newer one is being computed server-side).
   */
  cacheMeta?: { generatedAt: string; stale: boolean };
}

interface DashboardState {
  // Stats
  stats: DashboardStats | null;
  /** True only while there is nothing to show yet — drives the skeletons. */
  loading: boolean;
  /** True while newer figures are being fetched behind the ones on screen. */
  refreshing: boolean;
  error: string | null;

  // Filters
  refreshKey: number;
  searchQuery: string;
  activeFilter: string;
  fromDate: Date | undefined;
  toDate: Date | undefined;
}

interface DashboardActions {
  // Stats Actions
  /**
   * `force` asks the backend to recompute instead of serving its cached copy
   * (the Refresh button). `attempt` is internal: the follow-up count while the
   * backend reports its copy as stale.
   */
  fetchStats: (options?: { force?: boolean; attempt?: number }) => Promise<void>;
  /** Stops any request or follow-up in flight — call when the dashboard unmounts. */
  cancelStats: () => void;

  // Filter Actions
  setRefreshKey: () => void;
  setSearchQuery: (query: string) => void;
  setActiveFilter: (filter: string) => void;
  setFromDate: (date: Date | undefined) => void;
  setToDate: (date: Date | undefined) => void;
  setDates: (from: Date | undefined, to: Date | undefined) => void;
  
  reset: () => void;
}

type DashboardStore = DashboardState & DashboardActions;

/** The dashboard's preset buttons, in display order. */
export const DASHBOARD_PRESETS = ["All", "Last Month", "Last Week", "Yesterday", "Today"];

/*
  The date range a preset button applies, or null for an unknown name.

  Every preset is built from explicit y/m/d parts rather than by mutating a
  `new Date()` in place. Two bugs came out of the mutating version:

    Last Month  `start.setMonth(now.getMonth() - 1)` before pinning the day.
                On the 29th–31st the target month is shorter, so the date
                overflowed forward — 31 Mar → "31 Feb" → 3 Mar — and the
                later setDate(1) then pinned the WRONG month.

    Last Week   `now.getDate() - now.getDay() - 6` treats Sunday as day 0 of
                the coming week, so every Sunday the range slid forward and
                "Last Week" showed the current Mon–Sun instead.

  Weeks run Monday–Sunday, matching the ranges the reports already display.
  Shared by the buttons and the background prefetch, so both ask for exactly
  the same range.
*/
export const presetRange = (filter: string, now = new Date()): [Date, Date] | null => {
  const startOfDay = (y: number, m: number, d: number) => new Date(y, m, d, 0, 0, 0, 0);
  const endOfDay = (y: number, m: number, d: number) => new Date(y, m, d, 23, 59, 59, 999);
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  // Days since Monday: JS Sunday is 0, which is 6 days into a Mon-start week.
  const sinceMonday = (now.getDay() + 6) % 7;

  switch (filter) {
    case "All":
      // From January 1, 2026 to current moment (the relevant operational period)
      return [startOfDay(2026, 0, 1), now];
    case "Today":
      return [startOfDay(y, m, d), now];
    case "Yesterday":
      return [startOfDay(y, m, d - 1), endOfDay(y, m, d - 1)];
    case "Last Week":
      return [startOfDay(y, m, d - sinceMonday - 7), endOfDay(y, m, d - sinceMonday - 1)];
    case "Last Month":
      // Day 0 of a month is the last day of the one before it.
      return [startOfDay(y, m - 1, 1), endOfDay(y, m, 0)];
    default:
      return null;
  }
};

/** Request params for a range. Date-only: the API reads it as a calendar day. See toReportDay. */
const rangeParams = (from?: Date, to?: Date) => {
  const params: { startDate?: string; endDate?: string; fresh?: string } = {};
  if (from) params.startDate = toReportDay(from);
  if (to) params.endDate = toReportDay(to);
  return params;
};

const rangeKeyOf = (params: { startDate?: string; endDate?: string }) =>
  `${params.startDate ?? ""}|${params.endDate ?? ""}`;

// Helper to get start of day
const getStartOfDay = (year: number, month: number, day: number) => {
  const date = new Date(year, month, day);
  date.setHours(0, 0, 0, 0);
  return date;
};

// Start of the current week (Monday), used as the default "This Week" range.
const initialState: DashboardState = {
  stats: null,
  loading: false,
  refreshing: false,
  error: null,
  refreshKey: 0,
  searchQuery: "",
  // Opens on January 2026 to Today. The dashboard default shows data from
  // the start of 2026 until now, which represents the relevant operational period.
  activeFilter: "All",
  fromDate: getStartOfDay(2026, 0, 1), // January 1, 2026
  toDate: new Date(), // Current moment
};

/*
  Only the newest stats request may write to the store.

  Switching Today → All used to leave both requests racing: when the slow "All"
  failed, Today's figures stayed on screen under the "All" button, and when an
  older request resolved last it overwrote the range the user had just picked.
  The previous request is aborted, and any response that is not the latest is
  dropped. Kept outside the store state — neither is something to render.
*/
let statsController: AbortController | null = null;
let statsRequestId = 0;
let staleFollowUp: ReturnType<typeof setTimeout> | null = null;

/*
  Last figures received per date range, for this browser tab.

  Switching Today → All → Today used to show skeletons and wait for the server
  every time, and so did every return to the dashboard. The range's last figures
  now paint immediately and the request runs behind them. Only an entry for the
  SAME range is ever shown — another range's numbers never stand in.
*/
const STATS_CACHE_LIMIT = 12;
const statsCache = new Map<string, DashboardStats>();
const rememberStats = (key: string, stats: DashboardStats) => {
  statsCache.delete(key);
  statsCache.set(key, stats);
  if (statsCache.size > STATS_CACHE_LIMIT) {
    statsCache.delete(statsCache.keys().next().value as string);
  }
};

/*
  The backend answers instantly with its cached copy and recomputes a stale one
  in the background. While it says `stale`, ask again shortly so the newer
  figures replace the old ones without anyone pressing Refresh — bounded, so a
  recompute that keeps failing does not poll forever.
*/
const STALE_FOLLOW_UP_MS = 5_000;
const STALE_FOLLOW_UP_MAX = 6;

const clearStaleFollowUp = () => {
  if (staleFollowUp) clearTimeout(staleFollowUp);
  staleFollowUp = null;
};

/*
  Warm the other preset ranges once the visible one has loaded.

  The first click on each preset used to wait for a full computation (several
  seconds on production volume), and only the SECOND visit was instant. The
  presets are fetched here one at a time, cheapest first, behind the figures on
  screen: each lands in this tab's cache and warms the backend's shared cache
  for every other admin. A preset already cached is skipped, and clicking it
  still revalidates, so a prefetched figure is never left unrefreshed.

  Sequential on purpose — this is background work and must not stack several
  full computations onto the database at once.
*/
const PREFETCH_ORDER = ["Today", "Yesterday", "Last Week", "Last Month", "All"];
let prefetchController: AbortController | null = null;

const prefetchPresets = async () => {
  if (prefetchController) return;
  const controller = new AbortController();
  prefetchController = controller;
  try {
    for (const filter of PREFETCH_ORDER) {
      if (controller.signal.aborted) return;
      const range = presetRange(filter);
      if (!range) continue;
      const params = rangeParams(range[0], range[1]);
      const key = rangeKeyOf(params);
      if (statsCache.has(key)) continue;
      try {
        const res = await reportsApi.getDashboardStats(params, { signal: controller.signal });
        rememberStats(key, res.data as unknown as DashboardStats);
      } catch {
        // Best-effort: a preset that fails simply loads when it is clicked.
        if (controller.signal.aborted) return;
      }
    }
  } finally {
    if (prefetchController === controller) prefetchController = null;
  }
};

export const useDashboardStore = create<DashboardStore>()(
  devtools((set, get) => ({
    ...initialState,

    fetchStats: async (options = {}) => {
      const { force = false, attempt = 0 } = options;
      const { fromDate, toDate } = get();
      const requestId = ++statsRequestId;
      statsController?.abort();
      clearStaleFollowUp();
      const controller = new AbortController();
      statsController = controller;

      const params = rangeParams(fromDate, toDate);
      const rangeKey = rangeKeyOf(params);
      if (force) params.fresh = "1";

      const known = statsCache.get(rangeKey);
      if (known) {
        // This range's last figures stay on screen while newer ones load.
        set({ stats: known, loading: false, refreshing: true, error: null });
      } else {
        // Nothing for this range yet — clear rather than show another range's.
        set({ stats: null, loading: true, refreshing: false, error: null });
      }

      try {
        const res = await reportsApi.getDashboardStats(params, {
          signal: controller.signal,
        });
        if (requestId !== statsRequestId) return;
        const stats = res.data as unknown as DashboardStats;
        rememberStats(rangeKey, stats);
        set({ stats, loading: false, refreshing: false, error: null });

        // The visible range is on screen — warm the other presets behind it.
        void prefetchPresets();

        if (stats.cacheMeta?.stale && attempt < STALE_FOLLOW_UP_MAX) {
          staleFollowUp = setTimeout(() => {
            staleFollowUp = null;
            if (requestId === statsRequestId) get().fetchStats({ attempt: attempt + 1 });
          }, STALE_FOLLOW_UP_MS);
        }
      } catch (err: any) {
        // Superseded by a newer request (aborted or not) — that one owns the state.
        if (requestId !== statsRequestId) return;
        const message =
          err?.code === "ECONNABORTED" || err?.code === "ETIMEDOUT"
            ? "Dashboard stats took too long to load. Please retry."
            : err?.response?.data?.message || err?.message || "Failed to fetch dashboard stats";
        set({
          // Keep this range's last figures if there are any; never another range's.
          stats: known ?? null,
          loading: false,
          refreshing: false,
          error: known ? `${message} Showing the last figures loaded.` : message,
        });
      } finally {
        if (statsController === controller) statsController = null;
      }
    },

    cancelStats: () => {
      statsRequestId++;
      statsController?.abort();
      statsController = null;
      prefetchController?.abort();
      prefetchController = null;
      clearStaleFollowUp();
      set({ loading: false, refreshing: false });
    },

    // Bumps the key only. The dashboard's KpiCards fetches when it changes;
    // fetching here as well sent every refresh twice, and — because the global
    // header Refresh calls this on every admin page — ran the full dashboard
    // aggregation on pages that never show it.
    setRefreshKey: () => {
      set((state) => ({ refreshKey: state.refreshKey + 1 }));
    },

    setSearchQuery: (searchQuery) => set({ searchQuery }),

    setActiveFilter: (activeFilter) => set({ activeFilter }),

    // Set one end without querying. The date filter picks a whole range in one
    // calendar and commits it through setDates on Apply, so these deliberately
    // do NOT fetch: firing on each end separately would query once for a range
    // whose other end is still the previous value.
    setFromDate: (fromDate) => {
        set({ fromDate });
    },

    setToDate: (toDate) => {
        set({ toDate });
    },

    // Commits the range only; KpiCards refetches on the change (see setRefreshKey).
    setDates: (fromDate, toDate) => {
        set({ fromDate, toDate });
    },

    reset: () => set(initialState),
  }), {
    name: "DashboardStore"
  })
);
