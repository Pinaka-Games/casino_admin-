"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
// Only used by the Active Rollover cards (hidden below).
// import { Lock, Unlock } from "lucide-react";
import ExportCSV from "@/components/ExportCSV/ExportCSV";
import TableSkeleton from "@/components/TableSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
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
import Pagination from "@/components/Pagination/Pagination";
import NoData from "@/components/NoData/NoData";
import { coingreen } from "@/assets/icons";
import {
  wageringAdminApi,
  type RolloverListEntry,
  type RolloverStatus,
  // type RolloverSummary,
} from "@/api/wagering/wagering.api";

const PAGE_SIZE = 10;

// ─── Filters ─────────────────────────────────────────────────────────────────

const ROLLOVER_FILTER_DEFAULTS: FilterValues = {
  search: "",
  type: "all",
  status: "all",
  from: "",
  to: "",
  minAmount: "",
  maxAmount: "",
};

const ROLLOVER_FILTER_FIELDS: FilterField[] = [
  {
    type: "select",
    key: "type",
    label: "Type",
    options: [
      { label: "All Types", value: "all" },
      { label: "Deposit", value: "deposit" },
      { label: "Bonus", value: "bonus" },
      { label: "Winnings", value: "winnings" },
    ],
  },
  {
    type: "select",
    key: "status",
    label: "Status",
    options: [
      { label: "All Statuses", value: "all" },
      { label: "Not Started", value: "NOT_STARTED" },
      { label: "Ongoing", value: "ONGOING" },
      { label: "Completed", value: "DONE" },
      { label: "Expired", value: "EXPIRED" },
      { label: "Canceled", value: "CANCELED" },
    ],
  },
  { type: "dateRange", fromKey: "from", toKey: "to", label: "Date Range" },
  {
    type: "numberRange",
    minKey: "minAmount",
    maxKey: "maxAmount",
    label: "Amount",
  },
];

// ─── Formatting ──────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<RolloverStatus, string> = {
  NOT_STARTED: "Not Started",
  ONGOING: "Ongoing",
  DONE: "Completed",
  EXPIRED: "Expired",
  CANCELED: "Canceled",
};

const statusPillClass = (s: RolloverStatus) => {
  switch (s) {
    case "DONE":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "ONGOING":
      return "bg-orange-500/15 text-orange-300 border-orange-500/30";
    case "EXPIRED":
    case "CANCELED":
      return "bg-red-500/15 text-red-300 border-red-500/30";
    default:
      return "bg-gray-500/15 text-gray-300 border-gray-500/30";
  }
};

const barColor = (s: RolloverStatus) => {
  switch (s) {
    case "DONE":
      return "#4ade80";
    case "EXPIRED":
    case "CANCELED":
      return "#f87171";
    default:
      return "#FF9500";
  }
};

const typeLabel = (row: RolloverListEntry) => {
  if (row.type === "deposit") {
    return row.label && row.label !== "WulfCash Deposit" ? row.label : "Deposit";
  }
  if (row.type === "bonus") return "Bonus";
  if (row.type === "winnings") return "Winnings";
  return row.label;
};

const typeColor = (type: RolloverListEntry["type"]) =>
  type === "winnings" ? "text-amber-300" : "text-green-400";

