import { CreateEmployeeDto, Employee, UpdateEmployeeDto } from "@/types/employee";
import api from "../config/axios.config";
export const employeesApi = {
    getAll: () => api.get<Employee[]>('/employees'),
    getOne: (id: string) => api.get<Employee>(`/employees/${id}`),
    create: (data: CreateEmployeeDto) => api.post<Employee>('/employees', data),
    update: (id: string, data: UpdateEmployeeDto) => api.patch<Employee>(`/employees/${id}`, data),
    delete: (id: string) => api.delete(`/employees/${id}`),
};