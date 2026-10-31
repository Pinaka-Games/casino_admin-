/**
 * Client-side simulation of the backend rollover / redeemable-balance rules.
 *
 * This is a faithful port of the money paths in the API and must be kept in
 * step with them. Each rule cites the backend source it mirrors:
 *
 *  - Bet funding split (real Wulf Cash first, then bonus) and winnings always
 *    landing in real Wulf Cash:
 *      apps/api/src/modules/games/services/unified-gameplay.service.ts
 *      (atomicBetWin — realAvailable / bonusDeducted)
 *  - Rollover progress distribution (real + bonus stake form ONE pool, oldest
 *    entry first, DEPOSIT before BONUS within the same purchase):
 *      apps/api/src/modules/wagering/wagering.service.ts (recordBet, step 4)
 *  - Completion side effects (bonus → real conversion, deposit unlock formula):
 *      apps/api/src/modules/wagering/wagering.service.ts
 *      (_handleRolloverCompletion)
 *  - "Available to redeem" snapshot:
 *      apps/api/src/modules/wallet/services/withdrawable-balance.service.ts
 *
 * Deliberately NOT modelled: entry expiry / forfeiture, instant-rebate rows,
 * Wulf Coin play (never touches rollover), redeem requests themselves.
 */

export type EntryType = "DEPOSIT" | "BONUS" | "WINNINGS";
export type EntryStatus = "NOT_STARTED" | "ONGOING" | "DONE" | "CANCELED";

export interface RolloverEntry {
  id: number;
  /** Event index that created the entry — stands in for `createdAt`. */
  createdAt: number;
  type: EntryType;
  label: string;
  amount: number;
  multiplier: number;
  required: number;
  completed: number;
  status: EntryStatus;
  /**
   * Set when a gate was closed without meeting its wagering. `BONUS_LOST`:
   * `proposedBonusLost` closes open BONUS gates once a bet leaves the bonus
   * balance at zero — the remaining bonus wagering is waived. `BALANCE_LOST`
   * (rule 7): a bet left the player with no balance at all, so every open
   * gate was CANCELED and the next award starts fresh.
   */
  closedReason?: "BONUS_LOST" | "BALANCE_LOST";
}

export interface WalletState {
  wulfCash: number;
  bonusWulfCash: number;
  /** The `wallet.redeemableWulfCash` column — only written on completion. */
  redeemableWulfCash: number;
}

export type SimEvent =
  | {
      kind: "DEPOSIT";
      amount: number;
      multiplier: number;
      label?: string;
      /** Optional bundle bonus credited in the same purchase. */
      bonusAmount?: number;
      bonusMultiplier?: number;
    }
  | { kind: "BONUS"; amount: number; multiplier: number; label?: string }
  | { kind: "WINNINGS"; amount: number; multiplier: number; label?: string }
  /**
   * The player asks for redeemable cash (RedeemService.createRedeemRequest).
   * The money leaves the wallet but sits in an unpaid request they can still
   * withdraw, so it keeps their rollovers alive.
   */
  | { kind: "REDEEM"; amount: number; label?: string }
  /** The payout completes — that money has left the platform for good. */
  | { kind: "REDEEM_PAID"; amount?: number; label?: string }
  /** The player withdraws the request, or an admin declines it: refunded. */
  | { kind: "REDEEM_REFUND"; amount?: number; label?: string }
  /** Wallet → vault: still the player's money, just parked. */
  | { kind: "VAULT_IN"; amount: number; label?: string }
  /** Vault → wallet: principal comes back where it came from. */
  | { kind: "VAULT_OUT"; amount?: number; label?: string }
  | {
      kind: "BET";
      stake: number;
      /** Gross amount credited back (stake returned + profit). 0 = loss. */
      payout: number;
    };

/**
 * Which funding / fill order to simulate for OUR wallet model.
 *
 *  live     — the backend's previous rule: a bet debits real Wulf Cash
 *             first and only the shortfall comes from bonus; rollover
 *             entries fill oldest-first with DEPOSIT before BONUS inside one
 *             purchase; only deposit / prize principal is locked.
 *  proposed — what the API does now (apps/api …/wagering/rollover-pot.ts).
 *  proposedRedeemFirst
 *           — the live rule with one change: a stake is paid from redeemable
 *             cash FIRST, then the pot's bonus part, then its real part. The
 *             player's own money is the first thing at risk. Wagering order,
 *             the release (only when every rollover is done) and the
 *             cancel-when-nothing-is-left rule are unchanged.
 *  proposedBonusLost / proposedDepositFirst / proposedByOutcome / …PerAward
 *           — variations under evaluation. All are the same single-pot
 *             model and differ in which gate is worked through first and in
 *             when money is released:
 *             1. a bet is funded from open pots in that order, then free cash;
 *             2. wagering fills gates in that same order;
 *                While a gate is open a payout returns to redeemable cash at
 *                most what it staked — the winnings above that join the pot,
 *                so nothing becomes redeemable mid rollover (`proposed` and
 *                `proposedBonusLost`).
 *             3. ONE shared locked pot holds every award plus the winnings
 *                of every bet the pot paid for. Bets spend the pot before
 *                free cash, and the payout goes back to the part of the
 *                wallet that paid, pro rata. Wagering is strictly
 *                sequential: the WHOLE stake fills the first open gate in
 *                the queue until DONE, then the next. A lost pot does not
 *                cancel any gate; every requirement still has to be wagered
 *                through before its money releases. available = free cash.
 *                `proposed` and `proposedBonusLost` work award by award: an
 *                award is every gate one event opened (a bundle's deposit
 *                and bonus gates), awards are worked oldest first, and
 *                inside an award the BONUS gate fills before the DEPOSIT /
 *                WINNINGS gate — so a bonus that arrives later waits behind
 *                the deposit of the purchase before it. Nothing is released
 *                while any gate is open; once every gate is DONE the whole
 *                pot is free cash at once — a running rollover never makes
 *                money redeemable.
 *                `proposedDepositFirst` and `proposedByOutcome` work by
 *                family of gate instead (deposit first / by the bet's
 *                outcome) and also release nothing until every gate is DONE;
 *                `proposedByOutcomePerAward` releases per award (rule 5).
 *             4. `proposedByOutcome` and `proposedByOutcomePerAward` —
 *                wagering follows the bet's outcome: a WIN (payout above the
 *                stake) fills BONUS gates first, a LOSS (anything else) fills
 *                the real-money DEPOSIT / WINNINGS gates first. Whatever that
 *                family cannot take goes to the other family, so no wagering
 *                is wasted. No gate is ever closed early. Funding is bonus
 *                first, as in `proposed`.
 *             5. `proposedByOutcomePerAward` only — release per award: when
 *                every gate of a purchase or award is done, the pot is
 *                released EXCEPT the deposit and bonus amounts of awards that
 *                still have an open gate (capped at what the pot holds). A
 *                finished first bundle's winnings are then redeemable while a
 *                later bundle is still being wagered. Everything else is as in
 *                `proposedByOutcome`.
 *             6. `proposedBonusLost` only — `proposed` (bonus first) plus
 *                bonus lost: when a bet leaves the bonus balance at zero,
 *                every open BONUS gate closes as DONE and its remaining
 *                wagering is waived, so wagering moves on to the real-money
 *                (deposit / prize) gates. A bet that leaves any bonus behind
 *                — a win — keeps the bonus gates open. The bet that loses the
 *                bonus still counts in full toward the bonus gates first.
 *             7. `proposed` and `proposedBonusLost` — all lost: when a bet or
 *                a REDEEM leaves the player with no Sweeps Coin at all (no
 *                pot, no redeemable cash), every open rollover is CANCELED and
 *                its remaining wagering is dropped. Taking the last SC out
 *                empties the balance exactly as losing it does. The next
 *                purchase or bonus starts a fresh rollover with only its own
 *                requirement. As long as any balance remains — even
 *                redeemable cash — nothing is cancelled and every requirement
 *                still has to be wagered.
 *
 * Completion conversion and the deposit unlock formula are identical in all.
 */
