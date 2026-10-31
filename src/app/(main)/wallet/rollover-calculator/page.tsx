"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Calculator, Plus, RotateCcw, Trash2, FlaskConical, Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ModelTabs from "./ModelTabs";
import {
  isPotModel,
  SAMPLE_EVENTS,
  simulate,
  snapshotOf,
  type EntryStatus,
  type RuleSet,
  type SimEvent,
} from "./rollover-engine";

type CreditKind = Exclude<SimEvent["kind"], "BET">;
type WinMode = "profit" | "payout";

const KIND_LABEL: Record<CreditKind, string> = {
  DEPOSIT: "Bundle purchase (deposit)",
  BONUS: "Bonus credit (level / promo / manual)",
  WINNINGS: "Locked prize (tournament / race / free spin)",
  REDEEM: "Redeem request (redeemable SC out, not paid yet)",
  REDEEM_PAID: "Redeem paid out (money leaves the platform)",
  REDEEM_REFUND: "Redeem cancelled / declined (refunded)",
  VAULT_IN: "Vault deposit (wallet → vault)",
  VAULT_OUT: "Vault withdrawal (vault → wallet)",
};

/** Events that take no wagering multiplier. */
const NO_MULTIPLIER: CreditKind[] = ["REDEEM", "REDEEM_PAID", "REDEEM_REFUND", "VAULT_IN", "VAULT_OUT"];
/** Events whose amount may be left empty to mean "all of it". */
const AMOUNT_OPTIONAL: CreditKind[] = ["REDEEM_PAID", "REDEEM_REFUND", "VAULT_OUT"];

const STATUS_CLASS: Record<EntryStatus, string> = {
  NOT_STARTED: "bg-gray-700 text-gray-200",
  ONGOING: "bg-amber-500/20 text-amber-300",
  DONE: "bg-emerald-500/20 text-emerald-300",
  CANCELED: "bg-red-500/20 text-red-300",
};

const isOpenEntry = (status: EntryStatus) => status === "NOT_STARTED" || status === "ONGOING";

const fmt = (n: number) => n.toFixed(2);

function describeEvent(ev: SimEvent): string {
  switch (ev.kind) {
    case "DEPOSIT":
      return (
        `Deposit ${fmt(ev.amount)} @ ${ev.multiplier}x` +
        (ev.bonusAmount ? ` + bonus ${fmt(ev.bonusAmount)} @ ${ev.bonusMultiplier ?? 1}x` : "")
      );
    case "BONUS":
      return `Bonus ${fmt(ev.amount)} @ ${ev.multiplier}x`;
    case "WINNINGS":
      return `Prize ${fmt(ev.amount)} @ ${ev.multiplier}x`;
    case "REDEEM":
      return `Redeem request ${fmt(ev.amount)}`;
    case "REDEEM_PAID":
      return ev.amount ? `Redeem paid out ${fmt(ev.amount)}` : "Redeem paid out (all)";
    case "REDEEM_REFUND":
      return ev.amount ? `Redeem refunded ${fmt(ev.amount)}` : "Redeem refunded (all)";
    case "VAULT_IN":
      return `Vault deposit ${fmt(ev.amount)}`;
    case "VAULT_OUT":
      return ev.amount ? `Vault withdrawal ${fmt(ev.amount)}` : "Vault withdrawal (all)";
    case "BET": {
      const net = ev.payout - ev.stake;
      if (ev.payout <= 0) return `Bet ${fmt(ev.stake)} → LOSE`;
      return `Bet ${fmt(ev.stake)} → WIN ${fmt(net)} (credited ${fmt(ev.payout)})`;
    }
  }
}

