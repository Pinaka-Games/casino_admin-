import api from "../config/axios.config";

export interface SidebarMenuItem {
    id: string;
    groupId: string;
    /** When set, this item materializes a game collection (managed from the category) */
    collectionId: string | null;
    labelKey: string | null;
    label: string | null;
    iconKey: string | null;
    iconUrl: string | null;
    link: string | null;
    action: string | null;
    requireAuth: boolean;
    featureFlag: string | null;
    displayOrder: number;
    enabled: boolean;
}

export interface SidebarMenuGroup {
    id: string;
    titleKey: string | null;
    title: string | null;
    iconKey: string | null;
    iconUrl: string | null;
    link: string | null;
    displayOrder: number;
    enabled: boolean;
    items: SidebarMenuItem[];
}

export interface GroupPayload {
    title?: string;
    titleKey?: string;
    iconKey?: string;
    iconUrl?: string;
    link?: string;
    enabled?: boolean;
}

export interface ItemPayload {
    groupId?: string;
    label?: string;
    labelKey?: string;
    iconKey?: string;
    iconUrl?: string;
    link?: string;
    action?: string;
    requireAuth?: boolean;
    featureFlag?: string;
    enabled?: boolean;
}

/** Full tree (groups + items) for management. */
export const getSidebarTree = async (): Promise<SidebarMenuGroup[]> => {
    const res = await api.get<SidebarMenuGroup[]>("/sidebar-menus");
    return res.data;
};

/** Persist the whole tree's order + group membership. */
export const reorderSidebar = async (
    groups: { id: string; items: string[] }[],
) => {
    const res = await api.put("/sidebar-menus/reorder", { groups });
    return res.data;
};

export const createSidebarGroup = async (data: GroupPayload): Promise<SidebarMenuGroup> => {
    const res = await api.post<SidebarMenuGroup>("/sidebar-menus/groups", data);
    return res.data;
};

export const updateSidebarGroup = async (id: string, data: GroupPayload) => {
    const res = await api.patch(`/sidebar-menus/groups/${id}`, data);
    return res.data;
};

export const deleteSidebarGroup = async (id: string) => {
    const res = await api.delete(`/sidebar-menus/groups/${id}`);
    return res.data;
};

export const createSidebarItem = async (data: ItemPayload): Promise<SidebarMenuItem> => {
    const res = await api.post<SidebarMenuItem>("/sidebar-menus/items", data);
    return res.data;
};

export const updateSidebarItem = async (id: string, data: ItemPayload) => {
    const res = await api.patch(`/sidebar-menus/items/${id}`, data);
    return res.data;
};

export const deleteSidebarItem = async (id: string) => {
    const res = await api.delete(`/sidebar-menus/items/${id}`);
    return res.data;
};

/** Icon registry keys the player app knows how to render (preset library). */
export const SIDEBAR_ICON_KEYS = [
    "home",
    "favorites",
    "recent",
    "livedealers",
    "slots",
    "table",
    "fishing",
    "poker",
    "sidehustle",
    "vip",
    "promo",
    "bonus",
    "reward",
    "subscription",
    "jackpot",
    "tournament",
    "announcement",
    "sponsorships",
    "faq",
    "live",
    "chat",
    "history",
] as const;

/** Client actions a menu item can trigger instead of navigating. */
export const SIDEBAR_ACTIONS = ["openChatModal", "openIntercom", "toast"] as const;
