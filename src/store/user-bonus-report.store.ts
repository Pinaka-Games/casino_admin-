import { create } from "zustand";
import {
  getAllUserBonusClaims,
  getUserBonusKpi,
  UserBonusClaim,
  UserBonusClaimsParams,
  UserBonusKpi,
} from "@/api/bonus/bonus.api";

interface UserBonusReportState {
  claims: UserBonusClaim[];
  totalClaims: number;
  totalPages: number;
  kpi: UserBonusKpi | null;
  loading: boolean;
  kpiLoading: boolean;
  error: string | null;
  fetchClaims: (params?: UserBonusClaimsParams) => Promise<void>;
  fetchKpi: () => Promise<void>;
  refreshAll: (params?: UserBonusClaimsParams) => Promise<void>;
  clearError: () => void;
}

export const useUserBonusReportStore = create<UserBonusReportState>(
  (set, get) => ({
    claims: [],
    totalClaims: 0,
    totalPages: 0,
    kpi: null,
    loading: false,
    kpiLoading: false,
    error: null,

    fetchClaims: async (params) => {
      try {
        set({ loading: true, error: null });
        const claimsRes = await getAllUserBonusClaims(params);
        set({
          claims: claimsRes.data,
          totalClaims: claimsRes.total,
          totalPages: claimsRes.totalPages,
          loading: false,
        });
      } catch (e: any) {
        set({
          loading: false,
          error:
            e?.response?.data?.message ||
            e?.message ||
            "Failed to load user bonus claims",
        });
      }
    },

    fetchKpi: async () => {
      try {
        set({ kpiLoading: true, error: null });
        const kpi = await getUserBonusKpi();
        set({ kpi, kpiLoading: false });
      } catch (e: any) {
        set({
          kpiLoading: false,
          error:
            e?.response?.data?.message ||
            e?.message ||
            "Failed to load user bonus KPI",
        });
      }
    },

    refreshAll: async (params) => {
      await Promise.all([get().fetchClaims(params), get().fetchKpi()]);
    },

    clearError: () => set({ error: null }),
  }),
);
