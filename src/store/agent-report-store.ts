import { create } from "zustand";
import { utcDayEndISO, utcDayStartISO } from "@/lib/utils";
import { devtools } from "zustand/middleware";
import { profileApi } from "@/api/users/users";
import { referralAdminApi } from "@/services/referral-admin.service";
import { UserWithProfile } from "@/types/profile.type";

export interface AgentReportRow {
  agentName: string;
  subAgents: number;
  players: number;
  totalBet: number;
  totalWin: number;
  ggr: number;
  revShareStr: string;
  commission: number;
  agentId: string;
}

/**
 * API row → table row. The only shaping left on the client is the "%" suffix;
 * every figure arrives already aggregated over the agent's whole downline.
 */
const mapAgentReportRow = (row: {
  agentId: string;
  agentName: string;
  subAgents: number;
  players: number;
  totalBet: number;
  totalWin: number;
  ggr: number;
  revSharePercent: number;
  commission: number;
}): AgentReportRow => ({
  agentId: row.agentId,
  agentName: row.agentName,
  subAgents: row.subAgents ?? 0,
  players: row.players ?? 0,
  totalBet: row.totalBet ?? 0,
  totalWin: row.totalWin ?? 0,
  ggr: row.ggr ?? 0,
  revShareStr: `${Number(row.revSharePercent ?? 0).toFixed(2)}%`,
  commission: row.commission ?? 0,
});

interface AgentReportFilters {
  status: string;
  provider: string;
  category: string;
  startDate?: Date;
  endDate?: Date;
}

export interface AgentReportSummary {
  totalAgents: number;
  totalBet: number;
  revSharePaid: number;
  pendingPayout: number;
}

interface AgentReportState {
  agentData: AgentReportRow[];
  /** Card totals for the current search/status filter; null when unfiltered. */
  summary: AgentReportSummary | null;
  globalStats: any;
  totalAgents: number;
  totalPlayers: number;
  totalSubAgents: number;
  loading: boolean;
  statsLoading: boolean;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  searchQuery: string;
  filterOpen: boolean;
  filters: AgentReportFilters;
  error: string | null;
}

interface AgentReportActions {
  fetchGlobalStats: () => Promise<void>;
  fetchTotalAgents: () => Promise<void>;
  fetchTotalPlayers: () => Promise<void>;
  fetchAllAgentsStats: () => Promise<void>;
  fetchAllAgentsForExport: (params?: {
    startDate?: string;
    endDate?: string;
  }) => Promise<AgentReportRow[]>;
  fetchAgents: (params?: {
    page?: number;
    search?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }) => Promise<void>;
  setPage: (page: number) => void;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: Partial<AgentReportFilters>) => void;
  setFilterOpen: (open: boolean) => void;
  reset: () => void;
  clearError: () => void;
}

type AgentReportStore = AgentReportState & AgentReportActions;

const initialState: AgentReportState = {
  agentData: [],
  summary: null,
  globalStats: null,
  totalAgents: 0,
  loading: false,
  statsLoading: false,
  currentPage: 1,
  totalPages: 1,
  totalItems: 0,
  searchQuery: "",
  filterOpen: false,
  filters: {
    status: "all",
    provider: "all",
    category: "all",
    startDate: undefined,
    endDate: undefined,
  },
  error: null,
  totalPlayers: 0,
  totalSubAgents: 0
};

