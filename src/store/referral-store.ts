import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { referralAdminApi } from "@/services/referral-admin.service";
import { toast } from "react-hot-toast";

interface ReferralState {
  activeTab: "users" | "agents" | "claims";
  
  // Stats
  stats: any | null;
  loadingStats: boolean;
  
  // Claims
  claims: any[];
  totalClaims: number;
  claimsPage: number;
  loadingClaims: boolean;
  
  // Modals
  openModal: boolean;
  openSettingsModal: boolean;
  openDetailsModal: boolean;
  openRemoveModal: boolean;
  
  selectedDetailUser: any | null;
  editRow: any | null;
  removeRow: any | null;
}

interface ReferralActions {
  setActiveTab: (tab: "users" | "agents" | "claims") => void;
  fetchStats: () => Promise<void>;
  fetchClaims: (page?: number) => Promise<void>;
  
  // Modal Actions
  setOpenModal: (open: boolean) => void;
  setOpenSettingsModal: (open: boolean) => void;
  setOpenDetailsModal: (open: boolean) => void;
  setOpenRemoveModal: (open: boolean) => void;
  
  setSelectedDetailUser: (user: any | null) => void;
  setEditRow: (row: any | null) => void;
  setRemoveRow: (row: any | null) => void;
  
  setClaimsPage: (page: number) => void;
  reset: () => void;
}

type ReferralStore = ReferralState & ReferralActions;

const initialState: ReferralState = {
  activeTab: "users",
  stats: null,
  loadingStats: false,
  claims: [],
  totalClaims: 0,
  claimsPage: 1,
  loadingClaims: false,
  openModal: false,
  openSettingsModal: false,
  openDetailsModal: false,
  openRemoveModal: false,
  selectedDetailUser: null,
  editRow: null,
  removeRow: null,
};

export const useReferralStore = create<ReferralStore>()(
  devtools((set, get) => ({
    ...initialState,

    setActiveTab: (tab) => {
      set({ activeTab: tab });
      if (tab === "claims") {
        get().fetchClaims(1);
      }
    },

    fetchStats: async () => {
      set({ loadingStats: true });
      try {
        const token = localStorage.getItem("accessToken") || "";
        const data = await referralAdminApi.getStats(token);
        set({ stats: data, loadingStats: false });
      } catch (error) {
        console.error("Failed to load stats", error);
        set({ loadingStats: false });
      }
    },

    fetchClaims: async (page) => {
      const p = page ?? get().claimsPage;
      set({ loadingClaims: true, claimsPage: p });
      try {
        const token = localStorage.getItem("accessToken") || "";
        const result = await referralAdminApi.getClaims(token, p, 10);
        set({
          claims: result.data || [],
          totalClaims: result.meta?.total || 0,
          loadingClaims: false,
        });
      } catch (error) {
        toast.error("Failed to load claims history");
        set({ loadingClaims: false });
      }
    },

    setOpenModal: (open) => set({ openModal: open }),
    setOpenSettingsModal: (open) => set({ openSettingsModal: open }),
    setOpenDetailsModal: (open) => set({ openDetailsModal: open }),
    setOpenRemoveModal: (open) => set({ openRemoveModal: open }),
    
    setSelectedDetailUser: (user) => set({ selectedDetailUser: user }),
    setEditRow: (row) => set({ editRow: row }),
    setRemoveRow: (row) => set({ removeRow: row }),
    
    setClaimsPage: (page) => {
      set({ claimsPage: page });
      get().fetchClaims(page);
    },

    reset: () => set(initialState),
  }), { name: "ReferralStore" })
);
