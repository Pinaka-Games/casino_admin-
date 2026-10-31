// User Profile Types

export interface User {
  id: string;
  username?: string;
  entity?: string;
  googleAuthId?: string;
  facebookAuthId?: string;
  telegramAuthId?: string;
  twitterAuthId?: string;
  name?: string;
  avatar?: string;
  isActive: boolean;
  isOnline?: boolean;
  onlineStatus?: string;
  /** ISO timestamp of the last live connection. Null if never connected. */
  lastSeenAt?: string | null;
  isBlocked: boolean;
  isFrozen: boolean;
  allowNegativeWallet: boolean;
  negativeWalletLimit: number;
  isReferralActive?: boolean;
  isVerified: boolean;
  isPremium: boolean;
  isAgreedToTermsConditions: boolean;
  referralCode?: string;
  referredBy?: string;
  referrerId?: string;
  referralsCount?: number;
  vipTierId?: string;
  /**
   * IANA zone detected in the player's browser. Lives on the user row rather
   * than the profile because the backend reads it on every day-boundary check
   * (daily reward, spins, deposit limits) and must not join to get it.
   * Undefined/null = never detected; the platform Default Timezone applies.
   */
  timezone?: string | null;
  profile?: Profile;
  wallet?: Wallet;
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  id: string;
  userId: string;
  displayName?: string;
  /** Composed whole; the three parts below are the source of truth. */
  fullName?: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  ethnicity?: string;
  state?: string;
  country?: string;
  pinCode?: string;
  gender?: string;
  phone?: string;
  email?: string;
  dateOfBirth?: string;
  weeklyRescueBonusPercentage?: number;
  monthlyRescueBonusPercentage?: number;
  isAgent: boolean;
  referralCode?: string;
  isReferralActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserWithProfile extends User {
  subAgentsCount: number;
  email: string | undefined;
  agent: any;
  profile: Profile;
  wallet?: Wallet;
  /** Resolved per-channel contact proof from the API. */
  registeredWith?: "email" | "phone";
  emailVerified?: boolean;
  phoneVerified?: boolean;
}

export interface Wallet {
  id: string;
  userId: string;
  wulfCash: number;
  wulfCoin: number;
  bonusWulfCash: number;
  createdAt: string;
  updatedAt: string;
}

// DTOs
export interface CreateProfileDto {
  username: string;
  displayName?: string;
  password: string;
  confirmPassword: string;
  fullName?: string;
  ethnicity?: string;
  state?: string;
  country?: string;
  pinCode?: string;
  gender?: string;
  phone?: string;
  email?: string;
  dateOfBirth?: string;
  weeklyRescueBonusPercentage?: number;
  monthlyRescueBonusPercentage?: number;
  isAgent?: boolean;
  referralCode?: string;
  // Admin override: create even when the email/phone already belongs to the
  // other account pool (staff vs player). Drives the "create anyway" confirm.
  force?: boolean;
}

export interface UpdateProfileDto {
  displayName?: string;
  /**
   * Composed name. The API derives it from the parts below whenever any of them
   * is sent, so send the parts — this stays for older callers.
   */
  fullName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  ethnicity?: string;
  state?: string;
  country?: string;
  pinCode?: string;
  gender?: string;
  phone?: string;
  email?: string;
  dateOfBirth?: string;
  password?: string;
  weeklyRescueBonusPercentage?: number;
  monthlyRescueBonusPercentage?: number;
  isAgent?: boolean;
  referralCode?: string;
  isReferralActive?: boolean;
  isVerified?: boolean;
  isActive?: boolean;
  isBlocked?: boolean;
  isFrozen?: boolean;
  allowNegativeWallet?: boolean;
  negativeWalletLimit?: number;
}

// API Response Types
export interface PaginatedUsersResponse {
  data: UserWithProfile[];
  meta: {
    totalItems?: number;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
}

// Filter and Sort Types
export interface UserFilters {
  search?: string;
  source?: "all" | "direct" | "agent" | "subagent" | "user";
  kyc?:
    | "all"
    | "started"
    | "not_started"
    | "approved"
    | "in_progress"
    | "pending"
    | "rejected";
  vipTierId?: string;
  isActive?: boolean;
  isVerified?: boolean;
  isPremium?: boolean;
  isAgent?: boolean;
  gender?: string;
  country?: string;
  state?: string;
  startDate?: string;
  endDate?: string;
  provider?: string;
  category?: string;
}

export interface UserSortOptions {
  field: 'createdAt' | 'updatedAt' | 'name' | 'entity';
  order: 'asc' | 'desc';
}

export interface PaginationParams {
  page: number;
  limit: number;
  search: string
}

export interface GetUsersParams {
  page?: number;
  limit?: number;

  // filters
  search?: string;
  isActive?: boolean;
  isVerified?: boolean;
  isPremium?: boolean;
  isBanned?: boolean;
  isAgent?: boolean; // if you filter by profile.isAgent
  referrerId?: string;
  source?: "all" | "direct" | "agent" | "subagent" | "user";
  kyc?:
    | "all"
    | "started"
    | "not_started"
    | "approved"
    | "in_progress"
    | "pending"
    | "rejected";
  vipTierId?: string;
  gender?: string;
  country?: string;
  state?: string;

  // New filters for agent/user listing
  startDate?: Date | string;
  endDate?: Date | string;
  provider?: string;
  category?: string;

  // sorting (optional)
  // 'ggr' and 'referralsCount' are agent-listing columns computed after the
  // query; the rest are plain player-listing columns.
  sortField?:
    | 'createdAt'
    | 'updatedAt'
    | 'name'
    | 'entity'
    | 'ggr'
    | 'referralsCount'
    | 'username'
    | 'balance'
    | 'wulfCoin'
    | 'isActive';
  sortOrder?: 'asc' | 'desc';

