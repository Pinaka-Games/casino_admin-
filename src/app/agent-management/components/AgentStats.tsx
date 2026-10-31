"use client";
import { useMemo, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import {
  Users,
  Wallet,
  TrendingUp,
  Award,
  ChevronDown,
  Activity,
  Coins,
  Landmark,
  ReceiptText,
  Scale,
} from "lucide-react";
import { ReferralStats } from "@/types/profile.type";

interface AgentStatsProps {
  stats: ReferralStats | null;
  isLoading: boolean;
  onClaim?: () => void;
  isClaiming?: boolean;
}

export function AgentStats({
  stats,
  isLoading,
  onClaim,
  isClaiming,
}: AgentStatsProps) {
  const user = useAuthStore((state) => state.user);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);

  const isSubAgent =
    user?.roles?.some((role) => role.name.toLowerCase().includes("sub")) ??
    false;
  // `totalEarnings` is the affiliate WALLET balance (pending + withdrawable +
  // frozen), not lifetime earnings.
  const currentCommissionPool = Number(stats?.totalEarnings ?? 0);

  // Lifetime commission = the LEDGER sum the server already computes
  // (`totalEarnedAllTime`: every accrual, net of platform fees, forfeited rows
  // counted as 0). It is the identical figure behind the admin sub-agent
  // listing, the sub-agent detail header, the Revenue tab and the Downline
  // tab, so this tile now agrees with all of them.
  //
  // It used to be reconstructed as `wallet balance + total claimed`, which is
  // the one thing the API docs tell clients not to do — those are two separate
  // systems (affiliate_wallets vs referral_claims / agent_payment_requests)
  // and they do not reconcile:
  //   • `totalClaimed` also counts COMPLETED agent payment requests, a
  //     different payout rail, so money paid out that way was added back on
  //     top of a balance it had already left → over-reported.
  //   • an admin deduction from the wallet (parent clawing back a sub-agent's
  //     balance) lowers the balance with no claim row → under-reported.
  //   • `pendingBalance` may go NEGATIVE to carry a clawback, which is a
  //     balance state, not a lifetime figure.
  // Falls back to the old derivation only if an older API omits the field.
  const ownEarnedAllTime = Number(
    stats?.totalEarnedAllTime ??
      currentCommissionPool + Number(stats?.totalClaimed ?? 0),
  );
  // Sub-agents' lifetime commission, same ledger basis. Older API → derive it
  // from the legacy mixed-basis team total.
  const subAgentsEarnedAllTime = Number(
    stats?.subAgentsEarnedAllTime ??
      Number(stats?.totalTeamEarnings ?? currentCommissionPool) -
        currentCommissionPool,
  );
  const teamEarnedAllTime = ownEarnedAllTime + subAgentsEarnedAllTime;

  // Network Performance KPIs — standard agent-program metrics, aggregated
  // client-side from the per-referee economics the stats payload already
  // carries (totalBets / totalWagered / houseGgr / bonusGranted /
  // platformFees / refNetProfit).
  const network = useMemo(() => {
    const refs = stats?.referrals || [];
    const totalReferrals = refs.length;
    const activePlayers = refs.filter((r) => Number(r.totalBets || 0) > 0).length;
    const sum = (pick: (r: (typeof refs)[number]) => number) =>
      refs.reduce((acc, r) => acc + (Number(pick(r)) || 0), 0);
    const totalWagered = sum((r) => r.totalWagered || 0);
    // Ledger GGR (ggrDisplay = SUM(−netProfit) over commission rows), NOT
    // houseGgr from the raw gameplay logs. The two disagree exactly when a
    // player stakes bonus money: the gameplay log books a bonus-funded loss as
    // house profit, but the platform only recovered its own grant — the ledger
    // records GGR 0 for that play. Using houseGgr made this tile say 10.00
    // while the Recent Referrals GGR column below it said 0.00 for the same
    // (bonus-only) play. houseGgr stays in use for the WIN/LOSS column only.
    const teamGgr = sum((r) => r.ggrDisplay ?? r.houseGgr ?? 0);
    const bonusCosts = sum((r) => r.bonusGranted || 0);
    const platformFees = sum((r) => r.platformFees || 0);
    const netProfit = sum((r) => r.refNetProfit || 0);
    const conversion = totalReferrals > 0 ? (activePlayers / totalReferrals) * 100 : 0;
    return { activePlayers, totalReferrals, conversion, totalWagered, teamGgr, bonusCosts, platformFees, netProfit };
  }, [stats?.referrals]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-36 bg-[#191D24]/40 rounded-3xl border border-white/5 animate-pulse shadow-2xl"
          />
        ))}
      </div>
    );
  }

  const statItems = [
    {
      title: isSubAgent ? "Total Earnings" : "Total Team Earnings",
      // Floored at zero (QA #40): a clawback carry (referees net-winning) can
      // push the ledger sum negative. With the negative-balance allowance
      // removed, earnings tiles never present debt — the wallet still nets the
      // carry against future commission internally.
      value: Math.max(0, isSubAgent ? ownEarnedAllTime : teamEarnedAllTime),
      label: "Gross Revenue",
      icon: TrendingUp,
      hex: "#22C55E",
      color: "from-green-400 to-emerald-600",
      accent: "text-emerald-400",
      shadow: "shadow-emerald-500/20",
      // Both halves are ledger sums now, so the breakdown actually adds up to
      // the tile above it (it used to subtract a wallet balance from a
      // wallet+ledger total and call the remainder "sub-agents").
      breakdown: isSubAgent
        ? undefined
        : {
            agentOwn: Math.max(0, ownEarnedAllTime),
            subAgents: Math.max(0, subAgentsEarnedAllTime),
          },
    },
    {
      title: "Withdrawable",
      value: stats?.availableBalance ?? stats?.pendingIncome ?? 0,
      label: "Ready to Claim",
      icon: Wallet,
      hex: "#F59E0B",
      color: "from-amber-300 to-orange-500",
      accent: "text-orange-400",
      shadow: "shadow-orange-500/20",
      hasClaim: true,
    },
    {
      title: isSubAgent ? "Total Claimed" : "Locked Payouts",
      value: isSubAgent ? (stats?.totalClaimed || 0) : (stats?.lockedIncome ?? stats?.frozenBalance ?? 0),
      label: isSubAgent ? "Withdrawn funds" : `${stats?.payoutLockDays ?? 0}-Day Lock-in · Auto-releases`,
      icon: Award,
      hex: "#6366F1",
      color: "from-purple-400 to-indigo-600",
      accent: "text-indigo-400",
      shadow: "shadow-indigo-500/20",
    },
    {
      title: "Total Referrals",
      value: stats?.totalReferrals || 0,
      label: "Active Network",
      icon: Users,
      hex: "#06B6D4",
      color: "from-blue-400 to-cyan-600",
      accent: "text-cyan-400",
      shadow: "shadow-cyan-500/20",
      unit: "Players",
    },
  ];


  const formatCompact = (v: number) =>
    Math.abs(v) >= 1_000_000
      ? `${(v / 1_000_000).toFixed(2)}M`
      : Math.abs(v) >= 10_000
        ? `${(v / 1_000).toFixed(1)}K`
        : v.toFixed(2);

  const performanceItems = [
    {
      title: "Active Players",
      icon: Activity,
      hex: "#06B6D4",
      value: `${network.activePlayers}`,
      badge: `of ${network.totalReferrals}`,
      sub: `${network.conversion.toFixed(0)}% conversion`,
      accent: "text-cyan-400",
      chip: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
      bar: "from-cyan-500/60",
    },
    {
      title: "Total Wagered",
      icon: Coins,
      hex: "#B93DEB",
      value: formatCompact(network.totalWagered),
      sub: "All settled bets · network",
      accent: "text-white",
      chip: "bg-purple-500/10 border-purple-500/20 text-purple-400",
      bar: "from-purple-500/60",
    },
    {
      title: "Team GGR",
      icon: Landmark,
      hex: network.teamGgr >= 0 ? "#22C55E" : "#EF4444",
      value: formatCompact(network.teamGgr),
      sub: "House result · your players",
      accent: network.teamGgr >= 0 ? "text-emerald-400" : "text-red-400",
      chip:
        network.teamGgr >= 0
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          : "bg-red-500/10 border-red-500/20 text-red-400",
      bar: network.teamGgr >= 0 ? "from-emerald-500/60" : "from-red-500/60",
    },
    {
      title: "Costs",
      icon: ReceiptText,
      hex: "#F97316",
      value: formatCompact(network.bonusCosts + network.platformFees),
      sub: `${formatCompact(network.bonusCosts)} bonus · ${formatCompact(network.platformFees)} fees`,
      accent: "text-orange-400",
      chip: "bg-orange-500/10 border-orange-500/20 text-orange-400",
      bar: "from-orange-500/60",
    },
    {
      title: "Commission",
      icon: Scale,
      hex: network.netProfit >= 0 ? "#22C55E" : "#EF4444",
      value: formatCompact(network.netProfit),
      sub: "GGR × rate, net of fees",
      accent: network.netProfit >= 0 ? "text-emerald-400" : "text-red-400",
      chip:
        network.netProfit >= 0
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          : "bg-red-500/10 border-red-500/20 text-red-400",
      bar: network.netProfit >= 0 ? "from-emerald-500/60" : "from-red-500/60",
    },
  ];

  return (
    /* Card + section styling mirrors the admin dashboard KPI grid:
       label top-left, tinted icon chip top-right, value, accent bar. */
    <div className="bg-[#171B23] rounded-xl border border-[#1F242D] p-2 sm:p-3 w-full">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        Financial Summary
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
        {statItems.map((item, index) => {
          const isNegative = typeof item.value === "number" && item.value < 0;
          const displayValue =
            typeof item.value === "number"
              ? item.unit === "Players"
                ? item.value.toString()
                : item.value.toFixed(2)
              : item.value;
          const hasBreakdown = item.title.includes("Earnings") && item.breakdown;

          return (
            <div
              key={index}
              style={{ animationDelay: `${index * 45}ms` }}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-white/5 bg-[#1A2027] p-3 sm:p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/10 hover:bg-[#1E252E] hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)] animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
            >
              <div className="flex items-start justify-between gap-2">
                {/* min-w-0 is load-bearing: without it this flex item keeps its
                    auto min-width, the inner `truncate` never engages, and a long
                    title like "TOTAL TEAM EARNINGS" pushes the icon chip past the
                    card's right edge where overflow-hidden clips it. */}
                <p className="flex min-w-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  <span className="truncate">{item.title}</span>
                  {hasBreakdown && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsBreakdownOpen(!isBreakdownOpen);
                      }}
                      className="shrink-0 text-gray-600 transition-colors hover:text-white"
                    >
                      <ChevronDown
                        size={12}
                        className={`transition-transform duration-500 ${isBreakdownOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                  )}
                </p>
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110"
                  style={{ background: `${item.hex}22`, color: item.hex }}
                >
                  <item.icon size={16} />
                </span>
              </div>

              <p
                className={`mt-2 text-lg sm:text-[22px] font-bold leading-none tracking-tight ${
                  isNegative ? "text-red-400" : "text-white"
                }`}
              >
                {displayValue}
              </p>

              <p className="mt-1.5 truncate text-[10px] text-gray-500" title={item.label}>
                {item.label}
              </p>

              {/* Always-visible split so "team gross" isn't mistaken for cash */}
              {hasBreakdown && (
                <p className="mt-1 text-[10px] font-semibold">
                  <span className="text-gray-300">
                    You {Number(item.breakdown?.agentOwn ?? 0).toFixed(2)}
                  </span>
                  <span className="text-gray-600"> · </span>
                  <span className="text-purple-400">
                    Sub {Number(item.breakdown?.subAgents ?? 0).toFixed(2)}
                  </span>
                </p>
              )}

              {(isBreakdownOpen && hasBreakdown) ||
              (item.hasClaim && stats && stats.pendingIncome > 0) ? (
                <div className="mt-3 w-full animate-in fade-in slide-in-from-top-2 duration-300">
                  {hasBreakdown && isBreakdownOpen && (
                    <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/5 bg-black/40 p-2.5">
                      <div className="flex flex-col">
                        <span className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          My Income
                        </span>
                        <span className="text-[12px] font-bold leading-none text-white">
                          {Number(item.breakdown?.agentOwn).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex flex-col border-l border-white/10 pl-2.5">
                        <span className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          Sub-Agents
                        </span>
                        <span className="text-[12px] font-bold leading-none text-purple-400">
                          {Number(item.breakdown?.subAgents).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  {item.hasClaim && stats && stats.pendingIncome > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onClaim?.();
                      }}
                      disabled={isClaiming}
                      className="w-full rounded-lg bg-[#B93DEB] py-2 text-[10px] font-bold uppercase tracking-wider text-white transition-all hover:bg-[#a132d1] active:scale-[0.98] disabled:opacity-50"
                    >
                      {isClaiming ? "Processing" : "Claim Commission"}
                    </button>
                  )}
                </div>
              ) : null}

              <span
                className="absolute bottom-0 left-0 h-[3px] w-full opacity-80 transition-all group-hover:h-[4px] group-hover:opacity-100"
                style={{ background: item.hex }}
              />
            </div>
          );
        })}
      </div>

      {/* NETWORK PERFORMANCE — standard agent-program KPIs */}
      <p className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        Network Performance
      </p>
      {/* Five tiles in two columns leaves the last one alone on its own row with
          a dead half-row beside it. Spanning it fills the row; the override is
          dropped from `sm` up, where the column count changes, so desktop is
          untouched. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2 sm:gap-3 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
        {performanceItems.map((item, index) => (
          <div
            key={item.title}
            style={{ animationDelay: `${index * 45}ms` }}
            className="group relative flex flex-col overflow-hidden rounded-xl border border-white/5 bg-[#1A2027] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/10 hover:bg-[#1E252E] hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)] animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="flex min-w-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                <span className="truncate">{item.title}</span>
                {item.badge && (
                  <span className="shrink-0 rounded-full border border-white/5 bg-white/5 px-1.5 py-0.5 text-[11px] text-gray-500">
                    {item.badge}
                  </span>
                )}
              </p>
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110"
                style={{ background: `${item.hex}22`, color: item.hex }}
              >
                <item.icon size={16} />
              </span>
            </div>

            <p className={`mt-2 text-lg sm:text-[22px] font-bold leading-none tracking-tight ${item.accent}`}>
              {item.value}
            </p>

            <p className="mt-1.5 truncate text-[10px] text-gray-500" title={item.sub}>
              {item.sub}
            </p>

            <span
              className="absolute bottom-0 left-0 h-[3px] w-full opacity-80 transition-all group-hover:h-[4px] group-hover:opacity-100"
              style={{ background: item.hex }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
