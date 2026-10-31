"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    AlertTriangle,
    Bug,
    ChevronDown,
    Copy,
    Download,
    Info,
    Loader2,
    Lock,
    LogOut,
    RotateCw,
    Save,
    Search,
    Settings2,
    Timer,
    Trash2,
    X,
} from "lucide-react";
import toast from "react-hot-toast";

import NoData from "@/components/NoData";
import Pagination from "@/components/Pagination/Pagination";
import {
    SYSTEM_LOG_LEVELS,
    deleteSystemLog,
    flushSystemLogs,
    getSlowestEndpoints,
    getSystemLog,
    getSystemLogFacets,
    getSystemLogSettings,
    getSystemLogStats,
    getSystemLogs,
    purgeSystemLogs,
    runSystemLogRetention,
    updateSystemLogSettings,
    type PurgeSystemLogsPayload,
    type SlowEndpointRow,
    type SystemLogEntry,
    type SystemLogFacets,
    type SystemLogKind,
    type SystemLogLevel,
    type SystemLogSettings,
    type SystemLogStats,
} from "@/api/system-logs/system-logs";
import {
    clearLogsAccess,
    getLogsAccessStatus,
    hasLogsAccess,
    unlockLogs,
} from "@/api/system-logs/logs-access";

/* ------------------------------------------------------------------ styles */

const inputClass =
    "bg-[#242B35] border border-[#2C323D] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#B93DEB]";
const buttonClass =
    "flex items-center gap-2 rounded-lg border border-[#2C323D] bg-[#242B35] px-3 py-2 text-sm text-white/80 transition-colors hover:text-white disabled:opacity-40";
const panelClass = "rounded-xl border border-white/10 bg-[#161A21]";

/** How often Live mode refreshes the first page and the figures. */
const LIVE_INTERVAL_MS = 10_000;

/**
 * Deletes run in ~15-second slices on the API; this bounds how many slices one
 * click may chain (~50 minutes) before reporting what is left.
 */
const MAX_DELETE_ROUNDS = 200;

/** One colour per level, used by both the filter chips and the table rows. */
const LEVEL_STYLES: Record<SystemLogLevel, string> = {
    error: "bg-red-500/15 text-red-400 border-red-500/30",
    warn: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    log: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    debug: "bg-violet-500/15 text-violet-400 border-violet-500/30",
    verbose: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

/* ----------------------------------------------------------------- helpers */

const formatDateTime = (value?: string | null) => {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "—";
    return `${d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    })}, ${d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    })}`;
};

/**
 * `datetime-local` needs a value with no timezone suffix, and it means local
 * time — so the ISO string has to be shifted by the offset before slicing,
 * otherwise the field shows a time the admin did not pick.
 */
const toLocalInputValue = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const shifted = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
    return shifted.toISOString().slice(0, 16);
};

const fromLocalInputValue = (value: string) =>
    value ? new Date(value).toISOString() : undefined;

/** "Sep 30, 1:00 PM" — for the start of a partial timing window. */
const formatShortDateTime = (value: string) => {
    const d = new Date(value);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
};

/** Sub-second durations read better in ms; anything longer in seconds. */
const formatDuration = (ms: number | null) => {
    if (ms === null || ms === undefined) return "—";
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
};

/**
 * Thresholds are deliberately low. AleaPlay gives up on a webhook in around ten
 * seconds, so "slow" here means slow enough to matter to a provider, not slow
 * enough to notice by hand.
 */
const durationColor = (ms: number | null) => {
    if (ms === null || ms === undefined) return "text-white/30";
    if (ms >= 3000) return "text-red-400";
    if (ms >= 1000) return "text-amber-400";
    if (ms >= 300) return "text-yellow-300/70";
    return "text-green-400/80";
};

const statusColor = (status: number | null) => {
    if (status === null || status === undefined) return "text-white/30";
    if (status >= 500) return "text-red-400";
    if (status >= 400) return "text-amber-400";
    if (status >= 300) return "text-sky-400";
    return "text-green-400/80";
};

/**
 * Fill in anything the API did not send.
 *
 * This page is opened when something is already wrong, so it has to tolerate an
 * API that is older than it, mid-deploy, or returning a partial payload. Reading
 * `stats.requestTiming.avgMs` off a response without `requestTiming` throws, and
 * a thrown render is a blank screen at exactly the moment the admin needs the
 * logs.
 */
const normalizeStats = (raw: Partial<SystemLogStats> | null): SystemLogStats => ({
    // null stays null: "could not count" must read as "—", never as 0.
    total: raw?.total === null || raw?.total === undefined ? null : Number(raw.total),
    byLevel: raw?.byLevel ?? null,
    byKind: raw?.byKind ?? null,
    oldest: raw?.oldest ?? null,
    newest: raw?.newest ?? null,
    pendingWrites: Number(raw?.pendingWrites ?? 0),
    requestTiming: {
        windowHours: Number(raw?.requestTiming?.windowHours ?? 24),
        requests: Number(raw?.requestTiming?.requests ?? 0),
        avgMs: raw?.requestTiming?.avgMs ?? null,
        p95Ms: raw?.requestTiming?.p95Ms ?? null,
        maxMs: raw?.requestTiming?.maxMs ?? null,
        since: raw?.requestTiming?.since ?? null,
        // An API older than this page computed timing from the rows directly.
        available: raw?.requestTiming?.available ?? true,
    },
});

const apiErrorMessage = (error: unknown, fallback: string) => {
    const message = (error as { response?: { data?: { message?: unknown } } })
        ?.response?.data?.message;
    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string") return message;
    return fallback;
};

/* ------------------------------------------------------------------- page */

/**
 * Route entry point.
 *
 * The page is reached by typing /settings/system-logs — it is deliberately not
 * in the sidebar — and stays locked until the development passphrase is
 * entered. The lock is real rather than cosmetic: the API refuses every System
 * Logs request without the token this screen obtains, so an admin who found the
 * URL still sees nothing.
 */
export default function SystemLogsRoute() {
    const [unlocked, setUnlocked] = useState(false);
    const [checked, setChecked] = useState(false);

    // sessionStorage is not readable during SSR, so the first paint has to wait
    // for the client — otherwise the page would flash unlocked and then relock.
    useEffect(() => {
        setUnlocked(hasLogsAccess());
        setChecked(true);
    }, []);

    if (!checked) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="animate-spin text-purple-400" size={26} />
            </div>
        );
    }

    if (!unlocked) return <LogsLockScreen onUnlocked={() => setUnlocked(true)} />;

    return <SystemLogsPage onLocked={() => setUnlocked(false)} />;
}

