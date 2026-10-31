import api from "../config/axios.config";
import { Game } from "./games";
import type { NameTranslations } from "./collections";

/**
 * Admin client for the Social Live Casino tabs ("Live Casino Categories").
 *
 * Everything the player app renders in that section comes from here: the tabs
 * (order, labels, icons, which one opens first) and, for hand-picked tabs, the
 * ordered games inside each.
 */

/**
 * Icon keys a tab chip can carry. Icons are code assets, so the DB stores only
 * the key — this list MUST stay in sync with the player app's
 * `components/home/liveCasinoIcons.tsx` registry, or a chip falls back to its
 * default icon.
 */
export const LIVE_CASINO_ICON_KEYS = [
    "flame",
    "sparkles",
    "star",
    "crown",
    "trophy",
    "gem",
    "zap",
    "dice",
    "roulette",
    "spade",
    "club",
    "diamond",
    "heart",
    "grid",
    "layers",
    "tv",
    "users",
    "play",
    "target",
    "clock",
    "coins",
    "joystick",
] as const;

export type LiveCasinoIconKey = (typeof LIVE_CASINO_ICON_KEYS)[number];

/** Where a tab gets its games. */
export type LiveCasinoSourceType = "manual" | "auto";

/** The rule an `auto` tab resolves with. */
export type LiveCasinoAutoRule = "popular" | "new" | "all" | "subcategory";

export interface LiveCasinoTab {
    id: string;
    name: string;
    /** Translated labels shown to players on the matching locale */
    translations?: NameTranslations;
    /** True when `translations` was machine-generated (refreshed on rename) */
    autoTranslated?: boolean;
    slug: string;
    /** Icon registry key rendered on the tab chip */
    iconKey: string | null;
    position: number;
    /** Enabled/visible — an inactive tab is not served to players at all */
    isActive: boolean;
    /** The tab the section opens on. At most one tab carries it. */
    isDefault: boolean;
    sourceType: LiveCasinoSourceType;
    autoRule: LiveCasinoAutoRule | null;
    /** Comma-separated match terms for the "subcategory" rule (e.g. "roulette,rot") */
    autoFilter: string | null;
    /** Cap on games served for this tab (0 = no cap) */
    maxGames: number;
    /** Convenience counts returned by the admin list endpoint */
    gameCount?: number;
    activeGameCount?: number;
    createdAt: string;
    updatedAt: string;
}

/** A game inside a tab, carrying its per-tab membership state. */
export interface LiveCasinoTabGame extends Game {
    /** False hides the game from THIS tab only (`games.enabled` is untouched) */
    tabGameActive?: boolean;
    tabPosition?: number;
}

/** One game's place in a tab, as sent on save. */
export interface LiveCasinoTabMembership {
    gameId: string;
    /** Omit to leave an existing member's show/hide state alone */
    isActive?: boolean;
}

export interface LiveCasinoTabPayload {
    name?: string;
    /**
     * Per-locale labels. Send `{}` (or an empty value for a locale) to have the
     * backend machine-translate the English name instead.
     */
    translations?: NameTranslations;
    iconKey?: string;
    isActive?: boolean;
    isDefault?: boolean;
    sourceType?: LiveCasinoSourceType;
    autoRule?: LiveCasinoAutoRule;
    autoFilter?: string;
    maxGames?: number;
    /** Replacement ordered membership, order-only (manual tabs) */
    gameIds?: string[];
    /**
     * Replacement ordered membership WITH per-game show/hide — the whole tab in
     * one save. Takes precedence over `gameIds`.
     */
    games?: LiveCasinoTabMembership[];
}

/** Every tab (incl. hidden) with its game counts, in position order. */
export const getLiveCasinoTabs = async (): Promise<LiveCasinoTab[]> => {
    const res = await api.get<LiveCasinoTab[]>("/games/live-casino/tabs");
    return res.data;
};

/** One tab plus its resolved, ordered games (for the editor). */
export const getLiveCasinoTab = async (
    id: string,
): Promise<{ tab: LiveCasinoTab; games: LiveCasinoTabGame[] }> => {
    const res = await api.get<{ tab: LiveCasinoTab; games: LiveCasinoTabGame[] }>(
        `/games/live-casino/tabs/${id}`,
    );
    return res.data;
};

export const createLiveCasinoTab = async (
    data: LiveCasinoTabPayload,
): Promise<LiveCasinoTab> => {
    const res = await api.post<LiveCasinoTab>("/games/live-casino/tabs", data);
    return res.data;
};

export const updateLiveCasinoTab = async (
    id: string,
    data: LiveCasinoTabPayload,
): Promise<LiveCasinoTab> => {
    const res = await api.patch<LiveCasinoTab>(`/games/live-casino/tabs/${id}`, data);
    return res.data;
};

export const deleteLiveCasinoTab = async (id: string) => {
    const res = await api.delete(`/games/live-casino/tabs/${id}`);
    return res.data;
};

/** One tab's place in the strip, as sent by the arrangement save. */
export interface LiveCasinoTabArrangement {
    id: string;
    /** 0-based position */
    position: number;
    /** Omit to leave the tab's visibility alone */
    isActive?: boolean;
    /** Marks the tab the section opens on; the backend keeps only one */
    isDefault?: boolean;
}

/**
 * Persist the tab strip as arranged — order, visibility and which tab opens
 * first, in one write. They are edited together on one screen, so saving them
 * together avoids a half-applied strip if one call of several were to fail.
 */
export const saveLiveCasinoTabs = async (updates: LiveCasinoTabArrangement[]) => {
    const res = await api.put("/games/live-casino/tabs/reorder", { updates });
    return res.data;
};

/** Append games to a tab. */
export const addLiveCasinoTabGames = async (id: string, gameIds: string[]) => {
    const res = await api.post<{ added: number }>(`/games/live-casino/tabs/${id}/games`, {
        gameIds,
    });
    return res.data;
};

/** Persist a new order for a tab's games. */
export const reorderLiveCasinoTabGames = async (id: string, gameIds: string[]) => {
    const res = await api.put(`/games/live-casino/tabs/${id}/games/reorder`, { gameIds });
    return res.data;
};

/** Show/hide one game within one tab. */
export const toggleLiveCasinoTabGame = async (
    id: string,
    gameId: string,
    isActive: boolean,
) => {
    const res = await api.patch(`/games/live-casino/tabs/${id}/games/${gameId}`, {
        isActive,
    });
    return res.data;
};

/** Remove a game from a tab. */
export const removeLiveCasinoTabGame = async (id: string, gameId: string) => {
    const res = await api.delete(`/games/live-casino/tabs/${id}/games/${gameId}`);
    return res.data;
};

export interface LiveCasinoSeedResult {
    /** Tabs configured after the seed */
    tabs: number;
    /** Default tabs that were missing and got created */
    created: number;
    /** Games linked into default tabs that were holding none */
    gamesLinked: number;
}

/**
 * Create any missing default tab and fill the ones holding no games.
 *
 * Idempotent and non-destructive: a tab that already has games keeps exactly the
 * list it has, and renames / reorders / icons / visibility are never touched.
 * Useful right after a deploy, when the tabs exist but the provider catalogues
 * had not synced yet at migration time.
 */
export const seedLiveCasinoDefaults = async (): Promise<LiveCasinoSeedResult> => {
    const res = await api.post<LiveCasinoSeedResult>("/games/live-casino/tabs/seed-defaults");
    return res.data;
};
