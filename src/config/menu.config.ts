// config/nav-items.ts - Updated to match backend permissions
import {
  user,
  setting,
  dashboard,
  admin2,
  wallet,
  game,
  report,
  vip,
  shopping,
} from "@/assets/icons";
import type { ImageProps } from "next/image";

export interface NavItem {
  title: string;
  url?: string;
  icon?: ImageProps["src"];
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  role?: string;
  items?: NavItem[];
  /**
   * Keep the page out of the sidebar while leaving it in this config.
   *
   * The roles/permissions dialog is built from this same list, so deleting an
   * entry would also delete the ability to grant its permission. Pages reached
   * from a button on another screen use this instead.
   */
  hiddenInSidebar?: boolean;
}

export const NAV_PERMISSIONS = {
  // Employee permissions
  EMPLOYEES_CREATE: "employees:create",
  EMPLOYEES_READ: "employees:read",
  EMPLOYEES_UPDATE: "employees:update",
  EMPLOYEES_DELETE: "employees:delete",

  // Role permissions
  ROLES_CREATE: "roles:create",
  ROLES_READ: "roles:read",
  ROLES_UPDATE: "roles:update",
  ROLES_DELETE: "roles:delete",
  ROLES_ASSIGN: "roles:assign",
  ROLES_REMOVE: "roles:remove",

  // User permissions
  USERS_CREATE: "users:create",
  AGENTS_CREATE: "agents:create",
  USERS_AGENT_LISTING: "users:agent-listing",
  USERS_SUB_AGENT_LISTING: "users:sub-agent-listing",
  USERS_PLAYER_LISTING: "users:player-listing",
  USERS_KYC_LISTING: "users:kyc-listing",
  USERS_SEON_RISK_LISTING: "users:seon-risk-listing",
  USERS_WAITLIST_REFERRAL_CODE: "users:waitlist-referral-code",
  USERS_MESSAGE_TEMPLATE: "users:message-template",
  USERS_PROVIDERS: "users:providers",
  USERS_REFERRALS: "users:referrals",
  JACKPOT: "users:jackpot",
  USERS_GAME_JACKPOTS: "users:game-jackpots",
  USERS_ALL_TICKETS: "users:all-tickets",
  USERS_TIERS: "users:tiers",
  USERS_DEVICE_SESSIONS: "users:device-sessions",
  USERS_AML_ALERTS: "users:aml-alerts",
  /**
   * Working the support queue: read, reply, assign, prioritise.
   *
   * Deciding a ticket is `support:decisions` and is deliberately NOT a nav
   * permission — it gates buttons inside this page (and the matching API
   * routes), not access to the page itself, because an agent who can work the
   * queue but not grant a reactivation still needs to see it.
   */
  SUPPORT_TICKETS: "support:tickets",
  /**
   * Viewing who is restricted and why.
   *
   * Lifting a restriction is `responsible-gaming:lift` and is NOT a nav
   * permission — it gates a button inside this page and the matching API
   * route, because support needs to see the page to answer "why can't I
   * play?" without being able to undo the answer.
   */
  USERS_RESPONSIBLE_GAMING: "users:responsible-gaming",
  USERS_AGENT_ACTIVITY: "users:agent-activity",

  // Settings permissions
  SETTINGS_BANNERS: "settings:banners",
  SETTINGS_ANNOUNCEMENT_LISTING: "settings:announcement-listing",
  SETTINGS_BANNER_PACK_LISTING: "settings:banner-pack-listing",
  SETTINGS_FAQ_LISTING: "settings:faq-listing",
  SETTINGS_SPONSORSHIP_LISTING: "settings:sponsorship-listing",
  SETTINGS_PROMOTION_LISTING: "settings:promotion-listing",
  SETTINGS_SYSTEM_CONFIGURATION: "settings:system-configuration",
  SETTINGS_PAYMENT_PROCESSOR_MANAGEMENT:
    "settings:payment-processor-management",
  SETTINGS_PAYMENT_MANAGER: "settings:payment-manager",
  SETTINGS_BONUS_LISTING: "settings:bonus-listing",
  SETTINGS_PROMO_CODE_LISTING: "settings:promo-code-listing",
  SETTINGS_CASH_BUNDLE: "settings:cash-bundle",
  SETTINGS_AGENT_PACKAGE_MANAGEMENT: "settings:agent-package-management",
  SETTINGS_PLATFORM_FEE_MANAGEMENT: "settings:platform-fee-management",
  SETTINGS_RACE_CONTESTS: "settings:race-contests",
  SETTINGS_REDEEM_REQUESTS: "settings:redeem-requests",
  SETTINGS_SPIN_CONFIG: "settings:spin-config",
  SETTINGS_DAILY_STREAK: "settings:daily-streak",
  SETTINGS_PERSONALIZATION: "settings:personalization",
  SETTINGS_HOME_PAGE: "settings:home-page",
  SETTINGS_MEDAL_LISTING: "settings:medal-listing",
  SETTINGS_FREE_SPIN_CONFIG: "settings:free-spin-config",
  SETTINGS_INTEGRATION_HEALTH: "settings:integration-health",
  SETTINGS_NINJA_POSTBACKS: "settings:ninja-postbacks",

  // Notification permissions
  NOTIFICATIONS_INBOX: "notifications:inbox",
  NOTIFICATIONS_SEND: "notifications:send",
  NOTIFICATIONS_HISTORY: "notifications:history",

  // Game permissions
  GAME_MANAGEMENT: "games:game-management",
  GAME_TOURNAMENT_MANAGEMENT: "games:tournament-management",
  GAME_PROVIDERS: "games:providers",

  // Wallet permissions
  WALLET_MANUAL_DEPOSIT: "wallet:manual-deposit",
  WALLET_MANUAL_DEPOSIT_LISTING: "wallet:manual-deposit-listing",
  // Direct balance edit on the player Wallet tab (applied immediately).
  WALLET_BALANCE_EDIT: "wallet:balance-edit",
  // Mail-in (postal) sweeps entries — the free, no-purchase route. Intake and
  // approval are separate keys on purpose: they are the two halves of the
  // four-eyes rule, and a role holding both can invent entries.
  SWEEPS_POSTAL_INTAKE: "sweeps:postal-intake",
  SWEEPS_POSTAL_APPROVE: "sweeps:postal-approve",
  SWEEPS_POSTAL_SETTINGS: "sweeps:postal-settings",
  /** @deprecated Cash Transfer Logs was a mock-data screen — the table was a
   *  hardcoded array, never wired to an endpoint. The page and its menu entry
   *  are gone. The key stays because roles already carry it in the database. */
  WALLET_DEPOSIT_LOGS: "wallet:deposit-logs",
  WALLET_WITHDRAWAL_LISTING: "wallet:withdrawal-listing",
  /** @deprecated Withdraw Logs was a re-export of Withdrawal Listing; the two
   *  screens showed identical data. The menu entry is gone and /wallet/withdraw-logs
   *  redirects. The key stays because roles still carry it. */
  WALLET_WITHDRAW_LOGS: "wallet:withdraw-logs",
  WALLET_TAX_FORMS: "wallet:tax-forms",
  WALLET_TAX_GENERATION: "wallet:tax-generation",
  WALLET_VAULT_MANAGEMENT: "wallet:vault-management",

  // Free Spin permissions
  FREE_SPIN_CONFIGURATION: "free-spin:configuration",
  FREE_SPIN_ALLOCATION: "free-spin:allocation",
  FREE_SPIN_ACTIVITY_LOG: "free-spin:activity-log",
  FREE_SPIN_NEWBIE_ACTIVITY_LOG: "free-spin:newbie-activity-log",

  // Report permissions
  REPORT_DAILY_REPORT: "report:daily-report",
  REPORT_GAME_REPORT: "report:game-report",
  REPORT_WIN_LOSS_REPORT: "report:win-loss-report",
  REPORT_USER_WIN_LOSS_DETAIL: "report:user-win-loss-detail",
  REPORT_AGENT_REPORT: "report:agent-report",
  REPORT_INSTANT_REBATE_LOGS: "report:instant-rebate-logs",
  REPORT_USER_BONUS: "report:user-bonus",
  REPORT_USER_BONUS_CLAIM_HISTORY: "report:user-bonus-claim-history",
  REPORT_ENGAGEMENT_REPORT: "report:engagement-report",

  // VIP Tier permissions
  VIP_TIER_TIER_MANAGEMENT: "vip-tier:tier-management",
  VIP_TIER_USER_TIER: "vip-tier:user-tier",
  VIP_TIER_TIER_REWARDS: "vip-tier:tier-rewards",
  VIP_TIER_REWARDS_LOG: "vip-tier:rewards-log",

  // Revenue Sharing permissions
  REVENUE_SHARING_PACKAGE: "revenue-sharing:package",
} as const;

