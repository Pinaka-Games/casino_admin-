import api from "../config/axios.config";
import { getLogsAccessToken } from "./logs-access";

/**
 * Longer than the panel-wide 12 s default. The API stops its own queries at
 * 20 s and answers with an explanation ("add a date range…"); a client that
 * gave up first would only ever show a bare timeout instead.
 */
const LOGS_TIMEOUT_MS = 30_000;

/**
 * System Logs needs the development passphrase on top of the employee token.
 * Attached here rather than in a global interceptor so only these calls carry
 * it, and it is impossible to leak onto an unrelated request.
 */
const withAccess = (config: Record<string, unknown> = {}) => {
    const token = getLogsAccessToken();
    return {
        timeout: LOGS_TIMEOUT_MS,
        ...config,
        headers: {
            ...((config.headers as Record<string, string>) ?? {}),
            ...(token ? { "X-Logs-Key": token } : {}),
        },
    };
};

export type SystemLogLevel = "error" | "warn" | "log" | "debug" | "verbose";

export const SYSTEM_LOG_LEVELS: SystemLogLevel[] = [
    "error",
    "warn",
    "log",
    "debug",
    "verbose",
];

/** app = a service log line, http = one completed request with its duration. */
export type SystemLogKind = "app" | "http";

export interface SystemLogEntry {
    id: string;
    kind: SystemLogKind;
    level: SystemLogLevel;
    /** Logger name the line came from, e.g. "AleaPlayController". */
    context: string | null;
    message: string;
    stack: string | null;
    /** Leading [Tag] parsed off the message, e.g. "AleaPlay". */
    tag: string | null;
    /** Player this line concerns, when one could be determined. */
    userId: string | null;
    /** Resolved on read from users.entity — an email or a phone number. */
    userEmail: string | null;
    username: string | null;
    /** HTTP rows only — null on app rows. */
    method: string | null;
    path: string | null;
    statusCode: number | null;
    /** Server handling time in ms. Excludes network transit. */
    durationMs: number | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
}

export interface SystemLogListResponse {
    /**
     * List rows carry a trimmed message and no stack or metadata — fetch the
     * entry by id (getSystemLog) for the full record.
     */
    rows: SystemLogEntry[];
    pagination: {
        total: number;
        /** True when more rows match than were counted: show `total` as "N+". */
        totalCapped?: boolean;
        page: number;
        limit: number;
        totalPages: number;
        /** Deepest row reachable by paging; narrow the filters to go further back. */
        browseLimit?: number;
    };
}

export interface SystemLogStats {
    /** Null when the count could not be read — shown as "—", not 0. */
    total: number | null;
    byLevel: Record<SystemLogLevel, number> | null;
    byKind?: Record<SystemLogKind, number> | null;
    oldest: string | null;
    newest: string | null;
    /** Captured but not yet written by the instance that served this request. */
    pendingWrites: number;
    /**
     * Request timing over a rolling window, not all time. Counts every
     * request, including ones too fast to be stored as rows.
     */
    requestTiming: {
        windowHours: number;
        requests: number;
        avgMs: number | null;
        /** Estimated from a duration histogram, accurate to one bucket. */
        p95Ms: number | null;
        maxMs: number | null;
        /** Set while timing has been recorded for less than the window. */
        since?: string | null;
        /** False until the API's request-timing migration has run. */
        available?: boolean;
    };
}

export interface SlowEndpointRow {
    method: string;
    /** Route template, e.g. /api/v1/admin/players/:id. */
    path: string;
    calls: number;
    avgMs: number;
    p95Ms?: number;
    maxMs: number;
}

export interface SystemLogFacets {
    contexts: string[];
    tags: string[];
}

export interface SystemLogSettings {
    id: string;
    enabled: boolean;
    minLevel: SystemLogLevel;
    excludedContexts: string[];
    /** One row per completed request, with duration. */
    captureRequests: boolean;
    /** Only store requests at least this slow. 0 = all. Failures always stored. */
    slowRequestMs: number;
    retentionDays: number;
    maxRows: number;
    updatedAt: string;
}

export interface SystemLogQuery {
    page?: number;
    limit?: number;
    levels?: SystemLogLevel[];
    kind?: SystemLogKind;
    context?: string;
    tag?: string;
    userId?: string;
    search?: string;
    path?: string;
    statusCode?: number;
    minDurationMs?: number;
    sort?: "recent" | "slowest";
    from?: string;
    to?: string;
}

