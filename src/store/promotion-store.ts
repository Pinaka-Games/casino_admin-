import { create } from "zustand";
import {
  Promotion,
  CreatePromotionDto,
  UpdatePromotionDto,
  PromotionStatistics,
} from "@/types/promotion";
import * as PromotionsAPI from "@/api/promotions/promotions.api";
import { toast } from "react-hot-toast";

interface PromotionStore {
  promotions: Promotion[];
  currentPromotion: Promotion | null;
  statistics: PromotionStatistics | null;
  isLoading: boolean;
  error: string | null;

  // Actions  
  fetchPromotions: (activeOnly?: boolean) => Promise<void>;
  fetchPromotionById: (id: string) => Promise<void>;
  fetchPromotionStatistics: (id: string) => Promise<void>;
  createPromotion: (data: CreatePromotionDto) => Promise<void>;
  updatePromotion: (id: string, data: UpdatePromotionDto) => Promise<void>;
  deletePromotion: (id: string) => Promise<void>;
  seedPromotions: () => Promise<void>;
  clearCurrentPromotion: () => void;
  clearError: () => void;
}

export const usePromotionStore = create<PromotionStore>((set, get) => ({
  promotions: [],
  currentPromotion: null,
  statistics: null,
  isLoading: false,
  error: null,

  fetchPromotions: async (activeOnly = false) => {
    set({ isLoading: true, error: null });
    try {
      const data = await PromotionsAPI.getAllPromotions(activeOnly);
      set({ promotions: data, isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || "Failed to fetch promotions";
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
    }
  },

  fetchPromotionById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await PromotionsAPI.getPromotionById(id);
      set({ currentPromotion: data, isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || "Failed to fetch promotion";
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
    }
  },

  fetchPromotionStatistics: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await PromotionsAPI.getPromotionStatistics(id);
      set({ statistics: data, isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || "Failed to fetch statistics";
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
    }
  },

  createPromotion: async (data: CreatePromotionDto) => {
    set({ isLoading: true, error: null });
    try {
      const newPromotion = await PromotionsAPI.createPromotion(data);
      set((state) => ({
        promotions: [...state.promotions, newPromotion],
        isLoading: false,
      }));
      toast.success("Promotion created successfully");
    } catch (error: any) {
      let errorMessage = "Failed to create promotion";
      
      if (error.response?.data?.message) {
        // Handle validation errors (array of messages)
        if (Array.isArray(error.response.data.message)) {
          errorMessage = error.response.data.message.join(", ");
        } else {
          errorMessage = error.response.data.message;
        }
      }
      
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  updatePromotion: async (id: string, data: UpdatePromotionDto) => {
    set({ isLoading: true, error: null });
    try {
      const updatedPromotion = await PromotionsAPI.updatePromotion(id, data);
      set((state) => ({
        promotions: state.promotions.map((p) =>
          p.id === id ? updatedPromotion : p
        ),
        currentPromotion:
          state.currentPromotion?.id === id
            ? updatedPromotion
            : state.currentPromotion,
        isLoading: false,
      }));
      toast.success("Promotion updated successfully");
    } catch (error: any) {
      let errorMessage = "Failed to update promotion";
      
      if (error.response?.data?.message) {
        // Handle validation errors (array of messages)
        if (Array.isArray(error.response.data.message)) {
          errorMessage = error.response.data.message.join(", ");
        } else {
          errorMessage = error.response.data.message;
        }
      }
      
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  deletePromotion: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await PromotionsAPI.deletePromotion(id);
      set((state) => ({
        promotions: state.promotions.filter((p) => p.id !== id),
        isLoading: false,
      }));
      toast.success("Promotion deleted successfully");
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || "Failed to delete promotion";
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  seedPromotions: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await PromotionsAPI.seedPromotions();
      toast.success(result.message);
      // Refresh promotions list
      await get().fetchPromotions();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || "Failed to seed promotions";
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
    }
  },

  clearCurrentPromotion: () => set({ currentPromotion: null }),

  clearError: () => set({ error: null }),
}));
