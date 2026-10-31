"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useGameStore } from "@/store/game-store";
import { useDeepLinkParam } from "@/hooks/use-deep-link-param";
import { moveGamePosition, bulkUpdateGameOrder, normalizeGameOrder, bulkUpdateCategoryOrder } from "@/api/games/games";
import type { GameCollection } from "@/api/games/collections";
import { GameProvider } from "./types";
import GameListingHeader from "./components/GameListingHeader";
import SyncSettingsPanel from "./components/SyncSettingsPanel";
import { toast } from "react-hot-toast";
import GameProviderList from "./components/Game-providers";
import {
  DetailedViewSkeleton,
  OverviewSkeleton,
  GameGridSkeleton,
  ProviderGridSkeleton,
} from "./components/GameSkeletons";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NoData from "@/components/NoData/NoData";

// Lazy-load the heavy detailed view (dnd-kit, CSV, modal) — only when a provider is opened.
const DetailedProviderView = dynamic(() => import("./components/Detailed-provider-views"), {
  ssr: false,
  loading: () => <DetailedViewSkeleton />,
});

// Lazy-load the provider (studio) grid — only when the Provider view is active.
const ProviderGridView = dynamic(() => import("./components/Provider-grid-view"), {
  ssr: false,
  loading: () => <ProviderGridSkeleton count={18} />,
});

// Lazy-load the category editor (opened from the Marketing tab's Edit Category button).
const CollectionModal = dynamic(() => import("./components/CollectionModal"), {
  ssr: false,
});

// Lazy-load the Social Live Casino tab manager — only when its tab is opened.
import TrendingLimitControl from "./components/TrendingLimitControl";

// Lazy-load the flat All Games list — only when that view is opened.
const AllGamesView = dynamic(() => import("./components/AllGamesView"), {
  ssr: false,
  loading: () => <GameGridSkeleton count={18} />,
});

const LiveCasinoTabsManager = dynamic(
  () => import("./components/live-casino/LiveCasinoTabsManager"),
  { ssr: false },
);


