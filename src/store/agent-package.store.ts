// src/store/agent-package.store.ts
import { create } from "zustand";
import type {
  AgentPackage,
  AgentActivePackage,
  PackageTransaction,
  BuyPlanPayload,
  UpgradePlanPayload,
  PackageHistoryQuery,
} from "@/types/agent-package.types";
import {
  agentListPlans,
  agentGetCurrentPackage,
  agentGetPackagingStatus,
  agentBuyPlan,
  agentUpgradePlan,
  agentGetPackageHistory,
} from "@/api/package/agent-package.api";

interface AgentPackageState {
  plans: AgentPackage[];
  currentPackage: AgentActivePackage | null;
  // Admin disabled all packages → every package rule/feature gate is lifted.
  packagingDisabled: boolean;
  // True once fetchCurrentPackage has genuinely resolved — needed because
  // "no package" (null) is a valid final state, not "still loading".
  packageFetched: boolean;
  // True when the package could NOT be read (API down, network error, 5xx).
  // Distinct from "no package": we know nothing about this agent's plan, so
  // feature gates must NOT fall back to the locked/upsell state and tell a paying
  // agent to upgrade just because the backend is unreachable.
  packageUnavailable: boolean;
  history: PackageTransaction[];
  isLoading: boolean;
  error: string | null;

  // GET /agent/packages/plans  (public)
  fetchPlans: () => Promise<void>;

  // GET /agent/packages/current
  fetchCurrentPackage: () => Promise<void>;

  // POST /agent/packages/buy
  buyPlan: (payload: BuyPlanPayload) => Promise<AgentActivePackage | null>;

  // PATCH /agent/packages/upgrade
  upgradePlan: (payload: UpgradePlanPayload) => Promise<AgentActivePackage | null>;

  // GET /agent/packages/history
  fetchHistory: (query?: PackageHistoryQuery) => Promise<void>;

  clearError: () => void;
}

export const useAgentPackageStore = create<AgentPackageState>((set) => ({
  plans: [],
  currentPackage: null,
  packagingDisabled: false,
  packageFetched: false,
  packageUnavailable: false,
  history: [],
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchPlans: async () => {
    try {
      set({ isLoading: true, error: null });
      const plans = await agentListPlans();
      set({ plans, isLoading: false });
    } catch (e: any) {
      set({
        isLoading: false,
        error: e?.response?.data?.message || e?.message || "Failed to fetch plans",
      });
    }
  },

  fetchCurrentPackage: async () => {
    set({ isLoading: true, error: null });

    // A 404/204 means "this agent has no package" — a real answer. Anything else
    // (no response at all, 5xx, timeout) means we simply could not ask, and must
    // not be flattened into "no package".
    const isMissingPackage = (e: any) => {
      const status = e?.response?.status;
      return status === 404 || status === 204;
    };

    const [packageResult, statusResult] = await Promise.allSettled([
      agentGetCurrentPackage(),
      agentGetPackagingStatus(),
    ]);

    const packageFailed =
      packageResult.status === "rejected" &&
      !isMissingPackage(packageResult.reason);
    const statusFailed = statusResult.status === "rejected";

    if (packageFailed || statusFailed) {
      const reason: any =
        packageResult.status === "rejected" ? packageResult.reason : (statusResult as any).reason;
      set({
        isLoading: false,
        packageUnavailable: true,
        packageFetched: false,
        error:
          reason?.response?.data?.message ||
          reason?.message ||
          "Failed to fetch current package",
      });
      return;
    }

    set({
      currentPackage:
        packageResult.status === "fulfilled" ? packageResult.value : null,
      packagingDisabled:
        statusResult.status === "fulfilled"
          ? statusResult.value.packagingDisabled
          : false,
      packageFetched: true,
      packageUnavailable: false,
      isLoading: false,
    });
  },

  buyPlan: async (payload) => {
    try {
      set({ isLoading: true, error: null });
      const currentPackage = await agentBuyPlan(payload);
      set({ currentPackage, isLoading: false });
      return currentPackage;
    } catch (e: any) {
      set({
        isLoading: false,
        error: e?.response?.data?.message || e?.message || "Failed to buy plan",
      });
      return null;
    }
  },

  upgradePlan: async (payload) => {
    try {
      set({ isLoading: true, error: null });
      const currentPackage = await agentUpgradePlan(payload);
      set({ currentPackage, isLoading: false });
      return currentPackage;
    } catch (e: any) {
      set({
        isLoading: false,
        error: e?.response?.data?.message || e?.message || "Failed to upgrade plan",
      });
      return null;
    }
  },

  fetchHistory: async (query) => {
    try {
      set({ isLoading: true, error: null });
      const history = await agentGetPackageHistory(query);
      set({ history, isLoading: false });
    } catch (e: any) {
      set({
        isLoading: false,
        error:
          e?.response?.data?.message || e?.message || "Failed to fetch package history",
      });
    }
  },
}));
