"use client";

import { useEffect, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFreeSpinConfigStore } from "@/store/free-spin-config-store";
import { useFreeSpinWiringsStore } from "@/store/free-spin-wirings-store";

const NONE_VALUE = "__none";

interface Props {
  /** Selected FreeSpinConfig UUID, or null/empty when none. */
  value: string | null | undefined;
  /** Called with the new UUID, or null when "None" is picked. */
  onChange: (value: string | null) => void;
  /** Disabled state (e.g. parent toggle is off). */
  disabled?: boolean;
  /** Optional className for the trigger to fit the host layout. */
  triggerClassName?: string;
  /** Optional placeholder override. */
  placeholder?: string;
  /** When true, don't render the inactive-template warning text. */
  hideInactiveWarning?: boolean;
  /** When true, omit the "None" option (e.g. when parent is required). */
  required?: boolean;
  /**
   * Page-local IDs to hide from the dropdown — typically the templates
   * picked by SIBLING rows on the same page (e.g. other daily-streak rows,
   * other VIP tiers). The component already excludes globally-wired
   * templates via the wirings store; `excludeIds` complements that for
   * unsaved form-state picks. The current `value` is never excluded.
   */
  excludeIds?: Set<string> | string[];
  /**
   * IDs to keep visible even if they appear in the global wirings cache —
   * typically the picker owner's OWN server-side wiring(s). Without this,
   * after the admin moves their pick away from the original value, they
   * couldn't switch back (the original would be hidden as "wired").
   */
  includeIds?: Set<string> | string[];
}

/**
 * Single source of truth for picking a `FreeSpinConfig` template.
 *
 * Used everywhere the admin needs to wire a template to an automated trigger:
 *   • System Configuration → Bonus Defaults (Welcome Free Spin)
 *   • Settings → Daily Streak (Free Spin Day Multiplier)
 *   • VIP / Tier Rewards (per-tier VIP spin)
 *   • User / User Tier Management (per-plan Weekly Free Spins)
 *
 * Reads from `useFreeSpinConfigStore` so multiple pickers on the same page
 * share one fetched list (e.g. a long subscription-plans table with one
 * picker per row triggers a single API call, not N).
 *
 * The store holds ALL templates (active + inactive); we filter to active
 * here so admins only pick from currently-grantable templates. An already-
 * wired-but-now-inactive template still surfaces an inline warning.
 */
export function FreeSpinConfigSelect({
  value,
  onChange,
  disabled,
  triggerClassName,
  placeholder,
  hideInactiveWarning,
  required,
  excludeIds,
  includeIds,
}: Props) {
  // Subscribe to the store. Multiple <FreeSpinConfigSelect /> instances on
  // the same page share this state — only the FIRST one to mount triggers
  // the network fetch (see useEffect below).
  const allConfigs = useFreeSpinConfigStore((s) => s.configs);
  const loading = useFreeSpinConfigStore((s) => s.loading);
  const configsLoaded = useFreeSpinConfigStore((s) => s.configsLoaded);
  const fetchConfigs = useFreeSpinConfigStore((s) => s.fetchConfigs);

  // Wirings: which templates are already in use by another consumer surface.
  // Used to exclude them from the dropdown so admins can't wire the same
  // template twice across modules (welcome, streak, VIP, subscription).
  const wiredIds = useFreeSpinWiringsStore((s) => s.wiredIds);
  const loadWirings = useFreeSpinWiringsStore((s) => s.loadWirings);

  useEffect(() => {
    // Hydrate once per session. If the store already has rows from a
    // previous mount (e.g. user came from VIP / Spin Configuration), reuse
    // them. The cache is just for the in-memory session — there's no TTL
    // because admins seeing slightly stale active/inactive flags is
    // acceptable, and any save/delete elsewhere updates the same store.
    // Gate on configsLoaded, NOT configs.length — a legitimately empty
    // result (no templates created yet) leaves length at 0 forever, which
    // would re-fire the fetch on every render. configsLoaded flips true once
    // the first fetch settles (success or error), breaking the loop.
    if (!configsLoaded && !loading) {
      void fetchConfigs(false);
    }
    void loadWirings();
  }, [configsLoaded, loading, fetchConfigs, loadWirings]);

  const currentId = typeof value === "string" && value ? value : NONE_VALUE;
  // Look up the selected config across the FULL list (incl. inactive) so
  // we can warn the admin if they previously wired one that's now disabled.
  const selected = allConfigs.find((c) => c.id === currentId);

  // Normalize the optional set props into Sets for O(1) lookups.
  const localExcludeSet = useMemo(() => {
    if (!excludeIds) return null;
    return excludeIds instanceof Set ? excludeIds : new Set(excludeIds);
  }, [excludeIds]);
  const localIncludeSet = useMemo(() => {
    if (!includeIds) return null;
    return includeIds instanceof Set ? includeIds : new Set(includeIds);
  }, [includeIds]);

  // Active-only view for the dropdown options, filtered to exclude any
  // template already wired to ANOTHER consumer surface (via the wirings
  // store) plus any page-local exclusions (sibling rows). The current
  // value and any explicit `includeIds` are always preserved — admins
  // can see and re-select their own pick or other templates the parent
  // page knows it owns.
  const activeConfigs = useMemo(
    () =>
      allConfigs.filter((c) => {
        if (!c.isActive) return false;
        // Always-include cases first.
        if (c.id === currentId) return true;
        if (localIncludeSet?.has(c.id)) return true;
        // Then exclusions.
        if (wiredIds.has(c.id)) return false;
        if (localExcludeSet?.has(c.id)) return false;
        return true;
      }),
    [allConfigs, wiredIds, localExcludeSet, localIncludeSet, currentId],
  );

  return (
    <div className="space-y-1">
      <Select
        value={currentId}
        onValueChange={(next) => onChange(next === NONE_VALUE ? null : next)}
        disabled={disabled || (loading && allConfigs.length === 0)}
      >
        <SelectTrigger
          className={
            triggerClassName ??
            "w-full bg-[#242B35] border-[#2C323D] text-white"
          }
        >
          <SelectValue
            placeholder={
              loading && allConfigs.length === 0
                ? "Loading templates..."
                : placeholder ?? "Select a Free Spin template"
            }
          />
        </SelectTrigger>
        <SelectContent className="bg-[#242B35] border-[#2C323D] text-white">
          {!required && (
            <SelectItem value={NONE_VALUE}>None — feature inactive</SelectItem>
          )}
          {activeConfigs.map((cfg) => (
            <SelectItem key={cfg.id} value={cfg.id}>
              {cfg.name} — {cfg.numberOfFreeSpins} spins
              {cfg.softwareName ? ` · ${cfg.softwareName}` : ""}
              {cfg.gameName ? ` · ${cfg.gameName}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!loading && activeConfigs.length === 0 && (
        <p className="text-xs text-amber-400">
          No active templates. Create one under VIP / Spin Configuration first.
        </p>
      )}
      {!hideInactiveWarning && selected && !selected.isActive && (
        <p className="text-xs text-amber-400">
          Selected template is currently inactive — grants will be skipped.
        </p>
      )}
    </div>
  );
}