export type RuleSet =
  | "live"
  | "proposed"
  | "proposedRedeemFirst"
  | "proposedBonusLost"
  | "proposedDepositFirst"
  | "proposedByOutcome"
  | "proposedByOutcomePerAward";

/**
 * The proposed variants share the whole single-pot model and differ in the
 * order gates are worked through, in when money is released (rule 5) and,
 * for `proposedBonusLost`, in closing bonus gates once the bonus is gone
 * (rule 6).
 */
export const isPotModel = (r: RuleSet): boolean =>
  r === "proposed" ||
  r === "proposedRedeemFirst" ||
  r === "proposedBonusLost" ||
  r === "proposedDepositFirst" ||
  r === "proposedByOutcome" ||
  r === "proposedByOutcomePerAward";

/** The live rule, and the variants that only change which part pays a stake. */
const isBonusFirstModel = (r: RuleSet): boolean =>
  r === "proposed" || r === "proposedRedeemFirst" || r === "proposedBonusLost";

/** Wagering follows the bet's outcome (rule 4). */
const isByOutcome = (r: RuleSet): boolean =>
  r === "proposedByOutcome" || r === "proposedByOutcomePerAward";

export interface SimOptions {
  ruleSet: RuleSet;
}

export const DEFAULT_OPTIONS: SimOptions = { ruleSet: "proposed" };

export interface Snapshot {
  wulfCash: number;
  bonusWulfCash: number;
  redeemableWulfCash: number;
  lockedWulfCash: number;
  availableToWithdraw: number;
}

export interface StepResult {
  index: number;
  event: SimEvent;
  description: string;
  realDeducted: number;
  bonusDeducted: number;
  payout: number;
  /** Rollover progress contribution applied on this step. */
  contribution: number;
  notes: string[];
  error: string | null;
  snapshot: Snapshot;
  entries: RolloverEntry[];
}

export interface SimState {
  wallet: WalletState;
  entries: RolloverEntry[];
  nextEntryId: number;
  /** PROPOSED rule set only: redeemable cash, outside the pot. */
  free: number;
  /**
   * PROPOSED rule set only: the single locked pot shared by every open
   * rollover, split into its bonus and real parts for the wallet cards. It is
   * released to `free` in one go once every gate is done.
   */
  potBonus: number;
  potReal: number;
  /**
   * Sweeps Coin the player holds outside the wallet and can still get back: a
   * redeem request not yet paid out, and vault deposits (the free / locked
   * shares are kept apart so a withdrawal returns them where they came from).
   * It all counts as "the player still has money" for rule 7.
   */
  pendingRedeem: number;
  vaultFree: number;
  vaultLocked: number;
}

const round2 = (n: number) => Number(Number(n).toFixed(2));
const round4 = (n: number) => Number(Number(n).toFixed(4));

export const emptyState = (): SimState => ({
  wallet: { wulfCash: 0, bonusWulfCash: 0, redeemableWulfCash: 0 },
  entries: [],
  nextEntryId: 1,
  free: 0,
  potBonus: 0,
  potReal: 0,
  pendingRedeem: 0,
  vaultFree: 0,
  vaultLocked: 0,
});

const isActive = (e: RolloverEntry) =>
  e.status === "NOT_STARTED" || e.status === "ONGOING";

/** withdrawable-balance.service.ts → fromWallet() */
export function snapshotOf(state: SimState, ruleSet: RuleSet = DEFAULT_OPTIONS.ruleSet): Snapshot {
  const wulfCash = state.wallet.wulfCash;
  const redeemableWulfCash = state.wallet.redeemableWulfCash;

  if (isPotModel(ruleSet)) {
    // One shared pot: everything not yet released is locked in it. Only
    // redeemable cash outside the pot can be withdrawn.
    return {
      wulfCash: round4(state.free + state.potReal),
      bonusWulfCash: round4(state.potBonus),
      redeemableWulfCash: round4(state.free),
      lockedWulfCash: round4(state.potBonus + state.potReal),
      availableToWithdraw: round4(state.free),
    };
  }

  const lockedWulfCash = state.entries
    .filter((e) => isActive(e) && (e.type === "DEPOSIT" || e.type === "WINNINGS"))
    .reduce((s, e) => s + e.amount, 0);
  const unlocked = Math.max(0, wulfCash - lockedWulfCash);
  const availableToWithdraw = Math.min(wulfCash, Math.max(unlocked, redeemableWulfCash));
  return {
    wulfCash: round4(wulfCash),
    bonusWulfCash: round4(state.wallet.bonusWulfCash),
    redeemableWulfCash: round4(redeemableWulfCash),
    lockedWulfCash: round4(lockedWulfCash),
    availableToWithdraw: round4(availableToWithdraw),
  };
}

function cloneState(s: SimState): SimState {
  return {
    wallet: { ...s.wallet },
    entries: s.entries.map((e) => ({ ...e })),
    nextEntryId: s.nextEntryId,
    free: s.free,
    potBonus: s.potBonus,
    potReal: s.potReal,
    pendingRedeem: s.pendingRedeem,
    vaultFree: s.vaultFree,
    vaultLocked: s.vaultLocked,
  };
}

