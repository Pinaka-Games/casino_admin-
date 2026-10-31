import api from "../config/axios.config";

export interface PaginatedSubAgents<T = Record<string, unknown>> {
    data: T[];
    meta: { total: number; page: number; limit: number; totalPages: number };
    summary: {
        totalSubAgents: number;
        totalEarnings: number;
        totalPendingBalance: number;
        totalRequestedBalance: number;
        totalPlayers: number;
    };
}

export const referralApi = {
    // Get sub-agents (optionally filtered by parent agent ID)
    getSubAgents: (agentId?: string) => api.get<any[]>(`referral/sub-agents${agentId ? `?agentId=${agentId}` : ''}`),

    /**
     * Paginated variant. The API only switches to `{ data, meta, summary }` when
     * `limit` is sent, so this is a separate call from `getSubAgents` above.
     */
    getSubAgentsPaginated: <T = Record<string, unknown>>(params: {
        agentId?: string;
        page?: number;
        limit?: number;
        search?: string;
        status?: string;
        startDate?: string;
        endDate?: string;
        sortBy?: "username" | "joinedAt";
        sortDir?: "ASC" | "DESC";
    }) =>
        api.get<PaginatedSubAgents<T>>("referral/sub-agents", {
            params: Object.fromEntries(
                Object.entries(params).filter(
                    ([, value]) => value !== undefined && value !== "",
                ),
            ),
        }),

    // Get a single sub-agent by ID
    getSubAgentById: (id: string) => api.get<any>(`referral/sub-agents/${id}`),

    // Register a new sub-agent under an existing agent
    registerSubAgent: (data: any) => api.post<any>('referral/register-sub-agent', data),
    
    // Get agent referral stats
    getAgentStats: () => api.get<any>('referral/agent-stats'),

    // Get stats for a specific sub-agent (Admin/Parent Agent access)
    getAgentStatsById: (agentId: string) => api.get<any>(`referral/agent-stats/${agentId}`),
};
