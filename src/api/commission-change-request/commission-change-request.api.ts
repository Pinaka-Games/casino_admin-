import api from "../config/axios.config";

export type CommissionChangeStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface CommissionChangeRequest {
  id: string;
  subAgentId: string;
  subAgentEmployeeId: string;
  subAgentUsername?: string;
  subAgentEmail?: string;
  requestedByEmployeeId: string;
  requestedBy?: { id: string; username?: string; email?: string };
  proposedCommissions: Record<string, number>;
  previousCommissions?: Record<string, number>;
  note?: string;
  status: CommissionChangeStatus;
  rejectionReason?: string;
  counterCommissions?: Record<string, number>;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const commissionChangeRequestApi = {
  // ── Agent (parent) ──
  create: (
    subAgentId: string,
    commissions: Record<string, number>,
    note?: string,
  ) =>
    api.post<CommissionChangeRequest>("/commission-change-requests/request", {
      subAgentId,
      commissions,
      note,
    }),

  mine: (status?: CommissionChangeStatus) =>
    api.get<{ items: CommissionChangeRequest[]; total: number }>(
      "/commission-change-requests/mine",
      { params: { status } },
    ),

  // ── Sub-agent (approver) ──
  inbox: (status?: CommissionChangeStatus) =>
    api.get<CommissionChangeRequest[]>("/commission-change-requests/inbox", {
      params: { status },
    }),

  approve: (id: string) =>
    api.post<CommissionChangeRequest>(
      `/commission-change-requests/${id}/approve`,
    ),

  reject: (
    id: string,
    reason: string,
    counterCommissions?: Record<string, number>,
  ) =>
    api.post<CommissionChangeRequest>(
      `/commission-change-requests/${id}/reject`,
      { reason, counterCommissions },
    ),
};
