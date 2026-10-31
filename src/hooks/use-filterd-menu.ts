import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { NavItem } from "@/config/menu.config";

export const useFilteredMenu = (items: NavItem[]): NavItem[] => {
  const {
    user,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    isHydrated,
  } = useAuth();

  const filterMenu = useMemo(() => {
    /**
     * Drop pages flagged `hiddenInSidebar` before anything else — they are
     * reached from a button elsewhere, and they must stay hidden for every
     * role, superadmin included. They remain in menu.config so the roles
     * dialog can still grant their permission.
     */
    const stripHidden = (menuItems: NavItem[]): NavItem[] =>
      menuItems
        .filter((item) => !item.hiddenInSidebar)
        .map((item) => ({
          ...item,
          items: item.items ? stripHidden(item.items) : undefined,
        }));

    const visible = stripHidden(items);

    // During SSR or before hydration
    if (!isHydrated) {
      return visible;
    }

    // 🔥 SUPER ADMIN BYPASS — SHOW ALL MENUS
    if (user?.roles?.some((role: any) => role.isActive && role.name === "superadmin")) {
      return visible;
    }

    const filter = (menuItems: NavItem[]): NavItem[] => {
      return menuItems
        .filter((item) => {
          // Role-based access
          if (item.role) {
            return hasRole(item.role);
          }

          // Multiple permissions
          if (item.permissions?.length) {
            return item.requireAll
              ? hasAllPermissions(item.permissions)
              : hasAnyPermission(item.permissions);
          }

          // Single permission
          if (item.permission) {
            return hasPermission(item.permission);
          }

          return true;
        })
        .map((item) => ({
          ...item,
          items: item.items ? filter(item.items) : undefined,
        }))
        // Remove parents with no visible children
        .filter((item) => !item.items || item.items.length > 0);
    };

    return filter(visible);
  }, [
    items,
    user,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    isHydrated,
  ]);

  return filterMenu;
};
