import api from "@/api/config/axios.config";
import type {
  FreeSpin,
  CreateFreeSpinDto,
  UpdateFreeSpinDto,
  FreeSpinGrant,
} from "@/types/free-spin";

// baseURL is already http://localhost:8000/api/v1/admin
// so paths here are relative to that — no /admin prefix needed

type UnknownRecord = Record<string, unknown> & {
  config?: Record<string, unknown>;
  user?: Record<string, unknown>;
};

const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : value == null ? fallback : String(value);

const asOptionalString = (value: unknown): string | undefined =>
  value == null ? undefined : asString(value);

const asNumber = (value: unknown, fallback = 0): number => {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const asStatus = (value: unknown): FreeSpinGrant["status"] =>
  asString(value, "granted").toLowerCase() as FreeSpinGrant["status"];

export const createFreeSpin = async (data: CreateFreeSpinDto): Promise<FreeSpin> => {
  const res = await api.post<FreeSpin>("/free-spin/create", data);
  return res.data;
};

export const getAllFreeSpins = async (activeOnly = false): Promise<FreeSpin[]> => {
  const res = await api.get<FreeSpin[]>("/free-spin/all", { params: { activeOnly } });
  return res.data;
};

export const getFreeSpinById = async (id: string): Promise<FreeSpin> => {
  const res = await api.get<FreeSpin>(`/free-spin/${id}`);
  return res.data;
};

export const updateFreeSpin = async (id: string, data: UpdateFreeSpinDto): Promise<FreeSpin> => {
  const res = await api.patch<FreeSpin>(`/free-spin/${id}`, data);
  return res.data;
};

export const deleteFreeSpin = async (id: string): Promise<void> => {
  await api.delete(`/free-spin/${id}`);
};

export const grantFreeSpins = async (configId: string, userId: string): Promise<FreeSpinGrant> => {
  const res = await api.post<unknown>(`/free-spin/${configId}/grant`, { userId });
  const g = res.data as UnknownRecord;
  return {
    id: asString(g.id),
    freeSpinConfigId: asString(g.bonus_config_id ?? g.bonusConfigId ?? configId),
    userId: asString(g.user_id ?? g.userId ?? userId),
    username: asOptionalString(g.username ?? g.user?.username ?? g.user?.name),
    // `users.entity` is a single column holding email OR phone, whichever the
    // player registered with.
    contact: asOptionalString(g.contact ?? g.user?.entity ?? g.entity),
    aleaBonusId: asOptionalString(g.bonus_id ?? g.bonusId),
    spinsUsed: asNumber(g.spins_used ?? g.spinsUsed),
    currency: asOptionalString(g.currency),
    level: asNumber(g.level),
    casinoId: asOptionalString(g.casino_id ?? g.casinoId),
    environmentId: asOptionalString(g.environment_id ?? g.environmentId),
    sourceTransactionId: asString(g.casino_bonus_id ?? g.casinoBonusId),
    grantedAt: asString(g.created_at ?? g.createdAt, new Date().toISOString()),
    expiresAt: asOptionalString(g.expires_at ?? g.expiresAt),
    status: asStatus(g.status),
    bonusLabel: asOptionalString(g.bonus_label ?? g.bonusLabel),
    config: {
      name: asString(g.config?.name, "-"),
      numberOfFreeSpins: asNumber(g.config?.numberOfFreeSpins ?? g.config?.spinsCount ?? g.spins_granted ?? g.spinsGranted),
      softwareId: asNumber(g.config?.softwareId ?? g.config?.aleaSoftwareId ?? g.software_id ?? g.softwareId),
      softwareName: asOptionalString(g.config?.softwareName ?? g.config?.software_name ?? g.software_name ?? g.softwareName),
      gameId: asNumber(g.config?.gameId ?? g.config?.aleaGameId ?? g.game_id ?? g.gameId),
      gameName: asOptionalString(g.config?.gameName ?? g.config?.game_name ?? g.game_name ?? g.gameName),
    },
  };
};

/**
 * Cancel a single grant (pass its casinoBonusId) or a whole assignment (pass
 * its pool id). Rejects when the cancel did not happen — e.g. the player has
 * already played those spins — so callers must not assume success.
 */
export const cancelFreeSpins = async (
  grantId: string,
): Promise<{ success: boolean; message: string }> => {
  const res = await api.post<{ success?: boolean; message?: string }>(
    `/free-spin/grant/${grantId}/cancel`,
  );
  return {
    success: res.data?.success ?? true,
    message: res.data?.message ?? "Cancelled",
  };
};

/**
 * Re-send an allocation whose games never reached AleaPlay.
 *
 * Re-runs the ORIGINAL allocation, so games already granted keep their existing
 * bonus and only the missing ones are sent — retrying can never double-grant.
 * Rejects with AleaPlay's own reason when games still fail.
 */
export const retryFreeSpinAllocation = async (
  poolId: string,
): Promise<{ success: boolean; granted: number; message: string }> => {
  const res = await api.post<{ success?: boolean; granted?: number; message?: string }>(
    `/free-spin/allocations/${poolId}/retry`,
  );
  return {
    success: res.data?.success ?? true,
    granted: res.data?.granted ?? 0,
    message: res.data?.message ?? "Allocation re-sent",
  };
};

/**
 * Re-send every allocation still owed games.
 *
 * For use after the underlying cause is fixed — a bad template fails for every
 * player it was assigned to, so failures arrive in hundreds. Idempotency keys
 * mean nobody is double-granted; expired allocations are skipped.
 */
export const retryAllFreeSpinAllocations = async (
  body: { userId?: string; limit?: number } = {},
): Promise<{
  attempted: number;
  succeeded: number;
  failed: number;
  errors: string[];
  message: string;
}> => {
  const res = await api.post("/free-spin/allocations/retry-all", body);
  const d = (res.data ?? {}) as Record<string, unknown>;
  return {
    attempted: asNumber(d.attempted),
    succeeded: asNumber(d.succeeded),
    failed: asNumber(d.failed),
    errors: Array.isArray(d.errors) ? (d.errors as string[]) : [],
    message: asString(d.message, "Done"),
  };
};

export interface FreeSpinJobStatus {
  id: string;
  name: string;
  /** BullMQ state: waiting | active | completed | failed | delayed */
  state: string;
  progress?: {
    total?: number;
    processed?: number;
    granted?: number;
    skipped?: number;
    failed?: number;
  } | null;
  returnValue?: {
    granted?: number;
    skipped?: number;
    failed?: number;
    /** Why the failures happened, e.g. "abhinav_test: ALEA_BONUS_GRANT_FAILED: 400 …". */
    errors?: string[];
  } | null;
  failedReason?: string | null;
}

/**
 * Queues the bulk grant. Returns the job so the caller can follow it — the
 * grant itself happens in the worker, so a resolved promise here only means
 * "queued", never "granted".
 */
export const grantBulkFreeSpinsJob = async (
  userIds: string[],
  configIds: string[],
): Promise<FreeSpinJobStatus> => {
  const res = await api.post<FreeSpinJobStatus>(`/free-spin/jobs/bulk`, { userIds, configIds });
  return res.data;
};

/** Poll target for a queued grant job. */
export const getFreeSpinJobStatus = async (jobId: string): Promise<FreeSpinJobStatus> => {
  const res = await api.get<FreeSpinJobStatus>(`/free-spin/jobs/${jobId}`);
  return res.data;
};

export interface GrantQuery {
  userId?: string;
  search?: string;
  status?: string;
  /** Comma-joined bonusLabel prefixes for the source filter. */
  source?: string;
  configId?: string;
  grantedFrom?: string;
  grantedTo?: string;
  minSpins?: number;
  maxSpins?: number;
  expiringInDays?: number;
  page?: number;
  limit?: number;
}

export interface GrantPage {
  data: FreeSpinGrant[];
  /** Number of ALLOCATIONS matching the filters, not grant rows. */
  total: number;
  page: number;
  limit: number;
}

/**
 * One page of grants, grouped server-side by allocation.
 *
 * The page size counts assignments, and every grant of those assignments comes
 * back — so a 3-game template arrives whole and never straddles two pages.
 */
export const getPlayerFreeSpinGrants = async (
  query: GrantQuery = {},
): Promise<GrantPage> => {
  const res = await api.get<unknown>("/free-spin/grants", {
    params: Object.fromEntries(
      Object.entries(query).filter(([, v]) => v !== undefined && v !== "" && v !== null),
    ),
  });
  const payload = res.data as
    | { data?: unknown[]; total?: number; page?: number; limit?: number }
    | unknown[]
    | null;

  const raw = (Array.isArray(payload) ? payload : (payload?.data ?? [])) as UnknownRecord[];
  const meta = Array.isArray(payload) ? {} : (payload ?? {});

  const data = raw.map((g) => ({
    id: asString(g.id),
    freeSpinConfigId: asString(g.bonus_config_id ?? g.bonusConfigId),
    userId: asString(g.user_id ?? g.userId),
    username: asOptionalString(g.username ?? g.user?.username ?? g.user?.name),
    // `users.entity` is a single column holding email OR phone, whichever the
    // player registered with.
    contact: asOptionalString(g.contact ?? g.user?.entity ?? g.entity),
    aleaBonusId: asOptionalString(g.bonus_id ?? g.bonusId),
    spinsUsed: asNumber(g.spins_used ?? g.spinsUsed),
    currency: asOptionalString(g.currency),
    level: asNumber(g.level),
    casinoId: asOptionalString(g.casino_id ?? g.casinoId),
    environmentId: asOptionalString(g.environment_id ?? g.environmentId),
    sourceTransactionId: asString(g.casino_bonus_id ?? g.casinoBonusId),
    grantedAt: asString(g.created_at ?? g.createdAt, new Date().toISOString()),
    expiresAt: asOptionalString(g.expires_at ?? g.expiresAt),
    status: asStatus(g.status),
    // bonusLabel is the trigger source recorded by the backend (e.g.
    // "welcome-register:user-1", "daily-streak:day-6", "subscription-buy:plan-1").
    // We use it on the admin UI to render a Source badge so admins can tell
    // automated grants apart from manual ones.
    bonusLabel: asOptionalString(g.bonus_label ?? g.bonusLabel),
    // Grant-level snapshot: what was ACTUALLY granted to this player. The
    // template can be edited afterwards, so these must be read straight off the
    // grant row rather than through `config`, or the table shows the template's
    // present state instead of the grant's.
    spinsGranted: asNumber(g.spins_granted ?? g.spinsGranted),
    softwareId: asNumber(g.software_id ?? g.softwareId),
    softwareName: asOptionalString(g.software_name ?? g.softwareName),
    gameId: asNumber(g.game_id ?? g.gameId),
    gameName: asOptionalString(g.game_name ?? g.gameName),
    gameIds: Array.isArray(g.game_ids ?? g.gameIds)
      ? ((g.game_ids ?? g.gameIds) as unknown[]).map(Number).filter((n) => !isNaN(n))
      : undefined,
    poolId: asOptionalString(g.pool_id ?? g.poolId),
    failed: g.failed === true,
    retryable: g.retryable === true,
    failureReason: asOptionalString(g.failureReason ?? g.failure_reason),
    failedAt: asOptionalString(g.failedAt ?? g.failed_at),
    grantAttempts: asNumber(g.grantAttempts ?? g.grant_attempts),
    // Always populate config — use relation if available, fall back to direct entity snapshot fields
    config: {
      name: asString(g.config?.name, "-"),
      numberOfFreeSpins: asNumber(g.config?.numberOfFreeSpins ?? g.config?.spinsCount ?? g.spins_granted ?? g.spinsGranted),
      softwareId: asNumber(g.config?.softwareId ?? g.config?.aleaSoftwareId ?? g.software_id ?? g.softwareId),
      softwareName: asOptionalString(g.config?.softwareName ?? g.config?.software_name ?? g.software_name ?? g.softwareName),
      gameId: asNumber(g.config?.gameId ?? g.config?.aleaGameId ?? g.game_id ?? g.gameId),
      gameName: asOptionalString(g.config?.gameName ?? g.config?.game_name ?? g.game_name ?? g.gameName),
    },
  }));

  return {
    data,
    total: asNumber(meta.total, data.length),
    page: asNumber(meta.page, 1),
    limit: asNumber(meta.limit, data.length || 10),
  };
};
