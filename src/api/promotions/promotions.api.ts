import apiClient from "../config/axios.config";
import {
  Promotion,
  CreatePromotionDto,
  UpdatePromotionDto,
  UserPromotion,
  PromotionStatistics,
} from "@/types/promotion";

/**
 * Get all promotions (Admin)
 */
export const getAllPromotions = async (activeOnly = false): Promise<Promotion[]> => {
  const response = await apiClient.get<Promotion[]>(`/promotions/all`, {
    params: { activeOnly },
  });
  return response.data;
};

/**
 * Get active promotions (Public)
 */
export const getActivePromotions = async (): Promise<Promotion[]> => {
  const response = await apiClient.get<Promotion[]>(`/promotions/active`);
  return response.data;
};

/**
 * Get promotion by ID
 */
export const getPromotionById = async (id: string): Promise<Promotion> => {
  const response = await apiClient.get<Promotion>(`/promotions/${id}`);
  return response.data;
};

/**
 * Create a new promotion (Admin)
 */
export const createPromotion = async (data: CreatePromotionDto): Promise<Promotion> => {
  const response = await apiClient.post<Promotion>(`/promotions/create`, data);
  return response.data;
};

/**
 * Update a promotion (Admin)
 */
export const updatePromotion = async (
  id: string,
  data: UpdatePromotionDto
): Promise<Promotion> => {
  const response = await apiClient.patch<Promotion>(`/promotions/${id}`, data);
  return response.data;
};

/**
 * Delete a promotion (Admin)
 */
export const deletePromotion = async (id: string): Promise<{ message: string }> => {
  const response = await apiClient.delete<{ message: string }>(`/promotions/${id}`);
  return response.data;
};

/**
 * Get promotion statistics
 */
export const getPromotionStatistics = async (id: string): Promise<PromotionStatistics> => {
  const response = await apiClient.get<PromotionStatistics>(`/promotions/${id}/statistics`);
  return response.data;
};

/**
 * Get user promotion history
 */
export const getUserPromotions = async (userId: string): Promise<UserPromotion[]> => {
  const response = await apiClient.get<UserPromotion[]>(`/promotions/user/${userId}`);
  return response.data;
};

/**
 * Get active user promotions
 */
export const getActiveUserPromotions = async (userId: string): Promise<UserPromotion[]> => {
  const response = await apiClient.get<UserPromotion[]>(`/promotions/user/${userId}/active`);
  return response.data;
};

/**
 * Seed default promotions (Dev only)
 */
export const seedPromotions = async (): Promise<{
  message: string;
  created: number;
  skipped: number;
  totalInSeed: number;
}> => {
  const response = await apiClient.post<{
    message: string;
    created: number;
    skipped: number;
    skippedPromotions: string[];
    totalInSeed: number;
  }>(`/promotions/seed`);
  return response.data;
};
