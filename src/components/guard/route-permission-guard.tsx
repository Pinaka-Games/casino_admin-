"use client";
import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/hooks/user-permissions";
import { findRouteRule } from "@/config/route-permissions";

/**
 * Page-level companion to PermissionGuard: blocks a route the sidebar would
 * have hidden, so typing the URL is no longer a way around the menu filter.
 *
 * Mounted once in the (main) layout — pages need no individual wiring; any
 * page whose URL appears in menu.config (or EXTRA_ROUTE_RULES) is covered,
 * including ones added later.
 *
 * Permission checks come from `usePermissions`, NOT AuthContext, for the same
 * reason PermissionGuard uses it: only that hook grants a superadmin
 * everything, and the sidebar filter has always bypassed superadmins. Using
 * the other source would lock out exactly the people who can see every tab.
 *
 * Denied renders an in-place notice rather than redirecting: the URL stays in
 * the bar (no confusing bounce), and there is no redirect loop to reason about
 * if a landing page ever gains a rule of its own.
 */
export const RoutePermissionGuard = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();
  const { hasRole } = useAuth();
  const { hasPermission, hasAnyPermission, hasAllPermissions } =
    usePermissions();

  const rule = findRouteRule(pathname ?? "");

  let hasAccess = true;
  if (rule) {
    if (rule.role) {
      hasAccess = hasRole(rule.role);
    } else if (rule.permissions?.length) {
      hasAccess = rule.requireAll
        ? hasAllPermissions(rule.permissions)
        : hasAnyPermission(rule.permissions);
    } else if (rule.permission) {
      hasAccess = hasPermission(rule.permission);
    }
  }

  if (hasAccess) return <>{children}</>;

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-lg bg-[#191D24] px-8 py-10 text-center">
        <ShieldAlert size={44} className="text-[#B93DEB]" />
        <h1 className="text-lg font-semibold text-white">Access denied</h1>
        <p className="text-sm text-gray-400">
          Your account does not have permission to view
          {rule ? ` ${rule.title}` : " this page"}. Contact an administrator if
          you believe you should have access.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex h-9 items-center rounded-lg bg-[#B93DEB] px-4 text-sm text-white transition hover:bg-[#a234d1]"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
};