const fmtAmount = (n: number) =>
  Number(n ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtMultiplier = (n: number) => {
  const v = Number(n ?? 0);
  return `${Number.isInteger(v) ? v : v.toFixed(2)}x`;
};

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

// ─── Summary cards ───────────────────────────────────────────────────────────
// Active Rollover cards hidden as requested — uncomment this, the summary
// state, the `Lock` / `Unlock` + `RolloverSummary` imports, and the block in
// the JSX to bring them back.

// const SummaryCard = ({
//   label,
//   value,
//   hint,
//   coin,
// }: {
//   label: string;
//   value: React.ReactNode;
//   hint?: string;
//   coin?: boolean;
// }) => (
//   <div className="bg-[#242B35] rounded-xl p-4">
//     <p className="text-gray-400 text-xs mb-1">{label}</p>
//     <div className="flex items-center gap-1.5 text-white text-lg font-semibold">
//       {coin && <Image src={coingreen} alt="" className="w-4 h-4" />}
//       {value}
//     </div>
//     {hint && <p className="text-gray-500 text-[11px] mt-1">{hint}</p>}
//   </div>
// );

// ─── Tab ─────────────────────────────────────────────────────────────────────

const RolloverTab = ({ username }: { username: string }) => {
  // The [username] route param is the user UUID (same as the other tabs).
  const userId = username;

  // const [summary, setSummary] = useState<RolloverSummary | null>(null);
  const [entries, setEntries] = useState<RolloverListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageState, setPageState] = useState<{ key: string; page: number }>({
    key: "",
    page: 1,
  });

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
    fields: ROLLOVER_FILTER_FIELDS,
    defaults: ROLLOVER_FILTER_DEFAULTS,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await wageringAdminApi.getUserRolloverList(userId);
        if (cancelled) return;
        // setSummary(res.data?.summary ?? null);
        setEntries(res.data?.entries ?? []);
      } catch (err) {
        console.error("Failed to fetch rollover data:", err);
        if (!cancelled) setError("Failed to load rollover data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (userId) load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const filtered = useMemo(
    () =>
      applyClientFilters(entries, filters, {
        search: (row) => [row.label, row.type, STATUS_LABEL[row.status], row.status],
        selects: [
          { key: "type", match: (row, v) => row.type === v },
          { key: "status", match: (row, v) => row.status === v },
        ],
        dateRange: { fromKey: "from", toKey: "to", get: (row) => row.createdAt ?? "" },
        numberRanges: [
          { minKey: "minAmount", maxKey: "maxAmount", get: (row) => Number(row.amount || 0) },
        ],
      }),
    [entries, filters],
  );

  const { sort, toggle } = useTableSort<
    "date" | "amount" | "multiplier" | "required" | "completed" | "progress" | "status"
  >();
  const sorted = useSortedRows(filtered, sort, {
    date: (row) => (row.createdAt ? new Date(row.createdAt).getTime() : 0),
    amount: (row) => Number(row.amount) || 0,
    multiplier: (row) => Number(row.wageringMultiplier) || 0,
    required: (row) => Number(row.wageringRequired) || 0,
    completed: (row) => Number(row.wageringCompleted) || 0,
    progress: (row) => Number(row.progressPct) || 0,
    status: (row) => row.status,
  });

  // Filters / sorting change the row set, so the page pointer restarts: the
  // stored page only counts while it was set under the current filter + sort.
  const resetKey = useMemo(() => JSON.stringify({ filters, sort }), [filters, sort]);
  const page = pageState.key === resetKey ? pageState.page : 1;
  const setPage = (next: number) => setPageState({ key: resetKey, page: next });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, page]);

  const thClass = "px-4 py-3 text-left text-white text-xs whitespace-nowrap";

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Active Rollover card skeleton — hidden with the cards. */}
        {/* <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl bg-[#242B35]" />
          ))}
        </div> */}
        <Skeleton className="h-4 w-40 bg-gray-700/40" />
        <div className="overflow-hidden rounded-lg border border-gray-800 bg-[#15181E]">
          <TableSkeleton rows={5} cols={8} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 text-red-400 text-sm">
        {error}
      </div>
    );
  }

  // const active = summary;

  return (
    <div className="space-y-8">
      {/* ================= ACTIVE ROLLOVER ================= */}
      {/* Hidden as requested — see the note above SummaryCard to restore. */}
      {/* <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-white text-base font-semibold">Active Rollover</p>
          {active && (
            <span
              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
                active.isLocked
                  ? "bg-red-500/15 text-red-300 border-red-500/30"
                  : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
              }`}
            >
              {active.isLocked ? (
                <Lock className="w-3 h-3" />
              ) : (
                <Unlock className="w-3 h-3" />
              )}
              {active.isLocked ? "Withdrawals locked" : "Withdrawals open"}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard
            label="Required"
            value={fmtAmount(active?.rolloverRequired ?? 0)}
            hint="Sum of open entries (amount × multiplier)"
            coin
          />
          <SummaryCard
            label="Wagered"
            value={fmtAmount(active?.rolloverCompleted ?? 0)}
            hint="Counted toward open entries"
            coin
          />
          <SummaryCard
            label="Remaining"
            value={fmtAmount(active?.rolloverRemaining ?? 0)}
            coin
          />
          <SummaryCard
            label="Progress"
            value={`${Math.round(active?.rolloverProgressPct ?? 0)}%`}
            hint={
              active && active.rolloverRequired > 0
                ? active.isComplete
                  ? "Complete"
                  : "In progress"
                : "No active rollover"
            }
          />
        </div>

        <div className="grid grid-cols-3 gap-3 mt-3">
          <SummaryCard
            label="All-time Wagered"
            value={fmtAmount(active?.totalWagered ?? 0)}
            coin
          />
          <SummaryCard
            label="All-time Bonus Wagered"
            value={fmtAmount(active?.totalBonusWagered ?? 0)}
            coin
          />
          <SummaryCard
            label="Bets Placed"
            value={(active?.betCount ?? 0).toLocaleString("en-US")}
          />
        </div>
      </div> */}

      {/* ================= ENTRIES ================= */}
      <div>
        <FilterToolbar
          title="Rollover Entries"
          countLabel={`${sorted.length} ${sorted.length === 1 ? "record" : "records"}`}
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder="Search label, type or status"
          activeCount={activeCount}
          chips={chips}
          hasAnyFilter={hasAnyFilter}
          onOpenFilters={() => setSheetOpen(true)}
          actions={
            <ExportCSV<RolloverListEntry>
              data={sorted}
              fileName="rollover_entries.csv"
              headers={[
                "Date",
                "Type",
                "Label",
                "Amount",
                "Multiplier",
                "Wagering Required",
                "Wagered",
                "Progress %",
                "Status",
                // "Expires",
              ]}
              getRowDate={(row) => row.createdAt ?? ""}
              mapRow={(row) => [
                fmtDate(row.createdAt),
                row.type,
                row.label || "-",
                Number(row.amount || 0).toFixed(2),
                fmtMultiplier(row.wageringMultiplier),
                Number(row.wageringRequired || 0).toFixed(2),
                Number(row.wageringCompleted || 0).toFixed(2),
                String(Math.round(row.progressPct || 0)),
                STATUS_LABEL[row.status] ?? row.status,
                // fmtDate(row.expiresAt),
              ]}
            />
          }
          onResetAll={resetFilters}
        />

        <div className="rounded-lg bg-[#15181E] overflow-x-auto">
          <table className="w-full min-w-[960px] table-auto">
            <thead className="bg-[#242B35]">
              <tr className="border-b border-gray-800">
                <th className={thClass}>Type</th>
                <SortableTh label="Date" sortKey="date" sort={sort} onToggle={toggle} className={thClass} />
                <SortableTh label="Amount" sortKey="amount" sort={sort} onToggle={toggle} className={thClass} />
                <SortableTh label="Multiplier" sortKey="multiplier" sort={sort} onToggle={toggle} className={thClass} />
                <SortableTh label="Required" sortKey="required" sort={sort} onToggle={toggle} className={thClass} />
                <SortableTh label="Wagered" sortKey="completed" sort={sort} onToggle={toggle} className={thClass} />
                <SortableTh label="Progress" sortKey="progress" sort={sort} onToggle={toggle} className={thClass} />
                {/* Expires column hidden as requested. */}
                {/* <th className={thClass}>Expires</th> */}
                <SortableTh label="Status" sortKey="status" sort={sort} onToggle={toggle} className={thClass} />
              </tr>
            </thead>

            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12">
                    <NoData
                      title={
                        hasAnyFilter
                          ? "No records match these filters"
                          : "No rollover records found"
                      }
                    />
                  </td>
                </tr>
              ) : (
                pageRows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-[#1a2030] ${
                      index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                    }`}
                  >
                    {/* Type / label */}
                    <td className="px-4 py-4 text-left text-xs whitespace-nowrap max-w-[220px]">
                      <span
                        className={`font-semibold ${typeColor(row.type)} block truncate`}
                        title={row.label || undefined}
                      >
                        {typeLabel(row)}
                      </span>
                      {row.type !== "deposit" && row.label && (
                        <span className="block text-[11px] text-gray-400 truncate">
                          {row.label}
                        </span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-4 text-left text-xs text-gray-300 whitespace-nowrap">
                      {fmtDate(row.createdAt)}
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-4 text-left text-xs whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-green-400">
                        <Image src={coingreen} alt="" className="w-4 h-4" />
                        {fmtAmount(row.amount)}
                      </span>
                    </td>

                    {/* Multiplier */}
                    <td className="px-4 py-4 text-left text-xs whitespace-nowrap">
                      <span className="inline-flex items-center rounded-md border border-[#B93DEB]/40 bg-[#B93DEB]/10 px-2 py-0.5 font-semibold text-[#D08BF5]">
                        {fmtMultiplier(row.wageringMultiplier)}
                      </span>
                    </td>

                    {/* Required */}
                    <td className="px-4 py-4 text-left text-xs text-white whitespace-nowrap">
                      {fmtAmount(row.wageringRequired)}
                    </td>

                    {/* Wagered */}
                    <td className="px-4 py-4 text-left text-xs text-white whitespace-nowrap">
                      {fmtAmount(row.wageringCompleted)}
                    </td>

                    {/* Progress */}
                    <td className="px-4 py-4 text-left text-xs whitespace-nowrap min-w-[140px]">
                      <div className="flex flex-col gap-1">
                        <span className="text-gray-300 font-semibold">
                          {Math.round(row.progressPct)}%
                        </span>
                        <div className="w-full h-1.5 bg-[#2A303C] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, Math.max(0, row.progressPct))}%`,
                              background: barColor(row.status),
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Expires — hidden as requested. */}
                    {/* <td className="px-4 py-4 text-left text-xs text-gray-300 whitespace-nowrap">
                      {fmtDate(row.expiresAt)}
                    </td> */}

                    {/* Status */}
                    <td className="px-4 py-4 text-left text-xs whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 font-medium ${statusPillClass(
                          row.status,
                        )}`}
                      >
                        {STATUS_LABEL[row.status] ?? row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {sorted.length > PAGE_SIZE && (
          <div className="mt-4">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <EntityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Rollover Filters"
        description="Filter this player's rollover entries"
        fields={ROLLOVER_FILTER_FIELDS}
        values={filters}
        defaults={ROLLOVER_FILTER_DEFAULTS}
        onApply={setFilters}
      />
    </div>
  );
};

export default RolloverTab;
