"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import { coingreen, coingold } from "@/assets/icons";
import {
  Check,
  ChevronDown,
  Flag,
  MonitorPlay,
  MoreVertical,
  PlayCircle,
  Search,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Pagination from "@/components/Pagination";
import {
  archiveRace,
  createRace,
  deleteRace,
  getAdminRaces,
  pauseRace,
  resumeRace,
  settleRace,
  updateRace,
} from "@/api/race/race.api";
import {
  Race,
  RaceCurrency,
  RaceStatus,
  UpsertRaceDto,
} from "@/types/race";
import { useRouter } from "next/navigation";
import RaceModal, { RaceFormData } from "./components/RaceModal";
import RacePrizesModal from "./components/RacePrizesModal";

const PAGE_SIZE = 10;

const CURRENCY_LABEL: Record<RaceCurrency, string> = {
  wulfCash: "Wulf Cash",
  wulfCoin: "Wulf Coin",
};

const getApiMessage = (error: unknown, fallback: string) => {
  const response = (error as { response?: { data?: { message?: string | string[] } } })?.response;
  const message = response?.data?.message;
  if (Array.isArray(message)) return message.join(", ");
  return message || fallback;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatNumber = (value: number) => Number(value || 0).toLocaleString();

const RaceTableSkeleton = () => (
  <>
    {[...Array(PAGE_SIZE)].map((_, i) => (
      <tr key={i} className="animate-pulse border-b border-[#2A2F3A]/30">
        <td className="px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded bg-gray-700/40 flex-shrink-0" />
            <div className="flex flex-col gap-2">
              <div className="h-3 w-32 bg-gray-700/40 rounded" />
              <div className="h-2.5 w-24 bg-gray-700/30 rounded" />
            </div>
          </div>
        </td>
        <td className="px-5 py-4"><div className="h-3 w-16 bg-gray-700/40 rounded" /></td>
        <td className="px-5 py-4"><div className="h-3 w-10 bg-gray-700/40 rounded mx-auto" /></td>
        <td className="px-5 py-4"><div className="h-3 w-14 bg-gray-700/40 rounded mx-auto" /></td>
        <td className="px-5 py-4"><div className="h-5 w-20 bg-gray-700/40 rounded mx-auto" /></td>
        <td className="px-5 py-4"><div className="h-3 w-14 bg-gray-700/40 rounded mx-auto" /></td>
        <td className="px-5 py-4"><div className="h-3 w-24 bg-gray-700/40 rounded" /></td>
        <td className="px-5 py-4"><div className="h-3 w-full bg-gray-700/40 rounded" /></td>
        <td className="px-5 py-4"><div className="h-8 w-8 bg-gray-700/40 rounded-lg mx-auto" /></td>
      </tr>
    ))}
  </>
);

// Time-elapsed progress between start and end, clamped 0-100.
const raceProgress = (race: Race): number => {
  if (race.status === "COMPLETED") return 100;
  if (!race.startAt || !race.endAt) return 0;
  const start = new Date(race.startAt).getTime();
  const end = new Date(race.endAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  const now = Date.now();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
};

type DisplayStatus = RaceStatus | "UPCOMING" | "SETTLING";

// Derived display status: SETTLING while a payout job is queued; UPCOMING when
// an ACTIVE race's start is still in the future. Stored status is unchanged.
const displayStatus = (race: Race): DisplayStatus => {
  if (race.isSettling && race.status !== "COMPLETED") return "SETTLING";
  if (race.status === "ACTIVE" && race.startAt && new Date(race.startAt).getTime() > Date.now()) {
    return "UPCOMING";
  }
  return race.status;
};

const statusToBadge = (status: DisplayStatus) => {
  const base =
    "inline-flex px-3 py-1 rounded border text-[10px] font-bold uppercase tracking-wider";
  switch (status) {
    case "COMPLETED":
      return `${base} border-[#C56CFF]/30 text-[#C56CFF] bg-[#C56CFF]/10`;
    case "PAUSED":
      return `${base} border-yellow-500/30 text-yellow-500 bg-yellow-500/10`;
    case "UPCOMING":
      return `${base} border-sky-500/30 text-sky-400 bg-sky-500/10`;
    case "ENDED":
      return `${base} border-gray-500/30 text-gray-300 bg-gray-500/10`;
    case "SETTLING":
      return `${base} border-orange-500/30 text-orange-400 bg-orange-500/10 animate-pulse`;
    default:
      return `${base} border-green-500/30 text-green-500 bg-green-500/10`;
  }
};

const mapRacePayload = (data: RaceFormData): UpsertRaceDto => ({
  name: data.name.trim() || "Untitled Race",
  description: data.description?.trim() || undefined,
  banner: data.banner?.trim() || undefined,
  status: data.status,
  startAt: data.startAt ? new Date(data.startAt).toISOString() : undefined,
  endAt: data.endAt ? new Date(data.endAt).toISOString() : undefined,
  autoEnroll: data.autoEnroll,
  entryFee: data.autoEnroll ? 0 : Number(data.entryFee || 0),
  entryCurrency: data.entryCurrency,
  maxParticipants:
    data.maxParticipants === "" ? undefined : Number(data.maxParticipants),
  scoringType: data.scoringType,
  // WulfCash prizes carry this playthrough; ignored for WulfCoin races.
  rolloverMultiplier:
    data.entryCurrency === "wulfCash" ? Number(data.rolloverMultiplier ?? 1) : 0,
  rolloverExpiryDays:
    data.entryCurrency === "wulfCash" && data.rolloverExpiryDays !== ""
      ? Number(data.rolloverExpiryDays)
      : null,
  prizeStructure: data.prizes.map((tier) => ({
    fromRank: tier.fromRank,
    toRank: tier.toRank,
    rewardAmount: Number(tier.rewardAmount || 0),
    // Prizes always pay out in the entry currency (server enforces this too).
    rewardCurrency: data.entryCurrency,
  })),
});

export default function RaceContestsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const router = useRouter();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [isPrizesOpen, setIsPrizesOpen] = useState(false);
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [races, setRaces] = useState<Race[]>([]);
  const [total, setTotal] = useState(0);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [confirmTarget, setConfirmTarget] = useState<{
    race: Race;
    mode: "archive" | "delete";
  } | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    const loadRaces = async () => {
      setIsLoading(true);
      try {
        const response = await getAdminRaces({
          page: pagination.page,
          limit: PAGE_SIZE,
          search: searchTerm.trim() || undefined,
          status:
            statusFilter === "All Statuses"
              ? undefined
              : (statusFilter.toUpperCase() as RaceStatus),
        });
        setRaces(response.items);
        setTotal(response.total);
        setPagination((prev) => ({ ...prev, totalPages: response.totalPages || 1 }));
      } catch (error: unknown) {
        toast.error(getApiMessage(error, "Failed to load races"));
      } finally {
        setIsLoading(false);
      }
    };
    void loadRaces();
  }, [pagination.page, searchTerm, statusFilter, reloadKey]);

  // Worker settle finished (or any race status change) → refetch the list.
  useEffect(() => {
    const onRaceRefresh = () => setReloadKey((v) => v + 1);
    window.addEventListener("race:refresh", onRaceRefresh);
    return () => window.removeEventListener("race:refresh", onRaceRefresh);
  }, []);

  const metrics = useMemo(() => {
    const active = races.filter((r) => r.status === "ACTIVE").length;
    const participants = races.reduce((sum, r) => sum + Number(r.totalParticipants || 0), 0);
    return { active, participants };
  }, [races]);

  const runLifecycleAction = async (
    race: Race,
    action: "pause" | "resume" | "settle",
  ) => {
    try {
      if (action === "pause") {
        await pauseRace(race.id);
        toast.success("Race paused");
      } else if (action === "resume") {
        await resumeRace(race.id);
        toast.success("Race resumed");
      } else {
        await settleRace(race.id);
        toast.success("Settlement queued — prizes are being distributed");
      }
      setReloadKey((v) => v + 1);
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Action failed"));
    }
  };

  // Hard delete is allowed only for a clean, never-started draft (no players).
  // Anything settled/ended/started or with participants must be archived to
  // keep its wallet/audit records intact — the backend enforces this too.
  const canHardDelete = (race: Race) => {
    const started =
      !!race.startAt && new Date(race.startAt).getTime() <= Date.now();
    return (
      (race.totalParticipants ?? 0) === 0 &&
      !race.isSettling &&
      race.status !== "COMPLETED" &&
      race.status !== "ENDED" &&
      !started
    );
  };

  const runRemoval = async () => {
    if (!confirmTarget) return;
    const { race, mode } = confirmTarget;
    setRemoving(true);
    try {
      if (mode === "delete") {
        await deleteRace(race.id);
        toast.success("Race deleted");
      } else {
        await archiveRace(race.id);
        toast.success("Race archived");
      }
      setReloadKey((v) => v + 1);
      setConfirmTarget(null);
    } catch (error: unknown) {
      toast.error(
        getApiMessage(error, mode === "delete" ? "Delete failed" : "Archive failed"),
      );
    } finally {
      setRemoving(false);
    }
  };

  const changePage = (page: number) => {
    const next = Math.max(1, Math.min(page, pagination.totalPages || 1));
    setPagination((prev) => ({ ...prev, page: next }));
  };

  const handleCreateOrEdit = async (data: RaceFormData) => {
    const payload = mapRacePayload(data);
    try {
      if (selectedRace && !isDuplicate) {
        await updateRace(selectedRace.id, payload);
        toast.success("Race updated successfully");
      } else {
        await createRace(payload);
        toast.success(isDuplicate ? "Race duplicated successfully" : "Race created successfully");
        setPagination((prev) => ({ ...prev, page: 1 }));
      }
      setReloadKey((v) => v + 1);
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to save race"));
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-[#0E1014] md:bg-[#15181E] p-3 md:p-6 overflow-x-hidden text-white font-sans">
      {/* HEADER BREADCRUMB */}
      <div className="bg-[#1D222B]/40 border border-[#2A2F3A]/30 mb-6 px-5 py-4 rounded-xl shadow-sm">
        <h1 className="text-white text-md">Games / Race Contests</h1>
      </div>

      {/* METRICS CARDS */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="flex min-h-[110px] min-w-0 flex-col justify-between rounded-xl border border-[#2A2F3A]/50 bg-[#1D222B]/60 p-4">
          <div className="flex justify-between items-start">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Total Races</h3>
            <div className="text-[#C56CFF] bg-[#C56CFF]/10 p-1.5 rounded-md">
              <Flag size={14} />
            </div>
          </div>
          <span className="text-3xl font-bold text-white leading-none">{formatNumber(total)}</span>
        </div>

        <div className="flex min-h-[110px] min-w-0 flex-col justify-between rounded-xl border border-[#2A2F3A]/50 bg-[#1D222B]/60 p-4">
          <div className="flex justify-between items-start">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Active Races</h3>
            <div className="text-green-500 bg-green-500/10 p-1.5 rounded-md">
              <Zap size={14} />
            </div>
          </div>
          <span className="text-3xl font-bold text-white leading-none">{formatNumber(metrics.active)}</span>
        </div>

        <div className="flex min-h-[110px] min-w-0 flex-col justify-between rounded-xl border border-[#2A2F3A]/50 bg-[#1D222B]/60 p-4">
          <div className="flex justify-between items-start">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Total Participants</h3>
            <div className="text-blue-500 bg-blue-500/10 p-1.5 rounded-md">
              <Users size={14} />
            </div>
          </div>
          <span className="text-3xl font-bold text-white leading-none">{formatNumber(metrics.participants)}</span>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-[#2A2F3A]/50 bg-[#1D222B]/60 px-4 py-3 mb-4 xl:grid-cols-[minmax(260px,1fr)_auto] xl:items-end">
        <div className="flex w-full min-w-0 items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
            <input
              type="text"
              placeholder="Search Race..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="w-full bg-[#15181E] border border-[#2A2F3A]/50 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-[#C56CFF]/50 transition-colors"
            />
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:justify-end">
          <div className="relative flex min-w-[150px] flex-1 flex-col sm:flex-none">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="w-full cursor-pointer appearance-none rounded-lg border border-[#2A2F3A]/50 bg-[#15181E] px-3 py-2 pr-9 text-sm text-gray-300 outline-none transition-colors hover:border-[#C56CFF]/40 focus:border-[#C56CFF]/50"
            >
              <option>All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="ENDED">Ended</option>
              <option value="COMPLETED">Completed</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>

          <div className="flex flex-col sm:ml-auto xl:ml-2">
            <button
              onClick={() => {
                setSelectedRace(null);
                setIsDuplicate(false);
                setIsEditOpen(true);
              }}
              className="flex min-w-[176px] items-center justify-center gap-2 px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm"
            >
              <PlayCircle size={16} /> NEW RACE
            </button>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-[#1D222B]/40 border border-[#2A2F3A]/50 rounded-xl overflow-hidden w-full">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-[#15181E]/60 border-b border-[#2A2F3A]/50">
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[280px]">Race Details</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Entry</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Participants</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Scoring</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Status</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Payout</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Prizes</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[230px]">Timeline</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center w-[80px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2F3A]/30">
              {isLoading ? (
                <RaceTableSkeleton />
              ) : races.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-gray-500">No races found</td>
                </tr>
              ) : (
                races.map((race) => (
                  <tr
                    key={race.id}
                    onClick={() => router.push(`/settings/race-contests/${race.id}`)}
                    className="hover:bg-[#1A1F28]/60 transition-colors group cursor-pointer"
                  >
                    {/* Race Details */}
                    <td className="px-5 py-4 align-top">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded bg-[#15181E] border border-[#2A2F3A]/60 flex items-center justify-center overflow-hidden flex-shrink-0 relative"
                          style={{
                            backgroundImage: race.banner ? `url(${race.banner})` : undefined,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }}
                        >
                          {!race.banner && (
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(197,108,255,0.35),_transparent_60%)] opacity-90" />
                          )}
                          <MonitorPlay size={20} className="text-white relative z-10 opacity-70" />
                        </div>
                        <div className="flex flex-col items-start min-w-0">
                          <span className="text-sm font-semibold text-gray-100 truncate w-full group-hover:text-[#C56CFF] transition-colors">
                            {race.name}
                          </span>
                          {race.description && (
                            <span className="mt-1 text-[11px] text-gray-500 truncate w-full max-w-[220px]">
                              {race.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Entry */}
                    <td className="px-5 py-4 align-top">
                      <div className="flex items-center gap-2">
                        <Image
                          src={race.entryCurrency === "wulfCoin" ? coingold : coingreen}
                          alt={CURRENCY_LABEL[race.entryCurrency]}
                          title={CURRENCY_LABEL[race.entryCurrency]}
                          width={18}
                          height={18}
                        />
                        <span className="text-sm font-bold text-gray-100">
                          {formatNumber(Number(race.entryFee))}
                        </span>
                      </div>
                      {race.autoEnroll && (
                        <span className="mt-1 inline-block rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                          Auto-Enroll
                        </span>
                      )}
                    </td>

                    {/* Participants */}
                    <td className="px-5 py-4 align-top text-center">
                      <span className="text-base font-bold text-white">
                        {formatNumber(Number(race.totalParticipants || 0))}
                      </span>
                      <span className="block text-[10px] text-gray-500 uppercase tracking-wider">
                        {race.maxParticipants ? `/ ${formatNumber(race.maxParticipants)}` : "Unlimited"}
                      </span>
                    </td>

                    {/* Scoring */}
                    <td className="px-5 py-4 align-top text-center">
                      <div className="flex items-center justify-center gap-1.5 text-xs text-gray-300">
                        <Zap size={12} className="text-yellow-500" />
                        <span className="font-bold">
                          {race.scoringType === "WINNING_BET" ? "Winning Bet" : "Valid Bet"}
                        </span>
                      </div>
                      <span className="block text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">
                        {race.scoringType === "WINNING_BET" ? "By winnings" : "By wagering"}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4 align-top text-center">
                      {(() => {
                        const ds = displayStatus(race);
                        return <span className={statusToBadge(ds)}>{ds}</span>;
                      })()}
                    </td>

                    {/* Payout */}
                    <td className="px-5 py-4 align-top text-center">
                      {race.status === "COMPLETED" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-500">
                          <Check size={13} /> Paid
                        </span>
                      ) : race.isSettling ? (
                        <span className="text-[11px] font-bold text-orange-400 animate-pulse">Settling…</span>
                      ) : race.status === "ENDED" ? (
                        <span className="text-[11px] font-bold text-amber-400">Pending</span>
                      ) : (
                        <span className="text-[11px] text-gray-600">—</span>
                      )}
                    </td>

                    {/* Prizes */}
                    <td className="px-5 py-4 align-top">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <Trophy size={14} className="text-yellow-500" />
                          <span className="text-sm font-bold text-gray-100">
                            {race.prizeStructure?.length || 0} Tier
                            {(race.prizeStructure?.length || 0) === 1 ? "" : "s"}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={!race.prizeStructure?.length}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRace(race);
                            setIsPrizesOpen(true);
                          }}
                          className="mt-1.5 whitespace-nowrap text-left text-xs text-[#C56CFF] font-medium hover:underline underline-offset-2 disabled:text-gray-600 disabled:no-underline disabled:cursor-not-allowed"
                        >
                          View Distribution
                        </button>
                      </div>
                    </td>

                    {/* Timeline & Progress */}
                    <td className="px-5 py-4 align-top">
                      {(() => {
                        const progress = raceProgress(race);
                        return (
                          <div className="flex flex-col h-full justify-center gap-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="whitespace-nowrap text-gray-200 font-medium">
                                End: {formatDateTime(race.endAt)}
                              </span>
                              <span className="text-red-500 font-bold">{progress}%</span>
                            </div>

                            {/* Progress Bar */}
                            <div className="h-1.5 w-full bg-[#15181E] rounded-full overflow-hidden border border-[#2A2F3A]/50">
                              {race.status === "COMPLETED" ? (
                                <div className="h-full bg-[#C56CFF] w-full" />
                              ) : (
                                <div
                                  className="h-full bg-red-500"
                                  style={{ width: `${progress}%` }}
                                />
                              )}
                            </div>

                            <div className="whitespace-nowrap text-[10px] text-gray-500 uppercase font-semibold tracking-wider mt-0.5">
                              STARTED: {formatDateTime(race.startAt)}
                            </div>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Actions */}
                    <td
                      className="px-5 py-4 align-top text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="w-8 h-8 rounded-lg bg-[#15181E] border border-[#2A2F3A]/80 hover:bg-[#2A2F3A] flex items-center justify-center text-gray-400 transition-colors">
                            <MoreVertical size={16} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[#1D222B] border border-[#2A2F3A] text-gray-200">
                          {race.status !== "COMPLETED" && (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedRace(race);
                                setIsDuplicate(false);
                                setIsEditOpen(true);
                              }}
                              className="hover:bg-[#2A2F3A] cursor-pointer"
                            >
                              Edit Race
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedRace(race);
                              setIsDuplicate(true);
                              setIsEditOpen(true);
                            }}
                            className="hover:bg-[#2A2F3A] cursor-pointer"
                          >
                            Duplicate Race
                          </DropdownMenuItem>

                          {race.status === "ACTIVE" && (
                            <DropdownMenuItem
                              onClick={() => void runLifecycleAction(race, "pause")}
                              className="hover:bg-[#2A2F3A] cursor-pointer text-yellow-400"
                            >
                              Pause Race
                            </DropdownMenuItem>
                          )}

                          {race.status === "PAUSED" && (
                            <DropdownMenuItem
                              onClick={() => void runLifecycleAction(race, "resume")}
                              className="hover:bg-[#2A2F3A] cursor-pointer text-green-400"
                            >
                              Resume Race
                            </DropdownMenuItem>
                          )}

                          {race.status === "ENDED" && race.isSettling && (
                            <DropdownMenuItem
                              disabled
                              className="cursor-not-allowed text-orange-400 opacity-80"
                            >
                              Settling…
                            </DropdownMenuItem>
                          )}

                          {race.status === "ENDED" && !race.isSettling && (
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                void runLifecycleAction(race, "settle");
                              }}
                              className="hover:bg-[#2A2F3A] cursor-pointer text-[#C56CFF] font-semibold"
                            >
                              Trigger Settle
                            </DropdownMenuItem>
                          )}

                          {/* Archive — safe for any non-settling race (keeps history) */}
                          {!race.isSettling && (
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                setConfirmTarget({ race, mode: "archive" });
                              }}
                              className="hover:bg-[#2A2F3A] cursor-pointer text-gray-300"
                            >
                              Archive Race
                            </DropdownMenuItem>
                          )}

                          {/* Delete — only a clean, never-started draft */}
                          {canHardDelete(race) && (
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                setConfirmTarget({ race, mode: "delete" });
                              }}
                              className="hover:bg-[#2A2F3A] cursor-pointer text-red-400 font-semibold"
                            >
                              Delete Race
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Pagination
          currentPage={pagination.page}
          totalPages={Math.max(1, pagination.totalPages)}
          onPageChange={changePage}
        />
      </div>

      {isEditOpen && (
        <RaceModal
          open={isEditOpen}
          initialData={selectedRace}
          isDuplicate={isDuplicate}
          onClose={() => {
            setIsEditOpen(false);
            setIsDuplicate(false);
          }}
          onSubmit={handleCreateOrEdit}
        />
      )}

      {isPrizesOpen && (
        <RacePrizesModal
          open={isPrizesOpen}
          race={selectedRace}
          onClose={() => setIsPrizesOpen(false)}
        />
      )}

      {/* Archive / Delete confirmation */}
      {confirmTarget && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => !removing && setConfirmTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-[#1A1E26] border border-[#2A2F3A] shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white">
              {confirmTarget.mode === "delete" ? "Delete this race?" : "Archive this race?"}
            </h3>
            <p className="mt-2 text-sm text-gray-400 leading-relaxed">
              {confirmTarget.mode === "delete" ? (
                <>
                  This permanently deletes{" "}
                  <span className="text-white font-semibold">{confirmTarget.race.name}</span>.
                  Allowed only because it has no participants and hasn&apos;t started.
                  This cannot be undone.
                </>
              ) : (
                <>
                  This hides{" "}
                  <span className="text-white font-semibold">{confirmTarget.race.name}</span>{" "}
                  from all lists but keeps its participant and payout history. You can
                  restore it later.
                </>
              )}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={removing}
                onClick={() => setConfirmTarget(null)}
                className="px-4 py-2 rounded-lg border border-[#2A2F3A] text-gray-300 hover:bg-[#242B35] text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removing}
                onClick={() => void runRemoval()}
                className={`px-4 py-2 rounded-lg text-white text-sm font-semibold transition-colors disabled:opacity-50 ${
                  confirmTarget.mode === "delete"
                    ? "bg-red-600 hover:bg-red-500"
                    : "bg-[#B93DEB] hover:bg-[#A030D0]"
                }`}
              >
                {removing
                  ? "Working…"
                  : confirmTarget.mode === "delete"
                    ? "Delete"
                    : "Archive"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
