"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { usePermissions } from "@/hooks/user-permissions";
import { useAuth } from "@/context/AuthContext";
import { findRouteRule } from "@/config/route-permissions";

/**
 * Page-level enforcement of the same rules that drive the sidebar. The
 * sidebar only hides links; this stops an employee from opening a
 * permission-gated page by typing its URL.
 */
export default function RoutePermissionGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { hasPermission, hasAnyPermission, hasAllPermissions, isSuperAdmin } =
    usePermissions();
  const { user, hasRole, isHydrated } = useAuth();

  const isAllowed = (): boolean => {
    // Before the persisted session rehydrates there is nothing to check
    // against; MainLayout already blocks unauthenticated visitors.
    if (!isHydrated || !user) return true;
    if (isSuperAdmin) return true;

    const rule = findRouteRule(pathname ?? "");
    if (!rule) return true;

    if (rule.role) return hasRole(rule.role);
    if (rule.permissions?.length) {
      return rule.requireAll
        ? hasAllPermissions(rule.permissions)
        : hasAnyPermission(rule.permissions);
    }
    if (rule.permission) return hasPermission(rule.permission);
    return true;
  };

  const allowed = isAllowed();

  useEffect(() => {
    if (!allowed) {
      toast.error("You don't have permission to view this page");
      router.replace("/dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, pathname]);

  if (!allowed) return null;
  return <>{children}</>;
}
