import { getSidebarTree } from "@/api/sidebar/sidebar";

export interface DestinationOption {
  /** Route the banner button sends the player to, e.g. "/vip". */
  value: string;
  /** What the operator sees, e.g. "VIP". */
  label: string;
  /** Section heading this option is listed under. */
  group: string;
}

/**
 * Profile routes, which live behind tab query params rather than their own
 * pages — so they never appear in the sidebar tree and have to be listed here.
 * Keys mirror ProfilePageClient's `tab` switch on the player site.
 */
export const PROFILE_DESTINATIONS: DestinationOption[] = [
  // Referral has its own route; it is not one of the profile tabs even though
  // the profile menu links to it.
  { value: "/referral", label: "Referral", group: "Profile" },
  { value: "/profile?tab=wallet", label: "Profile — Wallet", group: "Profile" },
  { value: "/profile?tab=buy", label: "Profile — Buy Wulf Coin", group: "Profile" },
  { value: "/profile?tab=redeem", label: "Profile — Redeem", group: "Profile" },
  { value: "/profile?tab=Vault", label: "Profile — Vault", group: "Profile" },
  { value: "/profile?tab=history", label: "Profile — Transaction History", group: "Profile" },
  { value: "/profile?tab=gamehistory", label: "Profile — Game History", group: "Profile" },
  { value: "/profile?tab=rollover", label: "Profile — Rollover", group: "Profile" },
  { value: "/profile?tab=kyc", label: "Profile — KYC", group: "Profile" },
  { value: "/profile?tab=w9_form", label: "Profile — Investigate Form", group: "Profile" },
  { value: "/profile?tab=profile", label: "Profile — My Profile", group: "Profile" },
];

/** Sentinel for "type your own link" — never persisted, only a UI mode switch. */
export const CUSTOM_DESTINATION = "__custom__";

/**
 * Menu keys arrive as camelCase i18n keys ("wulfHome", "liveDealers") or slugs
 * ("/table-games"). Both read like code in a dropdown, so split them into words
 * before an operator ever sees them.
 */
const titleCase = (value: string) =>
  value
    .replace(/[-_/]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Every route an operator can point a banner at: the live player menu (Home &
 * Menus → Sidebar Menus) plus the profile tabs above.
 *
 * Read from the same source the player sidebar renders, so a menu added there
 * shows up here without anyone editing this file — and a banner can never link
 * to a page that was removed from the menu without it being obvious.
 */
export async function loadBannerDestinations(): Promise<DestinationOption[]> {
  const options: DestinationOption[] = [];

  try {
    const tree = await getSidebarTree();

    tree
      .filter((group) => group.enabled)
      .forEach((group) => {
        const groupName = titleCase(group.title || group.titleKey || "Menu");

        // A group can be a link itself (e.g. "Wulf Home").
        if (group.link) {
          options.push({
            value: group.link,
            label: titleCase(group.title || group.link),
            group: groupName,
          });
        }

        group.items
          .filter((item) => item.enabled && item.link)
          .forEach((item) => {
            options.push({
              value: item.link as string,
              label: titleCase(item.label || item.labelKey || (item.link as string)),
              group: groupName,
            });
          });
      });
  } catch {
    // Menu service unreachable → the operator can still use the profile routes
    // and a custom link rather than being blocked entirely.
  }

  options.push(...PROFILE_DESTINATIONS);

  // Same route reachable from two menus would otherwise show twice.
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}
