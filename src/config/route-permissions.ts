import { NAV_PERMISSIONS, navItems, type NavItem } from "@/config/menu.config";

export interface RouteRule {
  prefix: string;
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  role?: string;
  title?: string;
}

/**
 * Pages reached from a button elsewhere that are deliberately NOT in navItems,
 * because adding them there would change the roles dialog. Everything else is
 * derived from menu.config so the sidebar, the roles dialog, and this guard
 * can never disagree about which permission a page needs.
 */
const EXTRA_ROUTE_RULES: RouteRule[] = [
  {
    prefix: "/settings/payment-manager",
    permission: "settings:payment-manager",
  },
  {
    // Player Performance left the sidebar but kept its route, and a rule only
    // exists here for pages navItems no longer lists — without it the page
    // would fail open to anyone who types the URL.
    prefix: "/users/player-performance",
    permission: NAV_PERMISSIONS.USERS_PLAYER_LISTING,
    title: "Player Performance",
  },
];

const flatten = (items: NavItem[]): RouteRule[] =>
  items.flatMap((item) => [
    ...(item.url && (item.permission || item.permissions?.length || item.role)
      ? [
          {
            prefix: item.url,
            permission: item.permission,
            permissions: item.permissions,
            requireAll: item.requireAll,
            role: item.role,
            title: item.title,
          },
        ]
      : []),
    ...(item.items ? flatten(item.items) : []),
  ]);

/**
 * Longest prefix first, so `/wallet/manual-deposit-listing` wins over
 * `/wallet/manual-deposit` even though both are prefixes of the former.
 */
export const ROUTE_RULES: RouteRule[] = [
  ...flatten(navItems),
  ...EXTRA_ROUTE_RULES,
].sort((a, b) => b.prefix.length - a.prefix.length);

/**
 * Segment-boundary prefix match: `/users/players-list/jane` inherits the
 * `/users/players-list` rule, but `/users/players-listing` would not.
 * Routes with no rule (dashboard, profile-setting) fail open by design.
 */
export const findRouteRule = (pathname: string): RouteRule | undefined =>
  ROUTE_RULES.find(
    (rule) => pathname === rule.prefix || pathname.startsWith(rule.prefix + "/"),
  );
