import api from "../config/axios.config";

/**
 * Integration health monitor.
 *
 * Paths are relative to NEXT_PUBLIC_API_URL, which already ends in
 * `/api/v1/admin`, so `/integrations` reaches the backend's
 * `admin/integrations` controller.
 */
const BASE = "/integrations";

export type Direction = "outbound" | "inbound";
export type LaneStatus = "ok" | "warn" | "down";
export type IncidentStatus = "open" | "resolved";

export type ProviderKey =
  | "breeze"
  | "coinflow"
  | "payment_processor"
  | "aleaplay"
  | "sagames"
  | "sumsub"
  | "seon"
  | "sendgrid"
  | "twilio"
  | "ninja";

export interface HealthCounts {
  failed: number;
  total: number;
  failureRate: number;
}

export interface ProviderHealthRow {
  key: ProviderKey;
  direction: Direction;
  displayName: string;
  category: string;
  tier: number;
  monitoringEnabled: boolean;
  webhookPath: string | null;
  thresholdPercent: number;
  windowMinutes: number;
  minSampleSize: number;
  /** The alerting window the evaluator is currently looking at. */
  window: HealthCounts;
  /** Rolling 24h — the "Failures / Sent 24h" figure vendors show. */
  last24h: HealthCounts;
  status: LaneStatus;
  openIncidentId: string | null;
  lastFailureAt: string | null;
}

export interface IncidentSampleError {
  operation: string;
  eventType?: string | null;
  statusCode: number | null;
  message: string;
  at: string;
}

export interface Incident {
  id: string;
  providerKey: ProviderKey;
  direction: Direction;
  status: IncidentStatus;
  openedAt: string;
  resolvedAt: string | null;
  triggerFailureRate: string;
  peakFailureRate: string;
  totalCalls: number;
  failedCalls: number;
  alertCount: number;
  lastAlertAt: string | null;
  sampleErrors: IncidentSampleError[];
}

export interface RecordedFailure {
  providerKey: ProviderKey;
  direction: Direction;
  operation: string;
  eventType?: string | null;
  statusCode: number | null;
  message: string;
  at: string;
}

export interface SeriesPoint {
  stamp: string;
  ok: number;
  fail: number;
  total: number;
  failureRate: number;
}

export interface AlertRecipient {
  id: string;
  email: string;
  name: string | null;
  enabled: boolean;
  /** Empty array means ALL providers. */
  providerKeys: ProviderKey[];
  /** Empty array means BOTH directions. */
  directions: Direction[];
  minTier: number;
  notifyOnRecovery: boolean;
  verifiedAt: string | null;
  createdByAdminId: string | null;
  createdAt: string;
}

export interface CreateRecipientPayload {
  email: string;
  name?: string;
  providerKeys?: ProviderKey[];
  directions?: Direction[];
  minTier?: number;
  notifyOnRecovery?: boolean;
}

export interface UpdateProviderPayload {
  monitoringEnabled?: boolean;
  failureThresholdPercent?: number;
  windowMinutes?: number;
  minSampleSize?: number;
  alertCooldownMinutes?: number;
}

export interface DispatchResult {
  attempted: number;
  delivered: number;
  failed: string[];
}

/* ------------------------------------------------------------------ health */

export const getIntegrationOverview = async (): Promise<ProviderHealthRow[]> => {
  const res = await api.get<{ rows: ProviderHealthRow[] }>(BASE);
  return res.data.rows ?? [];
};

export const getLaneSeries = async (
  key: ProviderKey,
  direction: Direction,
  points = 60,
  granularity: "minute" | "hour" = "minute",
): Promise<SeriesPoint[]> => {
  const res = await api.get<{ series: SeriesPoint[] }>(`${BASE}/${key}/health`, {
    params: { direction, points, granularity },
  });
  return res.data.series ?? [];
};

export const getLaneFailures = async (
  key: ProviderKey,
  direction: Direction,
): Promise<RecordedFailure[]> => {
  const res = await api.get<{ failures: RecordedFailure[] }>(`${BASE}/${key}/failures`, {
    params: { direction },
  });
  return res.data.failures ?? [];
};

export const getIncidents = async (params: {
  providerKey?: ProviderKey;
  direction?: Direction;
  status?: IncidentStatus;
  limit?: number;
  offset?: number;
}): Promise<{ items: Incident[]; total: number }> => {
  const res = await api.get<{ items: Incident[]; total: number }>(`${BASE}/incidents`, {
    params,
  });
  return res.data;
};

export const updateProviderLane = async (
  key: ProviderKey,
  direction: Direction,
  patch: UpdateProviderPayload,
) => {
  const res = await api.patch(`${BASE}/${key}`, patch, { params: { direction } });
  return res.data;
};

/** Runs the evaluator for one lane immediately instead of waiting for the cron. */
export const evaluateLaneNow = async (key: ProviderKey, direction: Direction) => {
  const res = await api.post(`${BASE}/${key}/evaluate`, null, { params: { direction } });
  return res.data;
};

export const sendLaneTestAlert = async (
  key: ProviderKey,
  direction: Direction,
): Promise<{ sent: boolean; reason?: string } & Partial<DispatchResult>> => {
  const res = await api.post(`${BASE}/${key}/test-alert`, null, { params: { direction } });
  return res.data;
};

/* -------------------------------------------------------------- recipients */

export const getAlertRecipients = async (): Promise<AlertRecipient[]> => {
  const res = await api.get<{ recipients: AlertRecipient[] }>(`${BASE}/recipients`);
  return res.data.recipients ?? [];
};

export const addAlertRecipient = async (
  payload: CreateRecipientPayload,
): Promise<AlertRecipient> => {
  const res = await api.post<AlertRecipient>(`${BASE}/recipients`, payload);
  return res.data;
};

export const updateAlertRecipient = async (
  id: string,
  patch: Partial<CreateRecipientPayload> & { enabled?: boolean },
): Promise<AlertRecipient> => {
  const res = await api.patch<AlertRecipient>(`${BASE}/recipients/${id}`, patch);
  return res.data;
};

export const deleteAlertRecipient = async (
  id: string,
): Promise<{ removed: string; listNowEmpty: boolean }> => {
  const res = await api.delete(`${BASE}/recipients/${id}`);
  return res.data;
};

export const testAlertRecipient = async (
  id: string,
): Promise<{ email: string } & DispatchResult> => {
  const res = await api.post(`${BASE}/recipients/${id}/test`);
  return res.data;
};

/* ----------------------------------------------------------------- labels */

export const PROVIDER_LABELS: Record<ProviderKey, string> = {
  breeze: "Breeze",
  coinflow: "Coinflow",
  payment_processor: "Payment Router",
  aleaplay: "AleaPlay",
  sagames: "SA Gaming",
  sumsub: "SumSub",
  seon: "SEON",
  sendgrid: "SendGrid",
  twilio: "Twilio",
  ninja: "Ninja",
};

export const ALL_PROVIDER_KEYS = Object.keys(PROVIDER_LABELS) as ProviderKey[];

export const DIRECTION_LABELS: Record<Direction, string> = {
  outbound: "Outgoing",
  inbound: "Incoming",
};

/**
 * Said in the row itself, because the two directions fail for opposite reasons
 * and an operator who reads "SumSub failing" the wrong way goes and checks
 * SumSub's status page while our own endpoint is the thing rejecting them.
 */
export const DIRECTION_HINTS: Record<Direction, string> = {
  outbound: "We call them — a failure means their service is unreachable.",
  inbound: "They call us — a failure means we rejected their delivery and the event was lost.",
};
