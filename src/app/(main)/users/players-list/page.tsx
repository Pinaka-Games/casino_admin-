"use client";
import { Wrench, Copy, ArrowRight, Filter, ChevronsUpDown, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useUserManagement, useDebouncedSearch } from "@/hooks/use-users";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  PlayersFilterSheet,
  PlayersFilters,
  DEFAULT_PLAYER_FILTERS,
} from "../components/PlayersFilterSheet";
import Pagination from "@/components/Pagination";
import NoData from "@/components/NoData";

/* ===== PLAYER MODALS ===== */
import EditPlayerModal from "../components/player-list/EditPlayerModal";
import { TABS as PLAYER_TABS } from "./[username]/components/PlayerTabs";
import PlayerActivityModal from "../components/player-list/PlayerActivityModal";
import PlayerDownlineModal from "../components/player-list/PlayerDownlineModal";
import PlayerRolloverHistory from "../components/player-list/PlayerRolloverHistory";
import PlayerTransactionModal from "../components/player-list/PlayerTransactionModal";
import ExportCSV from "@/components/ExportCSV";

import { useRouter } from "next/navigation";
import PlayerPermissionModal from "../components/player-list/PlayerPermissionModal";
import toast from "react-hot-toast";
import ListSearch from "@/components/TableSearch/ListSearch";
import KycStatusBadge from "@/components/KycStatusBadge";
import { formatUtcDateTime } from "@/lib/utils";
import { formatOnlineStatus } from "@/components/OnlineStatus";
import { usePresence, resolvePresence } from "@/hooks/use-presence";
import { profileApi } from "@/api/users/users";

import { BronzeTier } from "@/assets/images/banner";
import { vipAdminApi, VipTier } from "@/api/vip/vip";

import Image from "next/image";
import { coingold, coingreen } from "@/assets/icons";

import { useState, useMemo, useEffect } from "react";

const PAGE_SIZE = 10;

type RowRank = {
  badge: string;
  label: string;
};


/**
 * Balances are shown in full — an agent reconciling an account reads the exact
 * figure, so a rounded "166.07M" is not good enough. Decimals are capped at two
 * because the wallet stores more precision than anyone needs on a list.
 */
