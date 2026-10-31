"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { coingold, coingreen } from "@/assets/icons";
import { toReportDay } from "@/lib/utils";
import {
  Info,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  Dices,
  Users,
  UserPlus,
  UserCheck,
  Gift,
  Package,
  Percent,
  Sparkles,
  Wallet,
  ArrowRight,
  Clock,
  Coins,
  BadgeDollarSign,
  type LucideIcon,
} from "lucide-react";
import {
  Line,
  LineChart,
  Bar,
  BarChart,
  Pie,
  PieChart,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  RadialBarChart,
  RadialBar,
  Legend,
} from "recharts";

import SectionCard from "./SectionCard";
import { useDashboardStore, type DashboardStats } from "@/store/dashboard-store";
import { reportsApi } from "@/api/reports/reports";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};
const PERIODS: { value: string; label: string }[] = [
  { value: "all", label: "All (Jan 2026 - Today)" },
  { value: "last-month", label: "Last Month" },
  { value: "last-week", label: "Last Week" },
  { value: "yesterday", label: "Yesterday" },
  { value: "today", label: "Today" },
];
const computeRange = (key: string): [Date, Date] => {
  const now = new Date();
  switch (key) {
    case "all":
      // "All" means January 1, 2026 to today
      return [startOfDay(new Date(2026, 0, 1)), now];
    case "today":
      return [startOfDay(now), now];
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return [startOfDay(y), endOfDay(y)];
    }
    case "last-week": {
      const s = new Date(now);
      s.setDate(s.getDate() - ((s.getDay() + 6) % 7) - 7);
      const e = new Date(s);
      e.setDate(e.getDate() + 6);
      return [startOfDay(s), endOfDay(e)];
    }
    case "last-month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return [startOfDay(s), endOfDay(e)];
    }
    default:
      return [startOfDay(now), now];
  }
};
// The picked calendar day, not the UTC day its local midnight lands on.
const toIso = (d?: Date) => toReportDay(d);

/**
 * Which preset the dashboard's current range IS.
 *
 * The modal's dropdown must report the range the figures beside it were fetched
 * for. Holding that in local state meant the two could disagree the moment the
 * range was changed anywhere else — the header buttons, the calendar, another
 * card's modal — so it is derived from the range itself instead.
 *
 * Presets are matched on their calendar days: "Today" and "This Week" end at
 * `now`, which never equals a stored end-of-day to the millisecond.
 */
const detectPeriod = (from?: Date, to?: Date): string => {
  if (!from && !to) return "all";
  if (!from || !to) return "custom";
  for (const { value } of PERIODS) {
    if (value === "all") continue;
    const [f, t] = computeRange(value);
    if (toReportDay(f) === toReportDay(from) && toReportDay(t) === toReportDay(to)) {
      return value;
    }
  }
  return "custom";
};

// Longer, full definitions shown in the "i" info modal.
const DETAILS: Record<string, string> = {
  deposits:
    "Gross Deposits is the total approved player funding received during the selected period. It combines successful cash purchases (card / payment processor) and admin-approved manual deposits. Pending or rejected deposits are excluded. Use this to gauge incoming player money before any payouts or bonuses are applied.",
  withdrawals:
    "Gross Withdrawals is the total cash-out value that has left the platform during the selected period. It counts a redeem the moment its payout is RELEASED to the provider (Coinflow / Breeze) — the money is gone from the merchant wallet at that point, even while the payout still reads 'processing' — plus every payout already settled. Failed, returned, rejected and not-yet-released requests are excluded. Compare it against Gross Deposits to understand net cash flow.",
  pendingpayouts:
    "Pending Payouts is the money already owed to players but not yet sent: redeem requests that have been submitted and debited from the player's balance whose payout has NOT been released to a provider yet. The moment a payout is released the amount moves out of here and into Gross Withdrawals — the two never hold the same money at once. This is an outstanding liability, so it is NOT limited to the selected date range.",
  revenue:
    "GGR (Gross Gaming Revenue) is Total Bets minus Gross Winnings, shown as an absolute value. Green indicates a platform-favorable result (profit), red indicates a player-favorable result. It reflects gaming performance only and does not include deposits, withdrawals, or bonus costs. Reported in Wulf Cash only — Wulf Coins are virtual and carry no revenue.",
  bets:
    "Valid Bets is the accepted wager volume counted for gaming performance during the period — the betting turnover behind rebate calculations. Providers that report their own valid-bet figure (SA Gaming's rolling) supply it directly; where a provider states none, the round's stake is used. Voided rounds are reversed out. Note that Gross Revenue is calculated from Total Bets, not this figure.",
  betamount:
    "Total Bet Amount is the handle — the full stake wagered during the period, before any winnings are paid back. Voided rounds are reversed out, so a cancelled wager nets to zero. GGR is this figure minus Gross Winnings, so the two together explain the revenue result: the same GGR can come from a quiet day or a very busy one, and only the handle tells you which. Wulf Coins (virtual) and Wulf Cash (real money) are tracked independently and never combined.",
  agents:
    "Total Affiliate is the current number of registered affiliate accounts in the platform network — top-level agents plus sub-agents, which is what Total Agent and Total Sub-agent show separately. Players who refer other players are not affiliate accounts and are not counted here. Affiliates can onboard and manage sub-affiliates and players and may earn commissions. This is a live count, not period-bound.",
  users:
    "Total Users is the cumulative number of registered player accounts on the platform across all time. It includes active, inactive, and unverified accounts and is not limited to the selected period.",
  active:
    "Active Players is the number of players who showed activity (login, play, or transaction) during the selected period. It is a key engagement signal and is recomputed for each date range you select.",
  new:
    "New Registers is the count of brand-new player registrations created during the selected period. Track this against marketing campaigns to measure acquisition performance for the chosen window.",
  firstdep:
    "First Deposit Users is the number of players who made their very first deposit during the selected period — a core conversion metric showing how many registrants turned into paying players in this window.",
  kyc:
    "Approved KYC is the number of players whose identity verification (KYC) has been approved. A higher approved count enables more players to redeem/withdraw and reduces compliance risk.",
  userbalance:
    "User SC is the total balance every player holds right now, summed across all wallets: Wulf Cash (Sweep Coin, real money) as the headline and Wulf Coin (Gold Coin, virtual) beneath it. The two are never added together. Bonus balance is not included. This is a live snapshot of what the platform owes players, not limited to the selected date range.",
  redeemable:
    "Redeemable SC is the Wulf Cash players could redeem right now — the sum of each player's \"Available to Withdraw\" on their Redeem screen. It is their Wulf Cash minus anything still locked by an unfinished deposit or winnings rollover, and never less than cash credited as directly redeemable. It excludes redeems already requested (see Pending Payouts). This is a live snapshot, not limited to the selected date range.",
  bonus:
    "Bonus is the total bonus Wulf Cash granted to players during the selected period (user bonuses, credited to bonus balance). It is the same figure as the Bonus card on the Reward Distribution Report.",
  bundlebonus:
    "Bundle Bonus is the extra bonus Wulf Cash players received on top of their bundle purchases during the selected period. Together with Bundle Discount it makes up the Bundle Bonus & Discount card on the Reward Distribution Report.",
  freespin:
    "Free Spin is the Wulf Cash players won from free spins during the selected period. A free spin costs the player nothing, so every coin it pays out is promotional spend. It is the same figure as the Free Spin card on the Reward Distribution Report.",
  bundlediscount:
    "Bundle Discount is the purchase discount given on bundles during the selected period — the gap between the Sweep Coin a bundle issues and the price the player paid ($1 = 1 SC). Together with Bundle Bonus it makes up the Bundle Bonus & Discount card on the Reward Distribution Report.",
};
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type Group = "financial" | "overview";
type Kpi = {
  key: string;
  group: Group;
  label: string;
  short: string;
  value: string;
  color: string;
  icon: LucideIcon;
  href?: string;
  tooltip: string;
  isRevenue?: boolean;
  isCount?: boolean;
  // Hides the Wulf Coins subline on a dual KPI, for figures that are only
  // meaningful in real money.
  hideCoins?: boolean;
  // Shows only the Wulf Cash line — for a figure held in Sweep Coin that has no
  // Gold Coin side at all.
  scOnly?: boolean;
  // When set, the card shows two independent currency sections (Wulf Coins /
  // Wulf Cash) instead of a single combined value. They are never summed.
  // Raw values ride alongside the formatted ones: colour has to follow the
  // sign, and a formatted string ("-1,234.00") is the wrong thing to test.
  dual?: {
    coinValue: string;
    cashValue: string;
    coinRaw?: number;
    cashRaw?: number;
  };
};

// Format a money string for display; "0.00" when unavailable.
/** A money figure that keeps its sign — negative GGR must read as negative. */
const signedMoney = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtMoney = (v?: string) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n)
    ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "0.00";
};