export const useAgentReportStore = create<AgentReportStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

    fetchGlobalStats: async () => {
      try {
        const stats = await referralAdminApi.getStats("");
        set({ globalStats: stats });
      } catch (err) {
        console.error("Global stats fetch failed", err);
      }
    },

    fetchAgents: async (params) => {
      const { currentPage, searchQuery, filters } = get();
      const page = params?.page ?? currentPage;
      const search = params?.search ?? searchQuery;
      // Pull the status / date filters from the passed params first, else the
      // persisted filter state, and forward them to the API so the agent list
      // is actually filtered server-side (not just in the UI).
      const status = params?.status ?? filters.status;
      const startDate = params?.startDate ?? filters.startDate;
      const endDate = params?.endDate ?? filters.endDate;

      set({ loading: true, statsLoading: true, agentData: [], error: null });

      try {
        // ONE request for the whole page. This used to fetch the agent list and
        // then call agent-stats + earnings for every agent on it (2N requests),
        // summing per-referee rows in the browser — which is how Total Bet,
        // GGR, Commission and Rev Share % all ended up reading 0.00 while the
        // ledger held real numbers.
        const response = await referralAdminApi.getAgentReport({
          page,
          limit: 10,
          search: search || undefined,
          status:
            status === "active" || status === "inactive" ? status : undefined,
          // Whole UTC days: the endpoint compares these instants directly,
          // so a local-midnight value filtered a different day than the other
          // reports did for the same picked date.
          startDate: utcDayStartISO(startDate),
          endDate: utcDayEndISO(endDate),
        });

        const meta = response.meta;

        set({
          agentData: (response.data || []).map(mapAgentReportRow),
          summary: response.summary ?? null,
          currentPage: meta?.page ?? page,
          totalPages: meta?.totalPages ?? 1,
          totalItems: meta?.totalItems ?? response.data?.length ?? 0,
          loading: false,
          statsLoading: false,
        });
      } catch (err: any) {
        set({
          loading: false,
          statsLoading: false,
          error: err?.response?.data?.message || err?.message || "Failed to fetch agent report",
        });
      }
    },

      fetchTotalAgents: async () => {
        try {
          const response = await profileApi.getAllAgents({ page: 1, limit: 1 });
          const meta = response.data.meta;
          set({ totalAgents: meta.totalItems ?? meta.total ?? 0 });
        } catch (err) {
          console.error("Total agents fetch failed", err);
        }
      },

      fetchTotalPlayers: async () => {
        try {
          const response = await profileApi.getAllUsers({ page: 1, limit: 1 });
          const meta = response.data.meta;
          set({ totalPlayers: meta.totalItems ?? meta.total ?? 0 });
        } catch (err) {
          console.error("Total players fetch failed", err);
        }
      },

      fetchAllAgentsStats: async () => {
        try {
          // Fetch all agents with a large limit to get total players
          const response = await profileApi.getAllAgents({ page: 1, limit: 1000 });
          const agents = response.data.data;
          
          let totalPlayersCount = 0;
          let totalSubAgentsCount = 0;

          // Fetch stats for each agent to get total players
          const statsPromises = agents.map(async (agent: UserWithProfile) => {
            try {
              const res = await profileApi.getAgentReferralStatsById(agent.id);
              const stats = res.data;
              return {
                players: stats?.totalReferrals || 0,
                subAgents: stats?.subAgentsCount || 0,
              };
            } catch {
              return { players: 0, subAgents: 0 };
            }
          });

          const allStats = await Promise.all(statsPromises);
          totalPlayersCount = allStats.reduce((sum: number, s: any) => sum + s.players, 0);
          totalSubAgentsCount = allStats.reduce((sum: number, s: any) => sum + s.subAgents, 0);

          set({ 
            totalPlayers: totalPlayersCount,
            totalSubAgents: totalSubAgentsCount,
          });
        } catch (err) {
          console.error("Fetch all agents stats failed", err);
        }
      },

      fetchAllAgentsForExport: async (params) => {
        try {
          const { totalAgents, searchQuery, filters } = get();
          // One request for every agent, same aggregate the table shows, so an
          // export can never disagree with the screen it was taken from.
          const response = await referralAdminApi.getAgentReport({
            page: 1,
            limit: Math.min(100, totalAgents || 100),
            search: searchQuery || undefined,
            status:
              filters.status === "active" || filters.status === "inactive"
                ? filters.status
                : undefined,
            startDate: params?.startDate,
            endDate: params?.endDate,
          });
          return (response.data || []).map(mapAgentReportRow);
        } catch {
          return [];
        }
      },

      setPage: (page) => {
        set({ currentPage: page });
        get().fetchAgents({ page });
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query });
        get().fetchAgents({ search: query, page: 1 });
      },

      setFilters: (filters) => {
        const nextFilters = {
          ...get().filters,
          ...filters,
          status: (
            filters?.status ??
            get().filters.status ??
            "all"
          ).toLowerCase(),
        };

        set({ filters: nextFilters });
        get().fetchAgents({
          page: 1,
          status: nextFilters.status,
          startDate: nextFilters.startDate,
          endDate: nextFilters.endDate,
        });
      },

      setFilterOpen: (open) => set({ filterOpen: open }),

      reset: () => set(initialState),

      clearError: () => set({ error: null }),
    }),
    { name: "AgentReportStore" },
  ),
);
