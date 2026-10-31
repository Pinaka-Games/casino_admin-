import { create } from "zustand";
import {
  getAllAdminGames,
  getAdminGamesPaged,
  getAdminCategories,
  getProvidersSummary,
  getCategoriesSummary,
  getAdminProviders,
  updateAdminProvider,
  reorderAdminProviders,
  updateGame,
  getTrendingConfig,
  updateTrendingConfig,
  recalculateTrending,
  Game,
  Category,
  ProviderSummary,
  CategorySummary,
  AdminProvider,
} from "@/api/games/games";
import { getAdminCollectionsWithGames, CollectionWithGames } from "@/api/games/collections";

const DEFAULT_LIMIT = 24;
const MARKETING_LIMIT = 100; // marketing set is curated/small — load in one bounded call

interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const EMPTY_META: PageMeta = { page: 1, limit: DEFAULT_LIMIT, total: 0, totalPages: 1 };

export type ViewMode = "category" | "provider" | "all";

/** Filters of the flat All Games view, driven from the header search too. */
export interface AllGamesFilters {
  search: string;
  /** Which dimension the value dropdown filters on */
  filterBy: "category" | "provider";
  /** Category name or studio name; "" = no filter */
  filterValue: string;
  status: "all" | "active" | "inactive";
  sortBy: "default" | "name" | "popular";
  page: number;
}

const DEFAULT_ALL_FILTERS: AllGamesFilters = {
  search: "",
  filterBy: "category",
  filterValue: "",
  status: "all",
  sortBy: "default",
  page: 1,
};

// Responses can land out of order while the admin types; only the newest
// request may write the All Games list, and the one it replaces is aborted so
// the server and the network are not busy with a search nobody will see.
let allGamesRequestSeq = 0;
let allGamesAbort: AbortController | null = null;

interface GameState {
  /** Legacy: full flat list of games (used by package/commission pickers) */
  games: Game[];
  /** Lightweight overview (provider/category counts + preview) for the landing screen */
  summary: ProviderSummary[];
  /** Category-first overview, merged across providers (the default landing view) */
  categoriesSummary: CategorySummary[];
  categories: Category[];
  isLoading: boolean;
  error: string | null;

  selectedProviderId: string | number | null;
  selectedCategory: string;
  selectedProviderTab: string;

  /**
   * "category" = current provider/category overview; "provider" = studio grid;
   * "all" = every game in one flat, filterable, paginated list
   */
  viewMode: ViewMode;

  /** Flat All Games view */
  allGames: Game[];
  allGamesMeta: PageMeta;
  allGamesLoading: boolean;
  allGamesFilters: AllGamesFilters;

  /** Provider (studio) registry for the Provider view */
  providers: AdminProvider[];
  providersLoading: boolean;
  /** Studio currently drilled into within the Provider view */
  selectedStudio: string | null;

  /** Server-paginated games for the detailed view / marketing tab */
  detailGames: Game[];
  detailMeta: PageMeta;
  detailLoading: boolean;

  /** Read-only "Hot Games" group on the Marketing tab — top games by popularity */
  hotGames: Game[];
  hotGamesLoading: boolean;

  /** Marketing tab now mirrors the real categories (collections) + their games */
  marketingCategories: CollectionWithGames[];
  marketingLoading: boolean;

  /**
   * Read-only "Trending Now" group on the Marketing tab. The home page's
   * Trending row is a BUILTIN section (home-layout key `trending`), not a
   * collection, so it never came back from the collections endpoint — that is
   * why the row was visible to players but absent from this tab. It is derived
   * the same way the player app derives it: top games by plays.
   */
  trendingGames: Game[];
  trendingLoading: boolean;
  /**
   * How many of `trendingGames` are actually on the home page. The list is
   * deliberately longer than this: the rail auto-ranks, so disabling a live game
   * promotes the next one, and an admin can only make that call if they can see
   * who is waiting.
   */
  trendingLimit: number;
  /** Bounds the backend will clamp `trendingLimit` to. */
  trendingLimitBounds: { min: number; max: number };
  trendingSaving: boolean;
}

interface FetchGamesParams {
  provider?: string;
  studio?: string;
  category?: string;
  search?: string;
  page?: number;
}