const formatBalance = (value: number) =>
  (Number(value) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
export default function PlayerListing() {
  const router = useRouter();

  // Use debounced search hook
  const { searchTerm, setSearchTerm } = useDebouncedSearch(500);

  // Get user management functions and state
  const { users, pagination, loading, error, fetchUsers, changePage, setFilters } =
    useUserManagement();
  const [playerFilters, setPlayerFilters] = useState<PlayersFilters>(
    DEFAULT_PLAYER_FILTERS,
  );
  const [filterOpen, setFilterOpen] = useState(false);

  const filtersActive =
    playerFilters.source !== "all" ||
    playerFilters.accountStatus !== "all" ||
    playerFilters.kyc !== "all" ||
    playerFilters.vipTierId !== "" ||
    playerFilters.online !== "all" ||
    playerFilters.dateRange !== "all";

  const resolveDates = (f: PlayersFilters): { startDate?: string; endDate?: string } => {
    const now = new Date();
    if (f.dateRange === "7d" || f.dateRange === "30d") {
      const days = f.dateRange === "7d" ? 7 : 30;
      const start = new Date(now);
      start.setDate(start.getDate() - days);
      return { startDate: start.toISOString(), endDate: now.toISOString() };
    }
    if (f.dateRange === "custom") {
      return {
        startDate: f.startDate ? new Date(`${f.startDate}T00:00:00`).toISOString() : undefined,
        endDate: f.endDate ? new Date(`${f.endDate}T23:59:59`).toISOString() : undefined,
      };
    }
    return {};
  };

  /** The active filters as query params — reused when sorting so a sort click
   *  cannot quietly widen the result set back to everything. */
  const buildFilterParams = (f: PlayersFilters) => {
    const isActive =
      f.accountStatus === "active"
        ? true
        : f.accountStatus === "inactive"
          ? false
          : undefined;
    const { startDate, endDate } = resolveDates(f);
    return {
      source: f.source,
      kyc: f.kyc,
      vipTierId: f.vipTierId || undefined,
      isActive,
      startDate,
      endDate,
    };
  };

  const handleApplyFilters = (f: PlayersFilters) => {
    setPlayerFilters(f);
    const params = buildFilterParams(f);
    setFilters(params);
    fetchUsers({ page: 1, ...params, search: searchTerm || "" });
  };

  /* ===== MODAL STATES ===== */
  const [openEdit, setOpenEdit] = useState(false);
  const [openActivity, setOpenActivity] = useState(false);
  const [openDownline, setOpenDownline] = useState(false);
  const [openRollover, setOpenRollover] = useState(false);
  const [openTransaction, setOpenTransaction] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [openPermission, setOpenPermission] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [vipTiers, setVipTiers] = useState<VipTier[]>([]);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  /**
   * Column sorting. The list is paged by the API, so ordering has to happen
   * there: sorting the ten rows on screen would answer "the largest balance on
   * this page", which is not the question being asked.
   */
  const [sort, setSort] = useState<{ field: PlayerSortField | null; order: "asc" | "desc" }>({
    field: null,
    order: "desc",
  });

  const handleSort = (field: PlayerSortField) => {
    // First click on a column sorts high-to-low; clicking it again flips.
    const order = sort.field === field && sort.order === "desc" ? "asc" : "desc";
    setSort({ field, order });
    fetchUsers({
      page: 1,
      limit: PAGE_SIZE,
      search: searchTerm || "",
      ...buildFilterParams(playerFilters),
      sortField: field,
      sortOrder: order,
    });
  };

  /* ============================
     INITIAL FETCH ON MOUNT
  ============================ */
  useEffect(() => {
    fetchUsers({ page: 1, limit: PAGE_SIZE, search: "" });
  }, [fetchUsers]);

  useEffect(() => {
    async function loadVipTiers() {
      try {
        const response = await vipAdminApi.getTiers();
        setVipTiers(response.data || []);
      } catch (error) {
        console.error("Failed to fetch VIP tiers for player listing:", error);
      }
    }

    loadVipTiers();
  }, []);

  /* ============================
     TRANSFORM USERS FOR DISPLAY
  ============================ */
  const transformedRows = useMemo(() => {
    if (!users || users.length === 0) return [];

    const vipTierMap = new Map(
      vipTiers.map((tier) => [tier.id, tier]),
    );

    // Show the sub-level number only when that rank actually has multiple
    // levels configured — after the admin trims a rank to a single level,
    // "Bronze 3" would misleadingly suggest levels that no longer exist.
    const levelsPerRank = new Map<string, number>();
    vipTiers.forEach((tier) => {
      // Count all tiers (active and inactive) so users with inactive tiers still display correctly
      levelsPerRank.set(tier.name, (levelsPerRank.get(tier.name) ?? 0) + 1);
    });

    return users.map((user: any) => {
      const matchedTier = user?.vipTierId ? vipTierMap.get(user.vipTierId) : undefined;
      const fallbackTier = vipTiers[0];
      const resolvedTier = matchedTier || fallbackTier;
      const rank: RowRank = {
        badge: resolvedTier?.badge || BronzeTier.src,
        label: resolvedTier
          ? (levelsPerRank.get(resolvedTier.name) ?? 0) > 1
            ? `${resolvedTier.name} ${resolvedTier.level}`
            : resolvedTier.name
          : "No Rank",
      };

      return {
        id: user.id,
        username: user.username || user.profile?.displayName || "N/A",
        // referrerId is the live link and matches the backend's `direct` filter.
        // referredBy holds the legacy referral code and survives a detach, so it
        // must not be counted here.
        source: user.referrerId ? "Referral" : "Direct",
        email: user.profile?.email || user.entity || "N/A",
        isActive: Boolean(user.isActive),
        accountStatus: user.isActive ? "Active" : "Inactive",
        onlineStatus: user.onlineStatus || (user.isOnline ? "Online" : "Offline"),
        lastSeenAt: user.lastSeenAt ?? null,
        // A player who never finished their profile has no full name; the
        // display name, then the username, still identifies them. Without this
        // the row led with the email alone and looked like a broken record.
        fullName:
          user.profile?.fullName ||
          user.name ||
          user.profile?.displayName ||
          user.username ||
          "N/A",
        phone: user.profile?.phone || "N/A",
        dob: user.profile?.dateOfBirth || user.dateOfBirth || user.dob || "",
        rank,
        balanceCash: Number(user.wulfCash || 0).toLocaleString(),
        balanceCoin: Number(user.wulfCoin || 0).toLocaleString(),
        balanceBonus: Number(user.bonusWulfCash || 0).toLocaleString(),
        // Raw values too: the table adds cash and bonus together, which a
        // pre-formatted string cannot do.
        cashAmount: Number(user.wulfCash || 0),
        coinAmount: Number(user.wulfCoin || 0),
        bonusAmount: Number(user.bonusWulfCash || 0),
        isVerified: user.isVerified,
        isPremium: user.isPremium,
        kycStatus: user.kycStatus || "NOT_STARTED",
        kycAdminApproved: Boolean(user.kycAdminApproved),
        createdAt: user.createdAt,
      };
    });
  }, [users, vipTiers]);

  // Presence arrives over the socket, so a player signing in or out moves the
  // column (and this page's Online filter) without a refresh. Folded into the
  // rows once, here, so filtering, export and rendering all agree.
  const presence = usePresence(() =>
    fetchUsers({ page: pagination?.page || 1, limit: PAGE_SIZE, search: searchTerm || "" }),
  );

  const rowsWithPresence = useMemo(
    () =>
      transformedRows.map((row: any) => {
        const live = resolvePresence(presence, row.id, row);
        return {
          ...row,
          ...live,
          onlineStatus: live.isOnline ? "Online" : "Offline",
        };
      }),
    [transformedRows, presence],
  );

  // Online status is live (not a server filter) — filter the current page here.
  const visibleRows = useMemo(() => {
    if (playerFilters.online === "all") return rowsWithPresence;
    return rowsWithPresence.filter(
      (r: any) => (r.onlineStatus || "").toLowerCase() === playerFilters.online,
    );
  }, [rowsWithPresence, playerFilters.online]);

  /* ============================
     EXPORT DATA
  ============================ */
  const exportData = useMemo(
    () =>
      rowsWithPresence.map((row: any) => ({
        username: row.username,
        source: row.source,
        accountStatus: row.accountStatus,
        onlineStatus: formatOnlineStatus(row),
        fullName: row.fullName,
        balanceCash: row.balanceCash,
        balanceCoin: row.balanceCoin,
        balanceBonus: row.balanceBonus,
        phone: row.phone,
        email: row.email,
      })),
    [rowsWithPresence],
  );

  const handleAccountStatusToggle = async (userId: string, nextIsActive: boolean) => {
    setUpdatingStatusId(userId);

    try {
      await profileApi.updateUserProfile(userId, { isActive: nextIsActive });
      toast.success(
        nextIsActive
          ? "User account activated successfully"
          : "User account deactivated. The user has been logged out.",
      );
      await fetchUsers({
        page: pagination.page,
        limit: PAGE_SIZE,
        search: searchTerm || "",
      });
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to update account status",
      );
    } finally {
      setUpdatingStatusId(null);
    }
  };

  return (
    <div className="h-full bg-[#15181E] text-white px-3 py-4 md:px-6 md:py-6">
      <div className="h-full grid grid-rows-[auto_auto_1fr] gap-4">
        {/* HEADER (fixed) */}
        <div className="bg-[#191D24] px-4 py-3 rounded-lg flex items-center justify-between gap-3 md:px-6 md:gap-4">
          <h1 className="min-w-0 truncate text-base font-normal text-white">
            User / User Listing
          </h1>
          {/* Creating a player is what an admin reaches for while looking at
              this list — the sidebar row stays too. */}
          <Link href="/users/register-user" className="shrink-0">
            <Button
              variant="outline"
              className="h-9 whitespace-nowrap border-gray-700 bg-[#242B35] text-white hover:bg-[#2c3441] hover:text-white"
            >
              Register User
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* SEARCH BAR (fixed) */}
        <div className="bg-[#191D24] rounded-lg p-2 flex items-center gap-3">
          <ListSearch

            value={searchTerm || ""}
            onChange={setSearchTerm}
            showButton={false}
            placeholder="Search by username / email id"
          />

          <Button
            variant="outline"
            onClick={() => setFilterOpen(true)}
            className={`gap-2 bg-[#1a2030] border-gray-700 text-white hover:bg-[#242B35] hover:text-white shrink-0 ${
              filtersActive ? "ring-1 ring-purple-500" : ""
            }`}
            title="Filters"
          >
            <Filter size={18} className="text-[#B93DEB]" />
            Filters
          </Button>

          <ExportCSV
            data={exportData}
            fileName="player_users.csv"
            fetchAll={async (range) => {
              // Pull the COMPLETE matching dataset (all pages), applying the
              // same transform used for the in-page rows. Popover range maps
              // to the server-side date filter.
              const startDate = range.from?.toISOString();
              const endDate = range.to?.toISOString();
              const EXPORT_LIMIT = 500;
              const all: any[] = [];
              let page = 1;
              for (let i = 0; i < 100; i++) {
                const res = await profileApi.getAllUsers({
                  page,
                  limit: EXPORT_LIMIT,
                  search: searchTerm || "",
                  startDate,
                  endDate,
                });
                all.push(...res.data.data);
                if (all.length >= res.data.meta.total || res.data.data.length === 0)
                  break;
                page += 1;
              }
              return all.map((user: any) => ({
                username: user.username || user.profile?.displayName || "N/A",
                source: user.referrerId ? "Referral" : "Direct",
                accountStatus: user.isActive ? "Active" : "Inactive",
                // Whole-range export re-fetches from the API, so it reports the
                // server's view rather than this tab's live overrides.
                onlineStatus: formatOnlineStatus({
                  isOnline:
                    String(user.onlineStatus ?? "").toLowerCase() === "online" ||
                    Boolean(user.isOnline),
                  lastSeenAt: user.lastSeenAt ?? null,
                }),
                fullName:
                  user.profile?.fullName ||
                  user.name ||
                  user.profile?.displayName ||
                  user.username ||
                  "N/A",
                balanceCash: Number(user.wulfCash || 0).toLocaleString(),
                balanceCoin: Number(user.wulfCoin || 0).toLocaleString(),
                balanceBonus: Number(user.bonusWulfCash || 0).toLocaleString(),
                phone: user.profile?.phone || "N/A",
                email: user.profile?.email || user.entity || "N/A",
                createdAt: user.createdAt,
              }));
            }}
            headers={[
              "Username",
              "Source",
              "Account Status",
              "Online Status",
              "Full Name",
              "Cash Balance",
              "Coin Balance",
              "Bonus Balance",
              "Phone",
              "Email",
              "Registered (UTC)",
            ]}
            mapRow={(row: any) => [
              row?.username,
              row?.source,
              row?.accountStatus,
              row?.onlineStatus,
              row?.fullName,
              row?.balanceCash,
              row?.balanceCoin,
              row?.balanceBonus,
              row?.phone,
              row?.email,
              row?.createdAt ? formatUtcDateTime(row.createdAt) : "—",
            ]}
          />
        </div>

        {/* SCROLLABLE TABLE AREA — a column, so the rows take the leftover
            height and the pager keeps its own band at the bottom. With the
            scroller on `h-full` it claimed the whole card and pushed the pager
            past the edge, where `overflow-hidden` clipped it out of sight. */}
        <div className="flex min-h-0 flex-col bg-[#111726] rounded-lg border border-gray-800 overflow-hidden">
          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto scrollbar-hide relative">
            <div className="">
              {error ? (
                <div className="flex items-center justify-center py-16">
                  <p className="text-red-400">Error loading users: {error}</p>
                </div>
              ) : (
                <>
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-[#1a2030] text-gray-300 sticky top-0 z-10">
                      <tr>
                        {/* <th className="px-4 py-3 text-left min-w-[220px]">
                          Upline
                        </th> */}
                        <th className="px-4 py-3 text-left min-w-[210px]">
                          <PlayerSortHeader
                            label="User"
                            field="username"
                            sort={sort}
                            onSort={handleSort}
                          />
                        </th>
                        <th className="px-4 py-3 text-left min-w-[150px]">
                          <PlayerSortHeader
                            label="Balance"
                            field="balance"
                            sort={sort}
                            onSort={handleSort}
                          />
                        </th>
                        <th className="px-4 py-3 text-left min-w-[90px]">
                          <PlayerSortHeader
                            label="Status"
                            field="isActive"
                            sort={sort}
                            onSort={handleSort}
                          />
                        </th>
                        <th className="px-4 py-3 text-left min-w-[110px]">
                          Rank
                        </th>
                        <th className="px-4 py-3 text-left min-w-[120px]">
                          KYC
                        </th>
                        <th className="px-4 py-3 text-left min-w-[110px]">
                          Source
                        </th>
                        <th className="px-4 py-3 text-left min-w-[170px]">
                          <PlayerSortHeader
                            label="Joined At"
                            field="createdAt"
                            sort={sort}
                            onSort={handleSort}
                          />
                        </th>
                        {/* <th className="px-4 py-3 text-left min-w-[220px]">
                          Phone
                        </th> */}
                        <th className="px-4 py-3 text-center min-w-[90px]">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {loading ? (
                        Array.from({ length: 10 }).map((_, i) => (
                          <tr
                            key={`skeleton-${i}`}
                            className="border-b border-gray-800"
                          >
                            {Array.from({ length: 9 }).map((__, c) => (
                              <td key={c} className="px-4 py-4">
                                <div className="h-3 w-full max-w-[140px] rounded bg-gray-700/40 animate-pulse" />
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : visibleRows.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-16">
                            <NoData title="No players found" />
                          </td>
                        </tr>
                      ) : (
                        visibleRows.map(
                          (row: any, index: number) => (
                            <tr
                              key={row.id}
                              onClick={() =>
                                router.push(`/users/players-list/${row.id}`)
                              }
                              className={`border-t border-gray-800 hover:bg-[#151b2d] cursor-pointer ${
                                index % 2 === 0
                                  ? "bg-[#191D24]"
                                  : "bg-[#161A21]"
                              }`}
                            >
                              {/* <td className="px-4 py-3 text-xs text-gray-300">
                              {row.upline}
                            </td> */}

                              <td className="px-4 py-3 text-xs text-gray-300">
                                {(() => {
                                  const contact =
                                    row?.email && row?.email !== "N/A"
                                      ? row?.email
                                      : row?.phone;
                                  const fullName =
                                    row?.fullName && row?.fullName !== "N/A"
                                      ? String(row.fullName).toUpperCase()
                                      : "";
                                  return (
                                    <div className="flex flex-col gap-0.5 max-w-[240px]">
                                      {fullName && (
                                        <span className="flex items-center gap-1.5 truncate text-[11px] font-semibold uppercase text-white">
                                          {/* Presence lives on the name now
                                              rather than its own column: a
                                              pulsing dot for online, nothing at
                                              all for offline, with the last-seen
                                              detail on hover. */}
                                          {row.isOnline && (
                                            <span
                                              title={formatOnlineStatus(row)}
                                              className="relative flex h-2 w-2 shrink-0"
                                            >
                                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#04AD37] opacity-75" />
                                              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#04AD37]" />
                                            </span>
                                          )}
                                          {fullName}
                                        </span>
                                      )}
                                      <div className="flex items-center gap-2">
                                      <span className="truncate">{contact}</span>
                                      {contact && contact !== "N/A" && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(contact);
                                            toast.success("Copied");
                                          }}
                                          title="Copy"
                                          className="shrink-0 text-gray-500 hover:text-purple-400 transition-colors"
                                        >
                                          <Copy size={13} />
                                        </button>
                                      )}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="px-4 py-3 text-xs">
                                {/* Both currencies sit on one line while they
                                    fit; a long figure pushes the second onto its
                                    own line rather than stretching the column.
                                    Stacking them unconditionally wasted a whole
                                    row of height on the "0 / 0" accounts that
                                    make up most of this list. */}
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                  {/* Wulf Cash is what the player can actually
                                      stake, and bonus cash spends the same way,
                                      so the two are shown as one figure with the
                                      split on hover. */}
                                  <span
                                    className="flex items-center gap-1"
                                    title={`Wulf Cash ${row.balanceCash} + Bonus ${row.balanceBonus}`}
                                  >
                                    <Image
                                      src={coingreen}
                                      alt="Wulf Cash"
                                      width={12}
                                      height={12}
                                    />
                                    {formatBalance(row.cashAmount + row.bonusAmount)}
                                  </span>
                                  <span
                                    className="flex items-center gap-1"
                                    title={`Wulf Coin ${row.balanceCoin}`}
                                  >
                                    <Image
                                      src={coingold}
                                      alt="Wulf Coin"
                                      width={12}
                                      height={12}
                                    />
                                    {formatBalance(row.coinAmount)}
                                  </span>
                                </div>
                              </td>
                              <td
                                onClick={(e) => e.stopPropagation()}
                                className="px-4 py-3 text-xs text-left"
                              >
                                <div className="flex flex-col items-start gap-2">
                                  <Switch
                                    checked={row.isActive}
                                    disabled={updatingStatusId === row.id}
                                    onCheckedChange={(checked) =>
                                      handleAccountStatusToggle(row.id, checked)
                                    }
                                    className="data-[state=checked]:bg-purple-500 data-[state=unchecked]:bg-gray-600"
                                  />
                                  {/* The switch already says on or off; only the
                                      in-flight state needs words. */}
                                  {updatingStatusId === row.id && (
                                    <span className="text-gray-400">Updating...</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <img
                                    src={row.rank.badge}
                                    alt={row.rank.label}
                                    width={32}
                                    height={32}
                                    className="h-8 w-8 object-contain"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = BronzeTier.src;
                                    }}
                                  />
                                  <span className="text-xs text-gray-300">{row.rank.label}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-left">
                                <KycStatusBadge
                                  status={row.kycStatus}
                                  adminApproved={row.kycAdminApproved}
                                />
                              </td>
                              <td className="px-4 py-3 text-xs">
                                <span
                                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                    row.source === "Referral"
                                      ? "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                                      : "bg-gray-500/15 text-gray-300 border border-gray-500/30"
                                  }`}
                                >
                                  {row.source}
                                </span>
                              </td>

                              {/* Rendered in UTC, like every other dated admin
                                  screen — a registration shown in the viewer's
                                  zone lands on a different day than the reports
                                  count it on. */}
                              <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                                {row.createdAt ? formatUtcDateTime(row.createdAt) : "—"}
                              </td>

                              {/* <td className="px-4 py-3 text-xs text-gray-300">
                              <div className="truncate max-w-[220px]">
                                {row.phone}
                              </div>
                            </td> */}

                              <td
                                onClick={(e) => e.stopPropagation()}
                                className="px-4 py-3 text-center"
                              >
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className="text-red-400 hover:text-orange-400">
                                      <Wrench size={16} />
                                    </button>
                                  </DropdownMenuTrigger>

                                  <DropdownMenuContent
                                    align="end"
                                    className="max-h-[70vh] overflow-y-auto bg-[#1a2030] text-white border border-white p-2"
                                  >
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedPlayer(row);
                                        setOpenEdit(true);
                                      }}
                                    >
                                      Edit
                                    </DropdownMenuItem>

                                    <DropdownMenuSeparator className="bg-white/10" />
                                    <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                                      View
                                    </DropdownMenuLabel>

                                    {/* One entry per detail tab, straight to
                                        that tab: `tab` beats the tab this
                                        player was last left on, so the menu
                                        lands where it says it will. Basic Info
                                        is left out — clicking the row itself
                                        already goes there. */}
                                    {PLAYER_TABS.filter(
                                      (tab) => tab !== "Basic Info"
                                    ).map((tab) => (
                                      <DropdownMenuItem
                                        key={tab}
                                        onClick={() =>
                                          router.push(
                                            `/users/players-list/${row.id}?tab=${encodeURIComponent(
                                              tab
                                            )}`
                                          )
                                        }
                                      >
                                        {tab}
                                      </DropdownMenuItem>
                                    ))}

                                    {/* <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedUser(row.username);
                                      setOpenPermission(true);
                                    }}
                                  >
                                    Permission
                                  </DropdownMenuItem> */}

                                    {/* <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedPlayer(row);
                                      setOpenActivity(true);
                                    }}
                                  >
                                    Activity
                                  </DropdownMenuItem> */}

                                    {/* <DropdownMenuItem
                                        onClick={() => setOpenDownline(true)}
                                      >
                                        View Bank
                                      </DropdownMenuItem> */}

                                    {/* <DropdownMenuItem
                                    onClick={() => setOpenRollover(true)}
                                  >
                                    Roll Over
                                  </DropdownMenuItem> */}

                                    {/* <DropdownMenuItem
                                    onClick={() => setOpenTransaction(true)}
                                  >
                                    Transaction
                                  </DropdownMenuItem> */}

                                    {/* <DropdownMenuItem
                                    onClick={() =>
                                      toast.success(
                                        "Restore wallet Successfully"
                                      )
                                    }
                                  >
                                    Restore Wallet
                                  </DropdownMenuItem> */}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          ),
                        )
                      )}
                    </tbody>
                  </table>

                </>
              )}
            </div>
          </div>

          {/* Outside the scroller on purpose: it used to sit inside, so on a
              phone the pager slid off with the table and you had to scroll the
              rows sideways to reach the page buttons. */}
          {!error && pagination.totalPages > 1 && (
            <div className="shrink-0 border-t border-gray-800 px-3 py-3 md:px-4">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={changePage}
              />
            </div>
          )}
        </div>
      </div>

      {/* ===== FILTER SHEET ===== */}
      <PlayersFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={playerFilters}
        onApply={handleApplyFilters}
        // Name only. The level was appended here, so every option read
        // "Bronze 3" / "Silver 3" — a number that means nothing next to a tier
        // name in a filter.
        tierOptions={vipTiers.map((t) => ({
          id: String(t.id),
          name: t.name,
        }))}
      />

      {/* ===== MODALS ===== */}
      <EditPlayerModal
        open={openEdit}
        userId={selectedPlayer?.id}
        initialData={selectedPlayer}
        onClose={() => {
          setOpenEdit(false);
          setSelectedPlayer(null);
        }}
        onSubmit={() => {
          setOpenEdit(false);
          fetchUsers({
            page: pagination.page,
            limit: PAGE_SIZE,
            search: searchTerm || "",
          });
        }}
        onChanged={() => {
          fetchUsers({
            page: pagination.page,
            limit: PAGE_SIZE,
            search: searchTerm || "",
          });
        }}
      />

      <PlayerActivityModal
        open={openActivity}
        username={selectedPlayer?.username}
        onClose={() => setOpenActivity(false)}
      />

      <PlayerDownlineModal
        open={openDownline}
        onClose={() => setOpenDownline(false)}
      />

      <PlayerRolloverHistory
        open={openRollover}
        onClose={() => setOpenRollover(false)}
      />

      <PlayerTransactionModal
        open={openTransaction}
        onClose={() => setOpenTransaction(false)}
      />

      <PlayerPermissionModal
        open={openPermission}
        username={selectedUser ?? ""}
        onClose={() => {
          setOpenPermission(false);
          setSelectedUser(null);
        }}
        onSubmit={(data) => console.log("PERMISSION UPDATE:", data)}
      />
    </div>
  );
}

/** Columns the API can order the player list by. */
type PlayerSortField = "username" | "balance" | "isActive" | "createdAt";

/** Header button styled like the GGR control on Agent Listing. */
function PlayerSortHeader({
  label,
  field,
  sort,
  onSort,
}: {
  label: string;
  field: PlayerSortField;
  sort: { field: PlayerSortField | null; order: "asc" | "desc" };
  onSort: (field: PlayerSortField) => void;
}) {
  const active = sort.field === field;

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="flex items-center gap-1 hover:text-[#B93DEB] transition-colors"
    >
      {label}
      {!active && <ChevronsUpDown size={12} className="text-gray-400" />}
      {active && sort.order === "desc" && <ChevronDown size={12} className="text-[#B93DEB]" />}
      {active && sort.order === "asc" && <ChevronUp size={12} className="text-[#B93DEB]" />}
    </button>
  );
}
