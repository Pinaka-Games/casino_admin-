import { create } from "zustand";
import { reportsApi, DailyWinLossRow, ReportCurrency } from "@/api/reports/reports";
import { toReportDay } from "@/lib/utils";

export interface WinLossReportFilters {
  startDate?: Date;
  endDate?: Date;
  userStatus?: string;
  parentId?: string;
}

interface WinLossSummary {
  totalBet: number;
  playerWin: number;
  ggr: number;
  totalPlayers: number;
  hold: number;
}

interface WinLossReportState {
  rows: DailyWinLossRow[];
  summary: WinLossSummary;
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  pageSize: number;
  filters: WinLossReportFilters;
  filterOpen: boolean;
  openView: boolean;
  viewData: any | null;
  // Money bucket the report is scoped to. Defaults to real money (Wulf Cash).
  currency: ReportCurrency;
}

interface WinLossReportActions {
  fetchData: (filters?: WinLossReportFilters) => Promise<void>;
  setPage: (page: number) => void;
  setFilters: (filters: WinLossReportFilters) => void;
  setCurrency: (currency: ReportCurrency) => void;
  setFilterOpen: (open: boolean) => void;
  setOpenView: (open: boolean) => void;
  setViewData: (data: any | null) => void;
  clearError: () => void;
  reset: () => void;
}

type WinLossReportStore = WinLossReportState & WinLossReportActions;

const defaultSummary: WinLossSummary = {
  totalBet: 0,
  playerWin: 0,
  ggr: 0,
  totalPlayers: 0,
  hold: 0,
};

const initialState: WinLossReportState = {
  rows: [],
  summary: defaultSummary,
  isLoading: false,
  error: null,
  currentPage: 1,
  pageSize: 20,
  filters: {
    startDate: undefined,
    endDate: undefined,
    userStatus: "all",
    parentId: "",
  },
  filterOpen: false,
  openView: false,
  viewData: null,
  currency: "wulfCash",
};

export const useWinLossReportStore = create<WinLossReportStore>((set, get) => ({
  ...initialState,

  fetchData: async (filters) => {
    set({ isLoading: true, error: null });
    const activeFilters = filters ?? get().filters;
    try {
      const res = await reportsApi.getDailyWinLossReport({
        // Date-only: the reports cut whole UTC days. See toReportDay.
        startDate: toReportDay(activeFilters.startDate),
        endDate: toReportDay(activeFilters.endDate),
        parentId: activeFilters.parentId,
        userStatus: activeFilters.userStatus,
        currency: get().currency,
      });
      set({
        rows: res.data.items || [],
        summary: res.data.summary ?? defaultSummary,
        isLoading: false,
        currentPage: 1,
      });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err?.response?.data?.message || err?.message || "Failed to load win-loss report",
        rows: [],
        summary: defaultSummary,
      });
    }
  },

  setPage: (page) => set({ currentPage: page }),

  setFilters: (filters) => {
    set({ filters, currentPage: 1 });
    get().fetchData(filters);
  },

  setCurrency: (currency) => {
    set({ currency, currentPage: 1 });
    get().fetchData();
  },

  setFilterOpen: (open) => set({ filterOpen: open }),

  setOpenView: (open) => set({ openView: open }),

  setViewData: (data) => set({ viewData: data }),

  clearError: () => set({ error: null }),

  reset: () => set(initialState),
}));
