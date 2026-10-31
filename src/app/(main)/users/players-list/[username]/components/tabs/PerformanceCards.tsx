"use client";

import type { ReactNode } from "react";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BadgeDollarSign,
  CalendarDays,
  CircleCheck,
  CircleX,
  Clock,
  Coins,
  Copy,
  Crown,
  Dices,
  Gift,
  HandCoins,
  Info,
  Landmark,
  Mail,
  Medal,
  PencilLine,
  Percent,
  Phone,
  PiggyBank,
  Scale,
  ShieldAlert,
  SlidersHorizontal,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Trophy,
  UserCheck,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  PerformanceRank,
  PlayerPerformanceDetail,
  PlayerSource,
} from "@/api/player-performance/player-performance.api";
import type { ReportCurrency } from "@/api/reports/reports";
import { coingold, coingreen } from "@/assets/icons";
import {
  CURRENCY_META,
  EMPTY,
  daysBetween,
  fmtAmount,
  fmtCount,
  fmtPct,
  fmtUsd,
  fmtUtcDate,
  num,
  signedTone,
  tierNameOnly,
  withSign,
} from "./PerformanceFormat";

// ── building blocks ──────────────────────────────────────────────────────────

export function PerfSection({
  title,
  note,
  children,
}: {
  title: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {note ? <p className="text-[11px] text-gray-500">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

const CARD_GRID = "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3";

interface StatCardProps {
  label: string;
  value: string;
  valueClassName?: string;
  sub?: ReactNode;
  icon: LucideIcon;
  /** Coin shown beside the value, naming the bucket the figure is in. */
  coin?: StaticImageData;
  /** Turns the card amber and explains why in a tooltip. */
  warning?: string;
}

/** Same card as the Deposits tab summary, so the two tabs read alike. */
export function StatCard({
  label,
  value,
  valueClassName = "text-white",
  sub,
  icon: Icon,
  coin,
  warning,
}: StatCardProps) {
  return (
    <div
      className={`min-w-0 rounded-xl border p-4 shadow-sm ${
        warning
          ? "border-amber-500/40 bg-amber-500/6"
          : "border-[#242B35] bg-[#191D24]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[11px] uppercase tracking-[0.18em] text-gray-500">
              {label}
            </p>
            {warning ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={warning}
                    className="shrink-0 text-amber-400 hover:text-amber-300"
                  >
                    <Info size={12} />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-60">{warning}</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          <p
            className={`mt-2 flex min-w-0 items-center gap-1.5 text-2xl font-semibold tracking-tight tabular-nums ${valueClassName}`}
            title={value}
          >
            {coin && value !== EMPTY ? (
              <Image src={coin} alt="" width={16} height={16} className="shrink-0" />
            ) : null}
            <span className="truncate">{value}</span>
          </p>
          {sub ? (
            <div className="mt-2 text-[11px] leading-relaxed text-gray-400">{sub}</div>
          ) : null}
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#242B35] ${
            warning ? "text-amber-400" : "text-[#C05CFF]"
          }`}
        >
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

export const plural = (n: number, one: string, many = `${one}s`) =>
  `${fmtCount(n)} ${num(n) === 1 ? one : many}`;

/**
 * Copies through a hidden textarea — the fallback for hosts without the async
 * Clipboard API (plain HTTP has none). False when the browser refused.
 */
function legacyCopy(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  area.style.pointerEvents = "none";
  document.body.appendChild(area);
  const focused = document.activeElement as HTMLElement | null;
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  area.remove();
  // Hand focus back to the copy button so keyboard users are not dropped.
  focused?.focus();
  return ok;
}

async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission refused or document not focused — try the old way.
    }
  }
  return legacyCopy(text);
}

/**
 * Copy-to-clipboard icon button. Stops the click from reaching a clickable
 * row or card around it, names what it copies for screen readers, falls back
 * to the legacy copy path where the async Clipboard API is missing (plain
 * HTTP), and only says "Copied" when the text really was copied.
 */
export function CopyValue({
  value,
  what,
  size = 13,
}: {
  value: string | null | undefined;
  what: string;
  size?: number;
}) {
  const text = (value ?? "").trim();
  if (!text) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        void copyText(text).then((ok) =>
          ok ? toast.success("Copied") : toast.error("Couldn't copy"),
        );
      }}
      aria-label={`Copy ${what}`}
      title={`Copy ${what}`}
      className="inline-flex shrink-0 items-center justify-center rounded p-0.5 text-gray-500 transition-colors hover:text-[#C05CFF] focus-visible:text-[#C05CFF] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#B93DEB]"
    >
      <Copy size={size} aria-hidden="true" />
    </button>
  );
}

