import api from "../config/axios.config";

export type SubAgentDeleteRequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type SubAgentRequestType = "DELETE" | "STATUS";

export interface SubAgentDeleteRequest {
  id: string;
  subAgentId: string;
  subAgentEmployeeId?: string;
  subAgentUsername?: string;
  subAgentEmail?: string;
  requestedByEmployeeId: string;
  requestedBy?: { id: string; username?: string; email?: string };
  type: SubAgentRequestType;
  targetBlocked?: boolean | null;
  reason: string;
  status: SubAgentDeleteRequestStatus;
  reviewedById?: string;
  reviewedBy?: { id: string; username?: string; email?: string };
  reviewedAt?: string;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubAgentDeleteRequestList {
  items: SubAgentDeleteRequest[];
  total: number;
  page: number;
  limit: number;
}

export const subAgentDeleteRequestApi = {
  // ── Agent ──
  create: (subAgentId: string, reason: string) =>
    api.post<SubAgentDeleteRequest>("/sub-agent-delete-requests/request", {
      subAgentId,
      reason,
      type: "DELETE",
    }),

  // Request active/inactive change (targetBlocked=true → deactivate)
  createStatus: (subAgentId: string, reason: string, targetBlocked: boolean) =>
    api.post<SubAgentDeleteRequest>("/sub-agent-delete-requests/request", {
      subAgentId,
      reason,
      type: "STATUS",
      targetBlocked,
    }),

  mine: () =>
    api.get<SubAgentDeleteRequest[]>("/sub-agent-delete-requests/mine"),

  // ── Admin ──
  adminList: (params?: {
    status?: SubAgentDeleteRequestStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) =>
    api.get<SubAgentDeleteRequestList>("/sub-agent-delete-requests", { params }),

  adminStats: () =>
    api.get<Record<string, number>>("/sub-agent-delete-requests/stats"),

  approve: (id: string, note?: string) =>
    api.post<SubAgentDeleteRequest>(
      `/sub-agent-delete-requests/${id}/approve`,
      { note },
    ),

  reject: (id: string, note?: string) =>
    api.post<SubAgentDeleteRequest>(
      `/sub-agent-delete-requests/${id}/reject`,
      { note },
    ),
};
