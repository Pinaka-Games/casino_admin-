import { create } from "zustand";
import { toast } from "react-hot-toast";
import { systemConfigApi } from "@/api/system-config/system-config.api";
import {
  SystemConfig,
  SystemConfigResponse,
  SystemConfigSectionKey,
} from "@/types/system-config";

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response &&
    error.response.data &&
    typeof error.response.data === "object" &&
    "message" in error.response.data
  ) {
    const maybeMessage = error.response.data.message;
    if (typeof maybeMessage === "string" && maybeMessage.trim().length > 0) {
      return maybeMessage;
    }
  }

  return fallback;
};

interface SystemConfigStoreState {
  config: SystemConfig | null;
  meta: Pick<SystemConfigResponse, "key" | "version" | "createdAt" | "updatedAt"> | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

interface SystemConfigStoreActions {
  fetchConfig: () => Promise<void>;
  fetchDefaults: () => Promise<SystemConfig | null>;
  saveConfig: (config: SystemConfig) => Promise<SystemConfig | null>;
  patchSection: <TSection>(section: SystemConfigSectionKey, value: TSection) => Promise<void>;
  resetConfig: () => Promise<SystemConfig | null>;
  clearError: () => void;
}

export const useSystemConfigStore = create<
  SystemConfigStoreState & SystemConfigStoreActions
>((set) => ({
  config: null,
  meta: null,
  isLoading: false,
  isSaving: false,
  error: null,

  fetchConfig: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await systemConfigApi.get();
      set({
        config: response.config,
        meta: {
          key: response.key,
          version: response.version,
          createdAt: response.createdAt,
          updatedAt: response.updatedAt,
        },
        isLoading: false,
      });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(
        error,
        "Failed to fetch system configuration",
      );
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
    }
  },

  fetchDefaults: async () => {
    try {
      return await systemConfigApi.getDefaults();
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(
        error,
        "Failed to fetch default configuration",
      );
      set({ error: errorMessage });
      toast.error(errorMessage);
      return null;
    }
  },

  saveConfig: async (config) => {
    set({ isSaving: true, error: null });
    try {
      const response = await systemConfigApi.update(config);
      set({
        config: response.config,
        meta: {
          key: response.key,
          version: response.version,
          createdAt: response.createdAt,
          updatedAt: response.updatedAt,
        },
        isSaving: false,
      });
      toast.success("System configuration saved successfully");
      return response.config;
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(
        error,
        "Failed to save system configuration",
      );
      set({ error: errorMessage, isSaving: false });
      toast.error(errorMessage);
      return null;
    }
  },

  patchSection: async (section, value) => {
    set({ isSaving: true, error: null });
    try {
      const response = await systemConfigApi.patchSection(section, value);
      set({
        config: response.config,
        meta: {
          key: response.key,
          version: response.version,
          createdAt: response.createdAt,
          updatedAt: response.updatedAt,
        },
        isSaving: false,
      });
      toast.success(`${section} updated`);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, `Failed to update ${section}`);
      set({ error: errorMessage, isSaving: false });
      toast.error(errorMessage);
    }
  },

  resetConfig: async () => {
    set({ isSaving: true, error: null });
    try {
      const response = await systemConfigApi.reset();
      set({
        config: response.config,
        meta: {
          key: response.key,
          version: response.version,
          createdAt: response.createdAt,
          updatedAt: response.updatedAt,
        },
        isSaving: false,
      });
      toast.success("System configuration reset to defaults");
      return response.config;
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(
        error,
        "Failed to reset configuration",
      );
      set({ error: errorMessage, isSaving: false });
      toast.error(errorMessage);
      return null;
    }
  },

  clearError: () => set({ error: null }),
}));
