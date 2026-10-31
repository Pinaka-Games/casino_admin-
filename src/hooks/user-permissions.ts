import { useAuth } from "@/context/AuthContext";
import { useMemo } from "react";

export function usePermissions() {
  const { user } = useAuth();

  /**
   * Active roles only. A deactivated role must not keep granting the access it
   * was deactivated to remove — the API already drops inactive roles when it
   * flattens permissions (jwt.strategy) and when it resolves superadmin
   * (SuperAdminGuard), so an unfiltered check here only ever showed controls
   * whose requests the server then rejected.
   */
  const activeRoles = useMemo(() => {
    if (!user?.roles || !Array.isArray(user.roles)) return [];
    return user.roles.filter((role: any) => role.isActive);
  }, [user]);

  /**
   * Check if user has superadmin role
   */
  const isSuperAdmin = useMemo(
    () => activeRoles.some((role: any) => role.name?.toLowerCase() === "superadmin"),
    [activeRoles]
  );

  /**
   * Extract all permissions from user's roles
   */
  const userPermissions = useMemo(() => {
    // If superadmin → no need to calculate permissions
    if (isSuperAdmin) {
      return new Set<string>(["*"]); // wildcard (optional)
    }

    const permissions = new Set<string>();

    activeRoles.forEach((role: any) => {
      if (role.permissions && Array.isArray(role.permissions)) {
        role.permissions.forEach((permission: any) => {
          permissions.add(permission.name);
        });
      }
    });

    return permissions;
  }, [activeRoles, isSuperAdmin]);

  /**
   * Check if user has a specific permission
   */
  const hasPermission = (permissionName: string): boolean => {
    if (isSuperAdmin) return true;
    return userPermissions.has(permissionName);
  };

  /**
   * Check if user has any of the specified permissions
   */
  const hasAnyPermission = (permissionNames: string[]): boolean => {
    if (isSuperAdmin) return true;
    return permissionNames.some((permission) =>
      userPermissions.has(permission)
    );
  };

  /**
   * Check if user has all of the specified permissions
   */
  const hasAllPermissions = (permissionNames: string[]): boolean => {
    if (isSuperAdmin) return true;
    return permissionNames.every((permission) =>
      userPermissions.has(permission)
    );
  };

  /**
   * Check if user can perform action on resource
   */
  const can = (resource: string, action: string): boolean => {
    if (isSuperAdmin) return true;
    return userPermissions.has(`${resource}:${action}`);
  };

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    can,
    permissions: userPermissions,
    isSuperAdmin,
  };
}
