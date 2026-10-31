import {
  CashbackType,
  CashbackProgress,
  AllCashbackProgress,
  ClaimedReward,
} from "@/types/cashback";
import api from "../config/axios.config";

export { CashbackType };
export type { CashbackProgress, AllCashbackProgress, ClaimedReward };

export const cashbackAdminApi = {
  getUserCashback: (userId: string) =>
    api.get<AllCashbackProgress>(`/cashback/user/${userId}`),
    
  getClaimHistory: (userId: string) =>
    api.get(`/cashback/claim-history/${userId}`),
    
  getRewardsSummary: (userId: string) =>
    api.get<ClaimedReward[]>(`/cashback/user/${userId}/rewards-summary`),
};

