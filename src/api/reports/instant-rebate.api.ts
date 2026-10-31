import api from "../config/axios.config";

export interface InstantRebateLogRow {
  upline: string;
  username: string;
  transactionDate: string;
  game: string;
  betAmount: string;
  sports: string;
  esports: string;
  casino: string;
  slots: string;
  amount: string;
}

export interface InstantRebateLogsResponse {
  items: InstantRebateLogRow[];
  totalSlotsAmount: string;
  totalAmount: string;
}

export interface RewardLogRow {
  source: string;
  description: string;
  upline: string;
  username: string;
  transactionDate: string;
  amount: string;
  referenceId: string | null;
  currency: "wulfCash" | "wulfCoin" | "bonusWulfCash" | "redeemableWulfCash" | null;
  coinAmount: string;
  cashAmount: string;
  bonusCashAmount: string;
}

export interface RewardLogsResponse {
  items: RewardLogRow[];
  totalAmount: string;
  totalCoinAmount: string;
  totalCashAmount: string;
  totalBonusCashAmount: string;
}

export const getInstantRebateLogs = async (params?: {
  userType?: "USER" | "AGENT";
  startDate?: string;
  endDate?: string;
}) => {
  const res = await api.get<InstantRebateLogsResponse>(
    "/cashback/instant-rebate-logs",
    { params }
  );
  return res.data;
};

export const getRewardLogs = async (params?: {
  userType?: "USER" | "AGENT";
  startDate?: string;
  endDate?: string;
}) => {
  const res = await api.get<RewardLogsResponse>("/cashback/reward-logs", {
    params,
  });
  return res.data;
};
