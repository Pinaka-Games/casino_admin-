import api from "../config/axios.config";

export interface VipTier {
  id: string;
  name: string;
  level: number;
  xp_required: number;
  badge: string;
  isActive: boolean;
}

export interface UserVipProgress {
  xp: number;
  currentTier: VipTier | null;
  /** null once the player has reached the top tier. */
  nextTier: VipTier | null;
  /** 0–100, how far through the CURRENT rank the player is. */
  progress: number;
  /** XP earned inside the current rank. */
  xpIntoTier: number;
  /** XP the current rank spans (its floor → the next tier's floor). */
  xpForTier: number;
  /** XP still needed to reach `nextTier`; 0 once maxed out. */
  xpToNextTier: number;
  tiers: VipTier[];
}

export const vipAdminApi = {
  getUserVipProgress: (userId: string) =>
    api.get<UserVipProgress>(`/vip/user/${userId}/progress`),
    
  getTiers: () =>
    api.get<VipTier[]>(`/vip/tiers`),
};
