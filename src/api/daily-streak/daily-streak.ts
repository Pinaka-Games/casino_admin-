import api from "../config/axios.config";

export interface TierRewardEntry {
  tierName: string;
  /** Per-tier WULF_CASH override for this day. */
  cashAmount?: number;
  /** Per-tier WULF_COIN override for this day. */
  coinAmount?: number;
  // legacy single-reward fields
  amount?: number;
  type?: 'value' | 'percentage';
}

/** Multi-reward day: any/all of cash + coin + free-spin can be granted together. */
export interface StreakRewardConfig {
  day: number;
  cashAmount: number;
  coinAmount: number;
  /** UUID of the FreeSpinConfig template granted this day (optional). */
  freeSpinConfigId?: string | null;
  tierRewards?: TierRewardEntry[];
  isMilestone?: boolean;
  milestoneBonusCash?: number;
}

export interface MilestoneBonusCashConfig {
  day: number;
  amount: number;
}

export interface MilestoneBonusFreeSpinConfig {
  day: number;
  freeSpinConfigId: string;
}

export interface StreakAdminConfig {
  isEnabled: boolean;
  totalDays: number;
  milestoneDays: number[];
  milestoneBonusCash: MilestoneBonusCashConfig[];
  /** Extra WULF_COIN bonus per milestone day (on top of the day's base reward). */
  milestoneBonusCoin?: MilestoneBonusCashConfig[];
  /** Extra FREE_SPIN template per milestone day. */
  milestoneBonusFreeSpin?: MilestoneBonusFreeSpinConfig[];
  /** When true, FREE_SPIN reward days grant `freeSpinBaseAmount × currentStreakDay` spins. */
  freeSpinMultiplierEnabled: boolean;
  /** Base spin count for the multiplier rule (e.g. 10 → day 6 grants 60). */
  freeSpinBaseAmount: number;
  /** UUID of the FreeSpinConfig template used to grant streak free spins. */
  freeSpinConfigId: string | null;
  /** When true, base and milestone WULF_CASH rewards are credited as Bonus Wulf Cash locked behind a rollover. */
  cashWageringEnabled: boolean;
  /** Playthrough multiplier applied to WULF_CASH rewards when wagering is enabled. */
  cashWageringMultiplier: number;
  rewards: StreakRewardConfig[];
}

export interface UserStreakData {
  exists: boolean;
  message?: string;
  userId?: string;
  currentStreakDay?: number;
  totalDays?: number;
  milestoneDays?: number[];
  milestoneBonusCash?: MilestoneBonusCashConfig[];
  lastRewardClaimDate?: string | null;
  streakCompleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
  rewards?: {
    day: number;
    /**
     * A day can grant several currencies at once. `rewardType`/`amount` are the
     * legacy single-reward mirror kept for older rows.
     */
    cashAmount?: number;
    coinAmount?: number;
    freeSpinConfigId?: string | null;
    freeSpinAmount?: number;
    rewardType: string;
    amount: number;
    tierRewards?: TierRewardEntry[];
    isClaimed: boolean;
    isMilestone?: boolean;
    milestoneBonusCash?: number;
    milestoneBonusCoin?: number;
    milestoneBonusFreeSpin?: number;
  }[];
}

export const dailyStreakAdminApi = {
  getConfig: () =>
    api.get<StreakAdminConfig>("/daily-streak/config"),

  updateConfig: (data: {
    totalDays: number;
    milestoneDays: number[];
    milestoneBonusCash: MilestoneBonusCashConfig[];
    milestoneBonusCoin?: MilestoneBonusCashConfig[];
    milestoneBonusFreeSpin?: MilestoneBonusFreeSpinConfig[];
    freeSpinMultiplierEnabled?: boolean;
    freeSpinBaseAmount?: number;
    freeSpinConfigId?: string | null;
    cashWageringEnabled?: boolean;
    cashWageringMultiplier?: number;
    rewards: StreakRewardConfig[];
  }) =>
    api.put("/daily-streak/config", data),

  seedRewards: () =>
    api.post<{ message: string; seeded: boolean }>("/daily-streak/seed"),

  toggleFeature: (enabled: boolean) =>
    api.patch<{ isEnabled: boolean }>("/daily-streak/toggle", { enabled }),

  getUserStreak: (userId: string) =>
    api.get<UserStreakData>(`/daily-streak/user/${userId}`),

  getAllUserStreaks: (page: number = 1, limit: number = 20) =>
    api.get("/daily-streak/users", { params: { page, limit } }),
};
