"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CopyButton from "@/components/CopyButton";
import ExportCSV from "@/components/ExportCSV/ExportCSV";
import FilterToolbar from "@/components/filters/FilterToolbar";
import EntityFilterSheet from "@/components/filters/EntityFilterSheet";
import type { FilterField, FilterValues } from "@/components/filters/types";
import Link from "next/link";
import { LifeBuoy, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import NoData from "@/components/NoData";
import Pagination from "@/components/Pagination";
import { PermissionGuard } from "@/components/guard/permission-guard";
import {
  responsibleGamingApi,
  endDateLabel,
  RESTRICTION_STATUS_STYLE,
  RESTRICTION_TYPE_LABEL,
  type RestrictionRow,
  type RestrictionStats,
  type RestrictionStatus,
  type RestrictionType,
} from "@/api/responsible-gaming/responsible-gaming.api";
import RestrictionDetailModal from "./components/RestrictionDetailModal";

const PAGE_SIZE = 25;

/** Status pills across the top — "all" first, then each status in order. */
const STATUS_TABS: Array<{ key: RestrictionStatus | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "EXPIRED", label: "Expired" },
  { key: "LIFTED", label: "Lifted" },
  { key: "SUPERSEDED", label: "Superseded" },
  { key: "CANCELLED", label: "Cancelled" },
];


