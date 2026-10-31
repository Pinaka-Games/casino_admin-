// api/permissions/permissions.api.ts
import api from '../config/axios.config';
import {
  Permission,
  CreatePermissionDto,
  UpdatePermissionDto,
  QueryPermissionDto,
  BulkCreatePermissionsDto,
  PermissionStats,
  GroupedPermissions,
} from '@/types/permission.types';

export const permissionsApi = {
  // Create single permission
  create: async (data: CreatePermissionDto) => {
    const response = await api.post<Permission>('/permissions', data);
    return response.data;
  },

  // Bulk create permissions
  createBulk: async (data: BulkCreatePermissionsDto) => {
    const response = await api.post<{
      message: string;
      data: Permission[];
    }>('/permissions/bulk', data);
    return response.data;
  },

  // Seed default permissions
  seedDefaultPermissions: async () => {
    const response = await api.post<{
      message: string;
      data: Permission[];
    }>('/permissions/seed');
    return response.data;
  },

  // Get all permissions with optional filters
  getAll: async (query?: QueryPermissionDto) => {
    const response = await api.get<{
      data: Permission[];
      total: number;
      filters: {
        resource?: string;
        action?: string;
        search?: string;
      };
    }>('/permissions', { params: query });
    return response.data;
  },

  // Get permission statistics
  getStats: async () => {
    const response = await api.get<PermissionStats>('/permissions/stats');
    return response.data;
  },

  // Get unique resources
  getResources: async () => {
    const response = await api.get<{ data: string[] }>('/permissions/resources');
    return response.data;
  },

  // Get unique actions
  getActions: async () => {
    const response = await api.get<{ data: string[] }>('/permissions/actions');
    return response.data;
  },

  // Get permissions grouped by resource
  getGroupedByResource: async () => {
    const response = await api.get<{ data: GroupedPermissions }>('/permissions/grouped');
    return response.data;
  },

  // Get permissions by role ID
  getByRole: async (roleId: number) => {
    const response = await api.get<{
      data: Permission[];
      total: number;
    }>(`/permissions/role/${roleId}`);
    return response.data;
  },

  // Get unassigned permissions for a role
  getUnassignedForRole: async (roleId: number) => {
    const response = await api.get<{
      data: Permission[];
      total: number;
    }>(`/permissions/role/${roleId}/unassigned`);
    return response.data;
  },

  // Get permissions by resource
  getByResource: async (resource: string) => {
    const response = await api.get<{
      data: Permission[];
      total: number;
    }>(`/permissions/resource/${resource}`);
    return response.data;
  },

  // Get permissions by action
  getByAction: async (action: string) => {
    const response = await api.get<{
      data: Permission[];
      total: number;
    }>(`/permissions/action/${action}`);
    return response.data;
  },

  // Get permission by name
  getByName: async (name: string) => {
    const response = await api.get<{ data: Permission | null }>(`/permissions/name/${name}`);
    return response.data;
  },

  // Get single permission by ID
  getOne: async (id: number) => {
    const response = await api.get<Permission>(`/permissions/${id}`);
    return response.data;
  },

  // Update permission
  update: async (id: number, data: UpdatePermissionDto) => {
    const response = await api.patch<Permission>(`/permissions/${id}`, data);
    return response.data;
  },

  // Soft delete permission
  delete: async (id: number) => {
    await api.delete(`/permissions/${id}`);
  },

  // Force delete permission (hard delete)
  forceDelete: async (id: number) => {
    await api.delete(`/permissions/${id}/force`);
  },
};