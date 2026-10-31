"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
    Ban,
    Loader2,
    PlayCircle,
    RefreshCw,
    Send,
    Settings2,
    Target,
} from "lucide-react";
import toast from "react-hot-toast";


import NoData from "@/components/NoData";
import { PermissionGuard } from "@/components/guard/permission-guard";
import {
    breakNinjaPostbacks,
    EVENT_LABELS,
    getNinjaConversions,
    getNinjaStatus,
    REFERRER_LABELS,
    resumeNinjaPostbacks,
    retryNinjaConversion,
    STATUS_LABELS,
    type NinjaConversion,
    type NinjaConversionQuery,
    type NinjaConversionStatus,
    type NinjaEventType,
    type NinjaIntegrationStatus,
} from "@/api/ninja/ninja-postbacks.api";
import SettingsModal from "./components/SettingsModal";

const panelClass = "rounded-xl border border-white/10 bg-[#161A21]";
const inputClass =
    "rounded-lg border border-white/10 bg-[#0F1319] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#B93DEB]";
const buttonClass =
    "inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#0F1319] px-3 py-2 text-sm text-white/80 transition hover:border-white/25 hover:text-white disabled:opacity-50";

/** The retry sweep ticks once a minute; polling faster shows nothing new. */
const REFRESH_MS = 60_000;

const STATUS_STYLES: Record<NinjaConversionStatus, string> = {
    PENDING: "bg-white/10 text-white/70",
    SENDING: "bg-sky-500/15 text-sky-300",
    SENT: "bg-emerald-500/15 text-emerald-300",
    FAILED: "bg-amber-500/15 text-amber-300",
    EXHAUSTED: "bg-red-500/15 text-red-300",
};

const formatDateTime = (iso: string | null | undefined): string => {
    if (!iso) return "—";
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
};

