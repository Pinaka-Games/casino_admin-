import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { profileApi } from "@/api/users/users";
import { UserWithProfile, GetUsersParams, UpdateProfileDto } from "@/types/profile.type";

interface AgentFilterState {
  status: string;
  provider: string;
  category: string;
  startDate?: Date;
  endDate?: Date;
}

interface AgentState {
  agents: UserWithProfile[];
  total: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  filters: AgentFilterState;
}

interface AgentActions {
  fetchAgents: (params?: Partial<GetUsersParams>) => Promise<void>;
  updateAgent: (userId: string, data: UpdateProfileDto) => Promise<void>;
  setPage: (page: number) => void;
  setSearch: (query: string) => void;
  setFilters: (filters: Partial<AgentFilterState>) => void;
  clearError: () => void;
  reset: () => void;
}

type AgentStore = AgentState & AgentActions;

const initialFilters: AgentFilterState = {
  status: "all",
  provider: "all",
  category: "all",
};

// Latest-request-wins bookkeeping. fetchAgents used to bail out while a request
// was in flight, so fast typing dropped every keystroke after the first: typing
// "JADEN" only ever searched "J", and clearing the box dropped the empty search,
// leaving the old results stuck on screen. Now each fetch aborts the previous
// one and only the newest response may write to the store.
let fetchSeq = 0;
let fetchController: AbortController | null = null;
let searchDebounce: ReturnType<typeof setTimeout> | null = null;
const SEARCH_DEBOUNCE_MS = 300;

const initialState: AgentState = {
  agents: [],
  total: 0,
  totalPages: 0,
  currentPage: 1,
  pageSize: 10,
  isLoading: false,
  error: null,
  searchQuery: "",
  filters: initialFilters,
};

export const useAgentStore = create<AgentStore>()(
  devtools((set, get) => ({
    ...initialState,

    fetchAgents: async (params?: Partial<GetUsersParams>) => {
      const state = get();

      fetchController?.abort();
      const controller = new AbortController();
      fetchController = controller;
      const seq = ++fetchSeq;

      set({ isLoading: true, error: null });

      try {
        const apiParams: GetUsersParams = {
          page: params?.page ?? state.currentPage,
          limit: params?.limit ?? state.pageSize,
          search: params?.search ?? state.searchQuery,
          isActive: params?.isActive !== undefined ? params.isActive : (state.filters.status === "active" ? true : state.filters.status === "inactive" ? false : undefined),
          ...(state.filters.startDate ? { startDate: state.filters.startDate.toISOString() } : {}),
          ...(state.filters.endDate ? { endDate: state.filters.endDate.toISOString() } : {}),
          ...(params?.sortField ? { sortField: params.sortField } : {}),
          ...(params?.sortOrder ? { sortOrder: params.sortOrder } : {}),
        };

        const response = await profileApi.getAllAgents(apiParams, controller.signal);
        if (seq !== fetchSeq) return; // superseded by a newer fetch
        const agents = response.data?.data || [];

        set({
          agents,
          total: response.data?.meta?.totalItems || 0,
          totalPages: response.data?.meta?.totalPages || 0,
          currentPage: response.data?.meta?.page || apiParams.page,
          isLoading: false,
          error: null,
        });
      } catch (err: any) {
        // Aborted/superseded requests are not failures — the newer fetch owns
        // the loading state and the rows.
        if (seq !== fetchSeq) return;
        set({
          isLoading: false,
          error: err?.response?.data?.message || err?.message || "Failed to fetch agents",
          agents: [],
        });
      }
    },

    updateAgent: async (userId: string, data: UpdateProfileDto) => {
      try {
        await profileApi.updateUserProfile(userId, data);
        
        set((state) => {
          const userIndex = state.agents.findIndex((u) => u.id === userId);
          if (userIndex !== -1) {
            const agentsArray = [...state.agents];
            const existingAgent = agentsArray[userIndex].agent || {};
            
            agentsArray[userIndex] = {
              ...agentsArray[userIndex],
              isActive: data.isActive ?? agentsArray[userIndex].isActive,
              isReferralActive: data.isReferralActive ?? agentsArray[userIndex].isReferralActive,
              isVerified: data.isVerified ?? agentsArray[userIndex].isVerified,
              agent: {
                  ...existingAgent,
                  isBlocked: data.isBlocked ?? existingAgent.isBlocked,
                  isFrozen: data.isFrozen ?? existingAgent.isFrozen,
                  allowNegativeWallet: data.allowNegativeWallet ?? existingAgent.allowNegativeWallet,
                  negativeWalletLimit: data.negativeWalletLimit ?? existingAgent.negativeWalletLimit,
              },
              profile: {
                  ...agentsArray[userIndex].profile,
                  ...data,
              },
            };
            return { agents: agentsArray };
          }
          return state;
        });
      } catch (error: any) {
        set({ error: error?.response?.data?.message || "Failed to update agent" });
        throw error;
      }
    },

    setPage: (page: number) => {
      set({ currentPage: page });
      get().fetchAgents({ page });
    },

    setSearch: (query: string) => {
      // Input updates immediately; the request waits for typing to pause.
      set({ searchQuery: query, currentPage: 1 });
      if (searchDebounce) clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        searchDebounce = null;
        // Read the store at fire time so the newest text is what gets searched.
        get().fetchAgents({ search: get().searchQuery, page: 1 });
      }, SEARCH_DEBOUNCE_MS);
    },

    setFilters: (filters: Partial<AgentFilterState>) => {
      const nextFilters = { ...get().filters, ...filters };
      set({ filters: nextFilters, currentPage: 1 });
      
      let isActive;
      if (nextFilters.status === "active") isActive = true;
      if (nextFilters.status === "inactive") isActive = false;
      
      get().fetchAgents({ page: 1, isActive });
    },

    clearError: () => set({ error: null }),

    reset: () => set(initialState),
  }), { name: "AgentStore" })
);
