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
import ExportCSV from "@/components/ExportCSV";
import ModelTabs from "../ModelTabs";
import {
  STAKE_SAMPLE_CASES,
  isOpen,
  simulateStake,
  stakeSnapshot,
  type AwardSource,
  type AwardStatus,
  type StakeEvent,
  type StakeStep,
} from "./stake-engine";

type WinMode = "profit" | "payout";

const SOURCE_LABEL: Record<AwardSource, string> = {
  PURCHASE: "Package SC (bought with a purchase)",
  BONUS: "Bonus drop SC (promo / daily / level)",
  PRIZE: "Prize SC (race / challenge / free spin)",
};

const STATUS_CLASS: Record<AwardStatus, string> = {
  NOT_STARTED: "bg-gray-700 text-gray-200",
  ONGOING: "bg-amber-500/20 text-amber-300",
  DONE: "bg-emerald-500/20 text-emerald-300",
  FAILED: "bg-red-500/20 text-red-300",
};

const fmt = (n: number) => n.toFixed(2);

function describeEvent(ev: StakeEvent): string {
  if (ev.kind === "AWARD") return `${ev.label || ev.source} ${fmt(ev.amount)} @ ${ev.multiplier}x`;
  const net = ev.payout - ev.stake;
  const w = ev.weight !== undefined && ev.weight !== 100 ? ` [${ev.weight}%]` : "";
  if (ev.payout <= 0) return `Bet ${fmt(ev.stake)} → LOSE${w}`;
  return `Bet ${fmt(ev.stake)} → WIN ${fmt(net)} (credited ${fmt(ev.payout)})${w}`;
}

// Ledger export: the same columns as the table, amounts as numbers so the
// sheet can add them up, and each step's notes on separate lines in one cell.
const LEDGER_HEADERS = [
  "#",
  "Event",
  "Counts toward playthrough",
  "Balance",
  "Locked",
  "Pending wagering",
  "Available",
  "Notes",
];

const sc = (n: number) => Number(n.toFixed(2));

function ledgerRow(s: StakeStep): (string | number)[] {
  return [
    s.index + 1,
    describeEvent(s.event),
    s.event.kind === "BET" && !s.error ? sc(s.contribution) : "-",
    sc(s.snapshot.balance),
    sc(s.snapshot.locked),
    sc(s.snapshot.pendingWagering),
    sc(s.snapshot.available),
    s.error ?? s.notes.join("\n"),
  ];
}

