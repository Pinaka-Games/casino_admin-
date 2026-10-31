"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  SortableTh,
  useSortedRows,
  useTableSort,
} from "@/components/filters/tableSort";
import FilterToolbar from "@/components/filters/FilterToolbar";
import EntityFilterSheet from "@/components/filters/EntityFilterSheet";
import { useEntityFilters } from "@/components/filters/useEntityFilters";
import { applyClientFilters } from "@/components/filters/applyClientFilters";
import type { FilterField, FilterValues } from "@/components/filters/types";
import NoData from "@/components/NoData";
import { profileApi } from "@/api/users/users";
import { ReferralDetail } from "@/types/profile.type";
import Pagination from "@/components/Pagination";
import { format, parseISO, isSameDay } from "date-fns";
import { Loader2, User as UserIcon, Calendar, FilterX, Search, CircleDollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import UsDateInput from "@/components/UsDateInput";

const PAGE_SIZE = 10;


const DOWNLINE_FILTER_DEFAULTS: FilterValues = {
  search: "",
  earning: "all",
  from: "",
  to: "",
  minWagered: "",
  maxWagered: "",
  minCommission: "",
  maxCommission: "",
};

const DOWNLINE_FILTER_FIELDS: FilterField[] = [
  {
    type: "select",
    key: "earning",
    label: "Commission",
    options: [
      { label: "All Players", value: "all" },
      { label: "Earning (positive)", value: "positive" },
      { label: "Costing (negative)", value: "negative" },
      { label: "No commission yet", value: "zero" },
    ],
  },
  { type: "dateRange", fromKey: "from", toKey: "to", label: "Joined Between" },
  { type: "numberRange", minKey: "minWagered", maxKey: "maxWagered", label: "Wagered" },
  { type: "numberRange", minKey: "minCommission", maxKey: "maxCommission", label: "Commission" },
];
const DownlineTab = ({ userId }: { userId: string }) => {
  const [loading, setLoading] = useState(false);
  const [referrals, setReferrals] = useState<ReferralDetail[]>([]);
  const [page, setPage] = useState(1);

  const {
    values: filters,
    setValues: setFilters,
    searchInput,
    setSearchInput,
    sheetOpen,
    setSheetOpen,
    chips,
    activeCount,
    hasAnyFilter,
    reset: resetFilters,
  } = useEntityFilters({
    fields: DOWNLINE_FILTER_FIELDS,
    defaults: DOWNLINE_FILTER_DEFAULTS,
  });

  const fetchDownline = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const response = await profileApi.getAgentReferralStatsById(userId);
      setReferrals(response.data.referrals || []);
    } catch (error) {
      console.error("Failed to fetch downline", error);
      setReferrals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDownline();
  }, [userId]);

  /* ============================
     FILTER & SORTING logic
  ============================ */
  const filteredRows = useMemo(() => {
    // Latest first, then the shared filters — a single-day picker used to be the
    // only choice here; the sheet offers a real range plus amount filters.
    const sorted = [...referrals].sort(
      (a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime(),
    );

    return applyClientFilters(sorted, filters, {
      search: (row) => [row.username, row.email],
      selects: [
        {
          key: "earning",
          match: (row, v) => {
            const commission = Number(row.totalIncome || 0);
            if (v === "positive") return commission > 0;
            if (v === "negative") return commission < 0;
            return commission === 0;
          },
        },
      ],
      dateRange: { fromKey: "from", toKey: "to", get: (row) => row.joinedAt },
      numberRanges: [
        { minKey: "minWagered", maxKey: "maxWagered", get: (row) => Number(row.totalWagered || 0) },
        {
          minKey: "minCommission",
          maxKey: "maxCommission",
          get: (row) => Number(row.totalIncome || 0),
        },
      ],
    });
  }, [referrals, filters]);

  const { sort, toggle } = useTableSort<"joined" | "wagered" | "ggr" | "commission">();
  const displayRows = useSortedRows(filteredRows, sort, {
    joined: (row) => new Date(row.joinedAt).getTime(),
    wagered: (row) => Number(row.totalWagered || 0),
    // Same fallback the cell renders, so the order matches the figures shown.
    ggr: (row) => Number(row.totalGgr ?? row.totalLoss ?? 0),
    commission: (row) => Number(row.totalIncome || 0),
  });

  useEffect(() => {
    setPage(1);
  }, [filters]);

  /* ============================
     PAGINATION (Client-side)
  ============================ */
  const totalPages = Math.ceil(displayRows.length / PAGE_SIZE);
  const paginatedReferrals = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return displayRows.slice(start, start + PAGE_SIZE);
  }, [displayRows, page]);

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <FilterToolbar
        title="Downline"
        countLabel={`${displayRows.length} ${displayRows.length === 1 ? "player" : "players"}`}
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search username or email"
        activeCount={activeCount}
        chips={chips}
        hasAnyFilter={hasAnyFilter}
        onOpenFilters={() => setSheetOpen(true)}
        onResetAll={resetFilters}
      />

      <div className="bg-[#191D24] rounded-xl border border-gray-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left border-collapse">
            <thead className="bg-black/20 border-b border-gray-800">
              <tr>
                <th className="px-6 py-4 text-gray-400 font-bold uppercase text-[10px] tracking-wider">Player Info</th>
                <SortableTh
                  label="Join Date"
                  sortKey="joined"
                  sort={sort}
                  onToggle={toggle}
                  align="left"
                  className="px-6 py-4 text-gray-400 font-bold uppercase text-[10px] tracking-wider"
                />
                <SortableTh
                  label="Wagered"
                  sortKey="wagered"
                  sort={sort}
                  onToggle={toggle}
                  align="right"
                  className="px-6 py-4 text-right text-gray-400 font-bold uppercase text-[10px] tracking-wider"
                />
                <SortableTh
                  label="GGR (Loss)"
                  sortKey="ggr"
                  sort={sort}
                  onToggle={toggle}
                  align="right"
                  className="px-6 py-4 text-right text-gray-400 font-bold uppercase text-[10px] tracking-wider"
                />
                <SortableTh
                  label="Commission"
                  sortKey="commission"
                  sort={sort}
                  onToggle={toggle}
                  align="right"
                  className="px-6 py-4 text-right text-gray-400 font-bold uppercase text-[10px] tracking-wider"
                />
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-800/50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-[#B93DEB] mx-auto" />
                    <p className="text-gray-500 text-xs mt-4">Loading detailed downline data...</p>
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-24">
                    <NoData
                      title={
                        hasAnyFilter
                          ? "No players match these filters"
                          : "No players found in this downline"
                      }
                    />
                  </td>
                </tr>
              ) : (
                paginatedReferrals.map((row) => (
                  <tr key={row.refereeId} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600/20 to-blue-600/20 flex items-center justify-center border border-white/5">
                          <UserIcon size={16} className="text-purple-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors">
                            {row.username}
                          </p>
                          <p className="text-[10px] text-gray-500 font-medium">
                            {row.email || "No email provided"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-300 text-sm">
                        <Calendar size={14} className="text-gray-500" />
                        {row.joinedAt ? format(new Date(row.joinedAt), "MMM dd, yyyy") : "N/A"}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-medium text-gray-300">
                        {row.totalWagered.toFixed(2)}
                      </p>
                    </td>
                    {/* GGR is the house result and is SIGNED — positive when the
                        player lost, negative when they won. It was painted red
                        unconditionally, so a player the house profited on read
                        as a loss. Commission is signed too: on a period the
                        referees finished ahead, NGR goes negative and the
                        agent's commission with it. */}
                    <td className="px-6 py-4 text-right">
                      <p
                        className={`text-sm font-bold ${
                          row.totalLoss >= 0 ? "text-emerald-400" : "text-red-500/80"
                        }`}
                      >
                        {row.totalLoss.toFixed(2)}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span
                          className={`text-sm font-black italic ${
                            row.totalIncome >= 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {row.totalIncome.toFixed(2)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}

      <EntityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Downline Filters"
        description="Filter this agent's referred players"
        fields={DOWNLINE_FILTER_FIELDS}
        values={filters}
        defaults={DOWNLINE_FILTER_DEFAULTS}
        onApply={setFilters}
      />
    </div>
  );
};

export default DownlineTab;
