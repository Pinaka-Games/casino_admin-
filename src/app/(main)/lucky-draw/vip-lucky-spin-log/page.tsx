"use client";

import React, { useEffect, useMemo, useState } from "react";
import ExportCSV from "@/components/ExportCSV/ExportCSV";
import CopyButton from "@/components/CopyButton";
import { useRouter } from "next/navigation";
import { ArrowLeft, Filter, X } from "lucide-react";

import Pagination from "@/components/Pagination";
import { useFreeSpinConfigStore } from "@/store/free-spin-config-store";
import GrantFiltersPanel, {
  countActiveFilters,
  describeActiveFilters,
  matchesGrantFilters,
  DEFAULT_GRANT_FILTERS,
  type GrantFilters,
  type GrantStatusFilter,
} from "../newbie-lucky-spin/GrantFiltersPanel";

/**
 * The log lists grants that already finished, so it opens on every finished
 * status rather than the allocation page's "granted".
 */
const LOG_DEFAULT_FILTERS: GrantFilters = { ...DEFAULT_GRANT_FILTERS, status: "all" };

const LOG_STATUS_OPTIONS: { value: GrantStatusFilter; label: string }[] = [
  { value: "all", label: "All finished grants" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];
import ListSearch from "@/components/TableSearch/ListSearch";
import { parseGrantSource } from "@/lib/free-spin-source";
import AllocationDetailModal from "@/components/free-spin/AllocationDetailModal";
import {
  describeAllocationGames,
  groupGrantsByAllocation,
  type GrantAllocation,
} from "@/lib/free-spin-grants";
import { useFreeSpinGrantsStore } from "@/store/free-spin-grants-store";

const PAGE_SIZE = 10;

const formatDateTime = (value?: string) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

/**
 * Date over time, so the Granted and Expires columns stop running into each
 * other. Same treatment as the allocation table.
 */
const DateTimeCell = ({ value }: { value?: string }) => {
  if (!value) return <span className="text-gray-500">-</span>;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <span className="text-gray-500">-</span>;

  const day = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return (
    <div className="leading-tight">
      <p className="whitespace-nowrap text-gray-300">{day}</p>
      <p className="whitespace-nowrap text-[10px] text-gray-500">{time}</p>
    </div>
  );
};

export default function VipLuckySpinLog() {
  const router = useRouter();
  const grants = useFreeSpinGrantsStore((s) => s.grants);
  const loading = useFreeSpinGrantsStore((s) => s.loadingGrants);
  const fetchGrants = useFreeSpinGrantsStore((s) => s.fetchGrants);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<GrantFilters>(LOG_DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [detail, setDetail] = useState<GrantAllocation | null>(null);

  const configs = useFreeSpinConfigStore((s) => s.configs);
  const fetchConfigs = useFreeSpinConfigStore((s) => s.fetchConfigs);

  useEffect(() => {
    fetchGrants();
  }, [fetchGrants]);

  useEffect(() => {
    void fetchConfigs();
  }, [fetchConfigs]);

  const activeCount = countActiveFilters(filters, LOG_DEFAULT_FILTERS);
  const activeChips = useMemo(
    () => describeActiveFilters(filters, configs, LOG_DEFAULT_FILTERS),
    [filters, configs],
  );

  const filteredGrants = useMemo(() => {
    // This screen is the history view: only grants that have finished one way
    // or another. The Status filter narrows within that, it can't widen it.
    const finished = grants.filter((grant) => {
      const statusNorm = (grant.status ?? "").toLowerCase();
      return statusNorm === "completed" || statusNorm === "cancelled";
    });

    const matched = finished.filter((grant) => matchesGrantFilters(grant, filters));

    const term = search.trim().toLowerCase();
    if (!term) return matched;

    return matched.filter((grant) => {
      const values = [
        grant.username,
        grant.contact,
        grant.userId,
        grant.config?.name,
        grant.bonusLabel,
        grant.config?.softwareName,
        grant.softwareName,
        String(grant.config?.softwareId ?? grant.softwareId ?? ""),
        grant.config?.gameName,
        grant.gameName,
        String(grant.config?.gameId ?? grant.gameId ?? ""),
        grant.sourceTransactionId,
        // Support arrives with AleaPlay's id, so it has to be searchable.
        grant.aleaBonusId,
        grant.status,
      ];

      return values.some((value) => String(value ?? "").toLowerCase().includes(term));
    });
  }, [grants, search, filters]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filters]);

  // One row per assignment, matching the allocation table — a 3-game template
  // finished as one thing, not three.
  const allocations = useMemo(
    () => groupGrantsByAllocation(filteredGrants),
    [filteredGrants],
  );

  const totalPages = Math.max(1, Math.ceil(allocations.length / PAGE_SIZE));

  const paginatedGrants = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return allocations.slice(start, start + PAGE_SIZE);
  }, [currentPage, allocations]);

  return (
    <div className="min-h-screen flex flex-col bg-[#15181E] p-3 md:p-6 overflow-hidden">
      {/* Reached from Free Spin Allocation, so the way back has to be here —
          this page has no sidebar entry to return to. */}
      <div className="bg-[#191D24] mb-3 px-3 py-2 rounded-lg flex flex-col items-stretch gap-2 md:mb-4 md:flex-row md:items-center md:justify-between md:gap-3 md:px-4">
        <h1 className="text-base font-normal text-white">
          VIP / Spin Activity Log
        </h1>
        <button
          onClick={() => router.push("/lucky-draw/newbie-lucky-spin")}
          className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-gray-700 bg-[#242B35] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[#2b3340]"
        >
          <ArrowLeft size={14} />
          Back to Allocation
        </button>
      </div>

      {/* Same toolbar shape as Free Spin Allocation. */}
      <div className="bg-[#191D24] rounded-lg p-2 sm:p-3 mb-3 flex flex-wrap items-center gap-2 sm:gap-3 md:mb-4">
        <div className="min-w-0 flex-1 sm:min-w-[240px]">
          <ListSearch
            value={search}
            onChange={setSearch}
            showButton={false}
            placeholder="Search by email, phone, config, game, software, bonus ID..."
          />
        </div>

        <button
          onClick={() => setFiltersOpen(true)}
          className="relative flex items-center gap-2 h-9 px-4 bg-[#242B35] hover:bg-[#2b3340] border border-gray-700 text-white text-sm rounded-lg font-medium transition-colors"
        >
          <Filter size={16} className="text-[#B93DEB]" />
          Filters
          {activeCount > 0 && (
            <span className="ml-1 rounded-full bg-purple-600 px-1.5 text-[10px] font-bold leading-4">
              {activeCount}
            </span>
          )}
        </button>

        <ExportCSV
          data={allocations}
          fileName="spin_activity_log.csv"
          getRowDate={(allocation) => allocation.grantedAt}
          headers={[
            "Player",
            "Username",
            "Source",
            "Config",
            "Spins Used",
            "Software",
            "Game",
            "Granted",
            "Expires",
            "Status",
          ]}
          mapRow={(allocation) => [
            allocation.contact || allocation.username || allocation.userId || "-",
            allocation.username ?? "-",
            parseGrantSource(allocation.bonusLabel).label,
            allocation.configName ?? "-",
            allocation.totalSpins
              ? `${allocation.totalSpinsUsed}/${allocation.totalSpins}`
              : "-",
            allocation.softwareName ?? "-",
            describeAllocationGames(allocation),
            allocation.grantedAt
              ? new Date(allocation.grantedAt).toLocaleString()
              : "-",
            allocation.expiresAt
              ? new Date(allocation.expiresAt).toLocaleString()
              : "-",
            allocation.status,
          ]}
        />
      </div>

      {activeChips.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 px-1">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() =>
                setFilters((f) => ({ ...f, [chip.key]: LOG_DEFAULT_FILTERS[chip.key] }))
              }
              className="flex items-center gap-1 rounded-full bg-purple-600/20 px-2.5 py-1 text-[11px] text-purple-200 hover:bg-purple-600/30"
              title="Remove this filter"
            >
              {chip.label}
              <X size={11} />
            </button>
          ))}
          {activeChips.length > 1 && (
            <button
              type="button"
              onClick={() => setFilters(LOG_DEFAULT_FILTERS)}
              className="text-[11px] text-gray-400 underline underline-offset-2 hover:text-white"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Read-only: the log is history, cancelling belongs on the allocation page. */}
      <AllocationDetailModal
        allocation={detail}
        onClose={() => setDetail(null)}
        readOnly
      />

      <GrantFiltersPanel
        open={filtersOpen}
        value={filters}
        configs={configs}
        statusOptions={LOG_STATUS_OPTIONS}
        defaults={LOG_DEFAULT_FILTERS}
        onApply={setFilters}
        onClose={() => setFiltersOpen(false)}
      />

      <div className="flex-1 overflow-x-auto overflow-y-auto rounded-lg bg-[#15181E] scrollbar-hide border border-gray-800">
        <table className="w-full min-w-[1180px] table-fixed">
          <thead className="bg-[#242B35]">
            <tr className="border-b border-gray-800">
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs text-white">Player</th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs text-white">Source</th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs text-white">Config</th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs text-white">Spins used</th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs text-white">Software</th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs text-white">Game</th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs text-white">Granted</th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs text-white">Expires</th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs text-white">Status</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-400">
                  Loading grant logs...
                </td>
              </tr>
            ) : paginatedGrants.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-500">
                  No free spin grant logs found
                </td>
              </tr>
            ) : (
              paginatedGrants.map((allocation, index) => {
                const statusNorm = allocation.status.toLowerCase();
                const statusColor =
                  statusNorm === "granted" || statusNorm === "active"
                    ? "bg-green-500/20 text-green-400"
                    : statusNorm === "cancelled"
                      ? "bg-red-500/20 text-red-400"
                      : statusNorm === "completed" || statusNorm === "used"
                        ? "bg-blue-500/20 text-blue-400"
                        : statusNorm === "partial"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-gray-500/20 text-gray-400";
                const source = parseGrantSource(allocation.bonusLabel);
                // AleaPlay's bonus id is NOT a column here either — it is in
                // the detail view (rows open it on click) and remains
                // searchable from the box above.

                return (
                  <tr
                    key={allocation.key}
                    className={`${
                      index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                    } hover:bg-[#1a2030] cursor-pointer`}
                    onClick={() => setDetail(allocation)}
                  >
                    {/* Email or phone — how support and AleaPlay identify a
                        player. Username underneath ties the two together. */}
                    <td className="px-4 py-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <p
                          className="min-w-0 truncate text-gray-200"
                          title={allocation.contact || allocation.username || allocation.userId || "-"}
                        >
                          {allocation.contact || allocation.username || allocation.userId || "-"}
                        </p>
                        <CopyButton
                          value={
                            allocation.contact || allocation.username || allocation.userId
                          }
                          size={12}
                        />
                      </div>
                      {allocation.contact && allocation.username && (
                        <p className="text-[10px] text-gray-500 break-all">
                          {allocation.username}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={`px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${source.badgeClass}`}
                        title={allocation.bonusLabel ?? "Manual grant"}
                      >
                        {source.label}
                        {source.detail ? ` · ${source.detail}` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-300">
                      {allocation.configName}
                    </td>
                    {/* How much of the assignment was played. */}
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {allocation.totalSpins ? (
                        <span
                          className={
                            allocation.totalSpinsUsed >= allocation.totalSpins
                              ? "text-gray-500"
                              : allocation.totalSpinsUsed > 0
                                ? "text-amber-300"
                                : "text-gray-400"
                          }
                        >
                          {allocation.totalSpinsUsed}/{allocation.totalSpins}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-300">
                      {allocation.softwareName ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-300">
                      {describeAllocationGames(allocation)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <DateTimeCell value={allocation.grantedAt} />
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <DateTimeCell value={allocation.expiresAt} />
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-medium uppercase tracking-wide ${statusColor}`}>
                        {statusNorm || "unknown"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && totalPages > 1 && (
        <div className="mt-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
}