interface GameActions {
  /** Legacy: fetch ALL games + categories (used by package/commission screens) */
  fetchData: () => Promise<void>;
  /** Lightweight overview for the game-listing landing screen */
  fetchOverview: () => Promise<void>;
  /** Category-first overview (merged across providers); optional studio filter */
  fetchCategoriesSummary: (studio?: string) => Promise<void>;
  fetchProviderGames: (params: FetchGamesParams) => Promise<void>;
  fetchMarketingGames: () => Promise<void>;
  /** Load the top-popular games for the read-only Hot Games marketing group */
  fetchHotGames: () => Promise<void>;
  /** Load the real categories (collections) + games for the Marketing tab */
  fetchMarketingCategories: () => Promise<void>;
  /** Load the auto-ranked Trending Now group (+ its next-in-line games) */
  fetchTrendingGames: () => Promise<void>;
  /** Resize the home page's Trending Now rail */
  setTrendingLimit: (limit: number) => Promise<void>;
  /** Queue an immediate popularity rescore behind the Trending ranking */
  recalculateTrending: () => Promise<void>;
  setSelectedProviderId: (id: string | number | null) => void;
  setSelectedCategory: (category: string) => void;
  setSelectedProviderTab: (tab: string) => void;
  toggleGameStatus: (itemId: string | number, value: boolean) => Promise<void>;
  toggleFeatured: (itemId: string | number, value: boolean) => Promise<void>;
  toggleNew: (itemId: string | number, value: boolean) => Promise<void>;
  /** Provider (studio) view */
  setViewMode: (mode: ViewMode) => void;
  /** Merge filters into the All Games view; any change but `page` resets to page 1 */
  setAllGamesFilters: (patch: Partial<AllGamesFilters>) => void;
  fetchAllGames: () => Promise<void>;
  setSelectedStudio: (studio: string | null) => void;
  fetchProviders: () => Promise<void>;
  toggleProvider: (id: string, value: boolean) => Promise<void>;
  reorderProviders: (ordered: AdminProvider[]) => Promise<void>;

  reset: () => void;
}

type GameStore = GameState & GameActions;

const HOT_LIMIT = 18; // top-popular preview shown in the Hot Games marketing group
// Used only until GET /games/trending/config answers — the real size lives on
// the home layout and is edited from the Marketing tab.
const TRENDING_LIMIT_FALLBACK = 10;
// Extra ranks fetched beyond the live rail so the admin can see which games are
// next in line to be promoted when a live one is switched off.
const TRENDING_BUFFER = 6;

const initialState: GameState = {
  games: [],
  summary: [],
  categoriesSummary: [],
  categories: [],
  isLoading: true,
  error: null,
  selectedProviderId: null,
  selectedCategory: "",
  selectedProviderTab: "all",
  // The flat All Games list is the landing view: most visits are to find one
  // game and switch it, which the search there does in one step.
  viewMode: "all",
  allGames: [],
  allGamesMeta: EMPTY_META,
  allGamesLoading: false,
  allGamesFilters: DEFAULT_ALL_FILTERS,
  providers: [],
  providersLoading: false,
  selectedStudio: null,
  detailGames: [],
  detailMeta: EMPTY_META,
  detailLoading: false,
  hotGames: [],
  hotGamesLoading: false,
  marketingCategories: [],
  marketingLoading: false,
  trendingGames: [],
  trendingLoading: false,
  trendingLimit: TRENDING_LIMIT_FALLBACK,
  trendingLimitBounds: { min: 5, max: 30 },
  trendingSaving: false,
};


/**
 * Patch a game across the legacy list, the paginated list, the overview
 * preview, and both Marketing-tab groups (collections + Trending). A game can
 * appear in several of these at once, so a toggle has to land everywhere or the
 * same game renders with two different states on one screen.
 */
