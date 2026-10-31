import { useCallback, useEffect, useRef } from "react";
import { useProfileStore } from "@/store/users-store";
import {
  CreateProfileDto,
  UpdateProfileDto,
  GetUsersParams,
} from "@/types/profile.type";
import { toast } from "react-hot-toast";
import { CrossPoolConflict, getCrossPoolConflict } from "@/lib/api-error";

/**
 * Result of a registration attempt.
 *   • success  — created; caller resets the form
 *   • conflict — email/phone belongs to the other pool AND the admin may
 *                override; caller shows a "create anyway?" confirm then calls
 *                register again with force = true
 *   • error    — already surfaced via toast; caller keeps the form as-is
 */
export type RegisterOutcome =
  | { status: "success" }
  | { status: "error" }
  | { status: "conflict"; conflict: CrossPoolConflict };

/**
 * Hook for current user profile operations
 */
export const useCurrentUserProfile = () => {
  const currentUser = useProfileStore((state) => state.currentUser);
  const loading = useProfileStore((state) => state.loading.currentUser);
  const error = useProfileStore((state) => state.error);
  const fetchCurrentUser = useProfileStore((state) => state.fetchCurrentUser);
  const updateCurrentUser = useProfileStore((state) => state.updateCurrentUser);
  const logout = useProfileStore((state) => state.logout);
  const clearError = useProfileStore((state) => state.clearError);

  const handleFetchProfile = useCallback(async () => {
    try {
      await fetchCurrentUser();
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    }
  }, [fetchCurrentUser]);

  const handleUpdateProfile = useCallback(
    async (data: UpdateProfileDto) => {
      try {
        await updateCurrentUser(data);
        toast.success("Profile updated successfully");
      } catch (error) {
        toast.error("Failed to update profile");
        throw error;
      }
    },
    [updateCurrentUser]
  );

  const handleLogout = useCallback(() => {
    logout();
    toast.success("Logged out successfully");
  }, [logout]);

  return {
    currentUser,
    loading,
    error,
    fetchProfile: handleFetchProfile,
    updateProfile: handleUpdateProfile,
    logout: handleLogout,
    clearError,
    isAuthenticated: !!currentUser,
    isAgent: currentUser?.profile?.isAgent || false,
  };
};

/**
 * Hook for user management with simplified search
 */
export const useUserManagement = () => {
  const users = useProfileStore((state) => state.users);
  const selectedUser = useProfileStore((state) => state.selectedUser);
  const pagination = useProfileStore((state) => state.pagination);
  const search = useProfileStore((state) => state.filters.search);
  const loading = useProfileStore((state) => state.loading.users);
  const error = useProfileStore((state) => state.error);

  const fetchUsers = useProfileStore((state) => state.fetchUsers);
  const fetchUserById = useProfileStore((state) => state.fetchUserById);
  const setFilters = useProfileStore((state) => state.setFilters);
  const updateUser = useProfileStore((state) => state.updateUser);
  const deleteUser = useProfileStore((state) => state.deleteUser);
  const setSelectedUser = useProfileStore((state) => state.setSelectedUser);
  const setPage = useProfileStore((state) => state.setPage);
  const setSearch = useProfileStore((state) => state.setSearch);
  const clearError = useProfileStore((state) => state.clearError);

  const handleFetchUsers = useCallback(
    async (params?: GetUsersParams & { isAgent?: boolean }) => {
      try {
        await fetchUsers(params);
      } catch (error) {
        console.error("Failed to fetch users:", error);
      }
    },
    [fetchUsers]
  );

  const handleFetchUser = useCallback(
    async (userId: string) => {
      try {
        await fetchUserById(userId);
      } catch (error) {
        toast.error("Failed to fetch user");
      }
    },
    [fetchUserById]
  );

  const handleUpdateUser = useCallback(
    async (userId: string, data: UpdateProfileDto) => {
      try {
        await updateUser(userId, data);
        toast.success("User updated successfully");
      } catch (error) {
        toast.error("Failed to update user");
        throw error;
      }
    },
    [updateUser]
  );

  const handleDeleteUser = useCallback(
    async (userId: string) => {
      try {
        await deleteUser(userId);
        toast.success("User deleted successfully");
      } catch (error) {
        toast.error("Failed to delete user");
        throw error;
      }
    },
    [deleteUser]
  );

  const changePage = useCallback(
    (page: number, filters?: Omit<GetUsersParams, "page">) => {
      setPage(page);
      fetchUsers({ page, ...filters });
    },
    [setPage, fetchUsers]
  );

  return {
    users,
    selectedUser,
    pagination,
    search,
    loading,
    error,
    fetchUsers: handleFetchUsers,
    fetchUser: handleFetchUser,
    updateUser: handleUpdateUser,
    deleteUser: handleDeleteUser,
    selectUser: setSelectedUser,
    changePage,
    setSearch,
    setFilters,
    clearError,
  };
};

