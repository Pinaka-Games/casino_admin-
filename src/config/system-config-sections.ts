/**
 * Declarative schema for the System Configuration page.
 *
 * Extracted from the page so it can also be read by the global settings
 * search index — every field here is an individually addressable setting,
 * and the search needs its section title, label and path without pulling in
 * the whole page module.
 */

import { SystemConfig } from "@/types/system-config";


export type PrimitiveFieldType =
  | "text"
  | "number"
  | "boolean"
  | "datetime"
  | "array-number"
  | "array-string"
  | "country-picker"
  | "state-picker"
  | "language-select"
  // Searchable IANA zone picker. Separate from a plain select because there are
  // ~400 zones — a dropdown that long is unusable without a filter.
  | "timezone-select"
  | "free-spin-config-select"
  // Plain dropdown over a fixed set, supplied per-field via `options`. Use this
  // for any stored union type — a free-text input for a value the backend
  // narrows to 'PLATFORM' | 'USER' lets a typo through, and a typo silently
  // reads as the default rather than failing.
  | "select"
  | "device-limit-strategy-select"
  | "device-limit-mode-select"
  // Composite duration inputs. The stored value stays a single number (total
  // minutes for "duration-hm", total seconds for "duration-ms") so the backend
  // schema and every consumer are unchanged — only the editing UI splits it.
  | "duration-hm"
  | "duration-ms"
  // Multi-line free text. A plain "text" input works for a link or a name, but
  // an operator writing why the site is down needs room and line breaks.
  | "textarea"
  // Preset chips (30m / 1h / 2h / No timer) over a plain minutes value, plus a
  // custom box. Stored as a single number of minutes, 0 meaning "no countdown",
  // so the backend schema stays one field.
  | "maintenance-duration"
  // A wall-clock instant, edited as a local date+time and stored as ISO UTC.
  // Its own type because every other text field here stores what was typed:
  // this one has to convert on the way in and back out, or an operator in
  // Chicago schedules a window that fires at a different hour than the one they
  // picked.
  | "datetime"
  // Free-text list of IP addresses / CIDR ranges, stored as string[]. Its own
  // type rather than "array-string" because that one upper-cases every entry
  // for country codes, and because an address list is worth validating and
  // showing back as chips while it is being typed.
  | "ip-list";
export type RecordBooleanFieldType = "record-boolean";
export type RecordNumberFieldType = "record-number";

/**
 * Operator-facing explanation for one setting, shown behind the info icon next
 * to its label. Written for whoever is about to change the number, not for
 * whoever wrote the code: what it controls, what each value actually produces,
 * and the part that surprises people.
 */
export type FieldHelp = {
  /** One sentence: what this setting decides. */
  summary: string;
  /** Concrete outcomes — one line per value or behaviour. */
  details?: string[];
  /** The gotcha. Rendered last, visually separated. */
  caution?: string;
};

export type SelectOption = { value: string; label: string };

export type PrimitiveField = {
  path: string;
  label: string;
  type: PrimitiveFieldType;
  step?: string;
  min?: number;
  max?: number;
  /** Required for `type: "select"`, ignored otherwise. */
  options?: SelectOption[];
  /** `textarea` only — visible rows. Defaults to 4. */
  rows?: number;
  placeholder?: string;
  help?: FieldHelp;
};

export type RecordBooleanField = {
  path: string;
  label: string;
  type: RecordBooleanFieldType;
};

export type RecordNumberField = {
  path: string;
  label: string;
  type: RecordNumberFieldType;
  step?: string;
  min?: number;
  max?: number;
};

export type SectionDefinition = {
  /**
   * Backend SystemConfig section to PATCH on save. Two sections may share
   * the same `key` when one section in the schema is split into multiple
   * UI cards (e.g. Bonus Defaults + Welcome Free Spin both target
   * `bonus_defaults`).
   */
  key: keyof Omit<SystemConfig, "version">;
  /**
   * Unique React key + saving-state identifier. Defaults to `key` when
   * absent, so single-card sections need no change. Only required when
   * two cards share the same backend `key`.
   */
  id?: string;
  extraKeys?: Array<keyof Omit<SystemConfig, "version">>;
  title: string;
  layout?: "grid-2" | "grid-3" | "grid-4" | "rows";
  fields: Array<PrimitiveField | RecordBooleanField | RecordNumberField>;
  /**
   * Renders a "Preview" button under the section's fields.
   *
   * A marker rather than a component, because this file is plain `.ts` config
   * read by the settings search index — it cannot hold JSX. The page maps the
   * marker to the right preview modal.
   */
  preview?: "bundle-sale";
};

export const sectionId = (s: SectionDefinition): string => s.id ?? (s.key as string);