function addEntry(
  state: SimState,
  createdAt: number,
  type: EntryType,
  label: string,
  amount: number,
  multiplier: number,
): RolloverEntry {
  const entry: RolloverEntry = {
    id: state.nextEntryId++,
    createdAt,
    type,
    label,
    amount: round4(amount),
    multiplier,
    required: round4(amount * multiplier),
    completed: 0,
    status: "NOT_STARTED",
  };
  state.entries.push(entry);
  return entry;
}

// ─── PROPOSED rule set: one shared pot ───────────────────────────────────────

/**
 * Order in which one bet's wagering fills the open gates.
 *
 *  proposed              — award by award, oldest award first; inside an
 *  (and …BonusLost)        award the BONUS gate before DEPOSIT / WINNINGS.
 *                          A later bonus waits behind the purchase before it.
 *  proposedDepositFirst  — DEPOSIT / WINNINGS gates first, then BONUS,
 *                          oldest first inside each family.
 *  proposedByOutcome     — decided per bet by its outcome: a WIN fills BONUS
 *  (and …PerAward)         gates first, a LOSS fills DEPOSIT / WINNINGS first.
 *
 * Where money is released for all gates together the order only decides
 * which gate shows progress first. Where it is released per award
 * (`proposedByOutcomePerAward`) the order also decides which award finishes
 * first, and so when its share of the pot is released.
 */
function wagerBonusGatesFirst(ruleSet: RuleSet, stake: number, payout: number): boolean {
  if (ruleSet === "proposedDepositFirst") return false;
  if (isByOutcome(ruleSet)) return payout > stake; // a win: paid back more than the stake
  return true; // proposed / proposedBonusLost: bonus gate first inside an award
}

/** Rule sets that work award by award rather than family by family. */
const isAwardOrdered = (r: RuleSet): boolean => isBonusFirstModel(r);

/** The player's own redeemable cash pays first, so it is also the first to be lost. */
const isRedeemFirst = (r: RuleSet): boolean => r === "proposedRedeemFirst";

/** Rule sets that release the pot per finished award (rule 5). */
const releasesPerAward = (r: RuleSet): boolean => r === "proposedByOutcomePerAward";

/** Rule sets that cancel every open rollover once the player has lost everything (rule 7). */
const cancelsWhenAllLost = (r: RuleSet): boolean => isBonusFirstModel(r);

/**
 * Rule 7 — all lost. The player has no Sweeps Coin at all (no pot, no
 * redeemable cash), whether a bet lost it or a redeem took it out: every open
 * rollover is cancelled and its remaining wagering dropped, so the next award
 * starts fresh. Judged in whole cents, so a sub-cent remainder never keeps a
 * rollover alive.
 */
function cancelIfAllLost(state: SimState, notes: string[]) {
  const held = round2(state.pendingRedeem + state.vaultFree + state.vaultLocked);
  if (round2(state.potBonus + state.potReal + state.free) > 0) return;
  if (held > 0) {
    // The wallet is empty, but a redeem waiting to be paid or money in the
    // vault can still come back — that is not "lost everything".
    if (state.entries.some(isActive)) {
      notes.push(
        `Wallet is empty, but ${held.toFixed(2)} is still the player's (pending redeem / vault) → rollovers stay open`,
      );
    }
    return;
  }
  const cancelled = state.entries.filter(isActive);
  if (!cancelled.length) return;
  for (const e of cancelled) {
    e.status = "CANCELED";
    e.closedReason = "BALANCE_LOST";
  }
  notes.push(
    `Balance is 0 → ${cancelled.length} open rollover(s) cancelled: ` +
      cancelled
        .map((e) => `${e.type} "${e.label}" at ${e.completed.toFixed(2)}/${e.required.toFixed(2)}`)
        .join(", ") +
      "; the next purchase or bonus starts fresh",
  );
}

function openGatesInOrder(state: SimState, bonusGatesFirst: boolean, byAward: boolean): RolloverEntry[] {
  const bonusRank = bonusGatesFirst ? 0 : 1;
  const rank = (e: RolloverEntry) => (e.type === "BONUS" ? bonusRank : 1 - bonusRank);
  return state.entries.filter(isActive).sort((a, b) => {
    // Award by award: the award (createdAt) decides first, the type second.
    // Family by family: the type decides first, the award second.
    const first = byAward ? a.createdAt - b.createdAt : rank(a) - rank(b);
    if (first !== 0) return first;
    const second = byAward ? rank(a) - rank(b) : a.createdAt - b.createdAt;
    if (second !== 0) return second;
    return a.id - b.id;
  });
}

type PotSource = "bonus" | "real" | "free";

/**
 * Which part of the wallet pays for a stake, in order. The locked pot is
 * always spent before redeemable cash, so a player's released money is the
 * last thing at risk. Inside the pot, the mode decides bonus vs real first.
 */
function fundingOrder(ruleSet: RuleSet): PotSource[] {
  if (ruleSet === "proposedDepositFirst") return ["real", "bonus", "free"];
  // `proposedRedeemFirst`: the player's own redeemable cash is spent before
  // any locked money, so it is the first thing at risk — everything else
  // (wagering order, release, cancel) is exactly the live rule.
  if (ruleSet === "proposedRedeemFirst") return ["free", "bonus", "real"];
  return ["bonus", "real", "free"];
}

const SOURCE_LABEL: Record<PotSource, string> = {
  bonus: "pot (bonus)",
  real: "pot (real)",
  free: "redeemable cash",
};

function balanceOf(state: SimState, src: PotSource): number {
  return src === "bonus" ? state.potBonus : src === "real" ? state.potReal : state.free;
}

function addTo(state: SimState, src: PotSource, amount: number) {
  if (src === "bonus") state.potBonus = round4(state.potBonus + amount);
  else if (src === "real") state.potReal = round4(state.potReal + amount);
  else state.free = round4(state.free + amount);
}

/** Mirror pot / free totals into the wallet fields so the ledger stays readable. */
function syncWalletFromPot(state: SimState) {
  state.wallet.wulfCash = round4(state.free + state.potReal);
  state.wallet.bonusWulfCash = round4(state.potBonus);
  state.wallet.redeemableWulfCash = round4(state.free);
}

/**
 * Payout split for the live rule and its variants: every part that paid for
 * the bet gets the same slice of the payout as it put in. The rounding
 * residue lands on the last share so the parts add up to exactly the payout.
 */
