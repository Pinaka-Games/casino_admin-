"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import { Coins, Download, TrendingUp, Trophy, Users, Wallet } from "lucide-react";
import Pagination from "@/components/Pagination";
import { coingreen, coingold } from "@/assets/icons";
import { getRaceParticipants, getRaceStats } from "@/api/race/race.api";
import {
  Race,
  RaceCurrency,
  RaceParticipant,
  RaceStats,
} from "@/types/race";

const PAGE_SIZE = 10;

const CURRENCY_LABEL: Record<RaceCurrency, string> = {
  wulfCash: "Wulf Cash",
  wulfCoin: "Wulf Coin",
};

const coinIcon = (c: RaceCurrency) => (c === "wulfCoin" ? coingold : coingreen);
const fmt = (v: number) => Number(v || 0).toLocaleString();

// Quote a CSV cell if it contains a comma, quote, or newline.
const csvEscape = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

function StatCard({
  label,
  value,
  currency,
  icon,
  accent,
  loading,
}: {
  label: string;
  value: string;
  currency?: RaceCurrency;
  icon: React.ReactNode;
  accent: string;
  loading?: boolean;
}) {
  return (
    <div className="flex min-h-[110px] flex-col justify-between rounded-xl border border-[#2A2F3A]/50 bg-[#1D222B]/60 p-4">
      <div className="flex justify-between items-start">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</h3>
        <div className={`p-1.5 rounded-md ${accent}`}>{icon}</div>
      </div>
      {loading ? (
        <div className="h-7 w-20 bg-gray-700/40 rounded animate-pulse" />
      ) : (
        <div className="flex items-center gap-2">
          {currency && <Image src={coinIcon(currency)} alt="coin" width={18} height={18} />}
          <span className="text-2xl font-bold text-white leading-none">{value}</span>
        </div>
      )}
    </div>
  );
}

const ParticipantsSkeleton = () => (
  <>
    {[...Array(PAGE_SIZE)].map((_, i) => (
      <tr key={i} className="animate-pulse">
        <td className="px-5 py-3"><div className="h-3 w-6 bg-gray-700/40 rounded" /></td>
        <td className="px-5 py-3"><div className="h-3 w-32 bg-gray-700/40 rounded" /></td>
        <td className="px-5 py-3"><div className="h-3 w-40 bg-gray-700/30 rounded" /></td>
        <td className="px-5 py-3"><div className="h-3 w-10 bg-gray-700/40 rounded mx-auto" /></td>
        <td className="px-5 py-3"><div className="h-3 w-16 bg-gray-700/40 rounded" /></td>
        <td className="px-5 py-3"><div className="h-3 w-16 bg-gray-700/40 rounded" /></td>
        <td className="px-5 py-3"><div className="h-3 w-28 bg-gray-700/40 rounded" /></td>
      </tr>
    ))}
  </>
);

