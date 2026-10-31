import axios from "axios";
import api from "@/api/config/axios.config";
import { Bonus, CreateBonusDto, UpdateBonusDto } from "@/types/bonus";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1/admin";

const bonusAPI = axios.create({
  baseURL: `${API_BASE_URL}/bonus`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth token interceptor
bonusAPI.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Create a new bonus
 */
export const createBonus = async (data: CreateBonusDto): Promise<Bonus> => {
  const response = await bonusAPI.post("/create", data);
  return response.data;
};

/**
 * Get all bonuses
 * @param activeOnly - Filter to show only active bonuses
 */
export const getAllBonuses = async (activeOnly = false): Promise<Bonus[]> => {
  const response = await bonusAPI.get("/all", {
    params: { activeOnly: activeOnly ? "true" : "false" },
  });
  return response.data;
};

/**
 * Get a specific bonus by ID
 */
export const getBonusById = async (id: string): Promise<Bonus> => {
  const response = await bonusAPI.get(`/${id}`);
  return response.data;
};

/**
 * Update a bonus
 */
export const updateBonus = async (
  id: string,
  data: UpdateBonusDto
): Promise<Bonus> => {
  const response = await bonusAPI.patch(`/${id}`, data);
  return response.data;
};

/**
 * Delete a bonus. Bonuses players have already claimed cannot be hard deleted —
 * the API archives those instead and reports which happened.
 */
export const deleteBonus = async (
  id: string,
): Promise<{ archived: boolean; claimCount: number }> => {
  const { data } = await bonusAPI.delete<{
    archived: boolean;
    claimCount: number;
  }>(`/${id}`);
  return data ?? { archived: false, claimCount: 0 };
};

/**
 * Activate a bonus
 */
export const activateBonus = async (id: string): Promise<Bonus> => {
  const response = await bonusAPI.patch(`/${id}/activate`);
  return response.data;
};

/**
 * Deactivate a bonus
 */
export const deactivateBonus = async (id: string): Promise<Bonus> => {
  const response = await bonusAPI.patch(`/${id}/deactivate`);
  return response.data;
};

/**
 * Seed default bonuses (Admin/Dev only)
 */
export const seedDefaultBonuses = async () => {
  const response = await bonusAPI.post("/seed");
  return response.data;
};

// ─── Admin: User Bonus Claims ────────────────────────────────────────────────

export interface UserBonusClaimsParams {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  userId?: string;
  status?: string;
  search?: string;
  // 'bonus' | 'promotion' — omit or 'all' for both
  source?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface UserBonusClaimsResponse {
  data: UserBonusClaim[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UserBonusClaim {
  id: string;
  source: "bonus" | "promotion";
  userId: string;
  bonusId: string;
  bonusAmount: number;
  wageringRequired: number;
  wageringCompleted: number;
  status: "active" | "completed" | "expired" | "forfeited";
  expiryDate: string | null;
  claimedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  bonus: {
    id: string;
    name: string;
    type: string;
    matchPercentage?: number;
  } | null;
  user: {
    id: string;
    username: string | null;
    entity: string | null;
  };
}

/**
 * Admin: Get all user bonus claims (paginated, filterable)
 * Uses the shared axios instance (with refresh-token support)
 */
export const getAllUserBonusClaims = async (
  params?: UserBonusClaimsParams
): Promise<UserBonusClaimsResponse> => {
  const response = await api.get("/bonus/user-claims", { params });
  return response.data;
};

export interface BonusStats {
  usersWithBonus: number;
  totalClaims: number;
  activeCount: number;
  completedCount: number;
  activePool: number;
  completedPool: number;
  totalValue: number;
}

export const getBonusStats = async (): Promise<BonusStats> => {
  const response = await api.get("/bonus/stats");
  return response.data;
};

export interface ClaimHistoryKpi {
  totalRecords: number;
  activeCount: number;
  activePercent: number;
  completedCount: number;
  completedPercent: number;
  totalValue: number;
  claimsByType: Array<{ type: string; count: number }>;
}

export interface ClaimHistoryKpiParams {
  startDate?: string;
  endDate?: string;
  status?: string;
  source?: string;
  minAmount?: number;
  maxAmount?: number;
}

export const getClaimHistoryKpi = async (
  params?: ClaimHistoryKpiParams
): Promise<ClaimHistoryKpi> => {
  const response = await api.get("/bonus/claim-history-kpi", { params });
  return response.data;
};

export interface UserBonusKpi {
  usersWithBonus: number;
  totalClaims: number;
  activePool: number;
  completed: number;
}

export const getUserBonusKpi = async (): Promise<UserBonusKpi> => {
  const response = await api.get("/bonus/user-claims-kpi");
  return response.data;
};

// ========== USER BONUS API (for user app) ==========

const userBonusAPI = axios.create({
  baseURL: `${API_BASE_URL.replace('/admin', '')}/bonus`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth token interceptor for user API
userBonusAPI.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Get active bonuses based on user status (new/existing)
 * Automatically determines if user is new or existing based on claim history
 */
export const getActiveBonusesForUser = async (): Promise<Bonus[]> => {
  const response = await userBonusAPI.get("/active");
  return response.data;
};
