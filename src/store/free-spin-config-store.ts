import { create } from "zustand";
import { FreeSpin, CreateFreeSpinDto, UpdateFreeSpinDto } from "@/types/free-spin";
import { FreeSpinAPI } from "@/api";
import toast from "react-hot-toast";

interface FreeSpinConfigState {
  configs: FreeSpin[];
  loading: boolean;
  // True once fetchConfigs has completed at least once (success OR error).
  // Consumers gate their hydrate effect on this instead of inferring
  // "not yet fetched" from configs.length — an empty result (no templates)
  // or a failed fetch would otherwise re-trigger the effect endlessly.
  configsLoaded: boolean;

  fetchConfigs: (activeOnly?: boolean) => Promise<void>;
  createConfig: (data: CreateFreeSpinDto) => Promise<void>;
  updateConfig: (id: string, data: UpdateFreeSpinDto) => Promise<void>;
  deleteConfig: (id: string) => Promise<void>;
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  const raw = (error as any)?.response?.data?.message;
  if (Array.isArray(raw)) return raw.join(", ");
  if (typeof raw === "string") return raw;
  return fallback;
};

export const useFreeSpinConfigStore = create<FreeSpinConfigState>((set) => ({
  configs: [],
  loading: false,
  configsLoaded: false,

  /* ================= FETCH ================= */
  fetchConfigs: async (activeOnly = false) => {
    try {
      set({ loading: true });
      const data = await FreeSpinAPI.getAllFreeSpins(activeOnly);
      set({
        configs: Array.isArray(data) ? data : [],
        loading: false,
        configsLoaded: true,
      });
    } catch (error) {
      console.error("Fetch free spin configs failed", error);
      set({ loading: false, configsLoaded: true });
      toast.error(getErrorMessage(error, "Failed to load free spin configs"));
    }
  },

  /* ================= CREATE ================= */
  createConfig: async (payload) => {
    try {
      const created = await FreeSpinAPI.createFreeSpin(payload);
      set((state) => ({ configs: [created, ...state.configs] }));
      toast.success("Free spin config created successfully");
    } catch (error) {
      console.error("Create free spin config failed", error);
      toast.error(getErrorMessage(error, "Failed to create free spin config"));
      throw error;
    }
  },

  /* ================= UPDATE ================= */
  updateConfig: async (id, payload) => {
    try {
      const updated = await FreeSpinAPI.updateFreeSpin(id, payload);
      set((state) => ({
        configs: state.configs.map((c) => (c.id === id ? updated : c)),
      }));
      toast.success("Free spin config updated successfully");
    } catch (error) {
      console.error("Update free spin config failed", error);
      toast.error(getErrorMessage(error, "Failed to update free spin config"));
      throw error;
    }
  },

  /* ================= DELETE ================= */
  deleteConfig: async (id) => {
    try {
      await FreeSpinAPI.deleteFreeSpin(id);
      set((state) => ({
        configs: state.configs.filter((c) => c.id !== id),
      }));
      toast.success("Free spin config removed successfully");
    } catch (error) {
      console.error("Delete free spin config failed", error);
      toast.error(getErrorMessage(error, "Failed to delete free spin config"));
      throw error;
    }
  },
}));
