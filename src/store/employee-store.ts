import { create } from "zustand";
import {
  Employee,
  CreateEmployeeDto,
  UpdateEmployeeDto,
} from "@/types/employee";
import { employeesApi } from "@/api/employees/employee";

/** Newest first — a just-added employee must land on page 1, not on whatever
 *  page the API's insertion order happens to put them. */
const byNewest = (list: unknown) =>
  (Array.isArray(list) ? (list as Employee[]) : []).slice().sort(
    (a, b) =>
      new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
  );

interface EmployeeState {
  employees: Employee[];
  selectedEmployee: Employee | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchEmployees: () => Promise<void>;
  createEmployee: (data: CreateEmployeeDto) => Promise<void>;
  updateEmployee: (id: string, data: UpdateEmployeeDto) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  setSelectedEmployee: (employee: Employee | null) => void;
  clearError: () => void;
}

export const useEmployeeStore = create<EmployeeState>((set, get) => ({
  employees: [],
  selectedEmployee: null,
  loading: false,
  error: null,

  fetchEmployees: async () => {
    set({ loading: true, error: null });
    try {
      const response = await employeesApi.getAll();
      set({ employees: byNewest(response.data), loading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || "Failed to fetch employees",
        loading: false,
      });
    }
  },

  createEmployee: async (data) => {
    set({ loading: true, error: null });
    try {
      await employeesApi.create(data);
      await get().fetchEmployees();
      set({ loading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || "Failed to create employee",
        loading: false,
      });
      throw error;
    }
  },

  updateEmployee: async (id, data) => {
    set({ loading: true, error: null });
    try {
      await employeesApi.update(id, data);
      await get().fetchEmployees();
      set({ loading: false, selectedEmployee: null });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || "Failed to update employee",
        loading: false,
      });
      throw error;
    }
  },

 deleteEmployee: async (id) => {
  set({ loading: true, error: null });

  try {
    await employeesApi.delete(id); // ✅ wait backend confirm

    // ✅ now remove from UI
    set((state) => ({
      employees: state.employees.filter((e) => e.id !== id),
      selectedEmployee: null,
      loading: false,
    }));

    // OR if you prefer: await get().fetchEmployees();
  } catch (error: any) {
    set({
      error: error.response?.data?.message || "Failed to delete employee",
      loading: false,
    });
    throw error;
  }
},


  setSelectedEmployee: (employee) => {
    set({ selectedEmployee: employee });
  },

  clearError: () => {
    set({ error: null });
  },
}));
