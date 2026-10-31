"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  CalendarClock,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  Info,
  MonitorPlay,
  MoreVertical,
  PlayCircle,
  RefreshCw,
  Search,
  Ticket,
  Trophy,
  UserX,
  Users,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createRaffleCampaign,
  deleteRaffleCampaign,
  getAdminRaffleCampaigns,
  getRaffleCampaignParticipants,
  getRaffleCampaignWinners,
  updateRaffleCampaign,
} from "@/api/raffle/raffle.api";
import {
  RaffleCampaignListItem,
  RaffleOverview,
  RaffleParticipantsResponse,
  RaffleWinnersResponse,
  RaffleCampaignStatus,
  RaffleCampaignType,
  UpsertRaffleCampaignDto,
} from "@/types/raffle";
import EditCampaignModal from "./components/EditCampaignModal";
import DeleteCampaignModal from "./components/DeleteCampaignModal";
import PrizeBreakdownModal from "./components/PrizeBreakdownModal";
import CampaignParticipantsModal from "./components/CampaignParticipantsModal";
import RaffleWinnersModal from "./components/RaffleWinnersModal";
import WinnerAnnouncementInfoModal from "./components/WinnerAnnouncementInfoModal";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 10;

const DEFAULT_OVERVIEW: RaffleOverview = {
  operationalCampaigns: 0,
  concurrentCampaigns: 0,
  cumulativeCampaigns: 0,
  uniqueEntrantBase: 0,
  networkTicketVolume: 0,
  averageTicketsPerEntrant: 0,
  totalDistributedValue: 0,
};

const EMPTY_PARTICIPANTS: RaffleParticipantsResponse = {
  items: [],
  total: 0,
  page: 1,
  limit: PAGE_SIZE,
  totalPages: 1,
};

const EMPTY_WINNERS: RaffleWinnersResponse = { items: [] };

type CampaignFormPrize = {
  position?: string;
  name?: string;
  type?: string;
  value?: number | string;
  delivery?: string;
  wageringMultiplier?: number | string;
};

type CampaignFormData = {
  title?: string;
  description?: string;
  bannerImageUrl?: string;
  type?: string;
  status?: string;
  startDate?: string;
  drawDate?: string;
  wagering?: boolean;
  wagerAmount?: number | string;
  gamePlay?: boolean;
  purchase?: boolean;
  prizes?: CampaignFormPrize[];
  recurring?: boolean;
  showOnHomepage?: boolean;
  featured?: boolean;
  progressiveTickets?: boolean;
};

