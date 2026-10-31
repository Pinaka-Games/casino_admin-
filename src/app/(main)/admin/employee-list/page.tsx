"use client";

import * as React from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

import {
  Employee,
  CreateEmployeeDto,
  UpdateEmployeeDto,
} from "@/types/employee";
import toast from "react-hot-toast";
import { EmployeeTable } from "@/components/employee/employee.table";
import { EmployeeDialog } from "@/components/employee/employee.dialog";
import { DeleteDialog } from "@/components/employee/delete.dialog";
import { EmployeeDetails } from "@/components/employee/employee-details";
import { useEmployeeStore } from "@/store/employee-store";
import { usePermissions } from "@/hooks/user-permissions";

export default function EmployeesPage() {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = React.useState(false);
  const [selectedEmployee, setSelectedEmployee] =
    React.useState<Employee | null>(null);
  const { can } = usePermissions(); 

  const canDelete = can("employees", "delete");

  const {
    fetchEmployees,
    employees,
    loading,
    createEmployee,
    updateEmployee,
    deleteEmployee,
  } = useEmployeeStore();
  React.useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Create/Update employee
  const handleSubmit = async (data: CreateEmployeeDto | UpdateEmployeeDto) => {
    try {
      if (selectedEmployee) {
        await updateEmployee(selectedEmployee.id, data as UpdateEmployeeDto);
        toast.success("Employee updated successfully");
      } else {
        await createEmployee(data as CreateEmployeeDto);
        toast.success("Employee created successfully");
      }
      setDialogOpen(false);
      setSelectedEmployee(null);
    } catch (error: any) {
      const status = error?.response?.status;
      const message = error?.response?.data?.message || error?.message;
      if (status === 400 || status === 422) {
        throw error;
      }

      toast.error(
        Array.isArray(message) ? message[0] : message || "Operation failed",
      );
      throw error;
    }
  };

  // Delete employee
  const handleDelete = async () => {
    if (!selectedEmployee) return;

    try {
      await deleteEmployee(selectedEmployee.id);
      toast.success("Employee deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedEmployee(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to delete employee");
    }
  };

  // Handle edit
  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    setDialogOpen(true);
  };

  // Handle delete click
  const handleDeleteClick = (employee: Employee) => {
    if (canDelete) {
      setSelectedEmployee(employee);
      setDeleteDialogOpen(true);
    } else {
      toast.error("you dont have permission to delete");
    }
  };

  // Handle view
  const handleView = (employee: Employee) => {
    setSelectedEmployee(employee);
    setDetailsDialogOpen(true);
  };

  // Handle create new
  const handleCreateNew = () => {
    setSelectedEmployee(null);
    setDialogOpen(true);
  };

  if (loading && employees.length === 0) {
    return (
      <div className="flex items-center justify-center h-120">
        {" "}
        <Loader2 className="h-16 w-16 animate-spin text-purple-400" />{" "}
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      <EmployeeTable
        data={employees}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
        onView={handleView}
        onCreate={handleCreateNew}
      />

      <EmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employee={selectedEmployee}
        onSubmit={handleSubmit}
        loading={loading}
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        employee={selectedEmployee}
        onConfirm={handleDelete}
      />

      <EmployeeDetails
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        employee={selectedEmployee}
      />
    </div>
  );
}
