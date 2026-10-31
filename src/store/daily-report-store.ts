import { create } from "zustand";
import { reportsApi, DailyWinLossRow, DailyReportResponse, ReportCurrency } from "@/api/reports/reports";
import { format } from "date-fns";

interface DailyReportFilters {
  startDate?: Date;
  endDate?: Date;
  userStatus?: string;
}

interface DailyReportState {
  rows: DailyWinLossRow[];
  summary: DailyReportResponse["summary"] | null;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  currentPage: number;
  pageSize: number;
  filters: DailyReportFilters;
  // Money bucket the report is scoped to. Defaults to real money (Wulf Cash).
  currency: ReportCurrency;
}

interface DailyReportActions {
  fetchReport: (params?: { startDate?: string; endDate?: string }) => Promise<void>;
  setSearch: (query: string) => void;
  setPage: (page: number) => void;
  setFilters: (filters: DailyReportFilters) => void;
  setCurrency: (currency: ReportCurrency) => void;
  clearError: () => void;
  reset: () => void;
}

type DailyReportStore = DailyReportState & DailyReportActions;

const initialState: DailyReportState = {
  rows: [],
  summary: null,
  isLoading: false,
  error: null,
  searchQuery: "",
  currentPage: 1,
  pageSize: 10,
  filters: {},
  currency: "wulfCash",
};

export const useDailyReportStore = create<DailyReportStore>((set, get) => ({
  ...initialState,

  fetchReport: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const state = get();
      const apiParams: { startDate?: string; endDate?: string; userStatus?: string; currency: ReportCurrency } = {
        currency: state.currency,
      };

      const startDate = params?.startDate ?? (state.filters.startDate ? format(state.filters.startDate, "yyyy-MM-dd") : undefined);
      const endDate = params?.endDate ?? (state.filters.endDate ? format(state.filters.endDate, "yyyy-MM-dd") : undefined);

      if (startDate) apiParams.startDate = startDate;
      if (endDate) apiParams.endDate = endDate;
      if (state.filters.userStatus && state.filters.userStatus !== "all") {
        apiParams.userStatus = state.filters.userStatus;
      }

      const response = await reportsApi.getDailyWinLossReport(apiParams);
      set({
        rows: response.data?.items || [],
        summary: response.data?.summary || null,
        isLoading: false,
      });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err?.response?.data?.message || err?.message || "Failed to fetch daily report",
        rows: [],
        summary: null,
      });
    }
  },

  setSearch: (query) => set({ searchQuery: query, currentPage: 1 }),

  setPage: (page) => set({ currentPage: page }),

  setCurrency: (currency) => {
    set({ currency, currentPage: 1 });
    get().fetchReport();
  },

  setFilters: (filters) => {
    set({ filters, currentPage: 1 });
    const params: Record<string, string> = {};
    if (filters.startDate) params.startDate = format(filters.startDate, "yyyy-MM-dd");
    if (filters.endDate) params.endDate = format(filters.endDate, "yyyy-MM-dd");
    get().fetchReport(params);
  },

  clearError: () => set({ error: null }),

  reset: () => set(initialState),
}));
