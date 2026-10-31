export interface SystemConfigGeneral {
  platform_name: string;
  /**
   * The platform's business calendar (IANA id), and the fallback day boundary
   * for any player whose own timezone has never been detected.
   *
   * This was inert for a long time — declared here and read by nothing. It is
   * now load-bearing: it anchors the redeem-cap day, and it is what
   * TimezoneService falls back to when `users.timezone` is null.
   */
  default_timezone: string;
  maintenance_mode: boolean;
  /** Operator's own wording for the curtain. Blank = use the shipped translated copy. */
  maintenance_message: string;
  /** Expected length of the window, in minutes. 0 = show no countdown at all. */
  maintenance_duration_minutes: number;
  /**
   * When the countdown runs out, ISO. Derived by the backend from the switch
   * and the duration — never edited here, and not rendered as a field.
   */
  maintenance_ends_at: string | null;
  /**
   * IPs and CIDR ranges that keep full access while maintenance is on. Stored
   * canonically by the backend: entries it cannot parse are dropped on save,
   * so what comes back is exactly what will be matched.
   */
  maintenance_allowed_ips: string[];
  customer_service_link: string;
  default_language: string;
}

export interface SystemConfigFinance {
  base_currency: string;
  usd_rate: number;
  transaction_expense_percent: number;
  win_lose_expense_percent: number;
  daily_company_expense: number;
}

export interface SystemConfigDeposit {
  deposit_enabled: boolean;
  min_deposit_amount: number;
  max_deposit_amount: number;
  daily_deposit_limit: number;
  monthly_deposit_limit: number;
  /** Forces the Complete Profile form in front of bundle checkout on the player site. */
  require_profile_completion: boolean;
}

export interface SystemConfigWithdrawRedeem {
  withdraw_enabled: boolean;
  redeem_enabled: boolean;
  /**
   * The single money gate on the redeem flow. At or below this amount a payout
   * releases automatically once the user submits their payout details; above it,
   * it waits for a manual release. 0 disables auto-release entirely.
   */
  auto_release_payout_threshold: number;
  /**
   * Same gate for agent / sub-agent payouts. Separate from the player threshold
   * because affiliate payouts are much larger. 0 disables auto-release, so every
   * agent payout waits for an admin Release.
   */
  agent_auto_release_payout_threshold: number;
  default_payout_provider: "BREEZE" | "COINFLOW";
  user_payout_method: "BOTH" | "BREEZE" | "COINFLOW";
  /**
   * Daily redeem cap (chips). Counts pending+approved+processed; a rejection
   * frees the allowance. Resets at midnight in `general.default_timezone`.
   *
   * NOTE: as implemented this is PLATFORM-WIDE — one budget shared by every
   * player. It was documented as a per-user cap in three separate places,
   * including this comment, and that was wrong. Use `redeem_daily_limit_scope`
   * to switch it to a genuine per-user cap.
   */
  redeem_daily_limit_enabled: boolean;
  redeem_daily_limit_amount: number;
  /**
   * PLATFORM (default) = one shared daily budget, resetting on the platform's
   * business day. USER = each player gets their own cap, resetting at their own
   * local midnight. A shared budget cannot reset at hundreds of different
   * instants, so the user-local rule only makes sense in USER scope.
   */
  redeem_daily_limit_scope: "PLATFORM" | "USER";
  /** Minimum chips a user can redeem per request. */
  min_redemption_chips: number;
  /** Max concurrent open (not yet settled or declined) redeem requests a user may hold. */
  max_pending_requests: number;
  /** When true, a user must have an APPROVED KYC profile before redeeming. */
  require_kyc_on_redeem: boolean;
  /**
   * When true, starting KYC opens the Complete Profile form first for a player
   * whose profile is missing a required field. ON by default — Sumsub matches
   * the document against the name / DOB / country on file, so an empty profile
   * tends to produce a failed verification.
   */
  require_profile_completion_on_kyc: boolean;
}

export interface SystemConfigSpinRedeem {
  max_spins_per_day: number;
  segment_percentages: number[];
  max_redeem_amount: number;
  /** OFF = no player is ever asked for a W-9 and the threshold is ignored. */
  w9_enabled: boolean;
  w9_threshold_amount: number;
  w9_form_config: Record<string, unknown>;
}

export interface SystemConfigBonusDefaults {
  bonus_enabled: boolean;
  default_wagering_multiplier: number;
  default_validity_days: number;
  default_kyc_required: boolean;
  max_bonus_cap: number;
  one_per_household_default: boolean;
  exclude_irregular_betting_default: boolean;
  /** Enable one-time welcome free-spin grant on user registration. */
  welcome_free_spin_enabled: boolean;
  /** UUID of the FreeSpinConfig template granted as the welcome reward. Null = none configured. */
  welcome_free_spin_config_id: string | null;
}