function patchGame(state: GameState, id: string, patch: Partial<Game>) {
  return {
    games: state.games.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    detailGames: state.detailGames.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    allGames: state.allGames.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    trendingGames: state.trendingGames.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    marketingCategories: state.marketingCategories.map((c) => ({
      ...c,
      games: c.games.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    })),
    summary: state.summary.map((p) => ({
      ...p,
      categories: p.categories.map((c) => ({
        ...c,
        items: c.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      })),
    })),
  };
}

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  fetchData: async () => {
    set({ isLoading: true, error: null });
    try {
      const [games, categories] = await Promise.all([
        getAllAdminGames({}),
        getAdminCategories(),
      ]);
      set({ games, categories, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false, error: error?.message || "Failed to fetch games data" });
      throw error;
    }
  },

  fetchOverview: async () => {
    set({ isLoading: true, error: null });
    try {
      const [summary, categoriesSummary, categories] = await Promise.all([
        getProvidersSummary(),
        getCategoriesSummary(),
        getAdminCategories(),
      ]);
      set({ summary, categoriesSummary, categories, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false, error: error?.message || "Failed to fetch games data" });
      throw error;
    }
  },

  fetchCategoriesSummary: async (studio?: string) => {
    set({ isLoading: true, error: null });
    try {
      const categoriesSummary = await getCategoriesSummary(studio);
      set({ categoriesSummary, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false, error: error?.message || "Failed to fetch categories" });
      throw error;
    }
  },

  fetchProviderGames: async ({ provider, studio, category, search, page }) => {
    set({ detailLoading: true });
    try {
      const res = await getAdminGamesPaged({
        provider,
        studio,
        category: category && category !== "all" ? category : undefined,
        search: search?.trim() || undefined,
        page: page || 1,
        limit: DEFAULT_LIMIT,
      });
      set({
        detailGames: res.data,
        detailMeta: { page: res.page, limit: res.limit, total: res.total, totalPages: res.totalPages },
        detailLoading: false,
      });
    } catch (error: any) {
      set({ detailLoading: false, error: error?.message || "Failed to fetch games" });
      throw error;
    }
  },

  fetchMarketingGames: async () => {
    set({ detailLoading: true });
    try {
      const res = await getAdminGamesPaged({ marketing: true, page: 1, limit: MARKETING_LIMIT });
      set({
        detailGames: res.data,
        detailMeta: { page: res.page, limit: res.limit, total: res.total, totalPages: res.totalPages },
        detailLoading: false,
      });
    } catch (error: any) {
      set({ detailLoading: false, error: error?.message || "Failed to fetch marketing games" });
      throw error;
    }
  },

  fetchHotGames: async () => {
    set({ hotGamesLoading: true });
    try {
      const res = await getAdminGamesPaged({ sortBy: "popular", page: 1, limit: HOT_LIMIT });
      set({ hotGames: res.data, hotGamesLoading: false });
    } catch (error: any) {
      set({ hotGamesLoading: false, error: error?.message || "Failed to fetch hot games" });
      throw error;
    }
  },

  fetchMarketingCategories: async () => {
    set({ marketingLoading: true });
    try {
      const data = await getAdminCollectionsWithGames();
      set({ marketingCategories: data, marketingLoading: false });
    } catch (error: any) {
      set({ marketingLoading: false, error: error?.message || "Failed to fetch categories" });
      throw error;
    }
  },

  fetchTrendingGames: async () => {
    set({ trendingLoading: true });
    try {
      // The configured size first — the games request depends on it, and the
      // rail must be previewed at the length players actually get.
      const config = await getTrendingConfig().catch(() => null);
      const limit = config?.limit ?? useGameStore.getState().trendingLimit;
      // `enabled: true` mirrors the player-facing rail, which ranks enabled
      // games only. Without it the preview would show an order nobody sees, and
      // disabling a game would not visibly promote its replacement.
      const res = await getAdminGamesPaged({
        sortBy: "popular",
        page: 1,
        limit: limit + TRENDING_BUFFER,
        enabled: true,
      });
      set({
        trendingGames: res.data,
        trendingLimit: limit,
        trendingLimitBounds: config
          ? { min: config.min, max: config.max }
          : useGameStore.getState().trendingLimitBounds,
        trendingLoading: false,
      });
    } catch (error: any) {
      set({ trendingLoading: false, error: error?.message || "Failed to fetch trending games" });
      throw error;
    }
  },

  recalculateTrending: async () => {
    await recalculateTrending();
  },

  setTrendingLimit: async (limit) => {
    set({ trendingSaving: true });
    try {
      const saved = await updateTrendingConfig(limit);
      set({
        trendingLimit: saved.limit,
        trendingLimitBounds: { min: saved.min, max: saved.max },
        trendingSaving: false,
      });
      // The rail got longer or shorter, so the buffer window moved with it.
      await useGameStore.getState().fetchTrendingGames();
    } catch (error) {
      set({ trendingSaving: false });
      throw error;
    }
  },

  setSelectedProviderId: (id) => set({ selectedProviderId: id }),

  setSelectedCategory: (category) => set({ selectedCategory: category }),

  setSelectedProviderTab: (tab) =>
    set({ selectedProviderTab: tab, selectedProviderId: null, selectedCategory: "" }),

  setViewMode: (mode) =>
    set({
      viewMode: mode,
      // Reset any open drill-downs when switching the top-level view.
      selectedProviderId: null,
      selectedStudio: null,
      selectedCategory: "",
    }),

  setSelectedStudio: (studio) => set({ selectedStudio: studio, selectedCategory: "" }),

  setAllGamesFilters: (patch) =>
    set((state) => {
      const next = { ...state.allGamesFilters, ...patch };
      // Switching Category ↔ Provider makes the old value meaningless.
      if (patch.filterBy && patch.filterBy !== state.allGamesFilters.filterBy && patch.filterValue === undefined) {
        next.filterValue = "";
      }
      const onlyPage = Object.keys(patch).length === 1 && patch.page !== undefined;
      if (!onlyPage) next.page = 1;
      return { allGamesFilters: next };
    }),

  fetchAllGames: async () => {
    const f = useGameStore.getState().allGamesFilters;
    const seq = ++allGamesRequestSeq;
    allGamesAbort?.abort();
    const controller = new AbortController();
    allGamesAbort = controller;
    set({ allGamesLoading: true });
    try {
      const res = await getAdminGamesPaged(
        {
          search: f.search.trim() || undefined,
          category: f.filterBy === "category" && f.filterValue ? f.filterValue : undefined,
          studio: f.filterBy === "provider" && f.filterValue ? f.filterValue : undefined,
          enabled: f.status === "all" ? undefined : f.status === "active",
          sortBy: f.sortBy === "default" ? undefined : f.sortBy,
          page: f.page,
          limit: DEFAULT_LIMIT,
          // Cards here show no section position, so skip computing one.
          positions: false,
        },
        controller.signal,
      );
      if (seq !== allGamesRequestSeq) return;
      set({
        allGames: res.data,
        allGamesMeta: { page: res.page, limit: res.limit, total: res.total, totalPages: res.totalPages },
        allGamesLoading: false,
      });
    } catch (error: any) {
      if (seq !== allGamesRequestSeq) return;
      set({ allGamesLoading: false, error: error?.message || "Failed to fetch games" });
      throw error;
    }
  },

  fetchProviders: async () => {
    set({ providersLoading: true });
    try {
      const providers = await getAdminProviders();
      set({ providers, providersLoading: false });
    } catch (error: any) {
      set({ providersLoading: false, error: error?.message || "Failed to fetch providers" });
      throw error;
    }
  },

  toggleProvider: async (id, value) => {
    // Optimistic update — revert on failure.
    const prev = useGameStore.getState().providers;
    set({ providers: prev.map((p) => (p.id === id ? { ...p, enabled: value } : p)) });
    try {
      await updateAdminProvider(id, { enabled: value });
    } catch (error) {
      set({ providers: prev });
      throw error;
    }
  },

  reorderProviders: async (ordered) => {
    // Apply the new order locally, then persist positions.
    const reindexed = ordered.map((p, idx) => ({ ...p, displayOrder: idx }));
    const prev = useGameStore.getState().providers;
    set({ providers: reindexed });
    try {
      await reorderAdminProviders(reindexed.map((p) => ({ id: p.id, displayOrder: p.displayOrder })));
    } catch (error) {
      set({ providers: prev });
      throw error;
    }
  },

  toggleGameStatus: async (itemId, value) => {
    await updateGame(String(itemId), { enabled: value });
    set((state) => patchGame(state, String(itemId), { enabled: value }));
  },

  toggleFeatured: async (itemId, value) => {
    await updateGame(String(itemId), { isFeatured: value });
    set((state) => patchGame(state, String(itemId), { isFeatured: value }));
  },

  toggleNew: async (itemId, value) => {
    await updateGame(String(itemId), { isNew: value });
    set((state) => patchGame(state, String(itemId), { isNew: value }));
  },

  reset: () => set(initialState),
}));