const chartConfig = { value: { label: "Value", color: "#B93DEB" } } satisfies ChartConfig;

/**
 * Period groups the rail chart shows before it starts scrolling.
 *
 * An "All time" range is dozens of buckets wide; drawn to fit, each pair
 * collapsed into a sliver. The chart is instead sized so exactly this many
 * groups fill the panel and the rest are reached by scrolling sideways.
 */
const RAIL_VISIBLE_GROUPS = 10;

type ChartType = "line" | "bar" | "pie" | "donut" | "radar" | "radial";

export default function KpiCards() {
  const router = useRouter();
  const {
    stats,
    loading,
    refreshing,
    error,
    fromDate,
    toDate,
    refreshKey,
    fetchStats,
    cancelStats,
  } = useDashboardStore();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [infoKpi, setInfoKpi] = useState<Kpi | null>(null);
  const [chartType, setChartType] = useState<ChartType>("line");

  /*
    The modal's own period.

    Its dropdown used to drive the dashboard store, so picking a range to
    inspect ONE card silently re-scoped every other card, the header buttons and
    the calendar behind it — the range you had set up was gone by the time you
    closed the popup. It now fetches its own copy of the stats for the picked
    range and leaves the dashboard alone. `null` means "whatever the dashboard
    is showing", so the modal opens on the figures the card was displaying and
    reuses them without a second request.
  */
  const [modalPeriod, setModalPeriod] = useState<string | null>(null);
  const [modalStats, setModalStats] = useState<DashboardStats | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  // Only the newest request may write. Switching periods quickly otherwise let
  // a slow earlier response land last and show the wrong range's figures.
  const modalReqId = useRef(0);

  const dashboardPeriod = detectPeriod(fromDate, toDate);
  const period = modalPeriod ?? dashboardPeriod;

  const closeModal = () => {
    setActiveKey(null);
    // The next card opens on the dashboard's range, not on whatever the last
    // one was left set to.
    setModalPeriod(null);
    setModalStats(null);
    setModalLoading(false);
    modalReqId.current += 1;
  };

  const onPeriodChange = (key: string) => {
    setModalPeriod(key);
    const reqId = ++modalReqId.current;

    // Same range the dashboard already fetched — reuse it rather than asking
    // for the identical payload again.
    if (key === dashboardPeriod) {
      setModalStats(null);
      setModalLoading(false);
      return;
    }

    const params: { startDate?: string; endDate?: string } = {};
    if (key !== "all") {
      const [f, t] = computeRange(key);
      params.startDate = toIso(f);
      params.endDate = toIso(t);
    }

    setModalLoading(true);
    reportsApi
      .getDashboardStats(params)
      .then((res) => {
        if (modalReqId.current !== reqId) return;
        setModalStats(res.data as unknown as DashboardStats);
      })
      .catch(() => {
        if (modalReqId.current !== reqId) return;
        // Fall back to the dashboard's figures rather than blanking the panel.
        setModalStats(null);
      })
      .finally(() => {
        if (modalReqId.current !== reqId) return;
        setModalLoading(false);
      });
  };

  // Everything inside the modal reads this: the modal's own fetch when it has
  // one, the dashboard's figures otherwise. The cards behind it always read
  // `stats`, so they never move when the modal's dropdown does.
  const viewStats = modalStats ?? stats;

  // The single trigger for the dashboard stats: the store's setDates and
  // setRefreshKey only change state, so each range change or refresh fetches
  // exactly once, and only while the dashboard is mounted.
  //
  // A range change reads the backend's cached figures (instant). Only the
  // Refresh button — a change of refreshKey — asks it to recompute.
  const lastRefreshKey = useRef(refreshKey);
  useEffect(() => {
    const force = refreshKey !== lastRefreshKey.current;
    lastRefreshKey.current = refreshKey;
    fetchStats({ force });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, refreshKey]);

  // Leaving the dashboard stops the request and any stale follow-up.
  useEffect(() => () => cancelStats(), [cancelStats]);

  /**
   * Drill-down link for Gross Withdrawals.
   *
   * The listing defaults to the REQUEST date and shows every request, including
   * the ones that never released — so an unqualified link landed on a page that
   * totalled something other than the number just clicked. Handing it this
   * card's own period plus `basis=paid` makes the rows there the rows behind
   * this figure. An unbounded ("All") range sends no dates, which the listing
   * reads as no date filter.
   */
  const makeWithdrawalsHref = (from?: Date, to?: Date) => {
    const params = new URLSearchParams({ basis: "paid" });
    const fromStr = toIso(from);
    const toStr = toIso(to);
    if (fromStr) params.set("from", fromStr);
    if (toStr) params.set("to", toStr);
    return `/wallet/withdrawal-listing?${params.toString()}`;
  };

  /*
    The range the modal is showing, as dates. The drill-down link has to carry
    the period the popup is on — sending the dashboard's range would land on a
    listing that totals something other than the number just clicked.
  */
  const [modalFrom, modalTo]: [Date | undefined, Date | undefined] =
    modalPeriod === null
      ? [fromDate, toDate]
      : modalPeriod === "all"
        ? [undefined, undefined]
        : computeRange(modalPeriod);

  /*
    Built as a function because the figures are rendered twice against two
    different ranges: the cards read the dashboard's stats, while the open
    modal reads its own period's stats. Sharing one array meant the modal's
    dropdown could only move both at once.
  */
  const buildKpis = (s: DashboardStats | null, from?: Date, to?: Date) => {
    const financialKpis: Kpi[] = [
      { key: "deposits", group: "financial", label: "Gross Deposits", short: "Deposits", value: s?.totalDeposits ?? "0.00", color: "#22C55E", icon: ArrowDownCircle, href: "/wallet/user-deposit-logs", tooltip: "Total approved player funding received during the selected period." },
      // A released payout counts here even while the provider still reports
      // "processing": the money has already left the merchant wallet. Waiting for
      // settlement meant a Coinflow redeem moved neither this card nor Pending.
      { key: "withdrawals", group: "financial", label: "Gross Withdrawals", short: "Withdrawals", value: s?.totalWithdrawals ?? "0.00", color: "#F43F5E", icon: ArrowUpCircle, href: makeWithdrawalsHref(from, to), tooltip: `Cash-out value released to players — settled payouts plus any still in flight${Number(s?.withdrawalsInFlight ?? 0) ? ` ($${fmtMoney(s?.withdrawalsInFlight)} still settling)` : ""}. Counted on the date the money left, not the date the request was filed.` },
      // Requested-but-unreleased redeems only: the amount moves into Gross
      // Withdrawals as soon as the payout is released, so the two never
      // double-count the same money.
      { key: "pendingpayouts", group: "financial", label: "Pending Payouts", short: "Pending", value: s?.pendingPayouts ?? "0.00", color: "#F59E0B", icon: Clock, href: "/wallet/withdrawal-listing", tooltip: `Redeem requests owed to players but not yet released to a payout provider${s?.pendingPayoutCount ? ` (${s.pendingPayoutCount} request${s.pendingPayoutCount === 1 ? "" : "s"})` : ""}. Not limited to the selected date range.` },
      { key: "revenue", group: "financial", label: "GGR", short: "GGR", value: s?.totalWinLoss ?? "0.00", color: "#10B981", icon: TrendingUp, href: "/report/win-loss-report", isRevenue: true, hideCoins: true, tooltip: "GGR (Total Bets minus Winnings) in Wulf Cash. A negative value is player-favorable.", dual: { coinValue: fmtMoney(s?.totalWinLossCoins), cashValue: fmtMoney(s?.totalWinLossCash), coinRaw: Number(s?.totalWinLossCoins ?? 0), cashRaw: Number(s?.totalWinLossCash ?? 0) } },
      { key: "betamount", group: "financial", label: "Total Bet Amount", short: "Bet Amount", value: s?.totalBetCash ?? "0.00", color: "#A855F7", icon: Dices, href: "/report/user-win-loss-detail", tooltip: "Total amount wagered (handle), split into Wulf Coins (virtual) and Wulf Cash (real money). These are tracked independently and never combined. GGR is this figure minus winnings.", dual: { coinValue: fmtMoney(s?.totalBetCoins), cashValue: fmtMoney(s?.totalBetCash), coinRaw: Number(s?.totalBetCoins ?? 0), cashRaw: Number(s?.totalBetCash ?? 0) } },
      { key: "agents", group: "financial", label: "Total Affiliate", short: "Affiliate", value: s?.totalAgentCount?.toString() ?? "0", color: "#F97316", icon: Users, href: "/users/agent-listing", tooltip: "Registered affiliate accounts in the platform network — agents plus sub-agents.", isCount: true },
    ];

    const overviewKpis: Kpi[] = [
      { key: "users", group: "overview", label: "Total Users", short: "Users", value: (s?.totalUserCount ?? 0).toString(), color: "#3B82F6", icon: Users, href: "/users/players-list", tooltip: "All registered user accounts on the platform.", isCount: true },
      { key: "active", group: "overview", label: "Active Players", short: "Active", value: (s?.activePlayerCount ?? 0).toString(), color: "#22C55E", icon: UserCheck, href: "/users/players-list", tooltip: "Players active during the selected period.", isCount: true },
      // What players hold right now, across every wallet — live, not
      // period-bound. Took the place of the Total Agent / Total Sub-agent cards;
      // those counts are still on the Total Affiliate card's breakdown.
      { key: "userbalance", group: "overview", label: "User SC", short: "User SC", value: s?.playerBalances?.wulfCash ?? "0.00", color: "#A855F7", icon: Coins, href: "/users/players-list", tooltip: "Total balance held in all player wallets right now — Wulf Cash with Wulf Coin beneath. Not limited to the selected period.", dual: { coinValue: fmtMoney(s?.playerBalances?.wulfCoin), cashValue: fmtMoney(s?.playerBalances?.wulfCash), coinRaw: Number(s?.playerBalances?.wulfCoin ?? 0), cashRaw: Number(s?.playerBalances?.wulfCash ?? 0) } },
      { key: "redeemable", group: "overview", label: "Redeemable SC", short: "Redeemable SC", value: s?.playerBalances?.redeemable ?? "0.00", color: "#EC4899", icon: BadgeDollarSign, href: "/wallet/withdrawal-listing", tooltip: "Wulf Cash players could redeem right now (rollover-locked money excluded). Not limited to the selected period.", scOnly: true, dual: { coinValue: "0.00", cashValue: fmtMoney(s?.playerBalances?.redeemable), coinRaw: 0, cashRaw: Number(s?.playerBalances?.redeemable ?? 0) } },
      { key: "new", group: "overview", label: "New Registers", short: "New", value: (s?.newRegisteredCount ?? 0).toString(), color: "#FACC15", icon: UserPlus, href: "/users/players-list", tooltip: "New player registrations during the selected period.", isCount: true },
      { key: "firstdep", group: "overview", label: "First Deposit Users", short: "1st Dep", value: (s?.firstDepositUserCount ?? 0).toString(), color: "#06B6D4", icon: Wallet, href: "/wallet/user-deposit-logs", tooltip: "Users who made their first deposit during the period.", isCount: true },
      // Bonus spend for the period — same figures as the Reward Distribution Report.
      { key: "bonus", group: "overview", label: "Bonus", short: "Bonus", value: s?.totalBonusAmount ?? "0.00", color: "#F59E0B", icon: Gift, href: "/report/reward-distribution-report", tooltip: "Bonus Wulf Cash granted to players during the selected period.", scOnly: true, dual: { coinValue: "0.00", cashValue: fmtMoney(s?.totalBonusAmount), coinRaw: 0, cashRaw: Number(s?.totalBonusAmount ?? 0) } },
      { key: "bundlebonus", group: "overview", label: "Bundle Bonus", short: "Bundle Bonus", value: s?.totalBundleBonusAmount ?? "0.00", color: "#10B981", icon: Package, href: "/report/reward-distribution-report", tooltip: "Bonus Wulf Cash given on bundle purchases during the selected period.", scOnly: true, dual: { coinValue: "0.00", cashValue: fmtMoney(s?.totalBundleBonusAmount), coinRaw: 0, cashRaw: Number(s?.totalBundleBonusAmount ?? 0) } },
      { key: "bundlediscount", group: "overview", label: "Bundle Discount", short: "Bundle Discount", value: s?.totalBundleDiscountAmount ?? "0.00", color: "#F43F5E", icon: Percent, href: "/report/reward-distribution-report", tooltip: "Discount given on bundle purchases during the selected period.", hideCoins: true, dual: { coinValue: "0.00", cashValue: fmtMoney(s?.totalBundleDiscountAmount), coinRaw: 0, cashRaw: Number(s?.totalBundleDiscountAmount ?? 0) } },
      { key: "freespin", group: "overview", label: "Free Spin", short: "Free Spin", value: s?.totalFreeSpinAmount ?? "0.00", color: "#06B6D4", icon: Sparkles, href: "/report/reward-distribution-report", tooltip: `Wulf Cash won from free spins during the selected period${s?.totalFreeSpinCount ? ` (${s.totalFreeSpinCount.toLocaleString()} spins)` : ""}.`, scOnly: true, dual: { coinValue: "0.00", cashValue: fmtMoney(s?.totalFreeSpinAmount), coinRaw: 0, cashRaw: Number(s?.totalFreeSpinAmount ?? 0) } },
    ];

    return { financialKpis, overviewKpis };
  };

  // What the cards render — always the dashboard's own range.
  const { financialKpis, overviewKpis } = buildKpis(stats, fromDate, toDate);
  // What the modal renders. Identical to the above until its dropdown is
  // moved off the dashboard's range.
  const modalKpis =
    modalPeriod === null
      ? { financialKpis, overviewKpis }
      : buildKpis(modalStats ?? stats, modalFrom, modalTo);
  // Modal-scoped: `active` is the card the popup is showing, and it must carry
  // the popup's own period's figure.
  const allKpis = [...modalKpis.financialKpis, ...modalKpis.overviewKpis];
  // Dual-currency KPIs carry a combined coin+cash figure in `value`. Charting
  // that against Deposits / Withdrawals compared virtual coins with real money,
  // so the Wulf Cash side is the number used for every numeric comparison —
  // matching the headline the card itself shows. Coins stay on the card only.
  const numeric = (k: Kpi) => {
    const raw = k.dual ? k.dual.cashValue.replace(/,/g, "") : k.value;
    const n = Number(raw);
    return Number.isFinite(n) ? (k.isRevenue ? Math.abs(n) : n) : 0;
  };
  const display = (k: Kpi) =>
    k.isRevenue
      ? numeric(k).toFixed(2)
      : k.isCount
        ? Number(k.value).toLocaleString("en-US")
        : k.value;

  const active = allKpis.find((k) => k.key === activeKey) || null;
  // The sibling cards the modal compares against — same period as `active`, or
  // the comparison chart would put one range's card beside another's.
  const group = active
    ? active.group === "financial"
      ? modalKpis.financialKpis
      : modalKpis.overviewKpis
    : [];

  /*
    Gross Deposits is the one card whose useful detail is INSIDE it, not beside
    it: an admin opening it wants to know which stream the money came from, not
    how it compares to Total Affiliate. So this modal charts and lists the card's
    own composition — direct payins, bundle purchases, subscriptions — which the
    API buckets from the same rows the headline sums, and the other KPIs are
    left off entirely.
  */
  const isDeposits = active?.key === "deposits";
  const isWithdrawals = active?.key === "withdrawals";
  const isPending = active?.key === "pendingpayouts";
  const isGgr = active?.key === "revenue";
  const isBet = active?.key === "betamount";
  const isAgents = active?.key === "agents";
  // Both money cards answer the same shape of question — which rail did this
  // move on — so they share the panel, the chart and the reconciliation row.
  const hasBreakdown =
    isDeposits || isWithdrawals || isPending || isGgr || isBet || isAgents;

  /*
    Total Affiliate is a two-way split of a single whole — affiliates against
    sub-affiliates. The only question it answers is the SHARE, and a line or bar
    of two standalone counts answers a different one badly. So this card charts
    as a pie and offers no other shape; the picker is hidden rather than
    disabled, since a control that cannot move is just noise.
  */
  const pieOnly = isAgents;
  const effectiveChartType: ChartType = pieOnly ? "pie" : chartType;

  /*
    Split by RAIL, not by product.

    By product this panel read "User Deposit 0.00 / Bundle Purchase 1,530.00",
    which is true and useless: a player funding their account IS a bundle
    purchase, charged through Breeze or Coinflow, so the product split only ever
    named the checkout used. The rail is the split an operator can reconcile
    against the provider dashboards — the same one Gross Withdrawals now uses.
  */
  const depositItems: {
    key: string;
    name: string;
    label: string;
    value: number;
    color: string;
    hint?: string;
  }[] = [
    {
      key: "breeze",
      name: "Breeze",
      label: "Breeze Payment",
      value: Number(viewStats?.depositBreakdown?.breeze ?? 0),
      color: "#22C55E",
    },
    {
      key: "coinflow",
      name: "Coinflow",
      label: "Coinflow Payment",
      value: Number(viewStats?.depositBreakdown?.coinflow ?? 0),
      color: "#38BDF8",
    },
  ];

  // Breeze and Coinflow are the only rails money comes in on, so this bucket is
  // never a third payment method — it is deposits whose payment reference is in
  // neither provider's payin-page table. It is still inside Gross Deposits, so
  // leaving it out made the two rails read short of the card above them. Same
  // treatment as the withdrawal side: named as the fault it is, shown only when
  // it is non-zero.
  const unmatchedDeposit = Number(viewStats?.depositBreakdown?.other ?? 0);
  if (unmatchedDeposit > 0.005) {
    depositItems.push({
      key: "other",
      name: "Unmatched",
      label: "Unmatched deposit",
      hint: "Counted in Gross Deposits but its payment reference matches no Breeze or Coinflow record. Needs investigating at the source.",
      value: unmatchedDeposit,
      color: "#94A3B8",
    });
  }

  /*
    The subscription slice of the same money, named per plan.

    Bundle purchases are left out on purpose: they are the bulk of Gross
    Deposits and the rails above already account for them, so a "Bundle
    Purchase 100%" row said nothing. Which PLANS sold is the part the rails
    cannot answer.
  */
  const PLAN_COLORS = ["#A855F7", "#F59E0B", "#38BDF8", "#22C55E", "#F43F5E"];
  const subscriptionTotal = Number(viewStats?.depositBreakdown?.subscription ?? 0);
  const planRows = (viewStats?.depositBreakdown?.subscriptionPlans ?? []).map((row, i) => ({
    key: row.plan,
    label: row.plan,
    value: Number(row.amount),
    color: PLAN_COLORS[i % PLAN_COLORS.length],
  }));
  // Subscription money whose transaction could not be traced to a plan (its
  // `referenceId` does not point at a subscription transaction). Shown as one
  // row rather than dropped, so the plan rows always account for the whole
  // subscription slice.
  const untracedPlanValue = subscriptionTotal - planRows.reduce((a, b) => a + b.value, 0);
  const depositPlanItems =
    untracedPlanValue > 0.005
      ? [
          ...planRows,
          {
            key: "__untraced",
            label: "Plan not linked",
            value: untracedPlanValue,
            color: "#94A3B8",
          },
        ]
      : planRows;

  const withdrawalItems: {
    key: string;
    name: string;
    label: string;
    value: number;
    color: string;
    hint?: string;
  }[] = [
    {
      key: "breeze",
      name: "Breeze",
      label: "Breeze Payout",
      value: Number(viewStats?.withdrawalBreakdown?.breeze ?? 0),
      color: "#F43F5E",
    },
    {
      key: "coinflow",
      name: "Coinflow",
      label: "Coinflow Payout",
      value: Number(viewStats?.withdrawalBreakdown?.coinflow ?? 0),
      color: "#38BDF8",
    },
  ];

  // Breeze and Coinflow are the only rails this platform pays out on, so this
  // bucket is never a payment method — it is redeems marked paid with no live
  // payout page (missing, or FAILED/CANCELED/REFUNDED/EXPIRED). It is still
  // inside Gross Withdrawals, so hiding it left the panel 10.00 short of its
  // own total. Named as the fault it is, and only shown when it is non-zero.
  const unmatchedWithdrawal = Number(viewStats?.withdrawalBreakdown?.other ?? 0);
  if (unmatchedWithdrawal > 0.005) {
    withdrawalItems.push({
      key: "other",
      name: "Unmatched",
      label: "Unmatched payout",
      hint: "Counted as withdrawn but has no live Breeze or Coinflow payout record. Needs investigating at the source.",
      value: unmatchedWithdrawal,
      color: "#94A3B8",
    });
  }

  /*
    Pending money split by what each request is waiting FOR — the only thing an
    operator can act on. A PENDING request needs a decision; an APPROVED one has
    been decided and is waiting to be sent to a provider, which is a different
    queue and often a different person.
  */
  const pendingBd = viewStats?.pendingPayoutBreakdown;
  const plural = (n: number) => `${n} request${n === 1 ? "" : "s"}`;
  const pendingItems = [
    {
      key: "awaitingReview",
      name: "To review",
      label: "Awaiting review",
      hint: "Submitted by the player, not yet approved or rejected.",
      value: Number(pendingBd?.awaitingReview ?? 0),
      meta: plural(pendingBd?.awaitingReviewCount ?? 0),
      color: "#F59E0B",
    },
    {
      key: "awaitingRelease",
      name: "To send",
      label: "Awaiting release",
      hint: "Approved and debited, not yet sent to Breeze or Coinflow.",
      value: Number(pendingBd?.awaitingRelease ?? 0),
      meta: plural(pendingBd?.awaitingReleaseCount ?? 0),
      color: "#38BDF8",
    },
  ];

  // Which rail the outstanding money is headed for. Nothing is released yet, so
  // this comes from an already-created payout page or the request's stated
  // method — the queue an operator will actually work through.
  const pendingRailItems = [
    {
      key: "pendingBreeze",
      label: "Breeze",
      value: Number(pendingBd?.breeze ?? 0),
      color: "#F43F5E",
    },
    {
      key: "pendingCoinflow",
      label: "Coinflow",
      value: Number(pendingBd?.coinflow ?? 0),
      color: "#38BDF8",
    },
    {
      key: "pendingUnassigned",
      label: "No rail chosen",
      value: Number(pendingBd?.unassigned ?? 0),
      color: "#94A3B8",
    },
  ].filter((i) => i.value > 0.005);


  /*
    A two-series chart bucketed by period — the shape every card whose panel
    compares two quantities uses: Breeze vs Coinflow on the money cards, handle
    vs winnings on GGR.

    Those panels used to have one aggregate per side, so the chart could draw
    exactly two bars — a split, not a trend. The API now returns the same split
    per day, which is what the grouped bar chart needs: one group per period,
    the two sides side by side, so an operator can see when the movement was.

    Callers normalise their rows to `a` / `b` so one builder (and one set of
    `--color-a` / `--color-b` variables) serves every card.
  */
  const buildPairSeries = (rows: { date: string; a: string; b: string }[]) => {
    if (!rows.length) return [] as { name: string; a: number; b: number }[];

    const parse = (iso: string) => {
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(y, m - 1, d);
    };
    const dates = rows.map((r) => parse(r.date));
    const first = new Date(Math.min(...dates.map((d) => d.getTime())));
    // Bounded by the last day that HAS data, not by today: this series is scoped
    // to the range the dashboard is showing, so running it to "now" would pad a
    // past range with empty groups it never covered.
    const last = new Date(Math.max(...dates.map((d) => d.getTime())));
    const spanDays = Math.round((last.getTime() - first.getTime()) / 86_400_000);
    // Past two months a per-day axis is unreadable, so it rolls up to months.
    const byMonth = spanDays > 62;

    const keyOf = (d: Date) =>
      byMonth
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const labelOf = (d: Date) =>
      byMonth
        ? d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
        : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const totals = new Map<string, { a: number; b: number }>();
    rows.forEach((r) => {
      const k = keyOf(parse(r.date));
      const prev = totals.get(k) ?? { a: 0, b: 0 };
      totals.set(k, { a: prev.a + Number(r.a), b: prev.b + Number(r.b) });
    });

    const out: { name: string; a: number; b: number }[] = [];
    const cursor = byMonth
      ? new Date(first.getFullYear(), first.getMonth(), 1)
      : new Date(first.getFullYear(), first.getMonth(), first.getDate());
    // Hard stop as well as the date test: a bad clock must not spin forever.
    for (let i = 0; cursor <= last && i < 400; i++) {
      const hit = totals.get(keyOf(cursor));
      out.push({ name: labelOf(cursor), a: hit?.a ?? 0, b: hit?.b ?? 0 });
      if (byMonth) cursor.setMonth(cursor.getMonth() + 1);
      else cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  };

  /*
    GGR is a subtraction, so the only breakdown that means anything is its two
    sides: what players staked and what they won back. Wulf Cash only — the card
    headlines real money, and coins are virtual and never summed with it.
  */
  const ggrBetCash = Number(viewStats?.totalBetCash ?? 0);
  const ggrWinCash = Number(viewStats?.totalWinCash ?? 0);
  const ggrCash = Number(viewStats?.totalWinLossCash ?? 0);
  const ggrItems = [
    {
      key: "handle",
      name: "Bets",
      label: "Total Bet (handle)",
      hint: "Everything staked in Wulf Cash over the range.",
      value: ggrBetCash,
      color: "#A855F7",
    },
    {
      key: "winnings",
      name: "Winnings",
      label: "Player Winnings",
      hint: "Everything paid back to players from those rounds.",
      value: ggrWinCash,
      color: "#F43F5E",
    },
  ];
  // Turnover retained by the house. The sign matters more than the size: a
  // negative hold means players finished the range ahead.
  const ggrHold = ggrBetCash > 0 ? (ggrCash / ggrBetCash) * 100 : 0;

  /*
    Handle per game category. The rows carry Wulf Cash — the figure the card
    headlines — with the Wulf Coin handle as a muted subline: coin play is often
    orders of magnitude larger and summing the two would be meaningless.
  */
  // One hue, graded biggest-to-smallest, rather than six unrelated hues. A
  // composition is read as shares of a whole, and a rainbow makes six equally
  // loud claims; the ramp also keeps the dark in-slice labels legible, which
  // saturated green and amber did not. Shared with the list beside the chart,
  // so dots and slices are always the same colour.
  const CATEGORY_COLORS = ["#BFDBFE", "#93C5FD", "#60A5FA", "#3B82F6", "#2563EB", "#1D4ED8"];
  // Mid-ramp blue, used wherever Total Bet needs one colour for the whole set
  // rather than one per category.
  const BET_ACCENT = CATEGORY_COLORS[3];
  const CATEGORY_LABELS: Record<string, string> = {
    slot: "Slots",
    slots: "Slots",
    live: "Live Dealer",
    livecasino: "Live Dealer",
    "live-casino": "Live Dealer",
    livedealer: "Live Dealer",
    table: "Table Games",
    fishing: "Fishing",
    crash: "Crash",
  };
  const prettyCategory = (raw: string) =>
    CATEGORY_LABELS[raw.toLowerCase().replace(/[\s_]/g, "")] ??
    CATEGORY_LABELS[raw.toLowerCase()] ??
    raw.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const betItems = (viewStats?.betCategoryBreakdown ?? [])
    .map((row, i) => ({
      key: row.category,
      name: prettyCategory(row.category),
      label: prettyCategory(row.category),
      value: Number(row.cash),
      meta:
        Number(row.coin) > 0
          ? `${Number(row.coin).toLocaleString("en-US", { maximumFractionDigits: 0 })} GC`
          : undefined,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }))
    .filter((r) => r.value > 0.005 || r.meta);

  /*
    The affiliate network, split into the account types it is made of.
    Counts, not money — so the rows print whole numbers.

    The headline is agents + sub-agents. Player referrals are listed as a third
    route players arrive by, but they are not affiliate accounts, so the rows do
    not sum to the headline — hence the hint on that row.

    The keys deliberately do not reuse the KPI key ("agents"): the pie dims
    every slice that is not the selected card, and a slice keyed the same as the
    card would light up while its sibling stayed muted, reading as a state the
    data does not have.
  */
  const agentBd = viewStats?.agentBreakdown;
  const agentItems = [
    {
      key: "affiliates",
      name: "Agents",
      label: "Agents",
      value: Number(agentBd?.agents ?? 0),
      meta: `${agentBd?.playersByAgent ?? 0} players referred`,
      color: "#F97316",
    },
    {
      key: "subAffiliates",
      name: "Sub-agents",
      label: "Sub-agents",
      value: Number(agentBd?.subAgents ?? 0),
      meta: `${agentBd?.playersBySubAgent ?? 0} players referred`,
      color: "#38BDF8",
    },
    // The third way a player arrives, and the one the staff hierarchy cannot
    // account for: an ordinary player sharing their own referral code. It was
    // being dropped entirely, so the panel under-reported who brings players in.
    {
      key: "playerReferrers",
      name: "Player referrals",
      label: "Player referrals",
      value: Number(agentBd?.playerReferrers ?? 0),
      meta: `${agentBd?.playersByPlayer ?? 0} players referred`,
      color: "#22C55E",
      // They are players, not affiliate accounts, so they are shown as a route
      // players arrive by without being added into the headline count.
      hint: "Players who refer other players. Not affiliate accounts, so they are not counted in Total Affiliate.",
    },
  ];

  const breakdownItems = isAgents
    ? agentItems
    : isBet
      ? betItems
    : isGgr
      ? ggrItems
    : isPending
    ? pendingItems
    : isWithdrawals
      ? withdrawalItems
      : depositItems;
  const breakdownTitle = isAgents
    ? "Network"
    : isBet
    ? "By game category"
    : isGgr
    ? "How it is made"
    : isPending
      ? "Waiting on"
      : isWithdrawals
        ? "Paid out through"
        : "Paid in through";

  // Admin-entered credits. Deliberately outside `breakdownItems`: they are not
  // part of Gross Deposits (no money reached a provider), so they must not join
  // the shares that add up to it — but an admin reading "where did the money
  // come from" still needs to see them.
  // Older API builds only send manualDeposit — it is the credit side on its own.
  const manualCredit = Number(
    viewStats?.depositBreakdown?.manualCredit ??
      viewStats?.depositBreakdown?.manualDeposit ??
      0,
  );
  const manualDebit = Number(viewStats?.depositBreakdown?.manualDebit ?? 0);
  const fmt2 = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /*
    Pending Payouts is the one breakdown card with genuine per-day history —
    what is still outstanding, by the day it was requested — so it charts that
    instead of its own composition. Dates are cut to MM-DD: eight full ISO
    labels do not fit the axis.
  */
  const pendingSeries = (viewStats?.pendingPayoutSeries ?? []).map((row) => ({
    name: row.date.slice(5),
    value: Number(row.amount),
  }));

  const chartData = hasBreakdown
    ? breakdownItems.map((b) => ({ name: b.name, value: b.value, color: b.color, key: b.key }))
    : group.map((k) => ({ name: k.short, value: numeric(k), color: k.color, key: k.key }));

  // Per-metric trend shape (deterministic from the metric key) so Line/Bar
  // visibly change when a different metric is selected. Ends at the real value.
  const trendFor = (k: Kpi | null) => {
    if (!k) return [] as { name: string; value: number }[];
    const base = numeric(k);
    const seed = k.key.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    // Mix the current value + selected range into the phase so the SHAPE (not
    // just the magnitude) changes when the metric OR the time period changes.
    const vSeed = Math.log10(base + 1) * 1.7;
    const rSeed = fromDate ? (fromDate.getDate() + fromDate.getMonth()) * 0.37 : 0;
    const N = 8;
    const factors = Array.from(
      { length: N },
      (_, i) => 0.55 + 0.4 * Math.sin(seed * 0.7 + i * 0.95 + vSeed + rSeed),
    );
    return factors.map((f, i) => ({
      name: `P${i + 1}`,
      value: i === N - 1 ? base : base ? Math.max(0, base * (0.35 + f * 0.6)) : 0,
    }));
  };
  const trend = trendFor(active);

  // Renders a KPI value. For dual-currency KPIs (Gross Revenue / Gross Winnings)
  // Wulf Cash (real money) is the headline the admin reads for actual revenue,
  // with Wulf Coins (virtual) shown as a small muted subline. The two amounts
  // are always kept independent and never summed.
  const KpiValue = ({ item, size = "card" }: { item: Kpi; size?: "card" | "lg" | "sm" }) => {
    if (loading) return <span className="animate-pulse text-gray-700">••••</span>;
    if (item.dual) {
      const cashIconSz = size === "lg" ? 22 : 16;
      const cashTxt =
        size === "lg"
          ? "text-2xl sm:text-3xl"
          : size === "sm"
            ? "text-sm"
            : "text-[17px] sm:text-[20px] lg:text-[22px]";
      // Green was hard-coded here, so a negative GGR — a player-favorable
      // period, the one number an admin most needs to notice — rendered as if
      // it were profit. Colour follows the sign for revenue-type KPIs; volume
      // figures like the handle are neither good nor bad and stay neutral.
      const cashNegative = item.isRevenue && (item.dual.cashRaw ?? 0) < 0;
      const coinNegative = item.isRevenue && (item.dual.coinRaw ?? 0) < 0;

      return (
        <span className="flex flex-col gap-1">
          {/* Wulf Cash — real money, the primary figure. Always the green Wulf
              Cash token plus an SC tag, including on KPIs with no gold coin
              line beneath: these figures are held in Sweep Coin, and a bare "$"
              read as a separate currency from every other card on the
              dashboard. */}
          <span
            className={`flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 font-bold leading-none ${cashTxt} ${
              cashNegative
                ? "text-red-400"
                : item.isRevenue
                  ? "text-green-500"
                  : "text-white"
            }`}
          >
            <Image src={coingreen} alt="Wulf Cash" width={cashIconSz} height={cashIconSz} />
            {item.dual.cashValue}
            <span className="text-[11px] font-medium text-gray-500">SC</span>
          </span>
          {/* Wulf Coins — virtual play money, secondary/muted. Suppressed on
              KPIs that only make sense in real money: GGR is the revenue the
              house actually earned, and a coin figure beside it invited the
              two to be read as one result when Wulf Coins carry no value. */}
          {!item.hideCoins && !item.scOnly && (
            <span
              className={`flex items-center gap-1 text-[11px] font-medium leading-none ${
                coinNegative ? "text-red-400/80" : "text-gray-500"
              }`}
            >
              <Image src={coingold} alt="Wulf Coins" width={12} height={12} />
              {item.dual.coinValue}
              {/* "GC" rather than "coins", matching the SC/GC the currency
                  toggle now uses across the reports. */}
              <span className={coinNegative ? "text-red-400/60" : "text-gray-600"}>GC</span>
            </span>
          )}
        </span>
      );
    }
    return <>{display(item)}</>;
  };

  const Card = (item: Kpi, i: number) => {
    const valueClass = item.isRevenue
      ? Number(item.value) < 0
        ? "text-red-400"
        : "text-[#22C55E]"
      : "text-white";
    const Icon = item.icon;
    return (
      <button
        key={item.key}
        type="button"
        onClick={() => {
          /* Platform Overview is a set of plain head counts — the modal had
             nothing to break down, so it only reprinted the number beside a
             chart of made-up shape. Those cards go straight to their listing;
             Financial Summary keeps the modal, where the composition is the
             answer. */
          if (item.group === "overview") {
            if (item.href) router.push(item.href);
            return;
          }
          setActiveKey(item.key);
        }}
        style={{ animationDelay: `${i * 45}ms` }}
        className="group relative flex flex-col overflow-hidden rounded-xl border border-white/5 bg-[#1A2027] p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-white/10 hover:bg-[#1E252E] hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)] animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            <span className="truncate">{item.label}</span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setInfoKpi(item);
              }}
              className="shrink-0 cursor-pointer text-gray-600 transition-colors hover:text-white"
            >
              <Info size={11} />
            </span>
          </p>
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110"
            style={{ background: `${item.color}22`, color: item.color }}
          >
            <Icon size={16} />
          </span>
        </div>
        {item.dual ? (
          <div className="mt-2">
            <KpiValue item={item} size="card" />
          </div>
        ) : (
          <p
            className={`mt-2 text-[18px] font-bold leading-none tracking-tight sm:text-[20px] lg:text-[22px] ${valueClass}`}
          >
            {loading ? <span className="animate-pulse text-gray-700">••••</span> : display(item)}
          </p>
        )}
        <span
          className="absolute bottom-0 left-0 h-[3px] w-full opacity-80 transition-all group-hover:h-[4px] group-hover:opacity-100"
          style={{ background: item.color }}
        />
      </button>
    );
  };

  /*
    The two money cards chart their rails over time; every other KPI keeps the
    switchable chart it had. Their chart type is fixed, so the type dropdown is
    hidden for them — there is one right answer for "which rail, and when".
  */
  const isPairChart = isDeposits || isWithdrawals || isGgr || isPending;
  const pairRows = buildPairSeries(
    isGgr
      ? (viewStats?.ggrSeries ?? []).map((r) => ({ date: r.date, a: r.bet, b: r.win }))
      : isPending
        ? // Outstanding money by the day it was REQUESTED, split into the two
          // queues. "2,616.63 pending" says nothing about age, and age is the
          // whole point of a payout queue.
          (viewStats?.pendingPayoutSeries ?? []).map((r) => ({
            date: r.date,
            a: r.awaitingReview,
            b: r.awaitingRelease,
          }))
        : (
            (isDeposits ? viewStats?.depositRailSeries : viewStats?.withdrawalRailSeries) ?? []
          ).map((r) => ({ date: r.date, a: r.breeze, b: r.coinflow })),
  );
  // A range with no movement still has to draw something, so it falls back to
  // the single aggregate group the breakdown already carries.
  const pairSeries = pairRows.length
    ? pairRows
    : isPairChart
      ? [
          {
            name: "Total",
            a: Number(breakdownItems[0]?.value ?? 0),
            b: Number(breakdownItems[1]?.value ?? 0),
          },
        ]
      : [];
  const pairNeedsScroll = isPairChart && pairSeries.length > RAIL_VISIBLE_GROUPS;
  // Labels and colours come straight from the breakdown list beside the chart,
  // so the bars and the rows can never drift apart.
  const pairConfig = {
    a: {
      label: breakdownItems[0]?.label ?? "—",
      color: breakdownItems[0]?.color ?? "#B93DEB",
    },
    b: {
      label: breakdownItems[1]?.label ?? "—",
      color: breakdownItems[1]?.color ?? "#38BDF8",
    },
  } satisfies ChartConfig;

  const renderChart = () => {
    /*
      Total Bet is a composition, not a trend: the only question behind one
      handle figure is which kind of play produced it. A radar puts every game
      category on its own spoke, so a lopsided handle reads as a shape rather
      than as one slice swallowing the circle — which is what a pie did here,
      Live Dealers taking 90% and the rest collapsing into slivers. This card
      therefore has no chart-type choice.
    */
    if (isBet) {
      return (
        <RadarChart data={chartData} outerRadius="72%">
          <PolarGrid stroke="#ffffff14" />
          <PolarAngleAxis dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 11 }} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {/* The blue ramp the category rows are dotted with, not the card's
              purple — the chart and the list beside it name the same things and
              must not disagree about their colour. */}
          <Radar
            dataKey="value"
            stroke={BET_ACCENT}
            fill={BET_ACCENT}
            fillOpacity={0.35}
          />
        </RadarChart>
      );
    }
    /*
      The money cards chart their two sides over time — one group per period,
      the sides side by side — so the movement is visible rather than just the
      final split.
    */
    if (isPairChart) {
      return (
        <BarChart
          accessibilityLayer
          data={pairSeries}
          margin={{ left: 4, right: 8, top: 8 }}
          barGap={4}
        >
          <CartesianGrid vertical={false} stroke="#ffffff0a" />
          <XAxis
            dataKey="name"
            tickLine={false}
            tickMargin={10}
            axisLine={false}
            tick={{ fill: "#9CA3AF", fontSize: 11 }}
          />
          <YAxis hide />
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
          {/* Capped so a one- or two-group range does not render two slabs
              the width of the panel — the bars stay the same size whatever
              the period count. */}
          <Bar dataKey="a" fill="var(--color-a)" radius={4} maxBarSize={26} />
          <Bar dataKey="b" fill="var(--color-b)" radius={4} maxBarSize={26} />
        </BarChart>
      );
    }
    if (effectiveChartType === "pie" || effectiveChartType === "donut") {
      return (
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent />} />
          <Legend verticalAlign="bottom" height={28} iconType="circle" wrapperStyle={{ fontSize: 11, color: "#9CA3AF" }} />
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius={effectiveChartType === "donut" ? 60 : 0}
            outerRadius={95}
            paddingAngle={2}
            label={(p: any) => `${p.name}`}
            labelLine={false}
          >
            {chartData.map((d) => (
              <Cell key={d.key} fill={d.color} fillOpacity={active && d.key === active.key ? 1 : 0.45} stroke="#171B23" />
            ))}
          </Pie>
        </PieChart>
      );
    }
    if (effectiveChartType === "radar") {
      return (
        <RadarChart data={chartData} outerRadius={110}>
          <PolarGrid stroke="#ffffff14" />
          <PolarAngleAxis dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 11 }} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Radar dataKey="value" stroke={active?.color ?? "#B93DEB"} fill={active?.color ?? "#B93DEB"} fillOpacity={0.35} />
        </RadarChart>
      );
    }
    if (effectiveChartType === "radial") {
      return (
        <RadialBarChart data={chartData} innerRadius="25%" outerRadius="100%" startAngle={90} endAngle={-270}>
          <ChartTooltip content={<ChartTooltipContent />} />
          <Legend verticalAlign="bottom" height={28} iconType="circle" wrapperStyle={{ fontSize: 11, color: "#9CA3AF" }} />
          <RadialBar dataKey="value" background={{ fill: "#ffffff08" }} cornerRadius={6}>
            {chartData.map((d) => (
              <Cell key={d.key} fill={d.color} fillOpacity={active && d.key === active.key ? 1 : 0.5} />
            ))}
          </RadialBar>
        </RadialBarChart>
      );
    }
    const axes = (
      <>
        <CartesianGrid vertical={false} stroke="#ffffff0a" />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#9CA3AF", fontSize: 11 }} />
        <YAxis hide />
        <ChartTooltip content={<ChartTooltipContent />} />
      </>
    );
    const color = active?.color ?? "#B93DEB";
    // Deposits plots its real composition; the other metrics have no per-period
    // series behind them, so they keep the shape series.
    // Pending has genuine per-day history; the other breakdown cards have only
    // one aggregate per range, so they chart their composition instead.
    const series = isPending && pendingSeries.length
      ? pendingSeries
      : hasBreakdown
        ? chartData
        : trend;
    if (effectiveChartType === "bar") {
      return (
        <BarChart data={series} margin={{ left: 4, right: 8, top: 8 }}>
          {axes}
          <Bar dataKey="value" radius={[6, 6, 0, 0]} fill={color}>
            {hasBreakdown && !isPending &&
              chartData.map((d) => <Cell key={d.key} fill={d.color} />)}
          </Bar>
        </BarChart>
      );
    }
    return (
      <LineChart data={series} margin={{ left: 4, right: 8, top: 8 }}>
        {axes}
        <Line dataKey="value" type="monotone" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
      </LineChart>
    );
  };

  return (
    <SectionCard>
      {/* A failed load used to render every card as 0 with no sign anything
          went wrong — indistinguishable from a genuinely empty period. */}
      {error && !loading && (
        <div
          role="alert"
          className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => fetchStats()}
            className="shrink-0 rounded-md bg-red-500/20 px-3 py-1 font-semibold text-red-200 hover:bg-red-500/30"
          >
            Retry
          </button>
        </div>
      )}
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Financial Summary</p>
        {/* Figures can come from the backend's cache, so say how current they are. */}
        {(refreshing || stats?.cacheMeta?.generatedAt) && (
          <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
            {refreshing ? (
              <>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#B93DEB]" />
                Updating…
              </>
            ) : (
              <>Updated {new Date(stats!.cacheMeta!.generatedAt).toLocaleTimeString()}</>
            )}
          </span>
        )}
      </div>
      {/* 6 across at xl so the financial row stays a single clean line after
          Pending Payouts joined it. Overview keeps 5 (10 cards = 2 full rows). */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {financialKpis.map((k, i) => Card(k, i))}
      </div>

      <p className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Platform Overview</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {overviewKpis.map((k, i) => Card(k, i))}
      </div>

      {/* Detail modal — rectangle: left chart + type dropdown, right metric list, bottom-right CTA */}
      <Dialog open={!!active} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="max-h-[88vh] w-[95vw] max-w-5xl sm:max-w-5xl overflow-hidden border border-[#2A3340] bg-[#171B23] p-0 text-white">
          {active && (
            <>
              <DialogHeader className="border-b border-[#2A3340] px-6 py-4">
                <DialogTitle className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${active.color}22`, color: active.color }}>
                    <active.icon size={18} />
                  </span>
                  <span className="text-lg font-bold">{active.label}</span>
                </DialogTitle>
                <DialogDescription className="text-gray-400">{active.tooltip}</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-[1.7fr_1fr] md:max-h-[72vh] overflow-hidden">
                {/* LEFT — chart + type dropdown */}
                <div className="min-w-0 border-b border-[#2A3340] p-5 md:border-b-0 md:border-r md:overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                  {/* Range — same presets as the dashboard header */}
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <Select value={period} onValueChange={onPeriodChange}>
                      <SelectTrigger className="w-[170px] border-[#2A3340] bg-[#1A2027] text-white">
                        {/* A range picked from the dashboard's own calendar is
                            not one of these presets, so it has no item to
                            select — the placeholder names it instead of
                            leaving the trigger empty. */}
                        <SelectValue
                          placeholder={
                            fromDate
                              ? `${toIso(fromDate)} – ${toIso(toDate ?? fromDate)}`
                              : "Period"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="border-[#2A3340] bg-[#1A2027] text-white">
                        {PERIODS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="mb-3 flex items-center justify-between">
                    {/* While the modal is fetching its own range, the old
                        range's figure would otherwise sit there looking like
                        the answer to the period just picked. */}
                    {modalLoading ? (
                      <p className="animate-pulse text-3xl font-bold tracking-tight text-gray-700">
                        ••••
                      </p>
                    ) : active.dual ? (
                      <KpiValue item={active} size="lg" />
                    ) : (
                      <p className="text-3xl font-bold tracking-tight" style={{ color: active.color }}>
                        {display(active)}
                      </p>
                    )}
                    {/* Cards with one right answer for their shape lose the
                        selector: the money cards chart their two sides over
                        time, Total Bet charts its composition. */}
                    {!pieOnly && !isPairChart && !isBet && (
                      <Select value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
                        <SelectTrigger className="w-[130px] border-[#2A3340] bg-[#1A2027] text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-[#2A3340] bg-[#1A2027] text-white">
                          <SelectItem value="line">Line</SelectItem>
                          <SelectItem value="bar">Bar</SelectItem>
                          <SelectItem value="pie">Pie</SelectItem>
                          <SelectItem value="donut">Donut</SelectItem>
                          <SelectItem value="radar">Radar</SelectItem>
                          <SelectItem value="radial">Radial</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  {/* Sized in PERCENT of the scroll viewport, so exactly
                      RAIL_VISIBLE_GROUPS groups fill the panel at any width and
                      the remainder is reached by scrolling — no measuring. */}
                  <div
                    className={
                      pairNeedsScroll
                        ? "overflow-x-auto pb-1 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15 hover:[&::-webkit-scrollbar-thumb]:bg-white/25"
                        : ""
                    }
                  >
                    <ChartContainer
                      config={isPairChart ? pairConfig : chartConfig}
                      className={
                        isBet
                          ? "h-[340px] w-full"
                          : `h-[300px] ${pairNeedsScroll ? "" : "w-full"}`
                      }
                      style={
                        pairNeedsScroll
                          ? { width: `${(pairSeries.length / RAIL_VISIBLE_GROUPS) * 100}%` }
                          : undefined
                      }
                    >
                      {renderChart()}
                    </ChartContainer>
                  </div>
                  {/* Names the two series the grouped bars stand for. The chart
                      itself carries no legend, so without this the pairing is
                      only discoverable by hovering. */}
                  {isPairChart && (
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      {(["a", "b"] as const).map((k) => (
                        <span key={k} className="flex items-center gap-1.5 text-gray-400">
                          <span
                            className="h-2.5 w-2.5 rounded-[3px]"
                            style={{ background: pairConfig[k].color }}
                          />
                          {pairConfig[k].label}
                        </span>
                      ))}
                      <span className="text-gray-600">
                        {!pairRows.length
                          ? "No movement in this range"
                          : pairNeedsScroll
                            ? `${pairSeries.length} periods · scroll sideways for the rest`
                            : `Showing ${pairSeries.length} ${pairSeries.length === 1 ? "period" : "periods"}`}
                      </span>
                    </div>
                  )}
                </div>

                {/* RIGHT — pinned total, scrolling metric list, CTA bottom */}
                <div className="flex h-full min-h-0 flex-col">
                  {/* The headline stays put while the breakdown scrolls. It used
                      to sit under the list, so on a long breakdown (game
                      categories) the one number every row is a share OF was the
                      first thing to leave the screen. */}
                  {hasBreakdown && (
                    <div className="shrink-0 border-b border-[#2A3340] px-3 pb-2 pt-3">
                      <div className="flex items-center justify-between rounded-lg border border-white/5 bg-[#1A2027] px-3 py-2.5">
                        <span className="text-sm font-semibold text-white">{active.label}</span>
                        {/* GGR is signed: `display()` strips the sign for
                            revenue KPIs (the card pairs it with an arrow), so
                            this row printed a red -34,414.42 headline as a
                            green 34,414.42. Negative means the players are
                            ahead, which is the opposite reading. */}
                        <span
                          className="text-sm font-bold tabular-nums"
                          style={{
                            color: isGgr
                              ? ggrCash >= 0
                                ? "#04AD37"
                                : "#F43F5E"
                              : active.color,
                          }}
                        >
                          {isGgr ? signedMoney(ggrCash) : display(active)}
                        </span>
                      </div>
                      <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                        {breakdownTitle}
                      </p>
                    </div>
                  )}
                  <div className="min-h-0 flex-1 overflow-y-auto p-3 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                    {hasBreakdown ? (
                      <>
                        {(() => {
                          const total = breakdownItems.reduce((a, b) => a + b.value, 0);
                          return breakdownItems.map((b) => {
                            const pct = total ? (b.value / total) * 100 : 0;
                            return (
                              <div key={b.key} className="mb-1.5 rounded-lg px-3 py-2.5 hover:bg-white/[0.03]">
                                <div className="flex items-center justify-between">
                                  <span
                                    className="flex items-center gap-2 text-sm text-gray-300"
                                    title={"hint" in b ? (b.hint as string) : undefined}
                                  >
                                    <span
                                      className="h-2.5 w-2.5 rounded-full"
                                      style={{ background: b.color }}
                                    />
                                    {b.label}
                                    {"meta" in b && (b as { meta?: string }).meta ? (
                                      <span className="text-[11px] text-gray-500">
                                        ({(b as { meta?: string }).meta})
                                      </span>
                                    ) : null}
                                  </span>
                                  <span className="text-sm font-semibold tabular-nums text-white">
                                    {/* Network rows are head counts, not money. */}
                                    {b.value.toLocaleString("en-US", {
                                      minimumFractionDigits: isAgents ? 0 : 2,
                                      maximumFractionDigits: isAgents ? 0 : 2,
                                    })}
                                  </span>
                                </div>
                                {/* The share is the point of this panel, and a bar
                                    reads faster than three numbers compared by eye. */}
                                <div className="mt-1.5 flex items-center gap-2">
                                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                                    <div
                                      className="h-full rounded-full"
                                      style={{ width: `${pct}%`, background: b.color }}
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                        {isAgents && (
                          <div className="mt-3 border-t border-white/5 pt-3">
                            <div className="flex items-center justify-between px-3">
                              <span
                                className="text-sm text-gray-300"
                                title="Every player who arrived through a referrer, across all three routes: agents, sub-agents and other players."
                              >
                                Players referred
                              </span>
                              <span className="text-sm font-semibold tabular-nums text-white">
                                {(
                                  (agentBd?.playersByAgent ?? 0) +
                                  (agentBd?.playersBySubAgent ?? 0) +
                                  (agentBd?.playersByPlayer ?? 0)
                                ).toLocaleString("en-US")}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Share of turnover the house gained. The sign is the
                            whole point — below zero the players finished ahead —
                            so it is always signed and coloured. */}
                        {isGgr && (
                          <div className="mt-3 border-t border-white/5 pt-3">
                            <div className="flex items-center justify-between px-3">
                              <span
                                className="text-sm text-gray-300"
                                title={
                                  ggrHold < 0
                                    ? "Players won more than they staked over this range — the house lost this share of turnover."
                                    : "Share of everything staked that the house kept."
                                }
                              >
                                Gain
                              </span>
                              <span
                                className={`text-sm font-semibold tabular-nums ${
                                  ggrHold < 0 ? "text-red-400" : "text-[#22C55E]"
                                }`}
                              >
                                {ggrHold > 0 ? "+" : ""}
                                {ggrHold.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        )}

                        {isPending && pendingRailItems.length > 0 && (
                          <div className="mt-3 border-t border-white/5 pt-3">
                            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                              Headed for
                            </p>
                            {(() => {
                              const total = pendingRailItems.reduce((a, b) => a + b.value, 0);
                              return pendingRailItems.map((i) => {
                                const pct = total ? (i.value / total) * 100 : 0;
                                return (
                                  <div key={i.key} className="mb-1.5 rounded-lg px-3 py-2 hover:bg-white/[0.03]">
                                    <div className="flex items-center justify-between">
                                      <span className="flex items-center gap-2 text-sm text-gray-300">
                                        <span
                                          className="h-2.5 w-2.5 rounded-full"
                                          style={{ background: i.color }}
                                        />
                                        {i.label}
                                      </span>
                                      <span className="text-sm font-semibold tabular-nums text-white">
                                        {i.value.toLocaleString("en-US", {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                      </span>
                                    </div>
                                    <div className="mt-1.5 flex items-center gap-2">
                                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                                        <div
                                          className="h-full rounded-full"
                                          style={{ width: `${pct}%`, background: i.color }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        )}

                        {/* Same money, cut the other way. Rows with nothing in
                            them are dropped rather than printed as 0.00 — an
                            empty product line says nothing an operator needs. */}
                        {isDeposits && (
                            <div className="mt-3 border-t border-white/5 pt-3">
                              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                                Subscription plans
                              </p>
                              {/* An empty list is an answer — "none sold" — and
                                  hiding the section made it look like the panel
                                  had failed to load. */}
                              {depositPlanItems.length === 0 && (
                                <p className="px-3 pb-1 text-[11px] leading-relaxed text-gray-500">
                                  No subscription sales in this range.
                                </p>
                              )}
                              {(() => {
                                const total = depositPlanItems.reduce((a, b) => a + b.value, 0);
                                return depositPlanItems
                                  .map((i) => {
                                    const pct = total ? (i.value / total) * 100 : 0;
                                    return (
                                      <div key={i.key} className="mb-1.5 rounded-lg px-3 py-2 hover:bg-white/[0.03]">
                                        <div className="flex items-center justify-between">
                                          <span className="flex items-center gap-2 text-sm text-gray-300">
                                            <span
                                              className="h-2.5 w-2.5 rounded-full"
                                              style={{ background: i.color }}
                                            />
                                            {i.label}
                                          </span>
                                          <span className="text-sm font-semibold tabular-nums text-white">
                                            {i.value.toLocaleString("en-US", {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            })}
                                          </span>
                                        </div>
                                        <div className="mt-1.5 flex items-center gap-2">
                                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                                            <div
                                              className="h-full rounded-full"
                                              style={{ width: `${pct}%`, background: i.color }}
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  });
                              })()}
                            </div>
                          )}

                        {/* Separated by a rule, not listed with the streams:
                            manual credits and debits are admin adjustments, so
                            they are shown for context but never counted into
                            the total above. */}
                        {isDeposits && (
                        <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
                          <div className="flex items-center justify-between px-3">
                            <span className="flex items-center gap-2 text-sm text-gray-300">
                              <span className="h-2.5 w-2.5 rounded-full bg-[#22C55E]" />
                              Manual Credit
                            </span>
                            <span className="text-sm font-semibold tabular-nums text-green-400">
                              +{fmt2(manualCredit)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between px-3">
                            <span className="flex items-center gap-2 text-sm text-gray-300">
                              <span className="h-2.5 w-2.5 rounded-full bg-[#F43F5E]" />
                              Manual Debit
                            </span>
                            <span className="text-sm font-semibold tabular-nums text-red-400">
                              -{fmt2(manualDebit)}
                            </span>
                          </div>
                          <p className="px-3 text-[11px] leading-relaxed text-gray-500">
                            Admin-approved manual deposits and balance edits (Sweep Coin).
                            Credit = added, Debit = taken off (top outs / decreases). Not
                            counted in Gross Deposits.
                          </p>
                        </div>
                        )}
                      </>
                    ) : (
                      group.map((k) => {
                      const sel = k.key === active.key;
                      return (
                        <button
                          key={k.key}
                          type="button"
                          onClick={() => setActiveKey(k.key)}
                          className={`mb-1.5 flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors ${
                            sel ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                          }`}
                        >
                          <span className="flex items-center gap-2 text-sm">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: k.color }} />
                            <span className={sel ? "font-semibold text-white" : "text-gray-300"}>{k.label}</span>
                          </span>
                          <span className="text-sm font-semibold tabular-nums text-white">
                            {k.dual ? <KpiValue item={k} size="sm" /> : display(k)}
                          </span>
                        </button>
                      );
                      })
                    )}
                  </div>
                  <div className="border-t border-[#2A3340] p-3">
                    {active.href ? (
                      <Button
                        onClick={() => {
                          router.push(active.href!);
                          closeModal();
                        }}
                        className="w-full gap-2 bg-[#B93DEB] text-white hover:bg-[#A22FD0]"
                      >
                        Go to page <ArrowRight size={16} />
                      </Button>
                    ) : (
                      <p className="text-center text-xs text-gray-500">No linked page</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick info modal (the "i" icon) */}
      <Dialog open={!!infoKpi} onOpenChange={(o) => !o && setInfoKpi(null)}>
        {/* `max-w-md` alone replaced DialogContent's own
            `max-w-[calc(100%-2rem)]`, so on a 440px phone the dialog was exactly
            as wide as the screen and sat flush against both edges. Setting the
            width explicitly keeps a 1rem gutter while the max-width still caps
            it on desktop. */}
        <DialogContent className="w-[calc(100%-2rem)] max-w-md border border-[#2A3340] bg-[#171B23] p-0 text-white">
          {infoKpi && (
            <>
              <DialogHeader className="border-b border-[#2A3340] px-6 py-4">
                <DialogTitle className="flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{ background: `${infoKpi.color}22`, color: infoKpi.color }}
                  >
                    <infoKpi.icon size={18} />
                  </span>
                  <span className="text-lg font-bold">{infoKpi.label}</span>
                </DialogTitle>
                <DialogDescription className="text-gray-400">{infoKpi.tooltip}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 px-6 py-5">
                <div className="rounded-xl border border-white/5 bg-[#1A2027] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Current value</p>
                  {infoKpi.dual ? (
                    <div className="mt-1">
                      <KpiValue item={infoKpi} size="lg" />
                    </div>
                  ) : (
                    <p className="mt-1 text-2xl font-bold" style={{ color: infoKpi.color }}>
                      {display(infoKpi)}
                    </p>
                  )}
                </div>
                <div className="rounded-xl border border-white/5 bg-[#1A2027] px-4 py-3">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    Definition
                  </p>
                  <p className="text-sm leading-relaxed text-gray-300">
                    {DETAILS[infoKpi.key] ?? infoKpi.tooltip}
                  </p>
                </div>
                <Button
                  onClick={() => {
                    const k = infoKpi.key;
                    setInfoKpi(null);
                    setActiveKey(k);
                  }}
                  className="w-full gap-2 bg-[#B93DEB] text-white hover:bg-[#A22FD0]"
                >
                  View full details <ArrowRight size={16} />
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
