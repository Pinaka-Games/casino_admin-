import api from "../config/axios.config";

/**
 * Mail-in (postal) sweeps entries — the free, no-purchase route.
 *
 * Paths are relative to NEXT_PUBLIC_API_URL, which already ends in
 * `/api/v1/admin`, so `/postal-redemptions` reaches the backend's
 * `admin/postal-redemptions` controller.
 */
const BASE = "/postal-redemptions";

export type PostalCodeStatus = "ACTIVE" | "USED" | "EXPIRED" | "VOID";
export type PostalRedemptionStatus = "PENDING" | "APPROVED" | "REJECTED";
export type PostalCurrency = "wulfCash" | "bonusWulfCash" | "wulfCoin";

/** Currencies the settings screen offers. Bonus balances are not one of them. */
export type PostalRewardCurrency = "wulfCash" | "wulfCoin";

export const POSTAL_CURRENCY_LABELS: Record<PostalCurrency, string> = {
  wulfCash: "Sweeps Coins (SC)",
  wulfCoin: "Gold Coins (GC)",
  // Entries recorded before bonus balances stopped being offered.
  bonusWulfCash: "Bonus Sweeps Coins",
};

/**
 * "5 Sweeps Coins (SC)" or "5 Sweeps Coins (SC) + 5000 Gold Coins (GC)" — how an
 * entry's reward reads wherever it is shown.
 */
export const formatPostalReward = (
  amount: number | string,
  currency: PostalCurrency,
  goldCoinAmount?: number | null,
): string => {
  const main = `${Number(amount)} ${POSTAL_CURRENCY_LABELS[currency] ?? currency}`;
  const goldCoins = Number(goldCoinAmount) || 0;
  return goldCoins > 0 ? `${main} + ${goldCoins} ${POSTAL_CURRENCY_LABELS.wulfCoin}` : main;
};

/** How the reward for an accepted card is decided. */
export type PostalRewardMode = "FIXED" | "RANGE";

/**
 * Rules the published Sweepstakes Rules fix. Mirrors `postal.rules.ts` on the
 * API — shown on the settings screen, never edited from it.
 */
export const POSTAL_FIXED_RULES = {
  codeFormat: "XXXXXX-XXXXXXXXX",
  entryCapWindowDays: 30,
} as const;

/** Validity the published Sweepstakes Rules state. The setting defaults to it. */
export const POSTAL_RULES_CODE_TTL_DAYS = 60;

export type PostalRejectionReason =
  | "UNKNOWN_CODE"
  | "EXPIRED_CODE"
  | "CODE_ALREADY_USED"
  | "CODE_VOID"
  | "INELIGIBLE_ACCOUNT"
  | "STATE_MISMATCH"
  | "RATE_LIMIT"
  | "ILLEGIBLE"
  | "NOT_HANDWRITTEN"
  | "MULTIPLE_INK_COLOURS"
  | "MISSING_STATEMENT"
  | "NAME_MISMATCH"
  | "ADDRESS_MISMATCH"
  | "MULTIPLE_CARDS_ONE_ENVELOPE"
  | "SENT_BY_THIRD_PARTY"
  | "OTHER";

/** The reasons the server decides on its own — never offered to the clerk. */
export const AUTOMATIC_REJECTION_REASONS: PostalRejectionReason[] = [
  "UNKNOWN_CODE",
  "EXPIRED_CODE",
  "CODE_ALREADY_USED",
  "CODE_VOID",
  "INELIGIBLE_ACCOUNT",
  "STATE_MISMATCH",
  "RATE_LIMIT",
];

export const REJECTION_REASON_LABELS: Record<PostalRejectionReason, string> = {
  UNKNOWN_CODE: "Code not recognised",
  EXPIRED_CODE: "Code expired",
  CODE_ALREADY_USED: "Code already used",
  CODE_VOID: "Code no longer valid",
  INELIGIBLE_ACCOUNT: "Account not eligible",
  STATE_MISMATCH: "Posted from a different state",
  RATE_LIMIT: "Entry limit reached",
  ILLEGIBLE: "Handwriting illegible",
  NOT_HANDWRITTEN: "Printed or typed, not handwritten",
  MULTIPLE_INK_COLOURS: "More than one colour of ink",
  MISSING_STATEMENT: "Declaration statement missing",
  NAME_MISMATCH: "Name does not match the account",
  ADDRESS_MISMATCH: "Address does not match the account",
  MULTIPLE_CARDS_ONE_ENVELOPE: "More than one card in the envelope",
  SENT_BY_THIRD_PARTY: "Sent by someone other than the account holder",
  OTHER: "Other",
};

/** Reasons a clerk may pick. The automatic ones are decided before they see it. */
export const MANUAL_REJECTION_REASONS: PostalRejectionReason[] = (
  Object.keys(REJECTION_REASON_LABELS) as PostalRejectionReason[]
).filter((r) => !AUTOMATIC_REJECTION_REASONS.includes(r));

