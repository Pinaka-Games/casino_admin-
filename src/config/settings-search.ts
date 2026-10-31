/**
 * Flat, searchable index of everything an admin can navigate to.
 *
 * Two layers, so a search for "maintenance" lands on the actual toggle rather
 * than only on the page that contains it:
 *
 *   • page    — every destination in the sidebar (menu.config `navItems`)
 *   • setting — every individual field on System Configuration
 *               (`SECTION_DEFINITIONS`), deep-linked with ?setting=<path>
 *
 * Both layers carry the same permission metadata the sidebar uses, so the
 * search can never offer a destination the signed-in admin cannot open.
 *
 * The index is derived, not hand-maintained: adding a menu entry or a config
 * field makes it searchable automatically.
 */

import { NAV_PERMISSIONS, navItems, type NavItem } from "@/config/menu.config";
import { SECTION_DEFINITIONS } from "@/config/system-config-sections";

export type SettingsSearchKind = "page" | "setting";

export type SettingsSearchEntry = {
  id: string;
  /** What the admin reads as the result headline. */
  title: string;
  /** Where it lives, e.g. "System Settings › System Configuration". */
  breadcrumb: string;
  href: string;
  kind: SettingsSearchKind;
  /** Extra terms that should match this entry (slug words, synonyms). */
  keywords: string[];
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  role?: string;
};

/** Query-string key the deep link uses to point at one field. */
export const SETTING_QUERY_PARAM = "setting";

/** Stable DOM id for a System Configuration field, shared by link and page. */
export const settingAnchorId = (path: string) =>
  `setting-${path.replace(/[^a-zA-Z0-9]+/g, "-")}`;

/**
 * Words an admin is likely to type that don't appear in a title. Keyed by the
 * destination url so the aliases survive a rename of the menu label.
 */
const URL_ALIASES: Record<string, string[]> = {
  "/users/players-list": ["player", "customer", "account", "member"],
  "/users/player-performance": [
    "performance",
    "leaderboard",
    "top player",
    "whale",
    "most active",
    "biggest winner",
    "ggr",
  ],
  "/users/kyc-listing": ["kyc", "verification", "identity", "document"],
  "/users/seon-risk-listing": ["seon", "fraud", "risk", "aml"],
  "/users/agent-listing": ["affiliate", "partner"],
  "/wallet/user-deposit-logs": ["deposit", "payin", "funding", "purchase"],
  "/wallet/withdrawal-listing": ["withdraw", "payout", "cashout", "redeem"],
  "/wallet/withdraw-logs": ["withdraw", "payout", "cashout"],
  "/settings/redeem-requests": ["redeem", "withdraw", "payout"],
  "/settings/payment-processor-management": [
    "payment",
    "gateway",
    "processor",
    "coinflow",
    "breeze",
  ],
  "/settings/payment-manager": ["payment", "gateway", "rail", "coinflow", "breeze"],
  "/wallet/tax-forms": ["tax", "w9", "1099"],
  "/wallet/tax-generation": ["tax", "w9", "1099"],
  "/settings/spin-config": ["tax", "w9", "form"],
  "/settings/system-configuration": ["config", "system", "flag", "toggle"],
  // The Marketing & analytics tab lives on this page rather than in System
  // Configuration, so its fields are not picked up by the config-section
  // indexer below. Without these words, searching "clarity" or "pixel" finds
  // nothing at all.
  "/settings/integration-health": [
    "integration",
    "health",
    "uptime",
    "provider",
    "marketing",
    "analytics",
    "tracking",
    "pixel",
    "clarity",
    "ga4",
    "google analytics",
    "tag manager",
    "gtm",
    "meta",
    "facebook",
    "search console",
  ],
  "/settings/home-page": ["home", "layout", "menu", "sidebar", "category", "collection"],
  "/settings/sidebar-menus": ["sidebar", "menu", "navigation"],
  "/settings/modal-management": ["modal", "popup", "sequence"],
  "/settings/personalization": ["personalization", "recommendation"],
  "/settings/banners": ["banner", "poster", "creative", "artwork"],
  "/settings/cashbundle": ["bundle", "package", "coin", "store", "shop"],
  "/settings/promo-code-listing": ["promo", "coupon", "voucher", "code"],
  "/settings/daily-streak": ["streak", "daily", "login reward"],
  "/settings/race-contests": ["race", "contest", "leaderboard", "tournament"],
  "/settings/medal-listing": ["medal", "achievement", "badge", "side hustle"],
  "/admin/access-control": ["role", "permission", "access", "rbac"],
  "/admin/employee-list": ["staff", "employee", "user admin"],
  "/report/user-win-loss-detail": ["ggr", "win", "loss", "revenue"],
  "/report/game-report": ["ggr", "game", "revenue"],
  "/report/instant-rebate-logs": ["rebate", "cashback"],
  "/vip-tier/tier-management": ["vip", "tier", "loyalty", "level"],
  "/lucky-draw/vip-lucky-spin": ["free spin", "spin", "lucky draw"],
};

