import { create } from "zustand";
import toast from "react-hot-toast";
import {
  adminBreezePayoutApi,
  type AdminBreezePayoutPageRecord,
} from "@/api/breeze-payment/breeze-payout.api";
import {
  adminCoinflowPayoutApi,
  type AdminCoinflowPayoutPageRecord,
} from "@/api/coinflow-payment/coinflow-payout.api";
import {
  redeemApi,
  RedeemRequest,
  RedeemStatus,
  type AdminRedeemListQuery,
  type RedeemDateBasis,
} from "@/api/redeem/redeem.api";

export type PayoutProvider = "breeze" | "coinflow";

export const WITHDRAWAL_PAGE_SIZE = 10;

/**
 * Filter options are fixed lists rather than values scraped from the loaded
 * rows: with server-side paging the browser only ever holds one page, so
 * deriving them from `requests` would have shrunk the dropdowns to whatever
 * happened to be on screen.
 */
export const PAYMENT_METHOD_OPTIONS = ["Breeze", "Coinflow"] as const;

/** Mirrors BreezePayoutPageStatus / CoinflowPayoutPageStatus (identical enums). */
export const PAYOUT_STATUS_OPTIONS = [
  "CREATED",
  "PENDING",
  "PROCESSING",
  "PROCESSED",
  "COMPLETED",
  "REFUNDED",
  "FAILED",
  "CANCELED",
  "EXPIRED",
  "UNKNOWN",
] as const;

export interface WithdrawalFilters {
  status: RedeemStatus | "ALL";
  /** Email / phone. Debounced by the page before it lands here. */
  search: string;
  /** ISO instants; the page widens the picked dates to whole days. */
  dateFrom: string | null;
  dateTo: string | null;
  /**
   * Which date the range cuts on.
   *
   * `created` is the request log this screen has always been. `paid` turns it
   * into a payout log: rows are dated and sorted by when the money released,
   * and requests that released nothing (pending, declined, cancelled) drop out
   * — which is what makes the totals here match the dashboard's Gross
   * Withdrawals card for the same range.
   */
  dateBasis: RedeemDateBasis;
  paymentMethod: string;
  payoutStatus: string;
  amountMin: string;
  amountMax: string;
  /**
   * Column ordering. It lives with the filters because the API decides the
   * order: this screen holds one page at a time, so sorting locally would only
   * reorder the rows already fetched.
   */
  sortBy: "date" | "amount" | "status";
  sortDir: "asc" | "desc";
}

export const DEFAULT_WITHDRAWAL_FILTERS: WithdrawalFilters = {
  status: "ALL",
  search: "",
  dateFrom: null,
  dateTo: null,
  dateBasis: "created",
  paymentMethod: "ALL",
  payoutStatus: "ALL",
  amountMin: "",
  amountMax: "",
  sortBy: "date",
  sortDir: "desc",
};

type PayoutPageRecord =
  | AdminBreezePayoutPageRecord
  | AdminCoinflowPayoutPageRecord;

const payoutApiFor = (provider: PayoutProvider) =>
  provider === "coinflow" ? adminCoinflowPayoutApi : adminBreezePayoutApi;

const providerLabel = (provider: PayoutProvider) =>
  provider === "coinflow" ? "Coinflow" : "Breeze";

interface WithdrawalListingState {
  /** The CURRENT PAGE only — never the full table. */
  requests: RedeemRequest[];
  total: number;
  page: number;
  isLoading: boolean;
  error: string | null;
  filters: WithdrawalFilters;
  selectedRequestId: string | null;
  isModalOpen: boolean;
  actionLoadingKey: string | null;
  setFilterStatus: (status: RedeemStatus | "ALL") => void;
  /** Toggles a column: same column flips direction, a new one starts descending. */
  toggleSort: (column: WithdrawalFilters["sortBy"]) => void;
  setSearch: (search: string) => void;
  applyFilters: (next: Partial<WithdrawalFilters>) => void;
  resetFilters: () => void;
  setPage: (page: number) => void;
  fetchRequests: () => Promise<void>;
  openModal: (requestId: string) => void;
  closeModal: () => void;
  approveAndPreparePayout: (
    requestId: string,
    provider?: PayoutProvider,
  ) => Promise<void>;
  rejectRequest: (requestId: string) => Promise<void>;
  createOrResumePayout: (
    requestId: string,
    provider?: PayoutProvider,
  ) => Promise<PayoutPageRecord | null>;
  refreshPayout: (
    pageId: string,
    provider?: PayoutProvider,
  ) => Promise<PayoutPageRecord | null>;
  releasePayout: (
    pageId: string,
    provider?: PayoutProvider,
  ) => Promise<PayoutPageRecord | null>;
}

