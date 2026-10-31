import api from "../config/axios.config";

/**
 * A resolved home-page section row: a builtin (hero, auto game rows, FAQ…), a
 * curated collection, or a game category (Arcade, Instant Win…). Every block the
 * player sees on the home page is one of these.
 */
export interface HomeSection {
    key: string;
    type: "builtin" | "collection" | "category";
    /** Collection/category id for those types, else null */
    refId: string | null;
    title: string;
    enabled: boolean;
}

/** Resolved sections (builtins + collections + categories) in admin order. */
export const getHomeLayout = async (): Promise<HomeSection[]> => {
    const res = await api.get<HomeSection[]>("/home-layout");
    return res.data;
};

/** Persist the section order (array index) + visibility. Returns the resolved list. */
export const saveHomeLayout = async (
    items: { key: string; enabled: boolean }[],
): Promise<HomeSection[]> => {
    const res = await api.put<HomeSection[]>("/home-layout", { items });
    return res.data;
};
