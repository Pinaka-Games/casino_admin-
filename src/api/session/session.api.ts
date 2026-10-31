import api from "../config/axios.config";

/**
 * Paths here are relative to the admin API root.
 *
 * `NEXT_PUBLIC_API_URL` for this app already ends in `/api/v1/admin`, so the
 * backend's `@Controller('admin/sessions')` is reached as `/sessions/...`, NOT
 * `/admin/sessions/...` — the latter resolves to `/api/v1/admin/admin/sessions`
 * and 404s. Same convention as every other admin API here (`/subscription/plans`,
 * `/compliance/seon-risk-decisions`).
 */

export type SessionDeviceType = "desktop" | "mobile" | "tablet" | "unknown";
export interface PlayerSessionRow {
  sessionId: string;
  deviceType: SessionDeviceType;
  deviceLabel: string | null;
  ip: string | null;
  countryCode: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  /** Always false for an admin view — no admin socket holds a player session. */
  isCurrent: boolean;
}

export interface PlayerSessionsResponse {
  devices: PlayerSessionRow[];
  /** Device allowance in force for this player. */
  limit: number;
  /** Tier the limit came from. Null in DEFAULT mode — see `mode`. */
  planName: string | null;
  /**
   * "DEFAULT" — one allowance platform-wide; per-tier counts are ignored.
   * "SUBSCRIPTION" — the allowance comes from the player's tier.
   */
  mode: "DEFAULT" | "SUBSCRIPTION";
  /**
   * False while the platform runs in shadow mode. The list is accurate either
   * way, but nobody is being turned away yet — so the UI must not imply that
   * exceeding the limit currently does anything.
   */
  enforced: boolean;
}

/** Devices a player is currently signed in on, plus their tier's allowance. */
export const getPlayerSessions = async (
  userId: string
): Promise<PlayerSessionsResponse> => {
  const res = await api.get<PlayerSessionsResponse>(`/sessions/user/${userId}`);
  return res.data;
};

/**
 * Signs a player out of one device.
 *
 * `revoked: 0` means the session had already closed — a second click, or the
 * player logging out first. Not an error: the end state is the intended one.
 */
export const revokePlayerSession = async (
  sessionId: string
): Promise<{ success: boolean; revoked: number; message: string }> => {
  const res = await api.delete(`/sessions/${sessionId}`);
  return res.data;
};

/** Signs a player out of every device. */
export const revokeAllPlayerSessions = async (
  userId: string
): Promise<{ success: boolean; revoked: number; message: string }> => {
  const res = await api.delete(`/sessions/user/${userId}`);
  return res.data;
};

/* ==================== GLOBAL SESSIONS VIEW ==================== */

export type AdminSessionSort =
  | "recent"
  | "oldest"
  | "devices_desc"
  | "devices_asc";

export interface SessionOverviewRow {
  userId: string;
  /** Email or phone — whichever the account was registered with. */
  entity: string | null;
  username: string | null;
  deviceCount: number;
  deviceLimit: number;
  planName: string | null;
  /** Holding more sessions than the allowance permits. */
  overLimit: boolean;
  lastActiveAt: string | null;
  countries: string[];
  deviceTypes: SessionDeviceType[];
  devices: PlayerSessionRow[];
}

export interface SessionOverviewResponse {
  rows: SessionOverviewRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  /** Platform-wide counts, deliberately unaffected by the active filters. */
  summary: {
    usersSignedIn: number;
    activeSessions: number;
    multiDeviceUsers: number;
  };
}

export interface SessionOverviewQuery {
  search?: string;
  deviceType?: SessionDeviceType;
  countryCode?: string;
  /** 2 surfaces everyone signed in on more than one device at once. */
  minDevices?: number;
  sort?: AdminSessionSort;
  page?: number;
  limit?: number;
}

/**
 * Every signed-in player, grouped by account.
 *
 * Grouped by player rather than listed per session because the question this
 * screen answers is almost always about an account — "is this login being
 * shared?" — not about one device in isolation.
 */
export const getSessionOverview = async (
  query: SessionOverviewQuery = {}
): Promise<SessionOverviewResponse> => {
  const params: Record<string, string | number> = {};
  if (query.search?.trim()) params.search = query.search.trim();
  if (query.deviceType) params.deviceType = query.deviceType;
  if (query.countryCode?.trim()) params.countryCode = query.countryCode.trim();
  if (query.minDevices && query.minDevices > 1) params.minDevices = query.minDevices;
  if (query.sort) params.sort = query.sort;
  params.page = query.page ?? 1;
  params.limit = query.limit ?? 20;

  const res = await api.get<SessionOverviewResponse>("/sessions", { params });
  return res.data;
};
