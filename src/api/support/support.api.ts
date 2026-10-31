import api from "../config/axios.config";

/**
 * Player support tickets.
 *
 * Paths are relative to the axios baseURL, which already ends in `/admin` —
 * so `/support/tickets` here reaches `/api/v1/admin/support/tickets`.
 */

export type TicketCategory =
  | "ACCOUNT_REACTIVATION"
  | "ACCOUNT_ACTIVATION"
  | "RESPONSIBLE_GAMING"
  | "DEVICE"
  | "PAYMENT"
  | "KYC"
  | "OTHER";

export type TicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "REJECTED"
  | "CLOSED";

export type TicketPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type TicketMessageAuthor = "PLAYER" | "STAFF" | "SYSTEM";

export type TicketPlayer = {
  id: string;
  username: string | null;
  entity: string | null;
  isActive: boolean;
  rgStatus: string | null;
};

export type TicketMessage = {
  id: string;
  authorType: TicketMessageAuthor;
  authorName: string | null;
  body: string;
  isInternal: boolean;
  createdAt: string;
};

export type TicketRow = {
  id: string;
  reference: string;
  userId: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  subject: string;
  assignedToEmployeeId: string | null;
  relatedRestrictionId: string | null;
  resolutionNote: string | null;
  resolvedByEmployeeId: string | null;
  resolvedAt: string | null;
  lastMessageAt: string | null;
  lastMessageBy: TicketMessageAuthor | null;
  ipAddress: string | null;
  createdAt: string;
  updatedAt: string;
  isOpen: boolean;
  player?: TicketPlayer | null;
};

export type TicketDetail = TicketRow & { messages: TicketMessage[] };

export type TicketListParams = {
  page?: number;
  limit?: number;
  status?: TicketStatus;
  category?: TicketCategory;
  priority?: TicketPriority;
  userId?: string;
  assignedToEmployeeId?: string;
  unassigned?: boolean;
  search?: string;
  /** Opened-date bounds, yyyy-mm-dd, inclusive of both days. */
  from?: string;
  to?: string;
};

export type TicketListResponse = {
  tickets: TicketRow[];
  total: number;
  page: number;
  limit: number;
};

export type TicketStats = {
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  open: number;
  total: number;
};

/**
 * Drop empty values before they reach the query string.
 *
 * An empty `status=` would otherwise be validated as a bad enum and 400 the
 * whole listing the moment somebody clears a filter.
 */
const stripEmpty = <T extends Record<string, unknown>>(params: T) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && v !== ""
    )
  );

export const supportApi = {
  list: async (params: TicketListParams = {}) => {
    const res = await api.get<TicketListResponse>("/support/tickets", {
      params: stripEmpty(params),
    });
    return res.data;
  },

  stats: async () => {
    const res = await api.get<TicketStats>("/support/tickets/stats");
    return res.data;
  },

  get: async (id: string) => {
    const res = await api.get<TicketDetail>(`/support/tickets/${id}`);
    return res.data;
  },

  /** Every ticket for one player — the Tickets tab on the player page. */
  forPlayer: async (userId: string, params: { page?: number; limit?: number } = {}) => {
    const res = await api.get<TicketListResponse>(
      `/support/players/${userId}/tickets`,
      { params: stripEmpty(params) }
    );
    return res.data;
  },

  /** Opened by staff for a request that arrived by phone or email. */
  createOnBehalf: async (body: {
    userId: string;
    category: TicketCategory;
    subject?: string;
    body: string;
    priority?: TicketPriority;
  }) => {
    const res = await api.post<TicketDetail>("/support/tickets", body);
    return res.data;
  },

  /** `isInternal` keeps the note off the player's thread. */
  reply: async (id: string, body: string, isInternal = false) => {
    const res = await api.post<TicketDetail>(`/support/tickets/${id}/reply`, {
      body,
      isInternal,
    });
    return res.data;
  },

  assign: async (id: string, employeeId: string | null) => {
    const res = await api.patch<TicketDetail>(`/support/tickets/${id}/assign`, {
      employeeId,
    });
    return res.data;
  },

  setPriority: async (id: string, priority: TicketPriority) => {
    const res = await api.patch<TicketDetail>(`/support/tickets/${id}/priority`, {
      priority,
    });
    return res.data;
  },

  /**
   * Resolve, reject or close.
   *
   * Resolving an ACCOUNT_REACTIVATION ticket lifts the player's
   * self-exclusion, and resolving an ACCOUNT_ACTIVATION ticket switches the
   * account back on — the backend does both as part of this call. Requires the
   * `support:decisions` permission, which is separate from `support:tickets`.
   */
  decide: async (
    id: string,
    body: { status: TicketStatus; note?: string; reply?: string }
  ) => {
    const res = await api.post<TicketDetail>(`/support/tickets/${id}/decide`, body);
    return res.data;
  },
};

/* ── Presentation helpers, shared by the queue and the player tab ────────── */

export const TICKET_STATUS_STYLES: Record<TicketStatus, { label: string; cls: string }> = {
  OPEN: { label: "Open", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  IN_PROGRESS: { label: "In Progress", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  RESOLVED: { label: "Resolved", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  REJECTED: { label: "Rejected", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
  CLOSED: { label: "Closed", cls: "bg-white/10 text-white/60 border-white/15" },
};

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  ACCOUNT_REACTIVATION: "Reactivation",
  ACCOUNT_ACTIVATION: "Activation",
  RESPONSIBLE_GAMING: "Responsible Gaming",
  DEVICE: "Device",
  PAYMENT: "Payment",
  KYC: "Verification",
  OTHER: "General",
};

export const TICKET_PRIORITY_STYLES: Record<TicketPriority, string> = {
  LOW: "text-white/50",
  NORMAL: "text-white/70",
  HIGH: "text-amber-300",
  URGENT: "text-red-300",
};

/**
 * Categories whose resolution changes the account, not just the conversation.
 * The decision dialog warns before granting one of these.
 */
export const ACCOUNT_CHANGING_CATEGORIES: TicketCategory[] = [
  "ACCOUNT_REACTIVATION",
  "ACCOUNT_ACTIVATION",
];
