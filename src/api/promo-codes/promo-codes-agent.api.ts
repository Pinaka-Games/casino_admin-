import axios from "axios";
import { getAccessToken } from "@/lib/storage";

export interface PromoCode {
  id: string;
  code: string;
  description?: string;
  discountType: "percentage" | "flat";
  discountValue: number;
  minPurchaseAmount: number;
  maxPurchaseAmount?: number | null;
  maxDiscountAmount?: number | null;
  maxUsage: number;
  maxUsagePerUser: number;
  agent?: string;
  isAdminAssigned?: boolean;
  approvalStatus?: "pending" | "approved" | "rejected";
  currency?: string;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
  totalClaimed: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePromoCodeDto {
  code: string;
  description?: string;
  discountType?: "percentage" | "flat";
  discountValue: number;
  minPurchaseAmount?: number;
  maxPurchaseAmount?: number | null;
  maxDiscountAmount?: number | null;
  maxUsage?: number;
  maxUsagePerUser?: number;
  agent?: string;
  currency?: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
}

export type UpdatePromoCodeDto = Partial<CreatePromoCodeDto>;

// Agent routes live at /api/v1/agent/... (not under /admin)
const agentBaseURL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/admin$/, "");

const agentApi = axios.create({
  baseURL: agentBaseURL,
  timeout: 12000,
  headers: { "Content-Type": "application/json" },
});

agentApi.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getAllAgentPromoCodes = async (activeOnly = false): Promise<PromoCode[]> => {
  const response = await agentApi.get<PromoCode[]>("/agent/promo-codes/all", {
    params: { activeOnly },
  });
  return response.data;
};

export const createAgentPromoCode = async (data: CreatePromoCodeDto): Promise<PromoCode> => {
  const response = await agentApi.post<PromoCode>("/agent/promo-codes/create", data);
  return response.data;
};

export const updateAgentPromoCode = async (
  id: string,
  data: UpdatePromoCodeDto,
): Promise<PromoCode> => {
  const response = await agentApi.patch<PromoCode>(`/agent/promo-codes/${id}`, data);
  return response.data;
};

export const deleteAgentPromoCode = async (id: string): Promise<void> => {
  await agentApi.delete(`/agent/promo-codes/${id}`);
};
