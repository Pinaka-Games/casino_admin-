import { create } from "zustand";
import { reportsApi } from "@/api/reports/reports";
import { toReportDay } from "@/lib/utils";

export interface EngagementStatItem {
  date: string;
  dau: number;
  newReg: number;
  avgSession: string;
  totalSessions: number;
  d1Retention: string;
  d7Retention: string;
}

export interface EngagementSummary {
  dau: string;
  avgSession: string;
  d7Retention: string;
  sessionsPerUser: string;
}

export interface EngagementFilters {
  startDate?: Date;
  endDate?: Date;
}

interface EngagementReportState {
  items: EngagementStatItem[];
  summary: EngagementSummary | null;
  totalRecords: number;
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  pageSize: number;
  filters: EngagementFilters;
  searchQuery: string;
  filterOpen: boolean;
}

interface EngagementReportActions {
  fetchData: (params?: { page?: number; startDate?: Date; endDate?: Date }) => Promise<void>;
  fetchAllData: () => Promise<EngagementStatItem[]>;
  setPage: (page: number) => void;
  setFilters: (filters: EngagementFilters) => void;
  setSearchQuery: (query: string) => void;
  setFilterOpen: (open: boolean) => void;
  reset: () => void;
  clearError: () => void;
}

type EngagementReportStore = EngagementReportState & EngagementReportActions;

const initialState: EngagementReportState = {
  items: [],
  summary: null,
  totalRecords: 0,
  isLoading: false,
  error: null,
  currentPage: 1,
  pageSize: 10,
  filters: {
    startDate: undefined,
    endDate: undefined,
  },
  searchQuery: "",
  filterOpen: false,
};

export const useEngagementReportStore = create<EngagementReportStore>((set, get) => ({
  ...initialState,

  fetchData: async (params) => {
    const { currentPage, pageSize, filters } = get();
    const page = params?.page ?? currentPage;
    const startDate = params?.startDate ?? filters.startDate;
    const endDate = params?.endDate ?? filters.endDate;

    set({ isLoading: true, error: null });

    try {
      const res = await reportsApi.getEngagementStats({
        page,
        limit: pageSize,
        startDate: toReportDay(startDate),
        endDate: toReportDay(endDate),
      });

      set({
        items: res.data.items || [],
        summary: res.data.summary || null,
        totalRecords: res.data.total || 0,
        isLoading: false,
        currentPage: page,
      });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err?.response?.data?.message || err?.message || "Failed to load engagement stats",
        items: [],
        summary: null,
        totalRecords: 0,
      });
    }
  },

  fetchAllData: async () => {
    const { filters, totalRecords } = get();
    try {
      const res = await reportsApi.getEngagementStats({
        page: 1,
        limit: totalRecords || 10000,
        startDate: toReportDay(filters.startDate),
        endDate: toReportDay(filters.endDate),
      });
      return res.data.items || [];
    } catch {
      return [];
    }
  },

  setPage: (page) => {
    set({ currentPage: page });
    get().fetchData({ page });
  },

  setFilters: (filters) => {
    set({ filters, currentPage: 1 });
    get().fetchData({ page: 1, ...filters });
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  setFilterOpen: (open) => set({ filterOpen: open }),

  reset: () => set(initialState),

  clearError: () => set({ error: null }),
}));
