export enum CashbackType {
  // Auto-credited on every wager — the API has always returned it, but the
  // admin enum omitted it, so the Instant Rebate card was silently dropped.
  INSTANT = "instant_rebate",
  HOURLY = "hourly_rakeback",
  DAILY = "daily_rakeback",
  WEEKLY = "weekly_rakeback",
  MONTHLY = "monthly_rakeback",
}

export interface CashbackProgress {
  id: string;
  userId: string;
  bonusId: string;
  cashbackType: CashbackType;
  cashbackPercentage: number;
  totalWagered: number;
  totalCashbackEarned: number;
  totalCashbackClaimed: number;
  availableToClaimAmount: number;
  lastWagerAt: string | null;
  lastClaimAt: string | null;
  periodStartDate: string;
  periodEndDate: string | null;
  isActive: boolean;
  bonusName?: string;
  cashbackRate?: number;
  isClaimable?: boolean;
  nextClaimTime?: string;
  secondsUntilClaimable?: number;
  minClaimAmount?: number;
}

export interface AllCashbackProgress {
  instant: CashbackProgress | null;
  hourly: CashbackProgress | null;
  daily: CashbackProgress | null;
  weekly: CashbackProgress | null;
  monthly: CashbackProgress | null;
  totalAvailableToClaim: number;
  totalClaimedAllTime: number;
}

export interface ClaimedReward {
  label: string;
  value: string;
}

