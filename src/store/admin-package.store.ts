// src/store/admin-package.store.ts
import { create } from "zustand";
import type {
  AgentPackage,
  AdminCreatePackagePayload,
  AdminUpdatePackagePayload,
  PackageTransaction,
  AgentActivePackage,
} from "@/types/agent-package.types";
import {
  adminListPackages,
  adminGetPackage,
  adminSeedPackages,
  adminCreatePackage,
  adminUpdatePackage,
  adminDeletePackage,
  adminTogglePackage,
  adminApplyPackageToAll,
  adminSetAllPackagesActive,
  adminSetPackageFeature,
  adminListPackageTransactions,
  adminGetUserPackage,
  adminGetUserPackageHistory,
} from "@/api/package/admin-package.api";
import type { ApplyPackageToAllResult } from "@/api/package/admin-package.api";

interface AdminPackageState {
  packages: AgentPackage[];
  selectedPackage: AgentPackage | null;
  transactions: PackageTransaction[];
  userPackage: AgentActivePackage | null;
  isLoading: boolean;
  error: string | null;

  fetchPackages: () => Promise<void>;
  fetchPackageById: (id: string) => Promise<void>;
  seedPackages: () => Promise<boolean>;
  createPackage: (payload: AdminCreatePackagePayload) => Promise<AgentPackage | null>;
  updatePackage: (id: string, payload: AdminUpdatePackagePayload) => Promise<AgentPackage | null>;
  deletePackage: (id: string) => Promise<boolean>;
  togglePackage: (id: string) => Promise<AgentPackage | null>;
  applyPackageToAll: (id: string) => Promise<ApplyPackageToAllResult | null>;
  setPackageFeature: (
    id: string,
    feature: string,
    enabled: boolean
  ) => Promise<AgentPackage | null>;
  setAllPackagesActive: (isActive: boolean) => Promise<boolean>;
  fetchTransactions: (params?: {
    userId?: string;
    type?: string;
    status?: string;
    toPlanId?: string;
  }) => Promise<void>;
  fetchUserPackage: (userId: string) => Promise<void>;
  fetchUserPackageHistory: (userId: string) => Promise<void>;

  clearError: () => void;
  clearSelectedPackage: () => void;
}

