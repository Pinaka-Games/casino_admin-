import api from "../config/axios.config";
import type { ReportCurrency } from "../reports/reports";

/**
 * Player Performance — one row per player, every money figure over the same
 * inclusive whole-day UTC range the other reports use.
 *
 * Deposits and redeems are real money (USD) and never follow the currency
 * toggle. Gameplay, bonus, manual credits and adjustments are reported in the
 * selected bucket only: Wulf Cash (wulfCash + bonusWulfCash) or Wulf Coin.
 * The two are never summed together.
 *
 * Gameplay figures come from a daily rollup the backend refreshes every few
 * minutes, so they can trail live play slightly — `dataAsOf` says how far.
 */

/**
 * Leaderboards aggregate every player's history, so they get more room than
 * the global 12s axios timeout — kept finite so a stuck request still errors.
 */
export const PLAYER_PERFORMANCE_TIMEOUT_MS = 60_000;

export type PerformanceSortKey =
  | "depositUsd"
  | "depositCount"
  | "maxDepositUsd"
  | "redeemUsd"
  | "redeemCount"
  | "pendingRedeemUsd"
  | "netDepositUsd"
  | "rounds"
  | "activeDays"
  | "stake"
  | "win"
  | "playerPl"
  | "ggr"
  | "holdPct"
  | "avgBet"
  | "maxWin"
  | "bonus"
  | "bonusRatioPct"
  | "ngr"
  | "manualCredit"
  | "adjustments"
  | "otherCredits"
  | "referrals"
  | "referralsQualified"
  | "referralCommission"
  | "lastPlayedAt"
  | "joinedAt"
  | "username"
  | "email"
  | "roundsWon"
  | "roundsLost"
  | "winRatePct"
  | "daysInactive"
  | "rounds7d"
  | "deposit7d"
  | "lastDepositDay"
  | "netRedeemUsd";

/** Metrics that accept a server-side `<metric>Min` / `<metric>Max` threshold. */
export type PerformanceThresholdKey =
  | "depositUsd"
  | "redeemUsd"
  | "netDepositUsd"
  | "rounds"
  | "stake"
  | "playerPl"
  | "ggr"
  | "bonus"
  | "referrals";

/**
 * Which players the list includes.
 *  - active (default): anyone who deposited, redeemed, played, received a
 *    bonus or brought a referral in the range
 *  - all: every player, including ones with nothing in the range
 *  - depositors / players / redeemers / referrers: narrower slices
 */
export type PerformanceActivity =
  | "active"
  | "all"
  | "depositors"
  | "players"
  | "redeemers"
  | "referrers";

/** How the player arrived: `users.referrer_id` resolved to its owner. */
export type PlayerSource = "direct" | "agent" | "subagent" | "player";

/**
 * Which way the player's activity is heading, from rounds played in the last
 * 7 days vs the 7 before (both currencies — rounds are activity, not money).
 * Always relative to today, whatever range the screen is showing.
 */
export type PlayerTrend =
  | "new"
  | "rising"
  | "steady"
  | "declining"
  | "dormant"
  | "inactive";

/**
 * Rule-based behaviour tags. Range-based rules use the selected range; money
 * rules read Wulf Cash / USD whatever the currency toggle says. Percentile
 * rules rank against ALL players, so search or filters never change them.
 */
export type PlayerTag =
  | "whale"
  | "high_roller"
  | "net_winner"
  | "bonus_hunter"
  | "low_play_redeemer"
  | "loss_chaser"
  | "new"
  | "dormant"
  | "suspicious_credits";

export const PLAYER_TREND_META: Record<
  PlayerTrend,
  { label: string; description: string }
> = {
  new: { label: "New", description: "Joined in the last 7 days." },
  rising: {
    label: "Rising",
    description:
      "Played at least 25% more rounds in the last 7 days than in the 7 before (or started playing again).",
  },
  steady: {
    label: "Steady",
    description: "Rounds in the last 7 days within 25% of the 7 before.",
  },
  declining: {
    label: "Declining",
    description:
      "Played at least 25% fewer rounds in the last 7 days than in the 7 before.",
  },
  dormant: {
    label: "Dormant",
    description: "No play, deposit or redeem for 14 days or more.",
  },
  inactive: {
    label: "Inactive",
    description: "Has never played, deposited or redeemed.",
  },
};

