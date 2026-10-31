"use client";

import { useId } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CircleSlash,
  Info,
  Moon,
  MoveRight,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import {
  PLAYER_TAG_META,
  PLAYER_TAGS,
  PLAYER_TREND_META,
  type PlayerPerformanceDetail,
  type PlayerTag,
  type PlayerTrend,
} from "@/api/player-performance/player-performance.api";
import type { ReportCurrency } from "@/api/reports/reports";
import { plural } from "./PerformanceCards";
import {
  EMPTY,
  daysSince,
  fmtAmount,
  fmtCount,
  fmtDaysAgo,
  fmtPct,
  fmtUsd,
  fmtUtcDate,
  num,
  useNow,
} from "./PerformanceFormat";

/**
 * "What is this player doing now": the trend and recency are relative to
 * today (UTC) whatever range the tab shows; the behaviour tags use the
 * selected range, each explained with the rule and this player's own figures.
 */

type TagTone = (typeof PLAYER_TAG_META)[PlayerTag]["tone"];

const TAG_TONE: Record<TagTone, { className: string; icon: LucideIcon; label: string }> = {
  risk: {
    className: "border-red-500/30 bg-red-500/10 text-red-400",
    icon: ShieldAlert,
    label: "Risk",
  },
  warn: {
    className: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    icon: TriangleAlert,
    label: "Watch",
  },
  good: {
    className: "border-green-500/30 bg-green-500/10 text-green-400",
    icon: BadgeCheck,
    label: "Value",
  },
  info: {
    className: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    icon: Info,
    label: "Info",
  },
};

/** Risk first: the flags that need someone to act lead the list. */
const TONE_ORDER: Record<TagTone, number> = { risk: 0, warn: 1, good: 2, info: 3 };

const TREND_STYLE: Record<PlayerTrend, { className: string; icon: LucideIcon }> = {
  new: { className: "border-sky-500/30 bg-sky-500/10 text-sky-300", icon: Sparkles },
  rising: { className: "border-green-500/30 bg-green-500/10 text-green-400", icon: TrendingUp },
  steady: { className: "border-[#2F3744] bg-[#242B35] text-gray-200", icon: MoveRight },
  declining: {
    className: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    icon: TrendingDown,
  },
  dormant: { className: "border-orange-500/30 bg-orange-500/10 text-orange-300", icon: Moon },
  inactive: { className: "border-[#2F3744] bg-[#1A2027] text-gray-400", icon: CircleSlash },
};

/** Known tags only, once each, risk first then in the contract's order. */
function orderTags(tags: PlayerTag[] | null | undefined): PlayerTag[] {
  const known = new Set((tags ?? []).filter((t) => t in PLAYER_TAG_META));
  return PLAYER_TAGS.filter((t) => known.has(t)).sort(
    (a, b) => TONE_ORDER[PLAYER_TAG_META[a].tone] - TONE_ORDER[PLAYER_TAG_META[b].tone],
  );
}

const cash = (v: number | null | undefined) => `${fmtAmount(v, "wulfCash")} Wulf Cash`;

const ON_COIN_VIEW = "switch the currency toggle to Wulf Cash to see this player's figures behind it";

/** A date with how long ago it was, or "never". */
function whenText(value: string | null | undefined, now: number): string {
  if (!value) return "never";
  const shown = fmtUtcDate(value);
  if (shown === EMPTY) return "never";
  return `${shown} (${fmtDaysAgo(daysSince(value, now))})`;
}

/**
 * The "Why" line: the rule's inputs, read off this player's numbers for the
 * range on screen. Tags that are measured in Wulf Cash can only be explained
 * with Wulf Cash figures, which the Wulf Coin view does not carry.
 */