/** Split a url or dotted path into searchable words. */
const slugWords = (value: string) =>
  value
    .split(/[/.\-_]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 1);

const permissionMeta = (item: NavItem) => ({
  permission: item.permission,
  permissions: item.permissions,
  requireAll: item.requireAll,
  role: item.role,
});

/** Sidebar destinations. Groups contribute their children, not themselves. */
const buildPageEntries = (): SettingsSearchEntry[] => {
  const entries: SettingsSearchEntry[] = [];

  const visit = (item: NavItem, trail: string[]) => {
    const children = item.items ?? [];

    if (children.length > 0) {
      children.forEach((child) => visit(child, [...trail, item.title]));
      // A group that also has its own url stays reachable in its own right.
      if (!item.url) return;
    }

    if (!item.url) return;

    entries.push({
      id: `page:${item.url}`,
      title: item.title,
      breadcrumb: trail.length ? trail.join(" › ") : "Menu",
      href: item.url,
      kind: "page",
      keywords: [...slugWords(item.url), ...(URL_ALIASES[item.url] ?? [])],
      ...permissionMeta(item),
    });
  };

  navItems.forEach((item) => visit(item, []));
  return entries;
};

/** Every individual field on the System Configuration page. */
const buildSystemConfigEntries = (): SettingsSearchEntry[] =>
  SECTION_DEFINITIONS.flatMap((section) =>
    section.fields.map((field) => ({
      id: `setting:${field.path}`,
      title: field.label,
      breadcrumb: `System Settings › System Configuration › ${section.title}`,
      href: `/settings/system-configuration?${SETTING_QUERY_PARAM}=${encodeURIComponent(
        field.path,
      )}`,
      kind: "setting" as const,
      keywords: [...slugWords(field.path), ...slugWords(section.title)],
      permission: NAV_PERMISSIONS.SETTINGS_SYSTEM_CONFIGURATION,
    })),
  );

/**
 * The complete index. Built once at module load — both sources are static
 * config, so there is nothing to recompute per render.
 */
export const SETTINGS_SEARCH_INDEX: SettingsSearchEntry[] = [
  ...buildPageEntries(),
  ...buildSystemConfigEntries(),
];

/**
 * Score `entry` against a lower-cased query. Higher is better; 0 means no
 * match, so the caller drops it.
 *
 * The ranking is deliberately simple and predictable: an exact title beats a
 * title prefix, which beats a word prefix, which beats any substring, and a
 * keyword/breadcrumb hit always ranks below a title hit. Pages outrank
 * individual settings on equal footing, since a page is the broader answer.
 */
export const scoreEntry = (entry: SettingsSearchEntry, query: string): number => {
  const title = entry.title.toLowerCase();
  if (title === query) return 1000;
  if (title.startsWith(query)) return 800;

  const titleWords = title.split(/\s+/);
  if (titleWords.some((word) => word.startsWith(query))) return 600;
  if (title.includes(query)) return 400;

  // Initials: "wld" finds "Withdraw Logs Detail".
  const initials = titleWords.map((word) => word[0]).join("");
  if (query.length > 1 && initials.startsWith(query)) return 350;

  if (entry.breadcrumb.toLowerCase().includes(query)) return 200;
  if (entry.keywords.some((keyword) => keyword.startsWith(query))) return 180;
  if (entry.keywords.some((keyword) => keyword.includes(query))) return 120;

  return 0;
};

/**
 * Rank `entries` for `rawQuery`. Every whitespace-separated term must match
 * something, so "payment manager" narrows instead of widening.
 */
export const searchSettings = (
  entries: SettingsSearchEntry[],
  rawQuery: string,
  limit = 30,
): SettingsSearchEntry[] => {
  const terms = rawQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  return entries
    .map((entry) => {
      let total = 0;
      for (const term of terms) {
        const score = scoreEntry(entry, term);
        if (score === 0) return null;
        total += score;
      }
      // Pages edge out settings when both match equally well.
      return { entry, score: total + (entry.kind === "page" ? 25 : 0) };
    })
    .filter((hit): hit is { entry: SettingsSearchEntry; score: number } => hit !== null)
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
    .slice(0, limit)
    .map((hit) => hit.entry);
};
