import { create } from "zustand";
import { reportsApi } from "@/api/reports/reports";
import { toReportDay } from "@/lib/utils";

export interface ExpenseCategoryCard {
  key: string;
  label: string;
  total: number;
  count: number;
  /** Promised but not yet taken by the player — never part of `total`. */
  pendingTotal?: number;
  pendingCount?: number;
  /** Bundle card only: the bonus and discount parts of `total`. */
  bundleBonusTotal?: number;
  bundleDiscountTotal?: number;
}

export interface ExpenseTypeRow {
  key: string;
  label: string;
  total: number;
  count: number;
  pendingTotal?: number;
  pendingCount?: number;
}

export interface ExpenseDetailItem {
  id: string;
  date: string;
  userId: string | null;
  username: string;
  bonusName: string;
  bonusType: string;
  bonusTypeLabel: string;
  category: string;
  amount: number;
  currency: string | null;
  /** Non-cash side of the same grant (e.g. a VIP tier's Wulf Coin). Never
   *  summed into the expense total. */
  secondaryAmount?: number | null;
  secondaryCurrency?: string | null;
  /** Bundle rows only: the two parts `amount` is the sum of. */
  bundleBonus?: number | null;
  bundleDiscount?: number | null;
  status: string;
}

export interface ExpenseFilters {
  startDate?: Date;
  endDate?: Date;
}

interface ExpenseReportState {
  categories: ExpenseCategoryCard[];
  byType: ExpenseTypeRow[];
  summaryLoading: boolean;

  // detail (drill-down)
  detailOpen: boolean;
  activeCategory: string;
  /** Which side of the claim to list. Claimed is the default: the report is a
   *  record of what was SPENT, and an unclaimed reward is a promise. */
  detailStatus: "claimed" | "pending" | "all";
  activeLabel: string;
  detailItems: ExpenseDetailItem[];
  detailTotal: number;
  categoryTotal: number;
  /** Promised but unclaimed for the open category; excluded from categoryTotal. */
  categoryPendingTotal: number;
  categoryPendingCount: number;
  detailLoading: boolean;
  detailPage: number;

  pageSize: number;
  filters: ExpenseFilters;
  search: string;
  filterOpen: boolean;
  error: string | null;
}

interface ExpenseReportActions {
  fetchSummary: () => Promise<void>;
  openDetail: (category: string, label: string) => void;
  fetchDetail: (params?: { page?: number }) => Promise<void>;
  setDetailStatus: (status: "claimed" | "pending" | "all") => void;
  fetchAllDetail: (params?: {
    startDate?: string;
    endDate?: string;
  }) => Promise<ExpenseDetailItem[]>;
  closeDetail: () => void;
  setDetailPage: (page: number) => void;
  setFilters: (filters: ExpenseFilters) => void;
  setSearch: (search: string) => void;
  setFilterOpen: (open: boolean) => void;
  reset: () => void;
}

type ExpenseReportStore = ExpenseReportState & ExpenseReportActions;

const initialState: ExpenseReportState = {
  categories: [],
  byType: [],
  summaryLoading: false,
  detailOpen: false,
  activeCategory: "all",
  detailStatus: "claimed" as const,
  activeLabel: "Total Expense",
  detailItems: [],
  detailTotal: 0,
  categoryTotal: 0,
  categoryPendingTotal: 0,
  categoryPendingCount: 0,
  detailLoading: false,
  detailPage: 1,
  pageSize: 10,
  filters: { startDate: undefined, endDate: undefined },
  search: "",
  filterOpen: false,
  error: null,
};

