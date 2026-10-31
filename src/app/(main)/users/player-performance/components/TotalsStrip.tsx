"use client";

import type { PlayerPerformanceSummary } from "@/api/player-performance/player-performance.api";
import type { ReportCurrency } from "@/api/reports/reports";
import { amountDigits, currencyName, fmtAmount, fmtCount, fmtUsd, signClass } from "./columns";

type Item = { label: string; value: string; tone?: string; hint?: string };

function items(s: PlayerPerformanceSummary, currency: ReportCurrency): Item[] {
  const cur = currencyName(currency);
  return [
    { label: "Players", value: fmtCount(s.players) },
    { label: "Deposits (USD)", value: fmtUsd(s.depositUsd), hint: `${fmtCount(s.depositCount)} deposits` },
    { label: "Redeemed (USD)", value: fmtUsd(s.redeemUsd) },
    { label: "Net Deposit (USD)", value: fmtUsd(s.netDepositUsd), tone: signClass(s.netDepositUsd) },
    {
      label: "Pending Redeem (USD)",
      value: fmtUsd(s.pendingRedeemUsd),
      hint: "owed now, not range-limited",
    },
    { label: `Wagered (${cur})`, value: fmtAmount(s.stake, currency) },
    { label: `GGR (${cur})`, value: fmtAmount(s.ggr, currency), tone: signClass(s.ggr, amountDigits(currency, s.ggr)) },
    { label: `Bonus (${cur})`, value: fmtAmount(s.bonus, currency) },
    { label: `NGR (${cur})`, value: fmtAmount(s.ngr, currency), tone: signClass(s.ngr, amountDigits(currency, s.ngr)) },
    { label: "Rounds", value: fmtCount(s.rounds) },
    { label: "Referrals", value: fmtCount(s.referrals) },
  ];
}

export default function TotalsStrip({
  summary,
  currency,
  dimmed,
}: {
  /** Null until the first response: the strip shows its skeleton then only. */
  summary: PlayerPerformanceSummary | null;
  currency: ReportCurrency;
  /** A refetch is replacing what is shown: keep it, but dimmed. */
  dimmed: boolean;
}) {
  const list = summary ? items(summary, currency) : [];
  return (
    <section
      aria-label="Totals for all matching players"
      aria-busy={!summary || dimmed}
      className={`rounded-xl border border-[#242B35] bg-[#191D24] p-4 transition-opacity duration-200 ${
        dimmed ? "opacity-60" : "opacity-100"
      }`}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-xs uppercase tracking-[0.18em] text-gray-400">Totals</h2>
        <p className="text-xs text-gray-500">
          {!summary
            ? "Covers every player matching the filters, not just this page"
            : `Covers all ${fmtCount(summary.players)} matching players, not just this page`}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        {!summary
          ? Array.from({ length: 11 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-20 animate-pulse rounded bg-[#242B35]" />
                <div className="h-5 w-24 animate-pulse rounded bg-[#242B35]" />
              </div>
            ))
          : list.map((item) => (
              <div key={item.label} className="min-w-0">
                <dt className="truncate text-[11px] uppercase tracking-wider text-gray-500">
                  {item.label}
                </dt>
                <dd className={`mt-1 truncate text-lg font-semibold tabular-nums ${item.tone ?? "text-white"}`}>
                  {item.value}
                </dd>
                {item.hint && <dd className="truncate text-[11px] text-gray-500">{item.hint}</dd>}
              </div>
            ))}
      </dl>
    </section>
  );
}
