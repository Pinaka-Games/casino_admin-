/**
 * Simulation of the STAKE.US rollover model ("playthrough") — the reference
 * to compare our backend against.
 *
 * This engine is deliberately independent of ../rollover-engine.ts (which
 * mirrors our backend). Nothing here reflects our code.
 *
 * Rules:
 *  1. ONE Sweeps Coin balance. SC from a package, bonus drops and prizes all
 *     land in the same balance; there is no separate bonus bucket.
 *  2. Every award adds amount × multiplier (Stake.us: 3x) to ONE pending
 *     wagering figure shared by every award. The per-award rows only show
 *     which award the wagering has reached: they fill oldest first.
 *  3. Every SC bet lowers pending wagering by its stake (× game weight). Only
 *     the stake counts, never the win. Wagering beyond what is pending is not
 *     kept for a later award.
 *  4. While wagering is pending nothing new becomes redeemable: awarded SC and
 *     every win stay locked. When pending wagering reaches 0 the whole balance
 *     becomes redeemable.
 *  5. An award after the balance was cleared does not take back what is
 *     already redeemable; only the new SC, and what is won while its wagering
 *     is pending, is locked. Losses use the locked SC first, so redeemable SC
 *     only drops once the locked SC is gone. Stake.us does not publish this
 *     split; it is the reading of the worked cases (case 2).
 *  6. A bet that leaves the balance at 0 ends the round: every open
 *     playthrough is marked FAILED and its remaining wagering is dropped. It
 *     is not carried into the next award, which starts a new round.
 *  7. Optional max-bet cap while wagering is pending, and optional game
 *     weighting (only weight% of the stake counts).
 */

export type AwardSource = "PURCHASE" | "BONUS" | "PRIZE";
/** FAILED: still open when a bet left the balance at 0 (rule 6). */
export type AwardStatus = "NOT_STARTED" | "ONGOING" | "DONE" | "FAILED";

export interface Award {
  id: number;
  createdAt: number;
  source: AwardSource;
  label: string;
  amount: number;
  multiplier: number;
  required: number;
  completed: number;
  status: AwardStatus;
}

export type StakeEvent =
  | { kind: "AWARD"; source: AwardSource; amount: number; multiplier: number; label?: string }
  | {
      kind: "BET";
      stake: number;
      /** Gross amount credited back (stake returned + profit). 0 = loss. */
      payout: number;
      /** % of the stake that counts toward playthrough. Default 100. */
      weight?: number;
    };

export interface StakeOptions {
  /** Reject a stake above this while wagering is pending. 0 = off. */
  maxBetWhilePending: number;
}

export interface StakeSnapshot {
  balance: number;
  /** SC waiting for pending wagering to clear: balance − available. */
  locked: number;
  /** Redeemable SC. */
  available: number;
  /** Wagering still needed across every award. */
  pendingWagering: number;
}

export interface StakeStep {
  index: number;
  event: StakeEvent;
  description: string;
  stake: number;
  payout: number;
  contribution: number;
  notes: string[];
  error: string | null;
  snapshot: StakeSnapshot;
  awards: Award[];
}

export interface StakeState {
  balance: number;
  /** SC already cleared for redemption (never above the balance). */
  redeemable: number;
  awards: Award[];
  nextId: number;
}

const round2 = (n: number) => Number(Number(n).toFixed(2));
const round4 = (n: number) => Number(Number(n).toFixed(4));

export const emptyStakeState = (): StakeState => ({ balance: 0, redeemable: 0, awards: [], nextId: 1 });

export const isOpen = (a: Award) => a.status === "NOT_STARTED" || a.status === "ONGOING";

const pendingOf = (state: StakeState): number =>
  round4(state.awards.filter(isOpen).reduce((s, a) => s + Math.max(0, a.required - a.completed), 0));

export function stakeSnapshot(state: StakeState): StakeSnapshot {
  const available = round4(Math.min(state.redeemable, state.balance));
  return {
    balance: round4(state.balance),
    locked: round4(state.balance - available),
    available,
    pendingWagering: pendingOf(state),
  };
}

