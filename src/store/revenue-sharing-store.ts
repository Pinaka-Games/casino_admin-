import { create } from "zustand";
import { profileApi } from "@/api/users/users";

export type CommissionCategory = {
  name: string;
  baseRate: number;
};

export type RevenueSharingRow = {
  id: string;
  agentId: string;
  username: string;
  email: string;
  packagePlan: string;
  percentage: number;
  baseShare: number;
  totalShare: number;
  totalEarning: number;
  referralCode: string;
  joinedAt: string;
  isActive: boolean;
  isFrozen: boolean;
  playersCount: number;
  commissions: CommissionCategory[];
  ggrRates: Record<string, number>;
};

interface RevenueSharingState {
  rows: RevenueSharingRow[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  currentPage: number;
  totalPages: number;

  setSearchQuery: (query: string) => void;
  setPage: (page: number) => void;
  fetchRevenueData: (page?: number, search?: string) => Promise<void>;
  clearError: () => void;
}

export const useRevenueSharingStore = create<RevenueSharingState>((set, get) => ({
  rows: [],
  isLoading: false,
  error: null,
  searchQuery: "",
  currentPage: 1,
  totalPages: 1,

  setSearchQuery: (query: string) => {
    set({ searchQuery: query, currentPage: 1 });
    get().fetchRevenueData();
  },

  setPage: (page: number) => {
    set({ currentPage: page });
    get().fetchRevenueData();
  },

  clearError: () => set({ error: null }),

  fetchRevenueData: async (page?: number, search?: string) => {
    const { currentPage: storePage, searchQuery: storeSearch } = get();
    
    // Determine which values to use: provided arguments or store state
    const targetPage = page !== undefined ? page : storePage;
    const targetSearch = search !== undefined ? search : storeSearch;

    set({ isLoading: true, error: null });

    try {
      const response = await profileApi.getRevenueSharingPackages({
        page: targetPage,
        limit: 10,
        search: targetSearch,
      });

      const { data, meta } = response.data;
      
      set({ 
        rows: data || [], 
        totalPages: meta?.totalPages || 1, 
        isLoading: false 
      });
    } catch (error: any) {
      console.error("Failed to fetch revenue sharing data:", error);
      set({
        isLoading: false,
        error: error?.response?.data?.message || "Failed to fetch revenue sharing data",
      });
    }
  },
}));
