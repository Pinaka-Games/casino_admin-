import {
  CreateProfileDto,
  UpdateProfileDto,
  UserWithProfile,
  Profile,
  PaginatedUsersResponse,
  GetUsersParams,
  ReferralStats,
  EarningRecord,
  ClaimRecord,
} from "@/types/profile.type";
import api from "../config/axios.config";
import { ReferralConfig } from "@/services/referral-admin.service";

export const profileApi = {
  // User Registration
  register: (data: CreateProfileDto) =>
    api.post<UserWithProfile>("/profile/register", data),

  // Get Current User Profile
  getMyProfile: () => api.get<UserWithProfile>("/profile/me"),

  // Get User Profile by ID
  getUserProfile: (userId: string) =>
    api.get<UserWithProfile>(`/profile/user/${userId}`),

  // Get Profile Details by User ID
  getProfileDetails: (userId: string) =>
    api.get<Profile>(`/profile/details/${userId}`),

  // Update Current User Profile
  updateMyProfile: (data: UpdateProfileDto) =>
    api.put<UserWithProfile>("/profile/me", data),

  // Update User Profile (Admin)
  updateUserProfile: (userId: string, data: UpdateProfileDto) =>
    api.put<UserWithProfile>(`/profile/${userId}`, data),

  // Delete User and Profile (Admin)
  deleteUserProfile: (userId: string) =>
    api.delete<{ message: string }>(`/profile/${userId}`),

  // Delete Sub-Agent (Parent Agent)
  deleteSubAgent: (id: string) =>
    api.delete<{ success: boolean; message: string }>(
      `/referral/sub-agent/${id}`,
    ),

  // Get Referral Statistics (agent-specific, uses employee JWT)
  getReferralStats: (params?: { startDate?: string; endDate?: string }) =>
    api.get<ReferralStats>("/referral/agent-stats", { params }),

  getReferralConfig: () => api.get<ReferralConfig>("/referral/config"),

  // Get Detailed Earning History (agent-specific, uses employee JWT)
  getEarningHistory: (period?: string) =>
    api.get<EarningRecord[]>("/referral/earnings", { params: { period } }),

  // Get Claim History (agent-specific, uses employee JWT)
  getClaimHistory: () => api.get<ClaimRecord[]>("/referral/history"),

  // Get Agent Claim History By ID (Admin)
  getAgentClaimHistoryById: (agentId: string) =>
    api.get<ClaimRecord[]>(`/referral/history/${agentId}`),

  // Get Agent Earning History By ID (Admin)
  getAgentEarningHistoryById: (agentId: string) =>
    api.get<EarningRecord[]>(`/referral/earnings/${agentId}`),

  // Get Agent Referred Users (Admin)
  getAgentReferredUsers: (agentId: string) =>
    api.get(`/users/agents/${agentId}/referred-users`),

  // Get Agent Referral Stats By ID (Admin)
  getAgentReferralStatsById: (agentId: string) =>
    api.get<ReferralStats>(`/referral/agent-stats/${agentId}`),

  // Claim Commissions (agent-specific, uses employee JWT)
  claimCommissions: () =>
    api.post<{
      success: boolean;
      claimedAmount?: number;
      amount?: number;
      isPendingApproval?: boolean;
      requestedAmount?: number;
      message?: string;
    }>("/referral/claim"),

  // Get Payout Requests from Sub-Agents (Parent Agent)
  getSubRequests: () => api.get<any[]>("/referral/sub-requests"),

  // Get Payout History from Sub-Agents (Parent Agent)
  getSubHistory: () => api.get<any[]>("/referral/sub-history"),

  // Approve a sub-agent payout (Parent Agent)
  approvePayout: (claimId: string) =>
    api.post<{ success: boolean; message: string }>(
      "/referral/approve-payout",
      { claimId },
    ),

  // Reject a sub-agent payout (Parent Agent)
  rejectPayout: (claimId: string) =>
    api.post<{ success: boolean; message: string }>("/referral/reject-payout", {
      claimId,
    }),

  // Get Weekly Settlement History (agent-specific)
  getSettlements: (agentId?: string) =>
    api.get<any[]>("/referral/settlements", {
      params: agentId ? { agentId } : {},
    }),

  // Sub-Agent Management (Parent Agent)
  getSubAgents: () => api.get<any[]>("/referral/sub-agents"),
  getSubAgent: (id: string) => api.get<any>(`/referral/sub-agent/${id}`),
  createSubAgent: (data: any) =>
    api.post<{ success: boolean; message: string }>(
      "/referral/sub-agent",
      data,
    ),
  updateSubAgent: (id: string, data: any) =>
    api.patch<{ success: boolean; message: string }>(
      `/referral/sub-agent/${id}`,
      data,
    ),

  // GLOBAL Payout Management (Admin)
  getAllClaims: (page: number = 1, limit: number = 20) =>
    api.get<any>("/referral/claims", { params: { page, limit } }),

  adminApprovePayout: (claimId: string) =>
    api.post<{ success: boolean; message: string }>(
      "/referral/admin-approve-payout",
      { claimId },
    ),

  adminRejectPayout: (claimId: string, reason: string) =>
    api.post<{ success: boolean; message: string }>(
      "/referral/admin-reject-payout",
      { claimId, reason },
    ),

  adminCompletePayout: (claimId: string) =>
    api.post<{ success: boolean; message: string }>(
      "/referral/admin-complete-payout",
      { claimId },
    ),

  adminClaimAgentCommissions: (agentId: string) =>
    api.post<{
      success: boolean;
      message: string;
      claimId?: string;
      amount?: number;
    }>(`/referral/admin-claim/${agentId}`),

  // Get Agent-Specific Commissions (Admin)
  getAgentCommissions: (agentId: string) =>
    api.get<any>(`/referral/agent-commissions/${agentId}`),

  // Update Agent-Specific Commissions (Admin)
  updateAgentCommissions: (agentId: string, commissions: any) =>
    api.put<{ success: boolean }>(`/referral/agent-commissions/${agentId}`, {
      commissions,
    }),

  // Switch agent between CATEGORY and FLAT commission models (Admin).
  // Mode cascades to all sub-agents; flatRate required when mode = FLAT.
  setAgentCommissionMode: (
    agentId: string,
    mode: "CATEGORY" | "FLAT",
    flatRate?: number,
  ) =>
    api.put<{ success: boolean; commissionMode: string; clampedSubAgents: number }>(
      `/referral/agent-commission-mode/${agentId}`,
      { mode, flatRate },
    ),

  // Get User-Specific Commissions (Admin)
  getUserCommissions: (userId: string) =>
    api.get<any>(`/referral/user-commissions/${userId}`),

  // Update User-Specific Commissions (Admin)
  updateUserCommissions: (userId: string, commissions: any) =>
    api.put<{ success: boolean }>(`/referral/user-commissions/${userId}`, {
      commissions,
    }),

  // Get All Users with Profiles (Admin - Paginated)
  getAllUsers: (params?: GetUsersParams, signal?: AbortSignal) => {
    // Build clean params object, excluding undefined/empty values
    const cleanParams: any = {
      page: params?.page || 1,
      limit: params?.limit || 10,
    };

    // Only add search if it has a value
    if (params?.search && params.search.trim() !== "") {
      cleanParams.search = params.search.trim();
    }

    // Add other filters if provided
    if (params?.isActive !== undefined) {
      cleanParams.isActive = params.isActive;
    }
    if (params?.isVerified !== undefined) {
      cleanParams.isVerified = params.isVerified;
    }
    if (params?.isPremium !== undefined) {
      cleanParams.isPremium = params.isPremium;
    }
    if (params?.isBanned !== undefined) {
      cleanParams.isBanned = params.isBanned;
    }
    if (params?.referrerId) {
      cleanParams.referrerId = params.referrerId;
    }
    if (params?.source && params.source !== "all") {
      cleanParams.source = params.source;
    }
    if (params?.kyc && params.kyc !== "all") {
      cleanParams.kyc = params.kyc;
    }
    if (params?.vipTierId) {
      cleanParams.vipTierId = params.vipTierId;
    }
    if (params?.startDate) {
      cleanParams.startDate = params.startDate;
    }
    if (params?.endDate) {
      cleanParams.endDate = params.endDate;
    }
    if (params?.provider) {
      cleanParams.provider = params.provider;
    }
    if (params?.category) {
      cleanParams.category = params.category;
    }
    if (params?.freeSpinEligible !== undefined) {
      cleanParams.freeSpinEligible = params.freeSpinEligible;
    }
    // Column sorting for the player listing — applied server-side so it orders
    // the whole result set rather than the page already fetched.
    if (params?.sortField) cleanParams.sortField = params.sortField;
    if (params?.sortOrder) cleanParams.sortOrder = params.sortOrder;

    return api.get<PaginatedUsersResponse>("/users/all", {
      params: cleanParams,
      signal,
    });
  },

  // Get All Staff Agents (Admin - Paginated)
  getAllAgents: (params?: GetUsersParams, signal?: AbortSignal) => {
    const cleanParams: any = {
      page: params?.page || 1,
      limit: params?.limit || 10,
    };

    if (params?.search && params.search.trim() !== "") {
      cleanParams.search = params.search.trim();
    }

    // Add other filters
    if (params?.isActive !== undefined) cleanParams.isActive = params.isActive;
    if (params?.startDate) cleanParams.startDate = params.startDate;
    if (params?.endDate) cleanParams.endDate = params.endDate;
    if (params?.provider) cleanParams.provider = params.provider;
    if (params?.category) cleanParams.category = params.category;
    if (params?.sortField) cleanParams.sortField = params.sortField;
    if (params?.sortOrder) cleanParams.sortOrder = params.sortOrder;

    return api.get<PaginatedUsersResponse>("/users/agents", {
      params: cleanParams,
      signal,
    });
  },

  // Get consolidated revenue sharing packages
  getRevenueSharingPackages: (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }) => {
    return api.get<any>("/referral/revenue-sharing-packages", {
      params,
    });
  },
};
