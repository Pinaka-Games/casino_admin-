/**
 * Operator guide for System Configuration.
 *
 * One entry per setting, keyed by the same `path` the editor uses. Written for
 * whoever is about to change the value, not for whoever wrote the code:
 *
 *   what   — what the setting IS, in one line.
 *   does   — what actually happens when you change it.
 *   impact — who feels it, and what breaks or unblocks. The consequence.
 *   example— one concrete case with real numbers or wording.
 *
 * This replaced the per-field info dialog. That dialog put an explanation
 * behind a click on every single row, which meant the page carried a modal for
 * a document nobody could read end to end — you could only ever see one setting
 * at a time, and never compare two that interact (Withdraw Enabled and Redeem
 * Enabled gate the same request; the daily limit means something completely
 * different depending on its scope). One guide, openable from the header and
 * searchable, shows the whole picture.
 *
 * A path missing from here still renders in the guide, using its label and the
 * legacy `help` block on the field schema, so nothing silently disappears when
 * a new setting is added before its entry is written.
 */

export type SettingGuide = {
  /** What the setting is. */
  what: string;
  /** What changing it actually does. */
  does: string;
  /** The consequence — who feels it and what it costs. */
  impact: string;
  /** One concrete case. */
  example: string;
};

export const SETTING_GUIDE: Record<string, SettingGuide> = {
  // ── General Platform ─────────────────────────────────────────────────────
  "general.maintenance_mode": {
    what: "Site-wide curtain that takes the player site out of service.",
    does: "Every player page answers with the maintenance screen and a 503. The API itself stays live: the admin panel, staff sign-in, provider callbacks and payment settlements all keep working. WHEN it takes effect depends on Maintenance Type: instantly on save, or at the scheduled start time.",
    impact:
      "Players cannot reach the site once the curtain is up. Money already in flight is not frozen: the API keeps answering, so a card already charged still credits its coins. With a scheduled window this switch being ON does not mean the site is down — it stays live until the start time.",
    example:
      "Before a database migration, switch it on, watch the sessions drain, migrate, switch it off. Players see the maintenance page instead of a broken lobby.",
  },
  "general.maintenance_type": {
    what: "Whether Maintenance Mode closes the site now or at a time you choose.",
    does: "Instant closes the site the moment you save it on. Scheduled keeps the site open until the Scheduled Start, shows players a warning banner in the run-up, and then closes the site by itself. Switching Maintenance Mode off works the same either way and clears the schedule.",
    impact:
      "Instant is the emergency path: it costs you every in-flight deposit and game session that has not finished. Scheduled trades speed for warning — players get told in advance and can stop before they lose a session, but the site keeps taking money right up to the start time.",
    example:
      "A security fix that cannot wait: Instant. A planned Sunday-night migration: Scheduled, start 02:00, warn 60 minutes before.",
  },
  "general.maintenance_starts_at": {
    what: "The moment a scheduled window begins.",
    does: "The site closes on its own within a few seconds of this time — nobody has to be watching. You pick it in your browser's local time and it is stored in UTC, so every player counts down to the same instant. Ignored while the type is Instant.",
    impact:
      "This is also the anchor for the expected duration, so the player-facing countdown runs from here, not from when you saved. A past time is refused on save rather than silently closing the site, so an armed window can never be a surprise outage.",
    example:
      "Set 2026-09-14 02:00 with a 60-minute lead: the site runs normally, players see the banner from 01:00, and the curtain goes up at 02:00 without anyone at a keyboard.",
  },
  "general.maintenance_warning_lead_minutes": {
    what: "How far ahead of a scheduled start players begin seeing the warning banner.",
    does: "Inside this lead the player site shows a dismissible amber banner with a live countdown to the start time. Nothing is blocked — the site works normally until the window begins, and the banner disappears when the curtain takes over.",
    impact:
      "The whole point is protecting money in flight: a player warned 30 minutes out finishes or postpones a deposit instead of having it die mid-payment. 0 means warn from the moment it is scheduled, which is the honest choice for a window announced days ahead. Too short and the warning arrives after they have already started.",
    example:
      "Overnight migration announced on Friday for Sunday: leave the lead at 0 so the banner is up all weekend. Quick 10-minute patch: 30 minutes is enough to clear the deposit flow.",
  },
  "general.maintenance_duration_minutes": {
    what: "How long the maintenance window is expected to last.",
    does: "Drives the countdown on the maintenance page. For an instant window the clock starts when you save with maintenance ON; for a scheduled one it is measured from the Scheduled Start. It restarts if you change this while maintenance is on. Saving any other setting mid-window leaves it alone.",
    impact:
      "Nothing lifts the curtain automatically — this is an estimate shown to players, not a schedule. If the window overruns, the countdown disappears rather than sitting at zero, and the site stays down until someone switches it off.",
    example:
      "A migration you expect to take 40 minutes: set 30 min or a custom 40, then switch maintenance on. Unsure how long it will take? Pick 'No timer' — no clock is better than one that expires while the site is still down.",
  },
  "general.maintenance_message": {
    what: "Your own wording on the maintenance page, in place of the default.",
    does: "Replaces the explanatory line. Line breaks survive, so it can be more than one sentence.",
    impact:
      "Shown exactly as typed and NOT translated, so whatever language you write in is what every player gets. Left blank, the shipped copy is used, which IS translated.",
    example:
      "'We are upgrading our payment system. Deposits and redemptions will be unavailable until this finishes.' — tells players which part is affected rather than leaving them guessing.",
  },
  "general.maintenance_allowed_ips": {
    what: "Addresses exempt from the maintenance curtain.",
    does: "A visitor arriving from one of these IPs gets the real site while Maintenance Mode is on. Everyone else still gets the maintenance page and a 503.",
    impact:
      "Anything done from an exempt address hits the live platform mid-window — including play and payments — so treat it as verification access, not a second staging site. Invalid entries are discarded on save rather than guessed at.",
    example:
      "Put the office range 203.0.113.0/24 here before a deploy, switch maintenance on, and the team checks the new build on the real site while players see the curtain.",
  },
  "general.customer_service_link": {
    what: "The URL behind the support / live-chat entry point.",
    does: "Replaces the destination of the support button across the player site.",
    impact:
      "A wrong or dead link silently strands every player who needs help — nothing errors, the button just goes nowhere useful.",
    example:
      "Moving from LiveChat to Intercom: paste the new workspace URL here and support traffic switches over with no deploy.",
  },
  "general.default_language": {
    what: "The language a visitor gets before they have chosen one.",
    does: "Sets the initial locale for new visitors and anyone who has never used the language switcher.",
    impact:
      "Only affects the default. A player who has picked a language keeps their choice — changing this will not flip existing players over.",
    example:
      "Launching in Latin America: set Spanish, and first-time visitors land on the Spanish site instead of English.",
  },
  "general.default_timezone": {
    what: "The platform's business calendar, and the fallback day boundary for any player whose own timezone we have never detected.",
    does: "Decides when 'today' starts and ends for daily limits, daily rewards, cashback windows and reports.",
    impact:
      "Moves every daily reset. A change mid-day can shorten or lengthen the current day once, which can hand out or withhold one extra daily reward cycle.",
    example:
      "Set to America/Chicago, the daily redeem budget resets at midnight Central — not at midnight for the player in Manila.",
  },

  // ── Games Controls ───────────────────────────────────────────────────────
  "games_controls.games_enabled": {
    what: "Master switch for game launching.",
    does: "Off: no game will open, whatever the per-provider and per-category switches say.",
    impact:
      "The lobby still renders, but every launch is refused. Use it to stop play without taking the whole site down with Maintenance Mode.",
    example:
      "A provider-wide balance incident: switch this off, reconcile, switch it back on — players keep their session and wallet.",
  },
  "games_controls.provider_enable_flags": {
    what: "One on/off switch per game provider.",
    does: "A provider switched off has its games hidden from the lobby and refused at launch.",
    impact:
      "Targeted: only that provider's catalogue goes away. Free spins already granted on that provider's games become unusable until it is switched back on.",
    example:
      "AleaPlay reports an outage: switch AleaPlay off so players stop hitting launch errors, leave every other provider live.",
  },
  "games_controls.category_enable_flags": {
    what: "One on/off switch per game category (slots, live, table…).",
    does: "Hides that category from the lobby and blocks launches inside it.",
    impact:
      "Cuts across providers — switching off 'Live' removes live games from every provider at once.",
    example:
      "Live-dealer studio down for maintenance overnight: switch Live off rather than each studio's provider.",
  },

  // ── Package Purchase ─────────────────────────────────────────────────────
  "deposit.deposit_enabled": {
    what: "Master switch for buying coin packages.",
    does: "Off: the purchase flow refuses every attempt, before the payment provider is contacted.",
    impact:
      "Stops all incoming revenue while it is off. Existing balances and gameplay are untouched.",
    example:
      "Switching payment providers: turn purchases off for the cutover so no payment lands on the old gateway mid-migration.",
  },
  "deposit.require_profile_completion": {
    what: "Whether an unfinished profile blocks checkout.",
    does: "On: picking a bundle opens the Complete Profile form instead of the payment step, until the profile has a name on it.",
    impact:
      "Adds a step in front of every first purchase. Better data, measurably fewer completed purchases — this is a conversion trade, not a free win.",
    example:
      "On: a brand-new player taps the $70 bundle and gets the profile form first. Off: they go straight to card entry.",
  },
  "deposit.min_deposit_amount": {
    what: "Smallest purchase amount accepted.",
    does: "Purchases below the amount are refused before payment.",
    impact:
      "Set above your cheapest bundle's price and that bundle becomes unbuyable, with no warning on the bundle itself.",
    example: "Set to 10: a $5 starter package is rejected at checkout.",
  },
  "deposit.max_deposit_amount": {
    what: "Largest single purchase accepted.",
    does: "Anything above is refused at checkout.",
    impact:
      "A responsible-gaming and fraud control. Too low blocks legitimate high rollers; too high removes a real safety net.",
    example: "Set to 30000: a single $50,000 purchase is refused; two $25,000 ones are not.",
  },
  "deposit.daily_deposit_limit": {
    what: "How much one player may spend in a day.",
    does: "Sums the player's purchases for the day and refuses the one that would cross the line.",
    impact:
      "The day boundary comes from Default Timezone — or from the player's own timezone when User-Local Day Boundaries is on.",
    example:
      "Limit 50,000: a player who has bought 48,000 today can still buy a 2,000 package, but not a 5,000 one.",
  },
  "deposit.monthly_deposit_limit": {
    what: "The same cap over a calendar month.",
    does: "Refuses the purchase that would take the month's total over the line.",
    impact:
      "Applies on top of the daily limit — the stricter of the two is what a player actually hits.",
    example: "Daily 50,000 with monthly 300,000: a player cannot sustain the daily maximum for a full month.",
  },
  "bonus_defaults.default_wagering_multiplier": {
    what: "The default playthrough multiplier applied to bonus money.",
    does: "Seeds the wagering requirement on bonuses that do not carry their own multiplier.",
    impact:
      "Directly sets how hard a bonus is to clear. Raising it makes existing offers meaningfully worse for players; it does not change bonuses that were already granted.",
    example: "20x on a 100 SC bonus means 2,000 SC must be wagered before it unlocks.",
  },

  // ── Wallet & Redeem ──────────────────────────────────────────────────────
  "withdraw_redeem.withdraw_enabled": {
    what: "Master switch for taking money off the platform.",
    does: "Off: every redeem request is refused with 'Withdrawals are currently disabled by system configuration'.",
    impact:
      "This and Redeem Enabled gate the same request — either one off stops redemptions, so check both when redeems are being refused. Payouts already created keep running.",
    example: "Provider incident: switch off, let support field the queries, switch back on when the gateway recovers.",
  },
  "withdraw_redeem.redeem_enabled": {
    what: "Switch for the redeem flow specifically, checked right after Withdraw Enabled.",
    does: "Off: the request is refused with 'Redeem requests are currently disabled by system configuration'.",
    impact: "Pauses redemptions while leaving the rest of the wallet — purchases, bonuses, play — alone.",
    example: "End-of-month reconciliation: pause redeems for an hour without touching the withdraw master switch.",
  },
  "responsible_gaming.enabled": {
    what: "The ON/OFF switch for everything in this section.",
    does:
      "OFF = nothing is blocked, ever. Players can still set breaks and limits, and still see them on screen \u2014 but they are just decoration. ON = the Enforcement Stage below decides what actually happens.",
    impact:
      "Leave this OFF and a paused player can still play. That is the single most common surprise with this feature: the screens all look right, so it seems to be working, but nothing is being stopped.",
    example:
      "A player sets a 7-day break. OFF: they open a game straight after, no problem. ON + Enforce: the game refuses to load.",
  },
  "responsible_gaming.mode": {
    what: "How hard the master switch above bites. Two settings: Off and Enforce.",
    does:
      "Off = nothing is blocked, same as the master switch being off. Enforce = real. Play, purchases, bonuses and promotions are actually stopped.",
    impact:
      "There is no halfway. Switch to Enforce on a quiet weekday morning with someone watching support, never on a Friday afternoon — a player wrongly refused a redemption cannot be un-refused.",
    example:
      "A player set a 7-day break. Off: they open a game, no problem. Enforce: the game refuses to load.",
  },
  "responsible_gaming.features.pause": {
    what: "Whether players are offered 'Take a Break' (24 hours, 1 week, or 1 month).",
    does: "ON = the option appears on their Responsible Play screen. OFF = it disappears.",
    impact:
      "Turning this off does NOT cancel breaks people are already on. It only stops new ones being started. Nobody currently on a break is let back in early.",
    example:
      "You switch it off on Monday. A player who started a 7-day break on Sunday is still locked out until Sunday, and still sees their break on screen. A different player opening the page today sees no Take a Break button at all.",
  },
  "responsible_gaming.features.self_exclusion": {
    what: "Whether players are offered self-exclusion (6 months, 1 year, or permanent).",
    does: "ON = the option appears. OFF = it disappears and no new exclusion can be started.",
    impact:
      "Same rule as breaks: existing exclusions are untouched and those accounts stay closed. This is usually something a regulator expects you to offer, so check with compliance before switching it off.",
    example:
      "You switch it off. Someone 3 months into a 6-month exclusion is still excluded and still cannot log in. Someone who wanted to start one today cannot.",
  },
  "responsible_gaming.features.deposit_limits": {
    what: "Whether players can set their own daily / weekly / monthly spending caps on coin bundles.",
    does: "ON = they can set a cap. OFF = the option is hidden and no new cap can be set.",
    impact:
      "Caps already set keep working. They also stay visible, so a player is never stuck with a cap they cannot see or remove. This is separate from your own platform-wide purchase limits, which apply either way.",
    example:
      "You switch it off. A player with a $100 daily cap still gets stopped at $100, and can still see it. A player without one is simply not offered the option.",
  },
  "responsible_gaming.features.loss_limits": {
    what: "Whether players can cap how much they are allowed to be DOWN over a day, week or month.",
    does: "ON = they can set a loss cap. OFF = the option is hidden.",
    impact:
      "Only Sweeps play counts. Gold Coin is ignored, because it has no cash value \u2014 so playing Gold Coin never uses up a loss limit.",
    example:
      "A player sets 'stop me if I am down $50 this week'. Once they are $50 down on Sweeps, games stop loading until Monday. Losing $50 of Gold Coin does nothing.",
  },
  "responsible_gaming.features.session_limits": {
    what: "Whether players can cap how long one sitting of play lasts.",
    does: "ON = they can set a time cap. OFF = the option is hidden.",
    impact:
      "What counts as one 'sitting' is set by the Session Idle Gap below. Those two settings work together \u2014 if you offer this, check that gap makes sense first.",
    example:
      "A player sets a 60-minute cap. After an hour of playing without a real break, games stop loading and they are asked to step away.",
  },
  "responsible_gaming.features.activity_dashboard": {
    what: "The 'My Gaming Activity' panel \u2014 games played, time, and amounts for today, this week and this month.",
    does: "ON = the panel shows. OFF = it is hidden.",
    impact:
      "This blocks nothing. It only shows players what they have been doing. Hiding it takes away the information they use to judge their own play, which works against the point of this section.",
    example:
      "OFF: the panel disappears. Every limit still behaves exactly the same.",
  },
  "responsible_gaming.features.reality_check": {
    what: "The pop-up that tells a player how long they have been playing.",
    does: "ON = the reminder appears. OFF = it never appears, no matter what the interval below says.",
    impact:
      "Turned off properly on the server, not just hidden in the app. Switch it back on and it works again immediately \u2014 nothing needs restarting.",
    example:
      "OFF: a player 3 hours into a session sees nothing. ON with the interval at 60: they see 'You have been playing for 1h. Consider taking a break.'",
  },
  "responsible_gaming.limit_increase_cooling_off_hours": {
    what: "The waiting period before a player is allowed to LOOSEN a limit they set on themselves.",
    does:
      "Tightening a limit happens instantly. Loosening one \u2014 raising it or removing it \u2014 is scheduled this many hours into the future. Until then the old, stricter limit still applies.",
    impact:
      "This is the whole protection. Someone in the middle of a bad night wanting to raise their limit right now is exactly who the delay is for. Set it to 0 and they can raise it instantly, which makes the limit pointless.",
    example:
      "Set to 24. At 9pm a player tries to raise their daily cap from $100 to $500. They are still capped at $100 all night. It becomes $500 at 9pm tomorrow. Lowering it to $50 instead would apply immediately.",
  },
  "responsible_gaming.session_idle_gap_minutes": {
    what: "How long a player must stop playing before it counts as a real break \u2014 which resets their session timer.",
    does:
      "This is the definition of 'one sitting'. Stop for longer than this and the session timer goes back to zero. Stop for less and you are still in the same session.",
    impact:
      "Only affects the session time limit. Daily, weekly and monthly limits reset on the calendar instead. Set it too high and someone who stopped for lunch comes back still blocked; too low and the limit never triggers, because every spin looks like a fresh session.",
    example:
      "Set to 30. A player plays for an hour, stops for 35 minutes, comes back \u2014 their session timer starts again at 0. If they had only stopped for 10 minutes, the timer would carry on from where it was.",
  },
  "responsible_gaming.reality_check_minutes": {
    what: "How long a player plays before the reminder pops up.",
    does: "Shows the reminder once they pass this many minutes of unbroken play. 0 turns the reminder off.",
    impact:
      "Only shown to someone actually playing right now \u2014 it is never sent to a player who stopped an hour ago. 'Unbroken play' is decided by the Session Idle Gap above, so a long gap setting makes this fire later than the number alone suggests.",
    example:
      "Set to 60: a player an hour in sees 'You have been playing for 1h. Consider taking a break.' Set to 0: nobody ever sees it.",
  },
  "withdraw_redeem.require_kyc_on_redeem": {
    what: "Whether an approved KYC profile is required before redeeming.",
    does: "On: Claim opens the verification gate instead of creating the request, until the player is approved.",
    impact:
      "Turning it off does not remove identity checks entirely — Breeze and Coinflow run their own KYC on the payout page before releasing funds. It only moves where the player is stopped.",
    example: "On: an unverified player pressing Redeem gets the Verify Now modal instead of the amount screen.",
  },
  "withdraw_redeem.require_profile_completion_on_kyc": {
    what: "Whether missing profile details are collected before the Sumsub widget opens.",
    does: "On (default): Start KYC opens the Complete Profile form when name, email, phone, date of birth, gender or country is missing.",
    impact:
      "Sumsub matches the document against the name, date of birth and country we already hold, so verifying with an empty profile tends to fail — and a failed verification costs a retry and a support ticket.",
    example: "Player with no date of birth on file taps Verify Now: they fill the profile form first, then Sumsub opens.",
  },
  "withdraw_redeem.auto_release_payout_threshold": {
    what: "The single money gate on player redemptions — it decides WHO releases the funds, nothing else.",
    does: "At or below the amount, the provider releases as soon as the player submits their details. Above it, the payout waits at PENDING_MERCHANT_RELEASE for an admin to press Release. 0 makes every payout manual.",
    impact:
      "A ceiling, not an on/off switch. Every redemption still reaches the payment-details form either way — this only decides whether a human signs it off.",
    example: "Set to 100: a $80 redeem pays out unattended; a $250 one lands in the withdrawal listing awaiting Release.",
  },
  "withdraw_redeem.agent_auto_release_payout_threshold": {
    what: "The same release gate, for agent and sub-agent payouts.",
    does: "At or below the amount the agent payout releases on its own; above it, or at 0, it waits for Release in the agent payout queue.",
    impact:
      "Deliberately separate from the player limit — affiliate payouts run far larger than a player redemption, so one shared ceiling would be wrong for both.",
    example: "Players at 100 and agents at 5,000: a $2,000 commission payout still releases automatically.",
  },
  "withdraw_redeem.default_payout_provider": {
    what: "The payout gateway selected by default — for players on the Claim screen, and for admins opening a payout.",
    does: "Pre-selects this gateway (and lists it first) on the player's Claim screen, fills it in when a redemption reaches payout creation with no provider chosen, and seeds the admin payout screen from the withdrawal listing.",
    impact:
      "The player can still switch to the other gateway before claiming. If this gateway is switched off in Settings → Payment Manager, players get the other one instead.",
    example: "Set to Breeze: players open the Claim screen with Breeze already selected, and an admin-initiated payout goes out over Breeze unless they change it.",
  },
  "withdraw_redeem.redeem_daily_limit_enabled": {
    what: "On/off switch for the daily redemption cap.",
    does: "Off: the amount and scope below are ignored and no daily cap applies.",
    impact: "The fastest way to lift a cap without losing the configured amount — the number stays for when you switch it back on.",
    example: "During a promotion weekend, switch it off so a spike in winnings does not hit the day's ceiling.",
  },
  "withdraw_redeem.redeem_daily_limit_amount": {
    what: "How much can be redeemed per day, in Wulf Cash.",
    does: "Counts pending, approved and processed requests toward the total; a declined request gives its allowance back.",
    impact:
      "What this number means depends entirely on the Scope setting next to it — the same 1,000 is a whole-platform budget or a per-player allowance.",
    example: "1,000 with PLATFORM scope: the eleventh player redeeming 100 that day is refused.",
  },
  "withdraw_redeem.redeem_daily_limit_scope": {
    what: "Who the daily limit is measured against.",
    does: "PLATFORM: one shared budget across all players, resetting at platform midnight. USER: every player gets the full amount, resetting at their own local midnight.",
    impact:
      "PLATFORM is far stricter than it looks — a handful of players can exhaust the whole day's budget for everyone else, and the rest see refusals they cannot explain.",
    example: "1,000 / PLATFORM: two players redeeming 500 each close the door for the day. 1,000 / USER: every player has their own 1,000.",
  },
  "withdraw_redeem.min_redemption_chips": {
    what: "Smallest amount a player may redeem in one request.",
    does: "Anything below is refused before the request is created. 0 removes the minimum.",
    impact:
      "Keeps payout fees proportionate. Set above the daily limit and redemptions become impossible — the editor refuses that combination on save.",
    example: "Set to 20: a player with 15 SC cannot redeem until they reach 20.",
  },
  "withdraw_redeem.max_pending_requests": {
    what: "How many unfinished redemptions one player may hold at once.",
    does: "Counts every redemption not yet paid out, cancelled or declined; a slot frees when one reaches a final state. 0 removes the cap.",
    impact:
      "A concurrent cap, not a daily one — it does not reset overnight. A player with a stuck payout stays blocked until that one is resolved.",
    example: "Set to 3: a player with three payouts awaiting Release cannot start a fourth.",
  },
  "spin_redeem.w9_threshold_amount": {
    what: "Yearly redemption total after which a player must submit a W-9 before redeeming again.",
    does: "Measured against the running total for the calendar year, not a single request.",
    impact:
      "A US tax reporting obligation. Change it only on advice from whoever owns compliance — too high and reportable payouts go out unreported.",
    example: "600: a player who has redeemed 590 this year is asked for a W-9 on their next 20 redemption.",
  },

  // ── Welcome Free Spin ────────────────────────────────────────────────────
  "bonus_defaults.welcome_free_spin_enabled": {
    what: "One-time free-spin grant handed out at registration.",
    does: "On: every new account is granted the configured free-spin template as it signs up.",
    impact:
      "Applies to accounts created AFTER it is switched on — existing players get nothing retroactively. Costs real spins from launch, so pair it with a template you have checked.",
    example: "On, with a 15-spin template: a player finishing sign-up sees the free-spin pop-up before their first game.",
  },
  "bonus_defaults.welcome_free_spin_config_id": {
    what: "Which free-spin template new players receive.",
    does: "Points the welcome grant at one template from Free Spin Management (spins, games, currency, expiry).",
    impact:
      "With the switch on and nothing selected, no spins are granted and nothing errors — the feature silently does nothing.",
    example: "Select '15 spins — Book of Spells': every new account gets those 15 spins on that game.",
  },

  // ── Reward Management ────────────────────────────────────────────────────
  "promotion_defaults.promotion_enabled": {
    what: "Master switch for promotions.",
    does: "Off: promotion listings and promo-code redemption stop being offered to players.",
    impact: "Configured campaigns stay saved and inactive — this hides them, it does not delete them.",
    example: "Between campaigns, switch off so the Promotions page does not sit empty and confusing.",
  },
  "cashback_defaults.cashback_enabled": {
    what: "Master switch for cashback accrual and claiming.",
    does: "Off: no cashback is calculated and the cashback screens stop offering claims.",
    impact:
      "Cashback already accrued and unclaimed stays where it is, but the player cannot reach it while this is off.",
    example: "Switch off while re-tuning rates so players do not accrue at rates you are mid-way through changing.",
  },
  "cashback_defaults.cashback_test_mode": {
    what: "QA switch that shrinks cashback periods to minutes.",
    does: "Runs cashback on rolling 5m / 10m / 15m / 30m windows instead of hourly / daily / weekly / monthly. Takes effect within a minute of saving — no restart.",
    impact:
      "KEEP OFF IN PRODUCTION. Unclaimed balances expire minutes after their window opens, so real players lose real cashback.",
    example: "On in staging: a tester sees a weekly cashback cycle complete in 15 minutes instead of waiting a week.",
  },
  "bonus_defaults.bonus_enabled": {
    what: "Master switch for the bonus system.",
    does: "Off: bonuses stop being offered and claims are refused.",
    impact:
      "Bonuses already claimed keep their wagering progress and still pay out — this stops new claims, it does not cancel granted ones.",
    example: "Suspected bonus-abuse ring: switch off while you investigate, without touching anyone's existing balance.",
  },
  "bonus_defaults.default_kyc_required": {
    what: "Whether new bonuses default to requiring an approved KYC.",
    does: "Seeds the KYC-required flag when a bonus is created; each bonus can still override it.",
    impact: "A default only — changing it does not alter bonuses that already exist.",
    example: "On: a newly created no-deposit bonus starts with KYC required already ticked.",
  },
  "promotion_defaults.bundle_sale_title": {
    what: "Headline on the discounted-bundle pop-up shown after login.",
    does: "Replaces the shipped wording. Blank falls back to 'Pay less get more'.",
    impact: "Campaign copy without a deploy. It never renders headless — an empty value simply restores the default.",
    example: "'Black Friday — 30% off everything' for the campaign weekend, cleared afterwards.",
  },
  "promotion_defaults.bundle_sale_subtitle": {
    what: "Optional line under that headline.",
    does: "Blank hides the sub-line entirely — that is the default design, not a missing value. `{savings}` is replaced with the biggest saving on offer, formatted as currency.",
    impact: "The only field here where empty is a deliberate, meaningful setting.",
    example: "'Save up to {savings} today' renders as 'Save up to $30 today' when the best bundle saves $30.",
  },

  // ── Profile Completion Prompt ────────────────────────────────────────────
  "profile_completion.prompt_enabled": {
    what: "Master switch for the Complete Profile banner shown to players with an unfinished profile.",
    does: "Off: the banner never renders on any page, and the Complete Profile shortcut disappears from the account menu.",
    impact:
      "The reward itself is unaffected — it is still granted the moment a profile is saved. This only controls the nudging.",
    example: "Off during a campaign where the pop-up would compete with a sale banner for the same screen space.",
  },
  "profile_completion.prompt_frequency": {
    what: "How long a dismissal silences the prompt.",
    does: "Once per login session: back at the next login, not on refresh. Once per 24 hours: a dismissal survives logout. Once per device: one chance, ever. Every time: no suppression at all.",
    impact:
      "'Every time' is relentless — the banner returns on every navigation until the profile is finished. It exists for checking the design, not for players.",
    example: "Session (recommended): a player dismisses it on Buy, refreshes, sees nothing; signs in tomorrow and it is back.",
  },
  "profile_completion.show_reward_badge": {
    what: "Whether the prompt names what the player earns for finishing.",
    does: "On: the banner shows 'claim 500 Gold Coins' and a gift badge. Off: the same banner without any reward wording.",
    impact:
      "The amount and currency come from the active Profile Complete bonus in Bonus Management — not from this page. With no such bonus, no reward shows regardless of this switch.",
    example: "Off while a reward is configured for retention but you would rather not advertise it up front.",
  },
  "profile_completion.prompt_on_buy": {
    what: "Whether the prompt appears on Profile → Buy Gold Coin.",
    does: "Off: that page never shows the banner, whatever the master switch says.",
    impact: "The highest-intent page on the site — a banner here catches the most players and interrupts the most purchases.",
    example: "On: a player opening Buy Gold Coin with no name on file sees the banner above the bundles.",
  },
  "profile_completion.prompt_on_redeem": {
    what: "Whether the prompt appears on Profile → Redeem.",
    does: "Off: the Redeem tab never shows the banner.",
    impact:
      "Useful here because a complete profile is required for KYC, and KYC is usually required to redeem — catching it early saves a bounce later.",
    example: "On: a player about to redeem is prompted to finish their profile before hitting the KYC gate.",
  },
  "profile_completion.prompt_on_wallet": {
    what: "Whether the prompt appears on Profile → Wallet, the tab players land on by default.",
    does: "Off: the wallet landing page stays clean.",
    impact: "The widest reach of the five surfaces, since it is the default tab.",
    example: "On: opening the profile from the header shows the banner immediately.",
  },
  "profile_completion.prompt_on_kyc": {
    what: "Whether the prompt appears on the KYC page.",
    does: "Off: the KYC page shows no banner.",
    impact:
      "Overlaps with 'Require Profile Completion Before KYC' — with that gate on, the player is sent to the form anyway, so the banner adds little.",
    example: "Off when the KYC gate is already on, to avoid telling the same player the same thing twice.",
  },
  "profile_completion.prompt_on_referral": {
    what: "Whether the prompt appears on the Referrals page.",
    does: "Off: the referral page shows no banner.",
    impact: "The lowest-traffic of the five surfaces — usually the first one to switch off if the prompt feels noisy.",
    example: "Off, keeping the prompt to the money pages only.",
  },
  "profile_completion.prompt_title": {
    what: "Headline on the prompt.",
    does: "Blank uses the shipped, translated copy. A value here overrides it in every language.",
    impact:
      "Custom text is NOT translated — writing English here shows English to Spanish players too. Leave blank unless the wording matters more than the translation.",
    example: "'Finish setup, get 500 Gold Coins' for a push campaign.",
  },
  "profile_completion.prompt_subtitle": {
    what: "Sub-line under that headline.",
    does: "Blank uses the shipped copy. `{reward}` is replaced with the live reward, e.g. '500 Gold Coins'.",
    impact: "Same translation caveat as the headline — custom copy is shown as written to everyone.",
    example: "'Add your details and claim {reward} instantly' renders as '…claim 500 Gold Coins instantly'.",
  },

  // ── Tournament & Jackpot ─────────────────────────────────────────────────
  "tournament_raffle.tournament_enabled": {
    what: "Master switch for tournaments.",
    does: "Off: tournament entries are hidden from the player site and the navigation.",
    impact: "Running tournaments are hidden rather than settled — hide one mid-run and players lose sight of a leaderboard they are on.",
    example: "Off between seasons so the Tournaments page is not an empty shell.",
  },
  "tournament_raffle.raffle_enabled": {
    what: "Master switch for the jackpot / raffle feature.",
    does: "Off: jackpot entries disappear from the player site.",
    impact: "Same caution as tournaments — a jackpot with contributions already made should be settled, not just hidden.",
    example: "Off while re-tuning contribution rates.",
  },

  // ── Activity Log Retention ───────────────────────────────────────────────
  "audit_safety.activity_log_purge_enabled": {
    what: "Whether old Settings → Activity Log rows are deleted automatically.",
    does: "On: a job at 4am every night deletes every admin-action row older than the retention window. Off: nothing is deleted and the window is ignored.",
    impact:
      "The delete is permanent — no archive, no export, no undo. Once a row is gone, questions like 'who approved this payout six weeks ago' have no answer. Off is the correct setting anywhere a regulator can ask for the trail.",
    example: "Off in a licensed market with a five-year audit obligation; on in a staging environment where the log is noise.",
  },
  "audit_safety.activity_log_retention_days": {
    what: "How many days of admin activity the log keeps.",
    does: "Each night, rows whose timestamp is older than this many days are deleted, so the page only ever shows this sliding window. 7 = the last week.",
    impact:
      "Lowering it deletes everything between the old and the new window on the very next nightly run — the history is not hidden, it is destroyed. Ignored while Auto-Delete is off.",
    example: "7: an action recorded on the 1st is gone after the run on the 8th.",
  },

  // ── Feature Flags ────────────────────────────────────────────────────────
  "feature_flags.medal_enabled": {
    what: "Whether the medals / achievements feature is shown.",
    does: "Off: medal screens and badges disappear from the player site.",
    impact: "Progress is preserved and reappears when switched back on.",
    example: "Off until the artwork for a new medal set is ready.",
  },
  "feature_flags.subscription_tier_enabled": {
    what: "Whether paid subscription tiers are offered.",
    does: "Off: the subscription pricing page and upgrade prompts are hidden.",
    impact:
      "Existing subscribers keep their tier and its benefits — this hides the storefront, it does not cancel anyone.",
    example: "Off while pricing is being revised, so nobody buys at a price you are about to change.",
  },
  "feature_flags.daily_streak_enabled": {
    what: "Whether the daily streak reward runs.",
    does: "Off: the streak pop-up and claim disappear.",
    impact:
      "Streak counters keep their stored value, but days spent with the feature off are days players cannot claim, and long streaks break.",
    example: "Off during an incident with reward crediting, back on once resolved.",
  },
  "feature_flags.vip_tier_enabled": {
    what: "Whether the VIP tier programme is shown.",
    does: "Off: VIP screens, tier-up pop-ups and VIP-gated bonuses stop surfacing.",
    impact: "Tier assignments persist; bonuses restricted to a VIP tier simply stop being offered while it is off.",
    example: "Off while re-mapping tier thresholds, so nobody is promoted mid-change.",
  },
  "feature_flags.user_local_day_enabled": {
    what: "Whether each player's day starts at their own midnight, or at the platform's.",
    does: "Off (default): every player's day boundary is the Default Timezone, so the platform behaves as one global business day. On: each player's day flips at midnight in their own detected timezone.",
    impact:
      "Moves daily streak, daily spins and deposit limits for everyone at once. A player mid-day when it changes can gain or lose one daily cycle. Deliberately NOT the same thing as Daily Streak Enabled — that hides the feature, this only moves the boundary.",
    example: "On: a player in Manila gets their new daily reward at midnight Manila time, not at midnight Chicago.",
  },

  // ── Geofence ─────────────────────────────────────────────────────────────
  "geofence.enabled": {
    what: "Master switch for location restrictions.",
    does: "Off: the allowed-country and restricted-state lists are ignored and everyone is let in.",
    impact:
      "The single control that decides whether your licensing restrictions are enforced at all. Switching it off is a compliance decision, not a convenience one.",
    example: "On, with the US allowed and WA restricted: a visitor from Washington reaches the blocked screen.",
  },
  "geofence.block_unknown_country": {
    what: "What to do when a visitor's country cannot be determined.",
    does: "On: they are blocked. Off: they are let through.",
    impact:
      "The safe setting is on — an unresolvable location is exactly what an evasion attempt looks like. Off means anyone whose lookup fails walks straight in.",
    example: "On: a visitor behind a corporate proxy with no geo data reaches the blocked screen rather than the lobby.",
  },
  "geofence.block_vpn": {
    what: "Whether traffic detected as VPN, proxy or Tor is refused.",
    does: "On: detected VPN sessions are blocked at the door.",
    impact:
      "Some legitimate players use a VPN by default and will be blocked with no obvious reason. Weigh support volume against evasion risk.",
    example: "On: a player connecting through NordVPN sees the blocked screen until they disconnect it.",
  },
  "geofence.allowed_country_codes": {
    what: "The list of countries permitted to use the platform.",
    does: "A visitor from a country not on the list is blocked, when the geofence is enabled.",
    impact:
      "An allow-list, not a deny-list — an empty list blocks everyone. Adding a country opens it up immediately, with no deploy.",
    example: "['US', 'CA']: visitors from Mexico reach the blocked screen; visitors from Canada do not.",
  },
  "geofence.restricted_state_codes": {
    what: "States or provinces excluded from an otherwise-allowed country.",
    does: "Blocks visitors resolving to those states even though their country is on the allow-list.",
    impact:
      "This is how US state-level gaming restrictions are honoured. A missing entry means play in a state where it is not permitted.",
    example: "['WA', 'ID']: a player in Washington is blocked while the rest of the US plays normally.",
  },
  "geofence.allowed_ips": {
    what: "Addresses that skip the geofence entirely: country, state, unknown-location and VPN rules are all ignored.",
    does: "A visitor from a listed IP or range is always let in. No location lookup is made for them.",
    impact:
      "For office, QA and support staff only. Anyone on a listed address plays from anywhere, including a restricted state, so never add a player. The list stays on the server and is not sent to the site.",
    example: "Office in India while only the US is allowed: add the office IP and staff can test the live site; everyone else in India stays blocked.",
  },

  // ── Security & Session ───────────────────────────────────────────────────
  "security.idle_logout_minutes": {
    what: "Minutes of inactivity before a player is signed out automatically.",
    does: "The player site watches for activity and signs the session out when the timer expires.",
    impact:
      "Enforced client-side, as a shared-device protection. Too short and players are dropped mid-session — including while watching a slow spin resolve.",
    example: "10: a player who walks away is signed out ten minutes later, with a warning first.",
  },
  "security.idle_warning_seconds": {
    what: "How long the 'you are about to be signed out' countdown runs before the logout fires.",
    does: "Shows the warning dialog this many seconds before the idle timer expires.",
    impact:
      "Comes out of the idle window, not on top of it. Set it near the full idle time and the warning appears almost immediately after the player stops.",
    example: "60 with a 10-minute idle: the warning appears at 9 minutes and counts down the last one.",
  },
  "security.device_limit_enabled": {
    what: "Master switch for device-limit enforcement.",
    does: "Off (default): device counting still runs, but nothing is ever refused or signed out.",
    impact:
      "The one setting here that can stop a paying player signing in. Turning it on must be deliberate — never a side effect of another change.",
    example: "On with a limit of 2: a player signing in on a third device meets the strategy below.",
  },
  "security.device_limit_mode": {
    what: "Where each player's device allowance comes from.",
    does: "Same for everyone: one number for all players, and the pricing table hides its Devices row. Per subscription tier: the allowance comes from the player's tier, falling back to the default for any tier that has not set one.",
    impact:
      "In 'same for everyone' mode, per-tier device counts are ignored entirely — configuring them there has no effect and the players' pricing page deliberately says nothing about devices.",
    example: "Per tier: Basic 1 device, Premium 4. Same for everyone: everybody gets the default below.",
  },
  "security.allow_number_of_devices": {
    what: "The platform-wide device allowance.",
    does: "In 'same for everyone' mode this is the only number that applies. In per-tier mode it is the fallback for any tier with no count of its own.",
    impact:
      "Because it is also the fallback, it can never resolve a player to zero devices — switching the feature on cannot lock everyone out.",
    example: "2: a player may hold two active device sessions before the strategy below kicks in.",
  },
  "security.device_limit_strategy": {
    what: "What happens when a player signs in on one device too many.",
    does: "Ask: show their active devices and let them choose one to sign out — nothing is revoked until they confirm. Sign out oldest: silently drop the least recently used. Block: refuse the login and tell them to free a device.",
    impact:
      "Ask is the only option that never signs a device out without the player agreeing. Block produces the most support contacts; sign-out-oldest is invisible until it drops a device someone was using.",
    example: "Ask, limit 2: a player on a third device picks which of the other two to end.",
  },
  "security.turnstile_mode": {
    what: "Cloudflare Turnstile bot check on player sign-in, sign-up, forgot-password, deposits, subscriptions and cash-outs.",
    does: "Off: no check. Shadow: checks run and failures are logged, nobody is refused. Enforce: a failed, missing, expired or reused check is refused.",
    impact:
      "Enforce is the one value here that can stop a real player depositing or signing in — a blocked script or an unsupported browser fails the check. Shadow first shows how often that would happen.",
    example: "Shadow for a few days, review the API's \"shadow would-reject\" log lines, then Enforce.",
  },
};