export const SECTION_DEFINITIONS: SectionDefinition[] = [
  {
    key: "general",
    title: "General Platform",
    fields: [
      {
        path: "general.maintenance_mode",
        label: "Maintenance Mode",
        type: "boolean",
        help: {
          summary:
            "Takes the player site down behind a curtain and stops the API accepting player requests.",
          details: [
            "Players get a 503 with the maintenance page — search engines read that as temporary, not as a dead site.",
            "Staff keep working: the admin panel, sign-in and this settings page all stay reachable.",
            "Provider callbacks and payment settlements keep running, so nothing already paid for is stranded.",
          ],
          caution:
            "Set the type and duration FIRST, then switch this on — an instant window closes the site the moment you save.",
        },
      },
      {
        path: "general.maintenance_type",
        label: "Maintenance Type",
        type: "select",
        options: [
          { value: "instant", label: "Instant — close the site on save" },
          { value: "scheduled", label: "Scheduled — warn players first" },
        ],
        help: {
          summary:
            "Whether switching Maintenance Mode on closes the site now, or at a time you pick.",
          details: [
            "Instant is the emergency setting: the moment you save, players see the curtain.",
            "Scheduled keeps the site open until the start time and shows players a countdown warning beforehand, so nobody begins a deposit or a game minutes before it closes.",
            "Turning Maintenance Mode off works the same for both, and clears any schedule.",
          ],
          caution:
            "A scheduled window closes the site BY ITSELF at the start time — nobody has to be watching.",
        },
      },
      {
        path: "general.maintenance_starts_at",
        label: "Scheduled Start",
        type: "datetime",
        help: {
          summary:
            "When a scheduled window begins. Ignored while the type is Instant.",
          details: [
            "Entered and shown in YOUR browser's local time; stored in UTC so every player counts down to the same instant.",
            "The site closes on its own within a few seconds of this time.",
            "The expected duration below is measured from this moment, not from when you saved.",
          ],
          caution:
            "Must be in the future. Saving a past time is refused rather than silently closing the site immediately.",
        },
      },
      {
        path: "general.maintenance_warning_lead_minutes",
        label: "Warn Players Before",
        type: "duration-hm",
        help: {
          summary:
            "How far ahead of the scheduled start players start seeing the warning banner.",
          details: [
            "0 means warn as soon as it is scheduled — the honest choice for a window announced days ahead.",
            "Set a lead when you want the window armed early but announced late, e.g. warn 30 minutes before.",
            "The banner counts down and disappears when the window begins and the curtain takes over.",
          ],
        },
      },
      {
        path: "general.maintenance_duration_minutes",
        label: "Expected Duration",
        type: "maintenance-duration",
        help: {
          summary: "How long the window should last. Drives the countdown players see.",
          details: [
            "No timer — the curtain shows no clock. Use this when the finish time is genuinely unknown.",
            "The clock starts when you save with Maintenance Mode ON, and again if you change this while it is on.",
            "Saving an unrelated setting during a window does not restart it.",
          ],
          caution:
            "If the window overruns, the clock disappears rather than sitting at zero. Nothing auto-lifts the curtain — you still switch it off by hand.",
        },
      },
      {
        path: "general.maintenance_message",
        label: "Maintenance Message",
        type: "textarea",
        rows: 4,
        placeholder:
          "Leave blank to use the default message (translated into every supported language).",
        help: {
          summary: "Replaces the default explanation on the maintenance page.",
          details: [
            "Blank is fine — the shipped copy is translated and always reads sensibly.",
            "Line breaks are preserved, so you can write more than one line.",
            "Shown exactly as typed and NOT translated, so anything written here reaches every player in that one language.",
          ],
        },
      },
      {
        path: "general.maintenance_allowed_ips",
        label: "Maintenance IP Allowlist",
        type: "ip-list",
        help: {
          summary:
            "Addresses that keep seeing the real site while Maintenance Mode is on.",
          details: [
            "Type one address and press Add IP — repeat for as many as you need.",
            "IPv4 and IPv6 both work, and a whole network can be added as a range, e.g. 203.0.113.0/24.",
            "Applies to the player site — a listed address browses and plays normally while everyone else gets the maintenance page.",
          ],
          caution:
            "Adding an address does not apply it — the section still has to be saved.",
        },
      },
      {
        path: "general.customer_service_link",
        label: "Customer Service Link",
        type: "text",
      },
      {
        path: "general.default_language",
        label: "Default Language",
        type: "language-select",
      },
      {
        path: "general.default_timezone",
        label: "Default Timezone (business calendar & fallback)",
        type: "timezone-select",
      },
    ],
  },
  {
    key: "games_controls",
    title: "Games Controls",
    fields: [
      {
        path: "games_controls.games_enabled",
        label: "Games Enabled",
        type: "boolean",
      },
      // {
      //   path: "games_controls.new_game_badge_days",
      //   label: "New Game Badge Days",
      //   type: "number",
      //   min: 0,
      // },
      {
        path: "games_controls.provider_enable_flags",
        label: "Provider Enable Flags",
        type: "record-boolean",
      },
      {
        path: "games_controls.category_enable_flags",
        label: "Category Enable Flags",
        type: "record-boolean",
      },
    ],
  },
  {
    key: "deposit",
    // The bundle multiplier is stored under bonus_defaults in the backend, but
    // surfaced here in Package Purchase — so this card also PATCHes bonus_defaults.
    extraKeys: ["bonus_defaults"],
    title: "Package Purchase",
    layout: "rows",
    fields: [
      {
        path: "deposit.deposit_enabled",
        label: "Package Purchase Enabled",
        type: "boolean",
      },
      // On: picking a bundle opens the Complete Profile form first for players
      // with an incomplete profile. Off: the bundle goes straight to payment.
      {
        path: "deposit.require_profile_completion",
        label: "Require Profile Completion Before Purchase",
        type: "boolean",
      },
      {
        path: "deposit.min_deposit_amount",
        label: "Min Package Purchase Amount",
        type: "number",
        step: "0.01",
        min: 0,
      },
      {
        path: "deposit.max_deposit_amount",
        label: "Max Package Purchase Amount",
        type: "number",
        step: "0.01",
        min: 0,
      },
      {
        path: "deposit.daily_deposit_limit",
        label: "Daily Package Purchase Limit",
        type: "number",
        step: "0.01",
        min: 0,
      },
      {
        path: "deposit.monthly_deposit_limit",
        label: "Monthly Package Purchase Limit",
        type: "number",
        step: "0.01",
        min: 0,
      },
      {
        path: "bonus_defaults.default_wagering_multiplier",
        label: "Package Purchase Bundle Multiplier",
        type: "number",
        step: "0.01",
        min: 0,
      },
    ],
  },
  {
    key: "withdraw_redeem",
    extraKeys: ["spin_redeem"],
    title: "Wallet & Redeem",
    layout: "grid-3",
    fields: [
      {
        path: "withdraw_redeem.withdraw_enabled",
        label: "Withdraw Enabled",
        type: "boolean",
        help: {
          summary:
            "Master switch for taking money off the platform. Checked first on every redeem request.",
          details: [
            "Off: every redeem is refused with \"Withdrawals are currently disabled by system configuration\".",
            "Payouts already created keep running — this blocks new requests, it does not freeze money in flight.",
          ],
          caution:
            "This and Redeem Enabled both gate the same request. Either one switched off stops redemptions, so check both when redeems are being refused.",
        },
      },
      {
        path: "withdraw_redeem.redeem_enabled",
        label: "Redeem Enabled",
        type: "boolean",
        help: {
          summary:
            "Switch for the redeem flow specifically, checked immediately after Withdraw Enabled.",
          details: [
            "Off: the request is refused with \"Redeem requests are currently disabled by system configuration\".",
            "Use this to pause redemptions while leaving the rest of the wallet alone.",
          ],
        },
      },
      {
        path: "withdraw_redeem.require_kyc_on_redeem",
        label: "Require KYC on Redeem",
        type: "boolean",
        help: {
          summary:
            "Requires an approved KYC profile before a player can start a redemption.",
          details: [
            "On: Claim opens the verification gate instead of creating the request, until the player is approved.",
            "Off: players redeem without verifying with us first.",
          ],
          caution:
            "Turning this off does not skip identity checks entirely — Breeze and Coinflow run their own KYC on the payout page before releasing funds.",
        },
      },
      {
        path: "withdraw_redeem.require_profile_completion_on_kyc",
        label: "Require Profile Completion Before KYC",
        type: "boolean",
        help: {
          summary:
            "Collects missing profile details before handing the player to the Sumsub verification widget.",
          details: [
            "On (default): Start KYC opens the Complete Profile form when name, email, phone, date of birth, gender or country is missing.",
            "Off: the player goes straight into Sumsub and supplies those details there.",
          ],
          caution:
            "Sumsub matches the document against the name, date of birth and country we already hold, so verifying with an empty profile tends to fail.",
        },
      },
      {
        path: "withdraw_redeem.auto_release_payout_threshold",
        label: "Auto-Release Limit (0 = always manual)",
        type: "number",
        step: "0.01",
        min: 0,
        help: {
          summary:
            "The one money gate on player redemptions. It decides who releases the funds — nothing else.",
          details: [
            "At or below this amount: the provider releases the payout as soon as the player submits their details. No admin involved.",
            "Above this amount: the payout waits at PENDING_MERCHANT_RELEASE until an admin presses Release in the withdrawal listing.",
            "0 turns auto-release off completely, so every payout waits for an admin.",
          ],
          caution:
            "This is a ceiling, not an on/off switch. It no longer affects whether a payout page is created — every redemption reaches the payment-details form either way.",
        },
      },
      // Hidden: agent payouts are governed by the Affiliate Management "Auto
      // Approval Threshold" (Payout/Days Settings). Showing a second agent limit
      // here disagreed with that one.
      // {
      //   path: "withdraw_redeem.agent_auto_release_payout_threshold",
      //   label: "Agent Payout Auto-Release Limit (0 = always manual)",
      //   type: "number",
      //   step: "0.01",
      //   min: 0,
      //   help: {
      //     summary:
      //       "The same release gate, applied to agent and sub-agent payouts instead of player redemptions.",
      //     details: [
      //       "At or below this amount: the agent payout releases on its own.",
      //       "Above it, or 0: the payout waits for Release in the agent payout-requests queue.",
      //     ],
      //     caution:
      //       "Deliberately separate from the player limit — affiliate payouts run far larger than a player redemption, so one shared ceiling would be wrong for both.",
      //   },
      // },
      // The fallback gateway used when a request reaches payout creation without
      // an explicit pick. Previously read by both the backend and the withdrawal
      // listing while having no control anywhere in the UI — an admin could not
      // change a setting that was actively steering money.
      {
        path: "withdraw_redeem.default_payout_provider",
        label: "Default Payout Provider",
        type: "select",
        options: [
          { value: "BREEZE", label: "Breeze" },
          { value: "COINFLOW", label: "Coinflow" },
        ],
        help: {
          summary:
            "Which gateway is used when a redemption reaches payout creation without the player having picked one.",
          details: [
            "Normally the player chooses on the Claim screen and that choice wins.",
            "This only applies when no choice was recorded, and when an admin opens a payout from the withdrawal listing.",
          ],
          caution:
            "Which gateways players can pick from at all is set in Settings → Payment Manager, not here.",
        },
      },
      // "Payout Method" used to live here as a single Breeze/Coinflow/Both
      // select. It is now Settings → Payment Manager, which controls the same
      // thing per audience and down to the individual rail. Two controls for one
      // setting is worse than one, so this no longer renders — the stored
      // `withdraw_redeem.user_payout_method` is only read once, to seed Payment
      // Manager for a config saved before that screen existed.
      {
        path: "withdraw_redeem.redeem_daily_limit_enabled",
        label: "Daily Redeem Limit Enabled",
        type: "boolean",
        help: {
          summary: "Turns the daily redemption cap on or off.",
          details: [
            "Off: the amount and scope below are ignored and no daily cap applies.",
          ],
        },
      },
      {
        path: "withdraw_redeem.redeem_daily_limit_amount",
        label: "Daily Redeem Limit (Wulf Cash)",
        type: "number",
        min: 0,
        help: {
          summary: "How much can be redeemed per day, in Wulf Cash.",
          details: [
            "Counts requests that are pending, approved or already processed.",
            "A declined request gives its allowance back.",
          ],
          caution:
            "Whether this is one shared budget or a per-player allowance depends entirely on the scope setting next to it.",
        },
      },
      {
        path: "withdraw_redeem.redeem_daily_limit_scope",
        label: "Daily Redeem Limit Scope",
        type: "select",
        options: [
          { value: "PLATFORM", label: "PLATFORM — one budget shared by everyone" },
          { value: "USER", label: "USER — each player gets the full amount" },
        ],
        help: {
          summary: "Who the daily limit is measured against.",
          details: [
            "PLATFORM (default): a single shared budget across all players, resetting at midnight in the platform timezone.",
            "USER: every player gets the full amount, resetting at their own local midnight.",
          ],
          caution:
            "PLATFORM is far stricter than it looks — a handful of players can exhaust the whole day's budget for everyone else.",
        },
      },
      {
        path: "withdraw_redeem.min_redemption_chips",
        label: "Min Redemption (chips)",
        type: "number",
        min: 0,
        help: {
          summary: "Smallest amount a player may redeem in one request.",
          details: [
            "Anything below is refused before the request is created.",
            "0 removes the minimum.",
          ],
        },
      },
      // Renamed from "Max Pending Requests": the count has always included
      // APPROVED as well as PENDING, and since redemptions are now born APPROVED
      // the old label described a state most requests never sit in.
      {
        path: "withdraw_redeem.max_pending_requests",
        label: "Max Open Redemptions (per player)",
        type: "number",
        min: 0,
        help: {
          summary:
            "How many unfinished redemptions one player may hold at the same time.",
          details: [
            "Counts every redemption that has not yet been paid out, cancelled or declined.",
            "A slot frees up when one of those reaches a final state.",
            "0 removes the cap.",
          ],
          caution:
            "This is a concurrent cap, not a daily one — it does not reset overnight.",
        },
      },
      {
        path: "spin_redeem.w9_enabled",
        label: "W-9 Form Required",
        type: "boolean",
        help: {
          summary:
            "Master switch for the W-9 requirement. Also editable from Tax Forms → Settings.",
          details: [
            "ON — a player who passes the yearly threshold must submit a W-9 and have it verified before redeeming again.",
            "OFF — nobody is asked for a W-9 and no redeem is ever blocked for the lack of one, whatever they have redeemed. The threshold below stops applying.",
            "Forms already submitted are kept and stay visible under Tax Forms either way.",
          ],
          caution:
            "The gate exists to satisfy a US tax-reporting obligation, not as a UX preference. Turn it off only where compliance has said it does not apply.",
        },
      },
      {
        path: "spin_redeem.w9_threshold_amount",
        label: "W-9 Threshold Amount",
        type: "number",
        step: "0.01",
        min: 0,
        help: {
          summary:
            "Yearly redemption total after which a player must submit a W-9 before redeeming again.",
          details: [
            "Measured against the running total for the calendar year, not a single request.",
          ],
          caution:
            "A US tax reporting obligation. Change it only on advice from whoever owns compliance.",
        },
      },
    ],
  },
  {
    // Stored under bonus_defaults in the backend schema, surfaced as its own
    // card in the admin UI so operators can find and toggle the welcome bonus
    // independently of generic bonus defaults. Both cards PATCH the same
    // bonus_defaults section, so save order doesn't matter.
    key: "bonus_defaults",
    id: "welcome_free_spin",
    title: "Welcome Free Spin",
    fields: [
      {
        path: "bonus_defaults.welcome_free_spin_enabled",
        label: "Welcome Free Spin (one-time, on signup)",
        type: "boolean",
      },
      {
        path: "bonus_defaults.welcome_free_spin_config_id",
        label: "Welcome Free Spin Config",
        type: "free-spin-config-select",
      },
    ],
  },
  {
    key: "promotion_defaults",
    extraKeys: ["cashback_defaults", "bonus_defaults"],
    title: "Reward Management",
    // Lets an admin see the sale pop-up with the copy they are typing, before
    // saving — the whole point of making the wording editable.
    preview: "bundle-sale",
    fields: [
      {
        path: "promotion_defaults.promotion_enabled",
        label: "Promotion Enabled",
        type: "boolean",
      },
      {
        path: "cashback_defaults.cashback_enabled",
        label: "Cashback Enabled",
        type: "boolean",
      },
      {
        // QA switch: cashback runs on short rolling windows (hourly 5m, daily
        // 10m, weekly 15m, monthly 30m) instead of real calendar periods.
        // Takes effect within a minute of saving — no backend restart. Keep
        // OFF in production.
        path: "cashback_defaults.cashback_test_mode",
        label: "Cashback Test Mode (QA: 5m/10m/15m/30m windows)",
        type: "boolean",
      },
      {
        path: "bonus_defaults.bonus_enabled",
        label: "Bonus Enabled",
        type: "boolean",
      },
      {
        path: "bonus_defaults.default_kyc_required",
        label: "Default KYC Required",
        type: "boolean",
      },
      // Copy for the discounted-bundle pop-up shown after login. Guidance lives
      // in the labels because this field schema has no `description` prop and
      // adding one would mean touching every section renderer.
      {
        path: "promotion_defaults.bundle_sale_title",
        label: "Sale Pop-up Headline (blank = \"Pay less get more\")",
        type: "text",
      },
      {
        path: "promotion_defaults.bundle_sale_subtitle",
        label: "Sale Pop-up Sub-line (blank = hidden; {savings} = biggest saving)",
        type: "text",
      },
    ],
  },
  {
    key: "profile_completion",
    title: "Profile Completion Prompt",
    layout: "rows",
    fields: [
      {
        path: "profile_completion.prompt_enabled",
        label: "Show Complete Profile Prompt",
        type: "boolean",
        help: {
          summary:
            "Master switch for the Complete Profile banner shown to players whose profile is unfinished.",
          details: [
            "Off: the banner never renders, on any page.",
            "The reward itself is unaffected — it is still granted when the profile is saved.",
          ],
        },
      },
      {
        path: "profile_completion.prompt_frequency",
        label: "How Often It Reappears",
        type: "select",
        options: [
          { value: "SESSION", label: "Once per login session (recommended)" },
          { value: "ALWAYS", label: "Every time (QA only)" },
          { value: "DAILY", label: "Once per 24 hours" },
          { value: "ONCE", label: "Once per device, ever" },
        ],
        help: {
          summary:
            "How long a dismissal silences the prompt — the same rule the daily-streak and welcome pop-ups follow.",
          details: [
            "Once per login session: closing it hides it until the next login. A page refresh does not bring it back.",
            "Every time: no suppression at all — it returns on every page change. For checking the design, not for players.",
            "Once per 24 hours: a dismissal survives logout, so a player who signs back in to finish setting up sees nothing.",
            "Once per device, ever: the player gets one chance to act on it.",
          ],
          caution:
            "\"Every time\" is genuinely relentless for players — it re-appears on every navigation until the profile is finished.",
        },
      },
      {
        path: "profile_completion.show_reward_badge",
        label: "Advertise the Reward Amount",
        type: "boolean",
        help: {
          summary:
            "Whether the prompt names what the player earns for finishing their profile.",
          details: [
            "The amount and currency come from the active Profile Complete bonus (Bonus Management) — not from this page.",
            "With no active Profile Complete bonus the prompt shows no reward regardless of this switch.",
          ],
        },
      },
      {
        path: "profile_completion.prompt_on_buy",
        label: "Show on Buy Gold Coin",
        type: "boolean",
      },
      {
        path: "profile_completion.prompt_on_redeem",
        label: "Show on Redeem",
        type: "boolean",
      },
      {
        path: "profile_completion.prompt_on_wallet",
        label: "Show on Wallet",
        type: "boolean",
      },
      {
        path: "profile_completion.prompt_on_kyc",
        label: "Show on KYC",
        type: "boolean",
      },
      {
        path: "profile_completion.prompt_on_referral",
        label: "Show on Referrals",
        type: "boolean",
      },
      {
        path: "profile_completion.prompt_title",
        label: "Prompt Headline (blank = default copy)",
        type: "text",
      },
      {
        path: "profile_completion.prompt_subtitle",
        label: "Prompt Sub-line (blank = default; {reward} = reward amount)",
        type: "text",
      },
    ],
  },
  {
    key: "tournament_raffle",
    title: "Tournament & Jackpot",
    fields: [
      {
        path: "tournament_raffle.tournament_enabled",
        label: "Tournament Enabled",
        type: "boolean",
      },
      {
        path: "tournament_raffle.raffle_enabled",
        label: "Jackpot Enabled",
        type: "boolean",
      },
    ],
  },
  {
    key: "audit_safety",
    title: "Activity Log Retention",
    fields: [
      {
        path: "audit_safety.activity_log_purge_enabled",
        label: "Auto-Delete Old Activity Logs",
        type: "boolean",
        help: {
          summary:
            "Lets a nightly job delete Settings → Activity Log rows once they fall outside the window below.",
          details: [
            "ON — every night at 4am, anything older than the retention window is deleted.",
            "OFF — nothing is ever deleted and the window below is ignored; the log keeps growing.",
          ],
          caution:
            "The delete is permanent. There is no archive, no export and no undo — once a row is gone, 'who changed this setting last month' has no answer.",
        },
      },
      {
        path: "audit_safety.activity_log_retention_days",
        label: "Keep Activity Logs For (days)",
        type: "number",
        min: 1,
        max: 3650,
        help: {
          summary:
            "How much admin-action history the Activity Log page holds. 7 means the page only ever shows the last week.",
          details: [
            "Counted from each row's own timestamp, so the window slides forward every night.",
            "Ignored entirely while Auto-Delete above is OFF.",
          ],
          caution:
            "Lowering this deletes the history between the old and new window on the next nightly run. Check your jurisdiction's audit-retention requirement before going below it — most require far longer than 7 days.",
        },
      },
    ],
  },
  {
    key: "feature_flags",
    title: "Feature Flags",
    fields: [
      {
        path: "feature_flags.medal_enabled",
        label: "Medal Enabled",
        type: "boolean",
      },
      {
        path: "feature_flags.subscription_tier_enabled",
        label: "Subscription Tier Enabled",
        type: "boolean",
      },
      {
        path: "feature_flags.daily_streak_enabled",
        label: "Daily Streak Enabled",
        type: "boolean",
      },
      {
        path: "feature_flags.vip_tier_enabled",
        label: "VIP Tier Enabled",
        type: "boolean",
      },
      {
        path: "feature_flags.user_local_day_enabled",
        label: "User-Local Day Boundaries (daily reward, spins, deposit limits)",
        type: "boolean",
      },
    ],
  },
  {
    key: "geofence",
    title: "Geofence Controls",
    layout: "grid-2",
    fields: [
      {
        path: "geofence.enabled",
        label: "Geofence Enabled",
        type: "boolean",
      },
      {
        path: "geofence.block_unknown_country",
        label: "Block Unknown Country",
        type: "boolean",
      },
      {
        path: "geofence.block_vpn",
        label: "Block VPN / Proxy",
        type: "boolean",
      },
      {
        path: "geofence.allowed_country_codes",
        label: "Allowed Countries",
        type: "country-picker",
      },
      {
        path: "geofence.restricted_state_codes",
        label: "Restricted States",
        type: "state-picker",
      },
      {
        path: "geofence.allowed_ips",
        label: "Whitelisted IPs (skip geofence)",
        type: "ip-list",
      },
    ],
  },
  {
    key: "responsible_gaming",
    title: "Responsible Gaming",
    layout: "grid-2",
    fields: [
      {
        path: "responsible_gaming.enabled",
        label: "Responsible Gaming Enabled",
        type: "boolean",
        help: {
          summary:
            "Master switch for the restriction engine. Off means players can still start a break or self-exclude and see their status, but nothing is enforced anywhere.",
          details: [
            "Off: restrictions are recorded and shown back to the player, and no gameplay, deposit, bonus or login is ever refused because of one.",
            "On: the Enforcement Stage below decides whether refusals are real or only logged.",
          ],
          caution:
            "This is the one setting here that can stop a player signing in. Move it to Shadow first and read the logs before enforcing.",
        },
      },
      {
        path: "responsible_gaming.mode",
        label: "Enforcement Stage",
        type: "select",
        options: [
          { value: "off", label: "Off — record only" },
          // Shadow is intentionally NOT offered here.
          //
          // It allows everything through and writes a [RG_SHADOW] line for each
          // would-be refusal, so its only value is to somebody who reads those
          // lines and acts on them. As a dropdown entry it does the opposite:
          // it looks identical to having checked, so an operator can sit on it
          // for months believing restrictions are live while nothing is being
          // blocked at all. A rollout gate nobody reads is worse than no gate.
          //
          // The backend still understands 'shadow' (see RestrictionStateService)
          // so any config already saved with it keeps behaving as before. To run
          // a staged rollout, set it directly and watch the API log.
          // { value: "shadow", label: "Shadow — log what would be blocked" },
          { value: "enforce", label: "Enforce — actually block" },
        ],
        help: {
          summary:
            "How far the engine goes once enabled. Only read when Responsible Gaming Enabled is on.",
          details: [
            "Off: nothing is blocked anywhere, whatever players have set for themselves.",
            "Enforce: restrictions gate gameplay, purchases, bonuses, promotions, marketing and — for self-exclusion — login and redeem.",
          ],
          caution:
            "Switch to Enforce on a quiet weekday morning with someone watching support, never on a Friday. There is no undo for a player who was wrongly refused.",
        },
      },
      {
        path: "responsible_gaming.features.pause",
        label: "Offer: Take a Break",
        type: "boolean",
        help: {
          summary:
            "Whether players are offered the temporary self-imposed pause (24 hours / 1 week / 1 month).",
          details: [
            "Off: the Take a Break block disappears from the player's Responsible Play screen and the API refuses to start a new one.",
            "Breaks ALREADY running keep running, stay enforced, and stay visible to the player until they expire.",
          ],
          caution:
            "Withdrawing this removes a player's ability to stop themselves playing. Check it against your published Responsible Play page before switching it off.",
        },
      },
      {
        path: "responsible_gaming.features.self_exclusion",
        label: "Offer: Self-Exclusion",
        type: "boolean",
        help: {
          summary:
            "Whether players are offered self-exclusion (6 months / 1 year / permanently).",
          details: [
            "Off: the Self-Exclusion block is hidden and no new exclusion can be started.",
            "Existing self-exclusions are UNAFFECTED — the account stays closed and login stays blocked.",
          ],
          caution:
            "This is the strongest protection a player has, and it is usually a regulatory expectation. Do not switch it off without compliance sign-off.",
        },
      },
      {
        path: "responsible_gaming.features.deposit_limits",
        label: "Offer: Deposit Limits",
        type: "boolean",
        help: {
          summary:
            "Whether players can set their own daily / weekly / monthly deposit caps.",
          details: [
            "Off: the Deposit limit block is hidden and no new cap can be set.",
            "Caps already set STILL BLOCK deposits, and stay on screen so the player can remove them.",
          ],
          caution:
            "This does not affect the platform-wide deposit limits under Deposit — those are separate and keep applying.",
        },
      },
      {
        path: "responsible_gaming.features.loss_limits",
        label: "Offer: Loss Limits",
        type: "boolean",
        help: {
          summary:
            "Whether players can cap their own net loss over a day, week or month.",
          details: [
            "Off: the Loss limit block is hidden and no new cap can be set.",
            "Caps already set still pause play when reached.",
          ],
        },
      },
      {
        path: "responsible_gaming.features.session_limits",
        label: "Offer: Session Limits",
        type: "boolean",
        help: {
          summary:
            "Whether players can cap how long a single stretch of play runs.",
          details: [
            "Off: the Session limit block is hidden and no new cap can be set.",
            "Caps already set still stop play when reached.",
          ],
          caution:
            "A session ends after the Session Idle Gap below. If you offer this control, check that gap is set to something a player would recognise as a break.",
        },
      },
      {
        path: "responsible_gaming.features.activity_dashboard",
        label: "Offer: Gaming Activity Dashboard",
        type: "boolean",
        help: {
          summary:
            "The read-only panel showing games, rounds, time and amounts for today, this week and this month.",
          details: [
            "Off: the panel is hidden. Nothing is enforced by it either way — it only reports.",
          ],
        },
      },
      {
        path: "responsible_gaming.features.reality_check",
        label: "Offer: Reality Check Nudge",
        type: "boolean",
        help: {
          summary:
            "The in-session reminder telling a player how long they have been playing.",
          details: [
            "Off: the nudge never appears, whatever the interval below is set to.",
            "Suppressed on the server, not just hidden by the app.",
          ],
        },
      },
      {
        path: "responsible_gaming.limit_increase_cooling_off_hours",
        label: "Limit Increase Cooling-Off (hours)",
        type: "number",
        min: 0,
        // Fractions are meaningful here and are the only way to test the
        // feature without waiting a day: 0.1 is six minutes. Without a decimal
        // step the browser rejects anything but whole hours.
        step: "0.1",
        help: {
          summary:
            "How long a request to RAISE a self-imposed limit waits before it takes effect. Lowering a limit is always immediate.",
          details: [
            "The delay is the control. A player acting on an impulse to deposit more is exactly who it is for.",
          ],
          caution:
            "Zero removes the wait entirely, which defeats the purpose of having player-set limits at all.",
        },
      },
      {
        path: "responsible_gaming.session_idle_gap_minutes",
        label: "Session Idle Gap (minutes)",
        type: "number",
        min: 1,
        help: {
          summary:
            "How long a player has to stop playing before their per-session play limit resets.",
          details: [
            "A session limit needs a definition of \"session\" that resets on its own. This is it: a break longer than this ends the session, and the next round starts a fresh one.",
            "Only affects the per-session play limit. Daily, weekly and monthly limits reset on the calendar instead.",
          ],
          caution:
            "Set this too high and a player who stops for lunch comes back still blocked. Too low and the limit never fires, because every round starts a new session.",
        },
      },
      {
        path: "responsible_gaming.reality_check_minutes",
        label: "Reality Check Interval (minutes)",
        type: "number",
        min: 0,
        help: {
          summary:
            "Minutes of continuous play before the player is shown how long they have been playing.",
          details: ["0 disables the reminder."],
        },
      },
    ],
  },
  {
    key: "security",
    title: "Security & Session",
    layout: "grid-2",
    fields: [
      {
        path: "security.idle_logout_minutes",
        label: "Idle Auto-Logout",
        type: "duration-hm",
        min: 1,
      },
      {
        path: "security.idle_warning_seconds",
        label: "Idle Warning Countdown",
        type: "duration-ms",
        min: 1,
      },
      // Device limit. Off by default: this is the one setting on this screen
      // that can stop a paying player signing in, so it has to be switched on
      // deliberately rather than arrive with a deploy.
      //
      // Field ORDER matters for comprehension — enable, then how the allowance
      // is decided, then the number, then what happens at the ceiling.
      {
        path: "security.device_limit_enabled",
        label: "Enforce Device Limit",
        type: "boolean",
      },
      {
        path: "security.device_limit_mode",
        label: "Device Limit Source",
        type: "device-limit-mode-select",
      },
      {
        path: "security.allow_number_of_devices",
        label: "Default Devices Per User",
        type: "number",
        min: 1,
        max: 50,
      },
      {
        path: "security.device_limit_strategy",
        label: "When Device Limit Is Reached",
        type: "device-limit-strategy-select",
      },
      // Cloudflare Turnstile. Off is listed first because the select falls back
      // to the first option for any unrecognised stored value.
      {
        path: "security.turnstile_mode",
        label: "Cloudflare Turnstile (Bot Check)",
        type: "select",
        options: [
          { value: "off", label: "Off — no check" },
          { value: "shadow", label: "Shadow — check and log, never block" },
          { value: "enforce", label: "Enforce — refuse failed checks" },
        ],
        help: {
          summary:
            "Whether players must pass a Cloudflare bot check to sign in, sign up, reset a password, deposit, subscribe or cash out.",
          details: [
            "Off: nothing is checked and the player site never loads the widget.",
            "Shadow: every check runs and failures are written to the API logs as \"shadow would-reject\", but no player is refused. Use it to see what Enforce would block.",
            "Enforce: a missing, invalid, expired or reused check is refused. Most players never see anything; a few get a one-click challenge.",
            "If Cloudflare itself is unreachable, requests are let through and logged, in every mode.",
          ],
          caution:
            "Stays off until the API has its Cloudflare keys, whatever is chosen here. Run Shadow first and read the logs before choosing Enforce.",
        },
      },
    ],
  },
  /*
  {
    key: "risk_compliance",
    title: "Risk & Compliance",
    layout: "grid-3",
    fields: [
      {
        path: "risk_compliance.seon_block_vpn",
        label: "SEON Block VPN",
        type: "boolean",
      },
      {
        path: "risk_compliance.seon_registration_score_block",
        label: "Registration Score Block",
        type: "number",
        min: 0,
        max: 100,
      },
      {
        path: "risk_compliance.seon_registration_score_stepup",
        label: "Registration Score Step-up",
        type: "number",
        min: 0,
        max: 100,
      },
      {
        path: "risk_compliance.seon_login_score_block",
        label: "Login Score Block",
        type: "number",
        min: 0,
        max: 100,
      },
      {
        path: "risk_compliance.seon_login_score_stepup",
        label: "Login Score Step-up",
        type: "number",
        min: 0,
        max: 100,
      },
      {
        path: "risk_compliance.seon_default_score_block",
        label: "Default Score Block",
        type: "number",
        min: 0,
        max: 100,
      },
      {
        path: "risk_compliance.seon_default_score_stepup",
        label: "Default Score Step-up",
        type: "number",
        min: 0,
        max: 100,
      },
      {
        path: "risk_compliance.seon_failure_mode",
        label: "SEON Failure Mode",
        type: "text",
      },
    ],
  },
  */
];