export const PLAYER_TAG_META: Record<
  PlayerTag,
  { label: string; description: string; tone: "info" | "good" | "warn" | "risk" }
> = {
  whale: {
    label: "Whale",
    description:
      "Top 1% of depositors in the selected range, with at least $100 deposited.",
    tone: "good",
  },
  high_roller: {
    label: "High Roller",
    description:
      "Top 1% average Wulf Cash bet among players with 20+ Wulf Cash rounds in the range.",
    tone: "info",
  },
  net_winner: {
    label: "Net Winner",
    description:
      "Redeemed more USD than they deposited in the range, taking money off the platform.",
    tone: "warn",
  },
  bonus_hunter: {
    label: "Bonus Hunter",
    description:
      "Wulf Cash bonus worth 50% or more of their deposits (or 10+ in bonus with no deposit) in the range.",
    tone: "warn",
  },
  low_play_redeemer: {
    label: "Low-Play Redeemer",
    description:
      "Redeemed in the range after wagering less Wulf Cash than they deposited: a bonus-abuse / AML signal.",
    tone: "risk",
  },
  loss_chaser: {
    label: "Loss Chaser",
    description:
      "Lost 100+ Wulf Cash (GGR) in the last 30 days and made 3+ deposits on a single day: a responsible-gaming risk.",
    tone: "risk",
  },
  new: { label: "New", description: "Joined in the last 7 days.", tone: "info" },
  dormant: {
    label: "Dormant",
    description: "No play, deposit or redeem for 14 days or more.",
    tone: "info",
  },
  suspicious_credits: {
    label: "Suspicious Credits",
    description:
      "Received wallet credits in the range that match no known reward source.",
    tone: "risk",
  },
};

export const PLAYER_TAGS = Object.keys(PLAYER_TAG_META) as PlayerTag[];
export const PLAYER_TRENDS = Object.keys(PLAYER_TREND_META) as PlayerTrend[];

/** `${PerformanceThresholdKey}Min` / `${PerformanceThresholdKey}Max`, applied server-side. */
export type PerformanceThresholds = Partial<
  Record<`${PerformanceThresholdKey}${"Min" | "Max"}`, number>
>;

export type PlayerPerformanceQuery = PerformanceThresholds & {
  /** yyyy-MM-dd, inclusive. Omit both for all time. */
  startDate?: string;
  endDate?: string;
  currency?: ReportCurrency;
  page?: number;
  /** Default 20, max 1000 (export pulls pages of 1000). */
  limit?: number;
  sortBy?: PerformanceSortKey;
  sortDir?: "asc" | "desc";
  /** Matches id, username or email/phone (case-insensitive substring). */
  search?: string;
  vipTierId?: string;
  /**
   * Tier by NAME across all its levels ("Silver" = Silver L1-L3). What the UI
   * filters on; vipTierId stays for a single exact tier.
   */
  tierName?: string;
  /**
   * Skip the server's short-lived response cache. Only the Refresh button
   * sends it; every other change is served from cache when it can be.
   */
  fresh?: boolean;
  status?: "active" | "inactive";
  rgStatus?: "ACTIVE" | "PAUSED" | "SELF_EXCLUDED" | "CLOSED";
  kyc?: "approved" | "pending" | "rejected" | "not_started";
  source?: PlayerSource;
  activity?: PerformanceActivity;
  /** Only players carrying this tag. */
  tag?: PlayerTag;
  /** Only players with this trend. */
  trend?: PlayerTrend;
  /** Players who played a game whose name contains this (case-insensitive) in the range. */
  game?: string;
};

export interface PlayerWalletSnapshot {
  /** Current balances — a snapshot, not limited to the range. */
  wulfCash: number;
  bonusWulfCash: number;
  wulfCoin: number;
  redeemableWulfCash: number;
}

export interface PlayerPerformanceRow {
  userId: string;
  username: string;
  /**
   * Best email for the player: the login when it is an email, else the
   * profile email. Lead with this in the UI (fall back to phone, then username).
   */
  email: string | null;
  /** Login phone, else profile phone. Null for Telegram placeholders. */
  phone: string | null;
  /** Raw login identifier (users.entity): email, phone or tg_<id>. */
  contact: string | null;
  joinedAt: string;
  isActive: boolean;
  rgStatus: string;
  tierName: string | null;
  tierLevel: number | null;
  kycStatus: string | null;
  source: PlayerSource;
  /** Last round ever, either currency (not range-limited). */
  lastPlayedAt: string | null;
  lastSeenAt: string | null;

