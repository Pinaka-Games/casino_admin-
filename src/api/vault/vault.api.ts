import api from "../config/axios.config";

export interface VaultCardStats {
  totalFixedAmountActive: number;
  totalWithdrawnFDAmount: number;
  totalInterestPaid: number;
  totalActiveDeposits: number;
  totalCompletedDeposits: number;
  totalEarlyWithdrawals: number;
}

export interface VaultSettings {
  defaultInterestRate: number;
  penaltyPercentage: number;
  allowEarlyWithdrawal: boolean;
  durationRates: Record<string, number>;
  interestWageringMultiplier: number;
}

export interface ActiveVaultDeposit {
  id: string;
  /** Links the row to the player's page. */
  userId: string;
  user: string;
  email: string | null;
  amount: number;
  duration: string;
  interestRate: number;
  earnedInterestLive: number;
  startDate: string;
  maturityDate: string | null;
  remainingDays: number;
  status: "Active";
}

export interface CompletedVaultDeposit {
  id: string;
  userId: string;
  user: string;
  email: string | null;
  amount: number;
  earnedInterest: number;
  penaltyApplied: number;
  totalPaid: number;
  withdrawalType: "On Maturity" | "Early";
  startDate: string;
  endDate: string;
  status: "Completed" | "Withdrawn";
}

export interface VaultTransaction {
  id: string;
  transactionId: string;
  userId: string;
  user: string;
  email: string | null;
  amount: number;
  earnedInterest: number;
  penaltyApplied: number;
  totalPaid: number;
  withdrawalType: "On Maturity" | "Early" | "-";
  startDate: string;
  endDate: string;
  status: "Active" | "Completed" | "Withdrawn";
}

export type VaultCurrency = "wulfCash" | "wulfCoin";

export interface VaultManagementResponse {
  cards: VaultCardStats;
  settings: VaultSettings;
  currency?: VaultCurrency;
  tabs: {
    activeDeposits: ActiveVaultDeposit[];
    completedDeposits: CompletedVaultDeposit[];
    allTransactions: VaultTransaction[];
  };
}

export interface UpdateVaultSettingsPayload {
  currency?: VaultCurrency;
  defaultInterestRate?: number;
  penaltyPercentage?: number;
  allowEarlyWithdrawal?: boolean;
  durationRates?: VaultSettings["durationRates"];
  interestWageringMultiplier?: number;
}

export const vaultApi = {
  getManagementData: (currency: VaultCurrency = "wulfCash") =>
    api.get<VaultManagementResponse>("/vault/management", { params: { currency } }),
  updateSettings: (payload: UpdateVaultSettingsPayload) =>
    api.post<VaultSettings>("/vault/settings", payload),
};
