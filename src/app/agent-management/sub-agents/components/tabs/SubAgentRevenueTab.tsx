"use client";

import { useState, useEffect, useCallback } from "react";
import NoData from "@/components/NoData";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, TrendingUp, Clock, CheckCircle2 } from "lucide-react";

import { profileApi } from "@/api/users/users";
import { ReferralStats } from "@/types/profile.type";

type Accent = "purple" | "green" | "orange" | "blue";

const ACCENT: Record<Accent, { text: string; icon: string; border: string }> = {
  purple: {
    text: "text-purple-400",
    icon: "bg-purple-500/10 text-purple-400",
    border: "hover:border-purple-500/30",
  },
  green: {
    text: "text-green-400",
    icon: "bg-green-500/10 text-green-400",
    border: "hover:border-green-500/30",
  },
  orange: {
    text: "text-orange-400",
    icon: "bg-orange-500/10 text-orange-400",
    border: "hover:border-orange-500/30",
  },
  blue: {
    text: "text-blue-400",
    icon: "bg-blue-500/10 text-blue-400",
    border: "hover:border-blue-500/30",
  },
};

interface StatCardProps {
  title: string;
  value: string;
  sub?: string;
  hint?: string;
  accent: Accent;
  icon: React.ElementType;
}

function StatCard({ title, value, sub, hint, accent, icon: Icon }: StatCardProps) {
  const tone = ACCENT[accent];
  return (
    <div
      className={`bg-[#15181E] rounded-2xl p-5 border border-gray-800/60 ${tone.border} transition-colors flex flex-col gap-3`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${tone.icon}`}>
          <Icon size={17} />
        </div>
        {sub && (
          <span className="text-gray-500 text-[9px] font-bold bg-gray-800/50 px-2 py-1 rounded-md uppercase tracking-wider">
            {sub}
          </span>
        )}
      </div>

      <div>
        <p className="text-gray-500 text-[11px] font-bold uppercase tracking-widest">
          {title}
        </p>
        <p className={`${tone.text} text-2xl font-black tracking-tight mt-1`}>
          {value}
        </p>
        {hint && <p className="text-gray-600 text-[11px] mt-1">{hint}</p>}
      </div>
    </div>
  );
}

interface SubAgentRevenueTabProps {
  subAgentId: string;
}

export default function SubAgentRevenueTab({ subAgentId }: SubAgentRevenueTabProps) {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
        setLoading(true);
        const res = await profileApi.getAgentReferralStatsById(subAgentId);
        setStats(res.data);
    } catch (err) {
        console.error("Failed to fetch sub-agent revenue stats:", err);
    } finally {
        setLoading(false);
    }
  }, [subAgentId]);

  useEffect(() => {
    if (!subAgentId) return;
    fetchStats();
  }, [subAgentId, fetchStats]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={`revenue-skeleton-${i}`}
              className="bg-[#15181E] rounded-2xl p-5 space-y-3 border border-gray-800/60"
            >
              <Skeleton className="h-9 w-9 rounded-xl bg-gray-700/40" />
              <Skeleton className="h-3 w-28 bg-gray-700/40" />
              <Skeleton className="h-7 w-24 bg-gray-700/40" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return <NoData title="No revenue data found" />;

  // `totalEarnedAllTime` (commission ledger), not `totalEarnings` (affiliate
  // wallet balance) — the wallet and the ledger are separate systems that do
  // not reconcile, so reading the wallet here made this tab disagree with the
  // Downline tab and the sub-agent listing for the same sub-agent.
  const totalEarnings = stats.totalEarnedAllTime ?? stats.totalEarnings ?? 0;
  // Wallet withdrawable, matching the header tile, the Wallet tab and the
  // listing column of the same name. This card used to show the ledger's
  // `pendingIncome`, which is a different bucket and read differently here than
  // the same sub-agent's "Available Balance" everywhere else.
  const availableBalance = stats.availableBalance || 0;
  const totalClaimed = stats.totalClaimed || 0;
  // Share of lifetime earnings already paid out — puts the claimed figure in context.
  const claimedShare =
    totalEarnings > 0 ? Math.min(100, (totalClaimed / totalEarnings) * 100) : 0;

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Downline Players"
          value={stats.totalReferrals?.toString() || "0"}
          accent="purple"
          icon={Users}
        />
        <StatCard
          title="Total Earnings"
          value={totalEarnings.toFixed(2)}
          sub="All time"
          accent="green"
          icon={TrendingUp}
        />
        <StatCard
          title="Available Balance"
          value={availableBalance.toFixed(2)}
          sub="Claimable"
          accent="orange"
          icon={Clock}
        />
        <StatCard
          title="Total Claimed"
          value={totalClaimed.toFixed(2)}
          hint={
            totalEarnings > 0
              ? `${claimedShare.toFixed(0)}% of lifetime earnings`
              : undefined
          }
          accent="blue"
          icon={CheckCircle2}
        />
      </div>

    </div>
  );
}
