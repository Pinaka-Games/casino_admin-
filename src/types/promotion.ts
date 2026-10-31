// Promotion Types

export enum PromotionType {
  FIRST_DEPOSIT = 'first_deposit',
  SECOND_DEPOSIT = 'second_deposit',
  THIRD_DEPOSIT = 'third_deposit',
  FOURTH_DEPOSIT = 'fourth_deposit',
  FIFTH_DEPOSIT = 'fifth_deposit',
  NTH_DEPOSIT = 'nth_deposit',
  RELOAD_DEPOSIT = 'reload_deposit',
}

export enum UserPromotionStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export interface Promotion {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  type: PromotionType;
  /** Which deposit an `nth_deposit` promotion fires on (50, 100, 1000…). Null on every other type. */
  depositNumber: number | null;
  bonusPercentage: number;
  minDepositAmount: number;
  maxBonusAmount: number | null;
  autoApply: boolean;
  wageringMultiplier: number;
  validityDays: number;
  kycRequired: boolean;
  isActive: boolean;
  priority: number;
  totalClaims: number;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserPromotion {
  id: string;
  userId: string;
  promotionId: string;
  bonusAmount: number;
  depositAmount: number;
  depositNumber: number;
  wageringRequired: number;
  wageringCompleted: number;
  status: UserPromotionStatus;
  expiryDate: string;
  appliedAt: string;
  completedAt: string | null;
  transactionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePromotionDto {
  name: string;
  description?: string;
  imageUrl?: string;
  type: PromotionType;
  /** Required when type is `nth_deposit`; ignored (and cleared server-side) otherwise. */
  depositNumber?: number | null;
  bonusPercentage: number;
  minDepositAmount: number;
  maxBonusAmount?: number;
  autoApply: boolean;
  wageringMultiplier: number;
  validityDays: number;
  kycRequired: boolean;
  isActive: boolean;
  priority: number;
  startDate?: string;
  endDate?: string;
}

export interface UpdatePromotionDto extends Partial<CreatePromotionDto> {}

export interface PromotionStatistics {
  promotionId: string;
  promotionName: string;
  totalClaims: number;
  claimsThisMonth: number;
  isActive: boolean;
}