export interface SystemConfigPromotionDefaults {
  promotion_enabled: boolean;
  auto_apply_promotions: boolean;
  default_promotion_validity_days: number;
  default_promotion_wagering_multiplier: number;
  default_priority: number;
  /** Headline on the discounted-bundle pop-up. Blank falls back to the default. */
  bundle_sale_title: string;
  /** Optional sub-line. Blank hides it. `{savings}` = biggest saving on offer. */
  bundle_sale_subtitle: string;
}

/** How often the Complete Profile prompt reappears after a dismissal. */
export type ProfilePromptFrequency = "SESSION" | "ALWAYS" | "DAILY" | "ONCE";

/**
 * The Complete Profile prompt shown to players with an unfinished profile.
 *
 * The reward it advertises is NOT set here — it is the active Profile Complete
 * bonus under Bonus Management, which owns the amount, currency and wagering.
 * This card only decides where the prompt appears, how often, and whether the
 * reward is advertised on it.
 */
export interface SystemConfigProfileCompletion {
  prompt_enabled: boolean;
  prompt_frequency: ProfilePromptFrequency;
  prompt_on_buy: boolean;
  prompt_on_redeem: boolean;
  prompt_on_wallet: boolean;
  prompt_on_kyc: boolean;
  prompt_on_referral: boolean;
  prompt_title: string;
  prompt_subtitle: string;
  show_reward_badge: boolean;
}

export interface SystemConfigCashbackDefaults {
  cashback_enabled: boolean;
  hourly_rate: number;
  daily_rate: number;
  weekly_rate: number;
  monthly_rate: number;
  daily_cap: number;
  weekly_cap: number;
  monthly_cap: number;
  min_wagering_amount: number;
  min_claim_amount_hourly: number;
  min_claim_amount_daily: number;
  min_claim_amount_weekly: number;
  min_claim_amount_monthly: number;
}

export interface SystemConfigReferralAffiliate {
  referral_commission_casino_original: number;
  referral_commission_casino_third_party: number;
  referral_commission_sports: number;
  referral_min_claim_amount: number;
  referral_claim_cooldown_days: number;
  referral_signup_xp_reward: number;
  affiliate_release_duration_sec: number;
  affiliate_payout_lock_days: number;
  affiliate_payout_lock_sec: number;
  referral_payout_auto_threshold: number;
}

export interface SystemConfigTournamentRaffle {
  tournament_enabled: boolean;
  raffle_enabled: boolean;
  default_campaign_timezone: string;
  manual_settlement_only: boolean;
  max_active_campaigns: number;
}

export interface SystemConfigGamesControls {
  games_enabled: boolean;
  provider_enable_flags: Record<string, boolean>;
  category_enable_flags: Record<string, boolean>;
  max_win_by_category: Record<string, number>;
  new_game_badge_days: number;
}

export type SeonFailureMode = "FAIL_OPEN" | "FAIL_CLOSED" | "STEP_UP";

export interface SystemConfigRiskCompliance {
  seon_block_vpn: boolean;
  seon_registration_score_block: number;
  seon_registration_score_stepup: number;
  seon_login_score_block: number;
  seon_login_score_stepup: number;
  seon_default_score_block: number;
  seon_default_score_stepup: number;
  seon_failure_mode: SeonFailureMode;
  /** Lock accounts that have not passed KYC within `kyc_lock_after_minutes` of signup. */
  kyc_lock_enabled?: boolean;
  /** Grace period in minutes. */
  kyc_lock_after_minutes?: number;
  /** Server-stamped time the lock was switched on (read-only). */
  kyc_lock_enabled_since?: string | null;
  /**
   * Profile vs Sumsub document, once Sumsub approves. MANUAL: an admin decides
   * per player. AUTOMATIC: `kyc_identity_preferred_source` decides.
   */
  kyc_identity_sync_mode?: KycIdentitySyncMode;
  /** Which side wins in AUTOMATIC mode. */
  kyc_identity_preferred_source?: KycIdentityPreferredSource;
}

export type KycIdentitySyncMode = "MANUAL" | "AUTOMATIC";
export type KycIdentityPreferredSource = "PROFILE" | "DOCUMENT";

/**
 * What happens when a player signs in on one device too many.
 *
 *   ASK           — show them their active devices and let them choose which to
 *                   sign out. Nothing is revoked until they confirm.
 *   EVICT_OLDEST  — silently sign out the least recently used device.
 *   BLOCK         — refuse the login and tell them to free a device first.
 */
