import { create } from "zustand";
import {
  getSeonRiskDecisionDetails,
  listSeonRiskDecisions,
  type SeonRiskDecisionRow,
  type SeonRiskDecisionValue,
  type SeonRiskListParams,
} from "@/api/compliance";

type VpnFilter = "all" | "true" | "false";

interface SeonRiskFilters {
  search: string;
  actionType: string;
  decision: SeonRiskDecisionValue | "";
  countryCode: string;
  vpn: VpnFilter;
  dateFrom: string;
  dateTo: string;
  scoreMin: string;
  scoreMax: string;
}

interface SeonRiskState {
  rows: SeonRiskDecisionRow[];
  total: number;
  currentPage: number;
  pageSize: number;
  isLoading: boolean;
  isDetailsLoading: boolean;
  error: string | null;
  filters: SeonRiskFilters;
  appliedFilters: SeonRiskListParams;
  selectedRisk: SeonRiskDecisionRow | null;
}

interface SeonRiskActions {
  fetchSeonRiskList: (params?: SeonRiskListParams) => Promise<void>;
  applyFilters: () => Promise<void>;
  setPage: (page: number) => void;
  setFilter: <K extends keyof SeonRiskFilters>(key: K, value: SeonRiskFilters[K]) => void;
  fetchSeonRiskDetails: (id: string) => Promise<SeonRiskDecisionRow | null>;
  setSelectedRisk: (row: SeonRiskDecisionRow | null) => void;
  clearError: () => void;
  reset: () => void;
}

type SeonRiskStore = SeonRiskState & SeonRiskActions;

const initialFilters: SeonRiskFilters = {
  search: "",
  actionType: "",
  decision: "",
  countryCode: "",
  vpn: "all",
  dateFrom: "",
  dateTo: "",
  scoreMin: "",
  scoreMax: "",
};

const initialState: SeonRiskState = {
  rows: [],
  total: 0,
  currentPage: 1,
  pageSize: 10,
  isLoading: false,
  isDetailsLoading: false,
  error: null,
  filters: initialFilters,
  appliedFilters: {
    page: 1,
    limit: 10,
  },
  selectedRisk: null,
};

const normalizeScore = (value: string): number | undefined => {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === "object" && error !== null) {
    const responseMessage = (
      error as { response?: { data?: { message?: unknown } } }
    ).response?.data?.message;
    if (typeof responseMessage === "string" && responseMessage.trim()) {
      return responseMessage;
    }

    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallback;
};

const buildParamsFromFilters = (
  filters: SeonRiskFilters,
  page: number,
  limit: number,
): SeonRiskListParams => ({
  page,
  limit,
  search: filters.search.trim() || undefined,
  actionType: filters.actionType.trim() || undefined,
  decision: filters.decision || undefined,
  countryCode: filters.countryCode.trim().toUpperCase() || undefined,
  isVpnProxy: filters.vpn === "all" ? undefined : filters.vpn,
  dateFrom: filters.dateFrom || undefined,
  dateTo: filters.dateTo || undefined,
  scoreMin: normalizeScore(filters.scoreMin),
  scoreMax: normalizeScore(filters.scoreMax),
});

export const useSeonRiskStore = create<SeonRiskStore>((set, get) => ({
  ...initialState,

  fetchSeonRiskList: async (params?: SeonRiskListParams) => {
    set({ isLoading: true, error: null });
    try {
      const { appliedFilters, currentPage, pageSize } = get();
      const payload: SeonRiskListParams = {
        ...appliedFilters,
        page: params?.page ?? currentPage,
        limit: params?.limit ?? pageSize,
        ...params,
      };

      const result = await listSeonRiskDecisions(payload);

      set({
        rows: result.rows || [],
        total: result.total || 0,
        currentPage: result.page || payload.page || 1,
        appliedFilters: {
          ...payload,
          page: result.page || payload.page || 1,
          limit: result.limit || payload.limit || pageSize,
        },
        isLoading: false,
        error: null,
      });
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Failed to fetch SEON risk decisions");
      set({
        rows: [],
        total: 0,
        isLoading: false,
        error: msg,
      });
    }
  },

  applyFilters: async () => {
    const { filters, pageSize } = get();
    const next = buildParamsFromFilters(filters, 1, pageSize);
    set({
      currentPage: 1,
      appliedFilters: next,
    });
    await get().fetchSeonRiskList(next);
  },

  setPage: (page: number) => {
    set({ currentPage: page });
    void get().fetchSeonRiskList({ ...get().appliedFilters, page });
  },

  setFilter: (key, value) => {
    set((state) => ({
      filters: {
        ...state.filters,
        [key]: value,
      },
    }));
  },

  fetchSeonRiskDetails: async (id: string) => {
    set({ isDetailsLoading: true, error: null });
    try {
      const details = await getSeonRiskDecisionDetails(id);
      set({
        selectedRisk: details,
        isDetailsLoading: false,
      });
      return details;
    } catch (err: unknown) {
      const msg = getErrorMessage(err, "Failed to load risk decision details");
      set({
        isDetailsLoading: false,
        error: msg,
      });
      throw err;
    }
  },

  setSelectedRisk: (row) => set({ selectedRisk: row }),

  clearError: () => set({ error: null }),

  reset: () => set(initialState),
}));
