"use client";

import {
  Activity,
  Banknote,
  Dices,
  Gift,
  ThumbsDown,
  Trophy,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { PlayerPerformanceSummary } from "@/api/player-performance/player-performance.api";
import type { ReportCurrency } from "@/api/reports/reports";
import CopyValueButton from "./CopyValueButton";
import { fmtAmount, fmtCount, fmtUsd, playerIdentity } from "./columns";

type LeaderKey = keyof PlayerPerformanceSummary["leaders"];

const LEADERS: {
  key: LeaderKey;
  label: string;
  icon: LucideIcon;
  kind: "usd" | "count" | "amount";
  unit: string;
}[] = [
  { key: "topDepositor", label: "Top Depositor", icon: Wallet, kind: "usd", unit: "deposited" },
  { key: "mostActive", label: "Most Active", icon: Activity, kind: "count", unit: "rounds" },
  { key: "topWagerer", label: "Highest Wagered", icon: Dices, kind: "amount", unit: "wagered" },
  { key: "biggestWinner", label: "Biggest Winner", icon: TrendingUp, kind: "amount", unit: "player P/L" },
  { key: "biggestLoser", label: "Biggest Loser", icon: TrendingDown, kind: "amount", unit: "GGR from player" },
  { key: "mostWins", label: "Most Wins", icon: Trophy, kind: "count", unit: "rounds won" },
  { key: "mostLosses", label: "Most Losses", icon: ThumbsDown, kind: "count", unit: "rounds lost" },
  { key: "topRedeemer", label: "Top Redeemer", icon: Banknote, kind: "usd", unit: "redeemed" },
  { key: "topReferrer", label: "Top Referrer", icon: Users, kind: "count", unit: "referrals" },
  { key: "topBonusReceiver", label: "Top Bonus Receiver", icon: Gift, kind: "amount", unit: "bonus" },
];

const shimmer = "animate-pulse rounded bg-[#242B35]";
const card = "relative min-w-0 rounded-xl border border-[#242B35] bg-[#191D24] p-4";

export default function LeaderCards({
  leaders,
  currency,
  skeleton,
  dimmed,
  onOpen,
}: {
  leaders: PlayerPerformanceSummary["leaders"] | null;
  currency: ReportCurrency;
  /** First load only: nothing to show yet. */
  skeleton: boolean;
  /** A refetch is replacing what is shown: keep it, but dimmed. */
  dimmed: boolean;
  onOpen: (userId: string) => void;
}) {
  return (
    <div
      aria-busy={skeleton || dimmed}
      className={`grid grid-cols-1 gap-3 transition-opacity duration-200 sm:grid-cols-2 xl:grid-cols-5 ${
        dimmed ? "opacity-60" : "opacity-100"
      }`}
    >
      {LEADERS.map(({ key, label, icon: Icon, kind, unit }) => {
        const leader = leaders?.[key] ?? null;
        const header = (
          <div className="mb-3 flex items-start justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-400">{label}</p>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#242B35] text-[#F59E0B]">
              <Icon size={15} />
            </div>
          </div>
        );

        if (skeleton) {
          return (
            <div key={key} className={card}>
              {header}
              <div className={`${shimmer} h-5 w-32`} />
              <div className={`${shimmer} mt-2 h-3.5 w-20`} />
            </div>
          );
        }

        if (!leader) {
          return (
            <div key={key} className={card}>
              {header}
              <p className="text-sm text-gray-600">No data</p>
            </div>
          );
        }

        const value =
          kind === "usd"
            ? fmtUsd(leader.value)
            : kind === "count"
              ? fmtCount(leader.value)
              : fmtAmount(leader.value, currency);
        const id = playerIdentity(leader);

        // The open button stretches over the whole card (its ::after), so the
        // card reads as one target; the copy buttons sit above it as siblings
        // rather than nesting interactive elements inside a button.
        return (
          <div
            key={key}
            className={`${card} group transition-colors hover:border-[#B93DEB]/60 hover:bg-[#1E2330]`}
          >
            {header}
            <div className="flex min-w-0 items-center gap-1">
              <button
                type="button"
                onClick={() => onOpen(leader.userId)}
                title={`Open ${id.primary}'s performance`}
                className="truncate text-left text-base font-semibold text-white after:absolute after:inset-0 after:rounded-xl after:content-[''] group-hover:text-[#B93DEB] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-[#B93DEB]"
              >
                {id.primary}
              </button>
              <CopyValueButton value={id.primary} what={id.kind} />
            </div>
            {id.kind !== "username" && (
              <div className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-gray-500">
                <span className="truncate">{leader.username}</span>
                <CopyValueButton value={leader.username} what="username" size={11} />
              </div>
            )}
            <p className="mt-1 truncate text-sm text-gray-300 tabular-nums">
              {value} <span className="text-xs text-gray-500">{unit}</span>
            </p>
          </div>
        );
      })}
    </div>
  );
}