const getApiMessage = (error: unknown, fallback: string) => {
  const response = (error as { response?: { data?: { message?: string | string[] } } })?.response;
  const message = response?.data?.message;

  if (Array.isArray(message)) return message.join(", ");
  return message || fallback;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "Pending";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Pending";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatNumber = (value: number) => Number(value || 0).toLocaleString();

const statusToBadge = (status: RaffleCampaignStatus) => {
  if (status === "COMPLETED") {
    return "inline-flex px-3 py-1 rounded border border-[#C56CFF]/30 text-[#C56CFF] text-[10px] font-bold uppercase tracking-wider bg-[#C56CFF]/10";
  }
  if (status === "PAUSED") {
    return "inline-flex px-3 py-1 rounded border border-yellow-500/30 text-yellow-500 text-[10px] font-bold uppercase tracking-wider bg-yellow-500/10";
  }
  return "inline-flex px-3 py-1 rounded border border-green-500/30 text-green-500 text-[10px] font-bold uppercase tracking-wider bg-green-500/10";
};

/**
 * What the Winners column should show.
 *
 * Two cases that both used to render IN PROGRESS but are not:
 *  - a campaign whose draw ran against an empty pool is FINISHED, and no winner
 *    is ever coming;
 *  - a campaign whose start date is still in the future has not begun, so it is
 *    not collecting tickets yet either.
 */
const winnersStateOf = (
  campaign: RaffleCampaignListItem,
): "VIEW_WINNERS" | "NO_ENTRIES" | "SCHEDULED" | "IN_PROGRESS" => {
  if (campaign.actionState === "VIEW_WINNERS") return "VIEW_WINNERS";
  if (campaign.draw?.status === "NO_ENTRIES") return "NO_ENTRIES";
  if (campaign.status === "COMPLETED" && campaign.tickets === 0) return "NO_ENTRIES";

  const startsAt = campaign.startDate ? new Date(campaign.startDate).getTime() : null;
  if (startsAt !== null && !Number.isNaN(startsAt) && startsAt > Date.now()) {
    return "SCHEDULED";
  }

  return "IN_PROGRESS";
};

const mapCampaignPayload = (data: CampaignFormData): UpsertRaffleCampaignDto => ({
  title: data.title?.trim() || "Untitled Campaign",
  description: data.description?.trim() || undefined,
  bannerImageUrl: data.bannerImageUrl?.trim() || undefined,
  type: (data.type || "Weekly").toUpperCase() as RaffleCampaignType,
  status: (data.status || "Active").toUpperCase() as RaffleCampaignStatus,
  startDate: data.startDate ? new Date(data.startDate).toISOString() : undefined,
  drawDate: data.drawDate ? new Date(data.drawDate).toISOString() : undefined,
  wagering: Boolean(data.wagering),
  wagerAmount: Number(data.wagerAmount || 0),
  gamePlay: Boolean(data.gamePlay),
  purchase: Boolean(data.purchase),
  prizes: Array.isArray(data.prizes)
    ? data.prizes.map((prize, index) => ({
        position: prize.position || `#${index + 1}`,
        name: prize.name || `Prize ${index + 1}`,
        type: prize.type || "Wulf Cash",
        value: Number(prize.value || 0),
        delivery: prize.delivery || "Manual Contact",
        // Rebuilt field-by-field, so anything omitted here never reaches the
        // API: the multiplier the modal collected was silently dropped and
        // every prize saved as 0 (no rollover) however it was configured.
        wageringMultiplier: Math.max(0, Number(prize.wageringMultiplier || 0)),
      }))
    : [],
  recurring: Boolean(data.recurring),
  showOnHomepage: Boolean(data.showOnHomepage),
  featured: Boolean(data.featured),
  progressiveTickets: Boolean(data.progressiveTickets),
});

export default function RaffleCampaignsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isPrizeOpen, setIsPrizeOpen] = useState(false);
  const [isWinnersOpen, setIsWinnersOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isWinnerInfoOpen, setIsWinnerInfoOpen] = useState(false);

  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [winnersLoading, setWinnersLoading] = useState(false);

  const [selectedCampaign, setSelectedCampaign] = useState<RaffleCampaignListItem | null>(null);
  const [campaigns, setCampaigns] = useState<RaffleCampaignListItem[]>([]);
  const [overview, setOverview] = useState<RaffleOverview>(DEFAULT_OVERVIEW);
  const [participantsResponse, setParticipantsResponse] = useState<RaffleParticipantsResponse>(EMPTY_PARTICIPANTS);
  const [winnersResponse, setWinnersResponse] = useState<RaffleWinnersResponse>(EMPTY_WINNERS);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 1,
  });

  useEffect(() => {
    const refreshFromSocket = () => {
      setReloadKey((value) => value + 1);
    };

    window.addEventListener("raffle:ticket-updated", refreshFromSocket);
    window.addEventListener("raffle:draw-completed", refreshFromSocket);

    return () => {
      window.removeEventListener("raffle:ticket-updated", refreshFromSocket);
      window.removeEventListener("raffle:draw-completed", refreshFromSocket);
    };
  }, []);

  useEffect(() => {
    const loadCampaigns = async () => {
      setIsLoading(true);
      try {
        const response = await getAdminRaffleCampaigns({
          page: pagination.page,
          limit: PAGE_SIZE,
          search: searchTerm.trim() || undefined,
          status: statusFilter === "All Statuses" ? undefined : (statusFilter.toUpperCase() as RaffleCampaignStatus),
          type: typeFilter === "All Types" ? undefined : (typeFilter.toUpperCase() as RaffleCampaignType),
        });

        setCampaigns(response.items);
        setOverview(response.overview);
        setPagination((prev) => ({
          ...prev,
          totalPages: response.totalPages || 1,
        }));
      } catch (error: unknown) {
        toast.error(getApiMessage(error, "Failed to load jackpot campaigns"));
      } finally {
        setIsLoading(false);
      }
    };

    void loadCampaigns();
  }, [pagination.page, searchTerm, statusFilter, typeFilter, reloadKey]);

  const changePage = (page: number) => {
    const nextPage = Math.max(1, Math.min(page, pagination.totalPages || 1));
    setPagination((prev) => ({ ...prev, page: nextPage }));
  };

  const handleCreateOrEdit = async (data: CampaignFormData) => {
    const payload = mapCampaignPayload(data);

    try {
      if (selectedCampaign) {
        await updateRaffleCampaign(selectedCampaign.id, payload);
        toast.success("Campaign updated successfully");
      } else {
        await createRaffleCampaign(payload);
        toast.success("Campaign created successfully");
      }

      setReloadKey((value) => value + 1);
      if (!selectedCampaign) {
        setPagination((prev) => ({ ...prev, page: 1 }));
      }
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to save campaign"));
      throw error;
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedCampaign) return;

    try {
      await deleteRaffleCampaign(selectedCampaign.id);
      toast.success("Campaign deleted successfully");
      setIsDeleteOpen(false);
      setSelectedCampaign(null);
      setReloadKey((value) => value + 1);
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to delete campaign"));
    }
  };

  const openParticipants = async (campaign: RaffleCampaignListItem, page = 1) => {
    setSelectedCampaign(campaign);
    setIsParticipantsOpen(true);
    setParticipantsLoading(true);

    try {
      const response = await getRaffleCampaignParticipants(campaign.id, page, PAGE_SIZE);
      setParticipantsResponse(response);
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to load participants"));
      setParticipantsResponse(EMPTY_PARTICIPANTS);
    } finally {
      setParticipantsLoading(false);
    }
  };

  const openWinners = async (campaign: RaffleCampaignListItem) => {
    setSelectedCampaign(campaign);
    setIsWinnersOpen(true);
    setWinnersLoading(true);

    try {
      const response = await getRaffleCampaignWinners(campaign.id);
      setWinnersResponse(response);
    } catch (error: unknown) {
      toast.error(getApiMessage(error, "Failed to load winners"));
      setWinnersResponse(EMPTY_WINNERS);
    } finally {
      setWinnersLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0E1014] md:bg-[#15181E] p-3 md:p-6 overflow-x-hidden text-white font-sans">
      
      {/* HEADER BREADCRUMB */}
      <div className="bg-[#1D222B]/40 border border-[#2A2F3A]/30 mb-6 px-5 py-4 rounded-xl shadow-sm flex items-center justify-between gap-4">
        <h1 className="text-white text-md ">
          Games / Jackpot Management
        </h1>
        <button
          onClick={() => setIsWinnerInfoOpen(true)}
          title="How winners are announced"
          className="flex items-center gap-2 rounded-lg border border-[#2A2F3A]/80 bg-[#15181E] px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:border-[#C56CFF]/40 hover:text-[#C56CFF]"
        >
          <Info size={14} /> How winners are announced
        </button>
      </div>

      {/* METRICS CARDS */}
      <div className="grid grid-cols-2 gap-3 mb-4 md:grid-cols-4 md:mb-6">
        {/* Card 1 */}
        <div className="flex min-h-[124px] md:min-h-[150px] min-w-0 flex-col rounded-xl border border-[#2A2F3A]/50 bg-[#1D222B]/60 p-3 md:p-4">
          <div className="flex justify-between items-start mb-2">
            <h3 className="min-w-0 pr-2 text-[11px] font-bold uppercase leading-4 tracking-wide text-gray-400">Operational Campaigns</h3>
            <div className="shrink-0 text-green-500 bg-green-500/10 p-1.5 rounded-md">
              <RefreshCw size={14} />
            </div>
          </div>
          <div className="flex items-end gap-3 mb-1">
            <span className="whitespace-nowrap text-2xl md:text-3xl font-bold text-white leading-none">{formatNumber(overview.operationalCampaigns)}</span>
          </div>
          <div className="mt-auto flex min-w-0 items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs text-gray-500">{overview.concurrentCampaigns} Concurrent / {overview.cumulativeCampaigns} Cumulative</p>
            <span className="inline-flex shrink-0 items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-[10px] font-bold tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              ACTIVE
            </span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="flex min-h-[124px] md:min-h-[150px] min-w-0 flex-col rounded-xl border border-[#2A2F3A]/50 bg-[#1D222B]/60 p-3 md:p-4">
          <div className="flex justify-between items-start mb-2">
            <h3 className="min-w-0 pr-2 text-[11px] font-bold uppercase leading-4 tracking-wide text-gray-400">Unique Entrant Base</h3>
            <div className="shrink-0 text-blue-500 bg-blue-500/10 p-1.5 rounded-md">
              <Users size={14} />
            </div>
          </div>
          <div className="flex items-end gap-3 mb-1">
            <span className="whitespace-nowrap text-2xl md:text-3xl font-bold text-white leading-none">{formatNumber(overview.uniqueEntrantBase)}</span>
          </div>
          <div className="mt-auto flex min-w-0 items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs text-gray-500">Unique Network Reach</p>
            <span className="shrink-0 text-xs font-semibold text-blue-400">Real-time</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="flex min-h-[124px] md:min-h-[150px] min-w-0 flex-col rounded-xl border border-[#2A2F3A]/50 bg-[#1D222B]/60 p-3 md:p-4">
          <div className="flex justify-between items-start mb-2">
            <h3 className="min-w-0 pr-2 text-[11px] font-bold uppercase leading-4 tracking-wide text-gray-400">Network Ticket Volume</h3>
            <div className="shrink-0 text-orange-500 bg-orange-500/10 p-1.5 rounded-md">
              <Ticket size={14} />
            </div>
          </div>
          <div className="flex items-end gap-3 mb-1">
            <span className="whitespace-nowrap text-2xl md:text-3xl font-bold text-white leading-none">{formatNumber(overview.networkTicketVolume)}</span>
          </div>
          <p className="mt-auto truncate text-xs text-gray-500">Avg: {overview.averageTicketsPerEntrant} Per Entrant</p>
        </div>

        {/* Card 4 */}
        <div className="flex min-h-[124px] md:min-h-[150px] min-w-0 flex-col rounded-xl border border-[#2A2F3A]/50 bg-[#1D222B]/60 p-3 md:p-4">
          <div className="flex justify-between items-start mb-2">
            <h3 className="min-w-0 pr-2 text-[11px] font-bold uppercase leading-4 tracking-wide text-gray-400">Total Distributed Value</h3>
            <div className="shrink-0 text-yellow-500 bg-yellow-500/10 p-1.5 rounded-md">
              <Trophy size={14} />
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2 mb-1">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-red-500/30 bg-red-500/20">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
            </div>
            <span className="min-w-0 truncate text-xl md:text-3xl font-bold leading-none text-white">{formatNumber(overview.totalDistributedValue)}</span>
          </div>
          <p className="mt-auto truncate text-xs text-gray-500">Lifetime Awarded Incentives</p>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-[#2A2F3A]/50 bg-[#1D222B]/60 px-4 py-3 mb-4 xl:grid-cols-[minmax(260px,1fr)_auto] xl:items-end">
        
        {/* Left Side: Search */}
        <div className="flex w-full min-w-0 items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
            <input
              type="text"
              placeholder="Search Campaign..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="w-full bg-[#15181E] border border-[#2A2F3A]/50 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-[#C56CFF]/50 transition-colors"
            />
          </div>
        </div>

        {/* Right Side: Filters & Actions */}
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
              <option>Active</option>
              <option>Completed</option>
              <option>Paused</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>

          <div className="relative flex min-w-[150px] flex-1 flex-col sm:flex-none">
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="w-full cursor-pointer appearance-none rounded-lg border border-[#2A2F3A]/50 bg-[#15181E] px-3 py-2 pr-9 text-sm text-gray-300 outline-none transition-colors hover:border-[#C56CFF]/40 focus:border-[#C56CFF]/50"
            >
              <option>All Types</option>
              <option>Weekly</option>
              <option>Monthly</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>

          <div className="flex flex-col sm:ml-auto xl:ml-2">
            <button 
              onClick={() => { setSelectedCampaign(null); setIsEditOpen(true); }}
              className="flex min-w-[176px] items-center justify-center gap-2 px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm"
            >
              <PlayCircle size={16} /> NEW CAMPAIGN
            </button>
          </div>
        </div>

      </div>

      {/* TABLE */}
      <div className="bg-[#1D222B]/40 border border-[#2A2F3A]/50 rounded-xl overflow-hidden w-full">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-[#15181E]/60 border-b border-[#2A2F3A]/50">
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[280px]">Campaign Details</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Engagement</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">Status</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Prize Pool</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-[260px]">Timeline & Progress</th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">
                  <span className="inline-flex items-center justify-center gap-1.5">
                    Winners
                    <button
                      type="button"
                      onClick={() => setIsWinnerInfoOpen(true)}
                      title="How winners are announced"
                      aria-label="How winners are announced"
                      className="text-gray-500 transition-colors hover:text-[#C56CFF]"
                    >
                      <Info size={13} />
                    </button>
                  </span>
                </th>
                <th className="px-5 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center w-[80px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2A2F3A]/30">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-500">
                    Loading campaigns...
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-500">
                    No campaigns found
                  </td>
                </tr>
              ) : (
                campaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-[#1A1F28]/60 transition-colors group">
                    
                    {/* Campaign Details */}
                    <td className="px-5 py-4 align-top">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded bg-[#15181E] border border-[#2A2F3A]/60 flex items-center justify-center overflow-hidden flex-shrink-0 relative"
                          style={{
                            backgroundColor: "#242B35",
                            backgroundImage: campaign.bannerImageUrl ? `url(${campaign.bannerImageUrl})` : undefined,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }}
                        >
                          {!campaign.bannerImageUrl && (
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(197,108,255,0.35),_transparent_60%)] opacity-90" />
                          )}
                          <MonitorPlay size={20} className="text-white relative z-10 opacity-70" />
                        </div>
                        <div className="flex flex-col items-start min-w-0">
                          <span className="text-sm font-semibold text-gray-100 truncate w-full group-hover:text-[#C56CFF] transition-colors">
                            {campaign.title}
                          </span>
                          <span className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#C56CFF]/20 text-[#C56CFF] uppercase tracking-wider border border-[#C56CFF]/30">
                            {campaign.type}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Engagement */}
                    <td className="px-5 py-4 align-top text-center">
                      <div className="flex flex-col items-center gap-1.5 h-full justify-center">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-base font-bold text-white">{campaign.tickets}</span>
                          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Tickets</span>
                        </div>
                        <div 
                          className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => { void openParticipants(campaign); }}
                        >
                          <span className="text-base font-bold text-red-500">{campaign.entrants}</span>
                          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Entrants</span>
                          <ChevronRight size={12} className="text-gray-500" />
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4 align-top text-center">
                      <div className="flex items-center justify-center h-full">
                        <span className={statusToBadge(campaign.status)}>{campaign.status}</span>
                      </div>
                    </td>

                    {/* Prize Pool */}
                    <td className="px-5 py-4 align-top">
                      <div className="flex flex-col h-full justify-center pt-1">
                        <div className="flex items-center gap-2">
                          <Trophy size={14} className="text-yellow-500 drop-shadow-sm" />
                          <span className="text-sm font-bold text-gray-100">{campaign.prizeCount} Prize</span>
                        </div>
                        <span 
                          onClick={() => { setSelectedCampaign(campaign); setIsPrizeOpen(true); }}
                          className="text-xs text-[#C56CFF] mt-1.5 font-medium cursor-pointer hover:underline underline-offset-2"
                        >
                          View Breakdown
                        </span>
                      </div>
                    </td>

                    {/* Timeline & Progress */}
                    <td className="px-5 py-4 align-top">
                      <div className="flex flex-col h-full justify-center gap-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-200 font-medium">Draw: {formatDateTime(campaign.draw?.drawnAt || campaign.drawDate)}</span>
                          <span className="text-red-500 font-bold">{campaign.progress}%</span>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="h-1.5 w-full bg-[#15181E] rounded-full overflow-hidden border border-[#2A2F3A]/50">
                          {campaign.status === "COMPLETED" ? (
                            <div className="h-full bg-[#C56CFF] w-full"></div>
                          ) : (
                            <div className="h-full bg-red-500 w-full" style={{ width: `${campaign.progress}%` }}></div>
                          )}
                        </div>
                        
                        <div className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider mt-0.5">
                          STARTED: {formatDateTime(campaign.startDate)}
                        </div>
                      </div>
                    </td>

                    {/* Winners */}
                    <td className="px-5 py-4 align-top text-center">
                      <div className="flex items-center justify-center h-full">
                        {(() => {
                          const state = winnersStateOf(campaign);

                          if (state === "VIEW_WINNERS") {
                            return (
                              <button
                                onClick={() => { void openWinners(campaign); }}
                                title={`Drawn ${formatDateTime(campaign.draw?.drawnAt)} — prizes credited`}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded text-green-500 text-[10px] font-bold uppercase transition-colors whitespace-nowrap"
                              >
                                <Trophy size={12} /> VIEW WINNERS
                              </button>
                            );
                          }

                          if (state === "SCHEDULED") {
                            return (
                              <div
                                title={`Campaign has not started yet — it opens ${formatDateTime(campaign.startDate)}. Tickets can only be earned from then until the draw.`}
                                className="flex items-center justify-center bg-blue-500/10 border border-blue-500/30 rounded px-3 py-1.5 w-[130px] cursor-help"
                              >
                                <span className="flex items-center gap-1.5 text-blue-400 text-[10px] font-bold uppercase whitespace-nowrap">
                                  <CalendarClock size={12} /> SCHEDULED
                                </span>
                              </div>
                            );
                          }

                          if (state === "NO_ENTRIES") {
                            return (
                              <div
                                title="The draw ran with no tickets in the pool, so no winners were selected and nothing was awarded."
                                className="flex items-center justify-center bg-yellow-500/10 border border-yellow-500/30 rounded px-3 py-1.5 w-[130px] cursor-help"
                              >
                                <span className="flex items-center gap-1.5 text-yellow-500 text-[10px] font-bold uppercase whitespace-nowrap">
                                  <UserX size={12} /> NO ENTRIES
                                </span>
                              </div>
                            );
                          }

                          return (
                            <div
                              title={`Winners are announced automatically once the draw date passes (${formatDateTime(campaign.drawDate)}).`}
                              className="flex items-center justify-center bg-[#15181E] border border-[#2A2F3A]/50 rounded px-3 py-1.5 w-[130px] cursor-help"
                            >
                              <span className="flex items-center gap-1.5 text-gray-500 text-[10px] font-bold uppercase whitespace-nowrap">
                                <CircleDashed size={12} /> IN PROGRESS
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 align-top text-center">
                      <div className="flex items-center justify-center h-full">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-8 h-8 rounded-lg bg-[#15181E] border border-[#2A2F3A]/80 hover:bg-[#2A2F3A] flex items-center justify-center text-gray-400 transition-colors">
                              <MoreVertical size={16} />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-[#1D222B] border border-[#2A2F3A] text-gray-200">
                            <DropdownMenuItem 
                              onClick={() => { setSelectedCampaign(campaign); setIsEditOpen(true); }}
                              className="hover:bg-[#2A2F3A] cursor-pointer"
                            >
                              Edit Campaign
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => { setSelectedCampaign(campaign); setIsDeleteOpen(true); }}
                              className="hover:bg-[#2A2F3A] cursor-pointer text-red-400"
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
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

      {isParticipantsOpen && (
        <CampaignParticipantsModal
          open={isParticipantsOpen} 
          onClose={() => setIsParticipantsOpen(false)} 
          campaign={selectedCampaign}
          participants={participantsResponse.items}
          page={participantsResponse.page}
          totalPages={participantsResponse.totalPages}
          isLoading={participantsLoading}
          onPageChange={(page) => selectedCampaign && void openParticipants(selectedCampaign, page)}
        />
      )}
      
      {isPrizeOpen && (
        <PrizeBreakdownModal
          open={isPrizeOpen} 
          onClose={() => setIsPrizeOpen(false)} 
          campaign={selectedCampaign} 
        />
      )}

      {isWinnersOpen && (
        <RaffleWinnersModal
          open={isWinnersOpen} 
          onClose={() => setIsWinnersOpen(false)} 
          campaign={selectedCampaign}
          winners={winnersResponse.items}
          isLoading={winnersLoading}
        />
      )}

      {isEditOpen && (
        <EditCampaignModal
          open={isEditOpen}
          initialData={selectedCampaign}
          campaigns={campaigns}
          onClose={() => setIsEditOpen(false)}
          onSubmit={handleCreateOrEdit}
        />
      )}

      {isWinnerInfoOpen && (
        <WinnerAnnouncementInfoModal
          open={isWinnerInfoOpen}
          onClose={() => setIsWinnerInfoOpen(false)}
        />
      )}

      {isDeleteOpen && (
        <DeleteCampaignModal
          open={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          onConfirm={handleDeleteConfirm}
          campaignTitle={selectedCampaign?.title}
        />
      )}

    </div>
  );
}
