import api from "@/api/config/axios.config";

export type AdminCoinflowPayoutPageStatus =
  | "CREATED"
  | "PENDING"
  | "PROCESSING"
  | "PROCESSED"
  | "COMPLETED"
  | "REFUNDED"
  | "FAILED"
  | "CANCELED"
  | "UNKNOWN";

export type AdminCoinflowPayoutReleaseMethod = "MANUAL" | "AUTOMATIC";

export type AdminCoinflowPreferredPayoutMethod =
  | "BANK_ACCOUNT"
  | "CARD"
  | "CRYPTO_WALLET";

export interface AdminCoinflowPayoutSummary {
  id: string;
  coinflowSessionId: string | null;
  status: AdminCoinflowPayoutPageStatus;
  pendingStatus: string | null;
  releaseMethod: AdminCoinflowPayoutReleaseMethod;
  url: string | null;
  payoutMethod: string | null;
  bankAccountLast4: string | null;
  cardLast4: string | null;
  walletAddress: string | null;
  customerConfirmedAtMs: number | null;
  releasedAt: string | null;
  processedAt: string | null;
  livemode: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCoinflowPayoutPageRecord {
  id: string;
  redeemRequestId: string | null;
  clientReferenceId: string;
  coinflowSessionId?: string | null;
  status: AdminCoinflowPayoutPageStatus;
  pendingStatus?: string | null;
  amountMinor: number;
  fundingCurrency: string;
  releaseMethod: AdminCoinflowPayoutReleaseMethod;
  livemode: boolean;
  hostedUrl?: string | null;
  url?: string | null;
  successReturnUrl?: string | null;
  failureReturnUrl?: string | null;
  preferredPayoutMethods?: AdminCoinflowPreferredPayoutMethod[];
  payoutMethod?: string | null;
  customerConfirmedAtMs?: number | null;
  providerResponse?: Record<string, unknown>;
}

export interface CreateAdminRedeemCoinflowPayoutPayload {
  redeemRequestId: string;
  fundingCurrency?: string;
  customerEmail?: string;
  customerReferenceId?: string;
  successReturnUrl?: string;
  failureReturnUrl?: string;
  preferredPayoutMethods?: AdminCoinflowPreferredPayoutMethod[];
  livemode?: boolean;
}

export const adminCoinflowPayoutApi = {
  createOrResumeRedeemPage: async (
    payload: CreateAdminRedeemCoinflowPayoutPayload,
  ): Promise<AdminCoinflowPayoutPageRecord> => {
    const response = await api.post<AdminCoinflowPayoutPageRecord>(
      "/coinflow-payment/payout/redeem-pages",
      payload,
    );
    return response.data;
  },

  getRedeemPage: async (
    redeemRequestId: string,
    sync = false,
  ): Promise<AdminCoinflowPayoutPageRecord> => {
    const response = await api.get<AdminCoinflowPayoutPageRecord>(
      `/coinflow-payment/payout/redeem-pages/${redeemRequestId}`,
      { params: { sync } },
    );
    return response.data;
  },

  refreshPage: async (
    pageId: string,
  ): Promise<AdminCoinflowPayoutPageRecord> => {
    const response = await api.post<AdminCoinflowPayoutPageRecord>(
      `/coinflow-payment/payout/pages/${pageId}/refresh`,
    );
    return response.data;
  },

  releasePage: async (
    pageId: string,
  ): Promise<AdminCoinflowPayoutPageRecord> => {
    const response = await api.post<AdminCoinflowPayoutPageRecord>(
      `/coinflow-payment/payout/pages/${pageId}/release`,
    );
    return response.data;
  },
};
