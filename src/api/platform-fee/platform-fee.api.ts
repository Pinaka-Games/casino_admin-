import api from "../config/axios.config";

export type PlatformFeeType = "PLATFORM" | "GAME" | "PROMOTION" | "OTHER";

export interface PlatformFee {
  id: string;
  code: string;
  name: string;
  feeType: PlatformFeeType;
  percent: number;
  appliesTo: string | null;
  reason: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformFeePayload {
  code: string;
  name: string;
  feeType: PlatformFeeType;
  percent: number;
  appliesTo?: string;
  reason?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface ActivePlatformFee {
  code: string;
  name: string;
  feeType: PlatformFeeType;
  percent: number;
  appliesTo: string | null;
  reason: string | null;
}

export const platformFeeApi = {
  list: () => api.get<PlatformFee[]>("/platform-fees"),
  create: (payload: PlatformFeePayload) =>
    api.post<PlatformFee>("/platform-fees", payload),
  update: (id: string, payload: Partial<PlatformFeePayload>) =>
    api.put<PlatformFee>(`/platform-fees/${id}`, payload),
  remove: (id: string) => api.delete<{ success: boolean }>(`/platform-fees/${id}`),
  // Agent/sub-agent transparency view: active fees with reasons
  listActive: () => api.get<ActivePlatformFee[]>("/platform-fees/active"),
};