export interface PurgeSystemLogsPayload
    extends Omit<SystemLogQuery, "page" | "limit" | "sort" | "statusCode" | "path"> {
    olderThanDays?: number;
    /** Clear every entry. The API refuses a request with no filter unless this is set. */
    all?: true;
    /** The API rejects the request without this. */
    confirm: true;
}

/** One slice of a delete. `done: false` means rows still match — call again. */
export interface PurgeResult {
    deleted: number;
    done?: boolean;
}

export interface RetentionResult {
    byAge: number;
    byCount: number;
    /** False while rows over the limits remain — call again. */
    done?: boolean;
    /** Another run (another instance, or another admin) holds the retention lock. */
    skipped?: boolean;
}

/**
 * Drops empty values so an untouched filter is absent from the query string
 * rather than sent as "", which the API would treat as a real filter.
 */
const toParams = (query: SystemLogQuery): Record<string, string | number> => {
    const params: Record<string, string | number> = {};
    if (query.page) params.page = query.page;
    if (query.limit) params.limit = query.limit;
    if (query.levels?.length) params.levels = query.levels.join(",");
    if (query.kind) params.kind = query.kind;
    if (query.context) params.context = query.context;
    if (query.tag) params.tag = query.tag;
    if (query.userId) params.userId = query.userId;
    if (query.search) params.search = query.search;
    if (query.path) params.path = query.path;
    if (query.statusCode) params.statusCode = query.statusCode;
    if (query.minDurationMs) params.minDurationMs = query.minDurationMs;
    if (query.sort) params.sort = query.sort;
    if (query.from) params.from = query.from;
    if (query.to) params.to = query.to;
    return params;
};

export const getSystemLogs = async (
    query: SystemLogQuery = {},
): Promise<SystemLogListResponse> => {
    const res = await api.get<SystemLogListResponse>(
        "/system-logs",
        withAccess({ params: toParams(query) }),
    );
    return res.data;
};

export const getSystemLog = async (id: string): Promise<SystemLogEntry> => {
    const res = await api.get<SystemLogEntry>(`/system-logs/${id}`, withAccess());
    return res.data;
};

export const getSystemLogStats = async (): Promise<SystemLogStats> => {
    const res = await api.get<SystemLogStats>("/system-logs/stats", withAccess());
    return res.data;
};

export const getSlowestEndpoints = async (
    hours = 24,
    limit = 20,
): Promise<SlowEndpointRow[]> => {
    const res = await api.get<SlowEndpointRow[]>(
        "/system-logs/slowest-endpoints",
        withAccess({ params: { hours, limit } }),
    );
    return res.data;
};

export const getSystemLogFacets = async (): Promise<SystemLogFacets> => {
    const res = await api.get<SystemLogFacets>("/system-logs/facets", withAccess());
    return res.data;
};

export const getSystemLogSettings = async (): Promise<SystemLogSettings> => {
    const res = await api.get<SystemLogSettings>("/system-logs/settings", withAccess());
    return res.data;
};

export const updateSystemLogSettings = async (
    payload: Partial<Omit<SystemLogSettings, "id" | "updatedAt">>,
): Promise<SystemLogSettings> => {
    const res = await api.put<SystemLogSettings>("/system-logs/settings", payload, withAccess());
    return res.data;
};

export const deleteSystemLog = async (id: string): Promise<{ deleted: number }> => {
    const res = await api.delete<{ deleted: number }>(`/system-logs/${id}`, withAccess());
    return res.data;
};

export const purgeSystemLogs = async (payload: PurgeSystemLogsPayload): Promise<PurgeResult> => {
    const res = await api.post<PurgeResult>("/system-logs/purge", payload, withAccess());
    return res.data;
};

/** Writes out the serving instance's buffer so a just-reproduced issue shows up now. */
export const flushSystemLogs = async (): Promise<{ flushed: boolean }> => {
    const res = await api.post<{ flushed: boolean }>("/system-logs/flush", undefined, withAccess());
    return res.data;
};

export const runSystemLogRetention = async (): Promise<RetentionResult> => {
    const res = await api.post<RetentionResult>(
        "/system-logs/retention/run",
        undefined,
        withAccess(),
    );
    return res.data;
};
