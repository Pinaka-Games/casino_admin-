import api from "../config/axios.config";

/**
 * Which money bucket a report is scoped to.
 *  - wulfCash: real money (actual revenue the admin cares about)
 *  - wulfCoin: virtual / play money
 * Omit the param entirely to get the combined (legacy) figure.
 */
export type ReportCurrency = "wulfCash" | "wulfCoin";

/**
 * Dashboard stats aggregate the platform's whole history on "All", which can
 * run past the global 12s axios timeout on production volume. Kept generous
 * rather than unlimited so a stuck request still surfaces as an error.
 */
export const DASHBOARD_STATS_TIMEOUT_MS = 90_000;

/**
 * Report endpoints aggregate large datasets in production — especially for
 * Wulf Cash where the transaction volume is higher. The global 12s axios
 * timeout cuts these off before the server can respond, surfacing as 0.00
 * values or failed loads.
 */
export const REPORT_TIMEOUT_MS = 60_000;

export interface WinLossReportRow {
    provider: string;
    category: string;
    serviceProvider: string;
    totalPlayers: number;
    totalTickets: number;
    totalBetCounts: number;
    totalBet: string;
    totalValidBet: string;
    totalWin: string;
    playerWin: string;
    playerLose: string;
}

export interface GameReportRow {
    date: string;
    statementDate: string;
    player: string;
    username: string;
    email?: string;
    playerId: number;
    totalBetAmount: number;
    validBet: number;
    totalWin: number;
    totalLose: number;
    jackpotAmount: string;
    status: string;
    roundId: string;
    ticketIds: string;
    betId: string;
    /** bet | win | loss | jackpot | refund | bonus | bet_win | adjustment */
    transactionType?: string;
    /** Promotional free spin — stake is 0 by design (cost is the operator's). */
    isFreeSpin?: boolean;
    promoType?: string | null;
    gameProvider: string;
    /** The provider's own game id — what support quotes back to them. */
    gameId?: string | null;
    game: string;
    gameType: string;
    gameImage?: string;
    /** Net result of the round as the provider settled it. */
    netProfit?: number;
    /** Multiplier the provider reported; 0 when it sent none. */
    payoutMultiplier?: number;
    userStatus: boolean;
    // Currency the round was played in — 'wulfCash' (real) or 'wulfCoin' (virtual).
    playCurrency?: ReportCurrency | string;
    // Play mode — 'sweeps' (cash) or 'gold' (coins); fallback when playCurrency
    // is absent. A round is always a single currency for both buy-in and win.
    playMode?: string;
}

export interface GameReportResponse {
    items: GameReportRow[];
    total: number;
    summary: {
        totalBetAmount: number;
        validBet: number;
        // Gross payout credited to players over the range.
        totalPayout: number;
        // Net player win / net player loss, bucketed per row by the API.
        totalWin: number;
        totalLose: number;
        // House earning for the range: totalBetAmount − totalPayout. Negative when
        // players finish ahead.
        ggr: number;
    };
}

/**
 * One game's totals for the whole selected range, aggregated by the API.
 *
 * The table used to build these in the browser from a page of `getGameReport`,
 * which only ever summed the rows that page happened to contain. These come from
 * a GROUP BY over every matching row, using the same bet/win columns the daily
 * report and the dashboard use, so the screens agree.
 */
export interface GameAggregateRow {
    /** Normalised game name — the key the game catalogue is merged on. */
    gameKey: string;
    gameName: string;
    provider: string;
    category: string;
    gameId: string | null;
    totalPlayers: number;
    /**
     * Distinct rounds, not log rows — the same definition the daily and
     * win/loss reports use. Counting settlement rows here made one "Total Bets"
     * column mean two different things depending on which screen you opened.
     */
    betCounts: number;
    totalBet: number;
    totalValidBet: number;
    totalWin: number;
    ggr: number;
}

export interface GameAggregateResponse {
    items: GameAggregateRow[];
    summary: {
        gamesPlayed: number;
        totalBet: number;
        totalWin: number;
        ggr: number;
    };
}

export interface PlayerWinLossRow {
    id: string;
    username: string;
    email: string;
    totalBet: number;
    totalWin: number;
    netLoss: number;
    winCount: number;
    lossCount: number;
    lastPlayed: string;
}