function LogsLockScreen({ onUnlocked }: { onUnlocked: () => void }) {
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [configured, setConfigured] = useState<boolean | null>(null);

    // Tells the developer "not enabled on this environment" instead of letting
    // them retype a passphrase that could never work here.
    useEffect(() => {
        getLogsAccessStatus()
            .then((status) => setConfigured(status.configured))
            .catch(() => setConfigured(null));
    }, []);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password || submitting) return;
        try {
            setSubmitting(true);
            setError(null);
            await unlockLogs(password);
            setPassword("");
            onUnlocked();
        } catch (err) {
            setError(apiErrorMessage(err, "Incorrect passphrase"));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex min-h-[70vh] items-center justify-center p-4">
            <form
                onSubmit={submit}
                className={`${panelClass} w-full max-w-md space-y-4 p-6`}
            >
                <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-[#B93DEB]/15 p-2.5">
                        <Lock size={20} className="text-[#B93DEB]" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-white">System Logs</h1>
                        <p className="text-xs text-white/45">
                            Development access only. Enter the passphrase to continue.
                        </p>
                    </div>
                </div>

                {configured === false && (
                    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                        System Logs access is not configured on this environment. Set
                        SYSTEM_LOGS_ACCESS_KEY in the API environment to enable it.
                    </p>
                )}

                <div className="space-y-1">
                    <label className="block text-xs text-white/60" htmlFor="logs-passphrase">
                        Passphrase
                    </label>
                    <input
                        id="logs-passphrase"
                        type="password"
                        autoFocus
                        autoComplete="off"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className={`${inputClass} w-full`}
                    />
                </div>

                {error && (
                    <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                        {error}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={!password || submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#B93DEB] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#a032d0] disabled:opacity-40"
                >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                    Unlock
                </button>

                <p className="text-[11px] leading-relaxed text-white/30">
                    The unlock lasts 8 hours and is cleared when this tab closes. The
                    passphrase is held in the API environment — it cannot be read or changed
                    from the admin panel.
                </p>
            </form>
        </div>
    );
}

function SystemLogsPage({ onLocked }: { onLocked: () => void }) {
    const [rows, setRows] = useState<SystemLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    // Applied filters. `searchInput` is separate so typing doesn't refetch on
    // every keystroke — it is committed on Enter or the Search button.
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [levels, setLevels] = useState<SystemLogLevel[]>([]);
    const [kind, setKind] = useState<SystemLogKind | "">("");
    const [context, setContext] = useState("");
    const [tag, setTag] = useState("");
    // Set by clicking a user in the table — "everything for this player".
    // No dropdown: the id set is unbounded, unlike contexts and tags.
    const [userId, setUserId] = useState("");
    const [minDurationMs, setMinDurationMs] = useState(0);
    const [sort, setSort] = useState<"recent" | "slowest">("recent");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [limit, setLimit] = useState(50);

    // Set when the API counted no further than it had to — shown as "N+".
    const [totalCapped, setTotalCapped] = useState(false);
    const [browseLimit, setBrowseLimit] = useState<number | null>(null);

    const [stats, setStats] = useState<SystemLogStats | null>(null);
    const [statsFailed, setStatsFailed] = useState(false);
    const [live, setLive] = useState(false);
    const liveInFlight = useRef(false);
    const [facets, setFacets] = useState<SystemLogFacets>({ contexts: [], tags: [] });
    const [slowest, setSlowest] = useState<SlowEndpointRow[]>([]);
    const [slowestOpen, setSlowestOpen] = useState(false);

    const [settings, setSettings] = useState<SystemLogSettings | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);

    const [selected, setSelected] = useState<SystemLogEntry | null>(null);
    const [purgeOpen, setPurgeOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    const query = useMemo(
        () => ({
            page,
            limit,
            levels: levels.length ? levels : undefined,
            kind: kind || undefined,
            context: context || undefined,
            tag: tag || undefined,
            userId: userId || undefined,
            search: search || undefined,
            minDurationMs: minDurationMs > 0 ? minDurationMs : undefined,
            sort,
            from: from ? fromLocalInputValue(from) : undefined,
            to: to ? fromLocalInputValue(to) : undefined,
        }),
        [page, limit, levels, kind, context, tag, userId, search, minDurationMs, sort, from, to],
    );

    /**
     * A 401 means the access token expired or was revoked by a restart — send
     * the developer back to the passphrase screen rather than showing an empty
     * table that looks like "no logs".
     */
    const relockIfDenied = useCallback(
        (error: unknown) => {
            const status = (error as { response?: { status?: number } })?.response?.status;
            if (status === 401) {
                clearLogsAccess();
                onLocked();
                return true;
            }
            return false;
        },
        [onLocked],
    );

    /**
     * `silent` is the Live refresh: no spinner, no toast, and the rows on
     * screen stay put if the call fails — a blip should not blank the table
     * every ten seconds.
     */
    const fetchLogs = useCallback(
        async ({ silent = false }: { silent?: boolean } = {}) => {
            try {
                if (!silent) setLoading(true);
                const data = await getSystemLogs(query);
                setRows(Array.isArray(data?.rows) ? data.rows : []);
                setTotal(data?.pagination?.total ?? 0);
                setTotalCapped(Boolean(data?.pagination?.totalCapped));
                setBrowseLimit(data?.pagination?.browseLimit ?? null);
                setTotalPages(data?.pagination?.totalPages ?? 1);
            } catch (error) {
                if (!relockIfDenied(error) && !silent) {
                    toast.error(apiErrorMessage(error, "Failed to load logs"));
                }
                if (!silent) setRows([]);
            } finally {
                if (!silent) setLoading(false);
            }
        },
        [query, relockIfDenied],
    );

    /** The figures that move as traffic arrives: counts, timing, slowest routes. */
    const fetchFigures = useCallback(async () => {
        const [statsRes, slowRes] = await Promise.allSettled([
            getSystemLogStats(),
            getSlowestEndpoints(24, 20),
        ]);
        // Every panel is independent: one failing endpoint blanks its own card
        // rather than the page. Same reason the stats are normalized — a
        // half-available API still has to be readable.
        if (statsRes.status === "fulfilled") {
            setStats(normalizeStats(statsRes.value));
            setStatsFailed(false);
        } else if (!relockIfDenied(statsRes.reason)) {
            // Last good figures stay on screen; the banner says they are stale.
            setStatsFailed(true);
        }
        if (slowRes.status === "fulfilled") {
            setSlowest(Array.isArray(slowRes.value) ? slowRes.value : []);
        }
    }, [relockIfDenied]);

    const fetchSidePanels = useCallback(async () => {
        const [, facetsRes, settingsRes] = await Promise.allSettled([
            fetchFigures(),
            getSystemLogFacets(),
            getSystemLogSettings(),
        ]);
        if (facetsRes.status === "fulfilled") {
            setFacets({
                contexts: facetsRes.value?.contexts ?? [],
                tags: facetsRes.value?.tags ?? [],
            });
        }
        if (settingsRes.status === "fulfilled") setSettings(settingsRes.value);
    }, [fetchFigures]);

    useEffect(() => {
        void fetchLogs();
    }, [fetchLogs]);

    useEffect(() => {
        void fetchSidePanels();
    }, [fetchSidePanels]);

    /**
     * Live mode: refresh the figures, and the first page, every
     * LIVE_INTERVAL_MS. Skips a tick while the previous one is still running
     * or the tab is hidden, so it never stacks requests. Deeper pages are left
     * alone — refreshing page 5 would only shuffle rows under the reader.
     */
    useEffect(() => {
        if (!live) return;
        const tick = async () => {
            if (liveInFlight.current || document.hidden) return;
            liveInFlight.current = true;
            try {
                await Promise.all([
                    page === 1 ? fetchLogs({ silent: true }) : Promise.resolve(),
                    fetchFigures(),
                ]);
            } finally {
                liveInFlight.current = false;
            }
        };
        const id = window.setInterval(() => void tick(), LIVE_INTERVAL_MS);
        return () => window.clearInterval(id);
    }, [live, page, fetchLogs, fetchFigures]);

    /** Any filter change resets to page 1 — page 3 of the old result set is meaningless. */
    const resetToFirstPage = () => setPage(1);

    const toggleLevel = (level: SystemLogLevel) => {
        resetToFirstPage();
        setLevels((prev) =>
            prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level],
        );
    };

    const clearFilters = () => {
        setSearchInput("");
        setSearch("");
        setLevels([]);
        setKind("");
        setContext("");
        setTag("");
        setUserId("");
        setMinDurationMs(0);
        setSort("recent");
        setFrom("");
        setTo("");
        setPage(1);
    };

    const hasFilters = Boolean(
        search || levels.length || kind || context || tag || userId || minDurationMs || from || to,
    );

    /** Email of the player currently filtered on, for the active-filter chip. */
    const filteredUserLabel =
        rows.find((row) => row.userId === userId)?.userEmail || userId;

    /** First load still in flight: cards pulse instead of reading "—". */
    const statsLoading = stats === null && !statsFailed;
    const timing = stats?.requestTiming;
    const timingAvailable = timing?.available !== false;
    const timingHint = timingAvailable
        ? undefined
        : "Request timing starts once the API database migration 1790300000000-SystemLogCountersAndRequestRollups has run.";

    const refreshAll = async () => {
        await Promise.all([fetchLogs(), fetchSidePanels()]);
    };

    const handleFlush = async () => {
        try {
            setBusy(true);
            await flushSystemLogs();
            await refreshAll();
            toast.success("Buffered lines written");
        } catch (error) {
            toast.error(apiErrorMessage(error, "Flush failed"));
        } finally {
            setBusy(false);
        }
    };

    const handleDeleteOne = async (id: string) => {
        if (!window.confirm("Delete this log entry?")) return;
        try {
            setBusy(true);
            await deleteSystemLog(id);
            setSelected(null);
            await refreshAll();
            toast.success("Entry deleted");
        } catch (error) {
            toast.error(apiErrorMessage(error, "Delete failed"));
        } finally {
            setBusy(false);
        }
    };

    const handleSaveSettings = async (patch: Partial<SystemLogSettings>) => {
        try {
            setSavingSettings(true);
            const saved = await updateSystemLogSettings(patch);
            setSettings(saved);
            toast.success("Capture settings saved");
        } catch (error) {
            toast.error(apiErrorMessage(error, "Could not save settings"));
        } finally {
            setSavingSettings(false);
        }
    };

    /**
     * The API applies retention in ~15-second slices and says when more is
     * left, so a large backlog is several calls with progress in the toast
     * rather than one request that times out halfway.
     */
    const handleRetention = async () => {
        const toastId = toast.loading("Applying retention…");
        try {
            setBusy(true);
            let byAge = 0;
            let byCount = 0;
            let finished = false;
            for (let round = 0; round < MAX_DELETE_ROUNDS && !finished; round++) {
                const result = await runSystemLogRetention();
                if (result.skipped) {
                    toast.error(
                        "Retention is already running (the hourly job or another admin). Try again in a minute.",
                        { id: toastId },
                    );
                    return;
                }
                byAge += result.byAge ?? 0;
                byCount += result.byCount ?? 0;
                finished = result.done !== false;
                if (!finished && (result.byAge ?? 0) + (result.byCount ?? 0) === 0) {
                    // Not done, yet nothing removed: the run failed server-side.
                    toast.error("Retention stopped without removing anything — check the API logs.", {
                        id: toastId,
                    });
                    return;
                }
                if (!finished) {
                    toast.loading(
                        `Applying retention… ${(byAge + byCount).toLocaleString()} removed so far`,
                        { id: toastId },
                    );
                }
            }
            await refreshAll();
            toast.success(
                `Retention applied — removed ${byAge.toLocaleString()} by age, ${byCount.toLocaleString()} over the row cap` +
                (finished ? "" : ". More remain; the hourly job will continue."),
                { id: toastId },
            );
        } catch (error) {
            toast.error(apiErrorMessage(error, "Retention run failed"), { id: toastId });
        } finally {
            setBusy(false);
        }
    };

    /** Exports what is on screen, not the whole table — the page has the rows already. */
    const exportCurrentPage = () => {
        if (rows.length === 0) return;
        const header = [
            "time",
            "kind",
            "level",
            "context",
            "tag",
            "user",
            "userId",
            "method",
            "path",
            "status",
            "durationMs",
            "message",
        ];
        const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
        const csv = [
            header.join(","),
            ...rows.map((row) =>
                [
                    row.createdAt,
                    row.kind,
                    row.level,
                    row.context ?? "",
                    row.tag ?? "",
                    row.userEmail ?? row.username ?? "",
                    row.userId ?? "",
                    row.method ?? "",
                    row.path ?? "",
                    row.statusCode ?? "",
                    row.durationMs ?? "",
                    row.message,
                ]
                    .map((v) => escape(String(v)))
                    .join(","),
            ),
        ].join("\n");

        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `system-logs-page-${page}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-4 p-4 text-white">
            {/* ------------------------------------------------------- header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold">System Logs</h1>
                    <p className="text-sm text-white/50">
                        Backend log lines captured from every API instance. Diagnostics
                        only — not an audit trail.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        className={`${buttonClass} ${live ? "border-green-500/40 text-white" : ""}`}
                        onClick={() => setLive((on) => !on)}
                        aria-pressed={live}
                        title={`Refresh the figures and the first page every ${LIVE_INTERVAL_MS / 1000} seconds`}
                    >
                        <span
                            className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-green-400" : "bg-white/30"}`}
                        />
                        Live
                    </button>
                    <button className={buttonClass} onClick={refreshAll} disabled={busy}>
                        <RotateCw size={15} /> Refresh
                    </button>
                    <button className={buttonClass} onClick={handleFlush} disabled={busy}>
                        <Save size={15} /> Flush buffer
                    </button>
                    <button
                        className={buttonClass}
                        onClick={exportCurrentPage}
                        disabled={rows.length === 0}
                    >
                        <Download size={15} /> Export page
                    </button>
                    <button className={buttonClass} onClick={() => setSettingsOpen(true)}>
                        <Settings2 size={15} /> Capture settings
                    </button>
                    <button
                        className={buttonClass}
                        title="Lock this page and require the passphrase again"
                        onClick={() => {
                            clearLogsAccess();
                            onLocked();
                        }}
                    >
                        <LogOut size={15} /> Lock
                    </button>
                </div>
            </div>

            {/* -------------------------------------------------------- stats */}
            {statsFailed && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                    {stats
                        ? "Couldn't refresh the figures — showing the last values loaded. Press Refresh to try again."
                        : "Couldn't load the figures. Press Refresh to try again."}
                </p>
            )}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
                <StatCard
                    label="Stored entries"
                    value={stats?.total != null ? stats.total.toLocaleString() : "—"}
                    loading={statsLoading}
                />
                {SYSTEM_LOG_LEVELS.slice(0, 3).map((level) => (
                    <StatCard
                        key={level}
                        label={level.toUpperCase()}
                        value={stats?.byLevel ? (stats.byLevel[level] ?? 0).toLocaleString() : "—"}
                        loading={statsLoading}
                    />
                ))}
                <StatCard label="Oldest" value={formatDateTime(stats?.oldest)} small loading={statsLoading} />
                <StatCard label="Newest" value={formatDateTime(stats?.newest)} small loading={statsLoading} />
            </div>

            {/* ----------------------------------------------- request timing */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
                <StatCard
                    label={
                        timing?.since
                            ? `Requests (since ${formatShortDateTime(timing.since)})`
                            : `Requests (${timing?.windowHours ?? 24}h)`
                    }
                    value={timing && timingAvailable ? timing.requests.toLocaleString() : "—"}
                    title={timingHint}
                    loading={statsLoading}
                />
                <StatCard
                    label="Avg response"
                    value={formatDuration(timing?.avgMs ?? null)}
                    valueClass={durationColor(timing?.avgMs ?? null)}
                    title={timingHint}
                    loading={statsLoading}
                />
                <StatCard
                    label="p95 response"
                    value={formatDuration(timing?.p95Ms ?? null)}
                    valueClass={durationColor(timing?.p95Ms ?? null)}
                    title={timingHint ?? "Estimated from a duration histogram — accurate to within one bucket"}
                    loading={statsLoading}
                />
                <StatCard
                    label="Slowest"
                    value={formatDuration(timing?.maxMs ?? null)}
                    valueClass={durationColor(timing?.maxMs ?? null)}
                    title={timingHint}
                    loading={statsLoading}
                />
                <button
                    className={`${panelClass} p-3 text-left transition hover:border-white/25`}
                    onClick={() => setSlowestOpen((v) => !v)}
                >
                    <p className="text-[11px] uppercase tracking-wide text-white/40">
                        Slowest endpoints
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-white/80">
                        <Timer size={14} /> {slowest.length} route(s)
                        <ChevronDown
                            size={14}
                            className={slowestOpen ? "rotate-180 transition" : "transition"}
                        />
                    </p>
                </button>
            </div>

            {slowestOpen && (
                <SlowestEndpointsPanel rows={slowest} emptyHint={timingHint} />
            )}

            {/* ------------------------------------------------------ filters */}
            <div className={`${panelClass} space-y-3 p-3`}>
                {/* Application lines and request rows answer different questions,
                    so they get a hard switch rather than one more dropdown. */}
                <div className="flex flex-wrap items-center gap-2 border-b border-white/5 pb-3">
                    {(
                        [
                            { value: "", label: "All entries" },
                            { value: "app", label: "Application logs" },
                            { value: "http", label: "HTTP requests" },
                        ] as { value: SystemLogKind | ""; label: string }[]
                    ).map((option) => (
                        <button
                            key={option.label}
                            onClick={() => {
                                resetToFirstPage();
                                setKind(option.value);
                                // "Slowest" is meaningless once app rows are in
                                // the mix — they have no duration.
                                if (option.value !== "http" && sort === "slowest") {
                                    setSort("recent");
                                }
                            }}
                            className={`rounded-lg px-3 py-1.5 text-sm transition ${kind === option.value
                                    ? "bg-[#B93DEB]/20 text-white"
                                    : "text-white/45 hover:text-white/80"
                                }`}
                        >
                            {option.label}
                        </button>
                    ))}

                    {kind === "http" && (
                        <div className="ml-auto flex flex-wrap items-center gap-2">
                            <label className="flex items-center gap-2 text-xs text-white/45">
                                Slower than
                                <input
                                    type="number"
                                    min={0}
                                    step={100}
                                    value={minDurationMs}
                                    onChange={(e) => {
                                        resetToFirstPage();
                                        setMinDurationMs(Number(e.target.value));
                                    }}
                                    className={`${inputClass} w-24`}
                                />
                                ms
                            </label>
                            <button
                                onClick={() => {
                                    resetToFirstPage();
                                    setSort(sort === "slowest" ? "recent" : "slowest");
                                }}
                                className={`${buttonClass} ${sort === "slowest" ? "border-[#B93DEB]/50 text-white" : ""
                                    }`}
                            >
                                <Timer size={14} />
                                {sort === "slowest" ? "Slowest first" : "Newest first"}
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[240px] flex-1">
                        <Search
                            size={15}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
                        />
                        <input
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    resetToFirstPage();
                                    setSearch(searchInput.trim());
                                }
                            }}
                            placeholder="Search message or stack trace…"
                            className={`${inputClass} w-full pl-9`}
                        />
                    </div>

                    <select
                        value={context}
                        onChange={(e) => {
                            resetToFirstPage();
                            setContext(e.target.value);
                        }}
                        className={inputClass}
                    >
                        <option value="">All contexts</option>
                        {facets.contexts.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>

                    <select
                        value={tag}
                        onChange={(e) => {
                            resetToFirstPage();
                            setTag(e.target.value);
                        }}
                        className={inputClass}
                    >
                        <option value="">All tags</option>
                        {facets.tags.map((t) => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>

                    <input
                        type="datetime-local"
                        value={from}
                        onChange={(e) => {
                            resetToFirstPage();
                            setFrom(e.target.value);
                        }}
                        className={inputClass}
                        title="From"
                    />
                    <input
                        type="datetime-local"
                        value={to}
                        onChange={(e) => {
                            resetToFirstPage();
                            setTo(e.target.value);
                        }}
                        className={inputClass}
                        title="To"
                    />

                    <select
                        value={limit}
                        onChange={(e) => {
                            resetToFirstPage();
                            setLimit(Number(e.target.value));
                        }}
                        className={inputClass}
                    >
                        {[25, 50, 100, 200].map((n) => (
                            <option key={n} value={n}>
                                {n} / page
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {SYSTEM_LOG_LEVELS.map((level) => {
                        const active = levels.includes(level);
                        return (
                            <button
                                key={level}
                                onClick={() => toggleLevel(level)}
                                className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wide transition ${active
                                        ? LEVEL_STYLES[level]
                                        : "border-[#2C323D] bg-[#242B35] text-white/45 hover:text-white/80"
                                    }`}
                            >
                                {level}
                            </button>
                        );
                    })}

                    <div className="ml-auto flex items-center gap-2">
                        {userId && (
                            <button
                                onClick={() => {
                                    resetToFirstPage();
                                    setUserId("");
                                }}
                                title="Stop filtering by this player"
                                className="flex max-w-[280px] items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs text-sky-300"
                            >
                                <span className="truncate">user: {filteredUserLabel}</span>
                                <X size={12} className="shrink-0" />
                            </button>
                        )}
                        <span
                            className="text-xs text-white/40"
                            title={
                                totalCapped
                                    ? "Counting stops here to keep the page fast — narrow the filters for an exact number."
                                    : undefined
                            }
                        >
                            {total.toLocaleString()}
                            {totalCapped ? "+" : ""} matching
                        </span>
                        {hasFilters && (
                            <button className={buttonClass} onClick={clearFilters}>
                                <X size={14} /> Clear filters
                            </button>
                        )}
                        <button
                            className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300 transition-colors hover:bg-red-500/20"
                            onClick={() => setPurgeOpen(true)}
                        >
                            <Trash2 size={15} /> Delete / clear
                        </button>
                    </div>
                </div>

                {/* Text search has no index to lean on: without a date range it
                    reads every stored entry, which is what times out. */}
                {search && !from && !to && (
                    <p className="text-[11px] text-white/35">
                        Text search reads every stored entry. Add a From date to make it faster.
                    </p>
                )}
            </div>

            {/* -------------------------------------------------------- table */}
            <div className={`${panelClass} overflow-hidden`}>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px]">
                        <thead className="bg-[#242B35]">
                            <tr className="border-b border-gray-800 text-left">
                                <th className="whitespace-nowrap px-4 py-3 text-xs text-white">Time</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs text-white">Level</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs text-white">Context</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs text-white">User</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs text-white">Status</th>
                                <th className="whitespace-nowrap px-4 py-3 text-right text-xs text-white">
                                    Duration
                                </th>
                                <th className="px-4 py-3 text-xs text-white">Message</th>
                                <th className="whitespace-nowrap px-4 py-3 text-center text-xs text-white">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center">
                                        <Loader2 className="mx-auto animate-spin text-purple-400" size={24} />
                                    </td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12">
                                        <NoData title="No log entries found" />
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row, index) => (
                                    <tr
                                        key={row.id}
                                        onClick={() => setSelected(row)}
                                        className={`cursor-pointer hover:bg-[#1a2030] ${index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                                            }`}
                                    >
                                        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-300">
                                            {formatDateTime(row.createdAt)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${LEVEL_STYLES[row.level]}`}
                                            >
                                                {row.level}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-300">
                                            {row.context || row.tag || "—"}
                                        </td>
                                        <td className="max-w-[200px] px-4 py-3 text-xs">
                                            {row.userId ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        resetToFirstPage();
                                                        setUserId(row.userId as string);
                                                    }}
                                                    title={`Show everything for ${row.userEmail ?? row.userId}`}
                                                    className="block max-w-full truncate text-left text-sky-300/80 hover:text-sky-200 hover:underline"
                                                >
                                                    {row.userEmail || row.username || row.userId}
                                                </button>
                                            ) : (
                                                <span className="text-white/25">—</span>
                                            )}
                                        </td>
                                        <td
                                            className={`whitespace-nowrap px-4 py-3 text-xs ${statusColor(row.statusCode)}`}
                                        >
                                            {row.statusCode ?? "—"}
                                        </td>
                                        <td
                                            className={`whitespace-nowrap px-4 py-3 text-right text-xs font-medium ${durationColor(row.durationMs)}`}
                                        >
                                            {formatDuration(row.durationMs)}
                                        </td>
                                        <td className="max-w-[520px] truncate px-4 py-3 text-xs text-gray-300">
                                            {row.kind === "http" && row.method && (
                                                <span className="mr-2 rounded bg-[#242B35] px-1.5 py-0.5 text-[10px] font-medium text-white/60">
                                                    {row.method}
                                                </span>
                                            )}
                                            {row.kind === "http" ? row.path : row.message}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-center">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    void handleDeleteOne(row.id);
                                                }}
                                                className="rounded-lg border border-[#2C323D] bg-[#242B35] p-1.5 text-white/50 transition-colors hover:text-red-400"
                                                title="Delete entry"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {!loading && totalPages > 1 && (
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            )}

            {!loading && browseLimit !== null && (totalCapped || total > browseLimit) && (
                <p className="text-right text-xs text-white/40">
                    Paging covers the newest {browseLimit.toLocaleString()} matches. Set a date range or
                    another filter to reach older entries.
                </p>
            )}

            {settingsOpen && (
                <CaptureSettingsModal
                    settings={settings}
                    saving={savingSettings}
                    pendingWrites={stats?.pendingWrites ?? 0}
                    busy={busy}
                    onSave={handleSaveSettings}
                    onRunRetention={handleRetention}
                    onClose={() => setSettingsOpen(false)}
                />
            )}

            {selected && (
                <LogDetailModal
                    key={selected.id}
                    entry={selected}
                    onClose={() => setSelected(null)}
                    onDelete={() => handleDeleteOne(selected.id)}
                />
            )}

            {purgeOpen && (
                <PurgeModal
                    activeFilterSummary={
                        hasFilters
                            ? [
                                levels.length ? `levels: ${levels.join(", ")}` : null,
                                kind ? `kind: ${kind}` : null,
                                minDurationMs ? `slower than ${minDurationMs}ms` : null,
                                userId ? `user: ${filteredUserLabel}` : null,
                                context ? `context: ${context}` : null,
                                tag ? `tag: ${tag}` : null,
                                search ? `search: "${search}"` : null,
                                from ? `from: ${formatDateTime(fromLocalInputValue(from))}` : null,
                                to ? `to: ${formatDateTime(fromLocalInputValue(to))}` : null,
                            ]
                                .filter(Boolean)
                                .join(" · ")
                            : null
                    }
                    matching={total}
                    matchingCapped={totalCapped}
                    busy={busy}
                    onClose={() => setPurgeOpen(false)}
                    onPurge={async (mode, olderThanDays) => {
                        // Filtered deletes stop at the moment of the click, so
                        // entries still arriving are not chased round after
                        // round — and only what was on screen goes.
                        const startedAt = new Date().toISOString();
                        const until = to ? fromLocalInputValue(to) : undefined;
                        const payload: PurgeSystemLogsPayload =
                            mode === "filtered"
                                ? {
                                    levels: levels.length ? levels : undefined,
                                    kind: kind || undefined,
                                    minDurationMs: minDurationMs > 0 ? minDurationMs : undefined,
                                    context: context || undefined,
                                    tag: tag || undefined,
                                    userId: userId || undefined,
                                    search: search || undefined,
                                    from: from ? fromLocalInputValue(from) : undefined,
                                    to: until && until < startedAt ? until : startedAt,
                                    confirm: true,
                                }
                                : mode === "older"
                                    ? { olderThanDays, confirm: true }
                                    : { all: true, confirm: true };

                        const toastId = toast.loading("Deleting…");
                        try {
                            setBusy(true);
                            let deleted = 0;
                            let finished = false;
                            // The API deletes in ~15-second slices and says
                            // when rows still match; keep going until it is done.
                            for (let round = 0; round < MAX_DELETE_ROUNDS && !finished; round++) {
                                const result = await purgeSystemLogs(payload);
                                deleted += result.deleted ?? 0;
                                finished = result.done !== false;
                                if (!finished) {
                                    toast.loading(`Deleting… ${deleted.toLocaleString()} so far`, {
                                        id: toastId,
                                    });
                                }
                            }
                            setPurgeOpen(false);
                            setPage(1);
                            await refreshAll();
                            toast.success(
                                `Deleted ${deleted.toLocaleString()} entries` +
                                (finished ? "" : ". Some still match — run it again to continue."),
                                { id: toastId },
                            );
                        } catch (error) {
                            toast.error(apiErrorMessage(error, "Delete failed"), { id: toastId });
                        } finally {
                            setBusy(false);
                        }
                    }}
                />
            )}
        </div>
    );
}

/* -------------------------------------------------------------- sub-views */

function StatCard({
    label,
    value,
    small = false,
    valueClass = "",
    loading = false,
    title,
}: {
    label: string;
    value: string;
    small?: boolean;
    valueClass?: string;
    /** First load in flight — a placeholder bar, so "—" only ever means "not available". */
    loading?: boolean;
    title?: string;
}) {
    return (
        <div className={`${panelClass} p-3`} title={title}>
            <p className="text-[11px] uppercase tracking-wide text-white/40">{label}</p>
            {loading ? (
                <div className={`mt-2 animate-pulse rounded bg-white/10 ${small ? "h-3 w-24" : "h-5 w-16"}`} />
            ) : (
                <p className={`mt-1 font-semibold ${small ? "text-xs" : "text-lg"} ${valueClass}`}>
                    {value}
                </p>
            )}
        </div>
    );
}

/**
 * Grouped by route rather than listing individual slow requests: one outlier
 * and a route that is always slow call for different responses, and only the
 * grouping tells them apart.
 */
function SlowestEndpointsPanel({
    rows,
    emptyHint,
}: {
    rows: SlowEndpointRow[];
    /** Why the list is empty, when it is not simply a quiet day. */
    emptyHint?: string;
}) {
    if (rows.length === 0) {
        return (
            <div className={`${panelClass} p-4 text-sm text-white/50`}>
                {emptyHint ?? "No request timing recorded in the last 24 hours."}
            </div>
        );
    }

    return (
        <div className={`${panelClass} overflow-hidden`}>
            <div className="border-b border-white/5 px-4 py-2 text-xs uppercase tracking-wide text-white/40">
                Slowest routes — last 24 hours, by average · every request counted, grouped by route
            </div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                    <thead className="bg-[#242B35]">
                        <tr className="text-left">
                            <th className="px-4 py-2 text-xs text-white">Method</th>
                            <th className="px-4 py-2 text-xs text-white">Route</th>
                            <th className="px-4 py-2 text-right text-xs text-white">Calls</th>
                            <th className="px-4 py-2 text-right text-xs text-white">Avg</th>
                            <th
                                className="px-4 py-2 text-right text-xs text-white"
                                title="Estimated from a duration histogram — accurate to within one bucket"
                            >
                                p95
                            </th>
                            <th className="px-4 py-2 text-right text-xs text-white">Max</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, index) => (
                            <tr
                                key={`${row.method}-${row.path}-${index}`}
                                className={index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"}
                            >
                                <td className="px-4 py-2 text-xs text-white/60">{row.method}</td>
                                <td className="max-w-[420px] truncate px-4 py-2 text-xs text-gray-300">
                                    {row.path}
                                </td>
                                <td className="px-4 py-2 text-right text-xs text-white/60">
                                    {row.calls.toLocaleString()}
                                </td>
                                <td className={`px-4 py-2 text-right text-xs font-medium ${durationColor(row.avgMs)}`}>
                                    {formatDuration(row.avgMs)}
                                </td>
                                <td className={`px-4 py-2 text-right text-xs ${durationColor(row.p95Ms ?? null)}`}>
                                    {formatDuration(row.p95Ms ?? null)}
                                </td>
                                <td className={`px-4 py-2 text-right text-xs ${durationColor(row.maxMs)}`}>
                                    {formatDuration(row.maxMs)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/**
 * Reusable on/off switch.
 *
 * `shrink-0` is load-bearing: without it flexbox collapses the track to fit the
 * label beside it, and the absolutely-positioned knob then renders on top of
 * the text. That is what the old inline panel was doing.
 */
function Toggle({
    checked,
    onChange,
    disabled = false,
    title,
}: {
    checked: boolean;
    onChange: () => void;
    disabled?: boolean;
    title?: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            title={title}
            onClick={onChange}
            disabled={disabled}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${checked ? "bg-green-500/80" : "bg-[#2C323D]"
                }`}
        >
            <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"
                    }`}
            />
        </button>
    );
}

/** One labelled switch row: track, then a title and explanation beside it. */
function ToggleRow({
    checked,
    onChange,
    disabled,
    title,
    description,
    children,
}: {
    checked: boolean;
    onChange: () => void;
    disabled?: boolean;
    title: string;
    description: React.ReactNode;
    children?: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-[#12161C] p-3 sm:flex-row sm:items-start">
            <Toggle checked={checked} onChange={onChange} disabled={disabled} />
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white/90">
                    {title} <span className="text-white/45">— {checked ? "ON" : "OFF"}</span>
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-white/45">{description}</p>
            </div>
            {children && <div className="shrink-0">{children}</div>}
        </div>
    );
}

function CaptureSettingsModal({
    settings,
    saving,
    pendingWrites,
    busy,
    onSave,
    onRunRetention,
    onClose,
}: {
    settings: SystemLogSettings | null;
    saving: boolean;
    pendingWrites: number;
    busy: boolean;
    onSave: (patch: Partial<SystemLogSettings>) => void;
    onRunRetention: () => void;
    onClose: () => void;
}) {
    const [minLevel, setMinLevel] = useState<SystemLogLevel>("warn");
    const [retentionDays, setRetentionDays] = useState(14);
    const [maxRows, setMaxRows] = useState(500000);
    const [excluded, setExcluded] = useState("");
    const [slowRequestMs, setSlowRequestMs] = useState(0);
    // Open on first view: these settings decide how much gets written to the
    // database, so the cost of each one is worth reading before changing it.
    const [guideOpen, setGuideOpen] = useState(true);

    // Re-seed whenever the saved settings change, so the form never shows a
    // stale draft after a save. Defaults mirror the server's, so an API that
    // predates a field leaves the input controlled.
    useEffect(() => {
        if (!settings) return;
        setMinLevel(settings.minLevel ?? "warn");
        setRetentionDays(Number(settings.retentionDays ?? 14));
        setMaxRows(Number(settings.maxRows ?? 500000));
        setExcluded((settings.excludedContexts || []).join(", "));
        setSlowRequestMs(Number(settings.slowRequestMs ?? 0));
    }, [settings]);

    // Escape closes, matching every other dialog in the panel.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const save = () =>
        onSave({
            minLevel,
            retentionDays,
            maxRows,
            slowRequestMs,
            excludedContexts: excluded
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean),
        });

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={onClose}
        >
            <div
                className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#161A21]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ------------------------------------------------------ header */}
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                    <div className="flex items-center gap-2">
                        <Settings2 size={18} className="text-[#B93DEB]" />
                        <div>
                            <h2 className="text-base font-semibold text-white">Capture settings</h2>
                            <p className="text-xs text-white/45">
                                Applies to every API instance within a minute.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setGuideOpen((v) => !v)}
                            aria-expanded={guideOpen}
                            title={guideOpen ? "Hide the guide" : "What does each setting do?"}
                            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs transition-colors ${guideOpen
                                    ? "border-[#B93DEB]/50 bg-[#B93DEB]/10 text-white"
                                    : "border-[#2C323D] bg-[#242B35] text-white/60 hover:text-white"
                                }`}
                        >
                            <Info size={15} /> Guide
                        </button>
                        <button
                            onClick={onClose}
                            className="rounded-lg border border-[#2C323D] bg-[#242B35] p-2 text-white/60 transition-colors hover:text-white"
                            aria-label="Close"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* -------------------------------------------------------- body */}
                {!settings ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="animate-spin text-purple-400" size={26} />
                    </div>
                ) : (
                    <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
                        {guideOpen && <SettingsGuide onDismiss={() => setGuideOpen(false)} />}

                        {/* ---- master switches ---- */}
                        <section className="space-y-3">
                            <SectionTitle
                                title="What gets captured"
                                hint={`${pendingWrites} line(s) buffered on this instance`}
                            />

                            <ToggleRow
                                checked={settings.enabled}
                                disabled={saving}
                                onChange={() => onSave({ enabled: !settings.enabled })}
                                title="Log capture"
                                description="When off, nothing is written to the database and no buffer is kept. Console output is unaffected either way."
                            />

                            <ToggleRow
                                checked={settings.captureRequests}
                                disabled={saving}
                                onChange={() => onSave({ captureRequests: !settings.captureRequests })}
                                title="Request timing"
                                description={
                                    <>
                                        One row per completed request: method, route, status and how
                                        long the server took. Independent of the capture level below,
                                        so leaving that on <span className="text-white/70">warn</span>{" "}
                                        does not hide successful requests.
                                    </>
                                }
                            />

                            <p className="text-xs text-white/35">
                                Both switches save immediately. The fields below save with the button
                                at the bottom.
                            </p>
                        </section>

                        {/* ---- thresholds ---- */}
                        <section className="space-y-3">
                            <SectionTitle title="Thresholds" />

                            <div className="grid gap-3 sm:grid-cols-2">
                                <Labelled
                                    label="Capture level and above"
                                    hint="Errors and warnings are what you usually want. `log` is high volume on a busy backend."
                                >
                                    <select
                                        value={minLevel}
                                        onChange={(e) => setMinLevel(e.target.value as SystemLogLevel)}
                                        className={`${inputClass} w-full`}
                                    >
                                        {SYSTEM_LOG_LEVELS.map((level) => (
                                            <option key={level} value={level}>
                                                {level}
                                            </option>
                                        ))}
                                    </select>
                                </Labelled>

                                <Labelled
                                    label="Only store requests slower than"
                                    hint="0 stores every request. Failed requests are always stored regardless — a fast 500 still matters. The timing figures count every request whatever this is set to."
                                >
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min={0}
                                            step={100}
                                            value={slowRequestMs}
                                            onChange={(e) => setSlowRequestMs(Number(e.target.value))}
                                            className={`${inputClass} w-full`}
                                        />
                                        <span className="shrink-0 text-xs text-white/50">ms</span>
                                    </div>
                                </Labelled>
                            </div>

                            <Labelled
                                label="Skip these contexts"
                                hint="Comma separated. The escape hatch for one noisy subsystem without turning capture off."
                            >
                                <input
                                    value={excluded}
                                    onChange={(e) => setExcluded(e.target.value)}
                                    placeholder="e.g. RouterExplorer, InstanceLoader"
                                    className={`${inputClass} w-full`}
                                />
                            </Labelled>
                        </section>

                        {/* ---- retention ---- */}
                        <section className="space-y-3">
                            <SectionTitle
                                title="Auto-clear"
                                hint="Runs every hour"
                            />

                            <div className="grid gap-3 sm:grid-cols-2">
                                <Labelled
                                    label="Delete entries older than"
                                    hint="0 keeps them forever."
                                >
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min={0}
                                            value={retentionDays}
                                            onChange={(e) => setRetentionDays(Number(e.target.value))}
                                            className={`${inputClass} w-full`}
                                        />
                                        <span className="shrink-0 text-xs text-white/50">days</span>
                                    </div>
                                </Labelled>

                                <Labelled
                                    label="Keep at most"
                                    hint="Oldest rows beyond this are dropped. 0 is unlimited."
                                >
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min={0}
                                            step={10000}
                                            value={maxRows}
                                            onChange={(e) => setMaxRows(Number(e.target.value))}
                                            className={`${inputClass} w-full`}
                                        />
                                        <span className="shrink-0 text-xs text-white/50">rows</span>
                                    </div>
                                </Labelled>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-[#12161C] p-3">
                                <p className="min-w-0 flex-1 text-xs text-white/45">
                                    Apply these rules right now instead of waiting for the next hourly run. Save
                                    first if you changed the numbers above.
                                </p>
                                <button
                                    className={buttonClass}
                                    onClick={onRunRetention}
                                    disabled={busy}
                                >
                                    <Trash2 size={15} /> Apply retention now
                                </button>
                            </div>
                        </section>
                    </div>
                )}

                {/* ------------------------------------------------------ footer */}
                <div className="flex items-center justify-end gap-2 border-t border-white/10 bg-[#12161C] px-5 py-3">
                    <button className={buttonClass} onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        onClick={save}
                        disabled={saving || !settings}
                        className="flex items-center gap-2 rounded-lg bg-[#B93DEB] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#a032d0] disabled:opacity-40"
                    >
                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        Save settings
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * What each setting costs, in plain terms.
 *
 * Written around the trade-off rather than restating the label: every one of
 * these controls how much gets written to the database on a live casino
 * backend, and the wrong value is either a table that fills a disk or a gap
 * where the evidence should have been.
 */
const GUIDE_ENTRIES: { name: string; what: string; when: string }[] = [
    {
        name: "Log capture",
        what: "Master switch. Off means nothing is written and no buffer is held in memory. Console output is unaffected either way, so the container logs stay exactly as they were.",
        when: "Turn it off if this table is not being used. Nothing else in the platform reads it.",
    },
    {
        name: "Request timing",
        what: "Stores one row per completed request — method, route, status code and how long the server took to handle it — and feeds the timing figures at the top of the page. Excludes network transit, so a client stopwatch always reads higher.",
        when: "Leave on. This is what shows a provider timing out on a slow webhook, which application logs alone never reveal.",
    },
    {
        name: "Capture level and above",
        what: "Severity floor for application log lines. From most to least severe: error, warn, log, debug, verbose. Picking one stores it and everything above it.",
        when: "warn day to day. Drop to log only while chasing something specific — it is a very high write volume — then put it back.",
    },
    {
        name: "Only store requests slower than",
        what: "Millisecond floor for request rows. 0 stores every request. Failed requests (4xx and 5xx) are stored regardless of this value — a fast 500 still matters. The timing figures and slowest routes still count every request, whatever this is set to.",
        when: "Raise it (500 ms is a good start) once the table gets busy: polling endpoints stop filling it, and the figures stay complete.",
    },
    {
        name: "Skip these contexts",
        what: "Logger names to ignore even when they pass the level threshold. Match the Context column exactly.",
        when: "One subsystem is flooding the table and you want the rest.",
    },
    {
        name: "Delete entries older than",
        what: "Age-based auto-clear, applied every hour. 0 keeps entries forever.",
        when: "Keep a bound on it. Logs older than a couple of weeks are rarely the ones you need.",
    },
    {
        name: "Keep at most",
        what: "Ceiling on stored rows. Anything beyond it is dropped oldest-first, on the same hourly run. 0 is unlimited.",
        when: "The backstop that stops an unattended environment filling its disk.",
    },
    {
        name: "Apply retention now",
        what: "Runs both auto-clear rules immediately instead of waiting for the next hourly run. A large backlog is removed in slices, with progress shown as it goes.",
        when: "Straight after lowering the retention numbers, to reclaim the space now.",
    },
];

function SettingsGuide({ onDismiss }: { onDismiss: () => void }) {
    return (
        <section className="rounded-lg border border-[#B93DEB]/25 bg-[#B93DEB]/6 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                    <Info size={16} className="mt-0.5 shrink-0 text-[#B93DEB]" />
                    <div>
                        <h3 className="text-sm font-medium text-white/90">
                            What each setting does
                        </h3>
                        <p className="mt-0.5 text-xs text-white/45">
                            Every change here reaches all API instances within a minute. The two
                            switches save on click; the fields save with the button at the bottom.
                        </p>
                    </div>
                </div>
                <button
                    onClick={onDismiss}
                    className="shrink-0 rounded-md px-2 py-1 text-xs text-white/45 transition-colors hover:text-white"
                >
                    Hide
                </button>
            </div>

            <dl className="space-y-2.5">
                {GUIDE_ENTRIES.map((entry) => (
                    <div
                        key={entry.name}
                        className="grid gap-1 sm:grid-cols-[170px_1fr] sm:gap-3"
                    >
                        <dt className="text-xs font-medium text-white/75">{entry.name}</dt>
                        <dd className="text-xs leading-relaxed text-white/50">
                            {entry.what}{" "}
                            <span className="text-white/35">{entry.when}</span>
                        </dd>
                    </div>
                ))}
            </dl>

            <p className="mt-3 border-t border-white/10 pt-3 text-xs text-white/35">
                These entries are diagnostics, not an audit trail. Nothing else in the platform
                reads this table, so deleting from it only affects what this page can show you.
            </p>
        </section>
    );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
    return (
        <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[11px] uppercase tracking-wide text-white/40">{title}</h3>
            {hint && <span className="text-[11px] text-white/30">{hint}</span>}
        </div>
    );
}

function Labelled({
    label,
    hint,
    children,
}: {
    label: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <label className="block space-y-1">
            <span className="block text-xs text-white/60">{label}</span>
            {children}
            {hint && <span className="block text-[11px] leading-relaxed text-white/35">{hint}</span>}
        </label>
    );
}

function LogDetailModal({
    entry: listRow,
    onClose,
    onDelete,
}: {
    entry: SystemLogEntry;
    onClose: () => void;
    onDelete: () => void;
}) {
    // List rows carry a trimmed message and no stack or metadata; the full
    // record is fetched here. Until it arrives — or if it cannot be — the list
    // row is shown, so the dialog is never empty. The parent keys this dialog
    // by entry id, so another entry mounts a fresh one with fresh state.
    const [entry, setEntry] = useState<SystemLogEntry>(listRow);
    const [loadingFull, setLoadingFull] = useState(true);

    useEffect(() => {
        let cancelled = false;
        getSystemLog(listRow.id)
            .then((full) => {
                if (!cancelled && full) setEntry({ ...listRow, ...full });
            })
            .catch(() => undefined)
            .finally(() => {
                if (!cancelled) setLoadingFull(false);
            });
        return () => {
            cancelled = true;
        };
    }, [listRow]);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(
                JSON.stringify(entry, null, 2),
            );
            toast.success("Copied to clipboard");
        } catch {
            toast.error("Clipboard unavailable");
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={onClose}
        >
            <div
                className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-white/10 bg-[#161A21] p-5"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${LEVEL_STYLES[entry.level]}`}
                            >
                                {entry.level}
                            </span>
                            <span className="text-sm text-white/70">{entry.context || "—"}</span>
                            {entry.tag && (
                                <span className="rounded-md bg-[#242B35] px-2 py-0.5 text-xs text-white/60">
                                    {entry.tag}
                                </span>
                            )}
                            {loadingFull && (
                                <Loader2
                                    size={14}
                                    className="animate-spin text-purple-400"
                                    aria-label="Loading the full entry"
                                />
                            )}
                        </div>
                        <p className="text-xs text-white/40">{formatDateTime(entry.createdAt)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button className={buttonClass} onClick={copy} disabled={loadingFull}>
                            <Copy size={14} /> Copy
                        </button>
                        <button
                            className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300 hover:bg-red-500/20"
                            onClick={onDelete}
                        >
                            <Trash2 size={14} /> Delete
                        </button>
                        <button className={buttonClass} onClick={onClose}>
                            <X size={14} />
                        </button>
                    </div>
                </div>

                {entry.userId && (
                    <Field label="Player">
                        <div className="grid gap-3 sm:grid-cols-3">
                            <Detail
                                label="Email / phone"
                                value={entry.userEmail ?? "not found"}
                                className={entry.userEmail ? "" : "text-white/35"}
                            />
                            <Detail label="Username" value={entry.username ?? "—"} />
                            <Detail label="User ID" value={entry.userId} />
                        </div>
                        {!entry.userEmail && (
                            <p className="mt-2 text-[11px] text-white/35">
                                No account matches this id — it may have been deleted, or the id
                                was read from a message that was not referring to a player.
                            </p>
                        )}
                    </Field>
                )}

                {entry.kind === "http" && (
                    <Field label="Request">
                        <div className="grid gap-3 sm:grid-cols-4">
                            <Detail label="Method" value={entry.method ?? "—"} />
                            <Detail
                                label="Status"
                                value={String(entry.statusCode ?? "—")}
                                className={statusColor(entry.statusCode)}
                            />
                            <Detail
                                label="Duration"
                                value={formatDuration(entry.durationMs)}
                                className={durationColor(entry.durationMs)}
                            />
                            <Detail label="Handler" value={String(entry.metadata?.handler ?? "—")} />
                        </div>
                        <p className="mt-3 break-all font-mono text-xs text-gray-300">
                            {entry.path}
                        </p>
                    </Field>
                )}

                <Field label="Message">
                    <pre className="whitespace-pre-wrap break-words text-xs text-gray-200">
                        {entry.message}
                    </pre>
                </Field>

                {entry.stack && (
                    <Field label="Stack trace">
                        <pre className="whitespace-pre-wrap break-words text-xs text-red-200/80">
                            {entry.stack}
                        </pre>
                    </Field>
                )}

                {entry.metadata && (
                    <Field label="Metadata">
                        <pre className="whitespace-pre-wrap break-words text-xs text-gray-300">
                            {JSON.stringify(entry.metadata, null, 2)}
                        </pre>
                    </Field>
                )}

                <Field label="Entry ID">
                    <p className="font-mono text-xs text-white/50">{entry.id}</p>
                </Field>
            </div>
        </div>
    );
}

function Detail({
    label,
    value,
    className = "",
}: {
    label: string;
    value: string;
    className?: string;
}) {
    return (
        <div>
            <p className="text-[10px] uppercase tracking-wide text-white/35">{label}</p>
            {/* break-all so a 36-character id wraps inside its column instead
                of pushing the grid wider than the dialog. */}
            <p className={`mt-0.5 break-all text-sm font-medium ${className || "text-white/80"}`}>
                {value}
            </p>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="mb-4">
            <p className="mb-1 text-[11px] uppercase tracking-wide text-white/40">{label}</p>
            <div className="rounded-lg border border-white/10 bg-[#12161C] p-3">{children}</div>
        </div>
    );
}

type PurgeMode = "filtered" | "older" | "all";

function PurgeModal({
    activeFilterSummary,
    matching,
    matchingCapped = false,
    busy = false,
    onClose,
    onPurge,
}: {
    activeFilterSummary: string | null;
    matching: number;
    /** `matching` is a floor — more rows match than were counted. */
    matchingCapped?: boolean;
    /** A delete is running: no second click, and no closing mid-way. */
    busy?: boolean;
    onClose: () => void;
    onPurge: (mode: PurgeMode, olderThanDays?: number) => void;
}) {
    const [mode, setMode] = useState<PurgeMode>(
        activeFilterSummary ? "filtered" : "older",
    );
    const [olderThanDays, setOlderThanDays] = useState(30);
    // "Clear everything" is the one action with no filter to limit it, so it
    // takes a typed confirmation rather than a single click.
    const [typed, setTyped] = useState("");

    const canSubmit =
        mode === "filtered"
            ? Boolean(activeFilterSummary)
            : mode === "older"
                ? olderThanDays >= 0
                : typed === "DELETE ALL";

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={busy ? undefined : onClose}
        >
            <div
                className="w-full max-w-lg space-y-4 rounded-xl border border-white/10 bg-[#161A21] p-5"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2">
                    <AlertTriangle size={18} className="text-amber-400" />
                    <h2 className="text-base font-semibold">Delete log entries</h2>
                </div>
                <p className="text-xs text-white/45">
                    Deleting log entries cannot be undone. Nothing else in the platform reads
                    this table, so removing rows only affects what this page can show you.
                </p>

                <div className="space-y-2">
                    <ModeOption
                        checked={mode === "filtered"}
                        disabled={!activeFilterSummary}
                        onSelect={() => setMode("filtered")}
                        title={`Matching the current filters (${matching.toLocaleString()}${matchingCapped ? "+" : ""} entries)`}
                        description={
                            activeFilterSummary ?? "No filters are applied — pick another option."
                        }
                    />

                    <ModeOption
                        checked={mode === "older"}
                        onSelect={() => setMode("older")}
                        title="Older than"
                        description="Ignores the current filters and deletes purely by age."
                    >
                        <div className="mt-2 flex items-center gap-2">
                            <input
                                type="number"
                                min={0}
                                value={olderThanDays}
                                onChange={(e) => setOlderThanDays(Number(e.target.value))}
                                className={`${inputClass} w-24`}
                            />
                            <span className="text-xs text-white/50">days</span>
                        </div>
                    </ModeOption>

                    <ModeOption
                        checked={mode === "all"}
                        onSelect={() => setMode("all")}
                        title="Clear everything"
                        description="Removes every stored log entry."
                    >
                        {mode === "all" && (
                            <input
                                value={typed}
                                onChange={(e) => setTyped(e.target.value)}
                                placeholder='Type "DELETE ALL" to confirm'
                                className={`${inputClass} mt-2 w-full`}
                            />
                        )}
                    </ModeOption>
                </div>

                <div className="flex justify-end gap-2">
                    <button className={buttonClass} onClick={onClose} disabled={busy}>
                        Cancel
                    </button>
                    <button
                        disabled={!canSubmit || busy}
                        onClick={() => onPurge(mode, olderThanDays)}
                        className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/15 px-4 py-2 text-sm text-red-300 transition-colors hover:bg-red-500/25 disabled:opacity-30"
                    >
                        {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        {busy ? "Deleting…" : "Delete"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ModeOption({
    checked,
    disabled = false,
    onSelect,
    title,
    description,
    children,
}: {
    checked: boolean;
    disabled?: boolean;
    onSelect: () => void;
    title: string;
    description: string;
    children?: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            disabled={disabled}
            className={`w-full rounded-lg border p-3 text-left transition ${checked
                    ? "border-[#B93DEB]/50 bg-[#B93DEB]/10"
                    : "border-white/10 bg-[#12161C] hover:border-white/20"
                } disabled:opacity-40`}
        >
            <p className="text-sm text-white/90">{title}</p>
            <p className="mt-0.5 text-xs text-white/45">{description}</p>
            {children}
        </button>
    );
}
