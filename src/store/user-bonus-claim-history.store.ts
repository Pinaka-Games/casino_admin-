import { create } from "zustand";
import {
  getAllUserBonusClaims,
  getClaimHistoryKpi,
  ClaimHistoryKpi,
  ClaimHistoryKpiParams,
  UserBonusClaim,
  UserBonusClaimsParams,
} from "@/api/bonus/bonus.api";

interface UserBonusClaimHistoryState {
  records: UserBonusClaim[];
  total: number;
  totalPages: number;
  kpi: ClaimHistoryKpi | null;
  loading: boolean;
  kpiLoading: boolean;
  error: string | null;
  fetchRecords: (params?: UserBonusClaimsParams) => Promise<void>;
  fetchAllForExport: (params?: UserBonusClaimsParams) => Promise<UserBonusClaim[]>;
  fetchKpi: (params?: ClaimHistoryKpiParams) => Promise<void>;
  refreshAll: (
    claimParams?: UserBonusClaimsParams,
    kpiParams?: ClaimHistoryKpiParams,
  ) => Promise<void>;
  clearError: () => void;
}

export const useUserBonusClaimHistoryStore =
  create<UserBonusClaimHistoryState>((set, get) => ({
    records: [],
    total: 0,
    totalPages: 0,
    kpi: null,
    loading: false,
    kpiLoading: false,
    error: null,

    fetchRecords: async (params) => {
      try {
        set({ loading: true, error: null });
        const res = await getAllUserBonusClaims(params);
        set({
          records: res.data,
          total: res.total,
          totalPages: res.totalPages,
          loading: false,
        });
      } catch (e: any) {
        set({
          loading: false,
          error:
            e?.response?.data?.message ||
            e?.message ||
            "Failed to load bonus claim history",
        });
      }
    },

    fetchAllForExport: async (params) => {
      const PAGE_LIMIT = 100;
      try {
        const first = await getAllUserBonusClaims({ ...params, page: 1, limit: PAGE_LIMIT });
        const allItems: UserBonusClaim[] = [...first.data];
        const totalPages = first.totalPages ?? Math.ceil(first.total / PAGE_LIMIT);
        if (totalPages > 1) {
          const pageNumbers = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
          const results = await Promise.all(
            pageNumbers.map((p) => getAllUserBonusClaims({ ...params, page: p, limit: PAGE_LIMIT }))
          );
          results.forEach((res) => allItems.push(...res.data));
        }
        return allItems;
      } catch {
        return [];
      }
    },

    fetchKpi: async (params) => {
      try {
        set({ kpiLoading: true, error: null });
        const kpi = await getClaimHistoryKpi(params);
        set({ kpi, kpiLoading: false });
      } catch (e: any) {
        set({
          kpiLoading: false,
          error:
            e?.response?.data?.message ||
            e?.message ||
            "Failed to load claim history KPI",
        });
      }
    },

    refreshAll: async (claimParams, kpiParams) => {
      await Promise.all([
        get().fetchRecords(claimParams),
        get().fetchKpi(kpiParams),
      ]);
    },

    clearError: () => set({ error: null }),
  }));
