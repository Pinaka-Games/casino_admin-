"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import FilterToolbar from "@/components/filters/FilterToolbar";
import EntityFilterSheet from "@/components/filters/EntityFilterSheet";
import type { FilterField, FilterValues } from "@/components/filters/types";
import {
  SortableTh,
  useSortedRows,
  useTableSort,
} from "@/components/filters/tableSort";


import Pagination from "@/components/Pagination";
import ExportCSV from "@/components/ExportCSV";
import NoData from "@/components/NoData";
import { profileApi } from "@/api/users/users";
import { UserWithProfile } from "@/types/profile.type";
import { UserVipProgress, vipAdminApi, VipTier } from "@/api/vip/vip";

/* ============================
   CONSTANTS
============================ */
const PAGE_SIZE = 10;
const FETCH_LIMIT = 100;

/* ============================
   TYPES
============================ */
interface UserTierRow {
  id: number;
  name: string;
  currentType: string;
  /** The user's lifetime XP. */
  currentXp: string;
  /** Progress through the current tier (floor → next tier requirement). */
  progressPct: string;
  /** XP requirement of the tier the user currently holds. */
  tierFloorXp: string;
  /** XP still needed to reach the next tier. */
  xpToNextTier: string;
}

/**
 * Progress through the current tier, measured from the tier's own floor —
 * `xp / nextRequirement` alone counts from zero and overstates progress for
 * every tier above the first (and disagrees with the player-facing VIP bar).
 */
function tierProgressPct(userXp: number, floorXp: number, nextXp: number): number {
  const span = nextXp - floorXp;
  if (!(span > 0)) return 100;
  return Math.min(100, Math.max(0, ((userXp - floorXp) / span) * 100));
}

/* ============================
   COMPONENT
============================ */
const USER_TIER_FILTER_DEFAULTS: FilterValues = {
  tier: "all",
  from: "",
  to: "",
};