export type DeviceLimitStrategy = "ASK" | "EVICT_OLDEST" | "BLOCK";

/**
 * Where a player's device allowance comes from.
 *
 *   DEFAULT      — one number for everybody. Per-tier device counts are ignored
 *                  entirely, and the player site hides the "Devices Allowed"
 *                  row from the pricing table so nothing advertises a per-plan
 *                  difference that does not exist.
 *   SUBSCRIPTION — the allowance comes from the player's subscription tier,
 *                  falling back to the default for tiers that set none.
 */
export type DeviceLimitMode = "DEFAULT" | "SUBSCRIPTION";

/** Cloudflare Turnstile on player auth + payments. See the API's TurnstileMode. */
export type TurnstileMode = "off" | "shadow" | "enforce";

/**
 * The marketing and analytics tags the player app loads.
 *
 * Every id is public by design — they all ship in the page source of the site
 * that uses them. Held in config rather than a build-time env var so a property
 * can be repointed without rebuilding the player image.
 */
export interface SystemConfigMarketing {
  /** GA4 measurement id, `G-XXXXXXXXXX`. Empty disables GA. */
  ga_measurement_id: string;
  /** Tag Manager CONTAINER id, `GTM-XXXXXXX` — not the `GT-` or `G-` ids. */
  gtm_container_id: string;
  /** Microsoft Clarity project id. Empty disables Clarity. */
  clarity_project_id: string;
  /** Meta (Facebook) pixel id, digits only. Empty disables the pixel. */
  meta_pixel_id: string;
}

export interface SystemConfigSecurity {
  /**
   * Platform-wide device allowance.
   *
   * In DEFAULT mode this is the ONLY number that applies. In SUBSCRIPTION mode
   * it is the fallback for tiers that set no device count of their own.
   */
  allow_number_of_devices: number;
  allow_multiple_login_same_ip: number;
  session_timeout_minutes: number;
  /** Minutes of inactivity before the user is auto-logged-out (client-side). */
  idle_logout_minutes: number;
  /** Seconds of countdown warning shown before the idle logout fires. */
  idle_warning_seconds: number;
  /**
   * Master switch for device-limit enforcement. Off by default — turning it on
   * is the one setting here that can stop a paying player signing in, so it has
   * to be a deliberate action rather than a side effect of a deploy.
   */
  device_limit_enabled: boolean;
  device_limit_strategy: DeviceLimitStrategy;
  /** One number for everyone, or per-subscription-tier. See DeviceLimitMode. */
  device_limit_mode: DeviceLimitMode;
  /**
   * Cloudflare Turnstile on player login, sign-up, forgot-password, deposits,
   * subscriptions and payouts. Off by default; the API also treats it as off
   * while its Turnstile keys are missing.
   */
  turnstile_mode: TurnstileMode;
}

export interface SystemConfigAuditSafety {
  config_change_audit_enabled: boolean;
  requires_approval_for_high_risk_changes: boolean;
  effective_from_datetime: string;
  /** Days of Settings → Activity Log kept. Older rows are deleted nightly. */
  activity_log_retention_days: number;
  /** OFF keeps every activity-log row forever and ignores the window above. */
  activity_log_purge_enabled: boolean;
}

export interface SystemConfigFeatureFlags {
  medal_enabled: boolean;
  subscription_tier_enabled: boolean;
  daily_streak_enabled: boolean;
  vip_tier_enabled: boolean;
  personalization_enabled: boolean;
  /**
   * Master switch for user-local day boundaries (daily reward, daily spins,
   * deposit limits).
   *
   * OFF: every player shares one business day, `general.default_timezone`.
   * ON: each player's day flips at midnight in their own detected timezone,
   * falling back to `default_timezone` when we have never detected one.
   *
   * Turning it off is the kill switch — the same code path runs either way,
   * just with one timezone instead of many, so reverting needs no redeploy.
   */
  user_local_day_enabled: boolean;
}

export interface SystemConfigGeofence {
  enabled: boolean;
  allowed_country_codes: string[];
  restricted_state_codes: string[];
  block_unknown_country: boolean;
  block_vpn: boolean;
  /** IPs / CIDR ranges that skip every geofence rule. Admin-only, never public. */
  allowed_ips: string[];
}

// ─── Payment Manager ────────────────────────────────────────────────────────
// Mirrors common/payments/payment-method-catalog.ts on the API. The rail LIST is
// not duplicated here — it is served by /system-config/payment-methods/catalog
// so adding a rail on the API surfaces it in this screen with no admin release.