function tagReason(
  tag: PlayerTag,
  detail: PlayerPerformanceDetail,
  currency: ReportCurrency,
  now: number,
): string {
  const t = detail.totals;
  const onCash = currency === "wulfCash";
  const deposited = num(t.depositUsd);
  const redeemed = num(t.redeemUsd);

  switch (tag) {
    case "whale": {
      const r = detail.ranks?.depositUsd;
      const rank =
        r?.rank != null ? ` — #${fmtCount(r.rank)} of ${fmtCount(r.of)} depositors` : "";
      return `Deposited ${fmtUsd(deposited)} over ${plural(num(t.depositCount), "deposit")} in this range${rank}.`;
    }
    case "high_roller":
      return onCash
        ? `Average bet ${cash(t.avgBet)} over ${plural(num(t.rounds), "Wulf Cash round")} in this range.`
        : `Measured on Wulf Cash bets — ${ON_COIN_VIEW}.`;
    case "net_winner":
      return `Redeemed ${fmtUsd(redeemed)} vs deposited ${fmtUsd(deposited)} in this range — ${fmtUsd(
        redeemed - deposited,
      )} more out than in.`;
    case "bonus_hunter":
      if (!onCash) {
        return `Deposited ${fmtUsd(deposited)} in this range; the Wulf Cash bonus behind this tag shows on the Wulf Cash view.`;
      }
      return deposited > 0
        ? `Received ${cash(t.bonus)} in bonuses against ${fmtUsd(deposited)} deposited (${fmtPct(
            t.bonusRatioPct ?? (num(t.bonus) / deposited) * 100,
          )}) in this range.`
        : `Received ${cash(t.bonus)} in bonuses with no deposit in this range.`;
    case "low_play_redeemer":
      return onCash
        ? `Redeemed ${fmtUsd(redeemed)} after wagering ${cash(t.stake)} against ${fmtUsd(deposited)} deposited in this range.`
        : `Redeemed ${fmtUsd(redeemed)} against ${fmtUsd(deposited)} deposited in this range; the Wulf Cash wagered shows on the Wulf Cash view.`;
    case "loss_chaser":
      return `Measured over the last 30 days, not the selected range. Deposits: ${fmtUsd(
        t.deposit7d,
      )} in the last 7 days vs ${fmtUsd(t.depositPrev7d)} the 7 before; last deposit ${whenText(
        t.lastDepositDay,
        now,
      )}.`;
    case "new":
      return `Joined ${whenText(t.joinedAt ?? detail.profile.joinedAt, now)}.`;
    case "dormant": {
      const idle = t.daysInactive;
      return `${
        idle != null ? `Nothing for ${plural(idle, "day")}` : "No recent activity"
      } — last played ${whenText(t.lastPlayedAt, now)}, last deposit ${whenText(
        t.lastDepositDay,
        now,
      )}, last redeem ${whenText(t.lastRedeemAt, now)}.`;
    }
    case "suspicious_credits":
      return onCash
        ? `${cash(t.otherCredits)} credited in this range with no recognised reward source.`
        : `Measured on Wulf Cash credits — ${ON_COIN_VIEW}.`;
    default:
      return EMPTY;
  }
}

