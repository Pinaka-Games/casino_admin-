"use client";

import React, { useEffect, useMemo, useState } from "react";
import UsDateInput from "@/components/UsDateInput";

import { profileApi } from "@/api/users/users";
import Pagination from "@/components/Pagination";
import ListSearch from "@/components/TableSearch/ListSearch";
import {
  GRANT_SOURCE_OPTIONS,
  GrantSourceKind,
  parseGrantSource,
} from "@/lib/free-spin-source";
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

export default function NewbieLuckySpinLog() {
  const grants = useFreeSpinGrantsStore((s) => s.grants);
  const loading = useFreeSpinGrantsStore((s) => s.loadingGrants);
  const fetchGrants = useFreeSpinGrantsStore((s) => s.fetchGrants);
  const [usernamesById, setUsernamesById] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<GrantSourceKind | "all">("all");
  // Granted-date bounds; whole days, inclusive of both ends.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchGrants();
  }, [fetchGrants]);

  useEffect(() => {
    const userIds = Array.from(
      new Set(grants.map((grant) => grant.userId).filter(Boolean))
    );

    if (userIds.length === 0) {
      setUsernamesById({});
      return;
    }

    const loadUsernames = async () => {
      const results = await Promise.allSettled(
        userIds.map(async (userId) => {
          const response = await profileApi.getUserProfile(userId);
          return {
            userId,
            username:
              response.data.username ||
              response.data.profile?.fullName ||
              response.data.profile?.displayName ||
              userId,
          };
        })
      );

      const nextMap: Record<string, string> = {};
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          nextMap[result.value.userId] = result.value.username;
        }
      });

      setUsernamesById(nextMap);
    };

    loadUsernames();
  }, [grants]);

  const filteredGrants = useMemo(() => {
    // Filter by status: only show "completed" status
    const statusFiltered = grants.filter((grant) => {
      const statusNorm = (grant.status ?? "").toLowerCase();
      return statusNorm === "completed";
    });

    // Filter by source kind (welcome / streak / subscription / etc.)
    const sourceFiltered =
      sourceFilter === "all"
        ? statusFiltered
        : statusFiltered.filter(
            (grant) => parseGrantSource(grant.bonusLabel).kind === sourceFilter,
          );

    const fromDate = from ? new Date(`${from}T00:00:00`) : null;
    const toDate = to ? new Date(`${to}T23:59:59.999`) : null;
    const dateFiltered =
      fromDate || toDate
        ? sourceFiltered.filter((grant) => {
            const grantedAt = new Date(grant.grantedAt);
            if (isNaN(grantedAt.getTime())) return false;
            if (fromDate && grantedAt < fromDate) return false;
            if (toDate && grantedAt > toDate) return false;
            return true;
          })
        : sourceFiltered;

    const term = search.trim().toLowerCase();
    if (!term) return dateFiltered;

    return dateFiltered.filter((grant) => {
      const values = [
        usernamesById[grant.userId] ?? grant.userId,
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
        grant.status,
      ];

      return values.some((value) => String(value ?? "").toLowerCase().includes(term));
    });
  }, [grants, search, sourceFilter, usernamesById, from, to]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, sourceFilter, from, to]);

  const totalPages = Math.max(1, Math.ceil(filteredGrants.length / PAGE_SIZE));

  const paginatedGrants = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredGrants.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredGrants]);

  return (
    <div className="min-h-screen flex flex-col bg-[#15181E] p-3 md:p-6 overflow-hidden">
      <div className="bg-[#191D24] mb-3 px-3 py-2 rounded-lg md:mb-4 md:px-4">
        <h1 className="text-base font-normal text-white">
          Newbie / Lucky Spin Log
        </h1>
      </div>

      <div className="bg-[#15181E] rounded-lg p-2 mb-3 flex flex-wrap items-center gap-3 md:mb-4">
        <div className="flex-1 min-w-[200px]">
          <ListSearch
            value={search}
            onChange={setSearch}
            placeholder="Search by username, config, game, software, transaction ID..."
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-400">Granted:</span>
          <UsDateInput
            value={from}
            onChange={setFrom}
            className="bg-[#242B35] border border-gray-700 rounded px-2 h-8 flex items-center text-white text-xs"
          />
          <span className="text-xs text-gray-500">to</span>
          <UsDateInput
            value={to}
            onChange={setTo}
            className="bg-[#242B35] border border-gray-700 rounded px-2 h-8 flex items-center text-white text-xs"
          />
          {(from || to) && (
            <button
              type="button"
              onClick={() => {
                setFrom("");
                setTo("");
              }}
              className="rounded bg-white/5 px-2 py-1 text-[11px] uppercase tracking-wider text-gray-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-400">Source:</span>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as GrantSourceKind | "all")}
            className="bg-[#242B35] border border-gray-700 rounded px-2 py-1.5 text-white text-xs focus:border-purple-500 focus:outline-none"
          >
            <option value="all">All sources</option>
            {GRANT_SOURCE_OPTIONS.map(({ kind, label }) => (
              <option key={kind} value={kind}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-auto rounded-lg bg-[#15181E] scrollbar-hide border border-gray-800">
        <table className="w-full min-w-[960px] table-fixed">
          <thead className="bg-[#242B35]">
            <tr className="border-b border-gray-800">
              <th className="px-4 py-3 text-left text-xs text-white">Username</th>
              <th className="px-4 py-3 text-left text-xs text-white">Source</th>
              <th className="px-4 py-3 text-left text-xs text-white">Config</th>
              <th className="px-4 py-3 text-left text-xs text-white">Spins</th>
              <th className="px-4 py-3 text-left text-xs text-white">Software</th>
              <th className="px-4 py-3 text-left text-xs text-white">Game</th>
              <th className="px-4 py-3 text-left text-xs text-white">Transaction ID</th>
              <th className="px-4 py-3 text-left text-xs text-white">Granted</th>
              <th className="px-4 py-3 text-left text-xs text-white">Expires</th>
              <th className="px-4 py-3 text-left text-xs text-white">Status</th>
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
              paginatedGrants.map((grant, index) => {
                const statusNorm = (grant.status ?? "").toLowerCase();
                const statusColor =
                  statusNorm === "granted" || statusNorm === "active"
                    ? "bg-green-500/20 text-green-400"
                    : statusNorm === "cancelled"
                      ? "bg-red-500/20 text-red-400"
                      : statusNorm === "completed" || statusNorm === "used"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-gray-500/20 text-gray-400";
                const source = parseGrantSource(grant.bonusLabel);

                return (
                  <tr
                    key={grant.id}
                    className={`${
                      index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                    } hover:bg-[#1a2030]`}
                  >
                    <td className="px-4 py-3 text-xs text-gray-300 break-all">
                      {usernamesById[grant.userId] || grant.userId || "-"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span
                        className={`px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${source.badgeClass}`}
                        title={grant.bonusLabel ?? "Manual grant"}
                      >
                        {source.label}
                        {source.detail ? ` · ${source.detail}` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-300">
                      {grant.config?.name ?? grant.bonusLabel ?? "Manual Grant"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-300">
                      {grant.config?.numberOfFreeSpins ?? grant.spinsGranted ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-300">
                      {grant.config?.softwareName ?? grant.softwareName ?? grant.config?.softwareId ?? grant.softwareId ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-300">
                      {grant.config?.gameName ?? grant.gameName ?? grant.config?.gameId ?? grant.gameId ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-purple-300 font-mono break-all">
                      {grant.sourceTransactionId || "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-300">
                      {formatDateTime(grant.grantedAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-300">
                      {formatDateTime(grant.expiresAt)}
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
