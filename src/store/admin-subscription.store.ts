// src/store/admin-subscription.store.ts
import { create } from "zustand";
import type {
  SubscriptionPlan,
  AdminCreatePlanPayload,
  AdminUpdatePlanPayload,
  SubscriptionTransaction,
} from "@/types/subscription.types";
import {
  adminListPlans,
  adminSeedDefaultPlans,
  adminCreatePlan,
  adminUpdatePlan,
  adminTogglePlan,
  adminGetPlan,
  adminListTransactions,
  adminDeletePlan,
} from "@/api/subscription/admin-subscription.api";

interface AdminSubscriptionState {
  plans: SubscriptionPlan[];
  selectedPlan: SubscriptionPlan | null;
  transactions: SubscriptionTransaction[];
  isLoading: boolean;
  error: string | null;
  deletePlan: (id: string) => Promise<boolean>;

  fetchTransactions: (params?: {
    userId?: string;
    type?: string;
    status?: string;
    toPlanId?: string;
  }) => Promise<void>;

  fetchPlans: () => Promise<void>;
  seedDefaultPlans: () => Promise<boolean>;
  fetchPlanById: (id: string) => Promise<void>;

  createPlan: (
    payload: AdminCreatePlanPayload,
  ) => Promise<SubscriptionPlan | null>;
  updatePlan: (
    id: string,
    payload: AdminUpdatePlanPayload,
  ) => Promise<SubscriptionPlan | null>;
  togglePlan: (id: string) => Promise<SubscriptionPlan | null>;

  clearError: () => void;
  clearSelectedPlan: () => void;
}

export const useAdminSubscriptionStore = create<AdminSubscriptionState>(
  (set, get) => ({
    plans: [],
    transactions: [],
    selectedPlan: null,
    isLoading: false,
    error: null,

    clearError: () => set({ error: null }),
    clearSelectedPlan: () => set({ selectedPlan: null }),

    fetchPlans: async () => {
      try {
        set({ isLoading: true, error: null });
        const plans = await adminListPlans();
        set({ plans, isLoading: false });
      } catch (e: any) {
        set({
          isLoading: false,
          error:
            e?.response?.data?.message || e?.message || "Failed to fetch plans",
        });
      }
    },

    seedDefaultPlans: async () => {
      try {
        set({ isLoading: true, error: null });
        await adminSeedDefaultPlans();
        const plans = await adminListPlans();
        set({ plans, isLoading: false });
        return true;
      } catch (e: any) {
        set({
          isLoading: false,
          error:
            e?.response?.data?.message || e?.message || "Failed to seed plans",
        });
        return false;
      }
    },

    fetchPlanById: async (id: string) => {
      try {
        set({ isLoading: true, error: null });
        const plan = await adminGetPlan(id);
        set({ selectedPlan: plan, isLoading: false });
      } catch (e: any) {
        set({
          isLoading: false,
          error:
            e?.response?.data?.message || e?.message || "Failed to fetch plan",
        });
      }
    },

    createPlan: async (payload) => {
      try {
        set({ isLoading: true, error: null });
        const created = await adminCreatePlan(payload);

        // update local state
        const plans = [created, ...get().plans].sort((a, b) => a.seq - b.seq);
        set({ plans, isLoading: false });

        return created;
      } catch (e: any) {
        set({
          isLoading: false,
          error:
            e?.response?.data?.message || e?.message || "Failed to create plan",
        });
        return null;
      }
    },

    updatePlan: async (id, payload) => {
      try {
        set({ isLoading: true, error: null });
        const updated = await adminUpdatePlan(id, payload);

        const plans = get()
          .plans.map((p) => (p.id === id ? updated : p))
          .sort((a, b) => a.seq - b.seq);
        const selectedPlan =
          get().selectedPlan?.id === id ? updated : get().selectedPlan;

        set({ plans, selectedPlan, isLoading: false });
        return updated;
      } catch (e: any) {
        set({
          isLoading: false,
          error:
            e?.response?.data?.message || e?.message || "Failed to update plan",
        });
        return null;
      }
    },

    deletePlan: async (id) => {
      try {
        set({ isLoading: true, error: null });
        await adminDeletePlan(id);

        set({
          plans: get().plans.filter((p) => p.id !== id),
          selectedPlan:
            get().selectedPlan?.id === id ? null : get().selectedPlan,
          isLoading: false,
        });

        return true;
      } catch (e: any) {
        set({
          isLoading: false,
          error:
            e?.response?.data?.message || e?.message || "Failed to delete plan",
        });
        return false;
      }
    },

    togglePlan: async (id) => {
      try {
        set({ isLoading: true, error: null });
        const updated = await adminTogglePlan(id);

        const plans = get()
          .plans.map((p) => (p.id === id ? updated : p))
          .sort((a, b) => a.seq - b.seq);
        const selectedPlan =
          get().selectedPlan?.id === id ? updated : get().selectedPlan;

        set({ plans, selectedPlan, isLoading: false });
        return updated;
      } catch (e: any) {
        set({
          isLoading: false,
          error:
            e?.response?.data?.message || e?.message || "Failed to toggle plan",
        });
        return null;
      }
    },

    fetchTransactions: async (params) => {
      try {
        set({ isLoading: true, error: null });
        const transactions = await adminListTransactions(params);
        set({ transactions, isLoading: false });
      } catch (e: any) {
        set({
          isLoading: false,
          error:
            e?.response?.data?.message ||
            e?.message ||
            "Failed to fetch transactions",
        });
      }
    },
  }),
);
