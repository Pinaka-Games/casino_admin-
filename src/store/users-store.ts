import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import {
  UserWithProfile,
  CreateProfileDto,
  UpdateProfileDto,
  UserFilters,
  GetUsersParams,
} from "@/types/profile.type";

import { profileApi } from "@/api/users/users";

interface ProfileState {
  currentUser: UserWithProfile | null;
  users: UserWithProfile[];
  selectedUser: UserWithProfile | null;

  pagination: {
    totalItems: number;
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  filters: UserFilters;

  loading: {
    currentUser: boolean;
    users: boolean;
    action: boolean;
  };

  error: string | null;
}

interface ProfileActions {
  fetchCurrentUser: () => Promise<void>;
  updateCurrentUser: (data: UpdateProfileDto) => Promise<void>;
  setCurrentUser: (user: UserWithProfile | null) => void;
  logout: () => void;

  fetchUsers: (params?: GetUsersParams & { isAgent?: boolean }) => Promise<void>;
  fetchUserById: (userId: string) => Promise<void>;
  createUser: (data: CreateProfileDto) => Promise<void>;
  updateUser: (userId: string, data: UpdateProfileDto) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;

  setSelectedUser: (user: UserWithProfile | null) => void;
  setPage: (page: number) => void;
  setSearch: (search: string) => void;
  setFilters: (filters: Partial<UserFilters>) => void;
  clearError: () => void;
  reset: () => void;
}

type ProfileStore = ProfileState & ProfileActions;

const initialState: ProfileState = {
  currentUser: null,
  users: [],
  selectedUser: null,
  pagination: {
    totalItems: 0,
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
  filters: {
    search: "",
  },
  loading: {
    currentUser: false,
    users: false,
    action: false,
  },
  error: null,
};

export const useProfileStore = create<ProfileStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        fetchCurrentUser: async () => {
          set((state) => {
            state.loading.currentUser = true;
            state.error = null;
          });

          try {
            const response = await profileApi.getMyProfile();
            set((state) => {
              state.currentUser = response.data;
              state.loading.currentUser = false;
            });
          } catch (error: any) {
            set((state) => {
              state.error =
                error.response?.data?.message || "Failed to fetch current user";
              state.loading.currentUser = false;
            });
            throw error;
          }
        },

        updateCurrentUser: async (data) => {
          set((state) => {
            state.loading.action = true;
            state.error = null;
          });

          try {
            const response = await profileApi.updateMyProfile(data);
            set((state) => {
              state.currentUser = response.data;
              state.loading.action = false;
            });
          } catch (error: any) {
            set((state) => {
              state.error =
                error.response?.data?.message || "Failed to update profile";
              state.loading.action = false;
            });
            throw error;
          }
        },

        setCurrentUser: (user) => {
          set((state) => {
            state.currentUser = user;
          });
        },

        logout: () => {
          set((state) => {
            state.currentUser = null;
          });
        },

        fetchUsers: async (params) => {
          set((state) => {
            state.loading.users = true;
            state.error = null;
          });

          try {
            const state = get();

            const apiParams: any = {
              page: params?.page ?? state.pagination.page,
              limit: params?.limit ?? state.pagination.limit,
              search: params?.search ?? state.filters.search ?? "",
              isActive: params?.isActive ?? state.filters.isActive,
              startDate: params?.startDate ?? state.filters.startDate,
              endDate: params?.endDate ?? state.filters.endDate,
              provider: params?.provider ?? state.filters.provider,
              category: params?.category ?? state.filters.category,
              source: params?.source ?? state.filters.source,
              kyc: params?.kyc ?? state.filters.kyc,
              vipTierId: params?.vipTierId ?? state.filters.vipTierId,
              ...params,
            };
            delete apiParams.isAgent; // Don't send isAgent to backend as query param

            const response = params?.isAgent 
              ? await profileApi.getAllAgents(apiParams)
              : await profileApi.getAllUsers(apiParams);

            set((s) => {
              s.users = response.data.data;
              s.pagination = {
                totalItems: response.data.meta.totalItems ?? 0,
                page: response.data.meta.page ?? 1,
                limit: response.data.meta.limit ?? 10,
                total: response.data.meta.total ?? 0,
                totalPages: response.data.meta.totalPages ?? 0,
              };
              s.loading.users = false;
            });
          } catch (error: any) {
            set((state) => {
              state.error =
                error.response?.data?.message || "Failed to fetch users";
              state.loading.users = false;
            });
            throw error;
          }
        },

        fetchUserById: async (userId) => {
          set((state) => {
            state.loading.action = true;
            state.error = null;
          });

          try {
            const response = await profileApi.getUserProfile(userId);
            set((state) => {
              state.selectedUser = response.data;
              state.loading.action = false;
            });
          } catch (error: any) {
            // If /profile/user fails, try to get user from the agents list
            try {
              const agentsResponse = await profileApi.getAllAgents({ limit: 100 });
              const agent = agentsResponse.data.data.find((u: any) => u.id === userId);
              if (agent) {
                set((state) => {
                  state.selectedUser = agent;
                  state.loading.action = false;
                });
                return;
              }
            } catch (fallbackError) {
              // Fallback failed
            }
            
            set((state) => {
              state.error =
                error.response?.data?.message || "Failed to fetch user";
              state.loading.action = false;
            });
            throw error;
          }
        },

        createUser: async (data) => {
          set((state) => {
            state.loading.action = true;
            state.error = null;
          });

          try {
            await profileApi.register(data);
            await get().fetchUsers();
            set((state) => {
              state.loading.action = false;
            });
          } catch (error: any) {
            set((state) => {
              state.error =
                error.response?.data?.message || "Failed to create user";
              state.loading.action = false;
            });
            throw error;
          }
        },

        updateUser: async (userId, data) => {
          set((state) => {
            state.loading.action = true;
            state.error = null;
          });

          try {
            await profileApi.updateUserProfile(userId, data);
            set((state) => {
                // 1. Update in users array
                const userIndex = state.users.findIndex((u) => u.id === userId);
                if (userIndex !== -1) {
                    const existingAgent = state.users[userIndex].agent || {};
                    state.users[userIndex] = {
                    ...state.users[userIndex],
                    isActive: data.isActive ?? state.users[userIndex].isActive,
                    isReferralActive: data.isReferralActive ?? state.users[userIndex].isReferralActive,
                    isVerified: data.isVerified ?? state.users[userIndex].isVerified,
                    agent: {
                        ...existingAgent,
                        isBlocked: data.isBlocked ?? existingAgent.isBlocked,
                        isFrozen: data.isFrozen ?? existingAgent.isFrozen,
                        allowNegativeWallet: data.allowNegativeWallet ?? existingAgent.allowNegativeWallet,
                        negativeWalletLimit: data.negativeWalletLimit ?? existingAgent.negativeWalletLimit,
                    },
                    profile: {
                        ...state.users[userIndex].profile,
                        ...data,
                    },
                    };
                }

                // 2. Update selectedUser if it's the one being edited
                if (state.selectedUser?.id === userId) {
                    const existingAgent = state.selectedUser.agent || {};
                    state.selectedUser = {
                    ...state.selectedUser,
                    isActive: data.isActive ?? state.selectedUser.isActive,
                    isReferralActive: data.isReferralActive ?? state.selectedUser.isReferralActive,
                    isVerified: data.isVerified ?? state.selectedUser.isVerified,
                    agent: {
                        ...existingAgent,
                        isBlocked: data.isBlocked ?? existingAgent.isBlocked,
                        isFrozen: data.isFrozen ?? existingAgent.isFrozen,
                        allowNegativeWallet: data.allowNegativeWallet ?? existingAgent.allowNegativeWallet,
                        negativeWalletLimit: data.negativeWalletLimit ?? existingAgent.negativeWalletLimit,
                    },
                    profile: {
                        ...state.selectedUser.profile,
                        ...data,
                    },
                    };
                }

                state.loading.action = false;
            });
          } catch (error: any) {
            set((state) => {
              state.error =
                error.response?.data?.message || "Failed to update user";
              state.loading.action = false;
            });
            throw error;
          }
        },

        deleteUser: async (userId) => {
          set((state) => {
            state.loading.action = true;
            state.error = null;
          });

          try {
            await profileApi.deleteUserProfile(userId);
            set((state) => {
              state.users = state.users.filter((u) => u.id !== userId);
              state.selectedUser = null;
              state.pagination.total = Math.max(0, state.pagination.total - 1);
              state.pagination.totalPages = Math.ceil(
                state.pagination.total / state.pagination.limit
              );
              state.loading.action = false;
            });

            if (get().users.length === 0 && get().pagination.page > 1) {
              await get().fetchUsers({ page: get().pagination.page - 1 });
            }
          } catch (error: any) {
            set((state) => {
              state.error =
                error.response?.data?.message || "Failed to delete user";
              state.loading.action = false;
            });
            throw error;
          }
        },

        setSelectedUser: (user) => {
          set((state) => {
            state.selectedUser = user;
          });
        },

        setPage: (page) => {
          set((state) => {
            state.pagination.page = page;
          });
        },

        setSearch: (search) => {
          set((state) => {
            state.filters.search = search;
            state.pagination.page = 1; // Reset to first page on search
          });
        },
        setFilters: (filters) => {
          set((state) => {
            state.filters = { ...state.filters, ...filters };
            state.pagination.page = 1; // Reset to first page on filter change
          });
        },

        clearError: () => {
          set((state) => {
            state.error = null;
          });
        },

        reset: () => {
          set(initialState);
        },
      })),
      {
        name: "profile-storage",
        partialize: (state) => ({
          currentUser: state.currentUser,
        }),
      }
    ),
    { name: "ProfileStore" }
  )
);

// Selectors
export const useCurrentUser = () =>
  useProfileStore((state) => state.currentUser);

export const useUsers = () => useProfileStore((state) => state.users);

export const useSelectedUser = () =>
  useProfileStore((state) => state.selectedUser);

export const usePagination = () => useProfileStore((state) => state.pagination);

export const useProfileLoading = () =>
  useProfileStore((state) => state.loading);

export const useProfileError = () => useProfileStore((state) => state.error);

export const useIsAuthenticated = () =>
  useProfileStore((state) => !!state.currentUser);

export const useIsAdmin = () =>
  useProfileStore((state) => state.currentUser?.profile?.isAgent || false);