import React, { useEffect, useState } from "react";
import { Loader2, Search, Shield, Lock, Unlock, X } from "lucide-react";
import { usePermissionStore } from "@/store/permission-store";
import { useRolesStore } from "@/store/role-store";
import { Permission } from "@/types/permission.types";
import { Role } from "@/types/role.type";
import toast from "react-hot-toast";
import { useAuthStore } from "@/store/auth-store";
import { navItems, type NavItem } from "@/config/menu.config";

interface RolePermissionsDialogProps {
  role: Role | null;
  open: boolean;
  onClose: () => void;
}

interface PermissionGroup {
  key: string;
  title: string;
  permissions: Permission[];
}

/**
 * One id for every save outcome in this dialog, so a rapid assign-then-revoke
 * replaces the previous notice in place instead of stacking two toasts that
 * disagree about what just happened.
 */
const PERMISSION_SAVE_TOAST = "role-permission-save";

const formatTitle = (value: string) =>
  value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const extractNavPermissions = (item: NavItem): string[] => {
  const directPermissions = [
    ...(item.permission ? [item.permission] : []),
    ...(item.permissions ?? []),
  ];

  const childPermissions =
    item.items?.flatMap((child) => extractNavPermissions(child)) ?? [];

  return [...directPermissions, ...childPermissions];
};

const permissionCategoryMap = (() => {
  const map = new Map<string, string>();

  navItems.forEach((item) => {
    if (!item.title || !item.items?.length) return;

    const categoryTitle = item.title;
    const permissions = extractNavPermissions(item);

    permissions.forEach((permissionName) => {
      if (permissionName.startsWith("employees:")) {
        map.set(permissionName, "Employees");
        return;
      }

      if (permissionName.startsWith("roles:")) {
        map.set(permissionName, "Roles");
        return;
      }

      map.set(permissionName, categoryTitle);
    });
  });

  return map;
})();

const permissionDisplayOrder = (() => {
  const map = new Map<string, number>();
  let index = 0;

  navItems.forEach((item) => {
    item.items?.forEach((child) => {
      const childPermissions = extractNavPermissions(child);

      childPermissions.forEach((permissionName) => {
        if (!map.has(permissionName)) {
          map.set(permissionName, index++);
        }
      });
    });
  });

  return map;
})();

const categoryOrder = [
  "Employees",
  "Roles",
  ...navItems
    .filter((item) => item.title !== "Dashboard")
    .map((item) => item.title)
    .filter((title) => title !== "Staff & Access"),
];

