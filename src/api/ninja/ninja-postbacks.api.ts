import api from "../config/axios.config";

/**
 * Ninja S2S conversion tracking.
 *
 * Paths are relative to NEXT_PUBLIC_API_URL, which already ends in
 * `/api/v1/admin`, so `/ninja-postbacks` reaches the backend's
 * `admin/ninja-postbacks` controller.
 */
const BASE = "/ninja-postbacks";

export type NinjaEventType = "REGISTRATION" | "FTD";

export type NinjaConversionStatus =
    | "PENDING"
    | "SENDING"
    | "SENT"
    | "FAILED"
    | "EXHAUSTED";

export type NinjaBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export type NinjaReferrerType = "USER" | "AGENT" | "SUB_AGENT";

export interface NinjaConversion {
    id: string;
    userId: string;
    subid: string;
    eventType: NinjaEventType;
    tid: string;
    amount: string | null;
    currency: string | null;
    status: NinjaConversionStatus;
    attempts: number;
    nextAttemptAt: string | null;
    lastAttemptAt: string | null;
    sentAt: string | null;
    lastHttpStatus: number | null;
    lastResponseBody: string | null;
    lastError: string | null;
    requestQuery: string | null;
    source: string | null;
    referrerId: string | null;
    referrerType: NinjaReferrerType | null;
    createdAt: string;
    updatedAt: string;
}

export interface NinjaBreakerSnapshot {
    state: NinjaBreakerState;
    consecutiveFailures: number;
    failureThreshold: number;
    cooldownSeconds: number;
    openedAt: string | null;
    retryAt: string | null;
    lastFailureAt: string | null;
    lastSuccessAt: string | null;
    manuallyTripped: boolean;
    reason: string | null;
}

/**
 * The knobs an admin owns. The postback URLs are NOT here and never will be:
 * they can carry a vendor key, so they stay in server configuration where an
 * admin session can neither read them back nor repoint outbound traffic.
 */
export interface NinjaSettings {
    enabled: boolean;
    useTestUrl: boolean;
    timeoutMs: number;
    maxAttempts: number;
    retryBaseSeconds: number;
    retryMaxSeconds: number;
    retryCronEnabled: boolean;
    breakerFailureThreshold: number;
    breakerCooldownSeconds: number;
    countManualDepositsTowardFirst: boolean;
    updatedByEmployeeId: string | null;
    updatedAt: string | null;
}

export interface NinjaIntegrationStatus {
    settings: NinjaSettings;
    configured: boolean;
    /** Host only — the configured URL can carry a vendor key and is never sent. */
    host: string | null;
    configError: string | null;
    /** Which URLs exist in server configuration at all. */
    configuredUrls: { production: boolean; test: boolean };
    breaker: NinjaBreakerSnapshot;
    counts: Record<NinjaConversionStatus, number>;
}

export interface NinjaConversionQuery {
    eventType?: NinjaEventType;
    status?: NinjaConversionStatus;
    subid?: string;
    tid?: string;
    userId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
}

export interface NinjaConversionPage {
    data: NinjaConversion[];
    meta: { page: number; limit: number; total: number; totalPages: number };
}

export const EVENT_LABELS: Record<NinjaEventType, string> = {
    REGISTRATION: "Registration (lead)",
    FTD: "First deposit (sale)",
};

export const STATUS_LABELS: Record<NinjaConversionStatus, string> = {
    PENDING: "Pending",
    SENDING: "Sending",
    SENT: "Sent",
    FAILED: "Retrying",
    EXHAUSTED: "Failed",
};

export const REFERRER_LABELS: Record<NinjaReferrerType, string> = {
    USER: "Player",
    AGENT: "Agent",
    SUB_AGENT: "Sub-agent",
};

export const getNinjaStatus = async (): Promise<NinjaIntegrationStatus> =>
    (await api.get(`${BASE}/status`)).data;

export const getNinjaSettings = async (): Promise<NinjaSettings> =>
    (await api.get(`${BASE}/settings`)).data;

/** Send only the fields being changed. Absent keys are left untouched. */
export const updateNinjaSettings = async (
    patch: Partial<Omit<NinjaSettings, "updatedByEmployeeId" | "updatedAt">>,
): Promise<NinjaSettings> => (await api.patch(`${BASE}/settings`, patch)).data;

export const getNinjaConversions = async (
    query: NinjaConversionQuery = {},
): Promise<NinjaConversionPage> =>
    (await api.get(BASE, { params: query })).data;

export const retryNinjaConversion = async (
    id: string,
): Promise<NinjaConversion> => (await api.post(`${BASE}/${id}/retry`)).data;

/** Pause delivery. Conversions keep recording and drain on resume. */
export const breakNinjaPostbacks = async (
    reason: string,
): Promise<NinjaBreakerSnapshot> =>
    (await api.post(`${BASE}/break`, { reason })).data;

export const resumeNinjaPostbacks = async (): Promise<NinjaBreakerSnapshot> =>
    (await api.post(`${BASE}/resume`)).data;