export const useExpenseReportStore = create<ExpenseReportStore>((set, get) => ({
  ...initialState,

  fetchSummary: async () => {
    const { filters } = get();
    set({ summaryLoading: true, error: null });
    try {
      const res = await reportsApi.getExpenseSummary({
        startDate: toReportDay(filters.startDate),
        endDate: toReportDay(filters.endDate),
      });
      set({
        categories: res.data.categories || [],
        byType: res.data.byType || [],
        summaryLoading: false,
      });
      // if a detail view is open, refresh it too
      if (get().detailOpen) get().fetchDetail({ page: 1 });
    } catch (err: any) {
      set({
        summaryLoading: false,
        categories: [],
        byType: [],
        error:
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load expense summary",
      });
    }
  },

  openDetail: (category, label) => {
    set({
      detailOpen: true,
      activeCategory: category,
      activeLabel: label,
      detailPage: 1,
      detailItems: [],
    });
    get().fetchDetail({ page: 1 });
  },

  setDetailStatus: (detailStatus) => {
    set({ detailStatus, detailPage: 1 });
    if (get().detailOpen) get().fetchDetail({ page: 1 });
  },

  fetchDetail: async (params) => {
    const { activeCategory, detailPage, pageSize, filters, search, detailStatus } = get();
    const page = params?.page ?? detailPage;
    set({ detailLoading: true, error: null });
    try {
      const res = await reportsApi.getExpenseDetail({
        category: activeCategory,
        page,
        limit: pageSize,
        search: search || undefined,
        status: detailStatus,
        startDate: toReportDay(filters.startDate),
        endDate: toReportDay(filters.endDate),
      });
      set({
        detailItems: res.data.items || [],
        detailTotal: res.data.total || 0,
        categoryTotal: res.data.categoryTotal || 0,
        categoryPendingTotal: (res.data as { categoryPendingTotal?: number }).categoryPendingTotal || 0,
        categoryPendingCount: (res.data as { categoryPendingCount?: number }).categoryPendingCount || 0,
        detailLoading: false,
        detailPage: page,
      });
    } catch (err: any) {
      set({
        detailLoading: false,
        detailItems: [],
        detailTotal: 0,
        error:
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load expense detail",
      });
    }
  },

  fetchAllDetail: async (params) => {
    const { activeCategory, detailOpen, detailTotal, search, detailStatus, byType } =
      get();

    // Exporting the whole report ignores the Claimed/Pending toggle: that
    // control belongs to a drill-down and is not on screen here, so carrying it
    // over silently filtered the export down to nothing.
    const exportStatus = detailOpen ? detailStatus : "all";

    const pull = async (category: string, limit: number) => {
      const res = await reportsApi.getExpenseDetail({
        category,
        status: exportStatus,
        page: 1,
        limit,
        search: search || undefined,
        startDate: params?.startDate,
        endDate: params?.endDate,
      });
      return res.data.items || [];
    };

    try {
      // Overview, or the Total Expense card: export the whole report rather
      // than nothing. The API serves one stream per call, so the streams are
      // walked and concatenated — the rows already carry their category, so a
      // combined sheet still says where each row came from.
      if (!detailOpen || activeCategory === "all") {
        const streams = byType.length
          ? byType
          : [{ key: "bonus", label: "", total: 0, count: 0 }];
        const all: ExpenseDetailItem[] = [];
        for (const stream of streams) {
          // A stream with no rows in range costs a request otherwise.
          if (!stream.count && !stream.pendingCount) continue;
          all.push(
            ...(await pull(stream.key, (stream.count ?? 0) + (stream.pendingCount ?? 0) + 1000)),
          );
        }
        return all;
      }

      return await pull(activeCategory, detailTotal || 10000);
    } catch {
      return [];
    }
  },

  closeDetail: () => set({ detailOpen: false, search: "" }),

  setDetailPage: (page) => {
    set({ detailPage: page });
    get().fetchDetail({ page });
  },

  setFilters: (filters) => {
    set({ filters });
    get().fetchSummary();
  },

  setSearch: (search) => {
    set({ search, detailPage: 1 });
    get().fetchDetail({ page: 1 });
  },

  setFilterOpen: (open) => set({ filterOpen: open }),

  reset: () => set(initialState),
}));