function proRataShares(
  funded: { src: PotSource; amount: number }[],
  stake: number,
  payout: number,
): { src: PotSource; amount: number }[] {
  const shares = funded.map((f) => ({ src: f.src, amount: round4((payout * f.amount) / stake) }));
  const residue = round4(payout - shares.reduce((s, x) => s + x.amount, 0));
  if (residue !== 0 && shares.length) {
    shares[shares.length - 1].amount = round4(shares[shares.length - 1].amount + residue);
  }
  return shares;
}

/**
 * Payout split for "redeem consumed first". The stake was taken redeemable →
 * bonus → real, so the loss has to be borne in that same order: the payout
 * makes the parts whole in the REVERSE order (real, then bonus, then
 * redeemable), which leaves any shortfall on redeemable cash first, then on
 * the pot's bonus part, then on its real part.
 *
 * Anything over the stake is the actual win. While a rollover is running it
 * goes into the locked pot (only the staked redeemable cash comes back);
 * with nothing left to wager it is redeemable straight away.
 */
function refundInReverse(
  funded: { src: PotSource; amount: number }[],
  payout: number,
  stillOpen: boolean,
  notes: string[],
): { src: PotSource; amount: number }[] {
  const shares: { src: PotSource; amount: number }[] = [];
  const add = (src: PotSource, amount: number) => {
    const hit = shares.find((s) => s.src === src);
    if (hit) hit.amount = round4(hit.amount + amount);
    else shares.push({ src, amount: round4(amount) });
  };

  let left = round4(payout);
  for (const f of [...funded].reverse()) {
    if (left <= 0) break;
    const back = round4(Math.min(left, f.amount));
    add(f.src, back);
    left = round4(left - back);
  }

  if (left > 0) {
    add(stillOpen ? "real" : "free", left);
    if (stillOpen) {
      const staked = funded.reduce((t, f) => t + f.amount, 0);
      notes.push(
        `Rollover still running → ${left.toFixed(2)} of the win stays in the pot; the ${staked.toFixed(2)} staked comes back where it was taken from`,
      );
    }
  } else {
    // Name the parts that actually came up short, in spending order.
    const lost = funded
      .map((f) => ({ src: f.src, amount: round4(f.amount - (shares.find((s) => s.src === f.src)?.amount ?? 0)) }))
      .filter((l) => l.amount > 0);
    if (lost.length) {
      const total = round4(lost.reduce((t, l) => t + l.amount, 0));
      notes.push(
        `Lost ${total.toFixed(2)}: ` +
          lost.map((l) => `${l.amount.toFixed(2)} from ${SOURCE_LABEL[l.src]}`).join(", ") +
          " (redeemable cash is spent first, so it is lost first)",
      );
    }
  }

  // Read back in spending order so the note lines up with "Funded:".
  const order: PotSource[] = ["free", "bonus", "real"];
  shares.sort((a, b) => order.indexOf(a.src) - order.indexOf(b.src));
  return shares;
}