function NinjaPostbacksContent() {
    const [status, setStatus] = useState<NinjaIntegrationStatus | null>(null);
    const [rows, setRows] = useState<NinjaConversion[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState<NinjaConversionQuery>({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [retryingId, setRetryingId] = useState<string | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    /** Row whose wire detail is open — the in-panel replacement for a webhook receiver. */
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Guards a slow response from overwriting a newer one, and state updates
    // after the operator has navigated away.
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const load = useCallback(
        async (showSpinner = false) => {
            if (showSpinner) setRefreshing(true);
            try {
                const [nextStatus, listing] = await Promise.all([
                    getNinjaStatus(),
                    getNinjaConversions({ ...filters, page, limit: 25 }),
                ]);
                if (!mounted.current) return;
                setStatus(nextStatus);
                setRows(listing.data ?? []);
                setTotal(listing.meta?.total ?? 0);
            } catch {
                if (mounted.current) toast.error("Could not load Ninja postbacks.");
            } finally {
                if (mounted.current) {
                    setLoading(false);
                    setRefreshing(false);
                }
            }
        },
        [filters, page],
    );

    useEffect(() => {
        void load();
        const timer = setInterval(() => void load(), REFRESH_MS);
        return () => clearInterval(timer);
    }, [load]);

    const onRetry = async (id: string) => {
        setRetryingId(id);
        try {
            const updated = await retryNinjaConversion(id);
            toast.success(
                updated.status === "SENT"
                    ? "Ninja accepted the conversion."
                    : `Retried — now ${STATUS_LABELS[updated.status]}.`,
            );
            await load(true);
        } catch {
            toast.error("Retry failed.");
        } finally {
            if (mounted.current) setRetryingId(null);
        }
    };

    const onToggleBreak = async () => {
        const open = status?.breaker.state !== "CLOSED";
        try {
            if (open) {
                await resumeNinjaPostbacks();
                toast.success("Delivery resumed. The backlog drains on the next sweep.");
            } else {
                await breakNinjaPostbacks("Paused by admin");
                toast.success("Delivery paused. Conversions keep recording.");
            }
            await load(true);
        } catch {
            toast.error("Could not change delivery state.");
        }
    };

    const setFilter = (patch: NinjaConversionQuery) => {
        setPage(1);
        setFilters((prev) => ({ ...prev, ...patch }));
    };

    const breakerOpen = status ? status.breaker.state !== "CLOSED" : false;

    return (
        <div className="space-y-4 p-4 md:p-6">
            {/* -------------------------------------------------------- header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-xl font-semibold text-white">
                        <Target size={20} className="text-[#B93DEB]" />
                        Ninja Postbacks
                    </h1>
                    <p className="mt-1 text-sm text-white/50">
                        Registration (lead) and first-deposit (sale) conversions sent to
                        Ninja. Every conversion is recorded here first, so nothing is lost
                        while Ninja is unreachable. Click a row to see the exact request
                        sent and the response received.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setSettingsOpen(true)}
                        className={buttonClass}
                    >
                        <Settings2 size={14} />
                        Settings
                    </button>
                    <button
                        type="button"
                        onClick={() => void onToggleBreak()}
                        className={buttonClass}
                        disabled={!status}
                    >
                        {breakerOpen ? <PlayCircle size={14} /> : <Ban size={14} />}
                        {breakerOpen ? "Resume delivery" : "Pause delivery"}
                    </button>
                    <button
                        type="button"
                        onClick={() => void load(true)}
                        disabled={refreshing}
                        className={buttonClass}
                    >
                        <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* -------------------------------------------------------- status */}
            {status && (
                <div className={`${panelClass} p-4`}>
                    <div className="grid gap-4 md:grid-cols-4">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-white/40">
                                Delivery
                            </p>
                            <p className="mt-1 text-sm text-white">
                                {status.settings.enabled
                                    ? "Enabled"
                                    : "Disabled (recording only)"}
                                {status.settings.useTestUrl ? " · test URL" : " · production URL"}
                            </p>
                            <p className="mt-1 text-xs text-white/40">
                                {status.host ?? status.configError ?? "No URL configured"}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs uppercase tracking-wide text-white/40">
                                Break
                            </p>
                            <p className="mt-1 text-sm text-white">
                                {status.breaker.state}
                                {status.breaker.manuallyTripped ? " (by admin)" : ""}
                            </p>
                            <p className="mt-1 text-xs text-white/40">
                                {status.breaker.state === "CLOSED"
                                    ? `${status.breaker.consecutiveFailures}/${status.breaker.failureThreshold} consecutive failures`
                                    : `Retry at ${formatDateTime(status.breaker.retryAt)}`}
                            </p>
                        </div>

                        <div className="md:col-span-2">
                            <p className="text-xs uppercase tracking-wide text-white/40">
                                Conversions
                            </p>
                            <div className="mt-1 flex flex-wrap gap-2">
                                {(
                                    Object.keys(status.counts) as NinjaConversionStatus[]
                                ).map((key) => (
                                    <span
                                        key={key}
                                        className={`rounded-full px-2.5 py-1 text-xs ${STATUS_STYLES[key]}`}
                                    >
                                        {STATUS_LABELS[key]}: {status.counts[key]}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ------------------------------------------------------- filters */}
            <div className={`${panelClass} flex flex-wrap items-center gap-3 p-4`}>
                <select
                    className={inputClass}
                    value={filters.eventType ?? ""}
                    onChange={(e) =>
                        setFilter({
                            eventType: (e.target.value || undefined) as NinjaEventType,
                        })
                    }
                >
                    <option value="">All events</option>
                    {(Object.keys(EVENT_LABELS) as NinjaEventType[]).map((key) => (
                        <option key={key} value={key}>
                            {EVENT_LABELS[key]}
                        </option>
                    ))}
                </select>

                <select
                    className={inputClass}
                    value={filters.status ?? ""}
                    onChange={(e) =>
                        setFilter({
                            status: (e.target.value || undefined) as NinjaConversionStatus,
                        })
                    }
                >
                    <option value="">All statuses</option>
                    {(Object.keys(STATUS_LABELS) as NinjaConversionStatus[]).map((key) => (
                        <option key={key} value={key}>
                            {STATUS_LABELS[key]}
                        </option>
                    ))}
                </select>

                <input
                    className={inputClass}
                    placeholder="SubID"
                    defaultValue={filters.subid ?? ""}
                    onBlur={(e) => setFilter({ subid: e.target.value.trim() || undefined })}
                />
                <input
                    className={inputClass}
                    placeholder="TID"
                    defaultValue={filters.tid ?? ""}
                    onBlur={(e) => setFilter({ tid: e.target.value.trim() || undefined })}
                />
                <input
                    className={inputClass}
                    placeholder="User ID"
                    defaultValue={filters.userId ?? ""}
                    onBlur={(e) => setFilter({ userId: e.target.value.trim() || undefined })}
                />
            </div>

            {/* --------------------------------------------------------- table */}
            <div className={`${panelClass} overflow-x-auto`}>
                {loading ? (
                    <div className="flex items-center justify-center gap-2 p-16 text-white/50">
                        <Loader2 size={18} className="animate-spin" /> Loading…
                    </div>
                ) : rows.length === 0 ? (
                    <NoData />
                ) : (
                    <table className="w-full min-w-[980px] text-left text-sm">
                        <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/40">
                            <tr>
                                <th className="p-3">Event</th>
                                <th className="p-3">SubID</th>
                                <th className="p-3">TID</th>
                                <th className="p-3">Amount</th>
                                <th className="p-3">Referrer</th>
                                <th className="p-3">Status</th>
                                <th className="p-3">Attempts</th>
                                <th className="p-3">Created</th>
                                <th className="p-3">Sent</th>
                                <th className="p-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <Fragment key={row.id}>
                                <tr
                                    onClick={() =>
                                        setExpandedId((prev) => (prev === row.id ? null : row.id))
                                    }
                                    className="cursor-pointer border-b border-white/5 text-white/80 transition hover:bg-white/[0.03]"
                                >
                                    <td className="p-3">{EVENT_LABELS[row.eventType]}</td>
                                    <td className="p-3 font-mono text-xs">{row.subid}</td>
                                    <td className="p-3 font-mono text-xs">{row.tid}</td>
                                    <td className="p-3">
                                        {row.amount ? `${row.amount} ${row.currency ?? ""}` : "—"}
                                    </td>
                                    <td className="p-3">
                                        {row.referrerType ? REFERRER_LABELS[row.referrerType] : "—"}
                                    </td>
                                    <td className="p-3">
                                        <span
                                            className={`rounded-full px-2.5 py-1 text-xs ${STATUS_STYLES[row.status]}`}
                                            title={row.lastError ?? undefined}
                                        >
                                            {STATUS_LABELS[row.status]}
                                        </span>
                                    </td>
                                    <td className="p-3">{row.attempts}</td>
                                    <td className="p-3 text-xs text-white/50">
                                        {formatDateTime(row.createdAt)}
                                    </td>
                                    <td className="p-3 text-xs text-white/50">
                                        {formatDateTime(row.sentAt)}
                                    </td>
                                    <td className="p-3">
                                        {row.status !== "SENT" && (
                                            <button
                                                type="button"
                                                className={buttonClass}
                                                disabled={retryingId === row.id}
                                                onClick={(e) => {
                                                    // The row itself toggles the detail panel.
                                                    e.stopPropagation();
                                                    void onRetry(row.id);
                                                }}
                                            >
                                                {retryingId === row.id ? (
                                                    <Loader2 size={14} className="animate-spin" />
                                                ) : (
                                                    <Send size={14} />
                                                )}
                                                Retry
                                            </button>
                                        )}
                                    </td>
                                </tr>

                                {/* The wire detail. This is what a tester would
                                    otherwise need a webhook receiver to see, and
                                    it is the only view of it on a deployed
                                    environment — so it shows the exact query we
                                    sent and exactly what came back. */}
                                {expandedId === row.id && (
                                    <tr className="border-b border-white/5 bg-[#0F1319]">
                                        <td colSpan={10} className="p-4">
                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div>
                                                    <p className="text-xs uppercase tracking-wide text-white/40">
                                                        Request sent
                                                    </p>
                                                    <pre className="mt-2 overflow-x-auto rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs text-white/70">
{row.requestQuery ?? "Not sent yet — this conversion is still queued."}
                                                    </pre>
                                                    <p className="mt-2 text-xs text-white/35">
                                                        Parameters only. The postback URL is server
                                                        configuration and is never shown here.
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs uppercase tracking-wide text-white/40">
                                                        Response
                                                    </p>
                                                    <pre className="mt-2 overflow-x-auto rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs text-white/70">
{row.lastHttpStatus
    ? `HTTP ${row.lastHttpStatus}\n\n${row.lastResponseBody ?? "(empty body)"}`
    : row.lastError
        ? `No response\n\n${row.lastError}`
        : "No attempt yet."}
                                                    </pre>
                                                    {row.status === "SENT" ? (
                                                        <p className="mt-2 text-xs text-emerald-300/70">
                                                            Accepted — 2xx with OK in the body.
                                                        </p>
                                                    ) : row.lastError ? (
                                                        <p className="mt-2 text-xs text-amber-300/70">
                                                            {row.lastError}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            </div>

                                            <div className="mt-4 grid gap-x-8 gap-y-2 text-xs text-white/50 md:grid-cols-3">
                                                <span>
                                                    User ID:{" "}
                                                    <span className="font-mono text-white/70">
                                                        {row.userId}
                                                    </span>
                                                </span>
                                                <span>
                                                    Source:{" "}
                                                    <span className="text-white/70">
                                                        {row.source ?? "—"}
                                                    </span>
                                                </span>
                                                <span>
                                                    Next attempt:{" "}
                                                    <span className="text-white/70">
                                                        {formatDateTime(row.nextAttemptAt)}
                                                    </span>
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {settingsOpen && status && (
                <SettingsModal
                    configuredUrls={status.configuredUrls}
                    host={status.host}
                    onClose={() => setSettingsOpen(false)}
                    onSaved={() => {
                        setSettingsOpen(false);
                        void load(true);
                    }}
                />
            )}

            {/* ---------------------------------------------------- pagination */}
            {total > 25 && (
                <div className="flex items-center justify-between text-sm text-white/50">
                    <span>
                        Page {page} of {Math.max(Math.ceil(total / 25), 1)} · {total} total
                    </span>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            className={buttonClass}
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(p - 1, 1))}
                        >
                            Previous
                        </button>
                        <button
                            type="button"
                            className={buttonClass}
                            disabled={page >= Math.ceil(total / 25)}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function NinjaPostbacksPage() {
    return (
        <PermissionGuard
            permission="settings:ninja-postbacks"
            fallback={
                <div className="flex flex-col items-center justify-center gap-2 p-16 text-center">
                    <Loader2 size={22} className="text-white/30" />
                    <p className="text-white/70">
                        You do not have permission to view Ninja postbacks.
                    </p>
                </div>
            }
        >
            <NinjaPostbacksContent />
        </PermissionGuard>
    );
}
