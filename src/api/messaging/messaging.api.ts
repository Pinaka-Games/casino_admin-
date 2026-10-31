import api from "@/api/config/axios.config";

/**
 * Admin outbound messaging.
 *
 * One channel per send: MESSAGE lands in the recipient's in-app inbox, MAIL
 * goes out as email, SMS as a text message. The axios base URL already carries
 * `/admin`, so paths here are relative to it.
 */
export type MessageChannel = "MESSAGE" | "MAIL" | "SMS";
export type MessageAudience = "AGENT" | "SUBAGENT" | "EMPLOYEE" | "PLAYER";
export type MessageMode = "SINGLE" | "BULK" | "ALL";
export type AdminMessageStatus =
  | "QUEUED"
  | "SENDING"
  | "SENT"
  | "PARTIAL"
  | "FAILED";
export type MessageRecipientStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED";

export interface RecipientOption {
  id: string;
  username: string;
  email: string | null;
  /** False when this recipient has no address and so cannot receive MAIL. */
  hasEmail: boolean;
  /** E.164 destination for SMS, or null when no number is on file. */
  phone: string | null;
  /** False when this recipient has no number and so cannot receive SMS. */
  hasPhone: boolean;
  /**
   * Which pool the row came from. A send can target several at once, so the id
   * alone no longer identifies a recipient — key selections on both.
   */
  audience: MessageAudience;
}

/** Stable key for a recipient across pools. */
export const recipientKey = (r: { id: string; audience: MessageAudience }) =>
  `${r.audience}:${r.id}`;

/**
 * Canonical pool order, largest and most-used audience first.
 *
 * Every surface that lists audiences sorts by this — chips, merged recipient
 * lists, history badges — so a pool never appears in a different position
 * depending on which screen you are on.
 */
export const AUDIENCE_ORDER: MessageAudience[] = [
  "PLAYER",
  "AGENT",
  "SUBAGENT",
  "EMPLOYEE",
];

export const sortAudiences = (audiences: MessageAudience[]): MessageAudience[] =>
  [...audiences].sort(
    (a, b) => AUDIENCE_ORDER.indexOf(a) - AUDIENCE_ORDER.indexOf(b),
  );

export interface AdminMessage {
  id: string;
  channel: MessageChannel;
  /** Every pool this send targeted. */
  audiences: MessageAudience[];
  mode: MessageMode;
  type: string | null;
  subject: string;
  body: string;
  expiresAt: string | null;
  senderId: string;
  senderName: string | null;
  status: AdminMessageStatus;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  aggregateOnly: boolean;
  errorSample: { address?: string; reason: string }[] | null;
  createdAt: string;
}

export interface AdminMessageRecipientRow {
  id: string;
  recipientId: string;
  recipientName: string | null;
  recipientType: MessageAudience;
  address: string | null;
  status: MessageRecipientStatus;
  errorReason: string | null;
  sentAt: string | null;
}

export interface SendMessagePayload {
  channel: MessageChannel;
  audiences: MessageAudience[];
  mode: MessageMode;
  /** Hand-picked recipients, each tagged with the pool it came from. */
  recipients?: { id: string; audience: MessageAudience }[];
  type?: string;
  subject: string;
  body: string;
  expiresAt?: string;
  confirmAll?: boolean;
}

export interface SendMessageResult {
  id: string;
  queued: boolean;
  totalRecipients: number;
  sent: number;
  failed: number;
  skipped: number;
  status: AdminMessageStatus;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Recipient picker across one or more pools.
 *
 * `reachableOnly` hides addressless rows for mail sends. The limit is split
 * across the requested audiences server-side, so no single pool crowds out the
 * others.
 */
export async function searchRecipients(params: {
  audiences: MessageAudience[];
  channel?: MessageChannel;
  search?: string;
  limit?: number;
  reachableOnly?: boolean;
}): Promise<{ data: RecipientOption[]; total: number; returned: number }> {
  const response = await api.get("/messaging/recipients", {
    params: {
      audiences: params.audiences.join(","),
      channel: params.channel,
      search: params.search || undefined,
      limit: params.limit ?? 100,
      reachableOnly: params.reachableOnly ? "true" : undefined,
    },
  });
  return response.data;
}

/** Per-channel reach of an audience — what each transport can actually deliver to. */
export interface AudienceReach {
  count: number;
  reachableMail: number;
  reachableSms: number;
}

export interface AudienceCounts extends AudienceReach {
  byAudience: Record<string, AudienceReach>;
}

/** The reach figure that matters for a given channel. */
export const reachFor = (
  reach: AudienceReach | undefined,
  channel: MessageChannel,
): number | null => {
  if (!reach) return null;
  if (channel === "MAIL") return reach.reachableMail;
  if (channel === "SMS") return reach.reachableSms;
  return reach.count;
};

/** Whether a recipient can be reached over a given channel. */
export const canReach = (
  recipient: { hasEmail: boolean; hasPhone: boolean },
  channel: MessageChannel,
): boolean => {
  if (channel === "MAIL") return recipient.hasEmail;
  if (channel === "SMS") return recipient.hasPhone;
  return true;
};

/** The destination a channel would use, for display in pickers and previews. */
export const destinationFor = (
  recipient: { email: string | null; phone: string | null },
  channel: MessageChannel,
): string | null => {
  if (channel === "MAIL") return recipient.email;
  if (channel === "SMS") return recipient.phone;
  return null;
};

/** Combined blast radius of the selected pools, plus the per-pool breakdown. */
export async function getAudienceCount(
  audiences: MessageAudience[],
): Promise<AudienceCounts> {
  const response = await api.get("/messaging/audience-count", {
    params: { audiences: audiences.join(",") },
  });
  return response.data;
}

export async function sendMessage(
  payload: SendMessagePayload,
): Promise<SendMessageResult> {
  const response = await api.post("/messaging/send", payload);
  return response.data;
}

export async function listMessages(params: {
  channel?: MessageChannel | "";
  audience?: MessageAudience | "";
  status?: AdminMessageStatus | "";
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}): Promise<Paginated<AdminMessage>> {
  const response = await api.get("/messaging", {
    params: {
      channel: params.channel || undefined,
      audience: params.audience || undefined,
      status: params.status || undefined,
      search: params.search || undefined,
      dateFrom: params.dateFrom || undefined,
      dateTo: params.dateTo || undefined,
      page: params.page ?? 1,
      limit: params.limit ?? 20,
    },
  });
  return response.data;
}

export async function getMessage(id: string): Promise<AdminMessage> {
  const response = await api.get(`/messaging/${id}`);
  return response.data;
}

export async function getMessageRecipients(
  id: string,
  params: {
    status?: MessageRecipientStatus | "";
    search?: string;
    page?: number;
    limit?: number;
  } = {},
): Promise<Paginated<AdminMessageRecipientRow> & { aggregateOnly: boolean; note?: string }> {
  const response = await api.get(`/messaging/${id}/recipients`, {
    params: {
      status: params.status || undefined,
      search: params.search || undefined,
      page: params.page ?? 1,
      limit: params.limit ?? 25,
    },
  });
  return response.data;
}

/** Retry only the recipients whose delivery failed. */
export async function resendFailed(
  id: string,
): Promise<{ retried: number; sent: number; failed: number }> {
  const response = await api.post(`/messaging/${id}/resend-failed`, {});
  return response.data;
}
