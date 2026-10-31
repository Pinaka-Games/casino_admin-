import api from "../config/axios.config";
import { CreateRoleDto, Role, UpdateRoleDto } from "@/types/role.type";

export const rolesApi = {
getAll: (params?: { includeInactive?: boolean }) => {
  const query = params?.includeInactive ? "?includeInactive=true" : "";
  return api.get(`/roles${query}`);
},

  getOne: (id: number) => api.get<Role>(`/roles/${id}`),

  create: (data: CreateRoleDto) => api.post<Role>("/roles", data),

  update: (id: number, data: UpdateRoleDto) =>
    api.put<Role>(`/roles/${id}`, data),

  delete: (id: number) => api.delete(`/roles/${id}`),

  assignPermissions: async (roleId: number, permissionIds: number[]) => {
    const response = await api.post(`/roles/${roleId}/permissions`, {
      permissionIds,
    });
    return response.data;
  },

  removePermissions: async (roleId: number, permissionIds: number[]) => {
    const response = await api.delete(`/roles/${roleId}/permissions`, {
      data: { permissionIds },
    });
    return response.data;
  },
};
