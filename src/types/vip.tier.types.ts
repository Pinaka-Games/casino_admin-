export type VipTierName =
    | "Bronze"
    | "Silver"
    | "Gold"
    | "Platinum"
    | "Diamond"
    | "Master"
    | "Immortal";

export type VipLevel = 1 | 2 | 3;

export interface VipBenefits {
    makeItRain: boolean;
    diamondDrops: boolean;
    privateChat: boolean;
    levelUpBonus: boolean;
    weeklyCashback: boolean;
    monthlyCashback: boolean;
    vipWheelSpin: boolean;
    luxuryGiveaway: boolean;
}

export interface TierRewardRateItem {
    enabled: boolean;
    rate: number | null;
    /**
     * Max payout per cycle for this benefit. Null = uncapped. The cycle is
     * per accrual period for the four cashbacks, per wager for Instant Rebate,
     * and per claim for Reload Deposit Bonus. Absolute amount — the
     * subscription boost raises the rate, never the cap.
     */
    cap?: number | null;
    /**
     * Playthrough on this benefit's payout. Null or <= 1 = no wagering, payout
     * stays instantly withdrawable. Above 1 the payout is credited as locked
     * bonus cash with a rollover requirement of amount * multiplier.
     */
    wageringMultiplier?: number | null;
}

export interface TierRewardSpinItem {
    enabled: boolean;
    count: number | null;
    /** UUID of the FreeSpinConfig template granted on rank-up + by the weekly cron. */
    freeSpinConfigId?: string | null;
}

export interface TierRewardLevelUpItem {
    enabled: boolean;
    /** Legacy single bonus amount (treated as GC). Kept for back-compat. */
    amount: number | null;
    /** Gold Coin (GC) tier-up bonus granted on claim. */
    gcAmount?: number | null;
    /** Sweeps Cash (SC) tier-up bonus granted on claim — carries wagering. */
    scAmount?: number | null;
    /** Rollover multiplier applied to the SC bonus. */
    wageringMultiplier?: number | null;
}

export interface TierRewardChatItem {
    enabled: boolean;
    level: string | null;
}

export interface TierRewards {
    instantRebate: TierRewardRateItem;
    hourlyCashback: TierRewardRateItem;
    dailyCashback: TierRewardRateItem;
    weeklyCashback: TierRewardRateItem;
    monthlyCashback: TierRewardRateItem;
    reloadDepositBonus: TierRewardRateItem;
    levelUpBonus: TierRewardLevelUpItem;
    vipSpin: TierRewardSpinItem;
    communityChat: TierRewardChatItem;
}

export const DEFAULT_TIER_REWARDS: TierRewards = {
    instantRebate: { enabled: false, rate: null, cap: null, wageringMultiplier: null },
    hourlyCashback: { enabled: false, rate: null, cap: null, wageringMultiplier: null },
    dailyCashback: { enabled: false, rate: null, cap: null, wageringMultiplier: null },
    weeklyCashback: { enabled: false, rate: null, cap: null, wageringMultiplier: null },
    monthlyCashback: { enabled: false, rate: null, cap: null, wageringMultiplier: null },
    reloadDepositBonus: { enabled: false, rate: null, cap: null, wageringMultiplier: null },
    levelUpBonus: { enabled: false, amount: null, gcAmount: null, scAmount: null, wageringMultiplier: null },
    vipSpin: { enabled: false, count: null, freeSpinConfigId: null },
    communityChat: { enabled: false, level: null },
};

export const COMMUNITY_CHAT_LEVELS = [
    "Basic",
    "Standard",
    "Priority",
    "Featured",
] as const;

export interface VipTier {
    id?: string | undefined;

    name?: VipTierName | null;

    level: 1 | 2 | 3;

    xp_required: number;

    badge: string;

    isActive: boolean;

    benefits: {
        instantRebate: boolean;
        hourlyCashback: boolean;
        dailyCashback: boolean;
        reloadDepositeBonus: boolean;
        communityChat: boolean;
        vipSpin: boolean;
        levelUpBonus: boolean;
        weeklyBonus: boolean;
        monthlyBonus: boolean;
    };

    depositSettings: {
        minimumDeposit: number | null;
        minimumWager: number | null;
    };

    withdrawalSettings: {
        withdrawalCountLimit: number | null;
        minimumWithdrawalBank: number | null;
        maximumWithdrawalBank: number | null;
        minimumWithdrawalEWallet: number | null;
        maximumWithdrawalEWallet: number | null;
        minimumWithdrawalCrypto: number | null;
        maximumWithdrawalCrypto: number | null;
        withdrawalPerDay: number | null;
        withdrawalPerWeek: number | null;
        withdrawalPerMonth: number | null;
    };

    tierRewards?: TierRewards;

    createdAt?: string | undefined;
    updatedAt?: string | undefined;
    message? :string | undefined
}


export interface UpdateVipStatusPayload {
    id: string | undefined;
    status: boolean;
}

export interface UpdateVipStatusResponse {
    message: string;
    isActive: boolean;
    id: string;
}