function clone(s: StakeState): StakeState {
  return { balance: s.balance, redeemable: s.redeemable, awards: s.awards.map((a) => ({ ...a })), nextId: s.nextId };
}

/** Count a bet's wagering toward the open awards, oldest first. */
function distribute(state: StakeState, contribution: number, notes: string[]) {
  if (contribution <= 0) return;
  const open = state.awards
    .filter(isOpen)
    .sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);
  let remaining = contribution;
  for (const a of open) {
    if (remaining <= 0) break;
    const fill = round4(Math.min(remaining, a.required - a.completed));
    a.completed = round4(a.completed + fill);
    remaining = round4(remaining - fill);
    if (a.completed >= a.required) {
      a.status = "DONE";
      notes.push(`${a.source} "${a.label}" playthrough met`);
    } else if (a.completed > 0) {
      a.status = "ONGOING";
    }
  }
  if (remaining > 0 && open.length > 0) {
    notes.push(`${remaining.toFixed(2)} of the wager had no pending wagering left to count toward`);
  }
}

export function applyStakeEvent(
  prev: StakeState,
  event: StakeEvent,
  index: number,
  opts: StakeOptions,
): { state: StakeState; step: StakeStep } {
  const state = clone(prev);
  const notes: string[] = [];
  let description = "";
  let stake = 0;
  let payout = 0;
  let contribution = 0;
  let error: string | null = null;

  if (event.kind === "AWARD") {
    const label =
      event.label ||
      (event.source === "PURCHASE" ? "Package" : event.source === "BONUS" ? "Bonus drop" : "Prize");
    const pendingBefore = pendingOf(state);
    const required = round4(event.amount * event.multiplier);
    state.balance = round4(state.balance + event.amount);
    state.awards.push({
      id: state.nextId++,
      createdAt: index,
      source: event.source,
      label,
      amount: round4(event.amount),
      multiplier: event.multiplier,
      required,
      completed: 0,
      status: required > 0 ? "NOT_STARTED" : "DONE",
    });
    description = `${label}: +${event.amount.toFixed(2)} SC @ ${event.multiplier}x`;

    // Rule 5: what is already redeemable stays redeemable; the new SC is
    // locked until pending wagering is back at 0.
    const pending = pendingOf(state);
    if (pending > 0) {
      notes.push(
        pendingBefore > 0
          ? `Pending wagering ${pendingBefore.toFixed(2)} + ${required.toFixed(2)} = ${pending.toFixed(2)}; the new SC is locked until it is cleared`
          : `Pending wagering ${pending.toFixed(2)}; the new SC is locked until it is cleared`,
      );
    } else {
      state.redeemable = state.balance;
      notes.push("No playthrough and nothing pending → redeemable at once");
    }
  } else {
    stake = round2(event.stake);
    payout = round2(event.payout);
    const weight = event.weight ?? 100;
    description = `Bet ${stake.toFixed(2)} → payout ${payout.toFixed(2)}`;
    const pendingBefore = pendingOf(state);

    if (stake > round4(state.balance)) {
      error = `INSUFFICIENT_FUNDS (have ${state.balance.toFixed(2)}, need ${stake.toFixed(2)}) — bet rejected`;
    } else if (opts.maxBetWhilePending > 0 && stake > opts.maxBetWhilePending && pendingBefore > 0) {
      error = `MAX_BET_EXCEEDED — stake ${stake.toFixed(2)} > cap ${opts.maxBetWhilePending.toFixed(2)} while wagering is pending — bet rejected`;
    } else {
      const redeemableBefore = Math.min(state.redeemable, state.balance);
      state.balance = round4(state.balance - stake + payout);
      contribution = round2((stake * weight) / 100);
      if (weight !== 100) {
        notes.push(`Game weight ${weight}% → ${contribution.toFixed(2)} of ${stake.toFixed(2)} counts`);
      }
      distribute(state, contribution, notes);
      let pending = pendingOf(state);
      if (pendingBefore > 0) notes.push(`Pending wagering ${pendingBefore.toFixed(2)} → ${pending.toFixed(2)}`);

      // Rule 6: the balance is gone — the round is over. Every open
      // playthrough fails and its remaining wagering is dropped, so none of it
      // carries into the next award.
      const busted = pending > 0 && round2(state.balance) <= 0;
      if (busted) {
        for (const a of state.awards.filter(isOpen)) {
          a.status = "FAILED";
          notes.push(
            `Balance is 0 → ${a.source} "${a.label}" playthrough FAILED, remaining ${Math.max(0, a.required - a.completed).toFixed(2)} dropped`,
          );
        }
        notes.push("Pending wagering reset to 0; the next award starts a new round");
        pending = 0;
      }

      if (pending <= 0) {
        // Rule 4: cleared — the whole balance is redeemable.
        state.redeemable = state.balance;
        if (pendingBefore > 0 && !busted) {
          notes.push(
            round2(state.balance) > 0
              ? `Wagering cleared → whole balance ${state.balance.toFixed(2)} SC is redeemable`
              : "Wagering cleared; the balance is 0, so nothing is left to redeem",
          );
        }
      } else {
        // Rule 4 / 5: wins stay locked; losses use the locked SC first.
        state.redeemable = round4(Math.min(state.redeemable, state.balance));
        if (state.redeemable < redeemableBefore) {
          notes.push(`Loss went past the locked SC → redeemable down to ${state.redeemable.toFixed(2)}`);
        } else if (payout > 0) {
          notes.push("Wagering still pending → the payout stays locked");
        }
      }
    }
  }

  const effective = error ? prev : state;
  return {
    state: effective,
    step: {
      index,
      event,
      description,
      stake,
      payout,
      contribution,
      notes,
      error,
      snapshot: stakeSnapshot(effective),
      awards: effective.awards.map((a) => ({ ...a })),
    },
  };
}

