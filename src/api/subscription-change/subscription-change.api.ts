// src/api/subscription-change/subscription-change.api.ts
import api from "../config/axios.config";

export type SubscriptionChangeStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface SubscriptionChangeRecord {
  id: string;
  userId: string;
  fromPlanId?: string | null;
  fromPlanName?: string | null;
  toPlanId: string;
  toPlanName?: string | null;
  notes?: string | null;
  status: SubscriptionChangeStatus;
  createdByEmployeeId?: string | null;
  processedByEmployeeId?: string | null;
  processedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; username?: string | null; email?: string | null };
}

export interface PaginatedSubscriptionChanges {
  data: SubscriptionChangeRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateSubscriptionChangeDto {
  userId: string;
  toPlanId: string;
  notes?: string;
}

export interface ListSubscriptionChangesParams {
  status?: string;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export const subscriptionChangeApi = {
  create: (dto: CreateSubscriptionChangeDto) =>
    api.post<SubscriptionChangeRecord>("/subscription-changes", dto),

  list: (params?: ListSubscriptionChangesParams) =>
    api.get<PaginatedSubscriptionChanges>("/subscription-changes", { params }),

  getOne: (id: string) =>
    api.get<SubscriptionChangeRecord>(`/subscription-changes/${id}`),

  approve: (id: string) =>
    api.patch<SubscriptionChangeRecord>(`/subscription-changes/${id}/approve`),

  reject: (id: string) =>
    api.patch<SubscriptionChangeRecord>(`/subscription-changes/${id}/reject`),
};
