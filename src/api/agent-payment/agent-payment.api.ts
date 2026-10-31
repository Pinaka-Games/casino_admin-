import api from "../config/axios.config";

export enum AgentPaymentRequesterType {
  AGENT = "AGENT",
  SUBAGENT = "SUBAGENT",
}

export enum AgentPaymentMethod {
  BANK = "BANK",
  CRYPTO = "CRYPTO",
}

export enum AgentPaymentStatus {
  PENDING_AGENT = "PENDING_AGENT",
  AGENT_APPROVED = "AGENT_APPROVED",
  PENDING_ADMIN = "PENDING_ADMIN",
  ADMIN_APPROVED = "ADMIN_APPROVED",
  COMPLETED = "COMPLETED",
  REJECTED_BY_AGENT = "REJECTED_BY_AGENT",
  REJECTED_BY_ADMIN = "REJECTED_BY_ADMIN",
}

export interface AgentPaymentRequest {
  id: string;
  requesterType: AgentPaymentRequesterType;
  requesterEmployeeId: string;
  parentAgentEmployeeId?: string;
  amount: number | string;
  paymentMethod?: AgentPaymentMethod;
  paymentDetails?: Record<string, any>;
  status: AgentPaymentStatus;
  note?: string;
  rejectionReason?: string;
  transactionRef?: string;
  /** Settle toast already shown to the requester (any browser). */
  requesterNotifiedAt?: string | null;
  /** Requester closed the rejection banner (any browser). */
  requesterDismissedAt?: string | null;
  agentApprovedAt?: string;
  adminApprovedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  requester?: { id: string; username: string; email: string };
  parentAgent?: { id: string; username: string; email: string };
  /**
   * Server-computed answer to "is there anywhere to send this money?" — the
   * payee confirmed a destination and the provider payout has not failed. Only
   * the admin endpoints return it (adminList / adminGet). Admin money actions
   * are gated on this, and `payoutBlockReason` explains a `false`.
   */
  payoutReady?: boolean;
  payoutBlockReason?: string | null;
  payoutProvider?: "BREEZE" | "COINFLOW" | "MANUAL" | "NONE";
  /** Provider-side status of the linked payout, when there is one. */
  payoutProviderStatus?: string | null;
  /** Provider refused to release a ready payout (retried every 5 min). */
  payoutReleaseError?: string | null;
}

/**
 * A Breeze/Coinflow payout attempt that has not become a payment request yet.
 * The request (and the wallet debit) is only created once the provider confirms
 * the payee finished the hosted form; until then this is the only record.
 */
export type PayoutAttemptStatus =
  | "INITIATED"
  | "PROCESSING"
  | "NEEDS_REVIEW"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED"
  | "ABANDONED";

export interface PayoutAttempt {
  id: string;
  provider: "BREEZE" | "COINFLOW";
  amount: number;
  paymentMethod: AgentPaymentMethod;
  status: PayoutAttemptStatus;
  providerStatus: string;
  reason: string | null;
  transactionRef: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentPaymentRequestPayload {
  amount: number;
  note?: string;
  paymentMethod?: AgentPaymentMethod;
  paymentDetails?: Record<string, any>;
}

export interface SubmitPaymentDetailsPayload {
  paymentMethod: AgentPaymentMethod;
  paymentDetails: Record<string, any>;
}

/**
 * The admin "Payout Lock" (Payout/Days Settings) as it applies to ME — a
 * cooldown measured from my last completed payout on either rail. `locked` is
 * the server's verdict; the countdown fields exist so the dashboard can explain
 * the refusal up front instead of letting the requester submit into an error.
 */
export interface PayoutLockState {
  enabled: boolean;
  lockSec: number;
  lastPayoutAt: string | null;
  lockedUntil: string | null;
  remainingSec: number;
  locked: boolean;
}

export const agentPaymentApi = {
  createRequest: (data: CreateAgentPaymentRequestPayload) =>
    api.post<AgentPaymentRequest>("agent-payment/request", data),

  myRequests: () => api.get<AgentPaymentRequest[]>("agent-payment/my-requests"),

  myPayoutAttempts: () =>
    api.get<PayoutAttempt[]>("agent-payment/my-payout-attempts"),

  myPayoutLock: () => api.get<PayoutLockState>("agent-payment/payout-lock"),

  submitPaymentDetails: (id: string, data: SubmitPaymentDetailsPayload) =>
    api.post<AgentPaymentRequest>(`agent-payment/my-requests/${id}/payment-details`, data),

  // Requester cancels their own request before anyone acts on it — refunds the
  // frozen funds so they can claim again.
  cancelMyRequest: (id: string) =>
    api.post<AgentPaymentRequest>(`agent-payment/my-requests/${id}/cancel`),

  ackNotified: (ids: string[]) =>
    api.post<{ updated: number }>(`agent-payment/my-requests/ack-notified`, { ids }),

  dismissMyRequest: (id: string) =>
    api.post<{ id: string; dismissed: true }>(`agent-payment/my-requests/${id}/dismiss`),

  agentSubRequests: (status?: AgentPaymentStatus) =>
    api.get<AgentPaymentRequest[]>(
      `agent-payment/agent/sub-requests${status ? `?status=${status}` : ""}`,
    ),

  agentApprove: (id: string) =>
    api.post<AgentPaymentRequest>(`agent-payment/agent/${id}/approve`),

  agentReject: (id: string, reason: string) =>
    api.post<AgentPaymentRequest>(`agent-payment/agent/${id}/reject`, { reason }),

  adminList: (params: {
    requesterType?: AgentPaymentRequesterType;
    status?: AgentPaymentStatus;
    search?: string;
    /** Scope to one agent / sub-agent. `search` matches username/email/id, not this. */
    requesterEmployeeId?: string;
    page?: number;
    limit?: number;
  } = {}) =>
    api.get<{ items: AgentPaymentRequest[]; total: number; page: number; limit: number }>(
      "agent-payment/requests",
      { params },
    ),

  adminStats: () => api.get<Record<string, number>>("agent-payment/stats"),

  adminGet: (id: string) =>
    api.get<AgentPaymentRequest>(`agent-payment/requests/${id}`),

  adminApprove: (id: string) =>
    api.post<AgentPaymentRequest>(`agent-payment/requests/${id}/approve`),

  adminReject: (id: string, reason: string) =>
    api.post<AgentPaymentRequest>(`agent-payment/requests/${id}/reject`, { reason }),

  adminComplete: (id: string, transactionRef?: string) =>
    api.post<AgentPaymentRequest>(`agent-payment/requests/${id}/complete`, {
      transactionRef,
    }),
};