function applyProposed(
  prev: SimState,
  event: SimEvent,
  index: number,
  ruleSet: RuleSet,
): { state: SimState; step: StepResult } {
  const state = cloneState(prev);
  const notes: string[] = [];
  let description = "";
  let realDeducted = 0;
  let bonusDeducted = 0;
  let payout = 0;
  let contribution = 0;
  let error: string | null = null;

  switch (event.kind) {
    case "DEPOSIT": {
      // Deposit SC joins the pot as real money; its bonus joins as bonus money.
      const label = event.label || "Bundle Deposit";
      addEntry(state, index, "DEPOSIT", label, event.amount, event.multiplier);
      addTo(state, "real", event.amount);
      description = `Deposit ${event.amount.toFixed(2)} SC @ ${event.multiplier}x`;
      if (event.bonusAmount && event.bonusAmount > 0) {
        const bm = event.bonusMultiplier ?? 1;
        addEntry(state, index, "BONUS", `${label} bonus`, event.bonusAmount, bm);
        addTo(state, "bonus", event.bonusAmount);
        description += ` + bonus ${event.bonusAmount.toFixed(2)} @ ${bm}x`;
      }
      break;
    }
    case "BONUS": {
      const label = event.label || "Bonus";
      addEntry(state, index, "BONUS", label, event.amount, event.multiplier);
      addTo(state, "bonus", event.amount);
      description = `Bonus ${event.amount.toFixed(2)} SC @ ${event.multiplier}x`;
      break;
    }
    case "WINNINGS": {
      const label = event.label || "Prize";
      addEntry(state, index, "WINNINGS", label, event.amount, event.multiplier);
      addTo(state, "real", event.amount);
      description = `Winnings ${event.amount.toFixed(2)} SC @ ${event.multiplier}x`;
      break;
    }
    case "BET": {
      const stake = round2(event.stake);
      payout = round2(event.payout);
      description = `Bet ${stake.toFixed(2)} → payout ${payout.toFixed(2)}`;

      const total = state.potBonus + state.potReal + state.free;
      if (total < stake) {
        error = `INSUFFICIENT_FUNDS (have ${total.toFixed(2)}, need ${stake.toFixed(2)}) — bet rejected, no state change`;
        break;
      }

      // 1. Fund the stake: the pot first (bonus / real in mode order), then
      //    redeemable cash.
      const funded: { src: PotSource; amount: number }[] = [];
      let remaining = stake;
      for (const src of fundingOrder(ruleSet)) {
        if (remaining <= 0) break;
        const take = round2(Math.min(remaining, balanceOf(state, src)));
        if (take <= 0) continue;
        addTo(state, src, -take);
        funded.push({ src, amount: take });
        remaining = round2(remaining - take);
      }
      for (const f of funded) {
        if (f.src === "bonus") bonusDeducted = round2(bonusDeducted + f.amount);
        else realDeducted = round2(realDeducted + f.amount);
      }
      notes.push(
        "Funded: " + funded.map((f) => `${f.amount.toFixed(2)} from ${SOURCE_LABEL[f.src]}`).join(", "),
      );

      // 2. Wagering: strictly sequential. The whole stake fills the first open
      //    gate in the queue, whichever part of the wallet paid for it. In the
      //    by-outcome mode the queue follows the bet's outcome: a win goes to
      //    the bonus gates first, a loss to the real-money gates first.
      contribution = stake;
      const bonusGatesFirst = wagerBonusGatesFirst(ruleSet, stake, payout);
      if (isByOutcome(ruleSet)) {
        notes.push(
          bonusGatesFirst
            ? "Win → wagering counts toward bonus rollovers first"
            : "Loss → wagering counts toward real-money rollovers first",
        );
      }
      fillSequentially(state, stake, notes, bonusGatesFirst, isAwardOrdered(ruleSet));

      // 3. Payout goes back to the parts of the wallet that paid for the bet.
      //    A gate that is already full (this bet's own wagering finished it)
      //    is not holding anything any more, so the win is free money.
      if (payout > 0) {
        const stillOpen = state.entries.some((e) => isActive(e) && e.completed < e.required);
        const freeFunded = funded.find((f) => f.src === "free")?.amount ?? 0;
        const shares = isRedeemFirst(ruleSet)
          ? refundInReverse(funded, payout, stillOpen, notes)
          : proRataShares(funded, stake, payout);

        // Live rule: while a gate is still open nothing new becomes
        // redeemable — redeemable cash gets back only what it staked and the
        // winnings above it join the pot, released when the last gate closes.
        // (Redeem-first does the same inside refundInReverse.)
        const freeShare = shares.find((s) => s.src === "free");
        if (!isRedeemFirst(ruleSet) && stillOpen && freeShare && freeShare.amount > freeFunded) {
          const held = round4(freeShare.amount - freeFunded);
          freeShare.amount = freeFunded;
          const realShare = shares.find((s) => s.src === "real");
          if (realShare) realShare.amount = round4(realShare.amount + held);
          else shares.push({ src: "real", amount: held });
          notes.push(
            `Rollover still running → ${held.toFixed(2)} of the win stays in the pot; the ${freeFunded.toFixed(2)} staked from redeemable cash comes back redeemable`,
          );
        }
        for (const s of shares) addTo(state, s.src, s.amount);
        notes.push(
          "Payout: " + shares.map((s) => `${s.amount.toFixed(2)} → ${SOURCE_LABEL[s.src]}`).join(", "),
        );
      }

      // 4. Gates that met their wagering are DONE, but the pot is released
      //    only when every gate is done — then all of it becomes redeemable.
      const justDone: RolloverEntry[] = [];
      for (const e of state.entries) {
        if (isActive(e) && e.completed >= e.required) {
          e.status = "DONE";
          justDone.push(e);
        }
      }

      // 4b. Bonus lost (proposedBonusLost): this bet left the bonus balance
      //     at zero, so the bonus is gone — its open gates close without the
      //     remaining wagering and the real-money gates are next in the
      //     queue. A win refills the bonus balance and keeps them open.
      //     Zero is judged in whole cents, so a sub-cent rounding remainder
      //     cannot keep a lost bonus's gate open.
      const bonusLost: RolloverEntry[] = [];
      if (ruleSet === "proposedBonusLost" && round2(state.potBonus) <= 0) {
        for (const e of state.entries) {
          if (isActive(e) && e.type === "BONUS") {
            e.status = "DONE";
            e.closedReason = "BONUS_LOST";
            bonusLost.push(e);
          }
        }
      }

      const stillOpen = state.entries.filter(isActive).length;
      for (const e of justDone) {
        notes.push(
          stillOpen > 0
            ? `${e.type} "${e.label}" wagering DONE → pot stays locked, ${stillOpen} gate(s) still open`
            : `${e.type} "${e.label}" wagering DONE`,
        );
      }
      for (const e of bonusLost) {
        const waived = round4(Math.max(0, e.required - e.completed));
        notes.push(
          `Bonus balance lost → BONUS "${e.label}" closed, remaining ${waived.toFixed(2)} of wagering waived` +
            (stillOpen > 0 ? `; wagering moves to the ${stillOpen} real-money gate(s)` : ""),
        );
      }
      if ((justDone.length || bonusLost.length) && stillOpen === 0) {
        const released = round4(state.potBonus + state.potReal);
        state.free = round4(state.free + released);
        state.potBonus = 0;
        state.potReal = 0;
        notes.push(`All rollover complete → pot ${released.toFixed(2)} released to redeemable (now ${state.free.toFixed(2)})`);
      }

      // 5. Per-award release (rule 5): a purchase or award whose gates are
      //    now all done releases the pot, except the deposit and bonus
      //    amounts of awards that still have an open gate. A bonus gate
      //    closed as lost counts as done for its award.
      if (releasesPerAward(ruleSet) && (justDone.length || bonusLost.length) && stillOpen > 0) {
        releaseFinishedAwards(state, [...justDone, ...bonusLost], notes);
      }

      // 6. All lost (rule 7): the bet left the player with nothing at all —
      //    no pot, no redeemable cash. Every open rollover is cancelled and
      //    its remaining wagering dropped; the next award starts fresh.
      //    Judged in whole cents, so a sub-cent remainder never keeps a
      //    rollover alive.
      if (cancelsWhenAllLost(ruleSet)) cancelIfAllLost(state, notes);
      break;
    }

    case "REDEEM": {
      // RedeemService.createRedeemRequest: the pot is released first when no
      // gate holds it, then the amount leaves free (redeemable) cash — locked
      // money is never redeemable.
      const asked = round2(event.amount);
      if (!state.entries.some(isActive)) {
        const released = round4(state.potBonus + state.potReal);
        if (released > 0) {
          state.free = round4(state.free + released);
          state.potBonus = 0;
          state.potReal = 0;
          notes.push(`Nothing holds the pot → ${released.toFixed(2)} released before the redeem`);
        }
      }
      description = `Redeem ${asked.toFixed(2)} SC`;
      if (asked <= 0) {
        error = "Redeem amount must be above zero — no state change";
        break;
      }
      if (asked > round2(state.free)) {
        error = `EXCEEDS_REDEEMABLE (available ${state.free.toFixed(2)}, asked ${asked.toFixed(2)}) — redeem rejected, no state change`;
        break;
      }
      state.free = round4(state.free - asked);
      state.pendingRedeem = round4(state.pendingRedeem + asked);
      notes.push(
        `${asked.toFixed(2)} left the wallet into an unpaid redeem request (redeemable now ${state.free.toFixed(2)}); the player can still withdraw it, so rollovers stay open`,
      );
      if (cancelsWhenAllLost(ruleSet)) cancelIfAllLost(state, notes);
      break;
    }

    case "REDEEM_PAID": {
      // The payout completed: this money has left the platform for good, so
      // it no longer keeps a rollover alive (rule 7).
      const asked = round2(event.amount ?? state.pendingRedeem);
      description = `Redeem paid out ${asked.toFixed(2)} SC`;
      if (asked <= 0 || asked > round2(state.pendingRedeem)) {
        error = `NO_PENDING_REDEEM (pending ${state.pendingRedeem.toFixed(2)}, asked ${asked.toFixed(2)}) — no state change`;
        break;
      }
      state.pendingRedeem = round4(state.pendingRedeem - asked);
      notes.push(`Payout completed (pending redeem now ${state.pendingRedeem.toFixed(2)})`);
      if (cancelsWhenAllLost(ruleSet)) cancelIfAllLost(state, notes);
      break;
    }

    case "REDEEM_REFUND": {
      // The player withdrew the request, or an admin declined it: the money
      // comes back as redeemable cash, exactly as it left.
      const asked = round2(event.amount ?? state.pendingRedeem);
      description = `Redeem refunded ${asked.toFixed(2)} SC`;
      if (asked <= 0 || asked > round2(state.pendingRedeem)) {
        error = `NO_PENDING_REDEEM (pending ${state.pendingRedeem.toFixed(2)}, asked ${asked.toFixed(2)}) — no state change`;
        break;
      }
      state.pendingRedeem = round4(state.pendingRedeem - asked);
      state.free = round4(state.free + asked);
      notes.push(`${asked.toFixed(2)} refunded to redeemable cash (now ${state.free.toFixed(2)})`);
      break;
    }

    case "VAULT_IN": {
      // A vault deposit takes redeemable cash first, then the pot's real part
      // — and keeps the two apart so the withdrawal returns them in kind.
      const asked = round2(event.amount);
      description = `Vault deposit ${asked.toFixed(2)} SC`;
      if (asked <= 0) {
        error = "Vault amount must be above zero — no state change";
        break;
      }
      if (asked > round2(state.free + state.potReal)) {
        error = `INSUFFICIENT_FUNDS (real SC ${(state.free + state.potReal).toFixed(2)}, asked ${asked.toFixed(2)}) — vault deposit rejected, no state change`;
        break;
      }
      const fromFree = round4(Math.min(asked, state.free));
      const fromPot = round4(asked - fromFree);
      state.free = round4(state.free - fromFree);
      state.potReal = round4(state.potReal - fromPot);
      state.vaultFree = round4(state.vaultFree + fromFree);
      state.vaultLocked = round4(state.vaultLocked + fromPot);
      notes.push(
        `${asked.toFixed(2)} moved to the vault (${fromFree.toFixed(2)} redeemable, ${fromPot.toFixed(2)} locked); still the player's, so rollovers stay open`,
      );
      if (cancelsWhenAllLost(ruleSet)) cancelIfAllLost(state, notes);
      break;
    }

    case "VAULT_OUT": {
      const inVault = round4(state.vaultFree + state.vaultLocked);
      const asked = round2(event.amount ?? inVault);
      description = `Vault withdrawal ${asked.toFixed(2)} SC`;
      if (asked <= 0 || asked > round2(inVault)) {
        error = `NOTHING_IN_VAULT (in vault ${inVault.toFixed(2)}, asked ${asked.toFixed(2)}) — no state change`;
        break;
      }
      const backToFree = round4(Math.min(asked, state.vaultFree));
      const backToPot = round4(asked - backToFree);
      state.vaultFree = round4(state.vaultFree - backToFree);
      state.vaultLocked = round4(state.vaultLocked - backToPot);
      state.free = round4(state.free + backToFree);
      state.potReal = round4(state.potReal + backToPot);
      notes.push(
        `${asked.toFixed(2)} came back from the vault (${backToFree.toFixed(2)} redeemable, ${backToPot.toFixed(2)} locked)`,
      );
      break;
    }
  }

  syncWalletFromPot(state);

  const effective = error ? prev : state;
  const step: StepResult = {
    index,
    event,
    description,
    realDeducted,
    bonusDeducted,
    payout,
    contribution,
    notes,
    error,
    snapshot: snapshotOf(effective, ruleSet),
    entries: effective.entries.map((e) => ({ ...e })),
  };
  return { state: effective, step };
}