export default function GameListingPage() {
  const {
    summary,
    categoriesSummary,
    categories,
    isLoading: loading,
    detailGames,
    detailMeta,
    detailLoading,
    marketingCategories,
    marketingLoading,
    trendingGames,
    trendingLoading,
    trendingLimit,
    selectedProviderId,
    selectedCategory,
    selectedProviderTab,
    viewMode,
    providers,
    providersLoading,
    selectedStudio,
    fetchOverview,
    fetchProviderGames,
    fetchMarketingCategories,
    fetchTrendingGames,
    fetchProviders,
    setSelectedProviderId,
    setSelectedCategory,
    setSelectedProviderTab,
    setViewMode,
    setSelectedStudio,
    toggleProvider,
    reorderProviders,
    toggleGameStatus,
    toggleFeatured,
    toggleNew,
  } = useGameStore();

  // Category being edited from the Marketing tab's "Edit Category" button.
  const [editCategory, setEditCategory] = useState<{ id: string; name: string } | null>(null);

  /* =========================
     DEEP LINK FROM GLOBAL SEARCH
     ?provider=all&search=<game name> — the catalogue has no per-game route, so
     a game hit from the header search opens the cross-provider view with the
     name already in its search box.
  ========================= */
  const deepLinkProvider = useDeepLinkParam("provider");
  const deepLinkSearch = useDeepLinkParam("search");
  // Applied once per distinct link. Without this, "Back" out of the detailed
  // view would be undone by the effect re-selecting the provider on the very
  // next render — while a *new* link still takes effect.
  const appliedLink = useRef<string | null>(null);

  useEffect(() => {
    if (!deepLinkProvider) return;
    const link = `${deepLinkProvider}:${deepLinkSearch ?? ""}`;
    if (appliedLink.current === link) return;
    appliedLink.current = link;
    setViewMode("category");
    setSelectedProviderId(deepLinkProvider);
  }, [deepLinkProvider, deepLinkSearch, setSelectedProviderId, setViewMode]);

  // Only while the deep-linked view is the one on screen: once the admin backs
  // out and opens another provider, the preloaded search must not come back.
  const deepLinkedSearch =
    deepLinkSearch && selectedProviderId === deepLinkProvider
      ? deepLinkSearch
      : undefined;

  // One lightweight overview fetch (provider + category summaries) on load.
  useEffect(() => {
    fetchOverview().catch(() => toast.error("Failed to fetch games data"));
  }, [fetchOverview]);

  // Provider view loads the studio registry only when it's opened. The All
  // Games view needs it too, for its Provider filter.
  useEffect(() => {
    if (viewMode === "provider" || viewMode === "all") {
      fetchProviders().catch(() => toast.error("Failed to fetch providers"));
    }
  }, [viewMode, fetchProviders]);

  // Marketing tab mirrors the real categories (collections) managed in
  // Settings → Home & Menus → Categories — a read-only preview here.
  useEffect(() => {
    if (selectedProviderTab === "marketing") {
      fetchMarketingCategories().catch(() => toast.error("Failed to fetch categories"));
      // Trending Now is a builtin home row, not a collection, so it does not
      // come back with the collections above — it is fetched on its own.
      fetchTrendingGames().catch(() => toast.error("Failed to fetch trending games"));
    }
  }, [selectedProviderTab, fetchMarketingCategories, fetchTrendingGames]);

  const catIdByName = useCallback(
    (name: string) => categories.find((c) => c.name === name)?.id ?? name,
    [categories]
  );

  // Aggregator tabs (the technical `provider`: aleaplay / sagames / wulfcasino).
  const uniqueProviders = useMemo(() => {
    const set = new Set(summary.map((p) => p.provider));
    set.add("wulfcasino");
    return Array.from(set).sort();
  }, [summary]);

  // When an aggregator tab is selected, show ONLY that aggregator's games,
  // grouped by category (e.g. Sagames → only SA Games' Live Dealers).
  const aggregatorOverview = useMemo<GameProvider[]>(() => {
    const entry = summary.find((p) => p.provider === selectedProviderTab);
    if (!entry) return [];
    return [
      {
        id: entry.provider,
        name: entry.provider,
        totalGames: entry.totalGames,
        categories: entry.categories
          .map((c) => ({
            id: catIdByName(c.name),
            name: c.name,
            count: c.count,
            isActive: true,
            items: c.items.map((it) => ({
              id: it.id,
              name: it.name,
              isActive: it.enabled,
              isFeatured: it.isFeatured,
              isNew: it.isNew,
              totalPlays: it.totalPlays,
              displayOrder: it.displayOrder,
              thumbnail: it.thumbnail,
              rtp: it.rtp,
            })),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      },
    ];
  }, [summary, selectedProviderTab, catIdByName]);

  // Build the MERGED, category-first overview: one section per category combining
  // every provider/aggregator (so "Live Dealers" is one section, not split by
  // Aleaplay/Sagames). Rendered as a single pseudo-provider so the existing
  // category list UI is reused.
  const categoryOverview = useMemo<GameProvider[]>(() => {
    if (categoriesSummary.length === 0) return [];
    return [
      {
        id: "all",
        name: "All Providers",
        totalGames: categoriesSummary.reduce((acc, c) => acc + c.count, 0),
        categories: categoriesSummary.map((c) => ({
          id: catIdByName(c.name),
          name: c.name,
          count: c.count,
          isActive: true,
          items: c.items.map((it) => ({
            id: it.id,
            name: it.name,
            isActive: it.enabled,
            isFeatured: it.isFeatured,
            isNew: it.isNew,
            totalPlays: it.totalPlays,
            displayOrder: it.displayOrder,
            thumbnail: it.thumbnail,
            rtp: it.rtp,
          })),
        })),
      },
    ];
  }, [categoriesSummary, catIdByName]);

  // Marketing tab: the real categories (collections) + their games. Read-only
  // preview — they're created/edited in Settings → Home & Menus → Categories.
  const marketingProviders = useMemo<GameProvider[]>(() => {
    // True once the worker has scored anything in the window; until then every
    // score is 0 and `totalPlays` is the live tie-break doing the ordering.
    const windowRanked = trendingGames.some((g) => (g.popularityScore ?? 0) > 0);

    const toItems = (games: typeof trendingGames) =>
      games.map((g) => ({
        id: g.id,
        name: g.name,
        isActive: g.enabled,
        isFeatured: g.isFeatured,
        isNew: g.isNew,
        totalPlays: g.totalPlays,
        totalLaunches: g.totalLaunches,
        displayOrder: g.displayOrder,
        thumbnail: g.thumbnail,
        rtp: g.rtp,
      }));

    const categoriesView = marketingCategories.map((c) => ({
      id: c.id,
      name: c.name,
      count: c.gameCount ?? c.games.length,
      isActive: c.enabled,
      readOnly: true,
      items: toItems(c.games),
    }));

    // The home page's Trending Now rail. It is ranked by play activity rather
    // than hand-picked, so there is no category editor behind it — the header
    // carries its size control instead. The list runs PAST the live cut-off on
    // purpose: switching a live game off promotes the next one, and that is only
    // an informed decision if the admin can see who is waiting.
    const trendingView =
      trendingGames.length > 0
        ? [
            {
              id: "trending_builtin",
              name: "Trending Now",
              count: Math.min(trendingLimit, trendingGames.length),
              isActive: true,
              readOnly: true,
              autoCurated: true,
              headerAction: <TrendingLimitControl />,
              items: toItems(trendingGames).map((item, idx) => ({
                ...item,
                rank: idx + 1,
                queued: idx >= trendingLimit,
                // Show the number that produced this position. While every score
                // is still 0 (worker has not scored the window yet) the order
                // falls back to lifetime plays, so the card does too — either
                // way the counts read downward with the ranking.
                trendingScore: windowRanked
                  ? trendingGames[idx]?.popularityScore ?? 0
                  : undefined,
              })),
            },
          ]
        : [];

    const totalGames =
      marketingCategories.reduce((acc, c) => acc + (c.gameCount ?? c.games.length), 0) +
      Math.min(trendingLimit, trendingGames.length);
    return [
      {
        id: "marketing_virtual",
        name: "Marketing Management",
        totalGames,
        categories: [...trendingView, ...categoriesView],
      },
    ];
  }, [marketingCategories, trendingGames, trendingLimit]);

  // Category options for the detailed view. The merged ("all") view spans every
  // category; a specific provider drill-down uses that provider's categories.
  const detailCategoryOptions = useMemo(() => {
    if (selectedProviderId === "all") return categoriesSummary.map((c) => c.name);
    const entry = summary.find((p) => p.provider === selectedProviderId);
    return entry ? entry.categories.map((c) => c.name) : [];
  }, [summary, categoriesSummary, selectedProviderId]);

  // A studio spans every category, so offer the full category list when drilling
  // into a provider (studio).
  const studioCategoryOptions = useMemo(
    () => categories.map((c) => c.name),
    [categories]
  );

  const handleToggleProvider = async (id: string, value: boolean) => {
    try {
      await toggleProvider(id, value);
      toast.success(value ? "Provider enabled" : "Provider disabled — its games are now hidden from players");
    } catch {
      toast.error("Failed to update provider");
    }
  };

  const handleReorderProviders = async (ordered: typeof providers) => {
    try {
      await reorderProviders(ordered);
    } catch {
      toast.error("Failed to save provider order");
    }
  };

  const handleStudioFetch = useCallback(
    ({ category, search, page }: { category: string; search: string; page: number }) => {
      if (!selectedStudio) return;
      fetchProviderGames({
        studio: selectedStudio,
        category,
        search,
        page,
      }).catch(() => toast.error("Failed to fetch games"));
    },
    [fetchProviderGames, selectedStudio]
  );

  // Move ONE game to an absolute position. The whole section is resolved on the
  // server, so this works from a filtered grid where the client can only see the
  // search matches — the games it cannot see keep their places.
  const handleMoveStudioGame = useCallback(
    async (gameId: string, position: number, category?: string) => {
      if (!selectedStudio) return;
      await moveGamePosition({ studio: selectedStudio, gameId, position, category });
    },
    [selectedStudio]
  );

  const handleMoveProviderGame = useCallback(
    async (gameId: string, position: number, category?: string) => {
      if (!selectedProviderId) return;
      await moveGamePosition({
        // "all" is the merged cross-provider view — the category alone is the scope.
        provider: selectedProviderId === "all" ? undefined : String(selectedProviderId),
        gameId,
        position,
        category,
      });
    },
    [selectedProviderId]
  );

  // Persist a whole page of reordered games in one shot. Normalize first so the
  // provider/studio has a clean 1..N baseline (displayOrder defaults to 0), then
  // bulk-write the new positions for the edited page.
  const handleBulkReorderStudio = useCallback(
    async (updates: { id: string; displayOrder: number }[]) => {
      if (!selectedStudio) return;
      await normalizeGameOrder({ studio: selectedStudio });
      await bulkUpdateGameOrder(updates);
    },
    [selectedStudio]
  );

  const handleBulkReorderProvider = useCallback(
    async (updates: { id: string; displayOrder: number }[]) => {
      if (!selectedProviderId) return;
      await normalizeGameOrder({ provider: String(selectedProviderId) });
      await bulkUpdateGameOrder(updates);
    },
    [selectedProviderId]
  );

  // Persist a single category section's order. Positions are scoped to (game,
  // category) so reordering one section never shifts another — and the player
  // carousel for that category mirrors exactly this order.
  const handleSaveCategoryOrder = useCallback(
    async (category: string, updates: { gameId: string; position: number }[]) => {
      await bulkUpdateCategoryOrder({ category, updates });
    },
    []
  );

  const handleToggle = async (
    _providerId: string | number,
    _categoryId: string | number,
    itemId: string | number,
    value: boolean
  ) => {
    try {
      await toggleGameStatus(itemId, value);
      toast.success("Game status updated");
    } catch (err) {
      toast.error("Failed to update game status");
      // Rethrow so the card can revert its optimistic switch state.
      throw err;
    }
  };

  const handleToggleFeatured = async (
    _providerId: string | number,
    _categoryId: string | number,
    itemId: string | number,
    value: boolean
  ) => {
    try {
      await toggleFeatured(itemId, value);
      toast.success(value ? "Game added to Featured" : "Game removed from Featured");
    } catch {
      toast.error("Failed to update featured status");
    }
  };

  const handleToggleNew = async (
    _providerId: string | number,
    _categoryId: string | number,
    itemId: string | number,
    value: boolean
  ) => {
    try {
      await toggleNew(itemId, value);
      toast.success(value ? "Game marked as New Release" : "Game removed from New Release");
    } catch {
      toast.error("Failed to update new release status");
    }
  };

  const handleDetailFetch = useCallback(
    ({ category, search, page }: { category: string; search: string; page: number }) => {
      // "all" = the merged category view (every provider); otherwise scope to the
      // selected aggregator.
      const crossProvider = selectedProviderId === "all";
      fetchProviderGames({
        provider: crossProvider ? undefined : String(selectedProviderId),
        category,
        search,
        page,
      }).catch(() => toast.error("Failed to fetch games"));
    },
    [fetchProviderGames, selectedProviderId]
  );

  return (
    <div className="flex-1 flex flex-col bg-[#15181E] p-2 md:p-6 focus:outline-none overflow-hidden min-w-0">
      <GameListingHeader
        onRefresh={fetchOverview}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        // The settings panel lives in the category view, so opening it from the
        // header has to switch back to that view as well as select the pane.
        onOpenSettings={() => {
          setViewMode("category");
          setSelectedProviderTab("settings");
        }}
        settingsActive={viewMode === "category" && selectedProviderTab === "settings"}
      />

      {/* Category view tabs: merged "All Games" + Marketing + the aggregators. */}
      {viewMode === "category" && (
        <div className="mt-4 flex items-center justify-between gap-3 flex-wrap w-full max-w-full overflow-hidden">
          <Tabs defaultValue="all" value={selectedProviderTab} onValueChange={setSelectedProviderTab} className="w-full max-w-full">
            <TabsList className="bg-[#15181E] border border-gray-800/50 p-1 justify-start overflow-x-auto scrollbar-hide w-full max-w-full">
              <TabsTrigger
                value="all"
                className="data-[state=active]:bg-[#B93DEB] data-[state=active]:text-white text-gray-400 text-sm py-1 px-4 rounded-md transition-all whitespace-nowrap"
              >
                All Games
              </TabsTrigger>
              <TabsTrigger
                value="marketing"
                className="data-[state=active]:bg-[#B93DEB] data-[state=active]:text-white text-gray-400 text-sm py-1 px-4 rounded-md transition-all whitespace-nowrap"
              >
                Marketing
              </TabsTrigger>
              <TabsTrigger
                value="live-casino"
                className="data-[state=active]:bg-[#B93DEB] data-[state=active]:text-white text-gray-400 text-sm py-1 px-4 rounded-md transition-all whitespace-nowrap"
              >
                Live Casino Categories
              </TabsTrigger>
              {uniqueProviders.map((provider) => (
                <TabsTrigger
                  key={provider}
                  value={provider}
                  className="data-[state=active]:bg-[#B93DEB] data-[state=active]:text-white text-gray-400 text-sm py-1 px-4 rounded-md transition-all whitespace-nowrap"
                >
                  {provider.charAt(0).toUpperCase() + provider.slice(1)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      <div className="flex-1 scrollbar-hide overflow-auto mt-4">
        {viewMode === "all" ? (
          <AllGamesView onToggle={handleToggle} />
        ) : viewMode === "provider" ? (
          selectedStudio ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 h-full">
              <DetailedProviderView
                providerId={selectedStudio}
                providerName={selectedStudio}
                categoryOptions={studioCategoryOptions}
                games={detailGames}
                meta={detailMeta}
                loading={detailLoading}
                initialCategory={selectedCategory}
                onBack={() => {
                  setSelectedStudio(null);
                  setSelectedCategory("");
                }}
                onFetch={handleStudioFetch}
                onToggle={handleToggle}
                onToggleFeatured={handleToggleFeatured}
                onToggleNew={handleToggleNew}
                onMove={handleMoveStudioGame}
                onBulkReorder={handleBulkReorderStudio}
                onSaveCategoryOrder={handleSaveCategoryOrder}
              />
            </div>
          ) : (
            <ProviderGridView
              providers={providers}
              loading={providersLoading && providers.length === 0}
              onToggle={handleToggleProvider}
              onReorder={handleReorderProviders}
              onOpen={(studioName) => setSelectedStudio(studioName)}
            />
          )
        ) : loading && !selectedProviderId && selectedProviderTab !== "settings" ? (
          // Settings is excluded: it shows sync controls, not the game overview,
          // so it must not sit behind the catalogue's loading skeleton — which
          // is exactly the state an admin is in when they come here to find out
          // why the catalogue looks wrong.
          <OverviewSkeleton />
        ) : selectedProviderId ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 h-full">
            <DetailedProviderView
              // Remount when the deep link changes so a second game search from
              // the header replaces the preloaded term instead of being ignored.
              key={`${selectedProviderId}:${deepLinkedSearch ?? ""}`}
              providerId={selectedProviderId}
              providerName={selectedProviderId === "all" ? "All Providers" : String(selectedProviderId)}
              categoryOptions={detailCategoryOptions}
              games={detailGames}
              meta={detailMeta}
              loading={detailLoading}
              initialCategory={selectedCategory}
              initialSearch={deepLinkedSearch}
              onBack={() => {
                setSelectedProviderId(null);
                setSelectedCategory("");
              }}
              onFetch={handleDetailFetch}
              onToggle={handleToggle}
              onToggleFeatured={handleToggleFeatured}
              onToggleNew={handleToggleNew}
              onMove={handleMoveProviderGame}
              onBulkReorder={handleBulkReorderProvider}
              onSaveCategoryOrder={handleSaveCategoryOrder}
            />
          </div>
        ) : selectedProviderTab === "settings" ? (
          <SyncSettingsPanel />
        ) : selectedProviderTab === "live-casino" ? (
          // The tabs of the home page's Social Live Casino section, and the games
          // inside each. Lives here rather than under Settings because it is game
          // curation, and the games it arranges come from this same catalogue.
          <LiveCasinoTabsManager />
        ) : selectedProviderTab === "marketing" ? (
          <>
            {/* Read-only preview of the real categories. Create / edit / reorder
                them in Settings → Home & Menus → Categories. */}
            {marketingLoading || trendingLoading ? (
              <GameGridSkeleton count={18} />
            ) : marketingProviders[0].categories.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[200px] gap-2">
                <NoData title="No categories yet" />
                <p className="text-[11px] text-gray-500">
                  Create them in Settings → Home &amp; Menus → Categories.
                </p>
              </div>
            ) : (
              <>
                <GameProviderList
                  providers={marketingProviders}
                  onToggle={handleToggle}
                  onToggleFeatured={handleToggleFeatured}
                  onToggleNew={handleToggleNew}
                    onViewAll={() => {}}
                  onViewCategory={() => {}}
                  onEditCategory={(categoryId, categoryName) =>
                    setEditCategory({ id: String(categoryId), name: String(categoryName) })
                  }
                />
              </>
            )}
          </>
        ) : selectedProviderTab !== "all" ? (
          // Aggregator tab (Aleaplay / Sagames / Wulfcasino) — only that
          // aggregator's games, grouped by category. "View All" stays scoped to
          // this aggregator (e.g. Sagames → only SA Games' Live Dealers).
          aggregatorOverview.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
              <NoData title={`No games found for ${selectedProviderTab}`} />
            </div>
          ) : (
            <GameProviderList
              providers={aggregatorOverview}
              onToggle={handleToggle}
              onToggleFeatured={handleToggleFeatured}
              onToggleNew={handleToggleNew}
              onViewAll={() => {
                setSelectedProviderId(selectedProviderTab);
                setSelectedCategory("");
              }}
              onViewCategory={(_providerId, categoryName) => {
                setSelectedProviderId(selectedProviderTab);
                setSelectedCategory(categoryName);
              }}
            />
          )
        ) : categoryOverview.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
            <NoData title="No games found" />
          </div>
        ) : (
          <GameProviderList
            providers={categoryOverview}
            onToggle={handleToggle}
            onToggleFeatured={handleToggleFeatured}
            onToggleNew={handleToggleNew}
            // Provider-level "View All" → the merged category view (all categories).
            onViewAll={() => {
              setSelectedProviderId("all");
              setSelectedCategory("");
            }}
            // Category "View All" → that category, merged across every provider.
            onViewCategory={(_providerId, categoryName) => {
              setSelectedProviderId("all");
              setSelectedCategory(categoryName);
            }}
          />
        )}
      </div>

      {/* Edit a category from the Marketing tab (mirrors the Categories tab) */}
      <CollectionModal
        isOpen={!!editCategory}
        onClose={() => setEditCategory(null)}
        collection={editCategory ? ({ id: editCategory.id, name: editCategory.name } as GameCollection) : null}
        onSaved={fetchMarketingCategories}
      />
    </div>
  );
}
