"use client";

import { useEffect, useState } from "react";
import { adminListPackages } from "@/api/package/admin-package.api";

/**
 * Whether the agent-package system is switched on at all.
 *
 * Mirrors the backend's `AgentPackageService.isPackagingDisabled()`: the
 * catalog is off when no package is active — exactly what the "disable all
 * packages" master switch in Settings > Agent Package Management produces, and
 * what deactivating the last remaining package produces too.
 *
 * In that state an agent's plan grants nothing: `getMyPackage()` returns null,
 * the ggrRates plan bonus stops applying and every feature gate is lifted. So
 * admin screens must not present the agent as being on a plan either.
 *
 * Returns `null` while undetermined — before the catalog has loaded, or when it
 * could not be read. Callers must treat `null` as "show everything", so a
 * failed lookup never blanks a working screen.
 */
export function useAgentPackagingEnabled(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    adminListPackages()
      .then((packages) => {
        if (!mounted) return;
        setEnabled((packages || []).some((p) => p.isActive));
      })
      .catch(() => {
        if (!mounted) return;
        setEnabled(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return enabled;
}