  freeSpinEligible?: boolean;
}

export interface ReferralDetail {
  refereeId: string;
  username: string;
  email?: string;
  joinedAt: string;
  totalWagered: number;
  /** Signed house GGR for this referee. `totalLoss` is the legacy alias. */
  totalGgr?: number;
  totalLoss: number;
  totalIncome: number;
  referralCode?: string;
  referredBySubAgent?: string | null;
  referredBySubAgentEmail?: string | null;
  // Per-referee economics (net profit = GGR − bonuses − platform fees)
  totalBets?: number;
  userWinLoss?: number;
  houseGgr?: number;
  bonusGranted?: number;
  platformFees?: number;
  // Lifetime purchase + its 6% processing fee (NGR formula input).
  totalPurchase?: number;
  purchaseFee?: number;
  refNetProfit?: number;
  // Ledger-consistent display economics (new NGR/commission formula).
  ggrDisplay?: number;
  bonusDisplay?: number;
  purchaseFeeDisplay?: number;
  platformFeeDisplay?: number;
  /**
   * The configured platform-fee RATE behind `platformFeeDisplay`. Use this
   * directly — deriving it as fee ÷ GGR is wrong on sub-agent split rounds,
   * where each earner is charged on their rate share of a GGR the row reports
   * in full.
   */
  platformFeePercentDisplay?: number;
  ngrDisplay?: number;
  commissionDisplay?: number;
}

export interface ReferralStats {
  subAgents: number | undefined;
  lockedIncome?: number;
  requestedIncome?: number;
  isAgent?: boolean;
  referralCode: string;
  totalReferrals: number;
  subAgentsCount?: number;
  /**
   * The affiliate WALLET balance, not lifetime commission. Kept because some
   * screens genuinely want the wallet figure — but for "Total Earnings" use
   * `totalEarnedAllTime` instead: wallet buckets and the commission ledger are
   * two different systems and do not reconcile.
   */
  totalEarnings: number;
  /**
   * Ledger truth — SUM of effective commission ever accrued (forfeited rows
   * count as 0). The same expression behind the Downline per-player figures and
   * the sub-agent listing's Total Earnings, so screens reading this all agree.
   */
  totalEarnedAllTime?: number;
  /**
   * Sub-agents' lifetime commission on the SAME ledger basis as
   * `totalEarnedAllTime`. Pair the two for a team total; `totalTeamEarnings`
   * mixes a wallet balance with a ledger sum and is kept only for older
   * clients.
   */
  subAgentsEarnedAllTime?: number;
  pendingIncome: number;
  totalClaimed: number;
  requestedAmount?: number;
  /** Wallet `withdrawableBalance` — claimable right now. */
  availableBalance?: number;
  frozenBalance?: number;
  /**
   * Wallet `pendingBalance + frozenBalance` — money held, not withdrawable.
   * The "Freeze (Pending)" figure; same expression as the sub-agent listing's
   * `requestedBalance`, so listing and detail agree. Not the same thing as the
   * ledger buckets `pendingIncome` / `requestedAmount`.
   */
  freezePending?: number;
  totalTeamEarnings?: number;
  subAgentsPendingTotal?: number;
  xpEarnedFromReferrals: number;
  payoutLockDays?: number;
  /** Admin "Account Status" toggle is off — all site access is blocked. */
  isBlocked?: boolean;
  /**
   * Admin "Freeze Wallet" toggle — the agent can log in but no money may move.
   * Enforced server-side on both payout paths; used here only to disable the
   * claim button and say why.
   */
  isFrozen?: boolean;
  referrals: ReferralDetail[];
  commissions?: {
    id: string;
    name: string;
    /**
     * The effective rate for this category — what actually gets paid. For a
     * sub-agent that is their assigned rate capped at the parent agent's
     * entitlement, so it can be lower than `assignedRate`.
     */
    rate: number;
    /** Sub-agents only: the rate set on their account, before the parent's cap. */
    assignedRate?: number;
    /** Sub-agents only: true when the parent's entitlement is what limits `rate`. */
    cappedByParent?: boolean;
    /** FLAT commission model — one rate on every category, no package bonus. */
    isFlat?: boolean;
  }[];
}

export interface EarningRecord {
  category?: string;
  gameType?: string;
  id: string;
  referrerId: string;
  refereeId: string;
  wagerAmount: number;
  netProfit: number;
  commissionAmount: number;
  commissionPercent: number;
  grossAmount: number;
  grossPercent: number;
  deductionAmount: number;
  deductionPercent: number;
  // Platform fees deducted from gross commission for this earning.
  platformFeeTotal?: number;
  // Bonus cash spent on this round's stake (non-commissionable portion).
  bonusWagerAmount?: number;
  // Round turnover as the player saw it: full stake (real + bonus) and the
  // amount the house paid back. `wagerAmount` is the commissionable real share.
  betTotalAmount?: number;
  payoutAmount?: number;
  // Real Wulf Cash staked on the round — the commissionable, fee-bearing share.
  realWager?: number;
  status: string;
  gameLogId: string;
  createdAt: string;
  source?: string;
  referee?: {
    username: string;
    entity: string;
  };
}

export interface ClaimRecord {
  id: string;
  referrerId: string;
  amount: number;
  status: string;
  transactionId: string;
  createdAt: string;
  approvedAt?: string;
  referrerName?: string;
  referrerEmail?: string;
}
