import api from "../config/axios.config";
import { Game } from "./games";

/**
 * Per-locale display names keyed by locale code ("es"). The English name lives
 * in `name`; players on another locale see the entry for theirs.
 */
export type NameTranslations = Record<string, string>;

/** An admin-curated, ordered, hand-picked list of games (a home-page row). */
export interface GameCollection {
    id: string;
    name: string;
    /** Translated names shown to players on the matching locale */
    translations?: NameTranslations;
    /** True when `translations` was machine-generated (refreshed on rename) */
    autoTranslated?: boolean;
    slug: string;
    enabled: boolean;
    /** When true, the collection also appears as an item in the player sidebar */
    showInSidebar: boolean;
    /** Icon registry key (used by the category's sidebar item) */
    iconKey: string | null;
    displayOrder: number;
    gameIds: string[];
    /** Convenience count returned by the admin list endpoint */
    gameCount?: number;
    createdAt: string;
    updatedAt: string;
}

export interface CollectionPayload {
    name?: string;
    /**
     * Per-locale names. Send `{}` (or an empty value for a locale) to have the
     * backend machine-translate the English name instead.
     */
    translations?: NameTranslations;
    enabled?: boolean;
    showInSidebar?: boolean;
    iconKey?: string;
    /** Place the sidebar item under this existing menu group */
    sidebarGroupId?: string;
    /** Or create a new menu group with this name for the sidebar item */
    sidebarGroupName?: string;
    /** Ordered array of game UUIDs */
    gameIds?: string[];
}

/** List all collections (with game counts), in display order. */
export const getAdminCollections = async (): Promise<GameCollection[]> => {
    const res = await api.get<GameCollection[]>("/games/collections");
    return res.data;
};

/** A collection plus its resolved games (for the marketing preview). */
export interface CollectionWithGames extends GameCollection {
    games: Game[];
}

/** List all collections WITH their resolved games, in display order. */
export const getAdminCollectionsWithGames = async (): Promise<CollectionWithGames[]> => {
    const res = await api.get<CollectionWithGames[]>("/games/collections/with-games");
    return res.data;
};

/** Fetch one collection plus its resolved, ordered games (for the editor). */
export const getAdminCollection = async (
    id: string,
): Promise<{ collection: GameCollection; games: Game[] }> => {
    const res = await api.get<{ collection: GameCollection; games: Game[] }>(
        `/games/collections/${id}`,
    );
    return res.data;
};

export const createCollection = async (data: CollectionPayload): Promise<GameCollection> => {
    const res = await api.post<GameCollection>("/games/collections", data);
    return res.data;
};

export const updateCollection = async (
    id: string,
    data: CollectionPayload,
): Promise<GameCollection> => {
    const res = await api.patch<GameCollection>(`/games/collections/${id}`, data);
    return res.data;
};

export const deleteCollection = async (id: string) => {
    const res = await api.delete(`/games/collections/${id}`);
    return res.data;
};

/** Persist a new ordering of the collection rows. */
export const reorderCollections = async (
    updates: { id: string; displayOrder: number }[],
) => {
    const res = await api.put("/games/collections/reorder", updates);
    return res.data;
};
