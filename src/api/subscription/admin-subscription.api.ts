// src/api/subscription/admin-subscription.api.ts
import api from "../config/axios.config";
import type {
  SubscriptionPlan,
  AdminCreatePlanPayload,
  AdminUpdatePlanPayload,
  SubscriptionTransaction,
} from "../../types/subscription.types";

// LIST PLANS (ADMIN)
export const adminListPlans = async (): Promise<SubscriptionPlan[]> => {
  const res = await api.get<SubscriptionPlan[]>("/subscription/plans");
  return res.data;
};

export const adminSeedDefaultPlans = async (): Promise<{ message: string }> => {
  const res = await api.post<{ message: string }>("/subscription/plans/seed");
  return res.data;
};

// GET PLAN (ADMIN)
export const adminGetPlan = async (id: string): Promise<SubscriptionPlan> => {
  const res = await api.get<SubscriptionPlan>(`/subscription/plans/${id}`);
  return res.data;
};

// CREATE PLAN (ADMIN)
export const adminCreatePlan = async (
  payload: AdminCreatePlanPayload
): Promise<SubscriptionPlan> => {
  const res = await api.post<SubscriptionPlan>("/subscription/plans", payload);
  return res.data;
};

// UPDATE PLAN (ADMIN) - patch
export const adminUpdatePlan = async (
  id: string,
  payload: AdminUpdatePlanPayload
): Promise<SubscriptionPlan> => {
  const res = await api.patch<SubscriptionPlan>(`/subscription/plans/${id}`, payload);
  return res.data;
};

// DELETE PLAN (ADMIN)
export const adminDeletePlan = async (
  id: string
): Promise<{ success: boolean }> => {
  const res = await api.delete<{ success: boolean }>(
    `/subscription/plans/${id}`
  );
  return res.data;
};

// TOGGLE ACTIVE/INACTIVE (ADMIN)
export const adminTogglePlan = async (id: string): Promise<SubscriptionPlan> => {
  const res = await api.patch<SubscriptionPlan>(`/subscription/plans/${id}/toggle`);
  return res.data;
};

// GET a user's current subscription (ADMIN)
export const adminGetUserSubscription = async (
  userId: string
): Promise<any> => {
  const res = await api.get(`/subscription/user/${userId}`);
  return res.data;
};

// (PHASE 2) LIST TRANSACTIONS (ADMIN)
export const adminListTransactions = async (params?: {
  userId?: string;
  type?: string;
  status?: string;
  toPlanId?: string;
}): Promise<SubscriptionTransaction[]> => {
  const res = await api.get<SubscriptionTransaction[]>("/subscription/transactions", {
    params,
  });
  return res.data;
};