export default function RaceDetailView({ race }: { race: Race }) {
  const [stats, setStats] = useState<RaceStats | null>(null);
  const [participants, setParticipants] = useState<RaceParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  // Export ALL participants matching the current search (not just this page).
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const all = await getRaceParticipants(race.id, 1, 100000, search.trim());
      const items = all.items ?? [];
      if (!items.length) {
        toast.error("No participants to export");
        return;
      }
      const headers = [
        "Rank",
        "Username",
        "Email",
        "Phone",
        "Score",
        "Entry Spent",
        "Currency",
        "Reward",
        "Reward Paid",
        "Joined",
      ];
      const rows = items.map((p, i) =>
        [
          p.finalRank ?? i + 1,
          p.name,
          p.email ?? "",
          p.phone ?? "",
          p.score,
          p.entrySpent,
          CURRENCY_LABEL[p.entryCurrency],
          p.rewardAmount ?? "",
          p.rewardDistributed ? "Yes" : "No",
          formatDateTime(p.joinedAt),
        ]
          .map(csvEscape)
          .join(","),
      );
      const csv = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `race_${race.name.replace(/\s+/g, "_")}_participants.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [s, p] = await Promise.all([
          getRaceStats(race.id),
          getRaceParticipants(race.id, page, PAGE_SIZE, search.trim()),
        ]);
        if (!active) return;
        setStats(s);
        setParticipants(p.items);
        setTotalPages(p.totalPages || 1);
      } catch {
        if (active) toast.error("Failed to load race details");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [race.id, page, search]);

  const currency = race.entryCurrency;

  return (
    <div className="flex-1 overflow-y-auto space-y-5 pr-1">
      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <StatCard
          label="Participants"
          value={fmt(stats?.participantCount ?? 0)}
          icon={<Users size={14} />}
          accent="text-blue-500 bg-blue-500/10"
          loading={loading}
        />
        <StatCard
          label="Entry Fee"
          value={fmt(stats?.entryFee ?? Number(race.entryFee))}
          currency={currency}
          icon={<Coins size={14} />}
          accent="text-gray-300 bg-gray-500/10"
          loading={loading}
        />
        <StatCard
          label="Entry Collected"
          value={fmt(stats?.totalEntryCollected ?? 0)}
          currency={currency}
          icon={<Wallet size={14} />}
          accent="text-green-500 bg-green-500/10"
          loading={loading}
        />
        <StatCard
          label="Prizes Paid"
          value={fmt(stats?.totalPrizeDistributed ?? 0)}
          currency={currency}
          icon={<Trophy size={14} />}
          accent="text-yellow-500 bg-yellow-500/10"
          loading={loading}
        />
        <StatCard
          label="Net Revenue"
          value={fmt(stats?.netRevenue ?? 0)}
          currency={currency}
          icon={<TrendingUp size={14} />}
          accent="text-[#C56CFF] bg-[#C56CFF]/10"
          loading={loading}
        />
      </div>

      {/* PARTICIPANTS */}
      <div className="rounded-xl border border-[#2A2F3A]/50 bg-[#1D222B]/40 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#2A2F3A]/50">
          <h2 className="text-sm font-semibold text-white">Participants</h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search by username or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-64 bg-[#15181E] border border-[#2A2F3A]/50 rounded-lg px-3 py-1.5 text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-[#C56CFF]/50"
            />
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              title="Export participants to CSV"
              className="flex items-center gap-1.5 rounded-lg border border-[#2A2F3A]/80 bg-[#15181E] px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-[#2A2F3A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Download size={14} />
              {exporting ? "Exporting…" : "Export"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[960px]">
            <thead>
              <tr className="bg-[#15181E]/60 border-b border-[#2A2F3A]/50">
                <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Rank</th>
                <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Participant</th>
                <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Email</th>
                <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Score</th>
                <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Entry Spent</th>
                <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reward</th>
                <th className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2F3A]/30">
              {loading ? (
                <ParticipantsSkeleton />
              ) : participants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-500">
                    No participants yet
                  </td>
                </tr>
              ) : (
                participants.map((p, idx) => (
                  <tr key={p.userId} className="hover:bg-[#1A1F28]/60 transition-colors">
                    <td className="px-5 py-3">
                      <span className="text-sm font-bold text-gray-100">
                        {p.finalRank ?? (page - 1) * PAGE_SIZE + idx + 1}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-sm text-gray-100 truncate max-w-[220px]">{p.name}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-gray-400 truncate max-w-[220px]">{p.email ?? "—"}</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="text-sm font-bold text-white">{fmt(p.score)}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <Image src={coinIcon(p.entryCurrency)} alt="coin" width={15} height={15} />
                        <span className="text-sm text-gray-200">{fmt(p.entrySpent)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {p.rewardAmount && p.rewardCurrency ? (
                        <div className="flex items-center gap-1.5">
                          <Image src={coinIcon(p.rewardCurrency)} alt="coin" width={15} height={15} />
                          <span className="text-sm font-bold text-yellow-500">{fmt(p.rewardAmount)}</span>
                          {p.rewardDistributed && (
                            <span className="text-[9px] uppercase text-green-500 border border-green-500/30 bg-green-500/10 rounded px-1.5 py-0.5">
                              Paid
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400">{formatDateTime(p.joinedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 px-4 pb-4">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-500">
        Entry collected = entry fee × participants. Net revenue = entry collected − prizes paid, in{" "}
        {CURRENCY_LABEL[currency]}.
      </p>
    </div>
  );
}
