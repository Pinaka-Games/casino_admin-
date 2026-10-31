import api from "@/api/config/axios.config";

export type AdminBreezePayoutPageStatus =
  | "CREATED"
  | "PENDING"
  | "PROCESSING"
  | "PROCESSED"
  | "COMPLETED"
  | "REFUNDED"
  | "FAILED"
  | "CANCELED"
  | "UNKNOWN";

export type AdminBreezePayoutReleaseMethod = "MANUAL" | "AUTOMATIC";

export type AdminPreferredPayoutMethod =
  | "BANK_ACCOUNT"
  | "CARD"
  | "CRYPTO_WALLET";

export interface AdminBreezePayoutSummary {
  id: string;
  breezePageId: string | null;
  status: AdminBreezePayoutPageStatus;
  pendingStatus: string | null;
  releaseMethod: AdminBreezePayoutReleaseMethod;
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

export interface AdminBreezePayoutPageRecord {
  id: string;
  redeemRequestId: string | null;
  clientReferenceId: string;
  breezePageId?: string | null;
  status: AdminBreezePayoutPageStatus;
  pendingStatus?: string | null;
  amountMinor: number;
  fundingCurrency: string;
  releaseMethod: AdminBreezePayoutReleaseMethod;
  livemode: boolean;
  url?: string | null;
  successReturnUrl?: string | null;
  failureReturnUrl?: string | null;
  preferredPayoutMethods?: AdminPreferredPayoutMethod[];
  payoutMethod?: string | null;
  customerConfirmedAtMs?: number | null;
  provider?: Record<string, unknown>;
}

export interface CreateAdminRedeemBreezePayoutPayload {
  redeemRequestId: string;
  fundingCurrency?: string;
  customerEmail?: string;
  customerReferenceId?: string;
  successReturnUrl?: string;
  failureReturnUrl?: string;
  preferredPayoutMethods?: AdminPreferredPayoutMethod[];
  livemode?: boolean;
}

export const adminBreezePayoutApi = {
  createOrResumeRedeemPage: async (
    payload: CreateAdminRedeemBreezePayoutPayload,
  ): Promise<AdminBreezePayoutPageRecord> => {
    const response = await api.post<AdminBreezePayoutPageRecord>(
      "/breeze-payment/payout/redeem-pages",
      payload,
    );
    return response.data;
  },

  getRedeemPage: async (
    redeemRequestId: string,
    sync = false,
  ): Promise<AdminBreezePayoutPageRecord> => {
    const response = await api.get<AdminBreezePayoutPageRecord>(
      `/breeze-payment/payout/redeem-pages/${redeemRequestId}`,
      { params: { sync } },
    );
    return response.data;
  },

  refreshPage: async (
    pageId: string,
  ): Promise<AdminBreezePayoutPageRecord> => {
    const response = await api.post<AdminBreezePayoutPageRecord>(
      `/breeze-payment/payout/pages/${pageId}/refresh`,
    );
    return response.data;
  },

  releasePage: async (
    pageId: string,
  ): Promise<AdminBreezePayoutPageRecord> => {
    const response = await api.post<AdminBreezePayoutPageRecord>(
      `/breeze-payment/payout/pages/${pageId}/release`,
    );
    return response.data;
  },
};
