import apiClient from "@/api/config/axios.config";

export type PromoApprovalStatus = "pending" | "approved" | "rejected";

export interface PromoCode {
  id: string;
  code: string;
  description?: string;
  discountType: "percentage" | "flat";
  discountValue: number;
  minPurchaseAmount: number;
  maxDiscountAmount?: number | null;
  maxUsage: number;
  maxUsagePerUser: number;
  agent?: string;
  /** Resolved from the agent employee id server-side — display these, not `agent` (a raw UUID). */
  agentEmail?: string;
  agentUsername?: string;
  isAdminAssigned?: boolean;
  approvalStatus?: PromoApprovalStatus;
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

export const getAllPromoCodes = async (activeOnly = false): Promise<PromoCode[]> => {
  const response = await apiClient.get<PromoCode[]>("/promo-codes/all", {
    params: { activeOnly },
  });
  return response.data;
};

export const createPromoCode = async (data: CreatePromoCodeDto): Promise<PromoCode> => {
  const response = await apiClient.post<PromoCode>("/promo-codes/create", data);
  return response.data;
};

export const updatePromoCode = async (id: string, data: UpdatePromoCodeDto): Promise<PromoCode> => {
  const response = await apiClient.patch<PromoCode>(`/promo-codes/${id}`, data);
  return response.data;
};

export const deletePromoCode = async (id: string): Promise<void> => {
  await apiClient.delete(`/promo-codes/${id}`);
};

export const approvePromoCode = async (id: string): Promise<PromoCode> => {
  const response = await apiClient.patch<PromoCode>(`/promo-codes/${id}/approve`);
  return response.data;
};

export const rejectPromoCode = async (id: string): Promise<PromoCode> => {
  const response = await apiClient.patch<PromoCode>(`/promo-codes/${id}/reject`);
  return response.data;
};

export const getPromoCodeSettings = async (): Promise<{ approvalMode: "manual" | "auto" }> => {
  const response = await apiClient.get<{ approvalMode: "manual" | "auto" }>("/promo-codes/settings");
  return response.data;
};

export const updatePromoCodeSettings = async (approvalMode: "manual" | "auto"): Promise<{ approvalMode: "manual" | "auto" }> => {
  const response = await apiClient.patch<{ approvalMode: "manual" | "auto" }>("/promo-codes/settings", { approvalMode });
  return response.data;
};
