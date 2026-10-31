import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import {
  PLAYER_TAG_META,
  PLAYER_TAGS,
  PLAYER_TREND_META,
  type PerformanceSortKey,
  type PlayerPerformanceRow,
  type PlayerTag,
  type PlayerTrend,
} from "@/api/player-performance/player-performance.api";
import type { ReportCurrency } from "@/api/reports/reports";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatStat, formatUtcDateTime } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const usdFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const cashFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const countFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const pctFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const isNum = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n);

/** Rounds to the displayed precision so -0.001 never prints as "-0.00". */
const round = (n: number, digits: number) => {
  const f = 10 ** digits;
  const r = Math.round(n * f) / f;
  return r === 0 ? 0 : r;
};

export const fmtUsd = (n: number | null | undefined) =>
  isNum(n) ? usdFormat.format(round(n, 2)) : "—";

/**
 * Decimals an amount is displayed at. formatStat prints whole numbers below
 * 10,000, so a coin figure is judged (zero? negative?) at 0 places — otherwise
 * -0.3 coins would print "-0" in red.
 */
export const amountDigits = (currency: ReportCurrency, n = 0) =>
  currency === "wulfCoin" && Math.abs(n) < 10_000 ? 0 : 2;

/** Wulf Cash prints in full; Wulf Coins run far larger and stay compact. */
export const fmtAmount = (n: number | null | undefined, currency: ReportCurrency) => {
  if (!isNum(n)) return "—";
  const r = round(n, amountDigits(currency, n));
  return currency === "wulfCoin" ? formatStat(r) : cashFormat.format(r);
};

/** Full precision for thresholds and exports, whichever currency. */
export const fmtExact = (n: number | null | undefined) =>
  isNum(n) ? cashFormat.format(round(n, 2)) : "—";

export const fmtCount = (n: number | null | undefined) =>
  isNum(n) ? countFormat.format(n) : "—";

export const fmtPct = (n: number | null | undefined) =>
  isNum(n) ? `${pctFormat.format(round(n, 1))}%` : "—";

/** Signed figures read green above zero and red below, at display precision. */
export function signClass(n: number | null | undefined, digits = 2): string {
  if (!isNum(n)) return "text-gray-600";
  const r = round(n, digits);
  if (r > 0) return "text-[#04AD37]";
  if (r < 0) return "text-red-500";
  return "text-gray-500";
}

