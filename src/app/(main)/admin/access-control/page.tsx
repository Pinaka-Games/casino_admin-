"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { ViewRoleDialog } from "@/components/roles/role.detail";
import { RoleDialog } from "@/components/roles/role.dialog";
import { RoleTable } from "@/components/roles/roles.table";
import { useRolesStore } from "@/store/role-store";
import { Role } from "@/types/role.type";
import { DeleteDialog } from "@/components/roles/delete.dialog";
import { usePermissions } from "@/hooks/user-permissions";

export default function RoleManagementPage() {
  const {
    roles,
    loading,
    selectedRole,
    setSelectedRole,
    error,
    fetchRoles,
    updateRole,
    createRole,
    deleteRole,
  } = useRolesStore();

  const { can } = usePermissions();

  const canDelete = can("roles", "delete");
  const canCreate = can("roles", "create");
  const canUpdate = can("roles", "update");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  // Fetch roles on mount
  useEffect(() => {
    fetchRoles(true); // ✅ include inactive for roles table
  }, [fetchRoles]);

  const handleCreate = () => {
    if (!canCreate) {
      toast.error("You dont have permission to create");
      return;
    }

    setSelectedRole(null); // ✅ create mode
    setDialogOpen(true);
  };

  const handleEdit = (role: Role) => {
    if (!canUpdate) {
      toast.error("You dont have permission to update");
      return;
    }

    setSelectedRole(role); // ✅ edit mode
    setDialogOpen(true);
  };

  const handleView = (role: Role) => {
    setSelectedRole(role);
    setViewDialogOpen(true);
  };

  const handleDeleteClick = (role: Role) => {
    if (!canDelete) {
      toast.error("You dont have permission to delete");
      return;
    }

    setSelectedRole(role); // ✅ set role for delete confirmation
    setDeleteDialogOpen(true); // ✅ open delete dialog (NOT RoleDialog)
  };

  const handleDelete = async () => {
    if (!selectedRole) return;

    try {
      await deleteRole(selectedRole.id); // ✅ number id
      toast.success("Role deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedRole(null);
    } catch (err) {
      toast.error("Failed to delete role");
    }
  };

  const handleSubmit = async (data: any) => {
    try {
      if (selectedRole) {
        await updateRole(selectedRole.id, {
          name: data.name,
          description: data.description,
          isActive: data.isActive,
        });
        toast.success("Role updated successfully");
      } else {
        await createRole(data);
        toast.success("Role created successfully");
      }

      setDialogOpen(false);
      setSelectedRole(null);
    } catch (err) {
      toast.error(selectedRole ? "Failed to update role" : "Failed to create role");
    }
  };

  // ✅ SAME loading handling as EmployeesPage
  if (loading && roles.length === 0) {
    return (
      <div className="flex items-center justify-center h-120">
        <Loader2 className="h-16 w-16 animate-spin text-purple-400 mx-auto  " />
      </div>
    );
  }

  return (
    <>
      <RoleTable
        data={roles}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
        onView={handleView}
        onCreate={handleCreate}
      />

      <RoleDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelectedRole(null); // ✅ cleanup on close
        }}
        role={selectedRole}
        onSubmit={handleSubmit}
      />

      <ViewRoleDialog
        open={viewDialogOpen}
        onOpenChange={(open) => {
          setViewDialogOpen(open);
          if (!open) setSelectedRole(null); // ✅ cleanup on close
        }}
        role={selectedRole}
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setSelectedRole(null); // ✅ cleanup on close
        }}
        onConfirm={handleDelete}
        roleName={selectedRole?.name || ""}
      />
    </>
  );
}