export default function VipTierRewardsPage() {
  const [tiers, setTiers] = useState<VipTier[]>([]);
  // Registration-date bounds; whole days, inclusive of both ends.
  const [joinedFrom, setJoinedFrom] = useState("");
  const [joinedTo, setJoinedTo] = useState("");
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, UserVipProgress>>({});
  const [tier, setTier] = useState("all");
  const [sheetOpen, setSheetOpen] = useState(false);

  const USER_TIER_FILTER_FIELDS: FilterField[] = useMemo(
    () => [
      {
        type: "select",
        key: "tier",
        label: "Tier",
        options: [
          { value: "all", label: "All Tiers" },
          ...tiers.map((item) => ({ value: item.id, label: item.name })),
        ],
      },
      { type: "dateRange", fromKey: "from", toKey: "to", label: "Joined Between" },
    ],
    [tiers]
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAllUsers = useCallback(async () => {
    const firstResponse = await profileApi.getAllUsers({
      page: 1,
      limit: FETCH_LIMIT,
    });

    const firstPageUsers = firstResponse.data?.data ?? [];
    const totalPages = Math.max(firstResponse.data?.meta?.totalPages ?? 1, 1);

    if (totalPages <= 1) return firstPageUsers;

    const restResponses = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        profileApi.getAllUsers({
          page: i + 2,
          limit: FETCH_LIMIT,
        }),
      ),
    );

    const remainingUsers = restResponses.flatMap((response) => response.data?.data ?? []);
    return [...firstPageUsers, ...remainingUsers];
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [tiersResponse, allUsers] = await Promise.all([
        vipAdminApi.getTiers(),
        fetchAllUsers(),
      ]);

      const sortedTiers = [...(tiersResponse.data ?? [])].sort(
        (a, b) => (a.xp_required ?? 0) - (b.xp_required ?? 0),
      );

      setTiers(sortedTiers);
      setUsers(allUsers);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to fetch user tier data");
    } finally {
      setLoading(false);
    }
  }, [fetchAllUsers]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  /* ============================
     SEARCH FILTER
  ============================ */
  const tierLookup = useMemo(
    () => new Map((tiers ?? []).map((item) => [item.id, item])),
    [tiers],
  );

  const filteredUsers = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    const from = joinedFrom ? new Date(`${joinedFrom}T00:00:00`) : null;
    const to = joinedTo ? new Date(`${joinedTo}T23:59:59.999`) : null;

    return users.filter((user) => {
      const matchTier = tier === "all" || user.vipTierId === tier;
      if (!matchTier) return false;

      if (from || to) {
        const joined = new Date(user.createdAt);
        if (isNaN(joined.getTime())) return false;
        if (from && joined < from) return false;
        if (to && joined > to) return false;
      }

      if (!normalized) return true;

      const haystack = [
        user.username,
        user.name,
        user.entity,
        user.profile?.displayName,
        user.profile?.fullName,
        user.profile?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [users, tier, search, joinedFrom, joinedTo]);

  /* ============================
     PAGINATION
  ============================ */
  const totalPages = Math.max(Math.ceil(filteredUsers.length / PAGE_SIZE), 1);

  const { sort, toggle } = useTableSort<"name" | "joined">();
  const sortedUsers = useSortedRows(filteredUsers, sort, {
    name: (user) =>
      user.username || user.profile?.displayName || user.name || user.entity || "",
    joined: (user) => new Date(user.createdAt).getTime(),
  });

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedUsers.slice(start, start + PAGE_SIZE);
  }, [sortedUsers, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [tier, search]);

  useEffect(() => {
    const usersNeedingProgress = paginatedUsers.filter(
      (user) => user.id && !progressMap[user.id],
    );

    if (usersNeedingProgress.length === 0) return;

    let cancelled = false;

    const loadProgress = async () => {
      const results = await Promise.allSettled(
        usersNeedingProgress.map((user) => vipAdminApi.getUserVipProgress(user.id)),
      );

      if (cancelled) return;

      setProgressMap((prev) => {
        const next = { ...prev };
        results.forEach((result, index) => {
          if (result.status === "fulfilled") {
            next[usersNeedingProgress[index].id] = result.value.data;
          }
        });
        return next;
      });
    };

    void loadProgress();

    return () => {
      cancelled = true;
    };
  }, [paginatedUsers, progressMap]);

  const rows = useMemo<UserTierRow[]>(() => {
    return paginatedUsers.map((user, index) => {
      const progress = progressMap[user.id];
      const fallbackTier = user.vipTierId ? tierLookup.get(user.vipTierId) : undefined;
      const currentTier = progress?.currentTier ?? fallbackTier;
      const nextTierRequiredXp = progress?.nextTier?.xp_required ?? 0;
      const floorXp = Number(progress?.currentTier?.xp_required ?? 0);
      const userXp = Number(progress?.xp ?? 0);

      return {
        id: (currentPage - 1) * PAGE_SIZE + index + 1,
        name:
          user.username ||
          user.profile?.displayName ||
          user.profile?.fullName ||
          user.entity ||
          "N/A",
        currentType: currentTier ? currentTier.name : "-",
        currentXp: progress ? userXp.toLocaleString() : "-",
        progressPct: progress
          ? `${Number(tierProgressPct(userXp, floorXp, nextTierRequiredXp).toFixed(2))}%`
          : "-",
        tierFloorXp:
          progress && Number.isFinite(floorXp) ? floorXp.toLocaleString() : "-",
        xpToNextTier:
          progress && Number.isFinite(nextTierRequiredXp)
            ? Math.max(nextTierRequiredXp - userXp, 0).toLocaleString()
            : "-",
      };
    });
  }, [paginatedUsers, progressMap, tierLookup, currentPage]);

  const exportRows = useMemo<UserTierRow[]>(() => {
    return filteredUsers.map((user, index) => {
      const progress = progressMap[user.id];
      const fallbackTier = user.vipTierId ? tierLookup.get(user.vipTierId) : undefined;
      const currentTier = progress?.currentTier ?? fallbackTier;
      const nextTierRequiredXp = progress?.nextTier?.xp_required ?? 0;
      const floorXp = Number(progress?.currentTier?.xp_required ?? 0);
      const userXp = Number(progress?.xp ?? 0);

      return {
        id: index + 1,
        name:
          user.username ||
          user.profile?.displayName ||
          user.profile?.fullName ||
          user.entity ||
          "N/A",
        currentType: currentTier ? currentTier.name : "-",
        currentXp: progress ? userXp.toLocaleString() : "-",
        progressPct: progress
          ? `${Number(tierProgressPct(userXp, floorXp, nextTierRequiredXp).toFixed(2))}%`
          : "-",
        tierFloorXp:
          progress && Number.isFinite(floorXp) ? floorXp.toLocaleString() : "-",
        xpToNextTier:
          progress && Number.isFinite(nextTierRequiredXp)
            ? Math.max(nextTierRequiredXp - userXp, 0).toLocaleString()
            : "-",
      };
    });
  }, [filteredUsers, progressMap, tierLookup]);

  return (
    <div className="h-screen w-full bg-[#0a0e1a] p-3 md:p-6 flex flex-col">
      {/* HEADER */}
      <div className="bg-[#191D24] rounded-lg px-3 py-2 mb-3 md:px-4 md:mb-4">
        <h1 className="text-white text-base font-normal">
          VIP / User Tier
        </h1>
      </div>

      {/* FILTER BAR */}
      <div className="bg-[#191D24] rounded-lg p-2 mb-3 md:mb-4">
        <FilterToolbar
          className="mb-0"
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value);
            setCurrentPage(1);
          }}
          searchPlaceholder="Search by username"
          activeCount={
            (tier !== "all" ? 1 : 0) + (joinedFrom || joinedTo ? 1 : 0)
          }
          onOpenFilters={() => setSheetOpen(true)}
          actions={
            <ExportCSV
      data={exportRows}
      fileName="vip_user_tier.csv"
      headers={[
        "ID",
        "Name",
        "Current Tier",
        "Current XP",
        "Progress",
        "Tier XP Requirement",
        "XP To Next Tier",
      ]}
      mapRow={(row) => [
        row.id,
        row.name,
        row.currentType,
        row.currentXp,
        row.progressPct,
        row.tierFloorXp,
        row.xpToNextTier,
      ]}
            />
          }
        />
      </div>

      <EntityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="User Tier Filters"
        description="Narrow which players this list shows."
        fields={USER_TIER_FILTER_FIELDS}
        values={{ tier, from: joinedFrom, to: joinedTo }}
        defaults={USER_TIER_FILTER_DEFAULTS}
        onApply={(values) => {
          setTier(values.tier ?? "all");
          setJoinedFrom(values.from ?? "");
          setJoinedTo(values.to ?? "");
          setCurrentPage(1);
        }}
      />

      {/* TABLE */}
      {/* A column, so the rows take the leftover height and the pager keeps its
          own band. With the scroller on `h-full` it claimed the whole card and
          `overflow-hidden` clipped the pager out of sight. */}
      <div className="flex min-h-0 flex-1 flex-col bg-[#15181E] rounded-lg overflow-hidden">
        <div className="min-h-0 flex-1 overflow-auto scrollbar-hide">
          <table className="w-full min-w-[900px] table-fixed">
            <thead className="bg-[#242B35] sticky top-0">
              <tr>
                 <th className="px-6 py-3 text-left text-xs text-white w-[35%]">
                  ID
                </th>
                <SortableTh
                  label="Name"
                  sortKey="name"
                  sort={sort}
                  onToggle={toggle}
                  className="px-6 py-3 text-left text-xs text-white w-[35%]"
                />
                <th className="px-6 py-3 text-left text-xs text-white w-[25%]">
                 Current Tier
                </th>
                <th className="px-6 py-3 text-left text-xs text-white w-[40%]">
                  Progress  
                </th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-400">
                    Loading user tiers...
                  </td>
                </tr>
              )}

              {!loading && error && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-sm text-red-400">
                    {error}
                  </td>
                </tr>
              )}

              {!loading && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-10">
                    <NoData title="No users found" />
                  </td>
                </tr>
              )}

              {!loading && !error && rows.map((row, index) => (
                <tr
                  key={index}
                  className={index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"}
                >
                  <td className="px-6 py-5 text-sm text-gray-300">
                    {row.id}
                  </td>
                  <td className="px-6 py-5 text-sm text-gray-300 uppercase">
                    {row.name}
                  </td>
                  <td className="px-6 py-5 text-sm text-gray-300 uppercase">
                    {row.currentType}
                  </td>
                  <td className="px-6 py-5 text-sm text-gray-300">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Current XP : {row.currentXp}</li>
                      <li>Progress : {row.progressPct}</li>
                      <li>Tier XP Requirement : {row.tierFloorXp}</li>
                      <li>XP To Next Tier : {row.xpToNextTier}</li>
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && !error && totalPages > 1 && (
          <div className="shrink-0 mt-4 px-1 md:px-4">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
