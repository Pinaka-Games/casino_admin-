export enum BonusType {
  DEPOSIT_MATCH = "deposit_match",
  FREE_SPINS = "free_spins",
  CASHBACK = "cashback",
  RELOAD_BONUS = "reload_bonus",
  NO_DEPOSIT = "no_deposit",
  PROFILE_COMPLETE = "profile_complete",
  LOSSBACK = "lossback",
  HOURLY_RAKEBACK = "hourly_rakeback",
  DAILY_RAKEBACK = "daily_rakeback",
  WEEKLY_RAKEBACK = "weekly_rakeback",
  MONTHLY_RAKEBACK = "monthly_rakeback",
}

export enum PlayerStatus {
  NEW = "new",
  EXISTING = "existing",
  VIP = "vip",
  ALL = "all",
}

export enum WageringType {
  BONUS = "bonus",
  DEPOSIT_PLUS_BONUS = "deposit_plus_bonus",
}

export enum FreeSpinWinningsTarget {
  REAL_SC = "real_sc",
  BONUS_SC = "bonus_sc",
}

export enum BonusRewardCurrency {
  WULF_COIN = "wulf_coin",
  WULF_CASH = "wulf_cash",
}

export interface GameWeighting {
  slots?: number;
  table_games?: number;
  excluded?: string[];
  [key: string]: any;
}

export interface Bonus {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  type: BonusType;
  matchPercentage: number;
  maxBonus: number;
  rewardCurrency?: BonusRewardCurrency;
  minDeposit: number;
  minNetLosses?: number;
  maxPayout?: number;
  freeSpins?: number;
  aleaSoftwareId?: number;
  aleaGameId?: number;
  aleaBetLevel?: number;
  aleaCasinoCampaignId?: string;
  aleaGrantExpiresInDays?: number;
  freeSpinWinningsTarget: FreeSpinWinningsTarget;
  freeSpinWinningsWageringMultiplier: number;
  wageringMultiplier: number;
  wageringType: WageringType;
  gameWeighting?: GameWeighting;
  validityDays: number;
  playerStatus: PlayerStatus;
  vipTierRestriction?: string[] | null;
  grantWulfCoin?: boolean;
  wulfCoinAmount?: number;
  kycRequired: boolean;
  isActive: boolean;
  /**
   * Set when the bonus was deleted while players already held claims. It is
   * kept in the table for auditing and shown as Deleted, but is never offered
   * to players again. Null/absent = live.
   */
  archivedAt?: string | Date | null;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBonusDto {
  name: string;
  description?: string;
  imageUrl?: string;
  type: BonusType;
  matchPercentage?: number;
  cashbackPercentage?: number;
  minClaimAmount?: number;
  maxBonus?: number;
  rewardCurrency?: BonusRewardCurrency;
  minDeposit?: number;
  minNetLosses?: number;
  maxPayout?: number;
  freeSpins?: number;
  aleaSoftwareId?: number;
  aleaGameId?: number;
  aleaBetLevel?: number;
  aleaCasinoCampaignId?: string;
  aleaGrantExpiresInDays?: number;
  freeSpinWinningsTarget?: FreeSpinWinningsTarget;
  freeSpinWinningsWageringMultiplier?: number;
  wageringMultiplier?: number;
  wageringType?: WageringType;
  gameWeighting?: GameWeighting;
  validityDays?: number;
  playerStatus?: PlayerStatus;
  vipTierRestriction?: string[];
  grantWulfCoin?: boolean;
  wulfCoinAmount?: number;
  kycRequired?: boolean;
  isActive?: boolean;
  startDate?: Date;
  endDate?: Date;
}

export interface UpdateBonusDto extends Partial<CreateBonusDto> {}

