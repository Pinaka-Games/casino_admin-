// src/api/package/admin-package.api.ts
import api from "../config/axios.config";
import type {
  AgentPackage,
  AdminCreatePackagePayload,
  AdminUpdatePackagePayload,
  PackageTransaction,
  AgentActivePackage,
} from "../../types/agent-package.types";

// ───────────────── SEED ─────────────────

export const adminSeedPackages = async (): Promise<{ message: string }> => {
  const res = await api.post<{ message: string }>("/agent-packages/seed");
  return res.data;
};

// ───────────────── CRUD ─────────────────

export const adminListPackages = async (): Promise<AgentPackage[]> => {
  const res = await api.get<AgentPackage[]>("/agent-packages");
  return res.data;
};

export const adminGetPackage = async (id: string): Promise<AgentPackage> => {
  const res = await api.get<AgentPackage>(`/agent-packages/${id}`);
  return res.data;
};

export const adminCreatePackage = async (
  payload: AdminCreatePackagePayload
): Promise<AgentPackage> => {
  const res = await api.post<AgentPackage>("/agent-packages", payload);
  return res.data;
};

export const adminUpdatePackage = async (
  id: string,
  payload: AdminUpdatePackagePayload
): Promise<AgentPackage> => {
  const res = await api.patch<AgentPackage>(`/agent-packages/${id}`, payload);
  return res.data;
};

export const adminDeletePackage = async (
  id: string
): Promise<{ success: boolean }> => {
  const res = await api.delete<{ success: boolean }>(`/agent-packages/${id}`);
  return res.data;
};

export const adminTogglePackage = async (id: string): Promise<AgentPackage> => {
  const res = await api.patch<AgentPackage>(`/agent-packages/${id}/toggle`);
  return res.data;
};

export interface ApplyPackageToAllResult {
  message: string;
  packageId: string;
  applied: number;
  skipped: number;
  total: number;
}

export const adminApplyPackageToAll = async (
  id: string
): Promise<ApplyPackageToAllResult> => {
  const res = await api.post<ApplyPackageToAllResult>(
    `/agent-packages/${id}/apply-all`
  );
  return res.data;
};

export const adminSetAllPackagesActive = async (
  isActive: boolean
): Promise<AgentPackage[]> => {
  const res = await api.patch<AgentPackage[]>("/agent-packages/bulk/active", {
    isActive,
  });
  return res.data;
};

export const adminSetPackageFeature = async (
  id: string,
  feature: string,
  enabled: boolean
): Promise<AgentPackage> => {
  const res = await api.patch<AgentPackage>(`/agent-packages/${id}/feature`, {
    feature,
    enabled,
  });
  return res.data;
};

// ───────────────── TRANSACTIONS ─────────────────

export const adminListPackageTransactions = async (params?: {
  userId?: string;
  type?: string;
  status?: string;
  toPlanId?: string;
}): Promise<PackageTransaction[]> => {
  const res = await api.get<PackageTransaction[]>("/agent-packages/transactions", {
    params,
  });
  return res.data;
};

// ───────────────── USER LOOKUP ─────────────────

export const adminGetUserPackage = async (
  userId: string
): Promise<AgentActivePackage> => {
  const res = await api.get<AgentActivePackage>(`/agent-packages/user/${userId}`);
  return res.data;
};

export const adminGetUserPackageHistory = async (
  userId: string
): Promise<PackageTransaction[]> => {
  const res = await api.get<PackageTransaction[]>(
    `/agent-packages/user/${userId}/history`
  );
  return res.data;
};