function fmt(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString() : "—";
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#191D24] p-4">
      <p className="text-xs uppercase tracking-wide text-white/50">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent ?? "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

/**
 * Restricted players — feature 13.
 *
 * Driven off the restriction records rather than the cached flag on the user
 * row: the record is the authority, it carries the period and the dates the
 * cache does not, and a compliance screen should never be the one showing a
 * copy.
 */
function ResponsibleGamingView() {
  const [rows, setRows] = useState<RestrictionRow[]>([]);
  const [stats, setStats] = useState<RestrictionStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // "all" is the default: the page is a register of restrictions, and opening
  // it filtered to ACTIVE hid every expired or lifted one with no way back.
  const [status, setStatus] = useState<RestrictionStatus | "all">("all");
  const [type, setType] = useState<RestrictionType | "">("");
  const [reviewDue, setReviewDue] = useState(false);
  const [search, setSearch] = useState("");
  // Started-date bounds; the API applies them across the whole list, not just
  // the page on screen.
  const [from_, setFrom] = useState("");
  const [to_, setTo] = useState("");
  const [debounced, setDebounced] = useState("");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [openUserId, setOpenUserId] = useState<string | null>(null);

  const activeFilterCount = useMemo(
    () =>
      (status !== "all" ? 1 : 0) +
      (type ? 1 : 0) +
      (reviewDue ? 1 : 0) +
      (from_ || to_ ? 1 : 0),
    [status, type, reviewDue, from_, to_]
  );

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 500);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, s] = await Promise.all([
        responsibleGamingApi.list({
          page,
          limit: PAGE_SIZE,
          // Omitted entirely for "all" — the API filters by status whenever
          // one is sent.
          status: status === "all" ? undefined : status,
          type: type || undefined,
          reviewDue: reviewDue || undefined,
          search: debounced || undefined,
          from: from_ || undefined,
          to: to_ || undefined,
        }),
        responsibleGamingApi.stats().catch(() => null),
      ]);
      setRows(list.restrictions);
      setTotal(list.total);
      if (s) setStats(s);
    } catch {
      toast.error("Could not load restricted players.");
    } finally {
      setLoading(false);
    }
  }, [page, status, type, reviewDue, debounced, from_, to_]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [status, type, reviewDue, debounced]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total]
  );

  return (
    <div className="min-h-screen bg-[#15181E] p-3 text-white md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Responsible Gaming</h1>
          <p className="mt-0.5 text-sm text-white/50">
            Players who have paused or self-excluded, and their history.
          </p>
        </div>
        {/* Support Tickets is no longer in the sidebar. It is reached from
            here because the tickets an officer wants after reading this table
            are the reactivation requests these restrictions produced. */}
        <Link
          href="/users/support-tickets"
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#191D24] px-3 py-2 text-sm text-white/80 hover:bg-[#242B35]"
        >
          <LifeBuoy className="h-4 w-4" /> Support Tickets
        </Link>
      </div>

      {stats && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Active breaks" value={stats.activePauses} />
          <StatCard
            label="Self-excluded"
            value={stats.activeSelfExclusions}
            accent="text-amber-300"
          />
          <StatCard label="Total restricted" value={stats.activeTotal} />
          {/* The number a compliance officer is actually here for. */}
          <StatCard
            label="Reviews due"
            value={stats.reviewDue}
            accent="text-emerald-300"
          />
        </div>
      )}

      {/* Status pills, counted — the same control the support queue uses, so
          the backlog per status is readable without opening the sheet. */}
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const count =
            tab.key === "all"
              ? Object.values(stats?.byStatus ?? {}).reduce((sum, n) => sum + n, 0)
              : stats?.byStatus?.[tab.key];
          const isActive = status === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setStatus(tab.key)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                isActive
                  ? "border-[#B93DEB] bg-[#B93DEB]/15 text-[#C77DFF]"
                  : "border-white/10 bg-[#191D24] text-white/70 hover:bg-[#242B35]"
              }`}
            >
              {tab.label}
              {typeof count === "number" && (
                <span className="ml-1.5 text-xs opacity-70">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      <FilterToolbar
        className="mb-4"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Username or email"
        activeCount={activeFilterCount}
        onOpenFilters={() => setSheetOpen(true)}
        actions={
          <ExportCSV
            data={rows}
            fileName="responsible_gaming.csv"
            getRowDate={(row) => row.startsAt}
            headers={[
              "Player",
              "User ID",
              "Type",
              "Period",
              "Started",
              "Ends / Reviewable",
              "Review Due",
              "Status",
              "Source",
            ]}
            mapRow={(row) => [
              row.player?.username || row.player?.entity || row.userId,
              row.userId,
              RESTRICTION_TYPE_LABEL[row.type],
              row.periodLabel,
              fmt(row.startsAt),
              // Same wording the cell carries, so the file does not lose the
              // distinction between a pause ending and an exclusion becoming
              // reviewable.
              row.endsAt ? `${endDateLabel(row)}: ${fmt(row.endsAt)}` : "-",
              row.reviewDue ? "Yes" : "No",
              RESTRICTION_STATUS_STYLE[row.status].label,
              row.source ?? "-",
            ]}
          />
        }
      />

      <EntityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Responsible Gaming Filters"
        description="Narrow the restrictions this list shows."
        fields={RG_FILTER_FIELDS}
        values={{
          status,
          type: type === "" ? "all" : type,
          reviewDue: reviewDue ? "yes" : "no",
          from: from_,
          to: to_,
        }}
        defaults={RG_FILTER_DEFAULTS}
        onApply={(values) => {
          // Status is owned by the pills above; the sheet only sets the rest.
          const nextType = values.type ?? "all";
          setType((nextType === "all" ? "" : nextType) as RestrictionType | "");
          setReviewDue(values.reviewDue === "yes");
          setFrom(values.from ?? "");
          setTo(values.to ?? "");
          setPage(1);
        }}
      />

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#191D24]">
        <table className="w-full min-w-[880px]">
          <thead className="bg-[#242B35] text-left text-xs uppercase tracking-wide text-white/60">
            <tr>
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3">Started</th>
              <th className="px-4 py-3">Ends / Reviewable</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-white/60">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8">
                  <NoData />
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr
                  key={r.id}
                  onClick={() => setOpenUserId(r.userId)}
                  className={`cursor-pointer border-b border-white/5 text-sm transition hover:bg-[#242B35] ${
                    i % 2 ? "bg-white/[0.02]" : ""
                  }`}
                >
                  <td className="max-w-[200px] px-4 py-3">
                    {/* The row opens a drawer on click, so selecting the name
                        by hand is not an option — the button is how this gets
                        copied. */}
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">
                        {r.player?.username || r.player?.entity || r.userId}
                      </span>
                      <CopyButton
                        value={r.player?.username || r.player?.entity || r.userId}
                        size={12}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white/80">
                    {RESTRICTION_TYPE_LABEL[r.type]}
                  </td>
                  <td className="px-4 py-3 text-white/80">{r.periodLabel}</td>
                  <td className="px-4 py-3 text-xs text-white/50">
                    {fmt(r.startsAt)}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/50">
                    {/* Labelled per type — a pause releases itself on this
                        date, a self-exclusion only becomes reviewable. */}
                    <span className="text-white/40">{endDateLabel(r)}: </span>
                    {fmt(r.endsAt)}
                    {r.reviewDue && (
                      <span className="ml-1.5 font-semibold text-emerald-300">
                        · due
                      </span>
                    )}
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

      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}

      {openUserId && (
        <RestrictionDetailModal
          userId={openUserId}
          onClose={() => setOpenUserId(null)}
          onChanged={() => void load()}
        />
      )}
    </div>
  );
}

const RG_FILTER_DEFAULTS: FilterValues = {
  search: "",
  type: "all",
  reviewDue: "no",
  from: "",
  to: "",
};

const RG_FILTER_FIELDS: FilterField[] = [
  {
    type: "select",
    key: "type",
    label: "Restriction type",
    options: [
      // "all", not "" — Radix reserves the empty string for "no selection".
      { value: "all", label: "All types" },
      { value: "PAUSE", label: "Break in Play" },
      { value: "SELF_EXCLUSION", label: "Self-Exclusion" },
    ],
  },
  {
    type: "select",
    key: "reviewDue",
    label: "Review",
    options: [
      { value: "no", label: "All restrictions" },
      { value: "yes", label: "Review due only" },
    ],
  },
  { type: "dateRange", fromKey: "from", toKey: "to", label: "Started Between" },
];

export default function ResponsibleGamingPage() {
  return (
    <PermissionGuard permission="users:responsible-gaming">
      <ResponsibleGamingView />
    </PermissionGuard>
  );
}