export type PaymentGatewayKey = "coinflow" | "breeze";
export type PaymentDirection = "payin" | "payout";
export type PaymentAudience = "player" | "agent";

export interface PaymentRailDefinition {
  key: string;
  label: string;
  providerValue: string;
  defaultEnabled: boolean;
  note?: string;
}

export interface PaymentMethodCatalog {
  audiences: { key: PaymentAudience; label: string }[];
  directions: { key: PaymentDirection; label: string }[];
  gateways: {
    key: PaymentGatewayKey;
    label: string;
    directions: {
      key: PaymentDirection;
      label: string;
      rails: PaymentRailDefinition[];
    }[];
  }[];
}

export interface PaymentChannelConfig {
  /** Master switch for this gateway, in this direction, for this audience. */
  enabled: boolean;
  /** Rail config key → enabled. */
  methods: Record<string, boolean>;
}

export type PaymentGatewayConfig = Record<PaymentDirection, PaymentChannelConfig>;
export type PaymentAudienceConfig = Record<PaymentGatewayKey, PaymentGatewayConfig>;
export type SystemConfigPaymentMethods = Record<
  PaymentAudience,
  PaymentAudienceConfig
>;

/** One rail still enabled behind a gateway, as shown on a picker's card. */
export interface PaymentRailSummary {
  key: string;
  label: string;
}

/**
 * What the customer-facing pickers read: gateway on/off, plus the rails still
 * enabled inside each one.
 *
 * `rails` is a sibling of the audiences rather than nested inside them because
 * every consumer reads `availability[audience][direction][gateway]` as a
 * boolean.
 */
export interface PaymentAvailability {
  player: Record<PaymentDirection, Record<PaymentGatewayKey, boolean>>;
  agent: Record<PaymentDirection, Record<PaymentGatewayKey, boolean>>;
  rails?: Record<
    PaymentAudience,
    Record<PaymentDirection, Record<PaymentGatewayKey, PaymentRailSummary[]>>
  >;
}


export type ResponsibleGamingModeValue = "off" | "shadow" | "enforce";

/**
 * Which Responsible Play controls are OFFERED to players.
 *
 * Off = the control is not offered and no new one can be created. It does NOT
 * void what a player already has — an active break or limit keeps being
 * enforced and stays visible to them.
 */
export interface SystemConfigResponsibleGamingFeatures {
  pause: boolean;
  self_exclusion: boolean;
  deposit_limits: boolean;
  loss_limits: boolean;
  session_limits: boolean;
  activity_dashboard: boolean;
  reality_check: boolean;
}

export interface SystemConfigResponsibleGaming {
  /** Master switch. Off until an operator deliberately turns the engine on. */
  enabled: boolean;
  /** Only consulted when `enabled` is true. */
  mode: ResponsibleGamingModeValue;
  /** i18n period codes: i = 24 hours, ii = 1 week, iii = 1 month. */
  pause_periods_enabled: string[];
  /** iv = 6 months, v = 1 year, vi = permanently. */
  self_exclusion_periods_enabled: string[];
  limit_increase_cooling_off_hours: number;
  reality_check_minutes: number;
  /** Minutes of no play before a session is considered ended. */
  session_idle_gap_minutes: number;
  features?: SystemConfigResponsibleGamingFeatures;
}

export interface SystemConfig {
  version: number;
  general: SystemConfigGeneral;
  finance: SystemConfigFinance;
  deposit: SystemConfigDeposit;
  withdraw_redeem: SystemConfigWithdrawRedeem;
  /** Payment Manager: gateways and rails, per audience and direction. */
  payment_methods: SystemConfigPaymentMethods;
  spin_redeem: SystemConfigSpinRedeem;
  bonus_defaults: SystemConfigBonusDefaults;
  promotion_defaults: SystemConfigPromotionDefaults;
  profile_completion: SystemConfigProfileCompletion;
  cashback_defaults: SystemConfigCashbackDefaults;
  referral_affiliate: SystemConfigReferralAffiliate;
  tournament_raffle: SystemConfigTournamentRaffle;
  games_controls: SystemConfigGamesControls;
  risk_compliance: SystemConfigRiskCompliance;
  responsible_gaming: SystemConfigResponsibleGaming;
  security: SystemConfigSecurity;
  marketing: SystemConfigMarketing;
  audit_safety: SystemConfigAuditSafety;
  feature_flags: SystemConfigFeatureFlags;
  geofence: SystemConfigGeofence;
}

export interface SystemConfigResponse {
  key: string;
  version: number;
  config: SystemConfig;
  createdAt: string;
  updatedAt: string;
}

export type SystemConfigSectionKey = Exclude<keyof SystemConfig, "version">;
