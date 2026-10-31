import { create } from "zustand";
import { systemConfigApi } from "@/api/system-config/system-config.api";
import { dailyStreakAdminApi } from "@/api/daily-streak/daily-streak";
import { vipTierApi } from "@/api/vip-tier/vip-tier-api";
import { adminListPlans } from "@/api/subscription/admin-subscription.api";
import { cashBundleApi } from "@/api/cashbundle/cashbundle.api";

/** Surfaces that can wire a FreeSpinConfig template. Match the badge labels
 *  in the VIP / Spin Configuration table so admins recognize the source. */
export type WiredAs = "welcome" | "streak" | "vip" | "subscription" | "bundle";

interface FreeSpinWiringsState {
  /** configId → list of distinct surfaces it's wired to. Empty list means "not wired". */
  wiredMap: Record<string, WiredAs[]>;
  /** Set of configIds wired anywhere — for fast O(1) "is this template in use?" checks. */
  wiredIds: Set<string>;
  loaded: boolean;
  loading: boolean;
  /** Idempotent on default; pass `force: true` after a save to re-sync. */
  loadWirings: (force?: boolean) => Promise<void>;
}

/**
 * Centralized cache of "which FreeSpinConfig templates are currently wired
 * to which automated triggers". Populated by fanning out reads to four
 * admin endpoints (system config, daily streak, VIP tiers, subscription
 * plans). Same pattern used previously inline in the lucky-draw page —
 * lifted here so:
 *
 *   • the table that renders "Wired As" badges, AND
 *   • the FreeSpinConfigSelect dropdown that excludes already-wired templates
 *
 * share one fetched view of wirings instead of each refetching.
 *
 * Wirings change only when an admin saves on a consumer surface (system
 * config, daily streak, VIP tier, subscription plan). Those save handlers
 * should call `useFreeSpinWiringsStore.getState().loadWirings(true)` after
 * a successful save to keep this cache fresh.
 */
export const useFreeSpinWiringsStore = create<FreeSpinWiringsState>((set, get) => ({
  wiredMap: {},
  wiredIds: new Set<string>(),
  loaded: false,
  loading: false,

  loadWirings: async (force = false) => {
    const { loaded, loading } = get();
    if (!force && (loaded || loading)) return;
    set({ loading: true });
    try {
      // Failures degrade silently — a missing source just means we don't
      // surface badges from it. Better than blocking the picker on one
      // flaky endpoint.
      const [systemConfig, streakConfig, vipTiersRes, subPlans, bundles] = await Promise.all([
        systemConfigApi.get().catch(() => null),
        dailyStreakAdminApi.getConfig().then((r) => r.data).catch(() => null),
        vipTierApi.getAll(null).catch(() => null),
        adminListPlans().catch(() => [] as Awaited<ReturnType<typeof adminListPlans>>),
        cashBundleApi.getAll().catch(() => []),
      ]);

      const next: Record<string, WiredAs[]> = {};
      const addWiring = (id: string | null | undefined, kind: WiredAs) => {
        if (!id) return;
        const existing = next[id] ?? [];
        if (!existing.includes(kind)) next[id] = [...existing, kind];
      };

      // Welcome free spin — system config singleton
      const welcomeId =
        (systemConfig?.config?.bonus_defaults as
          | { welcome_free_spin_config_id?: string | null }
          | undefined
        )?.welcome_free_spin_config_id ?? null;
      addWiring(welcomeId, "welcome");

      // Daily streak: BOTH per-row pickers (post-refactor) and the legacy
      // streak-level config id — so existing setups that haven't been
      // re-saved against the new model still surface as wired.
      addWiring(streakConfig?.freeSpinConfigId ?? null, "streak");
      const streakRows: Array<{ rewardType?: string; freeSpinConfigId?: string | null }> =
        streakConfig?.rewards ?? [];
      for (const row of streakRows) {
        if (row?.rewardType === "FREE_SPIN") {
          addWiring(row.freeSpinConfigId ?? null, "streak");
        }
      }

      // VIP tiers — any tier with vipSpin.freeSpinConfigId set is a live
      // consumer (rank-up trigger + weekly cron).
      const vipTiers = vipTiersRes?.data ?? [];
      for (const tier of vipTiers) {
        addWiring(
          tier?.tierRewards?.vipSpin?.freeSpinConfigId ?? null,
          "vip",
        );
      }

      // Subscription plans — features.freeSpinConfigId on each plan.
      for (const plan of subPlans ?? []) {
        addWiring(
          (plan?.features as { freeSpinConfigId?: string })?.freeSpinConfigId ?? null,
          "subscription",
        );
      }

      // Cash bundles — freeSpinConfigId granted on every purchase.
      for (const bundle of bundles ?? []) {
        addWiring(bundle?.freeSpinConfigId ?? null, "bundle");
      }

      set({
        wiredMap: next,
        wiredIds: new Set(Object.keys(next)),
        loaded: true,
        loading: false,
      });
    } catch (error) {
      console.error("Failed to load free-spin wirings", error);
      set({ loading: false });
    }
  },
}));