export function RolePermissionsDialog({
  role,
  open,
  onClose,
}: RolePermissionsDialogProps) {
  const [assignedPermissions, setAssignedPermissions] = useState<Permission[]>(
    [],
  );
  const [unassignedPermissions, setUnassignedPermissions] = useState<
    Permission[]
  >([]);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<number>>(
    new Set(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"assigned" | "unassigned">(
    "assigned",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { fetchByRole, fetchUnassignedForRole } = usePermissionStore();
  const { assignPermissions, removePermissions } = useRolesStore();

  const { refreshMe } = useAuthStore();

  useEffect(() => {
    if (open && role) {
      loadPermissions();
    } else {
      resetState();
    }
  }, [open, role]);

  const loadPermissions = async ({ silent = false } = {}) => {
    if (!role) return;
    setIsLoading(true);
    try {
      const [assigned, unassigned] = await Promise.all([
        fetchByRole(role.id),
        fetchUnassignedForRole(role.id),
      ]);
      setAssignedPermissions(assigned);
      setUnassignedPermissions(unassigned);
    } catch (error: any) {
      // Silent when this is the refresh that follows a save: the save already
      // reported its own outcome, and a second, contradicting toast ("assigned
      // successfully" then "failed to load") is what made the feedback here
      // look unreliable.
      if (!silent) toast.error("Failed to load permissions");
    } finally {
      setIsLoading(false);
    }
  };

  const resetState = () => {
    setAssignedPermissions([]);
    setUnassignedPermissions([]);
    setSelectedPermissions(new Set());
    setSearchQuery("");
    setActiveTab("assigned");
  };

  const handleCheckboxChange = (permissionId: number, checked: boolean) => {
    setSelectedPermissions((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(permissionId);
      } else {
        newSet.delete(permissionId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (permissions: Permission[], checked: boolean) => {
    setSelectedPermissions((prev) => {
      const newSet = new Set(prev);
      permissions.forEach((p) => {
        if (checked) {
          newSet.add(p.id);
        } else {
          newSet.delete(p.id);
        }
      });
      return newSet;
    });
  };

  const handleSelectResource = (
    permissions: Permission[],
    checked: boolean,
  ) => {
    setSelectedPermissions((prev) => {
      const newSet = new Set(prev);
      permissions.forEach((p) => {
        if (checked) {
          newSet.add(p.id);
        } else {
          newSet.delete(p.id);
        }
      });
      return newSet;
    });
  };

  const handleAssignPermissions = async () => {
    if (!role || selectedPermissions.size === 0) {
      toast.error("Select at least one permission to assign", {
        id: PERMISSION_SAVE_TOAST,
      });
      return;
    }
    const count = selectedPermissions.size;
    setIsSaving(true);
    try {
      await assignPermissions(role.id, Array.from(selectedPermissions));
      toast.success(
        `${count} permission${count === 1 ? "" : "s"} assigned to ${role.name}`,
        { id: PERMISSION_SAVE_TOAST },
      );
      setSelectedPermissions(new Set());
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to assign permissions",
        { id: PERMISSION_SAVE_TOAST },
      );
    } finally {
      setIsSaving(false);
    }

    // Re-read after the outcome is reported, so a slow or failing refresh can
    // never overwrite the toast for the write itself.
    await loadPermissions({ silent: true });
    await refreshMe();
  };

  const handleRemovePermissions = async () => {
    if (!role || selectedPermissions.size === 0) {
      toast.error("Select at least one permission to revoke", {
        id: PERMISSION_SAVE_TOAST,
      });
      return;
    }
    const count = selectedPermissions.size;
    setIsSaving(true);
    try {
      await removePermissions(role.id, Array.from(selectedPermissions));
      toast.success(
        `${count} permission${count === 1 ? "" : "s"} revoked from ${role.name}`,
        { id: PERMISSION_SAVE_TOAST },
      );
      setSelectedPermissions(new Set());
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to remove permissions",
        { id: PERMISSION_SAVE_TOAST },
      );
    } finally {
      setIsSaving(false);
    }

    await loadPermissions({ silent: true });
    await refreshMe();
  };

  const filterPermissions = (permissions: Permission[]) => {
    if (!searchQuery.trim()) return permissions;
    const query = searchQuery.toLowerCase();
    return permissions.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.resource.toLowerCase().includes(query) ||
        p.action.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query)),
    );
  };

  const groupPermissions = (permissions: Permission[]) => {
    const grouped = permissions.reduce(
      (acc, permission) => {
        const category =
          permissionCategoryMap.get(permission.name) ??
          formatTitle(permission.resource);

        if (!acc[category]) {
          acc[category] = [];
        }

        acc[category].push(permission);
        return acc;
      },
      {} as Record<string, Permission[]>,
    );

    return Object.entries(grouped)
      .sort(([categoryA], [categoryB]) => {
        const indexA = categoryOrder.indexOf(categoryA);
        const indexB = categoryOrder.indexOf(categoryB);

        if (indexA === -1 && indexB === -1) {
          return categoryA.localeCompare(categoryB);
        }

        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      })
      .map(([category, permissionsInCategory]) => ({
        key: category.toLowerCase().replace(/\s+/g, "-"),
        title: category,
        permissions: permissionsInCategory.sort((a, b) => {
          const orderA = permissionDisplayOrder.get(a.name);
          const orderB = permissionDisplayOrder.get(b.name);

          if (orderA !== undefined && orderB !== undefined) {
            return orderA - orderB;
          }

          if (orderA !== undefined) return -1;
          if (orderB !== undefined) return 1;

          return a.description.localeCompare(b.description);
        }),
      })) as PermissionGroup[];
  };

  const getResourceSelectionState = (permissions: Permission[]) => {
    const selectedCount = permissions.filter((p) =>
      selectedPermissions.has(p.id),
    ).length;
    if (selectedCount === 0) return "none";
    if (selectedCount === permissions.length) return "all";
    return "partial";
  };

  const filteredAssigned = filterPermissions(assignedPermissions);
  const filteredUnassigned = filterPermissions(unassignedPermissions);
  const groupedAssigned = groupPermissions(filteredAssigned);
  const groupedUnassigned = groupPermissions(filteredUnassigned);

  const selectedCount = selectedPermissions.size;
  const canAssign = activeTab === "unassigned" && selectedCount > 0;
  const canRemove = activeTab === "assigned" && selectedCount > 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4">
      <div className="w-full max-w-7xl bg-[#1A1F28] text-white rounded-none sm:rounded-lg shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[90vh]">
        {/* Header */}
        <div className="border-b border-gray-800 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 shrink-0" />
              <h2 className="text-sm sm:text-lg font-semibold truncate">
                Manage Permissions - {role?.name}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-gray-800 rounded-lg shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-4 sm:px-6 py-4 sm:py-5">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-10 w-10 animate-spin text-purple-400" />
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0 space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search permissions by name, resource, or action..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-[#242B35] border border-gray-700 rounded-lg text-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Tabs */}
              <div className="bg-[#242B35] rounded-lg p-1 flex gap-1">
                <button
                  onClick={() => {
                    setActiveTab("assigned");
                    setSelectedPermissions(new Set());
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-4 rounded-md transition-colors text-xs sm:text-sm ${
                    activeTab === "assigned"
                      ? "bg-purple-500 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Lock className="h-4 w-4" />
                  <span className="font-medium">
                    Assigned ({assignedPermissions.length})
                  </span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab("unassigned");
                    setSelectedPermissions(new Set());
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-4 rounded-md transition-colors text-xs sm:text-sm ${
                    activeTab === "unassigned"
                      ? "bg-purple-500 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Unlock className="h-4 w-4" />
                  <span className="font-medium">
                    Unassigned ({unassignedPermissions.length})
                  </span>
                </button>
              </div>

              {/* Content Area */}
              <div className="flex-1 min-h-0 border border-gray-700 rounded-lg bg-[#1a2030] p-3 sm:p-5 overflow-y-auto scrollbar-hide">
                {activeTab === "assigned" ? (
                  groupedAssigned.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                      <Lock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No assigned permissions found</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Select All */}
                      <div className="flex items-center gap-2.5 pb-3 border-b border-gray-700">
                        <input
                          type="checkbox"
                          id="select-all-assigned"
                          checked={
                            filteredAssigned.length > 0 &&
                            filteredAssigned.every((p) =>
                              selectedPermissions.has(p.id),
                            )
                          }
                          onChange={(e) =>
                            handleSelectAll(filteredAssigned, e.target.checked)
                          }
                          className="w-4 h-4 rounded border-gray-600 bg-transparent accent-purple-500 cursor-pointer"
                        />
                        <label
                          htmlFor="select-all-assigned"
                          className="text-sm font-medium cursor-pointer"
                        >
                          Select All ({filteredAssigned.length})
                        </label>
                        {selectedCount > 0 && (
                          <span className="ml-auto text-xs text-purple-400 bg-purple-500/20 px-3 py-1 rounded-full">
                            {selectedCount} selected
                          </span>
                        )}
                      </div>

                      {/* Grouped Permissions - Grid Layout */}
                      {groupedAssigned.map((group) => {
                        const { key, title, permissions } = group;
                          const selectionState =
                            getResourceSelectionState(permissions);
                          const resourceSelectedCount = permissions.filter(
                            (p) => selectedPermissions.has(p.id),
                          ).length;

                          return (
                            <div key={key} className="space-y-3">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`resource-assigned-${key}`}
                                  checked={selectionState === "all"}
                                  ref={(el) => {
                                    if (el)
                                      el.indeterminate =
                                        selectionState === "partial";
                                  }}
                                  onChange={(e) =>
                                    handleSelectResource(
                                      permissions,
                                      e.target.checked,
                                    )
                                  }
                                  className="w-4 h-4 rounded border-gray-600 bg-transparent accent-purple-500 cursor-pointer"
                                />
                                <label
                                  htmlFor={`resource-assigned-${key}`}
                                  className="flex items-center gap-2 cursor-pointer"
                                >
                                  <span className="px-2.5 py-1 text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full">
                                    {title}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {permissions.length} permission(s)
                                  </span>
                                  {resourceSelectedCount > 0 && (
                                    <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                                      {resourceSelectedCount} selected
                                    </span>
                                  )}
                                </label>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                                {permissions.map((permission) => (
                                  <div
                                    key={permission.id}
                                    className="flex items-center justify-between gap-2 sm:gap-4 p-2.5 sm:p-3 rounded-lg bg-[#242B35] hover:bg-[#2a3040] transition-colors"
                                  >
                                    {/* Left: Permission description */}
                                    <div className="flex-1 min-w-0">
                                      {permission.description && (
                                        <p className="text-sm text-white line-clamp-2">
                                          {permission.description}
                                        </p>
                                      )}
                                    </div>

                                    {/* Right: Revoke + Checkbox */}
                                    <label
                                      htmlFor={`assigned-${permission.id}`}
                                      className="flex items-center gap-2 cursor-pointer text-sm font-medium text-red-400 hover:text-red-300 whitespace-nowrap"
                                    >
                                      <input
                                        type="checkbox"
                                        id={`assigned-${permission.id}`}
                                        checked={selectedPermissions.has(
                                          permission.id,
                                        )}
                                        onChange={(e) =>
                                          handleCheckboxChange(
                                            permission.id,
                                            e.target.checked,
                                          )
                                        }
                                        className="w-4 h-4 rounded border-gray-600 bg-transparent accent-purple-500 cursor-pointer"
                                      />
                                      Revoke
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )
                ) : groupedUnassigned.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <Unlock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No unassigned permissions found</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Select All */}
                    <div className="flex items-center gap-2.5 pb-3 border-b border-gray-700">
                      <input
                        type="checkbox"
                        id="select-all-unassigned"
                        checked={
                          filteredUnassigned.length > 0 &&
                          filteredUnassigned.every((p) =>
                            selectedPermissions.has(p.id),
                          )
                        }
                        onChange={(e) =>
                          handleSelectAll(filteredUnassigned, e.target.checked)
                        }
                        className="w-4 h-4 rounded border-gray-600 bg-transparent accent-purple-500 cursor-pointer"
                      />
                      <label
                        htmlFor="select-all-unassigned"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Select All ({filteredUnassigned.length})
                      </label>
                      {selectedCount > 0 && (
                        <span className="ml-auto text-xs text-purple-400 bg-purple-500/20 px-3 py-1 rounded-full">
                          {selectedCount} selected
                        </span>
                      )}
                    </div>

                    {/* Grouped Permissions - Grid Layout */}
                    {groupedUnassigned.map((group) => {
                        const { key, title, permissions } = group;
                        const selectionState =
                          getResourceSelectionState(permissions);
                        const resourceSelectedCount = permissions.filter((p) =>
                          selectedPermissions.has(p.id),
                        ).length;

                        return (
                          <div key={key} className="space-y-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`resource-unassigned-${key}`}
                                checked={selectionState === "all"}
                                ref={(el) => {
                                  if (el)
                                    el.indeterminate =
                                      selectionState === "partial";
                                }}
                                onChange={(e) =>
                                  handleSelectResource(
                                    permissions,
                                    e.target.checked,
                                  )
                                }
                                className="w-4 h-4 rounded border-gray-600 bg-transparent accent-purple-500 cursor-pointer"
                              />
                              <label
                                htmlFor={`resource-unassigned-${key}`}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <span className="px-2.5 py-1 text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full">
                                  {title}
                                </span>

                                {resourceSelectedCount > 0 && (
                                  <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                                    {resourceSelectedCount} selected
                                  </span>
                                )}
                              </label>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                              {permissions.map((permission) => (
                                <div
                                  key={permission.id}
                                  className="flex items-center justify-between gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg bg-[#242B35] hover:bg-[#2a3040] transition-colors"
                                >
                                  {/* LEFT: Description */}
                                  <div className="min-w-0">
                                    {permission.description && (
                                      <span className="text-sm text-white line-clamp-2">
                                        {permission.description}
                                      </span>
                                    )}
                                  </div>

                                  {/* RIGHT: Allow + Checkbox */}
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <input
                                      type="checkbox"
                                      id={`unassigned-${permission.id}`}
                                      checked={selectedPermissions.has(
                                        permission.id,
                                      )}
                                      onChange={(e) =>
                                        handleCheckboxChange(
                                          permission.id,
                                          e.target.checked,
                                        )
                                      }
                                      className="w-4 h-4 rounded border-gray-600 bg-transparent accent-purple-500 cursor-pointer"
                                    />
                                    <label
                                      htmlFor={`unassigned-${permission.id}`}
                                      className="text-sm font-medium cursor-pointer text-green-400"
                                    >
                                      Allow
                                    </label>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Selection Info */}
              {selectedCount > 0 && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <span className="text-sm text-purple-300">
                    {selectedCount} permission(s) selected
                  </span>
                  <button
                    onClick={() => setSelectedPermissions(new Set())}
                    className="text-xs text-purple-400 hover:text-purple-300 underline self-end sm:self-auto"
                  >
                    Clear selection
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row justify-start gap-2 sm:gap-3">
            {canRemove && (
              <button
                onClick={handleRemovePermissions}
                disabled={isSaving}
                className="w-full sm:w-auto px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    Remove Selected{" "}
                    {selectedCount === 1 ? "Permission" : "Permissions"} (
                    {selectedCount})
                  </>
                )}
              </button>
            )}
            {canAssign && (
              <button
                onClick={handleAssignPermissions}
                disabled={isSaving}
                className="w-full sm:w-auto px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    Assign Selected{" "}
                    {selectedCount === 1 ? "Permission" : "Permissions"} (
                    {selectedCount})
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
