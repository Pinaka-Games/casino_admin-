"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import {
  SortableTh,
  useSortedRows,
  useTableSort,
} from "@/components/filters/tableSort";
import ExportCSV from "@/components/ExportCSV/ExportCSV";
import TableSkeleton from "@/components/TableSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";

import NoData from "@/components/NoData";
import FilterToolbar from "@/components/filters/FilterToolbar";
import EntityFilterSheet from "@/components/filters/EntityFilterSheet";
import { useEntityFilters } from "@/components/filters/useEntityFilters";
import { applyClientFilters } from "@/components/filters/applyClientFilters";
import type { FilterField, FilterValues } from "@/components/filters/types";
import {
  responsibleGamingApi,
  endDateLabel,
  RESTRICTION_STATUS_STYLE,
  RESTRICTION_TYPE_LABEL,
  type PlayerRestrictionDetail,
} from "@/api/responsible-gaming/responsible-gaming.api";
import RestrictionDetailModal from "@/app/(main)/users/responsible-gaming/components/RestrictionDetailModal";

const RG_FILTER_DEFAULTS: FilterValues = {
  search: "",
  type: "all",
  status: "all",
  source: "all",
  from: "",
  to: "",
};

const RG_FILTER_FIELDS: FilterField[] = [
  {
    type: "select",
    key: "type",
    label: "Type",
    options: [
      { label: "All Types", value: "all" },
      { label: "Pause", value: "PAUSE" },
      { label: "Self Exclusion", value: "SELF_EXCLUSION" },
    ],
  },
  {
    type: "select",
    key: "status",
    label: "Status",
    options: [
      { label: "All Statuses", value: "all" },
      { label: "Active", value: "ACTIVE" },
      { label: "Expired", value: "EXPIRED" },
      { label: "Lifted", value: "LIFTED" },
      { label: "Superseded", value: "SUPERSEDED" },
      { label: "Cancelled", value: "CANCELLED" },
    ],
  },
  {
    type: "select",
    key: "source",
    label: "Set By",
    options: [
      { label: "Anyone", value: "all" },
      { label: "Player", value: "PLAYER" },
      { label: "Admin", value: "ADMIN" },
      { label: "System", value: "SYSTEM" },
    ],
  },
  { type: "dateRange", fromKey: "from", toKey: "to", label: "Started Between" },
];

function fmt(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : "—";
}

/**
 * This player's Responsible Gaming record — feature 14.
 *
 * Reads the same endpoint as the Responsible Gaming page, so a restriction
 * lifted on either screen is reflected on the other without a sync step.
 */
