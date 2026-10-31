"use client";

import { useMemo, useState, useEffect } from "react";
import { profileApi } from "@/api/users/users";
import { ReferralStats } from "@/types/profile.type";
import { useAuthStore } from "@/store/auth-store";
import {
  Lock,
  Unlock,
  Wallet,
  AlertCircle,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  BadgeCheck,
  Loader2,
  RotateCcw,
  FilterX,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import AgentDatePicker from "./AgentDatePicker";
import toast from "react-hot-toast";
import { ClaimRecord } from "@/types/profile.type";

interface WalletOverviewProps {
  stats: ReferralStats | null;
  isLoading: boolean;
  onClaim: () => void;
  isClaiming: boolean;
}

interface Settlement {
  id: string;
  referrerId: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  directAmount: number;
  subAgentAmount: number;
  // Package/plan bonus portion included inside directAmount (display-only)
  bonusAmount?: number;
  status: "AVAILABLE" | "REQUESTED" | "PENDING" | "APPROVED" | "PROCESSING" | "COMPLETED" | "RELEASED" | "VOIDED" | "DEDUCTED";
  createdAt: string;
}

const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: typeof Lock;
}> = {
  AVAILABLE: {
    label: "Frozen",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
    icon: Lock,
  },
  RELEASED: {
    label: "Released",
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    icon: Unlock,
  },
  REQUESTED: {
    label: "Requested",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    icon: Clock,
  },
  PENDING: {
    label: "Pending",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    icon: Clock,
  },
  APPROVED: {
    label: "Approved",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    icon: BadgeCheck,
  },
  PROCESSING: {
    label: "Processing",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    icon: RotateCcw,
  },
  COMPLETED: {
    label: "Completed",
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    icon: CheckCircle2,
  },
  VOIDED: {
    label: "Voided",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    icon: XCircle,
  },
  DEDUCTED: {
    label: "Deducted",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    icon: XCircle,
  },
};