export const navItems: NavItem[] = [
  // 1. Dashboard
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: dashboard,
  },

  // 2. User Management
  {
    title: "User Management",
    icon: user,
    permissions: [
      NAV_PERMISSIONS.USERS_PLAYER_LISTING,
      NAV_PERMISSIONS.USERS_CREATE,
      NAV_PERMISSIONS.USERS_KYC_LISTING,
      NAV_PERMISSIONS.USERS_SEON_RISK_LISTING,
      NAV_PERMISSIONS.USERS_DEVICE_SESSIONS,
      NAV_PERMISSIONS.USERS_AML_ALERTS,
      NAV_PERMISSIONS.SUPPORT_TICKETS,
      NAV_PERMISSIONS.USERS_RESPONSIBLE_GAMING,
    ],
    items: [
      {
        title: "Players List",
        url: "/users/players-list",
        permission: NAV_PERMISSIONS.USERS_PLAYER_LISTING,
      },
      // Player Performance is hidden from the sidebar for now — the route
      // still exists at /users/player-performance, behind the development
      // passphrase. Its permission rule moved to EXTRA_ROUTE_RULES in
      // route-permissions.ts so uncommenting this is the only change needed
      // to bring it back.
      // {
      //   // Same data the player detail tabs already expose, ranked across
      //   // every player — so it rides the Players List permission rather than
      //   // a new one the roles dialog would have to learn about.
      //   title: "Player Performance",
      //   url: "/users/player-performance",
      //   permission: NAV_PERMISSIONS.USERS_PLAYER_LISTING,
      // },
      {
        title: "Register User",
        url: "/users/register-user",
        permission: NAV_PERMISSIONS.USERS_CREATE,
      },
      {
        title: "KYC Listing",
        url: "/users/kyc-listing",
        permission: NAV_PERMISSIONS.USERS_KYC_LISTING,
      },
      {
        title: "SEON Risk Listing",
        url: "/users/seon-risk-listing",
        permission: NAV_PERMISSIONS.USERS_SEON_RISK_LISTING,
      },
      {
        title: "Device Sessions",
        url: "/users/device-sessions",
        permission: NAV_PERMISSIONS.USERS_DEVICE_SESSIONS,
      },
      {
        // Reached from the Responsible Gaming screen rather than the sidebar:
        // the tickets that matter here are the reactivation requests those
        // restrictions produce, so the two are one flow. `hiddenInSidebar`
        // keeps the route and its permission intact.
        title: "Support Tickets",
        url: "/users/support-tickets",
        permission: NAV_PERMISSIONS.SUPPORT_TICKETS,
        hiddenInSidebar: true,
      },
      {
        title: "Responsible Gaming",
        url: "/users/responsible-gaming",
        permission: NAV_PERMISSIONS.USERS_RESPONSIBLE_GAMING,
      },
      {
        // Lives under Reports in the sidebar but is declared here so it sits
        // beside the screen it reports on; `hiddenInSidebar` keeps it out of
        // User Management while leaving the permission grantable.
        title: "Responsible Gaming Report",
        url: "/report/responsible-gaming-report",
        permission: NAV_PERMISSIONS.USERS_RESPONSIBLE_GAMING,
        hiddenInSidebar: true,
      },
      {
        title: "AML Alerts",
        url: "/users/aml-alerts",
        permission: NAV_PERMISSIONS.USERS_AML_ALERTS,
        hiddenInSidebar: true,
      },
    ],
  },

  // 3. Agent Management
  {
    title: "Agent Management",
    icon: user,
    permissions: [
      NAV_PERMISSIONS.USERS_AGENT_LISTING,
      NAV_PERMISSIONS.AGENTS_CREATE,
      NAV_PERMISSIONS.USERS_SUB_AGENT_LISTING,
      NAV_PERMISSIONS.SETTINGS_AGENT_PACKAGE_MANAGEMENT,
      NAV_PERMISSIONS.SETTINGS_PLATFORM_FEE_MANAGEMENT,
      NAV_PERMISSIONS.REVENUE_SHARING_PACKAGE,
      NAV_PERMISSIONS.USERS_ALL_TICKETS,
      NAV_PERMISSIONS.USERS_AGENT_ACTIVITY,
    ],
    items: [
      {
        title: "Agent Listing",
        url: "/users/agent-listing",
        permission: NAV_PERMISSIONS.USERS_AGENT_LISTING,
      },
      {
        title: "Register Agent",
        url: "/users/register-agent",
        permission: NAV_PERMISSIONS.AGENTS_CREATE,
      },
      {
        title: "Sub-Agent Listing",
        url: "/users/sub-agent-listing",
        permission: NAV_PERMISSIONS.USERS_SUB_AGENT_LISTING,
      },
      {
        title: "Agent Package Management",
        url: "/settings/agent-package-management",
        permission: NAV_PERMISSIONS.SETTINGS_AGENT_PACKAGE_MANAGEMENT,
        // Parked for now. Route and permission are untouched — the page is
        // still reachable by URL. Delete this line to bring the row back.
        hiddenInSidebar: true,
      },
      {
        title: "Platform Fee Management",
        url: "/settings/platform-fee-management",
        permission: NAV_PERMISSIONS.SETTINGS_PLATFORM_FEE_MANAGEMENT,
      },
      {
        title: "Revenue Sharing Package",
        url: "/revenue-sharing/package",
        permission: NAV_PERMISSIONS.REVENUE_SHARING_PACKAGE,
      },
      {
        title: "All Tickets",
        url: "/users/sub-agent-delete-requests",
        permission: NAV_PERMISSIONS.USERS_ALL_TICKETS,
      },
      {
        title: "Agent Activity",
        url: "/users/agent-activity",
        permission: NAV_PERMISSIONS.USERS_AGENT_ACTIVITY,
        hiddenInSidebar: true,
      },
    ],
  },

  // 4. Finance & Wallet
  {
    title: "Finance & Wallet",
    icon: wallet,
    permissions: [
      NAV_PERMISSIONS.WALLET_DEPOSIT_LOGS,
      NAV_PERMISSIONS.WALLET_MANUAL_DEPOSIT,
      NAV_PERMISSIONS.WALLET_MANUAL_DEPOSIT_LISTING,
      NAV_PERMISSIONS.SWEEPS_POSTAL_INTAKE,
      NAV_PERMISSIONS.SWEEPS_POSTAL_APPROVE,
      NAV_PERMISSIONS.SWEEPS_POSTAL_SETTINGS,
      NAV_PERMISSIONS.WALLET_WITHDRAWAL_LISTING,
      NAV_PERMISSIONS.SETTINGS_REDEEM_REQUESTS,
      NAV_PERMISSIONS.SETTINGS_PAYMENT_PROCESSOR_MANAGEMENT,
      NAV_PERMISSIONS.WALLET_VAULT_MANAGEMENT,
      NAV_PERMISSIONS.SETTINGS_SPIN_CONFIG,
      NAV_PERMISSIONS.WALLET_TAX_FORMS,
      NAV_PERMISSIONS.WALLET_TAX_GENERATION,
    ],
    items: [
      {
        title: "User Deposit",
        url: "/wallet/user-deposit-logs",
        permission: NAV_PERMISSIONS.WALLET_DEPOSIT_LOGS,
      },
      {
        title: "Manual Deposit",
        url: "/wallet/manual-deposit",
        permission: NAV_PERMISSIONS.WALLET_MANUAL_DEPOSIT,
      },
      {
        title: "Manual Deposit Listing",
        url: "/wallet/manual-deposit-listing",
        permission: NAV_PERMISSIONS.WALLET_MANUAL_DEPOSIT_LISTING,
        // Reached from the button on Manual Deposit, which is where the flow
        // starts — two sibling sidebar entries for one flow was the confusion.
        hiddenInSidebar: true,
      },
      {
        title: "Postal Entries",
        url: "/wallet/postal-entries",
        permission: NAV_PERMISSIONS.SWEEPS_POSTAL_INTAKE,
      },
      {
        title: "Postal Entry Settings",
        url: "/wallet/postal-entries/settings",
        permission: NAV_PERMISSIONS.SWEEPS_POSTAL_SETTINGS,
        // Reached from the header button on Postal Entries — the knobs belong
        // to that screen, not to a settings page somewhere else.
        hiddenInSidebar: true,
      },
      {
        title: "Withdrawal Listing",
        url: "/wallet/withdrawal-listing",
        permission: NAV_PERMISSIONS.WALLET_WITHDRAWAL_LISTING,
      },
      {
        title: "Redeem Requests",
        url: "/settings/redeem-requests",
        permission: NAV_PERMISSIONS.SETTINGS_REDEEM_REQUESTS,
        // Reached from the button on Withdrawal Listing, which is where the
        // flow starts — same pairing as Manual Deposit and its listing.
        hiddenInSidebar: true,
      },
      {
        title: "Payment Processor Management",
        url: "/settings/payment-processor-management",
        permission: NAV_PERMISSIONS.SETTINGS_PAYMENT_PROCESSOR_MANAGEMENT,
      },
      // Payment Manager is deliberately NOT its own menu entry: it is reached
      // from the "Payment Manager" button in the Payment Processor Management
      // header, since the two are the same job — the transactions a processor
      // ran, and which of its methods are on offer. The route and its
      // SETTINGS_PAYMENT_MANAGER permission are unchanged; the button is
      // guarded by that permission, so anyone who could open the page still
      // can and anyone who could not still cannot.
      {
        title: "Vault Management",
        url: "/wallet/vault-management",
        permission: NAV_PERMISSIONS.WALLET_VAULT_MANAGEMENT,
      },
      {
        // TEMPORARY, open to every admin login: pure client-side simulator of
        // the rollover / redeemable rules, no API calls. No permission key on
        // purpose — it reads nothing and writes nothing, and registering a
        // key for a throwaway page would leave it in role rows forever.
        title: "Rollover Calculator",
        url: "/wallet/rollover-calculator",
      },
      {
        title: "W-9 Form Config",
        url: "/settings/spin-config",
        permission: NAV_PERMISSIONS.SETTINGS_SPIN_CONFIG,
        // Reached from the button on Tax Forms — the config and the submissions
        // it shapes are one flow, same pairing as Withdrawal Listing / Redeem
        // Requests.
        hiddenInSidebar: true,
      },
      {
        title: "Tax Forms",
        url: "/wallet/tax-forms",
        permission: NAV_PERMISSIONS.WALLET_TAX_FORMS,
      },
      {
        title: "Tax Generation",
        url: "/wallet/tax-generation",
        permission: NAV_PERMISSIONS.WALLET_TAX_GENERATION,
        // Already reached from the button on Tax Forms — same pairing as the
        // W-9 config above it.
        hiddenInSidebar: true,
      },
    ],
  },

  // 5. Games
  {
    title: "Games",
    icon: game,
    permissions: [
      NAV_PERMISSIONS.GAME_MANAGEMENT,
      NAV_PERMISSIONS.GAME_TOURNAMENT_MANAGEMENT,
      NAV_PERMISSIONS.GAME_PROVIDERS,
      NAV_PERMISSIONS.SETTINGS_RACE_CONTESTS,
      NAV_PERMISSIONS.JACKPOT,
      NAV_PERMISSIONS.USERS_GAME_JACKPOTS,
    ],
    items: [
      {
        title: "Game Listing",
        url: "/game/game-listing",
        permission: NAV_PERMISSIONS.GAME_MANAGEMENT,
      },
      {
        title: "Tournament Management",
        url: "/game/tournaments",
        permission: NAV_PERMISSIONS.GAME_TOURNAMENT_MANAGEMENT,
      },
      {
        title: "Race Contests",
        url: "/settings/race-contests",
        permission: NAV_PERMISSIONS.SETTINGS_RACE_CONTESTS,
      },
      {
        title: "Jackpot Management",
        url: "/users/jackpot",
        permission: NAV_PERMISSIONS.JACKPOT,
      },
      {
        title: "Game Jackpots",
        url: "/users/game-jackpots",
        permission: NAV_PERMISSIONS.USERS_GAME_JACKPOTS,
      },
      {
        title: "Provider Operations",
        url: "/game/providers",
        permission: NAV_PERMISSIONS.GAME_PROVIDERS,
        hiddenInSidebar: true,
      },
    ],
  },

  // 6. Promotions & Bonuses
  {
    title: "Promotions & Bonuses",
    icon: shopping,
    permissions: [
      NAV_PERMISSIONS.SETTINGS_PROMOTION_LISTING,
      NAV_PERMISSIONS.SETTINGS_BONUS_LISTING,
      NAV_PERMISSIONS.REPORT_USER_BONUS,
      NAV_PERMISSIONS.SETTINGS_PROMO_CODE_LISTING,
      NAV_PERMISSIONS.USERS_REFERRALS,
      NAV_PERMISSIONS.USERS_WAITLIST_REFERRAL_CODE,
      NAV_PERMISSIONS.SETTINGS_CASH_BUNDLE,
      NAV_PERMISSIONS.SETTINGS_DAILY_STREAK,
      NAV_PERMISSIONS.SETTINGS_BANNER_PACK_LISTING,
    ],
    items: [
      {
        title: "Promotion Listing",
        url: "/settings/promotion-listing",
        permission: NAV_PERMISSIONS.SETTINGS_PROMOTION_LISTING,
      },
      {
        title: "Bonus Listing",
        url: "/settings/bonus-listing",
        permission: NAV_PERMISSIONS.SETTINGS_BONUS_LISTING,
      },
      {
        title: "User Bonus",
        url: "/report/user-bonus",
        permission: NAV_PERMISSIONS.REPORT_USER_BONUS,
      },
      {
        title: "Promo Code Listing",
        url: "/settings/promo-code-listing",
        permission: NAV_PERMISSIONS.SETTINGS_PROMO_CODE_LISTING,
      },
      {
        title: "Referral Code",
        url: "/users/referral-code",
        permission: NAV_PERMISSIONS.USERS_REFERRALS,
      },
      {
        title: "Waitlist Referral Code",
        url: "/users/waitlist-referral-code",
        permission: NAV_PERMISSIONS.USERS_WAITLIST_REFERRAL_CODE,
        // Hidden from the sidebar on request. The page, route and permission
        // all still exist — it stays reachable by direct URL, and the roles
        // dialog can still grant it. Delete this line to bring it back.
        hiddenInSidebar: true,
      },
      {
        title: "Cash Bundle",
        url: "/settings/cashbundle",
        permission: NAV_PERMISSIONS.SETTINGS_CASH_BUNDLE,
      },
      {
        title: "Daily Streak",
        url: "/settings/daily-streak",
        permission: NAV_PERMISSIONS.SETTINGS_DAILY_STREAK,
      },
      {
        title: "Promo Materials",
        url: "/settings/banner-pack-listing",
        permission: NAV_PERMISSIONS.SETTINGS_BANNER_PACK_LISTING,
      },
    ],
  },

  // 7. VIP & Loyalty
  {
    title: "VIP & Loyalty",
    icon: vip,
    permissions: [
      NAV_PERMISSIONS.VIP_TIER_TIER_MANAGEMENT,
      NAV_PERMISSIONS.USERS_TIERS,
      NAV_PERMISSIONS.VIP_TIER_TIER_REWARDS,
      NAV_PERMISSIONS.VIP_TIER_USER_TIER,
      NAV_PERMISSIONS.SETTINGS_MEDAL_LISTING,
      NAV_PERMISSIONS.FREE_SPIN_CONFIGURATION,
      NAV_PERMISSIONS.FREE_SPIN_ALLOCATION,
      NAV_PERMISSIONS.FREE_SPIN_ACTIVITY_LOG,
      NAV_PERMISSIONS.VIP_TIER_REWARDS_LOG,
      NAV_PERMISSIONS.FREE_SPIN_NEWBIE_ACTIVITY_LOG,
      NAV_PERMISSIONS.SETTINGS_FREE_SPIN_CONFIG,
    ],
    items: [
      {
        title: "Tier Management",
        url: "/vip-tier/tier-management",
        permission: NAV_PERMISSIONS.VIP_TIER_TIER_MANAGEMENT,
      },
      {
        title: "Subscription Tier Management",
        url: "/users/subscription-tier-management",
        permission: NAV_PERMISSIONS.USERS_TIERS,
      },
      {
        title: "Tier Rewards Management",
        url: "/vip-tier/tier-rewards",
        permission: NAV_PERMISSIONS.VIP_TIER_TIER_REWARDS,
        // Reached from the button on Tier Management — the tiers and the
        // rewards attached to them are one flow.
        hiddenInSidebar: true,
      },
      {
        title: "User Tier",
        url: "/vip-tier/user-tier",
        permission: NAV_PERMISSIONS.VIP_TIER_USER_TIER,
      },
      {
        title: "Medal Listing",
        url: "/settings/medal-listing",
        permission: NAV_PERMISSIONS.SETTINGS_MEDAL_LISTING,
      },
      {
        title: "Free Spin Configuration",
        url: "/lucky-draw/vip-lucky-spin",
        permission: NAV_PERMISSIONS.FREE_SPIN_CONFIGURATION,
        // Reached from the button on Free Spin Allocation — the templates and
        // the grants that hand them out are one flow, and the activity log
        // already hangs off that page the same way.
        hiddenInSidebar: true,
      },
      {
        title: "Free Spin Allocation",
        url: "/lucky-draw/newbie-lucky-spin",
        permission: NAV_PERMISSIONS.FREE_SPIN_ALLOCATION,
      },
      {
        // Reached from the "Activity Log" button on Free Spin Allocation —
        // that is where an admin is when they want it, so it does not need its
        // own sidebar row. Route and permission are unchanged.
        title: "Free Spin Activity Log",
        url: "/lucky-draw/vip-lucky-spin-log",
        permission: NAV_PERMISSIONS.FREE_SPIN_ACTIVITY_LOG,
        hiddenInSidebar: true,
      },
      {
        title: "Rewards Log",
        url: "/vip-tier/rewards-log",
        permission: NAV_PERMISSIONS.VIP_TIER_REWARDS_LOG,
      },
      {
        title: "Newbie Free Spin Activity Log",
        url: "/lucky-draw/newbie-lucky-spin-log",
        permission: NAV_PERMISSIONS.FREE_SPIN_NEWBIE_ACTIVITY_LOG,
        hiddenInSidebar: true,
      },
      {
        title: "Free Spin Config",
        url: "/settings/free-spin-config",
        permission: NAV_PERMISSIONS.SETTINGS_FREE_SPIN_CONFIG,
        hiddenInSidebar: true,
      },
    ],
  },

  // 8. Content & Communication
  {
    title: "Content & Communication",
    icon: setting,
    permissions: [
      NAV_PERMISSIONS.SETTINGS_BANNERS,
      NAV_PERMISSIONS.SETTINGS_ANNOUNCEMENT_LISTING,
      NAV_PERMISSIONS.USERS_MESSAGE_TEMPLATE,
      NAV_PERMISSIONS.SETTINGS_FAQ_LISTING,
      NAV_PERMISSIONS.SETTINGS_SPONSORSHIP_LISTING,
    ],
    items: [
      {
        title: "Banners / Poster",
        url: "/settings/banners",
        permission: NAV_PERMISSIONS.SETTINGS_BANNERS,
      },
      {
        title: "Announcement Listing",
        url: "/settings/announcement-listing",
        permission: NAV_PERMISSIONS.SETTINGS_ANNOUNCEMENT_LISTING,
      },
      {
        title: "Message Template",
        url: "/users/message-template",
        permission: NAV_PERMISSIONS.USERS_MESSAGE_TEMPLATE,
      },
      {
        title: "FAQ Listing",
        url: "/settings/faq-listing",
        permission: NAV_PERMISSIONS.SETTINGS_FAQ_LISTING,
      },
      {
        title: "Sponsorship Listing",
        url: "/settings/sponsorship-listing",
        permission: NAV_PERMISSIONS.SETTINGS_SPONSORSHIP_LISTING,
      },
    ],
  },

  // 9. Notifications
  {
    title: "Notifications",
    icon: user,
    permissions: [
      NAV_PERMISSIONS.NOTIFICATIONS_INBOX,
      NAV_PERMISSIONS.NOTIFICATIONS_SEND,
      NAV_PERMISSIONS.NOTIFICATIONS_HISTORY,
    ],
    items: [
      {
        title: "Inbox",
        url: "/notifications/inbox",
        permission: NAV_PERMISSIONS.NOTIFICATIONS_INBOX,
      },
      {
        title: "Compose",
        url: "/notifications/send",
        permission: NAV_PERMISSIONS.NOTIFICATIONS_SEND,
      },
      // Gated on the ROLE, not a permission — deliberately. A permission would
      // appear in the roles dialog, where anyone who can edit roles could grant
      // themselves the ability to read the log of their own actions. There is
      // no permission to grant; the API enforces the same rule in
      // SuperAdminGuard, so hiding the row is presentation, not the control.
      //
      // Last in the group: the everyday rows (Inbox, Compose) come first, and
      // an audit view most admins never see should not be the group's opener.
      {
        title: "Activity Log",
        url: "/settings/activity-log",
        role: "superadmin",
      },
      {
        title: "Sent History",
        url: "/notifications/sent",
        permission: NAV_PERMISSIONS.NOTIFICATIONS_HISTORY,
        // Reached from the "Sent history" button on Compose, not the sidebar.
        // Kept in this config so the permission stays grantable in the roles
        // dialog, which is built from the same list.
        hiddenInSidebar: true,
      },
    ],
  },

  // 10. Reports & Analytics
  {
    title: "Reports & Analytics",
    icon: report,
    permissions: [
      NAV_PERMISSIONS.USERS_PROVIDERS,
      NAV_PERMISSIONS.REPORT_DAILY_REPORT,
      NAV_PERMISSIONS.REPORT_GAME_REPORT,
      NAV_PERMISSIONS.REPORT_USER_WIN_LOSS_DETAIL,
      NAV_PERMISSIONS.REPORT_AGENT_REPORT,
      NAV_PERMISSIONS.REPORT_USER_BONUS_CLAIM_HISTORY,
      NAV_PERMISSIONS.REPORT_ENGAGEMENT_REPORT,
      NAV_PERMISSIONS.REPORT_INSTANT_REBATE_LOGS,
      NAV_PERMISSIONS.REPORT_WIN_LOSS_REPORT,
    ],
    items: [
      {
        title: "Provider Account Overview",
        url: "/users/provider-account-overview",
        permission: NAV_PERMISSIONS.USERS_PROVIDERS,
      },
      {
        title: "Daily Report",
        url: "/report/daily-report",
        permission: NAV_PERMISSIONS.REPORT_DAILY_REPORT,
      },
      {
        title: "Game Report",
        url: "/report/game-report",
        permission: NAV_PERMISSIONS.REPORT_GAME_REPORT,
      },
      {
        title: "User Win Loss Detail",
        url: "/report/user-win-loss-detail",
        permission: NAV_PERMISSIONS.REPORT_USER_WIN_LOSS_DETAIL,
      },
      {
        title: "Agent Report",
        url: "/report/agent-report",
        permission: NAV_PERMISSIONS.REPORT_AGENT_REPORT,
      },
      {
        title: "User Bonus Claim History",
        url: "/report/user-bonus-claim-history",
        permission: NAV_PERMISSIONS.REPORT_USER_BONUS_CLAIM_HISTORY,
      },
      {
        title: "Reward Distribution Report",
        url: "/report/reward-distribution-report",
        permission: NAV_PERMISSIONS.REPORT_ENGAGEMENT_REPORT,
      },
      {
        title: "Instant Rebate Logs",
        url: "/report/instant-rebate-logs",
        permission: NAV_PERMISSIONS.REPORT_INSTANT_REBATE_LOGS,
      },
      {
        // Reached from the button in ReportsModal, not the sidebar.
        title: "Win Loss Report",
        url: "/report/win-loss-report",
        permission: NAV_PERMISSIONS.REPORT_WIN_LOSS_REPORT,
        hiddenInSidebar: true,
      },
    ],
  },

  // 11. Staff & Access
  {
    title: "Staff & Access",
    icon: admin2,
    permissions: [
      NAV_PERMISSIONS.EMPLOYEES_READ,
      NAV_PERMISSIONS.EMPLOYEES_CREATE,
      NAV_PERMISSIONS.EMPLOYEES_UPDATE,
      NAV_PERMISSIONS.EMPLOYEES_DELETE,
      NAV_PERMISSIONS.ROLES_READ,
    ],
    items: [
      {
        title: "Employee List",
        url: "/admin/employee-list",
        permissions: [
          NAV_PERMISSIONS.EMPLOYEES_READ,
          NAV_PERMISSIONS.EMPLOYEES_CREATE,
        ],
      },
      {
        title: "Access Control",
        url: "/admin/access-control",
        permission: NAV_PERMISSIONS.ROLES_READ,
      },
    ],
  },

  // 12. System Settings
  {
    title: "System Settings",
    icon: setting,
    permissions: [
      NAV_PERMISSIONS.SETTINGS_SYSTEM_CONFIGURATION,
      NAV_PERMISSIONS.SETTINGS_HOME_PAGE,
      NAV_PERMISSIONS.SETTINGS_PERSONALIZATION,
      NAV_PERMISSIONS.SETTINGS_INTEGRATION_HEALTH,
    ],
    items: [
      {
        title: "System Configuration",
        url: "/settings/system-configuration",
        permission: NAV_PERMISSIONS.SETTINGS_SYSTEM_CONFIGURATION,
      },
      // System Logs (/settings/system-logs) is deliberately absent.
      //
      // It is a development tool, not a client-facing feature: the page is
      // reached by typing the URL and is gated by a passphrase held in the API
      // environment. Listing it here would advertise it to every admin, and
      // adding a permission for it would put it in the roles dialog where a
      // superadmin could grant it to themselves.
      {
        title: "Home & Menus",
        url: "/settings/home-page",
        permission: NAV_PERMISSIONS.SETTINGS_HOME_PAGE,
      },
      {
        title: "Personalization",
        url: "/settings/personalization",
        permission: NAV_PERMISSIONS.SETTINGS_PERSONALIZATION,
      },
      // Visible in the sidebar, unlike System Logs above: this one IS a
      // client-facing operational screen. It is how ops find out a payment or
      // KYC provider has stopped working, and it owns the alert recipient
      // list, so hiding it behind a typed URL would defeat the point.
      {
        title: "Integration Health",
        url: "/settings/integration-health",
        permission: NAV_PERMISSIONS.SETTINGS_INTEGRATION_HEALTH,
      },
      // Affiliate conversion delivery: what Ninja has been sent, what is still
      // queued, and the pause switch. Sits next to Integration Health because
      // it is the same job — is a partner integration actually working.
      {
        title: "Ninja Postbacks",
        url: "/settings/ninja-postbacks",
        permission: NAV_PERMISSIONS.SETTINGS_NINJA_POSTBACKS,
      },
    ],
  },
];
