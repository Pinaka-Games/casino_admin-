import api from "../config/axios.config";
import type { AdminBreezePayoutSummary } from "@/api/breeze-payment/breeze-payout.api";
import type { AdminCoinflowPayoutSummary } from "@/api/coinflow-payment/coinflow-payout.api";

// CANCELLED is written by the player-side cancel endpoint (redeem.service →
// cancelRedeemRequest) and is distinct from REJECTED, which only an admin can
// set. Leaving it out of this union is why cancelled rows rendered as an
// unlabelled grey status with no filter entry.
export type RedeemStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "PROCESSED"
  /** Withdrawn by the player themselves before release; the amount was refunded. */
  | "CANCELLED";

export interface RedeemRequest {
  id: string;
  userId: string;
  userEmail?: string | null;
  userPhone?: string | null;
  userName?: string | null;
  userUsername?: string | null;
  userAvatar?: string | null;
  productName?: string | null;
  amount: number;
  status: RedeemStatus;
  paymentMethod: string | null;
  notes: string | null;
  processedAt: string | null;
  /**
   * When the money left the platform — settlement time, or the payout page's
   * release stamp while it is still in flight. NULL on a request that never
   * released. This is the date the dashboard's Gross Withdrawals card counts a
   * withdrawal on; `createdAt` is when the player asked for it.
   */
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
  breezePayout?: AdminBreezePayoutSummary | null;
  coinflowPayout?: AdminCoinflowPayoutSummary | null;
}

export interface SpinConfig {
  id: number;
  maxSpinsPerDay: number;
  segmentPercentages: string; // stored as comma-separated string in DB
  maxRedeemAmount: number;
  w9ThresholdAmount: number;
  w9FormConfig?: Record<string, unknown> | null;
  updatedAt: string;
}

export interface UpdateSpinConfigDto {
  maxSpinsPerDay?: number;
  segmentPercentages?: number[]; // backend expects array of numbers
  maxRedeemAmount?: number;
  w9ThresholdAmount?: number;
  w9FormConfig?: Record<string, unknown>;
}

export interface UpdateRedeemStatusDto {
  status: RedeemStatus;
  notes?: string;
}

export type AdminW9VerificationStatus =
  | "NOT_SUBMITTED"
  | "PENDING"
  | "VERIFIED"
  | "REJECTED";

export interface AdminW9Submission {
  submissionId: string;
  userId: string;
  userName: string;
  email: string | null;
  financialYear: string;
  status: AdminW9VerificationStatus;
  submittedDate: string | null;
  reviewedAt: string | null;
  totalWithdrawal: number;
  legalName: string | null;
  businessName: string | null;
  taxClassification: string | null;
  taxIdType: string | null;
  maskedTaxId: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  rejectionReason: string | null;
  w10FileName: string | null;
  w10FileUrl: string | null;
  w10FileKey: string | null;
  w10UploadedAt: string | null;
}

export interface UploadW10Payload {
  fileName: string;
  fileUrl: string;
  fileKey: string;
}

/** Filters for the server-paginated withdrawal listing. */
/** Which timestamp the withdrawal listing's date range and ordering read. */
export type RedeemDateBasis = "created" | "paid";

export interface AdminRedeemListQuery {
  status?: RedeemStatus;
  /** Matches the player's account email or profile phone. */
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  /**
   * Which date the range cuts on. `created` (default) is the request date;
   * `paid` is the date the money released and also drops every request that
   * never released, so the rows reconcile with Gross Withdrawals.
   */
  dateBasis?: RedeemDateBasis;
  /** Provider label as shown in the Payment Method column. */
  paymentMethod?: string;
  payoutStatus?: string;
  amountMin?: string | number;
  amountMax?: string | number;
  /** Column ordering, applied server-side over the whole result set. */
  sortBy?: "date" | "amount" | "status";
  sortDir?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface AdminRedeemListResponse {
  total: number;
  page: number;
  limit: number;
  data: RedeemRequest[];
}

const stripEmpty = (query: AdminRedeemListQuery) =>
  Object.fromEntries(
    Object.entries(query).filter(
      ([, v]) => v !== undefined && v !== null && v !== "",
    ),
  );


/**
 * A provider currently refusing payouts because its payout wallet is empty.
 *
 * Neither Breeze nor Coinflow exposes a balance endpoint, so this is not a
 * reading of either wallet — it is the record of a release the provider
 * actually refused. It clears by itself as soon as one payout succeeds.
 */
export type PayoutFundingAlert = {
  id: string;
  provider: "BREEZE" | "COINFLOW";
  openedAt: string;
  lastFailureAt: string;
  failureCount: number;
  reason: string | null;
  firstUserId: string | null;
  firstUserEmail: string | null;
  firstUsername: string | null;
  firstAmount: number | null;
  firstRedeemRequestId: string | null;
  firstPayoutPageId: string | null;
};

export const redeemApi = {
  // Redeem requests
  getAllRequests: (status?: RedeemStatus) =>
    api.get<RedeemRequest[]>("/redeem/all", { params: status ? { status } : {} }),
  /**
   * One page of redeem requests, filtered server-side.
   *
   * Prefer this over `getAllRequests` on any screen that renders a table:
   * `all` hydrates every request with its payout pages and its user, which is
   * unbounded and times out once the table grows.
   */
  list: (query: AdminRedeemListQuery = {}) =>
    api.get<AdminRedeemListResponse>("/redeem/list", {
      params: stripEmpty(query),
    }),
  /** Providers blocked from paying out right now. Usually an empty array. */
  getPayoutFundingStatus: () =>
    // Path is relative to the shared axios baseURL, which already ends in
  // /api/v1/admin — so no "admin" segment here. Same as every call above.
  api.get<PayoutFundingAlert[]>("/redeem/payout-funding-status"),
  getRequestsByUserId: (userId: string) =>
    api.get<RedeemRequest[]>(`/redeem/by-user/${userId}`),
  updateStatus: (id: string, dto: UpdateRedeemStatusDto) =>
    api.patch<RedeemRequest>(`/redeem/${id}/status`, dto),

  // Spin config
  getSpinConfig: () => api.get<SpinConfig>("/redeem/spin-config"),
  updateSpinConfig: (dto: UpdateSpinConfigDto) =>
    api.patch<SpinConfig>("/redeem/spin-config", dto),

  // W-9 admin review
  getW9Submissions: () => api.get<AdminW9Submission[]>("/redeem/w9-submissions"),
  updateW9SubmissionStatus: (
    submissionId: string,
    status: "VERIFIED" | "REJECTED",
    reason?: string,
  ) => api.patch(`/redeem/w9-submissions/${submissionId}`, { status, reason }),
  uploadW10ForSubmission: (submissionId: string, payload: UploadW10Payload) =>
    api.patch(`/redeem/w9-submissions/${submissionId}/w10`, payload),
};