export function WalletOverview({
  stats,
  isLoading,
  onClaim,
  isClaiming,
}: WalletOverviewProps) {
  const user = useAuthStore((state) => state.user);
  const [releaseDurationSec, setReleaseDurationSec] = useState(604800);
  const [payoutLockSec, setPayoutLockSec] = useState(45 * 24 * 60 * 60);
  // "Enable Freeze / Lock" (admin Payout/Days Settings). The config endpoint
  // returns the configured durations whether or not the toggle is on — the
  // admin modal needs them to stay editable — so this decides whether the
  // agent's dashboard advertises a hold that is actually being enforced.
  const [freezeLockEnabled, setFreezeLockEnabled] = useState(true);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [settlementDateFilter, setSettlementDateFilter] = useState<string>("");
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [settlementsLoading, setSettlementsLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const isSubAgent =
    user?.roles?.some((role) => role.name.toLowerCase().includes("sub")) ?? false;

  const withdrawable = stats?.availableBalance ?? 0;
  const frozen = stats?.frozenBalance ?? 0;
  // Everything earned but not yet claimable: the settlement safety-hold
  // (pendingBalance) PLUS the freeze bucket. The On Hold card used to show
  // only `frozen`, so commission still waiting on the settlement cron was
  // invisible — Total earned said 83.00, Available said 33.20, On Hold said
  // 0.00, and the missing 49.80 looked like the tiles disagreeing (QA #30).
  // freezePending is the backend's wallet-basis sum of both; clamp at the
  // frozen floor so a negative clawback carry never shrinks the display
  // below money that is genuinely locked.
  const onHold = Math.max(Number(stats?.freezePending ?? frozen), frozen);
  const settling = Math.max(0, onHold - frozen);
  // "Total earned" in the Lifetime Summary = the LEDGER sum, the same field the
  // header tile and every admin surface read, so this card can no longer
  // disagree with the tile directly above it.
  //
  // It was `withdrawable + frozen + totalClaimed`: wallet buckets plus claim
  // rows, two systems that do not reconcile. That dropped `pendingBalance`
  // entirely (earnings still on the safety hold simply weren't counted) while
  // adding back payouts made through the agent-payment rail, so the figure
  // could sit below OR above real lifetime earnings depending on which way the
  // errors fell.
  // Floored at zero (QA #40): with the negative-balance allowance removed, a
  // clawback-carried negative ledger sum presents as 0.00 — the wallet still
  // nets the debt against future earnings internally.
  const total = Math.max(
    0,
    Number(
      stats?.totalEarnedAllTime ??
        Number(withdrawable) + Number(frozen) + Number(stats?.totalClaimed ?? 0),
    ),
  );


  const formatDurationLabel = (seconds: number) => {
    if (seconds % 86400 === 0) {
      const days = seconds / 86400;
      return `${days}-DAY${days > 1 ? "S" : ""}`;
    }
    if (seconds % 3600 === 0) {
      const hours = seconds / 3600;
      return `${hours}-HOUR${hours > 1 ? "S" : ""}`;
    }
    const minutes = Math.max(1, Math.round(seconds / 60));
    return `${minutes}-MIN${minutes > 1 ? "S" : ""}`;
  };

  const formatCountdownLabel = (seconds: number) => {
    if (seconds <= 0) return "AWAITING AUTO-COMPLETE";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}H ${minutes}M ${secs}S LEFT`;
    }
    if (minutes > 0) {
      return `${minutes}M ${secs}S LEFT`;
    }
    return `${secs}S LEFT`;
  };

  const parseISO = (value: string) => new Date(value);

  // ISO week number for the "WK xx" badge on each settlement period.
  const isoWeek = (value: string) => {
    const d = new Date(value);
    const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  };

  // Monday–Sunday span of the ISO week containing the given date. Used as the
  // period label so rows read week-wise even when the backend runs short
  // test-mode settlement windows (same-day periods).
  const isoWeekRange = (value: string) => {
    const d = new Date(value);
    const monday = new Date(d);
    const dayNum = d.getDay() || 7;
    monday.setDate(d.getDate() - dayNum + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return `${format(monday, "MMM dd")} – ${format(sunday, "MMM dd, yyyy")}`;
  };

  // One row per ISO week: test-mode runs settle every few minutes, producing
  // many same-week snapshots — aggregate them so the table reads week-wise.
  interface WeeklyRow {
    key: string;
    weekNo: number;
    rangeLabel: string;
    periodStart: string;
    periodEnd: string;
    direct: number;
    bonus: number;
    sub: number;
    total: number;
    count: number;
    latestSettled: string;
    status: Settlement["status"];
  }

  const groupByWeek = (rows: Settlement[]): WeeklyRow[] => {
    const map = new Map<string, WeeklyRow>();
    for (const s of rows) {
      const d = new Date(s.periodStart);
      const key = `${d.getFullYear()}-${isoWeek(s.periodStart)}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          weekNo: isoWeek(s.periodStart),
          rangeLabel: isoWeekRange(s.periodStart),
          periodStart: s.periodStart,
          periodEnd: s.periodEnd,
          direct: Number(s.directAmount) || 0,
          bonus: Number(s.bonusAmount) || 0,
          sub: Number(s.subAgentAmount) || 0,
          total: Number(s.totalAmount) || 0,
          count: 1,
          latestSettled: s.createdAt,
          status: s.status,
        });
      } else {
        existing.direct += Number(s.directAmount) || 0;
        existing.bonus += Number(s.bonusAmount) || 0;
        existing.sub += Number(s.subAgentAmount) || 0;
        existing.total += Number(s.totalAmount) || 0;
        existing.count += 1;
        if (new Date(s.createdAt) > new Date(existing.latestSettled)) {
          existing.latestSettled = s.createdAt;
        }
        if (new Date(s.periodStart) < new Date(existing.periodStart)) {
          existing.periodStart = s.periodStart;
        }
        if (new Date(s.periodEnd) > new Date(existing.periodEnd)) {
          existing.periodEnd = s.periodEnd;
        }
        // Status priority: anything still held wins, then in-flight, then released.
        const rank = (st: string) =>
          st === "AVAILABLE" ? 0
          : ["REQUESTED", "PENDING", "PROCESSING", "APPROVED"].includes(st) ? 1
          : st === "RELEASED" || st === "COMPLETED" ? 2
          : 3;
        if (rank(s.status) < rank(existing.status)) existing.status = s.status;
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime(),
    );
  };


  const format = (value: Date, pattern: string) => {
    if (pattern === "MMM dd") {
      return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "2-digit",
      }).format(value);
    }

    if (pattern === "MMM dd, yyyy") {
      return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "2-digit",
        year: "numeric",
      }).format(value);
    }

    if (pattern === "MMM dd, HH:mm") {
      return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(value);
    }

    return value.toLocaleString();
  };

  /**
   * Weeks shown in the table, after the date filter. Hoisted out of the JSX so
   * the "Showing N Results" pill counts exactly what the table renders.
   */
  const filteredSettlementWeeks = useMemo(() => {
    const matching = settlements.filter((s) => {
      if (!settlementDateFilter) return true;
      const day = new Date(settlementDateFilter);
      const start = new Date(s.periodStart);
      const dayNum = start.getDay() || 7;
      const monday = new Date(start);
      monday.setDate(start.getDate() - dayNum + 1);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      return day >= monday && day <= sunday;
    });
    return groupByWeek(matching).slice(0, 10);
    // groupByWeek is a stable local helper over the same inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settlements, settlementDateFilter]);

  const fetchSettlements = async () => {
    try {
      setSettlementsLoading(true);
      const res = await profileApi.getSettlements();
      setSettlements(res.data || []);
    } catch {
      toast.error("Failed to load settlement history");
    } finally {
      setSettlementsLoading(false);
    }
  };

  const fetchClaims = async () => {
    try {
      const res = await profileApi.getClaimHistory();
      setClaims(res.data || []);
    } catch {
      setClaims([]);
    }
  };

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await profileApi.getReferralConfig();
        setReleaseDurationSec(Number(res.data.affiliateReleaseDurationSec ?? 604800));
        setPayoutLockSec(Number(res.data.payoutLockSec ?? 45 * 24 * 60 * 60));
        setFreezeLockEnabled(res.data.payoutLockEnabled !== false);
      } catch {
        setReleaseDurationSec(604800);
        setPayoutLockSec(45 * 24 * 60 * 60);
        setFreezeLockEnabled(true);
      }
    };

    fetchConfig();
  }, []);

  useEffect(() => {
    fetchSettlements();
    fetchClaims();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const activeFrozenSettlement = settlements.find(
    (settlement) =>
      Number(settlement.subAgentAmount) > 0 &&
      !["RELEASED", "VOIDED", "COMPLETED"].includes(settlement.status)
  );

  const frozenCountdownSec = activeFrozenSettlement
    ? Math.max(
        0,
        Math.ceil(
          (new Date(activeFrozenSettlement.createdAt).getTime() + releaseDurationSec * 1000 - now) / 1000
        )
      )
    : 0;

  const activeProcessingClaim = claims.find(
    (claim) => claim.status === "PROCESSING" && claim.approvedAt
  );

  const processingCountdownSec = activeProcessingClaim?.approvedAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(activeProcessingClaim.approvedAt).getTime() + payoutLockSec * 1000 - now) / 1000
        )
      )
    : 0;

  // With the toggle off there is no hold to count down to — the release cron
  // moves funds on its next tick — so promising a "45-DAY LOCK-IN" here would
  // describe a rule that is not being enforced.
  const frozenBadgeLabel = !freezeLockEnabled
    ? "INSTANT RELEASE"
    : frozen > 0 && activeProcessingClaim
      ? formatCountdownLabel(processingCountdownSec)
      : frozen > 0 && activeFrozenSettlement
        ? formatCountdownLabel(frozenCountdownSec)
        : `${formatDurationLabel(releaseDurationSec)} AUTO-RELEASE`;

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-48 bg-[#191D24] rounded-2xl border border-gray-800" />
        <div className="h-32 bg-[#191D24] rounded-2xl border border-gray-800" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ── COMMISSION WALLET — one panel, three zones ─────────────── */}
      <Card className="relative bg-[#191D24] border-gray-800 overflow-hidden">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1.3fr_1fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-gray-800">
          {/* AVAILABLE + CLAIM (single source of truth — no duplicate card) */}
          <div className="p-4 sm:p-6 flex flex-col justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <Unlock size={14} className="text-green-400" />
                </div>
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                  Available to Claim
                </span>
              </div>
              <p className="text-3xl sm:text-4xl font-semibold text-green-400 tracking-tight">
                {withdrawable.toFixed(2)}
              </p>
              <p className="text-[11px] text-gray-500 mt-1.5 font-medium">
                Claims go straight to your main WulfCash wallet.
              </p>
            </div>
            <button
              onClick={onClaim}
              disabled={isClaiming || withdrawable <= 0}
              className={`w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-3.5 rounded-xl font-semibold text-sm uppercase tracking-widest transition-all ${
                withdrawable > 0
                  ? "bg-purple-600 text-white hover:bg-purple-700 active:scale-95"
                  : "bg-gray-800 text-gray-600 cursor-not-allowed"
              }`}
            >
              {isClaiming ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Wallet size={16} />
              )}
              {isClaiming
                ? "Processing..."
                : withdrawable > 0
                  ? `Claim ${withdrawable.toFixed(2)}`
                  : "Nothing to Claim"}
            </button>
          </div>

          {/* ON HOLD (frozen sub-network earnings) */}
          <div className="p-4 sm:p-6 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                  <Lock size={14} className="text-yellow-400" />
                </div>
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                  On Hold
                </span>
              </div>
              {frozen > 0 && (
                <span className="text-[11px] font-semibold text-yellow-500/80 uppercase tracking-widest bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20 whitespace-nowrap">
                  {frozenBadgeLabel}
                </span>
              )}
            </div>
            <p className={`text-3xl font-semibold tracking-tight ${onHold > 0 ? "text-yellow-400" : "text-gray-600"}`}>
              {onHold.toFixed(2)}
            </p>
            <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
              {onHold > 0
                ? settling > 0 && frozen > 0
                  ? `${settling.toFixed(2)} awaiting settlement · ${frozen.toFixed(2)} in the release hold — both move to your available balance automatically.`
                  : settling > 0
                    ? "Earnings awaiting the next settlement run — they move to your available balance automatically."
                    : "Earnings on a safety hold — they move to your available balance automatically."
                : "No funds on hold. New earnings briefly hold here before becoming available."}
            </p>
          </div>

          {/* LIFETIME SUMMARY */}
          <div className="p-4 sm:p-6 flex flex-col gap-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center">
                <Calendar size={14} className="text-purple-400" />
              </div>
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                Lifetime Summary
              </span>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-500 font-bold">Total earned</span>
                <span className="text-sm font-semibold text-white">{total.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-500 font-bold">Already claimed</span>
                <span className="text-sm font-semibold text-gray-300">
                  {(stats?.totalClaimed ?? 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-500 font-bold">Awaiting approval</span>
                <span className={`text-sm font-semibold ${(stats?.requestedAmount ?? 0) > 0 ? "text-yellow-400" : "text-gray-500"}`}>
                  {(stats?.requestedAmount ?? 0).toFixed(2)}
                </span>
              </div>
              <div className="h-1 rounded-full bg-white/5 overflow-hidden mt-1">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-300 transition-all duration-700"
                  style={{
                    width: `${total > 0 ? Math.min(100, ((stats?.totalClaimed ?? 0) / total) * 100) : 0}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-gray-600 font-bold">
                {total > 0 ? `${Math.min(100, Math.round(((stats?.totalClaimed ?? 0) / total) * 100))}% of lifetime earnings claimed` : "No earnings yet"}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* ── SETTLEMENT HISTORY ──────────────────────────────────── */}
      {/* Title and filter sit above the table card, matching Recent Referrals */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center">
              <Calendar size={14} className="text-purple-500" />
            </div>
            <h3 className="text-lg font-bold text-white">
              Weekly Settlement History
            </h3>
          </div>

          {/* Filter: show settlements whose period covers the picked date. */}
          <div className="flex items-center gap-3">
            <AgentDatePicker
              value={settlementDateFilter}
              onChange={(iso) => setSettlementDateFilter(iso)}
              className="bg-[#191D24] border border-white/5 text-gray-300 px-3 h-10 rounded-xl flex items-center w-full md:w-48"
            />
            {settlementDateFilter && (
              <button
                onClick={() => setSettlementDateFilter("")}
                className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
              >
                <FilterX size={14} />
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="bg-[#191D24] border border-gray-800 rounded-2xl overflow-hidden animate-in fade-in duration-300">
          {settlementsLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
              <p className="text-[10px] text-gray-600 uppercase font-bold">
                Loading settlements...
              </p>
            </div>
          ) : settlements.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-800/50 flex items-center justify-center mx-auto mb-3">
                <Calendar size={24} className="text-gray-600" />
              </div>
              <p className="text-gray-500 font-bold text-sm uppercase tracking-tight">
                No settlements yet
              </p>
              <p className="text-gray-700 text-xs mt-1 font-bold">
                Weekly snapshots appear here after Monday
              </p>
            </div>
          ) : (
            /* The agent view has six columns; below `lg` they used to squeeze
               into the card's overflow-hidden until the money figures clipped.
               A width floor plus horizontal scroll keeps every column readable.
               The floor is released at `lg`, where the layout already had the
               room, so desktop renders exactly as before. The sub-agent view is
               three columns and needs no floor. */
            <div className="overflow-x-auto agent-x-scroll">
            <div
              className={`divide-y divide-gray-800/60 overflow-y-auto scrollbar-hide ${
                isSubAgent ? "" : "min-w-[720px] lg:min-w-0"
              }`}
            >
              {/* Table header */}
              <div
                className={`grid gap-3 px-4 sm:px-5 py-3 bg-black/20 border-b border-gray-800 sticky top-0 z-10 ${
                  isSubAgent
                    ? "grid-cols-[1.4fr_1fr_0.8fr]"
                    : "grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_0.7fr_0.8fr]"
                }`}
              >
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                  Period
                </span>
                {isSubAgent ? (
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest text-right">
                    Earned
                  </span>
                ) : (
                  <>
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest text-right">
                      Agent Earnings
                    </span>
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest text-right" title="Package/plan bonus included in agent earnings">
                      Bonus Incl.
                    </span>
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest text-right">
                      Sub-Agent
                    </span>
                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest text-right">
                      Total
                    </span>
                  </>
                )}
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest text-right">
                  Status
                </span>
              </div>

              {/* One aggregated row per ISO week (latest 10 weeks), optionally
                  narrowed to the week containing the picked date */}
              {filteredSettlementWeeks.map((w) => {
                const cfg = STATUS_CONFIG[w.status] ?? STATUS_CONFIG.VOIDED;
                const StatusIcon = cfg.icon;
                return (
                  <div
                    key={w.key}
                    className={`grid gap-3 px-4 sm:px-6 py-4 items-center hover:bg-white/[0.02] transition-colors ${
                      isSubAgent
                        ? "grid-cols-[1.4fr_1fr_0.8fr]"
                        : "grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_0.7fr_0.8fr]"
                    }`}
                  >
                    {/* Period */}
                    <div className="min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <span className="text-[8px] font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded w-fit whitespace-nowrap">
                          WK {w.weekNo}
                        </span>
                        <p className="text-[10px] sm:text-[11px] font-semibold text-white sm:whitespace-nowrap truncate">
                          {w.rangeLabel}
                        </p>
                      </div>
                      <p className="text-[9px] sm:text-[11px] text-gray-600 font-bold mt-0.5 uppercase truncate">
                        Last settled {format(parseISO(w.latestSettled), "MMM dd, HH:mm")}
                      </p>
                      {w.count > 1 && (
                        <p className="text-[9px] sm:text-[11px] text-gray-700 font-bold mt-0.5 uppercase truncate">
                          {w.count} settlements combined this week
                        </p>
                      )}
                    </div>

                    {/* A DEDUCTED week is a net loss carried against future
                        commission — it must not render in earnings green. */}
                    {isSubAgent ? (
                      <p className={`text-right text-[13px] font-semibold italic tracking-tight font-mono ${w.total < 0 ? "text-red-400" : "text-green-400"}`}>
                        {w.total.toFixed(2)}
                      </p>
                    ) : (
                      <>
                        {/* Agent earnings (direct) */}
                        <p className={`text-right text-[12px] font-semibold tabular-nums ${w.direct < 0 ? "text-red-400" : "text-green-400"}`}>
                          {w.direct.toFixed(2)}
                        </p>

                        {/* Plan bonus included in agent earnings */}
                        <p className={`text-right text-[12px] font-semibold tabular-nums ${w.bonus > 0 ? "text-purple-400" : "text-gray-600"}`}>
                          {w.bonus.toFixed(2)}
                        </p>

                        {/* Sub-agent network */}
                        <p className={`text-right text-[12px] font-semibold tabular-nums ${w.sub < 0 ? "text-red-400" : "text-yellow-400"}`}>
                          {w.sub.toFixed(2)}
                        </p>

                        {/* Total */}
                        <p className="text-right text-[13px] font-semibold text-white italic tracking-tight font-mono">
                          {w.total.toFixed(2)}
                        </p>
                      </>
                    )}

                    {/* Status badge */}
                    <div className="flex justify-end">
                      <span
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase border ${cfg.bg} ${cfg.border} ${cfg.color}`}
                      >
                        <StatusIcon size={10} />
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
          )}

          {/* Freeze info note */}
          <div className="px-4 sm:px-6 py-3 border-t border-gray-800 bg-black/10 flex items-start gap-3">
            <AlertCircle size={14} className="text-yellow-500/60 shrink-0 mt-0.5" />
            <p className="text-[11px] text-gray-600 font-bold uppercase leading-relaxed">
              Earnings from referrals are{" "}
              <span className="text-yellow-500">subject to a {formatDurationLabel(releaseDurationSec).toLowerCase()} auto-release period</span>.
              Frozen sub-agent funds move to withdrawable balance automatically after this window expires.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
