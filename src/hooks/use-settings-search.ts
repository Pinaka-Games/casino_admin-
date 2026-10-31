"use client";

import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  SETTINGS_SEARCH_INDEX,
  searchSettings,
  type SettingsSearchEntry,
} from "@/config/settings-search";

/**
 * The search index narrowed to what this admin may actually open.
 *
 * Mirrors `useFilteredMenu` — same permission rules, same superadmin bypass —
 * so search results and the sidebar can never disagree about access. Before
 * hydration the index is empty rather than unfiltered: showing a destination
 * and then withdrawing it is worse than a beat of nothing.
 */
export const useSettingsSearchIndex = (): SettingsSearchEntry[] => {
  const {
    user,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    isHydrated,
  } = useAuth();

  return useMemo(() => {
    if (!isHydrated) return [];

    if (user?.roles?.some((role: any) => role.isActive && role.name === "superadmin")) {
      return SETTINGS_SEARCH_INDEX;
    }

    return SETTINGS_SEARCH_INDEX.filter((entry) => {
      if (entry.role) return hasRole(entry.role);
      if (entry.permissions?.length) {
        return entry.requireAll
          ? hasAllPermissions(entry.permissions)
          : hasAnyPermission(entry.permissions);
      }
      if (entry.permission) return hasPermission(entry.permission);
      return true;
    });
  }, [
    user,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    isHydrated,
  ]);
};

/** Ranked results for `query`, already permission-filtered. */
export const useSettingsSearch = (query: string): SettingsSearchEntry[] => {
  const index = useSettingsSearchIndex();
  return useMemo(() => searchSettings(index, query), [index, query]);
};