/**
 * Applied filters → API query. "ALL" and empty strings are dropped rather than
 * sent, so the endpoint sees an absent filter instead of one that matches
 * nothing.
 */
export const toListQuery = (
  filters: WithdrawalFilters,
  page: number,
  limit: number,
): AdminRedeemListQuery => ({
  status: filters.status === "ALL" ? undefined : filters.status,
  search: filters.search.trim() || undefined,
  dateFrom: filters.dateFrom ?? undefined,
  dateTo: filters.dateTo ?? undefined,
  // Only sent when it changes the query — `created` is the endpoint's default.
  dateBasis: filters.dateBasis === "paid" ? "paid" : undefined,
  paymentMethod:
    filters.paymentMethod === "ALL" ? undefined : filters.paymentMethod,
  payoutStatus:
    filters.payoutStatus === "ALL" ? undefined : filters.payoutStatus,
  amountMin: filters.amountMin || undefined,
  amountMax: filters.amountMax || undefined,
  // Only sent when it differs from the endpoint's own default.
  sortBy: filters.sortBy === "date" ? undefined : filters.sortBy,
  sortDir: filters.sortBy === "date" && filters.sortDir === "desc" ? undefined : filters.sortDir,
  page,
  limit,
});

const getApiMessage = (error: unknown, fallback: string) => {
  const apiError = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };

  return apiError?.response?.data?.message || apiError?.message || fallback;
};