// ── header: ranks + profile ──────────────────────────────────────────────────

const RANKS: {
  key: keyof PlayerPerformanceDetail["ranks"];
  label: string;
  /** Gameplay ranks are computed inside the selected bucket only. */
  perCurrency: boolean;
}[] = [
  { key: "depositUsd", label: "Deposits", perCurrency: false },
  { key: "rounds", label: "Most Active (rounds)", perCurrency: true },
  { key: "stake", label: "Wagered", perCurrency: true },
  { key: "ggr", label: "GGR (platform win)", perCurrency: true },
  { key: "playerPl", label: "Player P/L (winner rank)", perCurrency: true },
  { key: "referrals", label: "Referrals", perCurrency: false },
];

function RankBadge({
  rank,
  label,
  scope,
}: {
  rank: PerformanceRank | undefined;
  label: string;
  scope: string;
}) {
  const position = rank?.rank ?? null;
  const of = num(rank?.of);

  if (position === null) {
    return (
      <div
        className="flex max-w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border border-dashed border-[#2F3744] px-3 py-2 text-xs text-gray-500"
        title={`Ranks only count players with a non-zero value — this player has none ${scope}.`}
      >
        <Medal size={14} className="shrink-0" />
        <span>Not ranked</span>
        <span>·</span>
        <span className="text-gray-400">{label}</span>
      </div>
    );
  }

  const tone =
    position <= 3
      ? "border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#F59E0B]"
      : position <= 10
        ? "border-[#B93DEB]/40 bg-[#B93DEB]/10 text-[#C05CFF]"
        : "border-[#242B35] bg-[#191D24] text-gray-400";

  return (
    <div
      className={`flex max-w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border px-3 py-2 text-xs ${tone}`}
      title={`Position among the ${fmtCount(of)} players with a non-zero value ${scope}.`}
    >
      {position <= 3 ? (
        <Crown size={14} className="shrink-0" />
      ) : (
        <Medal size={14} className="shrink-0" />
      )}
      <span className="font-semibold text-white">#{fmtCount(position)}</span>
      <span className="text-gray-400">of {fmtCount(of)}</span>
      <span className="text-gray-600">·</span>
      <span className="text-gray-300">{label}</span>
    </div>
  );
}

type ChipTone = "neutral" | "good" | "warn" | "bad" | "accent";

const CHIP_TONES: Record<ChipTone, string> = {
  neutral: "border-[#242B35] bg-[#191D24] text-gray-200",
  good: "border-green-500/30 bg-green-500/10 text-green-400",
  warn: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
  bad: "border-red-500/30 bg-red-500/10 text-red-400",
  accent: "border-[#B93DEB]/40 bg-[#B93DEB]/10 text-[#C05CFF]",
};