function TrendPill({ trend }: { trend: PlayerTrend | null | undefined }) {
  const meta = trend ? PLAYER_TREND_META[trend] : undefined;
  const style = trend ? TREND_STYLE[trend] : undefined;
  if (!meta || !style) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2F3744] px-3 py-1 text-sm text-gray-400">
        Trend unavailable
      </span>
    );
  }
  const Icon = style.icon;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${style.className}`}
      >
        <Icon size={14} aria-hidden="true" />
        {meta.label}
      </span>
      <span className="min-w-0 text-xs text-gray-400">{meta.description}</span>
    </div>
  );
}

/** This week against the one before, with the direction spelled out. */
function WeekCompare({
  label,
  note,
  current,
  previous,
  format,
}: {
  label: string;
  note: string;
  current: number | null | undefined;
  previous: number | null | undefined;
  format: (v: number) => string;
}) {
  const cur = num(current);
  const prev = num(previous);

  let Icon: LucideIcon = ArrowRight;
  let tone = "text-gray-500";
  let text: string;
  if (cur === 0 && prev === 0) {
    text = "None in either week";
  } else if (prev === 0) {
    Icon = ArrowUpRight;
    tone = "text-[#04AD37]";
    text = "None the 7 days before";
  } else {
    const pct = ((cur - prev) / prev) * 100;
    if (pct > 0) {
      Icon = ArrowUpRight;
      tone = "text-[#04AD37]";
    } else if (pct < 0) {
      Icon = ArrowDownRight;
      tone = "text-red-400";
    }
    text = `${pct > 0 ? "+" : ""}${fmtPct(pct)} vs ${format(prev)} the 7 days before`;
  }

  return (
    <div className="min-w-0 rounded-lg border border-[#242B35] bg-[#15181E] px-3 py-2.5">
      <p className="truncate text-[11px] uppercase tracking-[0.14em] text-gray-500">
        {label}
      </p>
      <p className="mt-1 truncate text-lg font-semibold tabular-nums text-white" title={format(cur)}>
        {format(cur)}
      </p>
      <p className={`mt-0.5 flex min-w-0 items-center gap-1 text-[11px] ${tone}`}>
        <Icon size={12} className="shrink-0" aria-hidden="true" />
        <span className="min-w-0">{text}</span>
      </p>
      <p className="mt-0.5 text-[10px] text-gray-600">{note}</p>
    </div>
  );
}

export default function PerformanceIntent({
  detail,
  currency,
}: {
  detail: PlayerPerformanceDetail;
  /** The bucket the figures in `detail` are in (not necessarily the toggle's). */
  currency: ReportCurrency;
}) {
  const titleId = useId();
  const now = useNow(60_000);
  const t = detail.totals;
  const tags = orderTags(t.tags);
  const lastPlayed = t.lastPlayedAt ?? detail.profile.lastPlayedAt;
  const idle = t.daysInactive;

  const recency: { label: string; value: string }[] = [
    { label: "Last played", value: whenText(lastPlayed, now) },
    { label: "Last deposit", value: whenText(t.lastDepositDay, now) },
    { label: "Last redeem", value: whenText(t.lastRedeemAt, now) },
    {
      label: "Inactive for",
      value:
        idle == null
          ? "No play, deposit or redeem ever"
          : idle <= 0
            ? "Active today"
            : plural(idle, "day"),
    },
    { label: "Joined", value: whenText(t.joinedAt ?? detail.profile.joinedAt, now) },
  ];

  return (
    <section
      aria-labelledby={titleId}
      className="min-w-0 rounded-xl border border-[#242B35] bg-[#191D24]"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-[#242B35] px-4 py-3">
        <h3 id={titleId} className="text-sm font-semibold text-white">
          Intent
        </h3>
        <p className="text-[11px] text-gray-500">
          What this player is doing now · trend and recency relative to today (UTC)
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 p-4 xl:grid-cols-5">
        {/* trend + recency */}
        <div className="min-w-0 space-y-4 xl:col-span-2">
          <TrendPill trend={t.trend} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <WeekCompare
              label="Rounds · last 7 days"
              note="Both currencies"
              current={t.rounds7d}
              previous={t.roundsPrev7d}
              format={(v) => fmtCount(v)}
            />
            <WeekCompare
              label="Deposits · last 7 days"
              note="USD"
              current={t.deposit7d}
              previous={t.depositPrev7d}
              format={(v) => fmtUsd(v)}
            />
          </div>

          <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-[auto_minmax(0,1fr)]">
            {recency.map((r) => (
              <div key={r.label} className="contents">
                <dt className="text-gray-500">{r.label}</dt>
                <dd className="mb-1.5 min-w-0 text-gray-200 sm:mb-0">{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* behaviour tags */}
        <div className="min-w-0 space-y-3 xl:col-span-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
              Behaviour flags
            </h4>
            <span className="text-[11px] text-gray-500">
              {tags.length} of {PLAYER_TAGS.length} rules match
            </span>
          </div>

          {currency === "wulfCoin" ? (
            <p className="flex items-start gap-2 rounded-lg border border-[#F59E0B]/25 bg-[#F59E0B]/5 px-3 py-2 text-[11px] text-amber-200/90">
              <Info size={13} className="mt-px shrink-0" aria-hidden="true" />
              <span>
                You are viewing Wulf Coins. Tags are always worked out on Wulf Cash and
                USD, so the Wulf Cash figures behind some of them only show on the Wulf
                Cash view.
              </span>
            </p>
          ) : null}

          {tags.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-[#2F3744] px-3 py-3 text-xs text-gray-400">
              <BadgeCheck size={14} className="shrink-0 text-[#04AD37]" aria-hidden="true" />
              <span>
                <span className="font-medium text-gray-200">No behaviour flags</span> — none
                of the tag rules match this player in the selected range.
              </span>
            </div>
          ) : (
            <ul className="space-y-2">
              {tags.map((tag) => {
                const meta = PLAYER_TAG_META[tag];
                const tone = TAG_TONE[meta.tone];
                const ToneIcon = tone.icon;
                return (
                  <li
                    key={tag}
                    className="min-w-0 rounded-lg border border-[#242B35] bg-[#15181E] px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${tone.className}`}
                      >
                        <ToneIcon size={12} aria-hidden="true" />
                        {meta.label}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.14em] text-gray-500">
                        {tone.label}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-gray-400">{meta.description}</p>
                    <p className="mt-1 text-xs text-gray-200">
                      <span className="font-semibold text-white">Why:</span>{" "}
                      {tagReason(tag, detail, currency, now)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-[11px] text-gray-500">
            Tags use the selected range (Loss Chaser looks at the last 30 days); whale and
            high-roller percentiles rank against every player.
          </p>
        </div>
      </div>
    </section>
  );
}