export default function RolloverCalculatorPage() {
  const [events, setEvents] = useState<SimEvent[]>([]);

  // Form state — kept as strings so the inputs can be cleared while typing.
  const [kind, setKind] = useState<CreditKind>("DEPOSIT");
  const [amount, setAmount] = useState("25");
  const [multiplier, setMultiplier] = useState("1");
  const [label, setLabel] = useState("");
  const [bundleBonus, setBundleBonus] = useState("");
  const [bundleBonusMult, setBundleBonusMult] = useState("1");

  // Bet panel — always visible; this is what testers use most.
  const [stake, setStake] = useState("10");
  const [win, setWin] = useState("40");
  // "profit": the win figure is on top of the returned stake (bet 10, win 40
  //           → wallet credited 50).
  // "payout": the win figure IS the total credited (bet 10, payout 50).
  const [winMode, setWinMode] = useState<WinMode>("profit");

  // The two proposed variants are the same pot model and differ only in which
  // family of gates is worked through first. Live = the API as deployed.
  // Same events, flip to compare.
  const [ruleSet, setRuleSet] = useState<RuleSet>("proposedRedeemFirst");
  const { steps, final } = useMemo(() => simulate(events, { ruleSet }), [events, ruleSet]);
  const snap = useMemo(() => snapshotOf(final, ruleSet), [final, ruleSet]);

  const num = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const stakeNum = num(stake);
  const winNum = num(win);
  const payoutPreview = winMode === "profit" ? stakeNum + winNum : winNum;

  // Undo / redo: undo pops the last event onto a redo stack; any new event
  // clears that stack (a fresh branch of history).
  const [redoStack, setRedoStack] = useState<SimEvent[]>([]);
  const pushEvent = (ev: SimEvent) => {
    setEvents((prev) => [...prev, ev]);
    setRedoStack([]);
  };
  const undo = useCallback(() => {
    setEvents((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((r) => [...r, last]);
      return prev.slice(0, -1);
    });
  }, []);
  const redo = useCallback(() => {
    setRedoStack((r) => {
      if (r.length === 0) return r;
      const ev = r[r.length - 1];
      setEvents((prev) => [...prev, ev]);
      return r.slice(0, -1);
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (k === "y" || (k === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // Redeem panel: leave the amount empty to take everything that is available.
  const [redeemAmount, setRedeemAmount] = useState("");
  const redeemNow = () => {
    const asked = redeemAmount.trim() === "" ? snap.availableToWithdraw : num(redeemAmount);
    if (asked > 0) pushEvent({ kind: "REDEEM", amount: asked });
  };

  const placeBet = (outcome: "win" | "lose") => {
    const payout = outcome === "lose" ? 0 : payoutPreview;
    pushEvent({ kind: "BET", stake: stakeNum, payout });
  };

  const addEvent = () => {
    let ev: SimEvent;
    if (kind === "DEPOSIT") {
      const b = num(bundleBonus);
      ev = {
        kind: "DEPOSIT",
        amount: num(amount),
        multiplier: num(multiplier) || 1,
        label: label.trim() || undefined,
        ...(b > 0 ? { bonusAmount: b, bonusMultiplier: num(bundleBonusMult) || 1 } : {}),
      };
    } else if (NO_MULTIPLIER.includes(kind)) {
      const amt = num(amount);
      ev =
        AMOUNT_OPTIONAL.includes(kind) && amount.trim() === ""
          ? ({ kind, label: label.trim() || undefined } as SimEvent)
          : ({ kind, amount: amt, label: label.trim() || undefined } as SimEvent);
    } else {
      ev = {
        kind,
        amount: num(amount),
        multiplier: num(multiplier) || 1,
        label: label.trim() || undefined,
      };
    }
    pushEvent(ev);
    setLabel("");
  };

  const removeEvent = (i: number) =>
    setEvents((prev) => prev.filter((_, idx) => idx !== i));

  const activeEntries = final.entries.filter((e) => isOpenEntry(e.status));
  const totalRequired = activeEntries.reduce((s, e) => s + e.required, 0);
  const totalCompleted = activeEntries.reduce((s, e) => s + e.completed, 0);
  const overallPct = totalRequired > 0 ? Math.min(100, (totalCompleted / totalRequired) * 100) : 100;
  // Wagering still owed across every open entry — same figure the Stake page
  // shows as pending wagering, derived here from the entries rather than the
  // engine.
  const remainingWagering = (entries: typeof final.entries) =>
    entries
      .filter((e) => isOpenEntry(e.status))
      .reduce((s, e) => s + Math.max(0, e.required - e.completed), 0);

  const heldOutside = final.pendingRedeem + final.vaultFree + final.vaultLocked;

  const kpi = [
    { label: "Wulf Cash (real)", value: fmt(snap.wulfCash) },
    { label: "Bonus Wulf Cash", value: fmt(snap.bonusWulfCash) },
    {
      label: isPotModel(ruleSet) ? "Locked (single pot)" : "Locked (deposit / prize principal)",
      value: fmt(snap.lockedWulfCash),
    },
    { label: "Remaining wagering", value: fmt(remainingWagering(final.entries)) },
    { label: "Available to redeem", value: fmt(snap.availableToWithdraw), highlight: true },
  ];

  return (
    <div className="min-h-screen bg-[#0F1419] p-4 sm:p-6">
      <div className="mx-auto w-full max-w-[1380px] space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Calculator className="h-6 w-6 text-[#B93DEB]" />
            Rollover Calculator
          </h1>
          <div className="flex flex-nowrap gap-2 overflow-x-auto">
            <Button
              type="button"
              variant="outline"
              onClick={undo}
              disabled={events.length === 0}
              title="Ctrl+Z"
              className="h-10 border-gray-600 text-gray-200 hover:bg-[#242B35]"
            >
              <Undo2 className="mr-2 h-4 w-4" />
              Undo
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={redo}
              disabled={redoStack.length === 0}
              title="Ctrl+Y"
              className="h-10 border-gray-600 text-gray-200 hover:bg-[#242B35]"
            >
              <Redo2 className="mr-2 h-4 w-4" />
              Redo
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEvents(SAMPLE_EVENTS);
                setRedoStack([]);
              }}
              className="h-10 border-gray-600 text-gray-200 hover:bg-[#242B35]"
            >
              <FlaskConical className="mr-2 h-4 w-4" />
              Load sample case
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEvents([]);
                setRedoStack([]);
              }}
              disabled={events.length === 0}
              className="h-10 border-gray-600 text-gray-200 hover:bg-[#242B35]"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ModelTabs />
          <div className="flex flex-wrap rounded-md bg-[#191D24] p-1">
            {(
              [
                { key: "proposedRedeemFirst", label: "API now: redeem consumed first" },
                { key: "proposed", label: "Old: bonus first" },
                // The live rule (redeem consumed first) and the bonus-first rule
                // it replaced. The rest stay in the engine
                // (rollover-engine.ts RuleSet) — put a line back here to
                // compare one against the API's own numbers again.
                // { key: "proposedBonusLost", label: "Proposed: bonus first + bonus lost" },
                // { key: "proposedByOutcome", label: "Proposed: win → bonus, loss → real" },
                // { key: "proposedByOutcomePerAward", label: "Proposed: win/loss, release per bundle" },
                // { key: "proposedDepositFirst", label: "Proposed: deposit first" },
                // { key: "live", label: "Old API: real first" },
              ] as { key: RuleSet; label: string }[]
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setRuleSet(opt.key)}
                className={`rounded px-4 py-1.5 text-sm font-semibold transition-colors ${
                  ruleSet === opt.key
                    ? isPotModel(opt.key)
                      ? "bg-emerald-600 text-white"
                      : "bg-gray-600 text-white"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-500">
          {ruleSet === "live"
            ? "Bet debits real first; entries fill oldest-first, DEPOSIT before BONUS within one purchase; only the deposit principal is locked. The API's previous rule, kept for comparison."
            : `All locked SC sits in one shared pot, together with the winnings of bets the pot paid for. Wagering fills gates one at a time — ${
                ruleSet === "proposedDepositFirst"
                  ? "deposit and prize gates first, then bonus gates"
                  : ruleSet === "proposedByOutcome" || ruleSet === "proposedByOutcomePerAward"
                    ? "a winning bet counts toward bonus gates first, a losing bet toward deposit and prize gates first"
                    : "oldest purchase or award first, and inside a purchase its bonus gate before its deposit gate, so a bonus that arrives later waits its turn"
              } — ${
                ruleSet === "proposedByOutcomePerAward"
                  ? "and when every gate of a bundle or award is done, the pot becomes redeemable except the deposits and bonuses of awards still in rollover"
                  : "and nothing is released while any rollover is open; when every gate is done the whole pot becomes redeemable at once"
              }.${
                ruleSet === "proposedBonusLost"
                  ? " If a bet leaves the bonus balance at zero, the bonus gates close and their remaining wagering is waived."
                  : ""
              }${
                ruleSet === "proposed" || ruleSet === "proposedRedeemFirst" || ruleSet === "proposedBonusLost"
                  ? " If a bet leaves the player with no balance at all, every open rollover is cancelled and the next purchase or bonus starts fresh."
                  : ""
              }${
                ruleSet === "proposedRedeemFirst"
                  ? " A stake is paid from redeemable cash first, then bonus, then real — the player's own money goes first, and a loss is taken off it first. A win returns the stake to wherever it came from and keeps the profit in the pot until every rollover is done."
                  : ""
              } ${ruleSet === "proposedRedeemFirst" ? "This is what the API does now." : "Not in the API."}`}
        </p>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {kpi.map((item) => (
            <Card
              key={item.label}
              className={`flex min-h-[88px] flex-col items-center justify-center border px-3 py-2.5 text-center ${
                item.highlight
                  ? "border-[#B93DEB] bg-[#B93DEB]/10"
                  : "border-gray-800 bg-[#191D24]"
              }`}
            >
              <p className="text-xs text-gray-400">{item.label}</p>
              <p className="mt-1.5 text-xl font-bold text-white">{item.value}</p>
            </Card>
          ))}
        </div>

        {heldOutside > 0 && (
          <p className="text-xs text-amber-300/80">
            Outside the wallet: {fmt(final.pendingRedeem)} in an unpaid redeem request,{" "}
            {fmt(final.vaultFree + final.vaultLocked)} in the vault. This money is still the player&apos;s, so an
            empty wallet does not cancel their rollovers.
          </p>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="space-y-5 xl:col-span-1">
            {/* Bet panel — always visible */}
            <Card className="border border-[#B93DEB]/50 bg-[#191D24] p-4">
              <h2 className="mb-1 text-lg font-semibold text-white">Place bet</h2>
              <p className="mb-4 text-xs text-gray-400">
                Each click adds one bet; rollover progress, locks and redeemable update instantly.
              </p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-gray-300">Stake (SC)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={stake}
                      onChange={(e) => setStake(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && placeBet("win")}
                      className="h-10 border-gray-700 bg-[#0F1419] text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-gray-300">Win (SC)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={win}
                      onChange={(e) => setWin(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && placeBet("win")}
                      className="h-10 border-gray-700 bg-[#0F1419] text-white"
                    />
                  </div>
                </div>

                <div className="flex rounded-md bg-[#0F1419] p-1 text-xs">
                  {(
                    [
                      { key: "profit", label: "Win = profit (stake returned on top)" },
                      { key: "payout", label: "Win = total payout" },
                    ] as { key: WinMode; label: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setWinMode(opt.key)}
                      className={`flex-1 rounded px-2 py-1.5 font-semibold transition-colors ${
                        winMode === opt.key
                          ? "bg-[#7C3AED] text-white"
                          : "text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <p className="text-xs text-gray-500">
                  Wallet credited on win: <span className="text-white">{fmt(payoutPreview)}</span>{" "}
                  (stake {fmt(stakeNum)} debited first → net {fmt(payoutPreview - stakeNum)})
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    onClick={() => placeBet("win")}
                    disabled={stakeNum <= 0}
                    className="h-10 bg-emerald-600 text-white hover:bg-emerald-500"
                  >
                    Bet &amp; Win
                  </Button>
                  <Button
                    type="button"
                    onClick={() => placeBet("lose")}
                    disabled={stakeNum <= 0}
                    className="h-10 bg-red-600 text-white hover:bg-red-500"
                  >
                    Bet &amp; Lose
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={undo}
                  disabled={events.length === 0}
                  className="h-9 w-full border-gray-700 text-gray-300 hover:bg-[#242B35]"
                >
                  <Undo2 className="mr-2 h-4 w-4" />
                  Undo last step
                  {events.length > 0 && (
                    <span className="ml-2 truncate text-xs text-gray-500">
                      ({describeEvent(events[events.length - 1])})
                    </span>
                  )}
                </Button>
              </div>
            </Card>

            {/* Redeem panel — request, then payout or refund */}
            <Card className="border border-gray-800 bg-[#191D24] p-4">
              <h2 className="mb-1 text-lg font-semibold text-white">Redeem</h2>
              <p className="mb-4 text-xs text-gray-400">
                Takes redeemable cash out. The request is not paid yet, so that money still counts as the
                player&apos;s and their rollovers stay open — &quot;Payout completed&quot; is what makes it leave the
                platform.
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-gray-300">Amount (SC) — empty = all available</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={redeemAmount}
                    onChange={(e) => setRedeemAmount(e.target.value)}
                    placeholder={fmt(snap.availableToWithdraw)}
                    onKeyDown={(e) => e.key === "Enter" && redeemNow()}
                    className="h-10 border-gray-700 bg-[#0F1419] text-white"
                  />
                </div>
                <Button
                  type="button"
                  onClick={redeemNow}
                  disabled={snap.availableToWithdraw <= 0}
                  className="h-10 w-full bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  Redeem {fmt(redeemAmount.trim() === "" ? snap.availableToWithdraw : num(redeemAmount))} SC
                </Button>
                {final.pendingRedeem > 0 && (
                  <>
                    <p className="text-xs text-amber-300/80">
                      Waiting to be paid: {fmt(final.pendingRedeem)} SC — still the player&apos;s, so rollovers stay
                      open.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        type="button"
                        onClick={() => pushEvent({ kind: "REDEEM_PAID" })}
                        className="h-10 bg-[#B93DEB] text-white hover:bg-[#a234d1]"
                      >
                        Payout completed
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => pushEvent({ kind: "REDEEM_REFUND" })}
                        className="h-10 border-gray-700 text-gray-200 hover:bg-[#242B35]"
                      >
                        Cancel / refund
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </Card>

            {/* Credit panel — deposits, bonuses, prizes */}
            <Card className="border border-gray-800 bg-[#191D24] p-4">
              <h2 className="mb-4 text-lg font-semibold text-white">Add credit</h2>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-gray-300">Credit type</Label>
                  <Select value={kind} onValueChange={(v) => setKind(v as CreditKind)}>
                    <SelectTrigger className="h-10 w-full border-gray-700 bg-[#0F1419] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-gray-700 bg-[#191D24] text-white">
                      {(Object.keys(KIND_LABEL) as CreditKind[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {KIND_LABEL[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-gray-300">Amount (SC)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="h-10 border-gray-700 bg-[#0F1419] text-white"
                    />
                  </div>
                  {!NO_MULTIPLIER.includes(kind) && (
                    <div className="space-y-1.5">
                      <Label className="text-gray-300">Wagering (x)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.1"
                        value={multiplier}
                        onChange={(e) => setMultiplier(e.target.value)}
                        className="h-10 border-gray-700 bg-[#0F1419] text-white"
                      />
                    </div>
                  )}
                </div>
                {NO_MULTIPLIER.includes(kind) && (
                  <p className="text-xs text-gray-500">
                    {kind === "REDEEM"
                      ? "Takes the amount out of redeemable cash — locked money can never be redeemed. The request is not paid yet, so that money still counts as the player's and their rollovers stay open."
                      : kind === "REDEEM_PAID"
                        ? "The payout completed, so this money has left the platform. If the player now has nothing anywhere, their open rollovers are cancelled."
                        : kind === "REDEEM_REFUND"
                          ? "The player withdrew the request, or an admin declined it: the money comes back as redeemable cash."
                          : kind === "VAULT_IN"
                          ? "Moves SC from the wallet to the vault — redeemable cash first, then locked. Vault money is still the player's, so rollovers stay open even at a zero wallet."
                          : "Brings vault money back to the wallet, redeemable and locked shares as they went in."}
                    {AMOUNT_OPTIONAL.includes(kind) && " Leave the amount empty for all of it."}
                  </p>
                )}
                <div className="space-y-1.5">
                  <Label className="text-gray-300">Label (optional)</Label>
                  <Input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder={
                      kind === "DEPOSIT"
                        ? "$25 bundle"
                        : kind === "BONUS"
                          ? "Level bonus"
                          : kind === "REDEEM"
                            ? "Cash out"
                            : "Race prize"
                    }
                    className="h-10 border-gray-700 bg-[#0F1419] text-white"
                  />
                </div>
                {kind === "DEPOSIT" && (
                  <div className="grid grid-cols-2 gap-3 rounded-md border border-gray-800 p-3">
                    <div className="col-span-2 text-xs text-gray-400">
                      Bundle&apos;s own bonus (optional) — same purchase timestamp, fills after the deposit.
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-gray-300">Bonus SC</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={bundleBonus}
                        onChange={(e) => setBundleBonus(e.target.value)}
                        placeholder="0"
                        className="h-10 border-gray-700 bg-[#0F1419] text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-gray-300">Bonus multiplier</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.1"
                        value={bundleBonusMult}
                        onChange={(e) => setBundleBonusMult(e.target.value)}
                        className="h-10 border-gray-700 bg-[#0F1419] text-white"
                      />
                    </div>
                  </div>
                )}

                <Button
                  type="button"
                  onClick={addEvent}
                  disabled={num(amount) <= 0}
                  className="h-10 w-full bg-[#B93DEB] text-white hover:bg-[#a234d1]"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add credit
                </Button>
              </div>
            </Card>
          </div>

          {/* Rollover entries */}
          <Card className="border border-gray-800 bg-[#191D24] p-4 xl:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Rollover entries</h2>
              <span className="text-sm text-gray-400">
                Active progress {fmt(totalCompleted)} / {fmt(totalRequired)} ({overallPct.toFixed(0)}%)
              </span>
            </div>
            {final.entries.length === 0 ? (
              <p className="text-sm text-gray-500">No rollover entries yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800">
                    <TableHead className="text-gray-400">#</TableHead>
                    <TableHead className="text-gray-400">Type</TableHead>
                    <TableHead className="text-gray-400">Label</TableHead>
                    <TableHead className="text-right text-gray-400">Amount</TableHead>
                    <TableHead className="text-right text-gray-400">Mult</TableHead>
                    <TableHead className="text-right text-gray-400">Required</TableHead>
                    <TableHead className="text-right text-gray-400">Completed</TableHead>
                    <TableHead className="min-w-[140px] text-gray-400">Progress</TableHead>
                    <TableHead className="text-gray-400">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {final.entries.map((e) => {
                    const pct = e.required > 0 ? Math.min(100, (e.completed / e.required) * 100) : 100;
                    return (
                      <TableRow key={e.id} className="border-gray-800">
                        <TableCell className="text-gray-300">{e.id}</TableCell>
                        <TableCell className="text-white">{e.type}</TableCell>
                        <TableCell className="text-gray-300">{e.label}</TableCell>
                        <TableCell className="text-right text-white">{fmt(e.amount)}</TableCell>
                        <TableCell className="text-right text-gray-300">{e.multiplier}x</TableCell>
                        <TableCell className="text-right text-white">{fmt(e.required)}</TableCell>
                        <TableCell className="text-right text-white">{fmt(e.completed)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded bg-gray-800">
                              <div
                                className={`h-full ${
                                  e.status === "CANCELED"
                                    ? "bg-red-400/60"
                                    : e.closedReason === "BONUS_LOST"
                                      ? "bg-gray-500"
                                      : e.status === "DONE"
                                        ? "bg-emerald-400"
                                        : "bg-[#B93DEB]"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-10 text-right text-xs text-gray-400">{pct.toFixed(0)}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[e.status]}`}
                            title={
                              e.closedReason === "BALANCE_LOST"
                                ? "The player lost their whole balance, so this rollover was cancelled and its remaining wagering dropped"
                                : e.closedReason === "BONUS_LOST"
                                  ? "The bonus balance was lost, so the remaining bonus wagering was waived"
                                  : undefined
                            }
                          >
                            {e.closedReason === "BALANCE_LOST"
                              ? "CANCELLED · balance lost"
                              : e.closedReason === "BONUS_LOST"
                                ? "DONE · bonus lost"
                                : e.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>

        {/* Step ledger */}
        <Card className="border border-gray-800 bg-[#191D24] p-5">
          <h2 className="mb-4 text-lg font-semibold text-white">Step-by-step ledger</h2>
          {steps.length === 0 ? (
            <p className="text-sm text-gray-500">
              Add events above or load the sample case.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800">
                    <TableHead className="text-gray-400">#</TableHead>
                    <TableHead className="text-gray-400">Event</TableHead>
                    <TableHead className="text-right text-gray-400">Real deducted</TableHead>
                    <TableHead className="text-right text-gray-400">Bonus deducted</TableHead>
                    <TableHead className="text-right text-gray-400">Rollover +</TableHead>
                    <TableHead className="text-right text-gray-400">Wulf Cash</TableHead>
                    <TableHead className="text-right text-gray-400">Bonus Cash</TableHead>
                    <TableHead className="text-right text-gray-400">Locked</TableHead>
                    <TableHead className="text-right text-gray-400">Remaining wagering</TableHead>
                    <TableHead className="text-right text-gray-400">Available</TableHead>
                    <TableHead className="text-gray-400">Notes</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {steps.map((s) => (
                    <TableRow key={s.index} className="border-gray-800 align-top">
                      <TableCell className="text-gray-300">{s.index + 1}</TableCell>
                      <TableCell className="whitespace-nowrap text-white">{describeEvent(s.event)}</TableCell>
                      <TableCell className="text-right text-gray-300">
                        {s.event.kind === "BET" && !s.error ? fmt(s.realDeducted) : "-"}
                      </TableCell>
                      <TableCell className="text-right text-gray-300">
                        {s.event.kind === "BET" && !s.error ? fmt(s.bonusDeducted) : "-"}
                      </TableCell>
                      <TableCell className="text-right text-gray-300">
                        {s.event.kind === "BET" && !s.error ? fmt(s.contribution) : "-"}
                      </TableCell>
                      <TableCell className="text-right text-white">{fmt(s.snapshot.wulfCash)}</TableCell>
                      <TableCell className="text-right text-white">{fmt(s.snapshot.bonusWulfCash)}</TableCell>
                      <TableCell className="text-right text-gray-300">{fmt(s.snapshot.lockedWulfCash)}</TableCell>
                      <TableCell className="text-right text-gray-300">{fmt(remainingWagering(s.entries))}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-300">
                        {fmt(s.snapshot.availableToWithdraw)}
                      </TableCell>
                      <TableCell className="max-w-[360px] text-xs text-gray-400">
                        {s.error ? (
                          <span className="text-red-400">{s.error}</span>
                        ) : s.notes.length ? (
                          <ul className="list-disc space-y-1 pl-4">
                            {s.notes.map((n, i) => (
                              <li key={i}>{n}</li>
                            ))}
                          </ul>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => removeEvent(s.index)}
                          className="rounded p-1 text-gray-500 hover:bg-[#242B35] hover:text-red-400"
                          aria-label="Remove event"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {/* Formula reference */}
        <Card className="border border-gray-800 bg-[#191D24] p-5 text-sm text-gray-300">
          <h2 className="mb-3 text-lg font-semibold text-white">
            Formulas —{" "}
            {ruleSet === "proposed"
              ? "as implemented in the API"
              : isPotModel(ruleSet)
                ? "PROPOSED rule set (not in the API)"
                : "the API's previous rule"}
          </h2>
          <ol className="list-decimal space-y-2 pl-5">
            {isPotModel(ruleSet) ? (
              <>
                <li>
                  <span className="text-white">One shared pot.</span> Every award — deposit, bonus, prize —
                  goes into a single locked pot. There is no pot per award. The pot has a bonus part and a
                  real part only so the wallet cards can show them.
                </li>
                <li>
                  <span className="text-white">Bet funding.</span>{" "}
                  {ruleSet === "proposedDepositFirst"
                    ? "Stake is paid from the pot's real part first, then its bonus part, then redeemable cash."
                    : ruleSet === "proposedRedeemFirst"
                      ? "Stake is paid from redeemable cash FIRST, then the pot's bonus part, then its real part — the player's own money is the first thing at risk."
                      : "Stake is paid from the pot's bonus part first, then its real part, then redeemable cash."}{" "}
                  {ruleSet === "proposedRedeemFirst"
                    ? "The payout then gives each part back what it staked, in the reverse order — real part, bonus part, redeemable cash last — so a part-loss is borne by redeemable cash first, then the bonus part, then the real part, the same order the stake was taken in. Anything above the stake is the win: while a rollover is open it goes into the locked pot, with nothing left to wager it is redeemable at once."
                    : "Payout goes back to the part that paid, pro rata, so winnings made with pot money stay locked in the pot."}
                  {(ruleSet === "proposed" || ruleSet === "proposedBonusLost") &&
                    " While a rollover is open, redeemable cash gets back only what it staked — the winnings above it join the pot and are released when the last rollover closes. Money already redeemable is never taken away by a win."}
                </li>
                <li>
                  <span className="text-white">Rollover progress — strictly sequential.</span> The whole
                  stake fills the first open gate until DONE, then the next.{" "}
                  {ruleSet === "proposedDepositFirst"
                    ? "Deposit and prize gates come first, then bonus gates."
                    : ruleSet === "proposedByOutcome" || ruleSet === "proposedByOutcomePerAward"
                      ? "A winning bet (payout above the stake) counts toward bonus gates first; any other bet counts toward deposit and prize gates first. What one family cannot take goes to the other."
                      : "Purchases and awards are worked through oldest first. Inside a purchase its bonus gate fills first, then its deposit gate. A bonus that arrives later queues behind the purchase before it — it never jumps ahead of that purchase's deposit."}{" "}
                  Each gate needs <code className="rounded bg-[#0F1419] px-1">amount × multiplier</code>.
                </li>
                {ruleSet === "proposedByOutcomePerAward" ? (
                  <li>
                    <span className="text-white">Release — per bundle.</span> A gate that meets its wagering is
                    marked DONE. When every gate of a bundle or award is done, the pot is released except the
                    deposit and bonus amounts of awards that still have an open gate (capped at what the pot
                    holds), so a finished first bundle&apos;s winnings become redeemable while a later bundle is
                    still being wagered. When the last gate is done the rest is released:{" "}
                    <code className="rounded bg-[#0F1419] px-1">available = redeemable cash</code>,{" "}
                    <code className="rounded bg-[#0F1419] px-1">locked = the pot</code>. A lost pot does not cancel
                    any gate — every requirement still has to be wagered through.
                  </li>
                ) : (
                  <li>
                    <span className="text-white">Release.</span> A gate that meets its wagering is marked DONE,
                    but the pot stays locked while any gate is open — a running rollover never makes money
                    redeemable. When the last gate is done the whole pot moves to redeemable cash at once:{" "}
                    <code className="rounded bg-[#0F1419] px-1">available = redeemable cash</code>,{" "}
                    <code className="rounded bg-[#0F1419] px-1">locked = the pot</code>. Money once released is never
                    locked again by a later award;{" "}
                    {ruleSet === "proposedRedeemFirst"
                      ? "it is spent FIRST, so a losing bet takes it before any locked money."
                      : "it is spent last, and only a losing bet takes it down."}{" "}
                    {ruleSet === "proposed" || ruleSet === "proposedRedeemFirst" || ruleSet === "proposedBonusLost"
                      ? "Losing cancels nothing while any balance remains — every requirement still has to be wagered through. Only when a bet leaves the player with no balance at all is every open rollover cancelled and its remaining wagering dropped; the next purchase or bonus then starts fresh."
                      : "A lost pot does not cancel any gate — every requirement still has to be wagered through."}
                  </li>
                )}
                {ruleSet === "proposedBonusLost" && (
                  <li>
                    <span className="text-white">Bonus lost.</span> When a bet leaves the bonus balance at zero,
                    every open bonus gate is closed as done and its remaining wagering is waived. Wagering then
                    moves to the deposit and prize gates. A bet that leaves any bonus behind, such as a win, keeps
                    the bonus gates open. The bet that loses the bonus still counts in full toward the bonus gate.
                  </li>
                )}
              </>
            ) : (
              <>
                <li>
                  <span className="text-white">Bet funding.</span> Real Wulf Cash is debited first; only the
                  shortfall comes from bonus:{" "}
                  <code className="rounded bg-[#0F1419] px-1">realDeducted = min(stake, wulfCash)</code>,{" "}
                  <code className="rounded bg-[#0F1419] px-1">bonusDeducted = stake − realDeducted</code>.
                  Payout is always credited to real Wulf Cash.
                </li>
                <li>
                  <span className="text-white">Rollover progress.</span>{" "}
                  <code className="rounded bg-[#0F1419] px-1">contribution = realDeducted + bonusDeducted</code>{" "}
                  is poured into active entries oldest-first (DEPOSIT before BONUS within one purchase).
                  Each entry needs <code className="rounded bg-[#0F1419] px-1">amount × multiplier</code>.
                </li>
                <li>
                  <span className="text-white">DEPOSIT / WINNINGS done.</span>{" "}
                  <code className="rounded bg-[#0F1419] px-1">
                    redeemableCol = min(wulfCash, max(redeemableCol + amount, wulfCash − otherActiveLocked))
                  </code>{" "}
                  where <em>otherActiveLocked</em> counts every other active entry, bonus ones included.
                </li>
                <li>
                  <span className="text-white">BONUS done.</span>{" "}
                  <code className="rounded bg-[#0F1419] px-1">
                    toConvert = max(0, bonusWulfCash − otherActiveBonusLocked)
                  </code>{" "}
                  moves bonus → real and adds the same to the redeemable column.
                </li>
                <li>
                  <span className="text-white">Available to redeem.</span>{" "}
                  <code className="rounded bg-[#0F1419] px-1">locked = Σ amount of active DEPOSIT/WINNINGS</code>,{" "}
                  <code className="rounded bg-[#0F1419] px-1">
                    available = min(wulfCash, max(wulfCash − locked, redeemableCol))
                  </code>
                  . Bonus entries never lock real cash; only the deposit principal is held, so winnings on top
                  of it are redeemable before the rollover finishes.
                </li>
              </>
            )}
          </ol>
          <p className="mt-3 text-xs text-gray-500">
            Not modelled: entry expiry / forfeiture, instant-rebate rows, Wulf Coin play, redeem requests.
          </p>
        </Card>
      </div>
    </div>
  );
}