function Chip({
  label,
  children,
  tone = "neutral",
  action,
}: {
  label: string;
  children: ReactNode;
  tone?: ChipTone;
  /** Trailing control (e.g. a copy button), kept out of the truncated text. */
  action?: ReactNode;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${CHIP_TONES[tone]}`}
    >
      <span className="shrink-0 text-gray-500">{label}</span>
      <span className="min-w-0 truncate font-medium">{children}</span>
      {action}
    </span>
  );
}

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

/** KYC arrives either as the Sumsub-side enum or the list filter's lowercase. */
function kycChip(status: string | null): { text: string; tone: ChipTone } {
  const s = (status ?? "NOT_STARTED").toUpperCase();
  if (s === "APPROVED") return { text: "Approved", tone: "good" };
  if (s === "PENDING" || s === "PENDING_REVIEW") return { text: "Pending", tone: "warn" };
  if (s === "REJECTED") return { text: "Rejected", tone: "bad" };
  if (s === "IN_PROGRESS") return { text: "In Progress", tone: "accent" };
  if (s === "NOT_STARTED") return { text: "Not Started", tone: "neutral" };
  return { text: titleCase(s), tone: "neutral" };
}

function rgChip(status: string): { text: string; tone: ChipTone } {
  switch ((status ?? "").toUpperCase()) {
    case "ACTIVE":
      return { text: "No restriction", tone: "good" };
    case "PAUSED":
      return { text: "Paused", tone: "warn" };
    case "SELF_EXCLUDED":
      return { text: "Self-excluded", tone: "bad" };
    case "CLOSED":
      return { text: "Closed", tone: "bad" };
    default:
      return { text: status ? titleCase(status) : EMPTY, tone: "neutral" };
  }
}

const SOURCE_LABEL: Record<PlayerSource, string> = {
  direct: "Direct signup",
  agent: "Agent",
  subagent: "Sub-agent",
  player: "Player referral",
};

/**
 * Who this is, email first: the email when there is one, else the phone, else
 * the username. The username always stays visible (and copyable) underneath,
 * because it is what support and the other admin screens search by.
 */
function PlayerIdentity({ profile }: { profile: PlayerPerformanceDetail["profile"] }) {
  const email = profile.email?.trim() || null;
  const phone = profile.phone?.trim() || null;
  const username = profile.username?.trim() || null;

  const primary = email
    ? { value: email, what: "email", icon: Mail }
    : phone
      ? { value: phone, what: "phone", icon: Phone }
      : { value: username ?? EMPTY, what: "username", icon: UserRound };
  const PrimaryIcon = primary.icon;

  return (
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 max-w-full">
        <div className="flex min-w-0 items-center gap-2">
          <PrimaryIcon size={16} className="shrink-0 text-[#C05CFF]" aria-hidden="true" />
          <p
            className="min-w-0 truncate text-base font-semibold text-white"
            title={primary.value}
          >
            {primary.value}
          </p>
          <CopyValue value={primary.value === EMPTY ? null : primary.value} what={primary.what} size={14} />
        </div>
        {primary.what !== "username" && username ? (
          <div className="mt-1 flex min-w-0 items-center gap-1.5 pl-6 text-xs">
            <span className="shrink-0 text-gray-500">Username</span>
            <span className="min-w-0 truncate text-gray-300" title={username}>
              {username}
            </span>
            <CopyValue value={username} what="username" />
          </div>
        ) : null}
      </div>

      {phone && primary.what !== "phone" ? (
        <Chip
          label="Phone"
          action={<CopyValue value={phone} what="phone" size={12} />}
        >
          {phone}
        </Chip>
      ) : null}
    </div>
  );
}

export function PerformanceHeader({
  detail,
  currency,
}: {
  detail: PlayerPerformanceDetail;
  currency: ReportCurrency;
}) {
  const { profile, ranks } = detail;
  const kyc = kycChip(profile.kycStatus);
  const rg = rgChip(profile.rgStatus);
  const bucket = CURRENCY_META[currency].label;
  const tier = tierNameOnly(profile.tierName);

  return (
    <div className="space-y-4 rounded-xl border border-[#242B35] bg-[#191D24] p-4">
      <PlayerIdentity profile={profile} />

      <div className="space-y-2 border-t border-white/5 pt-4">
        {/* The badges' titles explain this too, but a title reaches neither
            keyboard nor touch users, so the scope is also said here. */}
        <p className="text-[11px] text-gray-500">
          Rank among players with a non-zero value for this range · gameplay ranks
          count {bucket} only
        </p>
        <div className="flex flex-wrap gap-2">
          {RANKS.map((r) => (
            <RankBadge
              key={r.key}
              rank={ranks?.[r.key]}
              label={r.label}
              scope={r.perCurrency ? `in ${bucket} for this range` : "for this range"}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-white/5 pt-4">
        <Chip label="Tier" tone={tier ? "accent" : "neutral"}>
          {tier ?? "No tier"}
        </Chip>
        <Chip label="KYC" tone={kyc.tone}>
          {kyc.text}
        </Chip>
        <Chip label="Source">
          {SOURCE_LABEL[profile.source] ?? titleCase(String(profile.source ?? ""))}
          {profile.referrerName ? (
            <>
              {" · via "}
              {profile.source === "player" && profile.referrerId ? (
                <Link
                  href={`/users/players-list/${profile.referrerId}?tab=performance`}
                  className="text-[#C05CFF] underline-offset-2 hover:underline"
                >
                  {profile.referrerName}
                </Link>
              ) : (
                profile.referrerName
              )}
            </>
          ) : null}
        </Chip>
        <Chip label="Account" tone={profile.isActive ? "good" : "bad"}>
          {profile.isActive ? "Active" : "Inactive"}
        </Chip>
        <Chip label="RG" tone={rg.tone}>
          {rg.text}
        </Chip>
        <Chip label="Joined">{fmtUtcDate(profile.joinedAt)}</Chip>
        <Chip label="Last played">
          {profile.lastPlayedAt ? fmtUtcDate(profile.lastPlayedAt) : "Never"}
        </Chip>
      </div>
    </div>
  );
}

// ── KPI sections ─────────────────────────────────────────────────────────────

export function MoneySection({ detail }: { detail: PlayerPerformanceDetail }) {
  const t = detail.totals;
  const d = detail.deposits;
  const chargebacks = num(d.chargebackCount);

  return (
    <PerfSection
      title="Money In / Out"
      note="USD · real money, not affected by the currency toggle"
    >
      <div className={CARD_GRID}>
        <StatCard
          label="Deposits"
          value={fmtUsd(t.depositUsd)}
          sub={plural(t.depositCount, "deposit")}
          icon={ArrowDownCircle}
        />
        <StatCard
          label="Max Deposit"
          value={fmtUsd(t.maxDepositUsd)}
          sub="Largest single deposit"
          icon={Crown}
        />
        <StatCard
          label="Redeemed"
          value={fmtUsd(t.redeemUsd)}
          sub={`${plural(t.redeemCount, "redeem")} paid`}
          icon={ArrowUpCircle}
        />
        <StatCard
          label="Pending Redeem"
          value={fmtUsd(t.pendingRedeemUsd)}
          sub="Owed right now · current, not range-limited"
          icon={Clock}
        />
        <StatCard
          label="Net Deposit"
          value={withSign(fmtUsd(t.netDepositUsd), t.netDepositUsd)}
          valueClassName={signedTone(t.netDepositUsd)}
          sub="Deposits − redeems"
          icon={Scale}
        />
        {/* The backend counts these over the player's whole history, not the
            range — said on the card so it is not read as this range's. */}
        <StatCard
          label="Chargebacks"
          value={fmtUsd(d.chargebackUsd)}
          valueClassName={chargebacks > 0 ? "text-red-500" : "text-white"}
          sub={`${plural(chargebacks, "refund / chargeback", "refunds / chargebacks")} · all time · not netted above`}
          icon={ShieldAlert}
        />
      </div>
    </PerfSection>
  );
}

/**
 * The first deposit is the player's first ever (FTD) whatever the range, so it
 * is labelled that way; last and average are within the range.
 */
export function DepositFacts({ detail }: { detail: PlayerPerformanceDetail }) {
  const d = detail.deposits;
  if (!d.firstDepositAt && !d.lastDepositAt) {
    return (
      <p className="rounded-lg border border-[#242B35] bg-[#191D24] px-4 py-3 text-xs text-gray-500">
        This player has never deposited.
      </p>
    );
  }

  const facts: { label: string; value: string }[] = [
    {
      label: "First-time deposit",
      value: `${fmtUtcDate(d.firstDepositAt)} · ${fmtUsd(d.firstDepositUsd)}`,
    },
    {
      label: "Last deposit in range",
      value: d.lastDepositAt ? fmtUtcDate(d.lastDepositAt) : "None",
    },
    { label: "Average deposit in range", value: fmtUsd(d.avgDepositUsd) },
  ];

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-lg border border-[#242B35] bg-[#191D24] px-4 py-3 text-xs">
      {facts.map((f) => (
        <span key={f.label} className="text-gray-400">
          {f.label}: <span className="font-medium text-white">{f.value}</span>
        </span>
      ))}
    </div>
  );
}

export function GameplaySection({
  detail,
  currency,
}: {
  detail: PlayerPerformanceDetail;
  currency: ReportCurrency;
}) {
  const t = detail.totals;
  const coin = CURRENCY_META[currency].icon;
  const amount = (v: number | null | undefined) => fmtAmount(v, currency);
  const { startDate, endDate } = detail.range ?? {};
  const rangeDays =
    startDate && endDate ? daysBetween(startDate, endDate) + 1 : null;
  const big = detail.biggestWin;
  const rounds = num(t.rounds);
  const won = num(t.roundsWon);
  const lost = num(t.roundsLost);
  // Rounds that paid back exactly the stake, or have not settled yet, are
  // neither won nor lost — said on the card so won + lost ≠ rounds reads right.
  const undecided = Math.max(0, rounds - won - lost);

  return (
    <PerfSection
      title="Gameplay"
      note={`${CURRENCY_META[currency].label} (${CURRENCY_META[currency].short}) · from the gameplay rollup`}
    >
      <div className={CARD_GRID}>
        <StatCard label="Rounds" value={fmtCount(t.rounds)} icon={Dices} />
        <StatCard
          label="Rounds Won"
          value={fmtCount(t.roundsWon)}
          valueClassName={won > 0 ? "text-[#04AD37]" : "text-white"}
          sub={
            rounds > 0
              ? `${fmtPct((won / rounds) * 100)} of rounds · paid out more than staked`
              : "Paid out more than staked"
          }
          icon={CircleCheck}
        />
        <StatCard
          label="Rounds Lost"
          value={fmtCount(t.roundsLost)}
          valueClassName={lost > 0 ? "text-red-500" : "text-white"}
          sub={
            rounds > 0
              ? `${fmtPct((lost / rounds) * 100)} of rounds · paid out less than staked`
              : "Paid out less than staked"
          }
          icon={CircleX}
        />
        <StatCard
          label="Win Rate"
          value={fmtPct(t.winRatePct)}
          sub={
            won + lost > 0
              ? `Won ÷ decided rounds (${fmtCount(won + lost)})${
                  undecided > 0 ? ` · ${plural(undecided, "round")} broke even or unsettled` : ""
                }`
              : "No won or lost rounds in this range"
          }
          icon={Percent}
        />
        <StatCard
          label="Active Days"
          value={fmtCount(t.activeDays)}
          sub={
            rangeDays && rangeDays > 0
              ? `of ${plural(rangeDays, "day")} in range`
              : "Days with at least one round"
          }
          icon={CalendarDays}
        />
        <StatCard
          label="Wagered"
          value={amount(t.stake)}
          coin={coin}
          sub="Handle · refunds netted out"
          icon={Coins}
        />
        <StatCard
          label="Won"
          value={amount(t.win)}
          coin={coin}
          sub="Gross payout · stake returned + profit"
          icon={HandCoins}
        />
        <StatCard
          label="Player P/L"
          value={withSign(amount(t.playerPl), t.playerPl)}
          valueClassName={signedTone(t.playerPl)}
          coin={coin}
          sub="Player's perspective · won − wagered"
          icon={num(t.playerPl) < 0 ? TrendingDown : TrendingUp}
        />
        <StatCard
          label="GGR"
          value={withSign(amount(t.ggr), t.ggr)}
          valueClassName={signedTone(t.ggr)}
          coin={coin}
          sub="Platform's perspective · wagered − won"
          icon={Landmark}
        />
        <StatCard
          label="Hold %"
          value={fmtPct(t.holdPct)}
          valueClassName={t.holdPct == null ? "text-white" : signedTone(t.holdPct)}
          sub="GGR ÷ wagered"
          icon={Percent}
        />
        <StatCard
          label="Avg Bet"
          value={amount(t.avgBet)}
          coin={coin}
          sub="Wagered ÷ rounds"
          icon={Target}
        />
        {big ? (
          <StatCard
            label="Biggest Win"
            value={amount(big.amount)}
            coin={coin}
            sub={
              <>
                <span className="block truncate text-gray-300" title={big.gameName}>
                  {big.gameName}
                  {big.provider ? <span className="text-gray-500"> · {big.provider}</span> : null}
                </span>
                <span className="block">
                  Stake {amount(big.stake)} · {fmtUtcDate(big.at)}
                </span>
              </>
            }
            icon={Trophy}
          />
        ) : (
          <StatCard
            label="Biggest Win"
            value={amount(t.maxWin)}
            coin={coin}
            sub="Largest single payout"
            icon={Trophy}
          />
        )}
      </div>
    </PerfSection>
  );
}

export function RewardsSection({
  detail,
  currency,
}: {
  detail: PlayerPerformanceDetail;
  currency: ReportCurrency;
}) {
  const t = detail.totals;
  const coin = CURRENCY_META[currency].icon;
  const amount = (v: number | null | undefined) => fmtAmount(v, currency);
  const other = num(t.otherCredits);

  return (
    <PerfSection
      title="Rewards"
      note={`${CURRENCY_META[currency].label} (${CURRENCY_META[currency].short})`}
    >
      <div className={CARD_GRID}>
        <StatCard label="Bonus" value={amount(t.bonus)} coin={coin} icon={Gift} />
        <StatCard
          label="Bonus / Deposit"
          value={fmtPct(t.bonusRatioPct)}
          sub={
            currency === "wulfCoin"
              ? "Wulf Cash only"
              : "Bonus ÷ deposits (USD)"
          }
          icon={Percent}
        />
        <StatCard
          label="NGR"
          value={withSign(amount(t.ngr), t.ngr)}
          valueClassName={signedTone(t.ngr)}
          coin={coin}
          sub="GGR − bonus"
          icon={PiggyBank}
        />
        <StatCard
          label="Manual Credits"
          value={amount(t.manualCredit)}
          coin={coin}
          sub="Approved manual deposits, incl. postcard (AMOE)"
          icon={PencilLine}
        />
        <StatCard
          label="Adjustments"
          value={withSign(amount(t.adjustments), t.adjustments)}
          valueClassName={signedTone(t.adjustments)}
          coin={coin}
          sub="Signed admin balance adjustments"
          icon={SlidersHorizontal}
        />
        <StatCard
          label="Other Credits"
          value={amount(t.otherCredits)}
          valueClassName={other > 0 ? "text-amber-400" : "text-white"}
          coin={coin}
          sub={other > 0 ? "Worth a look" : "Unrecognised credit sources"}
          icon={TriangleAlert}
          warning={
            other > 0
              ? "Credits with no recognised reward source."
              : undefined
          }
        />
      </div>
    </PerfSection>
  );
}

/**
 * Commission is paid in Wulf Cash only (the rollup sums REFERRAL_COMMISSION /
 * REVERSAL rows' Wulf Cash leg), so it never follows the currency toggle —
 * printing it as coins on the Coins tab would name the wrong bucket.
 */
export function ReferralsSection({ detail }: { detail: PlayerPerformanceDetail }) {
  const t = detail.totals;
  const referred = num(t.referrals);
  const qualified = num(t.referralsQualified);

  return (
    <PerfSection title="Referrals" note="Players this player referred who signed up in the range">
      <div className={CARD_GRID}>
        <StatCard label="Referred" value={fmtCount(referred)} icon={Users} />
        <StatCard
          label="Qualified"
          value={fmtCount(qualified)}
          sub={
            referred > 0
              ? `${fmtPct((qualified / referred) * 100)} of referred · made a real deposit`
              : "Made a real deposit"
          }
          icon={UserCheck}
        />
        <StatCard
          label="Commission"
          value={fmtAmount(t.referralCommission, "wulfCash")}
          coin={coingreen}
          sub="Wulf Cash credited to this player's wallet, net of reversals"
          icon={BadgeDollarSign}
        />
      </div>
    </PerfSection>
  );
}

export function BalancesSection({ detail }: { detail: PlayerPerformanceDetail }) {
  const b = detail.profile.balance ?? detail.totals.balance;

  return (
    <PerfSection
      title="Current Balances"
      note="Snapshot right now · not limited to the selected range"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Wulf Cash (current)"
          value={fmtAmount(b?.wulfCash, "wulfCash")}
          coin={coingreen}
          icon={Wallet}
        />
        <StatCard
          label="Bonus Wulf Cash (current)"
          value={fmtAmount(b?.bonusWulfCash, "wulfCash")}
          coin={coingreen}
          icon={Gift}
        />
        <StatCard
          label="Redeemable (current)"
          value={fmtAmount(b?.redeemableWulfCash, "wulfCash")}
          coin={coingreen}
          sub="Wulf Cash free to redeem"
          icon={ArrowUpCircle}
        />
        <StatCard
          label="Wulf Coin (current)"
          value={fmtAmount(b?.wulfCoin, "wulfCoin")}
          coin={coingold}
          icon={Coins}
        />
      </div>
    </PerfSection>
  );
}