export function simulateStake(
  events: StakeEvent[],
  opts: StakeOptions,
): { steps: StakeStep[]; final: StakeState } {
  let state = emptyStakeState();
  const steps: StakeStep[] = [];
  events.forEach((ev, i) => {
    const r = applyStakeEvent(state, ev, i, opts);
    state = r.state;
    steps.push(r.step);
  });
  return { steps, final: state };
}

const PACKAGE_20: StakeEvent = { kind: "AWARD", source: "PURCHASE", amount: 20.05, multiplier: 3, label: "$20 package" };
const PACKAGE_50: StakeEvent = { kind: "AWARD", source: "PURCHASE", amount: 50.12, multiplier: 3, label: "$50 package" };
const bet = (stake: number, payout: number): StakeEvent => ({ kind: "BET", stake, payout });

/** The worked Stake.us cases the model was built from. */
export const STAKE_SAMPLE_CASES: { key: string; label: string; events: StakeEvent[] }[] = [
  {
    key: "case1",
    label: "Case 1 — $50 package bought mid-playthrough",
    events: [PACKAGE_20, bet(20.05, 40.1), bet(20.05, 0), PACKAGE_50, bet(20.05, 40.1), bet(60, 120), bet(60, 0), bet(60, 0)],
  },
  {
    key: "case2",
    label: "Case 2 — $50 package bought after clearing",
    events: [PACKAGE_20, bet(20.05, 40.1), bet(20.05, 0), bet(20.05, 40.1), PACKAGE_50],
  },
  {
    key: "case3",
    label: "Case 3 — 10 SC bonus drop mid-playthrough",
    events: [
      PACKAGE_20,
      bet(20.05, 40.1),
      bet(20.05, 0),
      { kind: "AWARD", source: "BONUS", amount: 10, multiplier: 3, label: "Bonus drop" },
      bet(20.05, 40.1),
      bet(30, 0),
    ],
  },
  {
    key: "case4",
    label: "Case 4 — balance hits 0, then a $50 package",
    events: [PACKAGE_20, bet(20.05, 0), PACKAGE_50],
  },
];
