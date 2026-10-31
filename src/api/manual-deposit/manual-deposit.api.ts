import api from "../config/axios.config";

export type ManualDepositCurrency = "wulfCash" | "bonusWulfCash" | "wulfCoin";
export type ManualDepositStatus = "PENDING" | "APPROVED" | "REJECTED";
/** Reporting label for where a manual deposit came from. */
export type ManualDepositTag = "social_media" | "postcard" | "other";

export const MANUAL_DEPOSIT_TAG_LABELS: Record<ManualDepositTag, string> = {
  social_media: "Social Media",
  postcard: "Postcard",
  other: "Other",
};

/**
 * How a tag reads in a table or an export. "Other" on its own says nothing, so
 * the operator's detail is shown in its place.
 */
export const formatManualDepositTag = (
  tag?: ManualDepositTag | string | null,
  detail?: string | null,
): string => {
  if (!tag) return "—";
  if (tag === "other") return detail?.trim() || "Other";
  // A tag written before this list grew reads as its raw code rather than
  // disappearing, which is what an undefined lookup would do.
  return MANUAL_DEPOSIT_TAG_LABELS[tag as ManualDepositTag] ?? tag;
};

export interface CreateManualDepositDto {
  userId: string;
  amount: number;
  currency: ManualDepositCurrency;
  notes?: string;
  tag?: ManualDepositTag;
  /** Required when tag is "other"; ignored otherwise. Max 64 chars. */
  tagDetail?: string;
  pairId?: string;
  /**
   * true (default) → approved wulfCash deposit creates a rollover lock.
   * false → amount credited directly as redeemable / available-to-withdraw.
   */
  applyWagering?: boolean;
}

export interface RecoverBundlePaymentDto {
  userId: string;
  bundleId: string;
  externalPaymentReferenceId: string;
}

export interface ManualDepositRecord {
  id: string;
  userId: string;
  amount: number;
  currency: ManualDepositCurrency;
  status: ManualDepositStatus;
  notes?: string;
  tag?: ManualDepositTag;
  tagDetail?: string;
  pairId?: string;
  createdByEmployeeId?: string;
  processedByEmployeeId?: string;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
  /**
   * Wallet balance of THIS record's currency, before and after the approval
   * credit. Null while the request is still PENDING (nothing credited yet).
   */
  balanceBefore?: number | null;
  balanceAfter?: number | null;
  user?: {
    id: string;
    username?: string;
    email?: string;
  };
}

export interface ListManualDepositsParams {
  userId?: string;
  currency?: ManualDepositCurrency;
  tag?: ManualDepositTag;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  status?: string;
}

export interface PaginatedManualDeposits {
  data: ManualDepositRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * One row of the admin listing: a manual deposit (coin+cash pair already
 * collapsed) or a subscription change request. Grouped and paginated server-side
 * so a page always holds exactly `limit` rendered rows.
 */
/** Which way a listing row moves money. MIXED = raises one figure, lowers another. */
export type DepositDirection = "CREDIT" | "DEBIT" | "MIXED";

export interface DepositListingRow {
  key: string;
  ids: string[];
  /** balance_edit = an admin "Edit Balance" from the player Wallet tab. */
  kind: "deposit" | "subscription" | "balance_edit";
  createdAt: string;
  isPaired: boolean;
  user?: { id: string; username?: string; email?: string };
  coinAmount?: number;
  cashAmount?: number;
  coinBefore?: number | null;
  coinAfter?: number | null;
  cashBefore?: number | null;
  cashAfter?: number | null;
  singleCurrency?: string;
  singleAmount?: number;
  fromPlanName?: string | null;
  toPlanName?: string | null;
  status: ManualDepositStatus;
  allPending: boolean;
  notes?: string;
  /** Reporting tag chosen when the deposit was raised. Null on older rows. */
  tag?: ManualDepositTag;
  /** What "other" was, typed by the operator. Only set when tag is "other". */
  tagDetail?: string;
  /** Why the request was rejected — required on every rejection. */
  rejectionReason?: string;
  /**
   * Set only when the rejection happened after approval, i.e. the credit was
   * debited back off the player's wallet.
   */
  reversedAt?: string | null;
  /** Null on subscription changes, which move no coin or cash. */
  direction?: DepositDirection | null;
  /** Balance edits only: signed XP change, and XP either side of approval. */
  xpAmount?: number;
  xpBefore?: number | null;
  xpAfter?: number | null;
  /** Balance edits only: raised from the Wallet tab, or a Manual Deposit "Top Out". */
  origin?: "wallet_edit" | "topout" | null;
  /** Balance edits only: signed Bonus balance change, and bonus either side of approval. */
  bonusAmount?: number;
  bonusBefore?: number | null;
  bonusAfter?: number | null;
}

export interface PaginatedDepositListing {
  data: DepositListingRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListDepositListingParams {
  status?: string;
  /** CREDIT or DEBIT; omit for both. */
  type?: string;
  /** Player username or email, or a subscription plan name. */
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

/** One card's worth of totals: how many deposits, and what they credited. */
export interface DepositTagTotals {
  count: number;
  coin: number;
  cash: number;
}

/**
 * Totals for the listing's summary cards. `tags` always carries every known tag
 * plus `untagged`, at zero when nothing matched, and `total` is their sum.
 */
export interface DepositListingSummary {
  total: DepositTagTotals;
  tags: Record<string, DepositTagTotals>;
  /** Rows that credit (deposits + balance-edit increases) and what they add. */
  credit?: DepositTagTotals;
  /** Balance-edit decreases and what they take off. */
  debit?: DepositTagTotals;
}

/** The summary takes the listing's filters, minus paging. */
export type ListDepositSummaryParams = Omit<
  ListDepositListingParams,
  "page" | "limit"
>;

export const manualDepositApi = {
  listing: (params?: ListDepositListingParams) =>
    api.get<PaginatedDepositListing>("/manual-deposits/listing", { params }),

  listingSummary: (params?: ListDepositSummaryParams) =>
    api.get<DepositListingSummary>("/manual-deposits/listing/summary", {
      params,
    }),

  create: (dto: CreateManualDepositDto) =>
    api.post<ManualDepositRecord>("/manual-deposits", dto),

  recoverBundlePayment: (dto: RecoverBundlePaymentDto) =>
    api.post("/manual-deposits/bundle-recovery", dto),

  list: (params?: ListManualDepositsParams) =>
    api.get<PaginatedManualDeposits>("/manual-deposits", { params }),

  getOne: (id: string) =>
    api.get<ManualDepositRecord>(`/manual-deposits/${id}`),

  approve: (id: string) =>
    api.patch<ManualDepositRecord>(`/manual-deposits/${id}/approve`),

  /**
   * Rejects a request. A PENDING one is simply declined; an APPROVED one is
   * reversed — the wallet credit is debited back. The reason is mandatory and is
   * shown to the player in their notification.
   */
  reject: (id: string, reason: string) =>
    api.patch<ManualDepositRecord>(`/manual-deposits/${id}/reject`, { reason }),
};