export interface PostalLookupResult {
  found: boolean;
  code: string;
  reason?: PostalRejectionReason;
  /** The code as the player was told to write it, dashes included. */
  display?: string;
  codeStatus?: PostalCodeStatus;
  /** True when the window closed, whatever the stored status still says. */
  expired?: boolean;
  /** A card on this code is already waiting for review. */
  pendingOnCode?: boolean;
  issuedAt?: string;
  expiresAt?: string;
  account?: {
    userId: string;
    username: string | null;
    /** Login identifier — email OR phone, in one column. */
    entity: string | null;
    name: string | null;
    isActive: boolean;
    rgStatus: string;
  } | null;
  kyc?: {
    status: string;
    legalName: string | null;
    address: string | null;
  } | null;
  limits?: {
    acceptedInWindow: number;
    maxEntriesPerUserMonth: number;
    windowDays: number;
  };
  reward?: {
    mode: PostalRewardMode;
    fixed: number;
    min: number;
    max: number;
    currency: PostalCurrency;
    /** Gold Coins paid on top of the main reward. 0 = none. */
    goldCoinAmount?: number;
  };
}

export interface PostalRedemptionRecord {
  id: string;
  codeId: string | null;
  enteredCode: string;
  userId: string | null;
  status: PostalRedemptionStatus;
  amount: number;
  currency: PostalCurrency;
  /** Gold Coins credited alongside `amount`. 0 for a single-currency entry. */
  goldCoinAmount?: number;
  postmarkState: string | null;
  postmarkDate: string | null;
  imageUrl: string | null;
  rejectionReason: PostalRejectionReason | null;
  rejectionDetail: string | null;
  manualDepositId: string | null;
  receivedByEmployeeId: string | null;
  processedByEmployeeId: string | null;
  processedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; username: string | null; entity: string | null } | null;
}

export interface CreatePostalRedemptionDto {
  code: string;
  postmarkState?: string;
  postmarkDate?: string;
  imageUrl?: string;
  notes?: string;
}

export interface ListPostalRedemptionsParams {
  status?: PostalRedemptionStatus;
  userId?: string;
  code?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedPostalRedemptions {
  data: PostalRedemptionRecord[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface PostalSettings {
  id: string;
  enabled: boolean;
  /** Days a newly generated code stays valid. Applies to codes generated after a change. */
  codeTtlDays: number;
  maxActiveCodesPerUser: number;
  codesPerDay: number;
  rewardMode: PostalRewardMode;
  rewardAmountFixed: number;
  rewardAmountMin: number;
  rewardAmountMax: number;
  rewardCurrency: PostalRewardCurrency;
  /**
   * Gold Coins paid per card on top of a Sweeps Coin reward (SC + GC). 0 = off.
   * The API stores 0 whenever rewardCurrency is Gold Coins.
   */
  rewardGoldCoinAmount: number;
  /** Locks a Sweeps Coin credit behind play-through. No effect on Gold Coins. */
  applyWagering: boolean;
  /**
   * With applyWagering: SC must be wagered amount × this before redeeming (1–1000).
   * null = the system's default deposit wagering multiplier.
   */
  wageringMultiplier: number | null;
  /** Accepted entries per player in any rolling 30 days. */
  maxEntriesPerUserMonth: number;
  mailingAddress: string | null;
  declarationText: string | null;
  updatedAt: string;
}

export type UpdatePostalSettingsDto = Partial<
  Omit<PostalSettings, "id" | "updatedAt">
>;

export interface PostalFraudStats {
  windowDays: number;
  entries: { received: number; approved: number; rejected: number; pending: number };
  /** Shares of everything that ARRIVED, not of everything refused. */
  rates: {
    approvalRate: number;
    unknownCodeRate: number;
    expiredCodeRate: number;
  };
  rejectionsByReason: Array<{ reason: string; count: number }>;
  codes: { issued: number; used: number; conversionRate: number };
  /** Addresses that minted codes for more than one account in the window. */
  sharedIps: Array<{ ip: string; accounts: number; codes: number }>;
}

export const postalRequestApi = {
  lookup: (code: string) =>
    api.get<PostalLookupResult>(`${BASE}/lookup`, { params: { code } }),

  create: (dto: CreatePostalRedemptionDto) =>
    api.post<PostalRedemptionRecord>(BASE, dto),

  list: (params: ListPostalRedemptionsParams) =>
    api.get<PaginatedPostalRedemptions>(BASE, { params }),

  stats: () =>
    api.get<{ pending: number; approved: number; rejected: number }>(
      `${BASE}/stats`,
    ),

  /**
   * Resolves with the entry. Check its `status`: an entry comes back REJECTED
   * (reason RATE_LIMIT) when the player reached the accepted-entries cap after
   * the card was recorded.
   */
  approve: (id: string) =>
    api.patch<PostalRedemptionRecord>(`${BASE}/${id}/approve`),

  reject: (id: string, reason: PostalRejectionReason, detail?: string) =>
    api.patch<PostalRedemptionRecord>(`${BASE}/${id}/reject`, {
      reason,
      detail,
    }),

  /** Unpaginated rows for a CSV export. Server-capped. */
  export: (params: ListPostalRedemptionsParams) =>
    api.get<PostalRedemptionRecord[]>(`${BASE}/export`, { params }),

  fraudStats: (days?: number) =>
    api.get<PostalFraudStats>(`${BASE}/fraud-stats`, { params: { days } }),

  getSettings: () => api.get<PostalSettings>(`${BASE}/settings`),

  updateSettings: (dto: UpdatePostalSettingsDto) =>
    api.patch<PostalSettings>(`${BASE}/settings`, dto),
};