  // ── Intent: relative to today, not the selected range ──
  trend: PlayerTrend;
  tags: PlayerTag[];
  /** Last day (yyyy-MM-dd) with a deposit, ever. */
  lastDepositDay: string | null;
  /** Last paid redeem, ever (ISO). */
  lastRedeemAt: string | null;
  /** Whole days since the latest play / deposit / redeem; null if none ever. */
  daysInactive: number | null;
  /** Rounds, both currencies, in the last 7 days and the 7 before. */
  rounds7d: number;
  roundsPrev7d: number;
  /** USD deposited in the last 7 days and the 7 before. */
  deposit7d: number;
  depositPrev7d: number;

  // ── Money in / out: USD, independent of the currency toggle ──
  depositUsd: number;
  depositCount: number;
  maxDepositUsd: number;
  /** First day (yyyy-MM-dd) in the range with a deposit. */
  firstDepositDay: string | null;
  /** Paid redeems (processed, or released to the payout provider). */
  redeemUsd: number;
  redeemCount: number;
  /** Owed right now and not yet released — a snapshot, not range-limited. */
  pendingRedeemUsd: number;
  /** depositUsd − redeemUsd. */
  netDepositUsd: number;
  /** redeemUsd − depositUsd: positive when the player has taken out more than they put in. */
  netRedeemUsd: number;

  // ── Gameplay, selected currency ──
  rounds: number;
  /** Rounds that paid out more than they staked / less than they staked. */
  roundsWon: number;
  roundsLost: number;
  /** roundsWon / (roundsWon + roundsLost) x 100, null without decided rounds. */
  winRatePct: number | null;
  /** Most-played game in the range (by rounds), null if none. */
  topGame: { gameName: string; provider: string; rounds: number } | null;
  /** Days in the range with at least one round. */
  activeDays: number;
  /** Handle: round-aware stake, refunds netted out. */
  stake: number;
  /** Gross payout (stake returned + profit). */
  win: number;
  /** win − stake. Positive = the player took money off the platform. */
  playerPl: number;
  /** stake − win. Positive = the platform won. */
  ggr: number;
  /** ggr / stake × 100, null when nothing was staked. */
  holdPct: number | null;
  /** stake / rounds, null when no rounds. */
  avgBet: number | null;
  /** Largest single payout row. */
  maxWin: number;

  // ── Rewards, selected currency ──
  bonus: number;
  /** bonus / depositUsd × 100 (Wulf Cash only), null without deposits. */
  bonusRatioPct: number | null;
  /** ggr − bonus. */
  ngr: number;
  /** Approved manual deposits incl. postcard (AMOE) entries. */
  manualCredit: number;
  /** Signed admin balance adjustments. */
  adjustments: number;
  /** Credits with no recognised reward source — worth a look. */
  otherCredits: number;

  // ── Referrals ──
  /** Players this player referred who signed up in the range. */
  referrals: number;
  /** …of whom have made at least one real deposit. */
  referralsQualified: number;
  /** Referral commission credited to this player's wallet in the range. Always Wulf Cash. */
  referralCommission: number;

  balance: PlayerWalletSnapshot;
}

export interface LeaderRef {
  userId: string;
  username: string;
  email: string | null;
  value: number;
}

export interface PlayerPerformanceSummary {
  players: number;
  depositUsd: number;
  depositCount: number;
  redeemUsd: number;
  netDepositUsd: number;
  pendingRedeemUsd: number;
  rounds: number;
  stake: number;
  win: number;
  ggr: number;
  bonus: number;
  ngr: number;
  referrals: number;
  leaders: {
    topDepositor: LeaderRef | null;
    mostActive: LeaderRef | null;
    topWagerer: LeaderRef | null;
    biggestWinner: LeaderRef | null;
    biggestLoser: LeaderRef | null;
    topReferrer: LeaderRef | null;
    topRedeemer: LeaderRef | null;
    topBonusReceiver: LeaderRef | null;
    /** Most rounds won / lost (counts). */
    mostWins: LeaderRef | null;
    mostLosses: LeaderRef | null;
  };
  /** Players carrying each tag / in each trend, over the filtered set. */
  tagCounts: Record<PlayerTag, number>;
  trendCounts: Record<PlayerTrend, number>;
}