/**
 * Per-award release (rule 5 — `proposed`, `proposedBonusLost`,
 * `proposedByOutcomePerAward`). An award is every gate one event opened — a
 * bundle's deposit and its bonus share one. When a gate that just finished
 * was its award's last open gate, the pot is released except
 * what the awards still in rollover put in: their deposit / prize amounts
 * stay in the real part and their bonus amounts in the bonus part (a part
 * that ran short keeps the difference from the other one), capped at what the
 * pot holds. So a finished first bundle's winnings become redeemable while a
 * later bundle is still being wagered.
 */
function releaseFinishedAwards(state: SimState, justDone: RolloverEntry[], notes: string[]) {
  const awardFinished = (createdAt: number) =>
    state.entries.filter((e) => e.createdAt === createdAt).every((e) => !isActive(e));
  const finished = new Set(justDone.map((e) => e.createdAt).filter(awardFinished));
  if (finished.size === 0) return;

  const openAwards = new Set(state.entries.filter(isActive).map((e) => e.createdAt));
  const held = state.entries.filter((e) => openAwards.has(e.createdAt));
  const heldBonus = round4(held.filter((e) => e.type === "BONUS").reduce((s, e) => s + e.amount, 0));
  const heldReal = round4(held.filter((e) => e.type !== "BONUS").reduce((s, e) => s + e.amount, 0));

  const lockedTotal = round4(Math.min(state.potBonus + state.potReal, heldBonus + heldReal));
  let keepBonus = round4(Math.min(state.potBonus, heldBonus));
  const keepReal = round4(Math.min(state.potReal, lockedTotal - keepBonus));
  keepBonus = round4(keepBonus + Math.min(state.potBonus - keepBonus, lockedTotal - keepBonus - keepReal));

  const released = round4(state.potBonus - keepBonus + (state.potReal - keepReal));
  state.free = round4(state.free + released);
  state.potBonus = keepBonus;
  state.potReal = keepReal;
  notes.push(
    `Award rollover complete → ${released.toFixed(2)} released to redeemable (now ${state.free.toFixed(2)}); ` +
      `${lockedTotal.toFixed(2)} stays locked for ${openAwards.size} award(s) still in rollover`,
  );
}

/**
 * Sequential wagering: pour the stake into open gates in queue order. A gate
 * only starts receiving once every gate ahead of it is full.
 */
