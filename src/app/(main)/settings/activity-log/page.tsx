"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ChevronDown,
    Lock,
    Search,
    Shield,
    SlidersHorizontal,
    X,
} from "lucide-react";
import toast from "react-hot-toast";

import NoData from "@/components/NoData";
import { PermissionGuard } from "@/components/guard/permission-guard";
import Pagination from "@/components/Pagination";
import ExportCSV from "@/components/ExportCSV";
import {
    CATEGORY_LABELS,
    getActivityFacets,
    getActivityLogs,
    type ActivityCategory,
    type ActivityFacets,
    type ActivityQuery,
    type ActivityRow,
    type ActivityStatus,
} from "@/api/activity-log/activity-log";
import ActivityDetailModal from "./components/ActivityDetailModal";
import {
    CategoryBadge,
    StatusBadge,
    buttonClass,
    formatDateTime,
    formatRelative,
    fromLocalInputValue,
    inputClass,
    panelClass,
    toLocalInputValue,
} from "./components/shared";

const PAGE_SIZE = 25;

// Export pulls the filtered set from the server in chunks rather than shipping
// whatever happens to be on screen. 200 is the API's `limit` ceiling; 25 chunks
// caps one export at 5,000 rows so a click can never hammer the API forever.
// The cap is announced when it bites — an audit export that quietly stops short
// is worse than one that refuses, because the reader has no way to tell.
const EXPORT_CHUNK_SIZE = 200;
const EXPORT_MAX_PAGES = 25;

const CATEGORY_ORDER: ActivityCategory[] = [
    "payout",
    "deposit",
    "user",
    "agent",
    "kyc",
    "staff",
    "settings",
    "content",
    "reward",
    "game",
    "auth",
    "other",
];

const STATUS_OPTIONS: ActivityStatus[] = ["success", "failed", "reversed"];

const SORT_OPTIONS: Array<{ value: NonNullable<ActivityQuery["sort"]>; label: string }> = [
    { value: "recent", label: "Most recent" },
    { value: "admin", label: "Admin name" },
    { value: "action", label: "Action type" },
];

const emptyQuery: ActivityQuery = { page: 1, limit: PAGE_SIZE, sort: "recent" };

const TableSkeleton = () => (
    <>
        {[...Array(8)].map((_, i) => (
            <tr
                key={i}
                className={`${i % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"} animate-pulse`}
            >
                {[24, 28, 20, 40, 18].map((w, j) => (
                    <td key={j} className="px-4 py-4">
                        <div
                            className="h-3 rounded bg-gray-700/40"
                            style={{ width: `${w * 4}px`, maxWidth: "100%" }}
                        />
                    </td>
                ))}
            </tr>
        ))}
    </>
);

/**
 * The admin audit trail.
 *
 * Reverse-chronological by default, because the question this page is opened
 * with is almost always "what just happened". Everything else — the filters,
 * the search, the sort — narrows that same ordering rather than replacing it.
 *
 * Rows carry a pre-written sentence from the API, so the table is scannable
 * without the browser knowing the shape of forty different action payloads. The
 * row is a summary; the modal is the record.
 */
