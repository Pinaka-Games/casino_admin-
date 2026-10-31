import api from "@/api/config/axios.config";




export interface ReferralConfig {
    casinoOriginal: number;
    casinoThirdParty: number;
    sports: number;
    minClaimAmount?: number;
    claimCooldownDays?: number;
    claimCooldownSec?: number;
    signupXpReward?: number;
    affiliateReleaseDurationSec?: number;
    payoutLockDays?: number;
    payoutLockSec?: number;
    payoutLockEnabled?: boolean;
    referralPayoutAutoThreshold?: number;
    perUserIncomeCap?: number;
}

export const referralAdminApi = {
    async getConfig(token: string): Promise<ReferralConfig> {
        try {
            const response = await api.get<ReferralConfig>("/referral/config");
            return response.data;
        } catch (error) {
            console.error('Error fetching referral config:', error);
            throw error;
        }
    },

    async updateConfig(config: Partial<ReferralConfig>, token: string): Promise<ReferralConfig> {
        try {
            const response = await api.put<ReferralConfig>("/referral/config", config);
            return response.data;
        } catch (error) {
            console.error('Error updating referral config:', error);
            throw error;
        }
    },

    async getStats(token: string): Promise<any> {
        try {
            const response = await api.get("/referral/stats");
            return response.data;
        } catch (error) {
            console.error('Error fetching referral stats:', error);
            throw error;
        }
    },

    /**
     * One page of the Agent Report table, already aggregated by the API.
     *
     * Replaces the two calls per agent the report used to make (agent-stats +
     * earnings, summed in the browser). The server totals the same commission
     * ledger over the whole downline, so the columns cannot silently read 0.
     */
    async getAgentReport(params: {
        page?: number;
        limit?: number;
        search?: string;
        status?: string;
        startDate?: string;
        endDate?: string;
    }): Promise<{
        data: Array<{
            agentId: string;
            employeeId: string;
            agentName: string;
            email: string;
            subAgents: number;
            players: number;
            totalBet: number;
            totalWin: number;
            ggr: number;
            revSharePercent: number;
            commission: number;
            isActive: boolean;
        }>;
        meta: { page: number; limit: number; totalItems: number; totalPages: number };
        // Card totals over every agent matching search/status (all pages).
        // null when unfiltered — the page then shows the network-wide stats.
        summary?: {
            totalAgents: number;
            totalBet: number;
            revSharePaid: number;
            pendingPayout: number;
        } | null;
    }> {
        const response = await api.get("/referral/agent-report", { params });
        return response.data;
    },

    async getUserStats(userId: string, token: string): Promise<any> {
        try {
            const response = await api.get(`/referral/user-stats/${userId}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching user referral stats:', error);
            return {
                totalEarnings: 0,
                pendingPayouts: 0,
                totalClaimed: 0,
                settledAmount: 0,
                totalReferralConnections: 0
            };
        }
    },

    async getClaims(token: string, page: number = 1, limit: number = 20): Promise<any> {
        try {
            const response = await api.get(`/referral/claims?page=${page}&limit=${limit}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching referral claims:', error);
            throw error;
        }
    },
};
