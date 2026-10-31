"use client";

import { useMemo } from "react";
import Image from "next/image";
import {
  SortableTh,
  useSortedRows,
  useTableSort,
  type SortAccessors,
} from "@/components/filters/tableSort";
import type {
  PlayerPerformanceBonusLine,
  PlayerPerformanceGame,
} from "@/api/player-performance/player-performance.api";
import type { ReportCurrency } from "@/api/reports/reports";
import { formatUtcDateTime } from "@/lib/utils";
import {
  CURRENCY_META,
  fmtAmount,
  fmtCount,
  fmtPct,
  num,
  signedTone,
  withSign,
} from "./PerformanceFormat";

const PANEL = "min-w-0 rounded-xl border border-[#242B35] bg-[#191D24]";

function PanelHeader({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-[#242B35] px-4 py-3">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {note ? <p className="text-[11px] text-gray-500">{note}</p> : null}
    </div>
  );
}

// ── top games ────────────────────────────────────────────────────────────────

type GameSortKey =
  | "gameName"
  | "provider"
  | "rounds"
  | "roundsWon"
  | "roundsLost"
  | "stake"
  | "win"
  | "ggr"
  | "maxWin"
  | "lastPlayedAt";

// Module-level so useSortedRows' memo is not invalidated on every render.
const GAME_ACCESSORS: SortAccessors<PlayerPerformanceGame, GameSortKey> = {
  gameName: (g) => g.gameName,
  provider: (g) => g.provider,
  rounds: (g) => num(g.rounds),
  roundsWon: (g) => num(g.roundsWon),
  roundsLost: (g) => num(g.roundsLost),
  stake: (g) => num(g.stake),
  win: (g) => num(g.win),
  ggr: (g) => num(g.ggr),
  maxWin: (g) => num(g.maxWin),
  lastPlayedAt: (g) => (g.lastPlayedAt ? new Date(g.lastPlayedAt).getTime() : null),
};

const TH = "px-4 py-3 text-xs font-medium uppercase tracking-wider text-white whitespace-nowrap";

export function TopGamesTable({
  games,
  currency,
}: {
  games: PlayerPerformanceGame[];
  currency: ReportCurrency;
}) {
  // The server already orders by rounds; no key keeps that order until a click.
  const { sort, toggle } = useTableSort<GameSortKey>();
  const rows = useSortedRows(games, sort, GAME_ACCESSORS);
  const amount = (v: number) => fmtAmount(v, currency);

  const numericTh = (label: string, key: GameSortKey) => (
    <SortableTh
      label={label}
      sortKey={key}
      sort={sort}
      onToggle={toggle}
      align="right"
      className={`${TH} text-right`}
    />
  );

  return (
    <div className={PANEL}>
      <PanelHeader
        title="Top Games"
        note={`By rounds · top ${games.length || 0} of max 25 · ${CURRENCY_META[currency].label}`}
      />
      {games.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-gray-500">
          No games played in this range.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-250 table-auto text-sm">
            <thead className="bg-[#242B35]">
              <tr>
                <SortableTh
                  label="Game"
                  sortKey="gameName"
                  sort={sort}
                  onToggle={toggle}
                  className={`${TH} text-left`}
                />
                <SortableTh
                  label="Provider"
                  sortKey="provider"
                  sort={sort}
                  onToggle={toggle}
                  className={`${TH} text-left`}
                />
                {numericTh("Rounds", "rounds")}
                {numericTh("Rounds Won", "roundsWon")}
                {numericTh("Rounds Lost", "roundsLost")}
                {numericTh("Wagered", "stake")}
                {numericTh("Won", "win")}
                {numericTh("GGR", "ggr")}
                {numericTh("Max Win", "maxWin")}
                {numericTh("Last Played", "lastPlayedAt")}
              </tr>
            </thead>
            <tbody>
              {rows.map((g, i) => (
                <tr
                  key={`${g.provider}:${g.gameName}`}
                  className={`${i % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"} hover:bg-[#1E2330]`}
                >
                  <td className="max-w-60 truncate px-4 py-3 text-white" title={g.gameName}>
                    {g.gameName || "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-400">{g.provider || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-200">
                    {fmtCount(g.rounds)}
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${
                      num(g.roundsWon) > 0 ? "text-[#04AD37]" : "text-gray-500"
                    }`}
                  >
                    {fmtCount(g.roundsWon)}
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${
                      num(g.roundsLost) > 0 ? "text-red-400" : "text-gray-500"
                    }`}
                  >
                    {fmtCount(g.roundsLost)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-200">
                    {amount(g.stake)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-200">
                    {amount(g.win)}
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums ${signedTone(g.ggr)}`}
                  >
                    {withSign(amount(g.ggr), g.ggr)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-200">
                    {amount(g.maxWin)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-gray-400">
                    {formatUtcDateTime(g.lastPlayedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── bonus breakdown ──────────────────────────────────────────────────────────

export function BonusBreakdown({
  lines,
  currency,
}: {
  lines: PlayerPerformanceBonusLine[];
  currency: ReportCurrency;
}) {
  const { sorted, totalAmount, totalCount } = useMemo(() => {
    const sortedLines = [...lines].sort((a, b) => num(b.amount) - num(a.amount));
    return {
      sorted: sortedLines,
      totalAmount: sortedLines.reduce((s, l) => s + num(l.amount), 0),
      totalCount: sortedLines.reduce((s, l) => s + num(l.count), 0),
    };
  }, [lines]);

  const coin = CURRENCY_META[currency].icon;
  // Bars are shares of the positive total; a clawback line gets no bar
  // rather than a negative width.
  const barBase = sorted.reduce((s, l) => s + Math.max(0, num(l.amount)), 0);

  return (
    <div className={PANEL}>
      <PanelHeader title="Bonus Breakdown" note={CURRENCY_META[currency].label} />
      {sorted.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-gray-500">
          No bonuses in this range.
        </p>
      ) : (
        <>
          <ul className="space-y-3 px-4 py-4">
            {sorted.map((line) => {
              const amount = num(line.amount);
              const share = barBase > 0 ? (Math.max(0, amount) / barBase) * 100 : 0;
              return (
                <li key={line.category} className="min-w-0">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-gray-200" title={line.label}>
                      {line.label}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 tabular-nums text-white">
                      <Image src={coin} alt="" width={12} height={12} />
                      {fmtAmount(amount, currency)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#242B35]">
                      <div
                        className="h-full rounded-full bg-[#C47A0A]"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <span className="w-28 shrink-0 text-right text-[11px] tabular-nums text-gray-500">
                      {fmtCount(line.count)}× · {fmtPct(share)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between gap-3 border-t border-[#242B35] px-4 py-3 text-sm">
            <span className="text-gray-400">
              Total <span className="text-gray-500">· {fmtCount(totalCount)} grants</span>
            </span>
            <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-white">
              <Image src={coin} alt="" width={12} height={12} />
              {fmtAmount(totalAmount, currency)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
