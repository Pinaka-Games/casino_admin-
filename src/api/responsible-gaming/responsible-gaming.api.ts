import api from "../config/axios.config";

/**
 * Compliance's view of player restrictions.
 *
 * Paths are relative to the axios baseURL, which already ends in `/admin`.
 */



export type RestrictionType = "PAUSE" | "SELF_EXCLUSION";

export type RestrictionStatus =
  | "ACTIVE"
  | "EXPIRED"
  | "LIFTED"
  | "SUPERSEDED"
  | "CANCELLED";

export type RestrictionSource = "PLAYER" | "ADMIN" | "SYSTEM";

export type RestrictedPlayer = {
  id: string;
  username: string | null;
  entity: string | null;
  isActive: boolean;
};

export type RestrictionRow = {
  id: string;
  userId: string;
  type: RestrictionType;
  status: RestrictionStatus;
  periodCode: string;
  periodLabel: string;
  indefinite: boolean;
  startsAt: string;
  /**
   * Means different things per type — a PAUSE releases itself at this date, a
   * SELF_EXCLUSION only becomes reviewable at it. The UI must say which.
   */
  endsAt: string | null;
  reviewDue: boolean;
  source: RestrictionSource;
  createdByUserId: string | null;
  createdByEmployeeId: string | null;
  liftedAt: string | null;
  liftedByEmployeeId: string | null;
  liftReason: string | null;
  reviewNotifiedAt: string | null;
  ipAddress: string | null;
  deviceId: string | null;
  createdAt: string;
  player?: RestrictedPlayer | null;
};

export type RestrictedListParams = {
  page?: number;
  limit?: number;
  status?: RestrictionStatus;
  type?: RestrictionType;
  reviewDue?: boolean;
  search?: string;
  /** Started-date bounds, yyyy-mm-dd, inclusive of both days. */
  from?: string;
  to?: string;
};

export type RestrictedListResponse = {
  restrictions: RestrictionRow[];
  total: number;
  page: number;
  limit: number;
};

export type RestrictionStats = {
  activePauses: number;
  activeSelfExclusions: number;
  activeTotal: number;
  reviewDue: number;
  byStatus: Record<string, number>;
};

export type PlayerRestrictionDetail = {
  player: {
    id: string;
    username: string | null;
    entity: string | null;
    isActive: boolean;
    rgStatus: string;
    rgUntil: string | null;
  };
  active: RestrictionRow | null;
  history: RestrictionRow[];
  total: number;
  page: number;
  limit: number;
};

const stripEmpty = <T extends Record<string, unknown>>(params: T) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && v !== ""
    )
  );

export const responsibleGamingApi = {
  list: async (params: RestrictedListParams = {}) => {
    const res = await api.get<RestrictedListResponse>(
      "/responsible-gaming/players",
      { params: stripEmpty(params) }
    );
    return res.data;
  },

  stats: async () => {
    const res = await api.get<RestrictionStats>("/responsible-gaming/stats");
    return res.data;
  },

  /** Current restriction + full history for one player. */
  detail: async (userId: string, params: { page?: number; limit?: number } = {}) => {
    const res = await api.get<PlayerRestrictionDetail>(
      `/responsible-gaming/players/${userId}`,
      { params: stripEmpty(params) }
    );
    return res.data;
  },

  /**
   * End a restriction early. Requires `responsible-gaming:lift`.
   *
   * For correcting a mistake — a player asking to come back goes through a
   * support ticket, so the ask and the decision live on one record.
   */
  lift: async (userId: string, reason: string) => {
    const res = await api.post<PlayerRestrictionDetail>(
      `/responsible-gaming/players/${userId}/lift`,
      { reason }
    );
    return res.data;
  },
};

/* ── Presentation ───────────────────────────────────────────────────────── */

export const RESTRICTION_TYPE_LABEL: Record<RestrictionType, string> = {
  PAUSE: "Break in Play",
  SELF_EXCLUSION: "Self-Exclusion",
};

export const RESTRICTION_STATUS_STYLE: Record<
  RestrictionStatus,
  { label: string; cls: string }
> = {
  ACTIVE: { label: "Active", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  EXPIRED: { label: "Expired", cls: "bg-white/10 text-white/60 border-white/15" },
  LIFTED: { label: "Lifted", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  SUPERSEDED: { label: "Superseded", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  CANCELLED: { label: "Cancelled", cls: "bg-white/10 text-white/60 border-white/15" },
};

/**
 * What the end date means, which differs by restriction type.
 *
 * Getting this wrong on screen would tell a compliance officer that a
 * self-exclusion expires on its own, which is the opposite of the policy.
 */
export const endDateLabel = (r: RestrictionRow): string =>
  r.type === "PAUSE" ? "Releases" : "Reviewable from";

/* ── Reports (feature 16) ───────────────────────────────────────────────── */

export type RestrictionReport = {
  range: { from: string; to: string };
  /** Snapshot as of now, not over the range. */
  current: RestrictionStats;
  started: { PAUSE: number; SELF_EXCLUSION: number };
  /** Keyed by the i18n period code (i…vi). */
  byPeriod: Record<string, number>;
  expired: number;
  lifted: number;
  /** Keyed `TYPE_PERIOD`, e.g. `DEPOSIT_DAILY`. */
  limitsSet: Record<string, number>;
  limitIncreasesScheduled: number;
  reactivation: {
    requested: number;
    approved: number;
    rejected: number;
    open: number;
  };
};

/** GET /responsible-gaming/report */
export const getRestrictionReport = async (params: {
  from?: string;
  to?: string;
}) => {
  // The screen hands over `yyyy-MM-dd` from two date inputs. The endpoint parses
  // whatever it is given and compares it directly, so a bare date arrives as
  // midnight — which silently dropped every event on the END day. Widen each
  // bound to the whole UTC day, the boundary the other reports use.
  const widen = (value: string | undefined, end: boolean) =>
    value && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`
      : value;

  const res = await api.get<RestrictionReport>("/responsible-gaming/report", {
    params: stripEmpty({
      from: widen(params.from, false),
      to: widen(params.to, true),
    }),
  });
  return res.data;
};

/** The six period codes, in the order the policy lists them. */
export const PERIOD_CODE_LABEL: Record<string, string> = {
  i: "24 hours",
  ii: "1 week",
  iii: "1 month",
  iv: "6 months",
  v: "1 year",
  vi: "Permanently",
};