export const useWithdrawalListingStore = create<WithdrawalListingState>(
  (set, get) => ({
    requests: [],
    total: 0,
    page: 1,
    isLoading: false,
    error: null,
    filters: DEFAULT_WITHDRAWAL_FILTERS,
    selectedRequestId: null,
    isModalOpen: false,
    actionLoadingKey: null,

    // Every filter change returns to page 1 — otherwise a narrower filter can
    // strand the view on a page that no longer exists.
    setFilterStatus: (status) =>
      set((s) => ({ filters: { ...s.filters, status }, page: 1 })),

    toggleSort: (column) =>
      set((s) => ({
        filters: {
          ...s.filters,
          sortBy: column,
          sortDir:
            s.filters.sortBy === column && s.filters.sortDir === "desc" ? "asc" : "desc",
        },
        // A new order means a new page 1.
        page: 1,
      })),

    setSearch: (search) =>
      set((s) => ({ filters: { ...s.filters, search }, page: 1 })),

    applyFilters: (next) =>
      set((s) => ({ filters: { ...s.filters, ...next }, page: 1 })),

    resetFilters: () =>
      set((s) => ({
        // Status tab and search box live in the HEADER, not the filter sheet,
        // so "Reset Filters" leaves both alone. Clearing the search here would
        // also desync it from the input the user is still looking at.
        filters: {
          ...DEFAULT_WITHDRAWAL_FILTERS,
          status: s.filters.status,
          search: s.filters.search,
          // Sorting is a table control, not one of the sheet's filters.
          sortBy: s.filters.sortBy,
          sortDir: s.filters.sortDir,
        },
        page: 1,
      })),

    setPage: (page) => set({ page }),

    fetchRequests: async () => {
      set({ isLoading: true, error: null });
      try {
        const { filters, page } = get();
        const response = await redeemApi.list(
          toListQuery(filters, page, WITHDRAWAL_PAGE_SIZE),
        );

        // Acting on a row can empty the page it was on — reject the last
        // request on page 5 and page 5 stops existing. Fall back to the last
        // page that does rather than showing "No records found" under a pager
        // that still offers five pages. Loading stays on; moving `page` is what
        // re-runs the fetch.
        const lastPage = Math.max(
          1,
          Math.ceil(response.data.total / WITHDRAWAL_PAGE_SIZE),
        );
        if (page > lastPage) {
          set({ total: response.data.total, page: lastPage });
          return;
        }

        set({
          requests: response.data.data,
          total: response.data.total,
          isLoading: false,
        });
      } catch (error) {
        set({
          requests: [],
          total: 0,
          isLoading: false,
          error: getApiMessage(error, "Failed to load redeem requests"),
        });
        toast.error(getApiMessage(error, "Failed to load redeem requests"));
      }
    },

    openModal: (selectedRequestId) =>
      set({
        selectedRequestId,
        isModalOpen: true,
      }),

    closeModal: () =>
      set({
        selectedRequestId: null,
        isModalOpen: false,
      }),

    approveAndPreparePayout: async (requestId, provider = "breeze") => {
      set({ actionLoadingKey: `approve:${requestId}` });
      const label = providerLabel(provider);
      try {
        await redeemApi.updateStatus(requestId, { status: "APPROVED" });
        try {
          await payoutApiFor(provider).createOrResumeRedeemPage({
            redeemRequestId: requestId,
            preferredPayoutMethods: ["BANK_ACCOUNT", "CARD", "CRYPTO_WALLET"],
          });
          toast.success(`Request approved and ${label} payout page prepared`);
        } catch (payoutError) {
          toast.error(
            getApiMessage(
              payoutError,
              `Request approved, but ${label} payout page preparation failed`,
            ),
          );
        }
        await get().fetchRequests();
      } catch (error) {
        toast.error(
          getApiMessage(error, "Failed to approve and prepare payout"),
        );
        throw error;
      } finally {
        set({ actionLoadingKey: null });
      }
    },

    rejectRequest: async (requestId) => {
      set({ actionLoadingKey: `reject:${requestId}` });
      try {
        await redeemApi.updateStatus(requestId, { status: "REJECTED" });
        toast.success("Request rejected");
        await get().fetchRequests();
        set({ isModalOpen: false, selectedRequestId: null });
      } catch (error) {
        toast.error(getApiMessage(error, "Failed to reject request"));
        throw error;
      } finally {
        set({ actionLoadingKey: null });
      }
    },

    createOrResumePayout: async (requestId, provider = "breeze") => {
      set({ actionLoadingKey: `create:${requestId}` });
      const label = providerLabel(provider);
      try {
        const page = await payoutApiFor(provider).createOrResumeRedeemPage({
          redeemRequestId: requestId,
          preferredPayoutMethods: ["BANK_ACCOUNT", "CARD", "CRYPTO_WALLET"],
        });
        toast.success(`${label} payout page is ready`);
        await get().fetchRequests();
        return page;
      } catch (error) {
        toast.error(getApiMessage(error, "Failed to prepare payout page"));
        throw error;
      } finally {
        set({ actionLoadingKey: null });
      }
    },

    refreshPayout: async (pageId, provider = "breeze") => {
      set({ actionLoadingKey: `refresh:${pageId}` });
      try {
        const page = await payoutApiFor(provider).refreshPage(pageId);
        toast.success("Payout status refreshed");
        await get().fetchRequests();
        return page;
      } catch (error) {
        toast.error(getApiMessage(error, "Failed to refresh payout status"));
        throw error;
      } finally {
        set({ actionLoadingKey: null });
      }
    },

    releasePayout: async (pageId, provider = "breeze") => {
      set({ actionLoadingKey: `release:${pageId}` });
      const label = providerLabel(provider);
      try {
        const page = await payoutApiFor(provider).releasePage(pageId);
        toast.success(`Payout released to ${label}`);
        await get().fetchRequests();
        return page;
      } catch (error) {
        toast.error(getApiMessage(error, "Failed to release payout"));
        throw error;
      } finally {
        set({ actionLoadingKey: null });
      }
    },
  }),
);