export const useAdminPackageStore = create<AdminPackageState>((set, get) => ({
  packages: [],
  selectedPackage: null,
  transactions: [],
  userPackage: null,
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),
  clearSelectedPackage: () => set({ selectedPackage: null }),

  fetchPackages: async () => {
    try {
      set({ isLoading: true, error: null });
      const packages = await adminListPackages();
      set({ packages, isLoading: false });
    } catch (e: any) {
      set({
        isLoading: false,
        error: e?.response?.data?.message || e?.message || "Failed to fetch packages",
      });
    }
  },

  fetchPackageById: async (id) => {
    try {
      set({ isLoading: true, error: null });
      const pkg = await adminGetPackage(id);
      set({ selectedPackage: pkg, isLoading: false });
    } catch (e: any) {
      set({
        isLoading: false,
        error: e?.response?.data?.message || e?.message || "Failed to fetch package",
      });
    }
  },

  seedPackages: async () => {
    try {
      set({ isLoading: true, error: null });
      await adminSeedPackages();
      const packages = await adminListPackages();
      set({ packages, isLoading: false });
      return true;
    } catch (e: any) {
      set({
        isLoading: false,
        error: e?.response?.data?.message || e?.message || "Failed to seed packages",
      });
      return false;
    }
  },

  createPackage: async (payload) => {
    try {
      set({ isLoading: true, error: null });
      const created = await adminCreatePackage(payload);
      const packages = [created, ...get().packages].sort((a, b) => a.seq - b.seq);
      set({ packages, isLoading: false });
      return created;
    } catch (e: any) {
      set({
        isLoading: false,
        error: e?.response?.data?.message || e?.message || "Failed to create package",
      });
      return null;
    }
  },

  updatePackage: async (id, payload) => {
    try {
      set({ isLoading: true, error: null });
      const updated = await adminUpdatePackage(id, payload);
      const packages = get()
        .packages.map((p) => (p.id === id ? updated : p))
        .sort((a, b) => a.seq - b.seq);
      const selectedPackage =
        get().selectedPackage?.id === id ? updated : get().selectedPackage;
      set({ packages, selectedPackage, isLoading: false });
      return updated;
    } catch (e: any) {
      set({
        isLoading: false,
        error: e?.response?.data?.message || e?.message || "Failed to update package",
      });
      return null;
    }
  },

  deletePackage: async (id) => {
    try {
      set({ isLoading: true, error: null });
      await adminDeletePackage(id);
      set({
        packages: get().packages.filter((p) => p.id !== id),
        selectedPackage: get().selectedPackage?.id === id ? null : get().selectedPackage,
        isLoading: false,
      });
      return true;
    } catch (e: any) {
      set({
        isLoading: false,
        error: e?.response?.data?.message || e?.message || "Failed to delete package",
      });
      return false;
    }
  },

  togglePackage: async (id) => {
    try {
      set({ isLoading: true, error: null });
      const updated = await adminTogglePackage(id);
      const packages = get()
        .packages.map((p) => (p.id === id ? updated : p))
        .sort((a, b) => a.seq - b.seq);
      const selectedPackage =
        get().selectedPackage?.id === id ? updated : get().selectedPackage;
      set({ packages, selectedPackage, isLoading: false });
      return updated;
    } catch (e: any) {
      set({
        isLoading: false,
        error: e?.response?.data?.message || e?.message || "Failed to toggle package",
      });
      return null;
    }
  },

  applyPackageToAll: async (id) => {
    try {
      set({ isLoading: true, error: null });
      const result = await adminApplyPackageToAll(id);
      set({ isLoading: false });
      return result;
    } catch (e: any) {
      set({
        isLoading: false,
        error: e?.response?.data?.message || e?.message || "Failed to apply package to all agents",
      });
      return null;
    }
  },

  setAllPackagesActive: async (isActive) => {
    try {
      set({ isLoading: true, error: null });
      const packages = await adminSetAllPackagesActive(isActive);
      set({ packages, isLoading: false });
      return true;
    } catch (e: any) {
      set({
        isLoading: false,
        error: e?.response?.data?.message || e?.message || "Failed to update all packages",
      });
      return false;
    }
  },

  setPackageFeature: async (id, feature, enabled) => {
    try {
      set({ error: null });
      const updated = await adminSetPackageFeature(id, feature, enabled);
      const packages = get()
        .packages.map((p) => (p.id === id ? updated : p))
        .sort((a, b) => a.seq - b.seq);
      set({ packages });
      return updated;
    } catch (e: any) {
      set({
        error: e?.response?.data?.message || e?.message || "Failed to update feature",
      });
      return null;
    }
  },

  fetchTransactions: async (params) => {
    try {
      set({ isLoading: true, error: null });
      const transactions = await adminListPackageTransactions(params);
      set({ transactions, isLoading: false });
    } catch (e: any) {
      set({
        isLoading: false,
        error: e?.response?.data?.message || e?.message || "Failed to fetch transactions",
      });
    }
  },

  fetchUserPackage: async (userId) => {
    try {
      set({ isLoading: true, error: null });
      const userPackage = await adminGetUserPackage(userId);
      set({ userPackage, isLoading: false });
    } catch (e: any) {
      set({
        isLoading: false,
        error: e?.response?.data?.message || e?.message || "Failed to fetch user package",
      });
    }
  },

  fetchUserPackageHistory: async (userId) => {
    try {
      set({ isLoading: true, error: null });
      const transactions = await adminGetUserPackageHistory(userId);
      set({ transactions, isLoading: false });
    } catch (e: any) {
      set({
        isLoading: false,
        error: e?.response?.data?.message || e?.message || "Failed to fetch user package history",
      });
    }
  },
}));
