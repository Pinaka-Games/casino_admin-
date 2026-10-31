// store/permission-store.ts
import { create } from 'zustand';
import {
  Permission,
  CreatePermissionDto,
  UpdatePermissionDto,
  QueryPermissionDto,
  BulkCreatePermissionsDto,
  PermissionStats,
  GroupedPermissions,
} from '@/types/permission.types';
import { permissionsApi } from '@/api/permissions/permissions';

interface PermissionState {
  permissions: Permission[];
  selectedPermission: Permission | null;
  stats: PermissionStats | null;
  groupedPermissions: GroupedPermissions | null;
  resources: string[];
  actions: string[];
  loading: boolean;
  error: string | null;

  // Basic CRUD Actions
  fetchPermissions: (query?: QueryPermissionDto) => Promise<void>;
  createPermission: (data: CreatePermissionDto) => Promise<void>;
  createBulkPermissions: (data: BulkCreatePermissionsDto) => Promise<void>;
  seedDefaultPermissions: () => Promise<void>;
  updatePermission: (id: number, data: UpdatePermissionDto) => Promise<void>;
  deletePermission: (id: number) => Promise<void>;
  forceDeletePermission: (id: number) => Promise<void>;

  // Fetch specific data
  fetchStats: () => Promise<void>;
  fetchResources: () => Promise<void>;
  fetchActions: () => Promise<void>;
  fetchGroupedByResource: () => Promise<void>;
  fetchByRole: (roleId: number) => Promise<Permission[]>;
  fetchUnassignedForRole: (roleId: number) => Promise<Permission[]>;
  fetchByResource: (resource: string) => Promise<Permission[]>;
  fetchByAction: (action: string) => Promise<Permission[]>;
  fetchByName: (name: string) => Promise<Permission | null>;
  fetchOne: (id: number) => Promise<Permission>;

  // UI State Management
  setSelectedPermission: (permission: Permission | null) => void;
  clearError: () => void;
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  permissions: [],
  selectedPermission: null,
  stats: null,
  groupedPermissions: null,
  resources: [],
  actions: [],
  loading: false,
  error: null,

  // Fetch all permissions with optional filters
  fetchPermissions: async (query?: QueryPermissionDto) => {
    set({ loading: true, error: null });
    try {
      const response = await permissionsApi.getAll(query);
      set({ permissions: response.data, loading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch permissions',
        loading: false,
      });
    }
  },

  // Create single permission
  createPermission: async (data) => {
    set({ loading: true, error: null });
    try {
      await permissionsApi.create(data);
      await get().fetchPermissions();
      set({ loading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to create permission',
        loading: false,
      });
      throw error;
    }
  },

  // Bulk create permissions
  createBulkPermissions: async (data) => {
    set({ loading: true, error: null });
    try {
      await permissionsApi.createBulk(data);
      await get().fetchPermissions();
      set({ loading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to create permissions',
        loading: false,
      });
      throw error;
    }
  },

  // Seed default permissions
  seedDefaultPermissions: async () => {
    set({ loading: true, error: null });
    try {
      await permissionsApi.seedDefaultPermissions();
      await get().fetchPermissions();
      set({ loading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to seed permissions',
        loading: false,
      });
      throw error;
    }
  },

  // Update permission
  updatePermission: async (id, data) => {
    set({ loading: true, error: null });
    try {
      await permissionsApi.update(id, data);
      await get().fetchPermissions();
      set({ loading: false, selectedPermission: null });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to update permission',
        loading: false,
      });
      throw error;
    }
  },

  // Soft delete permission
  deletePermission: async (id) => {
    set({ loading: true, error: null });
    try {
      await permissionsApi.delete(id);
      await get().fetchPermissions();
      set({ loading: false, selectedPermission: null });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to delete permission',
        loading: false,
      });
      throw error;
    }
  },

  // Force delete permission
  forceDeletePermission: async (id) => {
    set({ loading: true, error: null });
    try {
      await permissionsApi.forceDelete(id);
      await get().fetchPermissions();
      set({ loading: false, selectedPermission: null });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to force delete permission',
        loading: false,
      });
      throw error;
    }
  },

  // Fetch statistics
  fetchStats: async () => {
    set({ loading: true, error: null });
    try {
      const stats = await permissionsApi.getStats();
      set({ stats, loading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch stats',
        loading: false,
      });
    }
  },

  // Fetch unique resources
  fetchResources: async () => {
    set({ loading: true, error: null });
    try {
      const response = await permissionsApi.getResources();
      set({ resources: response.data, loading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch resources',
        loading: false,
      });
    }
  },

  // Fetch unique actions
  fetchActions: async () => {
    set({ loading: true, error: null });
    try {
      const response = await permissionsApi.getActions();
      set({ actions: response.data, loading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch actions',
        loading: false,
      });
    }
  },

  // Fetch grouped permissions
  fetchGroupedByResource: async () => {
    set({ loading: true, error: null });
    try {
      const response = await permissionsApi.getGroupedByResource();
      set({ groupedPermissions: response.data, loading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch grouped permissions',
        loading: false,
      });
    }
  },

  // Fetch permissions by role
  fetchByRole: async (roleId) => {
    set({ loading: true, error: null });
    try {
      const response = await permissionsApi.getByRole(roleId);
      set({ loading: false });
      return response.data;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch role permissions',
        loading: false,
      });
      throw error;
    }
  },

  // Fetch unassigned permissions for role
  fetchUnassignedForRole: async (roleId) => {
    set({ loading: true, error: null });
    try {
      const response = await permissionsApi.getUnassignedForRole(roleId);
      set({ loading: false });
      return response.data;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch unassigned permissions',
        loading: false,
      });
      throw error;
    }
  },

  // Fetch by resource
  fetchByResource: async (resource) => {
    set({ loading: true, error: null });
    try {
      const response = await permissionsApi.getByResource(resource);
      set({ loading: false });
      return response.data;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch permissions by resource',
        loading: false,
      });
      throw error;
    }
  },

  // Fetch by action
  fetchByAction: async (action) => {
    set({ loading: true, error: null });
    try {
      const response = await permissionsApi.getByAction(action);
      set({ loading: false });
      return response.data;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch permissions by action',
        loading: false,
      });
      throw error;
    }
  },

  // Fetch by name
  fetchByName: async (name) => {
    set({ loading: true, error: null });
    try {
      const response = await permissionsApi.getByName(name);
      set({ loading: false });
      return response.data;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch permission by name',
        loading: false,
      });
      throw error;
    }
  },

  // Fetch single permission
  fetchOne: async (id) => {
    set({ loading: true, error: null });
    try {
      const permission = await permissionsApi.getOne(id);
      set({ loading: false });
      return permission;
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch permission',
        loading: false,
      });
      throw error;
    }
  },

  // Set selected permission
  setSelectedPermission: (permission) => {
    set({ selectedPermission: permission });
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },
}));