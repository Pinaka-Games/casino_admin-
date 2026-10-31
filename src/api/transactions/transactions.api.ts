import api from "../config/axios.config";

export interface BreezePayinSummary {
  id: string;
  breezePageId: string | null;
  status: string;
  currency: string;
  amountMinor: number;
  hostedUrl: string | null;
  paymentType: string | null;
  billingEmail: string | null;
  customerEmail: string | null;
  errorCode: string | null;
  failureReason: string | null;
  lastWebhookEventType: string | null;
  paidAt: string | null;
  expiredAt: string | null;
  createdAt: string;
  providerResponse?: Record<string, unknown> | null;
  lastWebhookPayload?: Record<string, unknown> | null;
}

export interface CoinflowPayinSummary {
  id: string;
  coinflowSessionId: string | null;
  userId?: string | null;
  status: string;
  currency: string;
  amountMinor: number;
  hostedUrl: string | null;
  paymentType: string | null;
  billingEmail: string | null;
  customerEmail: string | null;
  errorCode: string | null;
  failureReason: string | null;
  lastWebhookEventType: string | null;
  paidAt: string | null;
  expiredAt: string | null;
  createdAt: string;
  providerResponse?: Record<string, unknown> | null;
  lastWebhookPayload?: Record<string, unknown> | null;
}

export interface Transaction {
  id: string;
  userId: string;
  userEmail?: string | null;
  userPhone?: string | null;
  paymentMethod?: string | null;
  productName?: string | null;
  breezePayin?: BreezePayinSummary | null;
  coinflowPayin?: CoinflowPayinSummary | null;
  type: string;
  source: string;
  referenceId?: string;
  description?: string;
  createdAt: string;
  /** COMPLETED | PENDING | PROCESSING | FAILED | EXPIRED | CANCELED | CHARGEBACK | REFUNDED. */
  status?: string;
  /** True on rows synthesized from a payin page that never became a deposit. */
  unsettled?: boolean;
  failureReason?: string | null;
  errorCode?: string | null;

  // Composite fields
  wulfCoinAdded?: string | number;
  wulfCashAdded?: string | number;
  bonusWulfCashAdded?: string | number;
  wulfCoinBalanceAfter?: string | number;
  wulfCashBalanceAfter?: string | number;
  bonusWulfCashBalanceAfter?: string | number;
  wulfCoinBalanceBefore?: string | number;
  wulfCashBalanceBefore?: string | number;
  bonusWulfCashBalanceBefore?: string | number;

  /**
   * REDEEM rows only: live request status, the payout provider actually used
   * (e.g. "Breeze (BANK)") and the payout page's own status.
   */
  redeemStatus?: string | null;
  redeemProvider?: string | null;
  redeemPayoutStatus?: string | null;

  // Single balance fields (enriched)
  currency?: string;
  amount?: string | number;
  fiatCurrency?: string;

  // Pricing snapshot (bundle deposits): what the user paid vs the pre-discount
  // list price, so the admin can render "original struck-through → final".
  originalPrice?: string | number;
  salePrice?: string | number;
  totalPaid?: string | number;
  /**
   * What the payment provider actually charged, tax and processor fees
   * included. Null when the row has no Breeze / Coinflow payin page.
   */
  totalWithTax?: number | null;
  bundleDiscount?: string | number;
  promoDiscount?: string | number;
  promoCode?: string | null;

  /**
   * MANUAL_DEPOSIT rows only: the reporting tag the operator picked when the
   * deposit was raised. `depositTagDetail` is the free text behind "other".
   */
  meta?: {
    depositTag?: string;
    depositTagDetail?: string;
  } | null;
}

export interface TransactionResponse {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
}

export interface TransactionFilters {
  page?: number;
  limit?: number;
  type?: string;
  source?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
  /**
   * Exact owner filter. Use this — not `search` — when the caller already has
   * the user's id; `search` only matches username / phone / email.
   */
  userId?: string;
  /** Payment provider: "Breeze" | "Coinflow". */
  paymentMethod?: string;
  /** Amount range on what the user paid (meta.totalPaid, fiat amount fallback). */
  minAmount?: number;
  maxAmount?: number;
  /**
   * Comma-separated deposit statuses: COMPLETED, PENDING, PROCESSING, FAILED,
   * EXPIRED, CANCELED. Only meaningful together with `includeUnsettled` —
   * every settled row is COMPLETED.
   */
  status?: string;
  /**
   * Include checkout attempts that never settled (failed, expired, cancelled,
   * still open). Off by default: those are not `transactions` rows, so turning
   * them on changes the row counts every other screen reads from this endpoint.
   */
  includeUnsettled?: boolean;
}

export const transactionsApi = {
  getAllTransactions: (filters?: TransactionFilters) =>
    api.get<TransactionResponse>("/transactions/all", { params: filters }),

  getMyTransactions: (filters?: TransactionFilters) =>
    api.get<TransactionResponse>("/transactions/me", { params: filters }),
};