export default function ResponsibleGamingTab({
  username,
}: {
  username: string;
}) {
  // The [username] route param is the user's UUID, as in every other tab.
  const userId = username;

  const [data, setData] = useState<PlayerRestrictionDetail | null>(null);
  const [loading, setLoading] = useState(true);

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
    fields: RG_FILTER_FIELDS,
    defaults: RG_FILTER_DEFAULTS,
  });

  const filteredHistory = useMemo(
    () =>
      applyClientFilters(data?.history ?? [], filters, {
        search: (r) => [r.periodLabel, r.liftReason, r.ipAddress, r.status, r.type],
        selects: [
          { key: "type", match: (r, v) => r.type === v },
          { key: "status", match: (r, v) => r.status === v },
          { key: "source", match: (r, v) => r.source === v },
        ],
        dateRange: { fromKey: "from", toKey: "to", get: (r) => r.startsAt },
      }),
    [data, filters]
  );

  // Both dates sort: "what started most recently" and "what is up for review
  // next" are the two questions this table gets asked.
  const { sort, toggle } = useTableSort<"started" | "ends">();
  const visibleHistory = useSortedRows(filteredHistory, sort, {
    started: (row) => new Date(row.startsAt).getTime(),
    ends: (row) => (row.endsAt ? new Date(row.endsAt).getTime() : null),
  });

  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await responsibleGamingApi.detail(userId, { limit: 50 }));
    } catch {
      toast.error("Could not load Responsible Gaming records.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-40 bg-gray-700/40" />
        <div className="overflow-hidden rounded-lg border border-gray-800 bg-[#15181E]">
          <TableSkeleton rows={4} cols={5} />
        </div>
      </div>
    );
  }

  if (!data) return <NoData />;

  const active = data.active;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/60">
          Breaks, self-exclusions and how they ended.
        </p>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-lg border border-white/10 bg-[#242B35] px-3 py-2 text-sm font-semibold text-white/80 hover:bg-[#2c3541]"
        >
          Manage
        </button>
      </div>

      {active ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-300" />
            <span className="text-sm font-semibold text-white">
              {RESTRICTION_TYPE_LABEL[active.type]} · {active.periodLabel}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${RESTRICTION_STATUS_STYLE[active.status].cls}`}
            >
              {RESTRICTION_STATUS_STYLE[active.status].label}
            </span>
            {active.reviewDue && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                Review due
              </span>
            )}
          </div>
          <p className="text-xs text-white/60">
            Started {fmt(active.startsAt)} · {endDateLabel(active)}{" "}
            {fmt(active.endsAt)}
          </p>
          {active.type === "SELF_EXCLUSION" && (
            <p className="mt-2 text-[11px] text-white/40">
              This never lifts on its own. The player must request a review, and
              a decision is recorded against their support ticket.
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-xl border border-white/10 bg-[#0F141E] p-4 text-sm text-white/60">
          No active restriction on this account.
        </p>
      )}

      <FilterToolbar
        title="Restriction History"
        countLabel={`${visibleHistory.length} ${visibleHistory.length === 1 ? "record" : "records"}`}
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search period, reason or IP"
        activeCount={activeCount}
        chips={chips}
        hasAnyFilter={hasAnyFilter}
        onOpenFilters={() => setSheetOpen(true)}
        actions={
          <ExportCSV
            data={visibleHistory}
            fileName="responsible_gaming_history.csv"
            headers={["Type", "Period", "Started", "Ends / Reviewable", "Status"]}
            getRowDate={(row) => row.startsAt}
            mapRow={(row) => [
              RESTRICTION_TYPE_LABEL[row.type],
              row.periodLabel,
              fmt(row.startsAt),
              fmt(row.endsAt),
              RESTRICTION_STATUS_STYLE[row.status].label,
            ]}
          />
        }
        onResetAll={resetFilters}
      />

      <div className="overflow-x-auto rounded-lg bg-[#15181E]">
        <table className="w-full min-w-[680px]">
          <thead className="bg-[#242B35] text-left text-xs uppercase tracking-wide text-white/60">
            <tr>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Period</th>
              <SortableTh
                label="Started"
                sortKey="started"
                sort={sort}
                onToggle={toggle}
                className="px-4 py-3"
              />
              <SortableTh
                label="Ends / Reviewable"
                sortKey="ends"
                sort={sort}
                onToggle={toggle}
                className="px-4 py-3"
              />
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleHistory.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6">
                  <NoData
                    title={
                      hasAnyFilter ? "No records match these filters" : undefined
                    }
                  />
                </td>
              </tr>
            ) : (
              visibleHistory.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-white/5 text-sm text-white/80"
                >
                  <td className="px-4 py-3">{RESTRICTION_TYPE_LABEL[r.type]}</td>
                  <td className="px-4 py-3">{r.periodLabel}</td>
                  <td className="px-4 py-3 text-xs text-white/50">
                    {fmt(r.startsAt)}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/50">
                    {fmt(r.endsAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${RESTRICTION_STATUS_STYLE[r.status].cls}`}
                    >
                      {RESTRICTION_STATUS_STYLE[r.status].label}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <RestrictionDetailModal
          userId={userId}
          onClose={() => setModalOpen(false)}
          onChanged={() => void load()}
        />
      )}

      <EntityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Restriction Filters"
        description="Filter this player's responsible gaming history"
        fields={RG_FILTER_FIELDS}
        values={filters}
        defaults={RG_FILTER_DEFAULTS}
        onApply={setFilters}
      />
    </div>
  );
}
