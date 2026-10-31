'use client'
import { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/user-permissions';

interface PermissionGuardProps {
  children: ReactNode;
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  role?: string;
  fallback?: ReactNode;
}

/**
 * Permission checks come from `usePermissions`, NOT from AuthContext directly.
 *
 * Both expose a `hasPermission`, but only the `usePermissions` one grants a
 * superadmin everything — the AuthContext version is a bare list-membership
 * test. The sidebar has always used the bypassing kind
 * (`useFilteredMenu` returns every item for role `superadmin`), so guarding a
 * control with the AuthContext version hid it from exactly the people who could
 * see the matching menu entry.
 */
export const PermissionGuard = ({
  children,
  permission,
  permissions,
  requireAll = false,
  role,
  fallback = null,
}: PermissionGuardProps) => {
  const { hasRole } = useAuth();
  const { hasPermission, hasAnyPermission, hasAllPermissions } =
    usePermissions();

  let hasAccess = true;

  if (role) {
    hasAccess = hasRole(role);
  } else if (permission) {
    hasAccess = hasPermission(permission);
  } else if (permissions) {
    hasAccess = requireAll
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
};
