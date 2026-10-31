import api from "../config/axios.config";

/**
 * Paths here are relative to `/api/v1/admin` — the shared axios baseURL already
 * ends in `/admin`, so repeating it yields `/admin/admin/...` and a 404. The
 * backend controller is mounted at `admin/activity-logs`; that prefix is the
 * baseURL's half, not ours. Same convention as the system-logs client.
 */
const BASE = "/activity-logs";

/* -------------------------------------------------------------------- types */
export type ActivityCategory =
    | "payout"
    | "deposit"
    | "user"
    | "agent"
    | "kyc"
    | "staff"
    | "settings"
    | "content"
    | "reward"
    | "game"
    | "auth"
    | "other";

export type ActivityStatus = "success" | "failed" | "reversed";

export type ActivityTargetType =
    | "user"
    | "agent"
    | "sub_agent"
    | "employee"
    | "role"
    | "payout_request"
    | "deposit"
    | "transaction"
    | "kyc_profile"
    | "setting"
    | "system"
    | "other";

/** One row of the table. Every display string arrives ready to print. */
export interface ActivityRow {
    id: string;
    createdAt: string;

    actorId: string | null;
    /** Username as it stood when the action was taken, never re-resolved. */
    actorName: string;
    actorEmail: string | null;
    actorRole: string | null;

    /** Machine code, e.g. "payout.approved". Used by the filters. */
    action: string;
    /** Human name, e.g. "Withdrawal Approved". */
    actionLabel: string;
    category: ActivityCategory;
    /** Moves money or changes who can do what. */
    sensitive: boolean;
    status: ActivityStatus;

    targetType: ActivityTargetType | null;
    targetId: string | null;
    targetLabel: string | null;
    targetSecondary: string | null;

    /** One plain sentence describing what happened. */
    summary: string;
    ipAddress: string | null;
    deviceLabel: string | null;
    changeCount: number;
}

/** How the modal should render one value. Set by the API, never guessed here. */
export type DetailFieldType =
    | "text"
    | "money"
    | "number"
    | "date"
    | "status"
    | "id"
    | "boolean"
    | "longtext"
    | "list";

export interface DetailField {
    label: string;
    value: string | number | boolean | null;
    type: DetailFieldType;
    tone?: "positive" | "negative" | "neutral" | "warning";
}

export interface DetailSection {
    title: string;
    fields: DetailField[];
}

export interface ActivityDetail extends ActivityRow {
    /** Labelled, typed field groups — already formatted for display. */
    details: DetailSection[];
    changes: Array<{ field: string; from: string; to: string }>;
    userAgent: string | null;
    requestMethod: string | null;
    requestPath: string | null;
    requestId: string | null;
    errorMessage: string | null;
    /** The stored payload, for a technical reader who wants the record itself. */
    raw: Record<string, unknown> | null;
}

export interface ActivityListResponse {
    rows: ActivityRow[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export interface ActivityFacets {
    admins: Array<{ id: string; name: string; email: string | null; count: number }>;
    actions: Array<{
        action: string;
        label: string;
        category: ActivityCategory;
        count: number;
    }>;
    categories: ActivityCategory[];
    statuses: ActivityStatus[];
    targetTypes: ActivityTargetType[];
    /** Full catalogue, so a filter can be set before any row exists. */
    catalogue: Array<{
        action: string;
        label: string;
        category: ActivityCategory;
        sensitive?: boolean;
    }>;
}

export interface ActivityStats {
    total: number;
    last24h: number;
    failedLast24h: number;
    byCategory: Partial<Record<ActivityCategory, number>>;
}

export interface ActivityQuery {
    page?: number;
    limit?: number;
    actorId?: string;
    actions?: string[];
    categories?: ActivityCategory[];
    statuses?: ActivityStatus[];
    targetType?: ActivityTargetType;
    targetId?: string;
    search?: string;
    ipAddress?: string;
    from?: string;
    to?: string;
    sort?: "recent" | "admin" | "action";
    order?: "asc" | "desc";
}

/* ------------------------------------------------------------------- labels */

/** Category names as a manager would say them, not as the database stores them. */
export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
    payout: "Withdrawals",
    deposit: "Deposits",
    user: "Players",
    agent: "Agents",
    kyc: "KYC",
    staff: "Staff & Roles",
    settings: "Settings",
    content: "Marketing",
    reward: "Rewards",
    game: "Games",
    auth: "Sign-ins",
    other: "Other",
};

/* ------------------------------------------------------------------ helpers */

/**
 * Drops empty values so an untouched filter is absent from the query string
 * rather than sent as "", which the API would treat as a real filter.
 */
const toParams = (query: ActivityQuery): Record<string, string | number> => {
    const params: Record<string, string | number> = {};
    if (query.page) params.page = query.page;
    if (query.limit) params.limit = query.limit;
    if (query.actorId) params.actorId = query.actorId;
    if (query.actions?.length) params.actions = query.actions.join(",");
    if (query.categories?.length) params.categories = query.categories.join(",");
    if (query.statuses?.length) params.statuses = query.statuses.join(",");
    if (query.targetType) params.targetType = query.targetType;
    if (query.targetId) params.targetId = query.targetId;
    if (query.search) params.search = query.search;
    if (query.ipAddress) params.ipAddress = query.ipAddress;
    if (query.from) params.from = query.from;
    if (query.to) params.to = query.to;
    if (query.sort) params.sort = query.sort;
    if (query.order) params.order = query.order;
    return params;
};

/* --------------------------------------------------------------------- api */

export const getActivityLogs = async (
    query: ActivityQuery = {},
): Promise<ActivityListResponse> => {
    const res = await api.get<ActivityListResponse>(BASE, {
        params: toParams(query),
    });
    return res.data;
};

export const getActivityLog = async (id: string): Promise<ActivityDetail> => {
    const res = await api.get<ActivityDetail>(`${BASE}/${id}`);
    return res.data;
};

export const getActivityFacets = async (): Promise<ActivityFacets> => {
    const res = await api.get<ActivityFacets>(`${BASE}/facets`);
    return res.data;
};

export const getActivityStats = async (): Promise<ActivityStats> => {
    const res = await api.get<ActivityStats>(`${BASE}/stats`);
    return res.data;
};

/** Every row one request produced — a bulk action writes one per item. */
export const getActivityByRequest = async (
    requestId: string,
): Promise<ActivityRow[]> => {
    const res = await api.get<ActivityRow[]>(`${BASE}/request/${requestId}`);
    return res.data;
};
