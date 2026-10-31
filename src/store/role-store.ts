// store/role-store.ts
import { create } from "zustand";
import { rolesApi } from "@/api/roles/roles";
import { Role, UpdateRoleDto, CreateRoleDto } from "@/types/role.type";

interface RoleState {
  roles: Role[];
  selectedRole: Role | null;
  loading: boolean;
  error: string | null;
  includeInactive: boolean;

  // Actions
  fetchRoles: (includeInactive?: boolean) => Promise<void>;
  createRole: (data: CreateRoleDto) => Promise<void>;
  updateRole: (id: number, data: UpdateRoleDto) => Promise<void>;
  deleteRole: (id: number) => Promise<void>;

  // Permission Management
  assignPermissions: (roleId: number, permissionIds: number[]) => Promise<void>;
  removePermissions: (roleId: number, permissionIds: number[]) => Promise<void>;

  setSelectedRole: (role: Role | null) => void;
  clearError: () => void;
}

export const useRolesStore = create<RoleState>((set, get) => ({
  roles: [],
  selectedRole: null,
  loading: false,
  error: null,

  includeInactive: false,

  fetchRoles: async (includeInactive = false) => {
    set({ loading: true, error: null, includeInactive }); 
    try {
      const response = await rolesApi.getAll({ includeInactive });
      set({ roles: response.data, loading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || "Failed to fetch roles",
        loading: false,
      });
    }
  },

  createRole: async (data) => {
    set({ loading: true, error: null });
    try {
      await rolesApi.create(data);
      await get().fetchRoles(get().includeInactive); 
      set({ loading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || "Failed to create role",
        loading: false,
      });
      throw error;
    }
  },

  updateRole: async (id, data) => {
    set({ loading: true, error: null });
    try {
      await rolesApi.update(id, data);
      await get().fetchRoles(get().includeInactive); 
      set({ loading: false, selectedRole: null });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || "Failed to update role",
        loading: false,
      });
      throw error;
    }
  },

  deleteRole: async (id) => {
    set({ loading: true, error: null });
    try {
      await rolesApi.delete(id);
      await get().fetchRoles(get().includeInactive); 
      set({ loading: false, selectedRole: null });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || "Failed to delete role",
        loading: false,
      });
      throw error;
    }
  },

  assignPermissions: async (roleId, permissionIds) => {
    set({ loading: true, error: null });
    try {
      await rolesApi.assignPermissions(roleId, permissionIds);
      await get().fetchRoles(get().includeInactive); 
      set({ loading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || "Failed to assign permissions",
        loading: false,
      });
      throw error;
    }
  },

  removePermissions: async (roleId, permissionIds) => {
    set({ loading: true, error: null });
    try {
      await rolesApi.removePermissions(roleId, permissionIds);
      await get().fetchRoles(get().includeInactive); 
      set({ loading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || "Failed to remove permissions",
        loading: false,
      });
      throw error;
    }
  },

  setSelectedRole: (role) => {
    set({ selectedRole: role });
  },

  clearError: () => {
    set({ error: null });
  },
}));
