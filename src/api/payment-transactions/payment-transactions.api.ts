import api from "../config/axios.config";

export type TransactionFlow = "pay-in" | "pay-out" | "all";
export type TransactionProvider = "breeze" | "coinflow" | "all";

export interface PaymentTransaction {
  id: string;
  flow: "pay-in" | "pay-out";
  provider: "breeze" | "coinflow";
  date: string;
  pageId: string | null;
  clientReferenceId: string;
  customerEmail: string | null;
  amount: number;
  /** Pay-ins: charged total incl. tax / processor fees. Null on pay-outs. */
  totalWithTax?: number | null;
  currency: string;
  status: string;
  paymentType: string | null;
  declineReason: string | null;
}

export interface PaymentTransactionQuery {
  flow?: TransactionFlow;
  provider?: TransactionProvider;
  status?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  amountMin?: string | number;
  amountMax?: string | number;
  page?: number;
  limit?: number;
  /**
   * Keyset resume point from a previous response's `nextCursor`. Takes the
   * place of `page`: each chunk reads only `limit` rows per source instead of
   * everything down to page N, so walking the whole result set costs the same
   * per request no matter how deep it goes. Use this to export; use `page` for
   * the numbered pager.
   */
  cursor?: string;
  [key: string]: unknown;
}

export interface PaymentTransactionListResponse {
  /** Rows matching the filters. `null` on a cursor chunk — read it from the first request. */
  total: number | null;
  page: number;
  limit: number;
  data: PaymentTransaction[];
  /** Pass back as `cursor` for the next chunk. `null` means the walk is done. */
  nextCursor: string | null;
}

const stripUndefined = <T extends Record<string, unknown>>(obj: T) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== ""),
  );

export interface PaymentTransactionDetail extends PaymentTransaction {
  createdAt: string;
  paidAt?: string | null;
  expiredAt?: string | null;
  processedAt?: string | null;
  releasedAt?: string | null;
  pendingStatus?: string | null;
  hostedUrl?: string | null;
  cardLast4?: string | null;
  bankAccountLast4?: string | null;
  walletAddress?: string | null;
  product?: {
    name: string | null;
    productId: string | null;
    price: number | null;
    quantity: number;
  } | null;
  receipt?: {
    receiverNetAmount: number | null;
    processingFee: number | null;
    totalFee: number | null;
    destinationNetwork: string | null;
    destinationToken: string | null;
    transactionHash: string | null;
  } | null;
  lineItems?: Record<string, unknown>[];
}

export const paymentTransactionsApi = {
  list: async (query: PaymentTransactionQuery = {}) => {
    const res = await api.get<PaymentTransactionListResponse>(
      "/payment-transactions",
      { params: stripUndefined(query) },
    );
    return res.data;
  },

  getDetail: async (flow: "pay-in" | "pay-out", id: string) => {
    const res = await api.get<PaymentTransactionDetail>(
      `/payment-transactions/${flow}/${id}`,
    );
    return res.data;
  },

  summary: async (params: { dateFrom?: string; dateTo?: string } = {}) => {
    const res = await api.get<{
      range: { from: string | null; to: string | null };
      providers: Array<{
        provider: "breeze" | "coinflow";
        currency: string;
        payInTotal: number;
        payOutTotal: number;
        payInCount: number;
        payOutCount: number;
        /** Redeems requested through this provider that have not settled yet. */
        payOutPendingTotal?: number;
        payOutPendingCount?: number;
      }>;
    }>("/payment-transactions/summary", {
      params: stripUndefined(params as Record<string, unknown>),
    });
    return res.data;
  },
};