export default function StakeRolloverCalculatorPage() {
  const [events, setEvents] = useState<StakeEvent[]>([]);

  // Model settings
  const [maxBet, setMaxBet] = useState("0");

  // Award form
  const [source, setSource] = useState<AwardSource>("PURCHASE");
  const [amount, setAmount] = useState("20");
  const [multiplier, setMultiplier] = useState("3");
  const [label, setLabel] = useState("");

  // Bet form
  const [stake, setStake] = useState("10");
  const [win, setWin] = useState("10");
  const [winMode, setWinMode] = useState<WinMode>("profit");
  const [weight, setWeight] = useState("100");

  const num = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const opts = useMemo(() => ({ maxBetWhilePending: num(maxBet) }), [maxBet]);
  const { steps, final } = useMemo(() => simulateStake(events, opts), [events, opts]);
  const snap = useMemo(() => stakeSnapshot(final), [final]);

  const stakeNum = num(stake);
  const winNum = num(win);
  const payoutPreview = winMode === "profit" ? stakeNum + winNum : winNum;

  const [redoStack, setRedoStack] = useState<StakeEvent[]>([]);
  const pushEvent = (ev: StakeEvent) => {
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

  const placeBet = (outcome: "win" | "lose") => {
    const w = num(weight);
    pushEvent({
      kind: "BET",
      stake: stakeNum,
      payout: outcome === "lose" ? 0 : payoutPreview,
      ...(w !== 100 ? { weight: w } : {}),
    });
  };

  const addAward = () => {
    pushEvent({
      kind: "AWARD",
      source,
      amount: num(amount),
      multiplier: num(multiplier),
      label: label.trim() || undefined,
    });
    setLabel("");
  };

  const loadSample = (key: string) => {
    const sample = STAKE_SAMPLE_CASES.find((c) => c.key === key);
    if (!sample) return;
    setEvents(sample.events);
    setRedoStack([]);
  };

  const removeEvent = (i: number) => setEvents((prev) => prev.filter((_, idx) => idx !== i));

  const kpi = [
    { label: "SC balance (single bucket)", value: fmt(snap.balance) },
    { label: "Locked (until wagering is cleared)", value: fmt(snap.locked) },
    { label: "Pending wagering", value: fmt(snap.pendingWagering) },
    { label: "Available to redeem", value: fmt(snap.available), highlight: true },
  ];

  const openAwards = final.awards.filter(isOpen);
  const totalRequired = openAwards.reduce((s, a) => s + a.required, 0);
  const totalCompleted = openAwards.reduce((s, a) => s + a.completed, 0);
  const overallPct = totalRequired > 0 ? Math.min(100, (totalCompleted / totalRequired) * 100) : 100;

  const inputCls = "h-10 border-gray-700 bg-[#0F1419] text-white";

  return (
    <div className="min-h-screen bg-[#0F1419] p-4 sm:p-6">
      <div className="mx-auto w-full max-w-[1380px] space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Calculator className="h-6 w-6 text-[#B93DEB]" />
            Rollover Calculator
            <span className="ml-2 rounded bg-sky-500/20 px-2 py-0.5 text-xs font-semibold text-sky-300">
              STAKE MODEL
            </span>
          </h1>
          <div className="flex flex-nowrap gap-2 overflow-x-auto">
            <Button type="button" variant="outline" onClick={undo} disabled={events.length === 0} title="Ctrl+Z" className="h-10 border-gray-600 text-gray-200 hover:bg-[#242B35]">
              <Undo2 className="mr-2 h-4 w-4" />
              Undo
            </Button>
            <Button type="button" variant="outline" onClick={redo} disabled={redoStack.length === 0} title="Ctrl+Y" className="h-10 border-gray-600 text-gray-200 hover:bg-[#242B35]">
              <Redo2 className="mr-2 h-4 w-4" />
              Redo
            </Button>
            {/* Always shows the placeholder: picking a case loads it, it is not a setting. */}
            <Select value="" onValueChange={loadSample}>
              <SelectTrigger className="h-10! border-gray-600 text-gray-200 hover:bg-[#242B35] data-placeholder:text-gray-200!">
                <FlaskConical className="h-4 w-4 text-gray-200" />
                <SelectValue placeholder="Load sample case" />
              </SelectTrigger>
              <SelectContent className="border-gray-700 bg-[#191D24] text-white">
                {STAKE_SAMPLE_CASES.map((c) => (
                  <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={() => { setEvents([]); setRedoStack([]); }} disabled={events.length === 0} className="h-10 border-gray-600 text-gray-200 hover:bg-[#242B35]">
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>

        <ModelTabs />

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpi.map((item) => (
            <Card
              key={item.label}
              className={`flex min-h-[104px] flex-col items-center justify-center border px-4 py-3 text-center ${
                item.highlight ? "border-[#B93DEB] bg-[#B93DEB]/10" : "border-gray-800 bg-[#191D24]"
              }`}
            >
              <p className="text-sm text-gray-400">{item.label}</p>
              <p className="mt-2 text-2xl font-bold text-white">{item.value}</p>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1">
            {/* Bet panel */}
            <Card className="border border-[#B93DEB]/50 bg-[#191D24] p-5">
              <h2 className="mb-1 text-lg font-semibold text-white">Place bet</h2>
              <p className="mb-4 text-xs text-gray-400">
                Stake comes out of the single SC balance and lowers pending wagering. While wagering
                is pending the payout stays locked; once it reaches 0 the whole balance is redeemable.
              </p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-gray-300">Stake (SC)</Label>
                    <Input type="number" min={0} step="0.01" value={stake} onChange={(e) => setStake(e.target.value)} onKeyDown={(e) => e.key === "Enter" && placeBet("win")} className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-gray-300">Win (SC)</Label>
                    <Input type="number" min={0} step="0.01" value={win} onChange={(e) => setWin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && placeBet("win")} className={inputCls} />
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
                        winMode === opt.key ? "bg-[#7C3AED] text-white" : "text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-gray-300">Game weight % (Stake.us counts most games at 100)</Label>
                  <Input type="number" min={0} max={100} step="1" value={weight} onChange={(e) => setWeight(e.target.value)} className={inputCls} />
                </div>

                <p className="text-xs text-gray-500">
                  Wallet credited on win: <span className="text-white">{fmt(payoutPreview)}</span>{" "}
                  (stake {fmt(stakeNum)} debited first → net {fmt(payoutPreview - stakeNum)}). Counts{" "}
                  <span className="text-white">{fmt((stakeNum * num(weight)) / 100)}</span> toward pending wagering.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <Button type="button" onClick={() => placeBet("win")} disabled={stakeNum <= 0} className="h-10 bg-emerald-600 text-white hover:bg-emerald-500">
                    Bet &amp; Win
                  </Button>
                  <Button type="button" onClick={() => placeBet("lose")} disabled={stakeNum <= 0} className="h-10 bg-red-600 text-white hover:bg-red-500">
                    Bet &amp; Lose
                  </Button>
                </div>

                <Button type="button" variant="outline" onClick={undo} disabled={events.length === 0} className="h-9 w-full border-gray-700 text-gray-300 hover:bg-[#242B35]">
                  <Undo2 className="mr-2 h-4 w-4" />
                  Undo last step
                  {events.length > 0 && (
                    <span className="ml-2 truncate text-xs text-gray-500">({describeEvent(events[events.length - 1])})</span>
                  )}
                </Button>
              </div>
            </Card>

            {/* Award panel */}
            <Card className="border border-gray-800 bg-[#191D24] p-5">
              <h2 className="mb-4 text-lg font-semibold text-white">Award SC</h2>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-gray-300">Source</Label>
                  <Select value={source} onValueChange={(v) => setSource(v as AwardSource)}>
                    <SelectTrigger className="h-10 w-full border-gray-700 bg-[#0F1419] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-gray-700 bg-[#191D24] text-white">
                      {(Object.keys(SOURCE_LABEL) as AwardSource[]).map((k) => (
                        <SelectItem key={k} value={k}>{SOURCE_LABEL[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-gray-300">Amount (SC)</Label>
                    <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-gray-300">Playthrough (x)</Label>
                    <Input type="number" min={0} step="0.1" value={multiplier} onChange={(e) => setMultiplier(e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-gray-300">Label (optional)</Label>
                  <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={source === "PURCHASE" ? "$20 package" : source === "BONUS" ? "Bonus drop" : "Race prize"} className={inputCls} />
                </div>
                <Button type="button" onClick={addAward} disabled={num(amount) <= 0} className="h-10 w-full bg-[#B93DEB] text-white hover:bg-[#a234d1]">
                  <Plus className="mr-2 h-4 w-4" />
                  Award SC
                </Button>
              </div>
            </Card>

            {/* Model settings */}
            <Card className="border border-gray-800 bg-[#191D24] p-5">
              <h2 className="mb-4 text-lg font-semibold text-white">Model settings</h2>
              <div className="space-y-1.5">
                <Label className="text-gray-300">Max bet while wagering is pending (0 = off)</Label>
                <Input type="number" min={0} step="0.01" value={maxBet} onChange={(e) => setMaxBet(e.target.value)} className={inputCls} />
                <p className="text-xs text-gray-500">Applies retroactively to every bet in the ledger.</p>
              </div>
            </Card>
          </div>

          {/* Awards */}
          <Card className="border border-gray-800 bg-[#191D24] p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Playthrough requirements</h2>
              <span className="text-sm text-gray-400">
                Open progress {fmt(totalCompleted)} / {fmt(totalRequired)} ({overallPct.toFixed(0)}%)
              </span>
            </div>
            {final.awards.length === 0 ? (
              <p className="text-sm text-gray-500">No awards yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800">
                    <TableHead className="text-gray-400">#</TableHead>
                    <TableHead className="text-gray-400">Source</TableHead>
                    <TableHead className="text-gray-400">Label</TableHead>
                    <TableHead className="text-right text-gray-400">Amount</TableHead>
                    <TableHead className="text-right text-gray-400">Mult</TableHead>
                    <TableHead className="text-right text-gray-400">Required</TableHead>
                    <TableHead className="text-right text-gray-400">Completed</TableHead>
                    <TableHead className="text-right text-gray-400">Left</TableHead>
                    <TableHead className="min-w-[140px] text-gray-400">Progress</TableHead>
                    <TableHead className="text-gray-400">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {final.awards.map((a) => {
                    const pct = a.required > 0 ? Math.min(100, (a.completed / a.required) * 100) : 100;
                    return (
                      <TableRow key={a.id} className="border-gray-800">
                        <TableCell className="text-gray-300">{a.id}</TableCell>
                        <TableCell className="text-white">{a.source}</TableCell>
                        <TableCell className="text-gray-300">{a.label}</TableCell>
                        <TableCell className="text-right text-white">{fmt(a.amount)}</TableCell>
                        <TableCell className="text-right text-gray-300">{a.multiplier}x</TableCell>
                        <TableCell className="text-right text-white">{fmt(a.required)}</TableCell>
                        <TableCell className="text-right text-white">{fmt(a.completed)}</TableCell>
                        <TableCell className="text-right text-amber-300">
                          {a.status === "FAILED" ? (
                            <span className="text-gray-500 line-through">{fmt(Math.max(0, a.required - a.completed))}</span>
                          ) : (
                            fmt(Math.max(0, a.required - a.completed))
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded bg-gray-800">
                              <div
                                className={`h-full ${
                                  a.status === "FAILED" ? "bg-red-400/60" : a.status === "DONE" ? "bg-emerald-400" : "bg-[#B93DEB]"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-10 text-right text-xs text-gray-400">{pct.toFixed(0)}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[a.status]}`}
                            title={a.status === "FAILED" ? "The balance hit 0 while this was open; its remaining wagering was dropped" : undefined}
                          >
                            {a.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            <p className="mt-3 text-xs text-gray-500">
              A met row releases nothing on its own: the balance stays locked until pending wagering
              across every row is 0. A FAILED row was still open when the balance hit 0; its remaining
              wagering was dropped and does not count toward the next award.
            </p>
          </Card>
        </div>

        {/* Ledger */}
        <Card className="border border-gray-800 bg-[#191D24] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Step-by-step ledger</h2>
            <ExportCSV
              data={steps}
              headers={LEDGER_HEADERS}
              mapRow={ledgerRow}
              fileName="stake_rollover_ledger.xlsx"
              locked={steps.length === 0}
              lockedTitle="Run a test case first"
            />
          </div>
          {steps.length === 0 ? (
            <p className="text-sm text-gray-500">Add events above or load a sample case.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-800">
                    <TableHead className="text-gray-400">#</TableHead>
                    <TableHead className="text-gray-400">Event</TableHead>
                    <TableHead className="text-right text-gray-400">Counts toward playthrough</TableHead>
                    <TableHead className="text-right text-gray-400">Balance</TableHead>
                    <TableHead className="text-right text-gray-400">Locked</TableHead>
                    <TableHead className="text-right text-gray-400">Pending wagering</TableHead>
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
                      <TableCell className="text-right text-gray-300">{s.event.kind === "BET" && !s.error ? fmt(s.contribution) : "-"}</TableCell>
                      <TableCell className="text-right text-white">{fmt(s.snapshot.balance)}</TableCell>
                      <TableCell className="text-right text-gray-300">{fmt(s.snapshot.locked)}</TableCell>
                      <TableCell className="text-right text-gray-300">{fmt(s.snapshot.pendingWagering)}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-300">{fmt(s.snapshot.available)}</TableCell>
                      <TableCell className="max-w-[360px] text-xs whitespace-normal text-gray-400">
                        {s.error ? (
                          <span className="text-red-400">{s.error}</span>
                        ) : s.notes.length ? (
                          <ul className="list-disc space-y-1 pl-4">{s.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <button type="button" onClick={() => removeEvent(s.index)} className="rounded p-1 text-gray-500 hover:bg-[#242B35] hover:text-red-400" aria-label="Remove event">
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

        {/* Rules */}
        <Card className="border border-gray-800 bg-[#191D24] p-5 text-sm text-gray-300">
          <h2 className="mb-3 text-lg font-semibold text-white">Stake model rules (Stake.us playthrough)</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li><span className="text-white">One SC balance.</span> Package SC, bonus drops and prizes all land in the same balance. There is no separate bonus bucket.</li>
            <li><span className="text-white">One pending wagering figure.</span> Every award adds <code className="rounded bg-[#0F1419] px-1">amount × multiplier</code> to it (Stake.us: 3x on packages and bonus drops). The rows above show which award the wagering has reached; they fill oldest first.</li>
            <li><span className="text-white">Only the stake counts.</span> Every bet lowers pending wagering by its stake, never by the win. Wagering beyond what is pending is not kept for a later award.</li>
            <li><span className="text-white">Nothing is released while wagering is pending.</span> Awarded SC and every win stay locked. When pending wagering reaches 0 the whole balance becomes redeemable: <code className="rounded bg-[#0F1419] px-1">available = balance</code>.</li>
            <li><span className="text-white">Award after clearing.</span> SC that is already redeemable stays redeemable; only the new SC, and what is won while its wagering is pending, is locked. Losses use the locked SC first, so redeemable SC only drops once the locked SC is gone.</li>
            <li><span className="text-white">Balance at 0 ends the round.</span> A bet that leaves the balance at 0 marks every open playthrough FAILED and drops its remaining wagering. None of it carries into the next award, which starts a new round with only its own <code className="rounded bg-[#0F1419] px-1">amount × multiplier</code>.</li>
            <li><span className="text-white">Optional knobs.</span> Game weight % (default 100 — Stake.us counts most games in full) and a max-bet cap while wagering is pending (default off).</li>
          </ol>
          <p className="mt-3 text-xs text-gray-500">
            Built from three worked Stake.us cases (load them above). Rule 5 is an assumption: Stake.us does not publish whether SC redeemable
            before a new purchase stays redeemable (case 2). Not modelled: GC play, minimum redemption, expiry, redeem requests.
          </p>
        </Card>
      </div>
    </div>
  );
}
