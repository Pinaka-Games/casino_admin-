import api from "../config/axios.config";
export interface Game {
    id: string;
    provider: string;
    providerGameId?: string;
    name: string;
    category: string;
    studio?: string;
    providerMetadata?: {
        softwareId?: number;
        softwareName?: string;
        /** AleaPlay free-spin-eligible currencies. Must include "SCUSD" to grant. */
        freeSpinsCurrencies?: string[];
        [key: string]: unknown;
    };
    enabled: boolean;
    displayOrder: number;
    /**
     * The position players see this game at in the section being browsed — the
     * per-category position when a category is in scope, else `displayOrder`.
     * 0 means the game has never been placed there.
     *
     * Distinct from the card's row number, which stops being the real position
     * as soon as a search narrows the list.
     */
    sectionPosition?: number;
    thumbnail?: unknown;
    isFeatured: boolean;
    isNew: boolean;
    /**
     * Return to player %, exactly as the provider reports it. The catalog sync is
     * the only thing that writes it — nothing in this console can change a game's
     * RTP, so what is shown is always the provider's own figure.
     */
    rtp?: number | string | null;
    /** Lifetime rounds played (settled bets) */
    totalPlays?: number;
    /** Lifetime launches — the game being opened, counted separately from rounds */
    totalLaunches?: number;
    /**
     * Bets placed inside the trending window (7 days), rescored hourly by the
     * worker. This — not `totalPlays` — is what orders the Trending Now rail.
     */
    popularityScore?: number;
}

export interface Category {
    id: string;
    name: string;
    /**
     * Per-locale display names keyed by locale code ("es"). Send `{ es: "" }` to
     * have the backend translate the English name instead.
     */
    translations?: Record<string, string>;
    /** True when `translations` was machine-generated (refreshed on rename) */
    autoTranslated?: boolean;
    slug: string;
    displayOrder: number;
    isActive: boolean;
}

const CAT_NORMALIZE: Record<string, string> = {
  "live dealers": "Live casino",
  "live dealer": "Live casino",
  "live casino": "Live casino",
  "slots": "Slots",
  "slot": "Slots",
  "table games": "Table games",
  "table": "Table games",
  "fast games": "Fast games",
  "fast game": "Fast games",
};

/** Normalize backend category names to frontend display names */
export function normalizeCategory(raw?: string | null): string {
  if (!raw) return "Slots";
  return CAT_NORMALIZE[raw.toLowerCase()] ?? raw;
}

/**
 * The RTP to show for a game: the provider's figure, or null when they publish
 * none (plenty of live and table games carry no RTP, and SA Gaming sends none at
 * all). Null means the UI draws no badge rather than a 0% nobody published.
 *
 * The column arrives as a string — Postgres `numeric` crosses the wire as
 * "96.50" — so every read goes through here rather than trusting the declared
 * number type.
 */
