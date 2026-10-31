// store/kyc-store.ts
import { create } from "zustand";
import * as kycApi from "@/api/kyc/kyc.admin.api";
import type {
  AdminKycRow,
  KycListParams,
} from "@/api/kyc/kyc.admin.api";

interface KycState {
  rows: AdminKycRow[];
  total: number;
  currentPage: number;
  pageSize: number;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  statusFilter: string;
}

interface KycActions {
  fetchKycList: (params?: KycListParams) => Promise<void>;
  setPage: (page: number) => void;
  setSearch: (query: string) => void;
  setStatusFilter: (status: string) => void;
  clearError: () => void;
  reset: () => void;
}

type KycStore = KycState & KycActions;

const initialState: KycState = {
  rows: [],
  total: 0,
  currentPage: 1,
  pageSize: 10,
  isLoading: false,
  error: null,
  searchQuery: "",
  statusFilter: "",
};

export const useKycStore = create<KycStore>((set, get) => ({
  ...initialState,

  // FETCH KYC LIST
  fetchKycList: async (params?: KycListParams) => {
    set({ isLoading: true, error: null });

    try {
      const { currentPage, pageSize, searchQuery, statusFilter } = get();

      const result = await kycApi.listKycProfiles({
        page: params?.page ?? currentPage,
        limit: params?.limit ?? pageSize,
        search: params?.search ?? searchQuery,
        status: params?.status !== undefined ? params.status : statusFilter,
      });

      set({
        rows: result.rows,
        total: result.total,
        currentPage: result.page,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to fetch KYC list";

      set({
        isLoading: false,
        error: msg,
        rows: [],
        total: 0,
      });
    }
  },

  // SET PAGE
  setPage: (page: number) => {
    set({ currentPage: page });
    get().fetchKycList({ page });
  },

  // SET SEARCH
  setSearch: (query: string) => {
    set({ searchQuery: query, currentPage: 1 });
    get().fetchKycList({ search: query, page: 1 });
  },

  // SET STATUS FILTER
  setStatusFilter: (status: string) => {
    set({ statusFilter: status, currentPage: 1 });
    get().fetchKycList({ status, page: 1 });
  },

  // CLEAR ERROR
  clearError: () => set({ error: null }),

  // RESET
  reset: () => set(initialState),
}));