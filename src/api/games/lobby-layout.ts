import api from "../config/axios.config";

/** A resolved lobby category tab (all games / category / collection / utility). */
export interface LobbyTab {
    key: string;
    type: "builtin" | "category" | "collection" | "utility";
    /** Category/collection id when applicable, else null. */
    refId: string | null;
    title: string;
    slug: string;
    enabled: boolean;
}

/** Resolved lobby tabs (all games + categories + collections + utility) in order. */
export const getLobbyLayout = async (): Promise<LobbyTab[]> => {
    const res = await api.get<LobbyTab[]>("/lobby-layout");
    return res.data;
};

/** Persist the tab order (array index) + visibility. Returns the resolved list. */
export const saveLobbyLayout = async (
    items: { key: string; enabled: boolean }[],
): Promise<LobbyTab[]> => {
    const res = await api.put<LobbyTab[]>("/lobby-layout", { items });
    return res.data;
};