/** A report day is a UTC day, so the date shown is the UTC one. */
export function fmtUtcDay(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * The VIP tier as admins talk about it: the NAME only ("Silver"), never the
 * level inside it. A stray " L3" suffix is stripped should one ever arrive.
 */
export const tierLabel = (name: string | null | undefined): string | null => {
  const n = name?.trim().replace(/\s+L\d+$/i, "");
  return n ? n : null;
};

export const currencyName = (currency: ReportCurrency) =>
  currency === "wulfCoin" ? "Wulf Coins" : "Wulf Cash";

export type IdentityKind = "email" | "phone" | "username";

/** Email first, then phone, then username — how the whole page names a player. */
export function playerIdentity(p: {
  email: string | null;
  phone?: string | null;
  username: string;
}): { primary: string; kind: IdentityKind } {
  const email = p.email?.trim();
  if (email) return { primary: email, kind: "email" };
  const phone = p.phone?.trim();
  if (phone) return { primary: phone, kind: "phone" };
  return { primary: p.username, kind: "username" };
}

/* ------------------------------------------------------------------ */
/* Intent: trend pills, tag chips, week-on-week deltas                 */
/* ------------------------------------------------------------------ */

export const TREND_STYLE: Record<PlayerTrend, string> = {
  new: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  rising: "border-[#04AD37]/50 bg-[#04AD37]/10 text-[#3DDC6A]",
  steady: "border-gray-500/40 bg-gray-500/10 text-gray-300",
  declining: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  dormant: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  inactive: "border-gray-600/40 bg-transparent text-gray-500",
};

export const TREND_DOT: Record<PlayerTrend, string> = {
  new: "bg-sky-400",
  rising: "bg-[#04AD37]",
  steady: "bg-gray-400",
  declining: "bg-amber-400",
  dormant: "bg-orange-500",
  inactive: "bg-gray-600",
};

type TagTone = (typeof PLAYER_TAG_META)[PlayerTag]["tone"];

export const TAG_TONE_STYLE: Record<TagTone, string> = {
  info: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  good: "border-[#04AD37]/40 bg-[#04AD37]/10 text-[#3DDC6A]",
  warn: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  risk: "border-red-500/40 bg-red-500/10 text-red-300",
};

export const TAG_TONE_DOT: Record<TagTone, string> = {
  info: "bg-sky-400",
  good: "bg-[#04AD37]",
  warn: "bg-amber-400",
  risk: "bg-red-500",
};

/**
 * "New" and "Dormant" are also trends — the trend pill already says them, so
 * tag chips and the tag segments leave them out rather than repeat them.
 */
export const TREND_DUPLICATE_TAGS = new Set<PlayerTag>(["new", "dormant"]);

/** The tags offered as filters (segments row, drawer): every tag but the trend duplicates. */
export const SEGMENT_TAGS = PLAYER_TAGS.filter((t) => !TREND_DUPLICATE_TAGS.has(t));

const isKnownTag = (t: string): t is PlayerTag => t in PLAYER_TAG_META;
const isKnownTrend = (t: string): t is PlayerTrend => t in PLAYER_TREND_META;

export const tagLabel = (t: PlayerTag) => PLAYER_TAG_META[t]?.label ?? t;
export const trendLabel = (t: PlayerTrend) => PLAYER_TREND_META[t]?.label ?? t;

export function TrendPill({ trend, title }: { trend: PlayerTrend | null | undefined; title?: string }) {
  if (!trend || !isKnownTrend(trend)) return <span className="text-gray-600">—</span>;
  const meta = PLAYER_TREND_META[trend];
  return (
    <span
      title={title ?? meta.description}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${TREND_STYLE[trend]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${TREND_DOT[trend]}`} aria-hidden />
      {meta.label}
    </span>
  );
}

export function TagChip({ tag }: { tag: PlayerTag }) {
  const meta = PLAYER_TAG_META[tag];
  return (
    <span
      title={meta.description}
      className={`inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-medium ${TAG_TONE_STYLE[meta.tone]}`}
    >
      {meta.label}
    </span>
  );
}

/** The first `max` tags as chips, the rest behind "+N". */
export function TagChips({ tags, max = 2 }: { tags: PlayerTag[] | null | undefined; max?: number }) {
  const list = (tags ?? []).filter((t) => isKnownTag(t) && !TREND_DUPLICATE_TAGS.has(t));
  if (list.length === 0) return <span className="text-gray-600">—</span>;
  const shown = list.slice(0, max);
  const rest = list.slice(max);
  const restLabel = rest.map(tagLabel).join(", ");
  return (
    <div className="flex items-center gap-1">
      {shown.map((t) => (
        <TagChip key={t} tag={t} />
      ))}
      {rest.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              tabIndex={0}
              aria-label={`${rest.length} more: ${restLabel}`}
              className="inline-flex cursor-default items-center rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-gray-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#B93DEB]"
            >
              +{rest.length}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-60 text-left">
            {restLabel}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

/** "▲ 25% vs 120" — this week against the week before. */
export function DeltaLine({
  current,
  previous,
  format,
}: {
  current: number | null | undefined;
  previous: number | null | undefined;
  format: (n: number) => string;
}) {
  const cur = isNum(current) ? current : 0;
  const prev = isNum(previous) ? previous : 0;
  const title = `Last 7 days: ${format(cur)} · the 7 days before: ${format(prev)}`;

  let body: ReactNode;
  let tone = "text-gray-500";
  if (prev <= 0) {
    if (cur > 0) {
      tone = "text-[#04AD37]";
      body = (
        <>
          <ArrowUp size={10} aria-hidden /> new
        </>
      );
    } else {
      body = "no change";
    }
  } else {
    const pct = Math.round(((cur - prev) / prev) * 100);
    const shown = Math.abs(pct) > 999 ? ">999" : String(Math.abs(pct));
    if (pct > 0) {
      tone = "text-[#04AD37]";
      body = (
        <>
          <ArrowUp size={10} aria-hidden /> {shown}%
        </>
      );
    } else if (pct < 0) {
      tone = "text-red-500";
      body = (
        <>
          <ArrowDown size={10} aria-hidden /> {shown}%
        </>
      );
    } else {
      body = "0%";
    }
  }

  return (
    <span className="mt-0.5 inline-flex items-center gap-1 text-[11px]" title={title}>
      <span className={`inline-flex items-center gap-0.5 ${tone}`}>{body}</span>
      <span className="text-gray-500">vs {format(prev)}</span>
    </span>
  );
}

function DaysInactive({ days }: { days: number | null | undefined }) {
  if (!isNum(days)) {
    return (
      <span className="text-gray-600" title="Never played, deposited or redeemed">
        —
      </span>
    );
  }
  const tone = days >= 30 ? "text-red-400" : days >= 14 ? "text-amber-400" : "text-gray-200";
  return <span className={tone}>{days <= 0 ? "Today" : `${fmtCount(days)}d`}</span>;
}

function TopGame({ row }: { row: PlayerPerformanceRow }) {
  const g = row.topGame;
  if (!g) return <span className="text-gray-600">—</span>;
  return (
    <div className="flex max-w-[200px] flex-col leading-tight">
      <span className="truncate text-gray-200" title={g.gameName}>
        {g.gameName}
      </span>
      <span className="mt-0.5 truncate text-[11px] text-gray-500" title={`${g.provider} · ${fmtCount(g.rounds)} rounds`}>
        {g.provider} · {fmtCount(g.rounds)} {g.rounds === 1 ? "round" : "rounds"}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Column definitions                                                  */
/* ------------------------------------------------------------------ */

export type ColumnGroupId = "intent" | "money" | "gameplay" | "rewards" | "referrals" | "activity";

/** Grouping lives in the Columns menu only; the table itself has no group band. */
export const COLUMN_GROUPS: { id: ColumnGroupId; label: string }[] = [
  { id: "intent", label: "Intent (now)" },
  { id: "money", label: "Money In / Out" },
  { id: "gameplay", label: "Gameplay" },
  { id: "rewards", label: "Rewards" },
  { id: "referrals", label: "Referrals" },
  { id: "activity", label: "Activity" },
];

/**
 *  - usd      : real money, never follows the currency toggle
 *  - amount   : the selected bucket (Wulf Cash or Wulf Coins)
 *  - count / pct : unit-less
 *  - date     : an ISO instant, shown as its UTC day
 *  - day      : a yyyy-MM-dd report day
 *  - text     : rendered by the column itself
 */
export type ValueKind = "usd" | "amount" | "count" | "pct" | "date" | "day" | "text";

export interface PerformanceColumn {
  id: string;
  /** Absent where the API has no sort for the column (trend, tags, top game, last redeem). */
  sortKey?: PerformanceSortKey;
  group: ColumnGroupId;
  label: string;
  kind: ValueKind;
  align?: "left" | "right";
  /** Header tooltip — the metric's definition from the API contract. */
  description: string;
  /** Coloured by sign. */
  signed?: boolean;
  /** Only meaningful for Wulf Cash; renders "—" on Wulf Coins. */
  cashOnly?: boolean;
  value: (row: PlayerPerformanceRow) => number | string | null;
  /** A secondary count printed under the main figure. */
  sub?: (row: PlayerPerformanceRow) => string;
  /** Full control of the cell, for pills, chips and deltas. */
  render?: (row: PlayerPerformanceRow, currency: ReportCurrency) => ReactNode;
}

const plural = (n: number, one: string, many: string) =>
  `${fmtCount(n)} ${n === 1 ? one : many}`;

export const PERFORMANCE_COLUMNS: PerformanceColumn[] = [
  // ── Intent: relative to today, whatever the range ──
  {
    id: "daysInactive",
    sortKey: "daysInactive",
    group: "intent",
    label: "Days Inactive",
    kind: "count",
    description:
      "Whole days since the latest play, deposit or redeem (amber from 14, red from 30). Blank if the player has never done any of them.",
    value: (r) => r.daysInactive,
    render: (r) => <DaysInactive days={r.daysInactive} />,
  },
  {
    id: "rounds7d",
    sortKey: "rounds7d",
    group: "intent",
    label: "Rounds 7d",
    kind: "count",
    description:
      "Rounds played in the last 7 days (both currencies), with the change against the 7 days before.",
    value: (r) => r.rounds7d,
    render: (r) => (
      <div className="flex flex-col items-end leading-tight">
        <span className={r.rounds7d ? "text-gray-200" : "text-gray-600"}>{fmtCount(r.rounds7d)}</span>
        <DeltaLine current={r.rounds7d} previous={r.roundsPrev7d} format={fmtCount} />
      </div>
    ),
  },
  {
    id: "deposit7d",
    sortKey: "deposit7d",
    group: "intent",
    label: "Deposits 7d",
    kind: "usd",
    description:
      "USD deposited in the last 7 days, with the change against the 7 days before. Not affected by the currency toggle.",
    value: (r) => r.deposit7d,
    render: (r) => (
      <div className="flex flex-col items-end leading-tight">
        <span className={round(r.deposit7d ?? 0, 2) ? "text-gray-200" : "text-gray-600"}>
          {fmtUsd(r.deposit7d)}
        </span>
        <DeltaLine current={r.deposit7d} previous={r.depositPrev7d} format={fmtUsd} />
      </div>
    ),
  },
  {
    id: "lastDepositDay",
    sortKey: "lastDepositDay",
    group: "intent",
    label: "Last Deposit",
    kind: "day",
    description: "Most recent day with a deposit, ever (UTC) — not limited to the date range.",
    value: (r) => r.lastDepositDay,
  },
  {
    id: "lastRedeemAt",
    group: "intent",
    label: "Last Redeem",
    kind: "date",
    description: "Most recent paid redeem, ever (UTC) — not limited to the date range.",
    value: (r) => r.lastRedeemAt,
  },

  // ── Money in / out (USD) ──
  {
    id: "depositUsd",
    sortKey: "depositUsd",
    group: "money",
    label: "Deposits",
    kind: "usd",
    description:
      "Real-money deposits in the range, in USD, with the number of deposits beneath. Not affected by the currency toggle.",
    value: (r) => r.depositUsd,
    sub: (r) => plural(r.depositCount, "deposit", "deposits"),
  },
  {
    id: "maxDepositUsd",
    sortKey: "maxDepositUsd",
    group: "money",
    label: "Max Deposit",
    kind: "usd",
    description: "Largest single deposit in the range, in USD.",
    value: (r) => r.maxDepositUsd,
  },
  {
    id: "redeemUsd",
    sortKey: "redeemUsd",
    group: "money",
    label: "Redeemed",
    kind: "usd",
    description:
      "Paid redeems in the range (processed, or released to the payout provider), in USD, with the number of redeems beneath.",
    value: (r) => r.redeemUsd,
    sub: (r) => plural(r.redeemCount, "redeem", "redeems"),
  },
  {
    id: "pendingRedeemUsd",
    sortKey: "pendingRedeemUsd",
    group: "money",
    label: "Pending",
    kind: "usd",
    description:
      "Redeems owed right now and not yet released, in USD. A current snapshot — not limited to the date range.",
    value: (r) => r.pendingRedeemUsd,
  },

  // ── Gameplay (selected currency) ──
  {
    id: "activeDays",
    sortKey: "activeDays",
    group: "gameplay",
    label: "Active Days",
    kind: "count",
    description: "Days in the range with at least one round.",
    value: (r) => r.activeDays,
  },
  {
    id: "stake",
    sortKey: "stake",
    group: "gameplay",
    label: "Wagered",
    kind: "amount",
    description: "Handle: round-aware stake, with refunds netted out.",
    value: (r) => r.stake,
  },
  {
    id: "win",
    sortKey: "win",
    group: "gameplay",
    label: "Payout",
    kind: "amount",
    description: "Gross payout: stake returned + profit.",
    value: (r) => r.win,
  },
  {
    id: "playerPl",
    sortKey: "playerPl",
    group: "gameplay",
    label: "Player P/L",
    kind: "amount",
    signed: true,
    description: "Payout − Wagered. Positive means the player took money off the platform.",
    value: (r) => r.playerPl,
  },
  {
    id: "ggr",
    sortKey: "ggr",
    group: "gameplay",
    label: "GGR",
    kind: "amount",
    signed: true,
    description: "Wagered − Payout. Positive means the platform won.",
    value: (r) => r.ggr,
  },
  {
    id: "topGame",
    group: "gameplay",
    label: "Top Game",
    kind: "text",
    align: "left",
    description: "Most-played game in the range (by rounds), with its provider and round count.",
    value: (r) => r.topGame?.gameName ?? null,
    render: (r) => <TopGame row={r} />,
  },

  // ── Rewards (selected currency) ──
  {
    id: "bonus",
    sortKey: "bonus",
    group: "rewards",
    label: "Bonus",
    kind: "amount",
    description: "Bonuses credited in the range.",
    value: (r) => r.bonus,
  },
  {
    id: "ngr",
    sortKey: "ngr",
    group: "rewards",
    label: "NGR",
    kind: "amount",
    signed: true,
    description: "Net gaming revenue: GGR − Bonus.",
    value: (r) => r.ngr,
  },

  // ── Referrals ──

  // ── Activity ──
  // ── Referrals ──
  {
    id: "referrals",
    sortKey: "referrals",
    group: "referrals",
    label: "Referrals",
    kind: "count",
    description:
      "Players this player referred who signed up in the range. The line below counts those who have made a real deposit.",
    value: (r) => r.referrals,
    sub: (r) => (r.referrals > 0 ? `${fmtCount(r.referralsQualified)} deposited` : ""),
  },

  {
    id: "lastPlayedAt",
    sortKey: "lastPlayedAt",
    group: "activity",
    label: "Last Played",
    kind: "date",
    description: "Most recent round ever, either currency (UTC day) — not limited to the date range.",
    value: (r) => r.lastPlayedAt,
  },
  {
    id: "joinedAt",
    sortKey: "joinedAt",
    group: "activity",
    label: "Joined",
    kind: "date",
    description: "Account sign-up date (UTC day).",
    value: (r) => r.joinedAt,
  },
];

/** Deposits and redeems stay USD on the Coins tab — the header says so there. */
export function columnHeader(col: PerformanceColumn, currency: ReportCurrency): string {
  return col.kind === "usd" && currency === "wulfCoin" ? `${col.label} (USD)` : col.label;
}

function formatValue(col: PerformanceColumn, raw: number | string | null, currency: ReportCurrency) {
  if (raw === null || raw === undefined) return "—";
  if (col.kind === "date" || col.kind === "day") return fmtUtcDay(String(raw));
  if (col.kind === "text") return String(raw);
  const n = typeof raw === "number" ? raw : Number(raw);
  switch (col.kind) {
    case "usd":
      return fmtUsd(n);
    case "amount":
      return fmtAmount(n, currency);
    case "count":
      return fmtCount(n);
    case "pct":
      return fmtPct(n);
  }
}

export function renderCell(
  col: PerformanceColumn,
  row: PlayerPerformanceRow,
  currency: ReportCurrency,
): ReactNode {
  if (col.cashOnly && currency === "wulfCoin") {
    return <span className="text-gray-600">—</span>;
  }
  if (col.render) return col.render(row, currency);

  const raw = col.value(row);
  const text = formatValue(col, raw, currency);

  // Judged at the precision printed, so a value that displays as 0 reads as 0.
  const digits =
    typeof raw !== "number"
      ? 2
      : col.kind === "pct"
        ? 1
        : col.kind === "amount"
          ? amountDigits(currency, raw)
          : col.kind === "count"
            ? 0
            : 2;

  let tone = "text-gray-200";
  if (raw === null || raw === undefined || (typeof raw === "number" && round(raw, digits) === 0)) {
    tone = "text-gray-600";
  } else if (col.signed && typeof raw === "number") tone = signClass(raw, digits);

  const main =
    col.kind === "date" && typeof raw === "string" ? (
      <span className={tone} title={formatUtcDateTime(raw)}>
        {text}
      </span>
    ) : (
      <span className={tone}>{text}</span>
    );

  // An empty sub-line (e.g. no referrals) renders the figure alone.
  const sub = col.sub?.(row);
  if (!sub) return main;
  return (
    <div className="flex flex-col items-end leading-tight">
      {main}
      <span className="mt-0.5 text-[11px] text-gray-500">{sub}</span>
    </div>
  );
}