export function resolveRtp(game: Pick<Game, "rtp">): number | null {
  const raw = game.rtp;
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Extract the best available image URL from the thumbnail object */
export function getThumbnailUrl(thumbnail: unknown): string | null {
  if (!thumbnail || typeof thumbnail !== "object") return null;
  const t = thumbnail as Record<string, unknown>;
  const url = t.s279x400 ?? t.url ?? t.s512x512 ?? t.s300x200 ?? t.s660x380 ?? t.s208x147;
  return typeof url === "string" ? url : null;
}

export interface Paginated<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface GameListFilters {
    provider?: string;
    /** User-facing provider / game studio (e.g. "Betsoft", "SA Gaming") */
    studio?: string;
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
    marketing?: boolean;
    /** "popular" ranks by popularity — used by the read-only Hot Games group */
    sortBy?: string;
    /**
     * Restrict to enabled (or disabled) games. The Trending preview sends
     * `true` because the player-facing rail ranks enabled games only — without
     * it the admin would be shown an order players never get.
     */
    enabled?: boolean;
    /**
     * `false` skips the server's section-position ranking — an extra
     * whole-section query on every search, wasted on lists that show no position.
     */
    positions?: boolean;
}

/**
 * Returns the full flat array of games (no pagination) for dropdowns/pickers
 * that genuinely need every game.
 *
 * The admin endpoint (`/api/v1/admin/games/list`) returns a plain array ONLY
 * when neither `page` nor `limit` is sent — sending either switches it to an
 * offset-paginated `{ data, total, page, limit, totalPages }` envelope capped
 * at 100 rows. So we must send NO page/limit here. (Verified: ~5k aleaplay
 * games come back as one array in ~4-5s.)
 *
 * Pass a generous `timeout` for large catalogs — the default axios 12s can be
 * exceeded on a cold DB query, which surfaces to the user as a load failure.
 */
export const getAllAdminGames = async (filters: GameListFilters = {}, timeout?: number): Promise<Game[]> => {
    const res = await api.get<Game[]>("/games/list", { params: filters, timeout });
    return Array.isArray(res.data) ? res.data : ((res.data as { data?: Game[] })?.data ?? []);
};

/** The catalogue fields the Game Report merges its per-game totals onto. */
export interface ReportCatalogueGame {
    id: string;
    name: string;
    provider: string;
    category: string;
    thumbnail: { url: string } | null;
    rtp: number | string | null;
}

/**
 * Lean catalogue for the Game Report. The full `/games/list` returns every
 * column of every game (several MB) and held the report on skeletons.
 */
export const getReportCatalogue = async (): Promise<ReportCatalogueGame[]> => {
    const res = await api.get<ReportCatalogueGame[]>("/games/report-catalogue", { timeout: 60000 });
    return Array.isArray(res.data) ? res.data : ((res.data as { data?: ReportCatalogueGame[] })?.data ?? []);
};

export interface ProviderGameCount {
    provider: string;
    total: number;
    enabled: number;
}

/** Total + enabled game counts per technical provider (aleaplay, sagames …). */
export const getProviderGameCounts = async (): Promise<ProviderGameCount[]> => {
    const res = await api.get<ProviderGameCount[]>("/games/provider-counts");
    return Array.isArray(res.data) ? res.data : ((res.data as { data?: ProviderGameCount[] })?.data ?? []);
};

/** Minimal game shape for dropdowns/pickers. */
export interface GameOption {
    id: string;
    name: string;
    provider: string;
}

export interface GameOptionsParams {
    search?: string;
    provider?: string;
    page?: number;
    limit?: number;
    /** Game ids to omit (e.g. already-configured games). */
    exclude?: string[];
}

export interface GameProviderOption {
    provider: string;
    count: number;
}

/** Distinct providers (with counts) for picker filters. */
export const getAdminGameProviders = async (): Promise<GameProviderOption[]> => {
    const res = await api.get<GameProviderOption[]>("/games/option-providers");
    return res.data;
};

export interface GameOptionsResult {
    data: GameOption[];
    page: number;
    hasMore: boolean;
}

/**
 * Lightweight, searchable, paginated games list for dropdowns — only
 * id/name/provider, a page at a time. Avoids transferring the full games
 * table (heavy JSONB columns) and mounting thousands of DOM nodes.
 */
export const getAdminGameOptions = async (
    params: GameOptionsParams = {},
    signal?: AbortSignal,
): Promise<GameOptionsResult> => {
    const res = await api.get<GameOptionsResult>("/games/options", {
        params: {
            search: params.search || undefined,
            provider: params.provider || undefined,
            page: params.page,
            limit: params.limit,
            exclude: params.exclude?.length ? params.exclude.join(",") : undefined,
        },
        signal,
    });
    return res.data;
};

/* ===============================
   FREE-SPIN PICKERS (server-filtered)
================================ */
export interface FreeSpinProviderOption {
    softwareId: number;
    softwareName: string;
    gameCount: number;
}

/** Software providers that have at least one free-spin-grantable game. */
export const getFreeSpinProviders = async (): Promise<FreeSpinProviderOption[]> => {
    const res = await api.get<FreeSpinProviderOption[]>("/games/free-spin/providers", {
        timeout: 30000,
    });
    return res.data;
};

export interface FreeSpinGameOption {
    id: string;
    providerGameId: string;
    name: string;
}

export interface FreeSpinGamesResult {
    data: FreeSpinGameOption[];
    page: number;
    /** Total matching games, not just this page — drives the "Select all (N)" label. */
    total: number;
    hasMore: boolean;
}

export interface AllFreeSpinGamesResult {
    data: FreeSpinGameOption[];
    total: number;
    /** True when the server cap trimmed the list, so the UI can say so. */
    truncated: boolean;
}

/**
 * Every grantable game of one provider in a single call, for "Select all".
 * Honours the same search term, so "select all" during a search selects the
 * matches rather than the whole catalog.
 */
export const getAllFreeSpinGames = async (
    params: { softwareId: number; search?: string },
    signal?: AbortSignal,
): Promise<AllFreeSpinGamesResult> => {
    const res = await api.get<AllFreeSpinGamesResult>("/games/free-spin/games/all", {
        params: {
            softwareId: params.softwareId,
            search: params.search || undefined,
        },
        timeout: 30000,
        signal,
    });
    return res.data;
};

/** Searchable, paginated free-spin-grantable games for one provider (infinite scroll). */
export const getFreeSpinGames = async (
    params: { softwareId: number; search?: string; page?: number; limit?: number },
    signal?: AbortSignal,
): Promise<FreeSpinGamesResult> => {
    const res = await api.get<FreeSpinGamesResult>("/games/free-spin/games", {
        params: {
            softwareId: params.softwareId,
            search: params.search || undefined,
            page: params.page,
            limit: params.limit,
        },
        signal,
    });
    return res.data;
};

/** Paginated games list — backend returns an envelope when page/limit is sent. */
export const getAdminGamesPaged = async (
    filters: GameListFilters,
    signal?: AbortSignal,
): Promise<Paginated<Game>> => {
    const res = await api.get<Paginated<Game>>("/games/list", {
        params: { limit: 24, ...filters },
        signal,
    });
    return res.data;
};

/** How many games the home page's auto-ranked Trending Now rail shows. */
export interface TrendingConfig {
    limit: number;
    min: number;
    max: number;
}

export const getTrendingConfig = async (): Promise<TrendingConfig> => {
    const res = await api.get<TrendingConfig>("/games/trending/config");
    return res.data;
};

export const updateTrendingConfig = async (limit: number): Promise<TrendingConfig> => {
    const res = await api.patch<TrendingConfig>("/games/trending/config", { limit });
    return res.data;
};

/**
 * Queue an immediate popularity rescore. The scores the Trending order is built
 * from are refreshed hourly by the worker, so without this a change in play
 * activity (or a freshly corrected score) is not visible until that job runs.
 */
export const recalculateTrending = async (): Promise<{ queued: boolean }> => {
    const res = await api.post<{ queued: boolean }>("/games/trending/recalculate");
    return res.data;
};

export interface ProviderSummary {
    provider: string;
    totalGames: number;
    categories: {
        name: string;
        count: number;
        items: Pick<
            Game,
            "id" | "provider" | "category" | "name" | "thumbnail" | "enabled" | "isFeatured" | "isNew" | "displayOrder" | "totalPlays" | "rtp"
        >[];
    }[];
}

export const getProvidersSummary = async () => {
    const res = await api.get<ProviderSummary[]>("/games/summary");
    return res.data;
};

/** One entry per category, MERGED across every provider/aggregator. */
export interface CategorySummary {
    name: string;
    count: number;
    items: Pick<
        Game,
        "id" | "provider" | "studio" | "category" | "name" | "thumbnail" | "enabled" | "isFeatured" | "isNew" | "displayOrder" | "totalPlays" | "rtp"
    >[];
}

export const getCategoriesSummary = async (studio?: string) => {
    const res = await api.get<CategorySummary[]>("/games/categories-summary", {
        params: studio ? { studio } : undefined,
    });
    return res.data;
};

/* ===============================
   PROVIDER (STUDIO) MANAGEMENT
================================ */
export interface AdminProvider {
    id: string;
    name: string;
    slug: string;
    enabled: boolean;
    displayOrder: number;
    logo: string | null;
    gameCount: number;
}

/** List all providers (studios) with enable state, position and game counts. */
export const getAdminProviders = async (): Promise<AdminProvider[]> => {
    const res = await api.get<AdminProvider[]>("/games/providers");
    return res.data;
};

/** Enable/disable a provider, or rename / set its logo. */
export const updateAdminProvider = async (
    id: string,
    data: { enabled?: boolean; name?: string; logo?: string | null },
) => {
    const res = await api.patch<AdminProvider>(`/games/providers/${id}`, data);
    return res.data;
};

/** Persist a new provider ordering (position). */
export const reorderAdminProviders = async (
    updates: { id: string; displayOrder: number }[],
) => {
    const res = await api.put("/games/providers/reorder", updates);
    return res.data;
};

export const updateGame = async (id: string, data: Partial<Game>) => {
    const res = await api.patch<Game>(`/games/${id}`, data);
    return res.data;
};

export const bulkUpdateGameOrder = async (updates: { id: string; displayOrder: number }[]) => {
    const res = await api.put("/games/bulk-order", updates);
    return res.data;
};

/** Renumber a provider/studio's games into a clean sequential 1..N order. */
export const normalizeGameOrder = async (filters: { provider?: string; studio?: string }) => {
    const res = await api.put<{ success: boolean; total: number; updated: number }>(
        "/games/normalize-order",
        undefined,
        { params: filters },
    );
    return res.data;
};

/**
 * Save a category section's game order. Positions are scoped per (game, category)
 * so reordering one section never affects another. `updates` carry 1-based
 * positions (page-aligned, like the provider bulk save).
 */
export const bulkUpdateCategoryOrder = async (body: {
    category: string;
    updates: { gameId: string; position: number }[];
}) => {
    const res = await api.put<{ success: boolean; updated: number }>(
        "/games/category-order",
        body,
    );
    return res.data;
};

/** Move a game to a 1-based position within its provider/studio (keeps 1..N clean). */
export const moveGamePosition = async (body: {
    gameId: string;
    position: number;
    provider?: string;
    studio?: string;
    /** Scope the move to one category section (per-category positions) */
    category?: string;
}) => {
    const res = await api.put<{ success: boolean; total: number; updated: number }>(
        "/games/move-position",
        body,
    );
    return res.data;
};

export const getAdminCategories = async () => {
    const res = await api.get<Category[]>("/games/categories");
    return res.data;
};

export const createAdminCategory = async (data: Partial<Category>) => {
    const res = await api.post<Category>("/games/categories", data);
    return res.data;
};

export const updateAdminCategory = async (id: string, data: Partial<Category>) => {
    const res = await api.patch<Category>(`/games/categories/${id}`, data);
    return res.data;
};

export const deleteAdminCategory = async (id: string) => {
    const res = await api.delete(`/games/categories/${id}`);
    return res.data;
};

/* ===================== ALEAPLAY SYNC (admin Settings tab) ===================== */

export interface AleaSyncStatus {
  running: boolean;
  runningForSeconds: number | null;
  lastRun: {
    trigger: "cron" | "manual";
    startedAt: string;
    finishedAt: string;
    durationSeconds: number;
    success: boolean;
    count: number;
    error?: string;
    /** Per-provider outcome. Absent on a status recorded by an older API. */
    providers?: Record<
      "aleaplay" | "sagames",
      { success: boolean; count: number; error?: string }
    >;
  } | null;
  schedule: { cron: string; timeZone: string; description: string };
  /** Null when the progress query failed — the sync state still renders. */
  verification: {
    candidates: number;
    verified: number;
    supported: number;
    refused: number;
    pending: number;
  } | null;
}

/** Kick off a catalog sync. Returns immediately; poll `getAleaSyncStatus`. */
export const startAleaSync = async (): Promise<{
  started: boolean;
  alreadyRunning: boolean;
  message: string;
}> => {
  const res = await api.post("/aleaplay/sync");
  return res.data;
};

export const getAleaSyncStatus = async (): Promise<AleaSyncStatus> => {
  const res = await api.get("/aleaplay/sync/status");
  return res.data;
};

/** Verify one batch of games with AleaPlay for free-spin support. */
export const verifyAleaFreeSpins = async (): Promise<{
  checked: number;
  supported: number;
  refused: number;
  unreachable: number;
  message: string;
}> => {
  const res = await api.post("/aleaplay/verify-free-spins");
  return res.data;
};
