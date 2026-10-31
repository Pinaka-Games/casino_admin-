import api from "../config/axios.config";

export interface SeedResult {
    sidebar: {
        groupsCreated: number;
        groupsUpdated: number;
        itemsCreated: number;
        itemsUpdated: number;
    };
    categories: { created: number; existing: number };
    modals: { created: number; existing: number };
    /** Home layout snapshot: total rows now listed, and how many were new. */
    homeLayout: { sections: number; added: number };
    /**
     * Social Live Casino tabs: total now configured, how many were new, and how
     * many games were linked into tabs that were still empty.
     */
    liveCasinoTabs: { tabs: number; created: number; gamesLinked: number };
}

/**
 * Seed the default sidebar menu tree + default game categories + the home page
 * layout (idempotent). Safe to re-run: missing defaults are created, existing
 * default menu entries are refreshed, admin-created custom entries and an
 * admin-set home order are left untouched.
 */
export const seedAllDefaults = async (): Promise<SeedResult> => {
    const res = await api.post<SeedResult>("/seed-all");
    return res.data;
};