export interface PlayerPerformanceListResponse {
  items: PlayerPerformanceRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  /** Over every player matching the filters, not just this page. */
  summary: PlayerPerformanceSummary;
  currency: ReportCurrency;
  range: { startDate: string | null; endDate: string | null };
  /** When the gameplay rollup was last refreshed (ISO), null if never. */
  dataAsOf: string | null;
}

/** Position among players with a non-zero value, null when this one is zero. */
export interface PerformanceRank {
  rank: number | null;
  of: number;
}

export interface PlayerPerformanceDaily {
  day: string; // yyyy-MM-dd
  depositUsd: number;
  redeemUsd: number;
  stake: number;
  win: number;
  ggr: number;
  rounds: number;
  bonus: number;
}

export interface PlayerPerformanceGame {
  provider: string;
  gameName: string;
  rounds: number;
  roundsWon: number;
  roundsLost: number;
  stake: number;
  win: number;
  ggr: number;
  maxWin: number;
  lastPlayedAt: string | null;
}

export interface PlayerPerformanceBonusLine {
  /** Stable key, e.g. "daily_streak". */
  category: string;
  label: string;
  amount: number;
  count: number;
}

export interface PlayerPerformanceDetail {
  profile: {
    userId: string;
    username: string;
    email: string | null;
    phone: string | null;
    contact: string | null;
    joinedAt: string;
    isActive: boolean;
    rgStatus: string;
    tierName: string | null;
    tierLevel: number | null;
    kycStatus: string | null;
    source: PlayerSource;
    referrerId: string | null;
    referrerName: string | null;
    lastPlayedAt: string | null;
    lastSeenAt: string | null;
    balance: PlayerWalletSnapshot;
  };
  /** The same metrics as a leaderboard row, for this player and range. */
  totals: PlayerPerformanceRow;
  ranks: {
    depositUsd: PerformanceRank;
    rounds: PerformanceRank;
    stake: PerformanceRank;
    ggr: PerformanceRank;
    playerPl: PerformanceRank;
    referrals: PerformanceRank;
  };
  deposits: {
    firstDepositAt: string | null;
    firstDepositUsd: number | null;
    lastDepositAt: string | null;
    avgDepositUsd: number | null;
    /** Coinflow refunds/chargebacks of settled deposits (not netted above). */
    chargebackCount: number;
    chargebackUsd: number;
  };
  /** One entry per day with any activity, ascending. */
  daily: PlayerPerformanceDaily[];
  /** Top games by rounds in the range (max 25). */
  games: PlayerPerformanceGame[];
  bonusBreakdown: PlayerPerformanceBonusLine[];
  biggestWin: {
    gameName: string;
    provider: string;
    amount: number;
    stake: number;
    at: string;
  } | null;
  currency: ReportCurrency;
  range: { startDate: string | null; endDate: string | null };
  dataAsOf: string | null;
}

/** Drops undefined / empty values so the URL only carries real filters. */
const cleanParams = (query: object) =>
  Object.fromEntries(
    Object.entries(query).filter(
      ([, v]) => v !== undefined && v !== null && v !== "",
    ),
  );

export const playerPerformanceApi = {
  list: async (
    query: PlayerPerformanceQuery,
    signal?: AbortSignal,
  ): Promise<PlayerPerformanceListResponse> => {
    const res = await api.get<PlayerPerformanceListResponse>(
      "/player-performance",
      {
        params: cleanParams(query),
        signal,
        timeout: PLAYER_PERFORMANCE_TIMEOUT_MS,
      },
    );
    return res.data;
  },

  detail: async (
    userId: string,
    query: Pick<PlayerPerformanceQuery, "startDate" | "endDate" | "currency" | "fresh">,
    signal?: AbortSignal,
  ): Promise<PlayerPerformanceDetail> => {
    const res = await api.get<PlayerPerformanceDetail>(
      `/player-performance/${encodeURIComponent(userId)}`,
      {
        params: cleanParams(query),
        signal,
        timeout: PLAYER_PERFORMANCE_TIMEOUT_MS,
      },
    );
    return res.data;
  },
};