function fillSequentially(
  state: SimState,
  amount: number,
  notes: string[],
  bonusGatesFirst: boolean,
  byAward: boolean,
) {
  let remaining = amount;
  const filled: string[] = [];
  for (const e of openGatesInOrder(state, bonusGatesFirst, byAward)) {
    if (remaining <= 0) break;
    const fill = round4(Math.min(remaining, e.required - e.completed));
    if (fill <= 0) continue;
    e.completed = round4(e.completed + fill);
    if (e.status === "NOT_STARTED") e.status = "ONGOING";
    remaining = round4(remaining - fill);
    filled.push(`${fill.toFixed(2)} → ${e.type} "${e.label}" (${e.completed.toFixed(2)}/${e.required.toFixed(2)})`);
  }
  if (filled.length) notes.push("Wagering: " + filled.join(", "));
  if (remaining > 0 && state.entries.some(isActive)) {
    notes.push(`${remaining.toFixed(2)} of the wager had no open requirement left to fill`);
  }
}

/** wagering.service.ts → _handleRolloverCompletion() */
function handleCompletion(state: SimState, entry: RolloverEntry, notes: string[]) {
  const w = state.wallet;
  if (entry.type === "BONUS") {
    const bonusBal = w.bonusWulfCash;
    const otherActiveBonusLocked = state.entries
      .filter((e) => e.id !== entry.id && e.type === "BONUS" && isActive(e))
      .reduce((s, e) => s + e.amount, 0);
    const toConvert = Math.max(0, bonusBal - otherActiveBonusLocked);
    if (toConvert > 0) {
      w.bonusWulfCash = round4(bonusBal - toConvert);
      w.wulfCash = round4(w.wulfCash + toConvert);
      w.redeemableWulfCash = round4(w.redeemableWulfCash + toConvert);
      notes.push(
        `BONUS "${entry.label}" DONE → converted ${toConvert.toFixed(2)} bonus → real (redeemable col +${toConvert.toFixed(2)})`,
      );
    } else {
      notes.push(`BONUS "${entry.label}" DONE → nothing left to convert (bonus balance already spent)`);
    }
    return;
  }

  // DEPOSIT / WINNINGS
  const currentWulfCash = w.wulfCash;
  const currentRedeemable = w.redeemableWulfCash;
  const otherLockedTotal = state.entries
    .filter((e) => e.id !== entry.id && isActive(e))
    .reduce((s, e) => s + e.amount, 0);
  const newRedeemable = Math.min(
    currentWulfCash,
    Math.max(currentRedeemable + entry.amount, currentWulfCash - otherLockedTotal),
  );
  const amountUnlocked = Math.max(0, newRedeemable - currentRedeemable);
  w.redeemableWulfCash = round4(newRedeemable);
  notes.push(
    `${entry.type} "${entry.label}" DONE → redeemable col = min(${currentWulfCash.toFixed(2)}, max(${currentRedeemable.toFixed(2)}+${entry.amount.toFixed(2)}, ${currentWulfCash.toFixed(2)}−${otherLockedTotal.toFixed(2)})) = ${newRedeemable.toFixed(2)} (unlocked ${amountUnlocked.toFixed(2)})`,
  );
}

/** wagering.service.ts → recordBet(), step 4 distribution loop */
function distributeWager(
  state: SimState,
  contribution: number,
  notes: string[],
  ruleSet: RuleSet,
) {
  if (contribution <= 0) return;
  const active = state.entries.filter(isActive).sort((a, b) => {
    if (ruleSet === "proposed") {
      // Every BONUS entry first (oldest first), then DEPOSIT / WINNINGS oldest first.
      const ra = a.type === "BONUS" ? 0 : 1;
      const rb = b.type === "BONUS" ? 0 : 1;
      if (ra !== rb) return ra - rb;
      if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
      return a.id - b.id;
    }
    // live: oldest first, DEPOSIT before BONUS within the same purchase.
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    const ra = a.type === "DEPOSIT" ? 0 : 1;
    const rb = b.type === "DEPOSIT" ? 0 : 1;
    if (ra !== rb) return ra - rb;
    return a.id - b.id;
  });

  let remaining = contribution;
  for (const entry of active) {
    if (remaining <= 0) break;
    const fill = Math.min(remaining, entry.required - entry.completed);
    entry.completed = round4(entry.completed + fill);
    remaining = round4(remaining - fill);
    if (entry.completed >= entry.required) {
      entry.status = "DONE";
      handleCompletion(state, entry, notes);
    } else if (entry.completed > 0) {
      entry.status = "ONGOING";
    }
  }
  if (remaining > 0 && active.length > 0) {
    notes.push(`${remaining.toFixed(2)} of the wager had no active rollover left to fill`);
  }
}