export interface DailyWinLossRow {
    holdPercent: any;
    date: string;
    totalPlayers: number;
    totalBets: number;
    totalBetAmt: number;
    totalWin: number;
    ggr: number;
    /** Real money taken that day — bundle purchases, subscriptions, payins. */
    purchaseAmt: number;
    /** Real money paid out that day, dated by when it actually left. */
    redeemAmt: number;
    hold: number;
}

export interface DailyReportResponse {
    items: DailyWinLossRow[];
    summary: {
        totalBet: number;
        playerWin: number;
        ggr: number;
        totalPlayers: number;
        totalPurchase: number;
        totalRedeem: number;
        hold: number;
    };
}

export const reportsApi = {
    getWinLossReport: (params: { startDate?: string; endDate?: string; userStatus?: string; parentId?: string; currency?: ReportCurrency }) =>
        api.get<WinLossReportRow[]>('/reports/win-loss-report', { params, timeout: REPORT_TIMEOUT_MS }),

    getGameReport: (params?: {
        startDate?: string;
        endDate?: string;
        provider?: string;
        category?: string;
        parentId?: string;
        userStatus?: string;
        result?: string;
        currency?: ReportCurrency;
        page?: number;
        limit?: number;
    }) =>
        api.get<GameReportResponse>("/reports/game-report", { params, timeout: REPORT_TIMEOUT_MS }),

    /**
     * The newest Game Report rows, and only those — the Dashboard's recent plays.
     * Same rows and shape as `getGameReport().items`, without the range-wide
     * count and totals that call also computes.
     */
    getRecentPlays: (
        params?: { startDate?: string; endDate?: string; currency?: ReportCurrency; limit?: number },
        options?: { signal?: AbortSignal },
    ) =>
        api.get<{ items: GameReportRow[] }>("/reports/recent-plays", {
            params,
            signal: options?.signal,
        }),

    getGameReportAggregate: (params?: {
        startDate?: string;
        endDate?: string;
        provider?: string;
        category?: string;
        parentId?: string;
        userStatus?: string;
        result?: string;
        currency?: ReportCurrency;
    }) =>
        api.get<GameAggregateResponse>("/reports/game-report/aggregate", { params, timeout: REPORT_TIMEOUT_MS }),

    getPlayerWinLossReport: (params?: { startDate?: string; endDate?: string; parentId?: string; search?: string; currency?: ReportCurrency }) =>
        api.get<PlayerWinLossRow[]>("/reports/player-win-loss-report", { params, timeout: REPORT_TIMEOUT_MS }),

    getDailyWinLossReport: (params?: { startDate?: string; endDate?: string; parentId?: string; userStatus?: string; currency?: ReportCurrency }) =>
        api.get<DailyReportResponse>("/reports/daily-report", { params, timeout: REPORT_TIMEOUT_MS }),

    /**
     * `options.signal` lets the caller cancel a request the user has already
     * moved past. `options.timeout` defaults to DASHBOARD_STATS_TIMEOUT_MS — the
     * global 12s cut this endpoint off over a large range, and a timed-out
     * request left every card reading 0.
     */
    getDashboardStats: (
        // `fresh: "1"` makes the backend recompute instead of serving its cached copy.
        params?: { startDate?: string; endDate?: string; fresh?: string },
        options?: { signal?: AbortSignal; timeout?: number },
    ) =>
        api.get<{
            activePlayerCount: number;
            newRegisteredCount: number;
            firstDepositUserCount: number;
            totalApprovedKycCount: number;
            pendingKycCount: number;
            totalMedalCount: number;
            totalMedalClaimsCount: number;
            totalMedalUniqueUsersCount: number;
            totalSeonAllowCount: number;
            totalSeonBlockCount: number;
            totalUserCount: number;
            totalGameCount: number;
            totalTaxVerifiedCount: number;
            totalBonusAmount?: string;
            totalBonusCount?: number;
            totalBundleBonusAmount?: string;
            totalBundleDiscountAmount?: string;
            totalBundleGrantCount?: number;
            totalFreeSpinAmount?: string;
            totalFreeSpinCount?: number;
            totalAgentCount: number;
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
            totalWinLoss?: string;
            // Gross Revenue (bets − winnings) split by currency. Wulf Cash is the
            // real-money figure the dashboard headlines; Wulf Coin is virtual.
            totalWinLossCoins?: string;
            totalWinLossCash?: string;
            totalDeposits?: string;
            // Gross Deposits split by the stream that produced it. The three
            // add up to totalDeposits exactly.
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
            };
            /** Gross Deposits per rail, per day; the days sum to depositBreakdown. */
            depositRailSeries?: { date: string; breeze: string; coinflow: string; other?: string }[];
            totalWithdrawals?: string;
            // Gross Withdrawals split by the rail that released the money; the
            // parts sum to totalWithdrawals.
            withdrawalBreakdown?: {
                breeze: string;
                coinflow: string;
                other: string;
            };
            /** Gross Withdrawals per rail, per day the money left. */
            withdrawalRailSeries?: { date: string; breeze: string; coinflow: string }[];
            /** The two sides of GGR per day, Wulf Cash only. */
            ggrSeries?: { date: string; bet: string; win: string }[];
            // Part of totalWithdrawals that is released but not yet settled.
            withdrawalsInFlight?: string;
            // Requested-but-unreleased redeems (not date-scoped).
            pendingPayouts?: string;
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
            totalValidBuyIn?: string;
            // Handle — total staked, split by currency. GGR is this minus
            // winnings, so the dashboard can state turnover rather than
            // leaving it to be inferred from the other two cards.
            totalBetCash?: string;
            /** Handle per game category, biggest first; cash and coin kept apart. */
            betCategoryBreakdown?: { category: string; cash: string; coin: string }[];
            totalBetCoins?: string;
            totalWin?: string;
            // Gross Winnings split by currency.
            totalWinCoins?: string;
            totalWinCash?: string;
            activities: {
                username: string;
                activity: string;
                source?: string;
                // Which icon the row renders: dollar / green coin / gold coin.
                currency?: "usd" | "wulfCash" | "wulfCoin";
                amount: string;
                // Every other unit the row moved, shown under the headline
                // amount — a bundle purchase credits BOTH Wulf Coins and Wulf
                // Cash for the dollars paid, so it carries two extras.
                extras?: {
                    amount: string;
                    currency: "usd" | "wulfCash" | "wulfCoin";
                }[];
                // First extra, kept for clients predating `extras`.
                subAmount?: string | null;
                subCurrency?: "usd" | "wulfCash" | "wulfCoin" | null;
                amountColor: string;
                createdAt: string;
            }[];
            /** When these figures were computed; `stale` while a newer copy is being built. */
            cacheMeta?: { generatedAt: string; stale: boolean };
        }>("/reports/dashboard-stats", {
            params,
            signal: options?.signal,
            timeout: options?.timeout ?? DASHBOARD_STATS_TIMEOUT_MS,
        }),

    getEngagementReport: (params?: { startDate?: string; endDate?: string }) =>
        api.get<{
            date: string;
            bonusName: string;
            user: string;
            actionName: string;
            amount: number;
            referenceId: string;
        }[]>("/reports/engagement-report", { params }),

    getEngagementStats: (params?: { startDate?: string; endDate?: string; page?: number; limit?: number }) =>
        api.get<{
            total: number;
            summary: {
                dau: string;
                avgSession: string;
                d7Retention: string;
                sessionsPerUser: string;
            };
            items: {
                date: string;
                dau: number;
                newReg: number;
                avgSession: string;
                totalSessions: number;
                d1Retention: string;
                d7Retention: string;
            }[];
        }>("/reports/engagement-stats", { params }),

    getExpenseSummary: (params?: { startDate?: string; endDate?: string }) =>
        api.get<{
            categories: {
                key: string;
                label: string;
                total: number;
                count: number;
            }[];
            byType: {
                key: string;
                label: string;
                total: number;
                count: number;
            }[];
        }>("/reports/expense-report/summary", { params }),

    getExpenseDetail: (params?: {
        category?: string;
        startDate?: string;
        endDate?: string;
        search?: string;
        page?: number;
        limit?: number;
        /** claimed (default) | pending | all — see settledExpr on the API. */
        status?: "claimed" | "pending" | "all";
    }) =>
        api.get<{
            total: number;
            categoryTotal: number;
            categoryCount: number;
            items: {
                id: string;
                date: string;
                userId: string | null;
                username: string;
                bonusName: string;
                bonusType: string;
                bonusTypeLabel: string;
                category: string;
                amount: number;
                currency: string | null;
                status: string;
            }[];
        }>("/reports/expense-report/detail", { params }),
};
