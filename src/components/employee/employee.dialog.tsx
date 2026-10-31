"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import toast from "react-hot-toast";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Employee,
  CreateEmployeeDto,
  UpdateEmployeeDto,
} from "@/types/employee";
import { ChevronDown, Eye, EyeOff, Loader2, X } from "lucide-react";
import { useRolesStore } from "@/store/role-store";
import { DropdownMenu, DropdownMenuContent } from "../ui/dropdown-menu";
import {
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@radix-ui/react-dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/hooks/user-permissions";
import { passwordRule } from "@/components/validators/common.rules";

// VALIDATION:
const createEmployeeSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  // Shared rule — was missing the lowercase check the API enforces.
  password: passwordRule,

  roleIds: z.array(z.number()).min(1, "Please select at least one role"),
});

const updateEmployeeSchema = z.object({
  username: z.string().min(2).optional(),
  roleIds: z.array(z.number()).optional(),
  isActive: z.boolean().optional(),
});

interface EmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee | null;
  onSubmit: (data: CreateEmployeeDto | UpdateEmployeeDto) => Promise<void>;
  loading?: boolean;
}

export function EmployeeDialog({
  open,
  onOpenChange,
  employee,
  onSubmit,
  loading,
}: EmployeeDialogProps) {
  const isEdit = !!employee;
  const [showPassword, setShowPassword] = React.useState(false);
  const { roles, fetchRoles } = useRolesStore();
  const { user } = useAuth();
  const { can } = usePermissions(); // Use the permission hook

  const canCreate = can("employees", "create");
  const canUpdate = can("employees", "update");
  const canDelete = can("employees", "delete");

  // Determine if user can perform this action
  const hasRequiredPermission = isEdit ? canUpdate : canCreate;

  // Prevent duplicate toast (StrictMode / rerender safe)
  const permissionToastShownRef = React.useRef(false);


  const getEmployeeRoleIds = (employee: Employee | null | undefined) => {
    if (!employee) return [];
    // If employee has roles array with objects, extract IDs
    if (employee.roles && Array.isArray(employee.roles)) {
      return employee.roles.map((role: any) => role.id);
    }
    // If employee has roleIds array directly
    if (employee.roles && Array.isArray(employee.roles)) {
      return employee.roles;
    }
    return [];
  };

  const form = useForm<any>({
    resolver: zodResolver(isEdit ? updateEmployeeSchema : createEmployeeSchema),
    defaultValues: isEdit
      ? {
          username: employee?.username || "",
          roleIds: getEmployeeRoleIds(employee),
          isActive: employee?.isActive ?? false,
          email: employee?.email || "",
        }
      : {
          username: "",
          email: "",
          password: "",
          roleIds: [],
        },
  });

  // Fetch roles when dialog opens
  React.useEffect(() => {
    if (open) {
      fetchRoles();
    }
  }, [open, fetchRoles]);

  React.useEffect(() => {
    if (employee) {
      form.reset({
        username: employee.username,
        roleIds: getEmployeeRoleIds(employee),
        email: employee.email,
        isActive: employee.isActive,
      });
    } else {
      form.reset({
        username: "",
        email: "",
        password: "",
        roleIds: [],
      });
    }
  }, [employee, form, open]);

  // ✅ Permission toast + auto-close dialog (fires once per open)
  React.useEffect(() => {
    if (open && !hasRequiredPermission) {
      if (!permissionToastShownRef.current) {
        toast.error(
          `You don't have permission to ${isEdit ? "update" : "create"} employees`,
          { id: "employee-permission-denied" } // prevents stacking
        );
        permissionToastShownRef.current = true;
      }
      onOpenChange(false);
    }

    // reset when dialog closes
    if (!open) {
      permissionToastShownRef.current = false;
    }
  }, [open, hasRequiredPermission, isEdit, onOpenChange]);

  const handleSubmit = async (data: any) => {
    if (!hasRequiredPermission) {
      toast.error(
        `You don't have permission to ${isEdit ? "update" : "create"} employees`,
        { id: "employee-permission-denied" }
      );
      return;
    }

    try {
      await onSubmit(data);
      onOpenChange(false);
      form.reset();
    } catch (err: any) {
      const message = err?.response?.data?.message;

      // if backend returns validation message for password
      if (
        typeof message === "string" &&
        message.toLowerCase().includes("password")
      ) {
        form.setError("password", { type: "server", message });
        return;
      }

      if (Array.isArray(message)) {
        const first = message[0];
        if (
          typeof first === "string" &&
          first.toLowerCase().includes("password")
        ) {
          form.setError("password", { type: "server", message: first });
          return;
        }
      }
    }
  };

  // ✅ If no permission, render nothing (toast handled in useEffect)
  if (!hasRequiredPermission) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-[#15181E] border-none text-white p-0 gap-0">
        {/* HEADER */}
        <DialogHeader className="px-6 pt-6 pb-4 space-y-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-medium text-white">
              {isEdit ? "Edit Employee" : "Create New"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-gray-400 text-sm sr-only">
            {isEdit
              ? "Update employee information below."
              : "Fill in the details to create a new employee."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="px-6 pb-6 space-y-4"
          >
            {/* --- ROW 1: USERNAME + EMAIL --- */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white text-sm">
                      Username<span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="John"
                        {...field}
                        className="bg-[#242B35]! border-none text-white placeholder:text-gray-500 h-8"
                      />
                    </FormControl>
                    <FormMessage className="text-red-400 text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white text-sm">
                      Email<span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="john.doe@example.com"
                        {...field}
                        disabled={isEdit}
                        className={`bg-[#242B35]! border-none text-white placeholder:text-gray-500 h-8 
                                                    ${isEdit ? "opacity-70 cursor-not-allowed" : ""}`}
                      />
                    </FormControl>
                    <FormMessage className="text-red-400 text-xs" />
                  </FormItem>
                )}
              />
            </div>

            {/* --- ROW 2: PASSWORD --- */}
            {!isEdit && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white text-sm">
                        Password<span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            {...field}
                            className="bg-[#242B35]! border-none text-white placeholder:text-gray-500 h-8 pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                          >
                            {showPassword ? (
                              <EyeOff size={18} />
                            ) : (
                              <Eye size={18} />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-400 text-xs" />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* --- ROLES (50% width + Multi-select dropdown with checkboxes) --- */}
            <FormField
              control={form.control}
              name="roleIds"
              render={({ field }) => {
                const selectedIds: number[] = field.value || [];
                const selectedRoles = roles.filter((r) =>
                  selectedIds.includes(r.id),
                );

                const toggleRole = (roleId: number) => {
                  if (selectedIds.includes(roleId)) {
                    field.onChange(selectedIds.filter((id) => id !== roleId));
                  } else {
                    field.onChange([...selectedIds, roleId]);
                  }
                };

                return (
                  <FormItem className="w-1/2">
                    <FormLabel className="text-white text-sm">
                      Roles<span className="text-red-500">*</span>
                    </FormLabel>

                    {/* Trigger */}
                    <FormControl>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="h-8 w-full rounded-md bg-[#242B35] px-3 text-left text-sm text-white flex items-center justify-between border border-transparent hover:border-gray-600 transition"
                          >
                            <span className="truncate text-gray-200">
                              {selectedRoles.length > 0
                                ? `${selectedRoles.length} role${
                                    selectedRoles.length > 1 ? "s" : ""
                                  } selected`
                                : "Select role(s)"}
                            </span>
                            <ChevronDown className="h-4 w-4 text-gray-300" />
                          </button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent
                          align="start"
                          className="w-[320px] bg-[#15181E] border border-gray-700 text-white p-2"
                        >
                          {/* Options */}
                          <div className="max-h-56 overflow-y-auto pr-1">
                            {roles.map((role) => {
                              const checked = selectedIds.includes(role.id);
                              return (
                                <button
                                  key={role.id}
                                  type="button"
                                  onClick={() => toggleRole(role.id)}
                                  className="w-full flex items-center gap-3 rounded-md px-2 py-2 hover:bg-white/5 transition text-left"
                                >
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={() => toggleRole(role.id)}
                                    className="border-gray-600 data-[state=checked]:border-purple-500 data-[state=checked]:bg-purple-500"
                                  />
                                  <span className="text-sm text-gray-200">
                                    {role.name}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          <DropdownMenuSeparator className="my-2 bg-gray-700" />

                          {/* Actions */}
                          <div className="flex items-center justify-between gap-2 px-1">
                            <button
                              type="button"
                              onClick={() => field.onChange([])}
                              className="text-xs text-gray-300 hover:text-white transition"
                              disabled={selectedIds.length === 0}
                            >
                              Clear
                            </button>

                            <div className="text-xs text-gray-400">
                              {selectedIds.length} selected
                            </div>
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </FormControl>

                    {/* Selected chips */}
                    {selectedRoles.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedRoles.map((role) => (
                          <div
                            key={role.id}
                            className="flex items-center gap-1 rounded-md bg-[#242B35] border border-gray-700 px-2 py-1 text-xs text-white"
                          >
                            <span className="max-w-[160px] truncate">
                              {role.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleRole(role.id)}
                              className="text-gray-300 hover:text-white"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <FormMessage className="text-red-400 text-xs" />
                  </FormItem>
                );
              }}
            />

            {/* STATUS — edit only */}
            {isEdit && (
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white text-sm">Status</FormLabel>
                    <div className="flex items-center space-x-4">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={field.value === true}
                          onChange={() => field.onChange(true)}
                          className="w-4 h-4"
                        />
                        <span className="text-white text-sm">Active</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={field.value === false}
                          onChange={() => field.onChange(false)}
                          className="w-4 h-4"
                        />
                        <span className="text-white text-sm">Inactive</span>
                      </label>
                    </div>
                    <FormMessage className="text-red-400 text-xs" />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter className="pt-4 gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => {
                  if (loading) return;
                  onOpenChange(false);
                }}
                className="bg-[#4A5568] hover:bg-[#5A6578] text-white border-none px-6"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={loading}
                className="bg-purple-500 hover:bg-purple-500/70 text-white border-none px-6 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isEdit ? "Updating..." : "Creating..."}
                  </>
                ) : isEdit ? (
                  "Update"
                ) : (
                  "Create"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
