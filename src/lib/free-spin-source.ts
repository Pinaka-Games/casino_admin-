/**
 * Maps a free-spin grant's `bonusLabel` (the audit trail recorded at grant time)
 * to a structured Source descriptor used by the admin UI for display + filtering.
 *
 * Label patterns used by the backend (must stay in sync with grant call sites):
 *   welcome-register:{userId}                    → Welcome (one-time, on signup)
 *   daily-streak:day-{N}                         → Streak (daily streak claim)
 *   subscription-buy:{planId}                    → Subscription (purchase)
 *   subscription-upgrade:{planId}                → Subscription (upgrade)
 *   vip-rankup:{tierName}-{level}                → VIP (rank-up)
 *   promo-code:{code}                            → Promo Code
 *   bundle-buy:{bundleId}                        → Bundle purchase
 *   weekly-subscription:{planId}                 → Weekly (cron)
 *   weekly-vip:{tierName}-{level}                → Weekly (cron)
 *   bulk-grant:{configId}                        → Bulk (admin batch grant)
 *   (anything else / null)                       → Manual (admin one-off)
 */

export type GrantSourceKind =
  | "welcome"
  | "streak"
  | "subscription"
  | "vip"
  | "promo"
  | "bundle"
  | "weekly"
  | "bulk"
  | "manual";

export interface GrantSource {
  kind: GrantSourceKind;
  label: string;
  /** Tailwind class fragment for badge background + foreground. */
  badgeClass: string;
  /** Optional secondary detail (e.g. "day 6", "plan-id"). */
  detail?: string;
}

const SOURCE_STYLES: Record<GrantSourceKind, { label: string; badgeClass: string }> = {
  welcome:      { label: "Welcome",      badgeClass: "bg-blue-500/20 text-blue-300" },
  streak:       { label: "Streak",       badgeClass: "bg-purple-500/20 text-purple-300" },
  subscription: { label: "Subscription", badgeClass: "bg-green-500/20 text-green-300" },
  vip:          { label: "VIP",          badgeClass: "bg-yellow-500/20 text-yellow-300" },
  promo:        { label: "Promo",        badgeClass: "bg-orange-500/20 text-orange-300" },
  bundle:       { label: "Bundle",       badgeClass: "bg-pink-500/20 text-pink-300" },
  weekly:       { label: "Weekly",       badgeClass: "bg-cyan-500/20 text-cyan-300" },
  bulk:         { label: "Bulk",         badgeClass: "bg-indigo-500/20 text-indigo-300" },
  manual:       { label: "Manual",       badgeClass: "bg-gray-500/20 text-gray-300" },
};

export function parseGrantSource(bonusLabel?: string | null): GrantSource {
  if (!bonusLabel) {
    return { kind: "manual", ...SOURCE_STYLES.manual };
  }

  const label = String(bonusLabel);

  // Order matters — `weekly-*` must be checked before `subscription-*` / `vip-*`.
  if (label.startsWith("welcome-register")) {
    return { kind: "welcome", ...SOURCE_STYLES.welcome };
  }
  if (label.startsWith("daily-streak")) {
    const day = label.match(/day-(\d+)/)?.[1];
    return {
      kind: "streak",
      ...SOURCE_STYLES.streak,
      detail: day ? `Day ${day}` : undefined,
    };
  }
  if (label.startsWith("weekly-subscription") || label.startsWith("weekly-vip")) {
    return { kind: "weekly", ...SOURCE_STYLES.weekly };
  }
  if (label.startsWith("subscription-buy") || label.startsWith("subscription-upgrade")) {
    return { kind: "subscription", ...SOURCE_STYLES.subscription };
  }
  if (label.startsWith("vip-rankup")) {
    return { kind: "vip", ...SOURCE_STYLES.vip };
  }
  if (label.startsWith("bundle-buy")) {
    return { kind: "bundle", ...SOURCE_STYLES.bundle };
  }
  if (label.startsWith("promo-code")) {
    return { kind: "promo", ...SOURCE_STYLES.promo };
  }
  if (label.startsWith("bulk-grant")) {
    return { kind: "bulk", ...SOURCE_STYLES.bulk };
  }

  return { kind: "manual", ...SOURCE_STYLES.manual };
}

/** Pre-computed list useful for filter dropdowns. */
export const GRANT_SOURCE_OPTIONS: { kind: GrantSourceKind; label: string }[] = (
  Object.entries(SOURCE_STYLES) as [GrantSourceKind, { label: string; badgeClass: string }][]
).map(([kind, { label }]) => ({ kind, label }));

/**
 * `bonus_label` prefixes behind each source badge.
 *
 * The server filters on these, so the mapping has to live next to
 * `parseGrantSource` — if a new trigger adds a label prefix, both the badge and
 * the filter come from the same place.
 */
export const SOURCE_LABEL_PREFIXES: Record<GrantSourceKind, string[]> = {
  welcome: ["welcome-register"],
  streak: ["daily-streak"],
  weekly: ["weekly-subscription", "weekly-vip"],
  subscription: ["subscription-buy", "subscription-upgrade"],
  vip: ["vip-rankup"],
  promo: ["promo-code"],
  bundle: ["bundle-buy"],
  bulk: ["bulk-grant"],
  manual: ["manual-admin"],
};
