import { TierRewards, UpdateVipStatusPayload, UpdateVipStatusResponse, VipTier } from "@/types/vip.tier.types";
import api from "../config/axios.config";

export const vipTierApi = {
    getAll: (selTier: string | null) =>
        api.get<VipTier[]>("/vip/tiers", {
            params: selTier && selTier !== "All" ? { name: selTier } : undefined,
        }),
    seedDefaults: (force = false) =>
        api.post<{
            message: string;
            created: number;
            backfilled: number;
            seededDefaultsOnExisting?: number;
            force?: boolean;
            skipped: boolean;
        }>(`/vip/seed${force ? "?force=true" : ""}`),

    updateStatus: ({ id, status }: UpdateVipStatusPayload) => {
        return api.patch<UpdateVipStatusResponse>(
            `/vip/${id}/status`,
            {
                isActive: status,
            }
        );
    },
    create: (payload: Partial<VipTier>) => {
        return api.post<VipTier>(`/vip/tiers`, payload);
    },
    update: (id: string | undefined, payload: Partial<VipTier>) => {
        return api.patch<VipTier>(`/vip/${id}`, payload);
    },
    remove: (id: string) => {
        return api.delete<{
            success: boolean;
            message: string;
            reassignedUsers: number;
            removedClaims: number;
            reassignedTo: { id: string; name: string; level: number };
        }>(`/vip/tiers/${id}`);
    },
    updateTierRewards: (id: string, tierRewards: TierRewards, benefits: VipTier['benefits']) => {
        return api.patch<VipTier>(`/vip/${id}`, { tierRewards, benefits });
    },
};