export function applyEvent(
  prev: SimState,
  event: SimEvent,
  index: number,
  opts: SimOptions = DEFAULT_OPTIONS,
): { state: SimState; step: StepResult } {
  if (isPotModel(opts.ruleSet)) return applyProposed(prev, event, index, opts.ruleSet);

  const state = cloneState(prev);
  const notes: string[] = [];
  let description = "";
  let realDeducted = 0;
  let bonusDeducted = 0;
  let payout = 0;
  let contribution = 0;
  let error: string | null = null;

  switch (event.kind) {
    case "DEPOSIT": {
      // coin-bundle.service.ts: bundle SC → wulfCash, NOT mirrored into
      // redeemableWulfCash; DEPOSIT rollover created at the deposit multiplier.
      const label = event.label || "Bundle Deposit";
      state.wallet.wulfCash = round4(state.wallet.wulfCash + event.amount);
      addEntry(state, index, "DEPOSIT", label, event.amount, event.multiplier);
      description = `Deposit ${event.amount.toFixed(2)} SC @ ${event.multiplier}x`;
      if (event.bonusAmount && event.bonusAmount > 0) {
        // Bundle's own bonus → bonusWulfCash + BONUS entry, same createdAt.
        state.wallet.bonusWulfCash = round4(state.wallet.bonusWulfCash + event.bonusAmount);
        const bm = event.bonusMultiplier ?? 1;
        addEntry(state, index, "BONUS", `${label} bonus`, event.bonusAmount, bm);
        description += ` + bonus ${event.bonusAmount.toFixed(2)} @ ${bm}x`;
      }
      break;
    }
    case "BONUS": {
      // user-vip.service.ts / bonus.service.ts: BONUS_WULF_CASH credit + BONUS entry.
      const label = event.label || "Bonus";
      state.wallet.bonusWulfCash = round4(state.wallet.bonusWulfCash + event.amount);
      addEntry(state, index, "BONUS", label, event.amount, event.multiplier);
      description = `Bonus ${event.amount.toFixed(2)} SC @ ${event.multiplier}x`;
      break;
    }
    case "WINNINGS": {
      // Locked prize credit (tournament/race/free-spin): wulfCash credited,
      // redeemable NOT mirrored, WINNINGS entry locks the principal.
      const label = event.label || "Prize";
      state.wallet.wulfCash = round4(state.wallet.wulfCash + event.amount);
      addEntry(state, index, "WINNINGS", label, event.amount, event.multiplier);
      description = `Winnings ${event.amount.toFixed(2)} SC @ ${event.multiplier}x`;
      break;
    }
    case "REDEEM": {
      // The old rule: available = min(wulfCash, max(wulfCash − open deposit /
      // prize principal, redeemableWulfCash)); a redeem lowers both columns.
      // Nothing is ever cancelled here.
      const asked = round2(event.amount);
      const snap = snapshotOf(state, opts.ruleSet);
      description = `Redeem ${asked.toFixed(2)} SC`;
      if (asked <= 0) {
        error = "Redeem amount must be above zero — no state change";
        break;
      }
      if (asked > round2(snap.availableToWithdraw)) {
        error = `EXCEEDS_REDEEMABLE (available ${snap.availableToWithdraw.toFixed(2)}, asked ${asked.toFixed(2)}) — redeem rejected, no state change`;
        break;
      }
      state.wallet.wulfCash = round4(state.wallet.wulfCash - asked);
      state.wallet.redeemableWulfCash = round4(Math.max(0, snap.availableToWithdraw - asked));
      state.pendingRedeem = round4(state.pendingRedeem + asked);
      notes.push(`${asked.toFixed(2)} left the wallet (redeemable now ${state.wallet.redeemableWulfCash.toFixed(2)})`);
      break;
    }
    case "REDEEM_PAID": {
      // The old rule never cancelled anything, so this only clears the pending
      // figure the cards show.
      const asked = round2(event.amount ?? state.pendingRedeem);
      description = `Redeem paid out ${asked.toFixed(2)} SC`;
      if (asked <= 0 || asked > round2(state.pendingRedeem)) {
        error = `NO_PENDING_REDEEM (pending ${state.pendingRedeem.toFixed(2)}, asked ${asked.toFixed(2)}) — no state change`;
        break;
      }
      state.pendingRedeem = round4(state.pendingRedeem - asked);
      break;
    }
    case "REDEEM_REFUND": {
      const asked = round2(event.amount ?? state.pendingRedeem);
      description = `Redeem refunded ${asked.toFixed(2)} SC`;
      if (asked <= 0 || asked > round2(state.pendingRedeem)) {
        error = `NO_PENDING_REDEEM (pending ${state.pendingRedeem.toFixed(2)}, asked ${asked.toFixed(2)}) — no state change`;
        break;
      }
      state.pendingRedeem = round4(state.pendingRedeem - asked);
      state.wallet.wulfCash = round4(state.wallet.wulfCash + asked);
      state.wallet.redeemableWulfCash = round4(state.wallet.redeemableWulfCash + asked);
      break;
    }
    case "VAULT_IN": {
      const asked = round2(event.amount);
      description = `Vault deposit ${asked.toFixed(2)} SC`;
      if (asked <= 0 || asked > round2(state.wallet.wulfCash)) {
        error = `INSUFFICIENT_FUNDS (Wulf Cash ${state.wallet.wulfCash.toFixed(2)}, asked ${asked.toFixed(2)}) — vault deposit rejected, no state change`;
        break;
      }
      state.wallet.wulfCash = round4(state.wallet.wulfCash - asked);
      state.wallet.redeemableWulfCash = round4(Math.max(0, state.wallet.redeemableWulfCash - asked));
      state.vaultFree = round4(state.vaultFree + asked);
      break;
    }
    case "VAULT_OUT": {
      const inVault = round4(state.vaultFree + state.vaultLocked);
      const asked = round2(event.amount ?? inVault);
      description = `Vault withdrawal ${asked.toFixed(2)} SC`;
      if (asked <= 0 || asked > round2(inVault)) {
        error = `NOTHING_IN_VAULT (in vault ${inVault.toFixed(2)}, asked ${asked.toFixed(2)}) — no state change`;
        break;
      }
      state.vaultFree = round4(Math.max(0, state.vaultFree - asked));
      state.wallet.wulfCash = round4(state.wallet.wulfCash + asked);
      break;
    }
    case "BET": {
      const stake = round2(event.stake);
      payout = round2(event.payout);
      const realAvailable = state.wallet.wulfCash;
      const bonusAvailable = state.wallet.bonusWulfCash;
      const total = realAvailable + bonusAvailable;
      description = `Bet ${stake.toFixed(2)} → payout ${payout.toFixed(2)}`;
      if (total < stake) {
        error = `INSUFFICIENT_FUNDS (have ${total.toFixed(2)}, need ${stake.toFixed(2)}) — bet rejected, no state change`;
        break;
      }
      if (realAvailable >= stake) {
        // live: real first; bonus only covers the shortfall.
        realDeducted = stake;
        bonusDeducted = 0;
      } else {
        realDeducted = realAvailable;
        bonusDeducted = round2(stake - realAvailable);
      }
      // Winnings always land in real Wulf Cash, even for bonus-funded bets.
      state.wallet.wulfCash = round2(realAvailable - realDeducted + payout);
      state.wallet.bonusWulfCash = round2(bonusAvailable - bonusDeducted);
      contribution = round2(realDeducted + bonusDeducted);
      distributeWager(state, contribution, notes, opts.ruleSet);
      break;
    }
  }

  const effective = error ? prev : state;
  const step: StepResult = {
    index,
    event,
    description,
    realDeducted,
    bonusDeducted,
    payout,
    contribution,
    notes,
    error,
    snapshot: snapshotOf(effective, opts.ruleSet),
    entries: effective.entries.map((e) => ({ ...e })),
  };
  return { state: effective, step };
}

export function simulate(
  events: SimEvent[],
  opts: SimOptions = DEFAULT_OPTIONS,
): { steps: StepResult[]; final: SimState } {
  let state = emptyState();
  const steps: StepResult[] = [];
  events.forEach((ev, i) => {
    const r = applyEvent(state, ev, i, opts);
    state = r.state;
    steps.push(r.step);
  });
  return { steps, final: state };
}

/** The walk-through used to validate this engine against the backend. */
export const SAMPLE_EVENTS: SimEvent[] = [
  { kind: "DEPOSIT", amount: 25, multiplier: 1, label: "$25 bundle" },
  { kind: "BET", stake: 10, payout: 60 },
  { kind: "BONUS", amount: 35, multiplier: 2, label: "Level bonus" },
  { kind: "BET", stake: 30, payout: 0 },
];