/**
 * Hook specifically for agent management
 */
export const useAgents = () => {
  const userManagement = useUserManagement();
  
  const fetchAgents = useCallback(
    (params?: GetUsersParams) => {
      return userManagement.fetchUsers({ ...params, isAgent: true });
    },
    [userManagement.fetchUsers]
  );

  const changePage = useCallback(
    (page: number) => {
      return userManagement.changePage(page, { isAgent: true });
    },
    [userManagement.changePage]
  );

  return {
    ...userManagement,
    agents: userManagement.users,
    fetchAgents,
    changePage,
  };
};

/**
 * Hook for debounced search - simplified version
 */
export const useDebouncedSearch = (delay: number = 500) => {
  const setSearch = useProfileStore((state) => state.setSearch);
  const fetchUsers = useProfileStore((state) => state.fetchUsers);
  const searchTerm = useProfileStore((state) => state.filters.search);
  
  const debounceRef = useRef<NodeJS.Timeout>(null);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      
      // Clear existing timeout
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Set new timeout
      debounceRef.current = setTimeout(() => {
        fetchUsers({ page: 1, search: value });
      }, delay);
    },
    [setSearch, fetchUsers, delay]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // The term lives in the profile store, which outlives this page — leave
      // "revati" typed, walk to another screen, come back, and the listing is
      // still filtered by it with no obvious reason why. Cleared here rather
      // than through setSearch() so no refetch is fired on the way out; the
      // next visit loads unfiltered on its own.
      useProfileStore.setState((state) => {
        state.filters.search = "";
      });
    };
  }, []);

  return {
    searchTerm,
    setSearchTerm: handleSearchChange,
  };
};

/**
 * Hook for user registration
 */
export const useUserRegistration = () => {
  const createUser = useProfileStore((state) => state.createUser);
  const loading = useProfileStore((state) => state.loading.action);
  const error = useProfileStore((state) => state.error);
  const clearError = useProfileStore((state) => state.clearError);

  const register = useCallback(
    async (
      data: CreateProfileDto,
      force = false,
    ): Promise<RegisterOutcome> => {
      try {
        await createUser(force ? { ...data, force: true } : data);
        toast.success("Registration successful!");
        return { status: "success" };
      } catch (error: any) {
        // A cross-pool warning the admin is allowed to override is NOT toasted —
        // the caller shows a confirm dialog and can retry with force = true.
        const conflict = getCrossPoolConflict(error);
        if (conflict && conflict.overridable && !force) {
          return { status: "conflict", conflict };
        }

        const errorMessage =
          error.response?.data?.message || "Registration failed";
        toast.error(
          Array.isArray(errorMessage) ? errorMessage.join(", ") : errorMessage
        );
        return { status: "error" };
      }
    },
    [createUser]
  );

  return {
    register,
    loading,
    error,
    clearError,
  };
};