function ActivityLogView() {
    const [rows, setRows] = useState<ActivityRow[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);

    const [facets, setFacets] = useState<ActivityFacets | null>(null);

    const [query, setQuery] = useState<ActivityQuery>(emptyQuery);
    const [searchInput, setSearchInput] = useState("");
    const [showFilters, setShowFilters] = useState(false);
    const [selected, setSelected] = useState<ActivityRow | null>(null);

    /* --------------------------------------------------------------- loading */

    const load = useCallback(async (next: ActivityQuery) => {
        setLoading(true);
        try {
            const data = await getActivityLogs(next);
            setRows(data.rows);
            setTotalPages(data.pagination.totalPages);
        } catch {
            toast.error("Could not load the activity log");
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load(query);
    }, [query, load]);

    useEffect(() => {
        // Filter options do not change with the query, so they are fetched once.
        // A failure here leaves the table fully usable — it would be perverse for
        // a missing dropdown to hide the log itself.
        getActivityFacets().then(setFacets).catch(() => undefined);
    }, []);

    /* ---------------------------------------------------------------- search */

    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const onSearchChange = (value: string) => {
        setSearchInput(value);
        if (searchTimer.current) clearTimeout(searchTimer.current);
        // Debounced: this box matches five columns server-side, and a request
        // per keystroke would queue responses that arrive out of order.
        searchTimer.current = setTimeout(() => {
            setQuery((q) => ({ ...q, search: value.trim() || undefined, page: 1 }));
        }, 350);
    };

    useEffect(
        () => () => {
            if (searchTimer.current) clearTimeout(searchTimer.current);
        },
        [],
    );

    /* --------------------------------------------------------------- filters */

    const patch = (changes: Partial<ActivityQuery>) =>
        setQuery((q) => ({ ...q, ...changes, page: 1 }));

    const toggleInList = <T extends string>(
        list: T[] | undefined,
        value: T,
    ): T[] | undefined => {
        const current = list ?? [];
        const next = current.includes(value)
            ? current.filter((v) => v !== value)
            : [...current, value];
        return next.length ? next : undefined;
    };

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (query.actorId) count += 1;
        if (query.categories?.length) count += 1;
        if (query.statuses?.length) count += 1;
        if (query.actions?.length) count += 1;
        if (query.targetId) count += 1;
        if (query.from || query.to) count += 1;
        return count;
    }, [query]);

    const clearFilters = () => {
        setSearchInput("");
        setQuery(emptyQuery);
    };

    /* ---------------------------------------------------------------- export */

    /**
     * The whole filtered result set, not just the visible page.
     *
     * The date range the export popover offers is applied on top of the filters
     * already in force, so what downloads is exactly what the screen describes.
     */
    const fetchAllForExport = useCallback(
        async (range: { from?: Date; to?: Date }) => {
            const base: ActivityQuery = {
                ...query,
                limit: EXPORT_CHUNK_SIZE,
                from: range.from ? range.from.toISOString() : query.from,
                to: range.to ? range.to.toISOString() : query.to,
            };

            const collected: ActivityRow[] = [];
            let page = 1;
            let totalPagesForExport = 1;

            do {
                const data = await getActivityLogs({ ...base, page });
                collected.push(...data.rows);
                totalPagesForExport = data.pagination.totalPages;
                page += 1;
            } while (page <= totalPagesForExport && page <= EXPORT_MAX_PAGES);

            if (totalPagesForExport > EXPORT_MAX_PAGES) {
                toast(
                    `Export capped at ${collected.length.toLocaleString()} rows. Narrow the date range to get the rest.`,
                );
            }

            return collected;
        },
        [query],
    );

    /* ----------------------------------------------------------------- render */

    return (
        <div className="space-y-4 p-4 md:p-6">
            {/* ── header ─────────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold text-white">Activity Log</h1>
                    <p className="mt-0.5 text-sm text-white/45">
                        Every action taken by an admin or staff member, newest first.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <ExportCSV
                        data={rows}
                        fileName="admin-activity-log"
                        headers={[
                            "Date & Time",
                            "Admin",
                            "Role",
                            "Action",
                            "Category",
                            "Affected",
                            "Description",
                            "Status",
                            "IP Address",
                            "Device",
                        ]}
                        mapRow={(row: ActivityRow) => [
                            formatDateTime(row.createdAt),
                            row.actorName,
                            row.actorRole ?? "",
                            row.actionLabel,
                            CATEGORY_LABELS[row.category] ?? row.category,
                            row.targetLabel ?? "",
                            row.summary,
                            row.status,
                            row.ipAddress ?? "",
                            row.deviceLabel ?? "",
                        ]}
                        fetchAll={fetchAllForExport}
                    />
                </div>
            </div>

            {/* ── search + filter bar ────────────────────────────────────── */}
            <div className={`${panelClass} p-4`}>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[240px] flex-1">
                        <Search
                            size={14}
                            className="absolute top-1/2 left-3 -translate-y-1/2 text-white/35"
                        />
                        <input
                            value={searchInput}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="Search by user, agent, admin, ID, or description…"
                            className={`${inputClass} w-full pl-9`}
                        />
                        {searchInput && (
                            <button
                                onClick={() => onSearchChange("")}
                                className="absolute top-1/2 right-3 -translate-y-1/2 text-white/35 hover:text-white"
                                aria-label="Clear search"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <select
                        value={query.actorId ?? ""}
                        onChange={(e) => patch({ actorId: e.target.value || undefined })}
                        className={inputClass}
                    >
                        <option value="">All admins</option>
                        {facets?.admins.map((admin) => (
                            <option key={admin.id} value={admin.id}>
                                {admin.name} ({admin.count})
                            </option>
                        ))}
                    </select>

                    <select
                        value={query.sort ?? "recent"}
                        onChange={(e) =>
                            patch({ sort: e.target.value as ActivityQuery["sort"] })
                        }
                        className={inputClass}
                    >
                        {SORT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                Sort: {option.label}
                            </option>
                        ))}
                    </select>

                    <button
                        className={buttonClass}
                        onClick={() => setShowFilters((v) => !v)}
                    >
                        <SlidersHorizontal size={14} />
                        Filters
                        {activeFilterCount > 0 && (
                            <span className="rounded-full bg-[#B93DEB] px-1.5 text-[10px] font-semibold text-white">
                                {activeFilterCount}
                            </span>
                        )}
                        <ChevronDown
                            size={14}
                            className={showFilters ? "rotate-180 transition-transform" : "transition-transform"}
                        />
                    </button>

                    {activeFilterCount > 0 && (
                        <button
                            className="text-xs text-white/45 underline-offset-2 hover:text-white hover:underline"
                            onClick={clearFilters}
                        >
                            Clear all
                        </button>
                    )}
                </div>

                {showFilters && (
                    <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                        {/* Category chips */}
                        <div>
                            <p className="mb-2 text-[11px] uppercase tracking-wide text-white/40">
                                Category
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORY_ORDER.map((category) => {
                                    const active = query.categories?.includes(category);
                                    return (
                                        <button
                                            key={category}
                                            onClick={() =>
                                                patch({
                                                    categories: toggleInList(query.categories, category),
                                                })
                                            }
                                            className={`rounded-full border px-3 py-1 text-xs transition-colors ${active
                                                ? "border-[#B93DEB] bg-[#B93DEB]/15 text-white"
                                                : "border-[#2C323D] bg-[#242B35] text-white/60 hover:text-white"
                                                }`}
                                        >
                                            {CATEGORY_LABELS[category]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Status chips */}
                        <div>
                            <p className="mb-2 text-[11px] uppercase tracking-wide text-white/40">
                                Result
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {STATUS_OPTIONS.map((status) => {
                                    const active = query.statuses?.includes(status);
                                    return (
                                        <button
                                            key={status}
                                            onClick={() =>
                                                patch({ statuses: toggleInList(query.statuses, status) })
                                            }
                                            className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${active
                                                ? "border-[#B93DEB] bg-[#B93DEB]/15 text-white"
                                                : "border-[#2C323D] bg-[#242B35] text-white/60 hover:text-white"
                                                }`}
                                        >
                                            {status}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                            <div>
                                <p className="mb-2 text-[11px] uppercase tracking-wide text-white/40">
                                    Action type
                                </p>
                                <select
                                    value={query.actions?.[0] ?? ""}
                                    onChange={(e) =>
                                        patch({
                                            actions: e.target.value ? [e.target.value] : undefined,
                                        })
                                    }
                                    className={`${inputClass} w-full`}
                                >
                                    <option value="">All actions</option>
                                    {(facets?.actions ?? []).map((action) => (
                                        <option key={action.action} value={action.action}>
                                            {action.label} ({action.count})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <p className="mb-2 text-[11px] uppercase tracking-wide text-white/40">
                                    Affected entity ID
                                </p>
                                <input
                                    value={query.targetId ?? ""}
                                    onChange={(e) =>
                                        patch({ targetId: e.target.value.trim() || undefined })
                                    }
                                    placeholder="Everything done to one user/agent"
                                    className={`${inputClass} w-full`}
                                />
                            </div>

                            <div>
                                <p className="mb-2 text-[11px] uppercase tracking-wide text-white/40">
                                    From
                                </p>
                                <input
                                    type="datetime-local"
                                    value={query.from ? toLocalInputValue(query.from) : ""}
                                    onChange={(e) =>
                                        patch({ from: fromLocalInputValue(e.target.value) })
                                    }
                                    className={`${inputClass} w-full`}
                                />
                            </div>

                            <div>
                                <p className="mb-2 text-[11px] uppercase tracking-wide text-white/40">
                                    To
                                </p>
                                <input
                                    type="datetime-local"
                                    value={query.to ? toLocalInputValue(query.to) : ""}
                                    onChange={(e) =>
                                        patch({ to: fromLocalInputValue(e.target.value) })
                                    }
                                    className={`${inputClass} w-full`}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── table ──────────────────────────────────────────────────── */}
            <div className={`${panelClass} overflow-hidden`}>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                        <thead>
                            <tr className="border-b border-white/10 bg-[#1B2028] text-left text-[11px] uppercase tracking-wide text-white/45">
                                <th className="px-4 py-3 font-medium">When</th>
                                <th className="px-4 py-3 font-medium">Admin</th>
                                <th className="px-4 py-3 font-medium">Action</th>
                                <th className="px-4 py-3 font-medium">Affected</th>
                                <th className="px-4 py-3 font-medium">What Happened</th>
                                <th className="px-4 py-3 font-medium">Result</th>
                            </tr>
                        </thead>

                        <tbody>
                            {loading && <TableSkeleton />}

                            {!loading &&
                                rows.map((row, i) => (
                                    <tr
                                        key={row.id}
                                        onClick={() => setSelected(row)}
                                        className={`${i % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                                            } cursor-pointer border-b border-white/5 transition-colors hover:bg-[#242B35]`}
                                    >
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="text-white/80">
                                                {formatRelative(row.createdAt)}
                                            </span>
                                            <span className="block text-[11px] text-white/35">
                                                {formatDateTime(row.createdAt)}
                                            </span>
                                        </td>

                                        <td className="px-4 py-3">
                                            <span className="block text-white">{row.actorName}</span>
                                            {row.actorRole && (
                                                <span className="block text-[11px] capitalize text-white/35">
                                                    {row.actorRole}
                                                </span>
                                            )}
                                        </td>

                                        <td className="px-4 py-3">
                                            <span className="mb-1 flex items-center gap-1.5 whitespace-nowrap text-white">
                                                {row.actionLabel}
                                                {row.sensitive && (
                                                    <Shield
                                                        size={11}
                                                        className="shrink-0 text-amber-400/70"
                                                    />
                                                )}
                                            </span>
                                            <CategoryBadge category={row.category} />
                                        </td>

                                        <td className="px-4 py-3">
                                            <span className="block text-white/80">
                                                {row.targetLabel ?? "—"}
                                            </span>
                                            {row.targetSecondary && (
                                                <span className="block text-[11px] text-white/35">
                                                    {row.targetSecondary}
                                                </span>
                                            )}
                                        </td>

                                        <td className="px-4 py-3">
                                            <span className="text-white/70">{row.summary}</span>
                                            {row.changeCount > 0 && (
                                                <span className="ml-1 text-[11px] text-white/35">
                                                    · {row.changeCount} field
                                                    {row.changeCount === 1 ? "" : "s"} changed
                                                </span>
                                            )}
                                        </td>

                                        <td className="px-4 py-3">
                                            <StatusBadge status={row.status} />
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>

                {!loading && rows.length === 0 && (
                    <div className="py-12">
                        <NoData
                            title={
                                activeFilterCount > 0 || query.search
                                    ? "No activity matches these filters"
                                    : "No admin activity recorded yet"
                            }
                        />
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <Pagination
                    currentPage={query.page ?? 1}
                    totalPages={totalPages}
                    onPageChange={(page) => setQuery((q) => ({ ...q, page }))}
                />
            )}

            {selected && (
                <ActivityDetailModal
                    // Keyed so picking a different row mounts a fresh modal
                    // instead of leaving the previous entry's data on screen
                    // while the new one loads.
                    key={selected.id}
                    row={selected}
                    onClose={() => setSelected(null)}
                />
            )}
        </div>
    );
}

/**
 * Superadmin only.
 *
 * This is presentation, not the control — `SuperAdminGuard` on the API refuses
 * every one of these endpoints to anyone else, so a determined visitor gains
 * nothing by reaching the route. What this buys is a straight answer instead of
 * three failed requests and a stack of error toasts for someone who typed the
 * URL or followed a stale bookmark.
 */
export default function ActivityLogPage() {
    return (
        <PermissionGuard
            role="superadmin"
            fallback={
                <div className="flex flex-col items-center justify-center gap-2 p-16 text-center">
                    <Lock size={22} className="text-white/30" />
                    <p className="text-white/70">
                        The activity log is restricted to superadmin accounts.
                    </p>
                    <p className="text-sm text-white/40">
                        Access to the audit trail is not a permission that can be
                        granted from the roles screen.
                    </p>
                </div>
            }
        >
            <ActivityLogView />
        </PermissionGuard>
    );
}
