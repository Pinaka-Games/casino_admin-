"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Filter, Gamepad2, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CurrencyToggle from "@/components/report/CurrencyToggle";
import ReportFilterDrawer from "@/components/report/ReportFilterDrawer";
import Pagination from "@/components/Pagination";
import { vipAdminApi, type VipTier } from "@/api/vip/vip";
import {
  DEFAULT_PERFORMANCE_FILTERS,
  PAGE_SIZE_OPTIONS,
  resolveActivePreset,
  usePlayerPerformanceStore,
} from "@/store/player-performance-store";
import { fmtCount } from "./components/columns";
import {
  DRAWER_DEFAULTS,
  FilterChips,
  buildChips,
  buildFilterFields,
  fromDrawerValues,
  toDrawerValues,
  uniqueTierNames,
} from "./components/filterConfig";
import ColumnsMenu, { useHiddenGroups } from "./components/ColumnsMenu";
import DataAsOf from "./components/DataAsOf";
import ErrorState from "./components/ErrorState";
import ExportMenu from "./components/ExportMenu";
import LeaderCards from "./components/LeaderCards";
import LoadingBar from "./components/LoadingBar";
import PerformanceTable, { playerPerformanceHref } from "./components/PerformanceTable";
import PresetTabs from "./components/PresetTabs";
import CustomDateButton from "./components/CustomDateButton";
import TotalsStrip from "./components/TotalsStrip";
import DevAccessGate from "@/components/guard/dev-access-gate";

const SEARCH_DEBOUNCE_MS = 400;
/** How often an open, visible page quietly re-reads its current view. */
const AUTO_REFRESH_MS = 30_000;

const inputClass =
  "h-9 rounded-lg border-white/10 bg-[#1A2030] pl-9 pr-8 text-sm text-gray-200 placeholder:text-gray-500 focus-visible:ring-0";

/**
 * Route entry point.
 *
 * The page is reached by typing /users/player-performance — it is deliberately
 * not in the sidebar — and stays behind the development passphrase, the same
 * one System Logs uses.
 */
export default function PlayerPerformanceRoute() {
  return (
    <DevAccessGate title="Player Performance">
      <PlayerPerformancePage />
    </DevAccessGate>
  );
}

function PlayerPerformancePage() {
  const router = useRouter();
  const {
    filters,
    search,
    sortBy,
    sortDir,
    preset,
    currency,
    page,
    limit,
    data,
    loading,
    error,
    updateError,
    refresh,
    setFilters,
    setSearch,
    setGame,
    clearAll,
    toggleSort,
    applyPreset,
    setCurrency,
    setPage,
    setLimit,
    prefetchPreset,
  } = usePlayerPerformanceStore();

  // The one mount fetch — served from the client cache when coming back from
  // a player. Everything after it is started by the store action that changed
  // the state, so nothing here refetches on a state change.
  useEffect(() => {
    void usePlayerPerformanceStore.getState().fetch("full");
    return () => usePlayerPerformanceStore.getState().cancel();
  }, []);

  // Keep an open page current: new rounds, deposits and redeems are read live
  // on the server, so a quiet re-ask every 30s (and on returning to the tab)
  // shows them without a click. Never while a load is running — that would
  // abort what the admin just asked for — and never for a hidden tab.
  useEffect(() => {
    const revalidate = () => {
      const s = usePlayerPerformanceStore.getState();
      if (document.visibilityState !== "visible" || s.loading) return;
      void s.fetch("background");
    };
    const timer = window.setInterval(revalidate, AUTO_REFRESH_MS);
    document.addEventListener("visibilitychange", revalidate);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", revalidate);
    };
  }, []);

  const [tiers, setTiers] = useState<VipTier[]>([]);
  useEffect(() => {
    let cancelled = false;
    vipAdminApi
      .getTiers()
      .then((res) => {
        if (!cancelled) setTiers(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => {
        // The drawer still works without tiers; it just can't offer the tier filter.
        console.error("Failed to load VIP tiers for Player Performance:", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const tierNames = useMemo(() => uniqueTierNames(tiers), [tiers]);

  // Live text; the store holds the debounced value the API was asked for.
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput, setSearch]);

  // Same for the game filter, which can also be cleared from its chip or the
  // drawer's Reset: follow the applied value when it changes elsewhere.
  const [gameInput, setGameInput] = useState(filters.game);
  const [appliedGame, setAppliedGame] = useState(filters.game);
  if (appliedGame !== filters.game) {
    setAppliedGame(filters.game);
    if (gameInput.trim() !== filters.game) setGameInput(filters.game);
  }
  useEffect(() => {
    const t = setTimeout(() => setGame(gameInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [gameInput, setGame]);

  const [filterOpen, setFilterOpen] = useState(false);
  const { hidden, setGroupHidden, showAll } = useHiddenGroups();

  const fields = useMemo(
    () => buildFilterFields(tierNames, currency, filters.tierName),
    [tierNames, currency, filters.tierName],
  );
  const chips = useMemo(() => buildChips(filters, currency), [filters, currency]);
  const activePreset = resolveActivePreset({ preset, sortBy, sortDir, filters });

  const openPlayer = (userId: string) => router.push(playerPerformanceHref(userId));

  // Skeletons only before the very first answer. After that nothing blanks:
  // what is on screen stays, dimmed while a request replaces it — everything
  // for a new query, only the rows for a page change (the summary covers
  // every matching player, so it cannot change with the page).
  const firstLoad = !data && !error;
  // Figures are formatted and labelled in the currency they were fetched in,
  // so rows still on screen during a currency switch never read as the other one.
  const shownCurrency = data?.currency ?? currency;
  const busy = loading !== null;
  const dimAll = !!data && loading === "full";
  const dimTable = !!data && (loading === "full" || loading === "page");

  const total = data?.total ?? 0;
  const firstRow = total === 0 ? 0 : (page - 1) * limit + 1;
  const lastRow = Math.min(page * limit, total);

  const clearEverything = () => {
    // The debounces then see "" === the store's value and do not fetch again.
    setSearchInput("");
    setGameInput("");
    clearAll();
  };

  const toolbar = (
    <div className="flex min-w-0 items-center gap-3">
      <PresetTabs
        active={activePreset}
        currency={currency}
        onSelect={applyPreset}
        onPrefetch={prefetchPreset}
      />
      <CustomDateButton
        value={{ datePreset: filters.datePreset, startDate: filters.startDate, endDate: filters.endDate }}
        onApply={(range) => setFilters({ ...filters, ...range })}
      />
      <ColumnsMenu hidden={hidden} onToggle={setGroupHidden} onShowAll={showAll} />
    </div>
  );

  return (
    <div className="h-full w-full min-w-0 overflow-y-auto overflow-x-hidden bg-[#15181E] scrollbar-hide">
      <LoadingBar active={busy} />

      <div className="min-w-0 space-y-5 p-4 sm:p-6">
        {/* HEADER */}
        <div className="flex flex-col gap-3 rounded-lg border border-[#242B35] bg-[#161A21] px-4 py-3 sm:px-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h1 className="font-mono text-base font-semibold text-white">Player Performance</h1>
            <DataAsOf value={data?.dataAsOf} loading={busy} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CurrencyToggle value={currency} onChange={setCurrency} />

            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setSearch(searchInput);
                }}
                placeholder="Email, phone, username or ID"
                aria-label="Search players"
                className={inputClass}
              />
              {searchInput && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setSearchInput("");
                    setSearch("");
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-500 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="relative w-full sm:w-44">
              <Gamepad2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={gameInput}
                onChange={(e) => setGameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setGame(gameInput);
                }}
                placeholder="Game played"
                aria-label="Only players who played a game whose name contains this, in the range"
                title="Only players who played a game whose name contains this, in the range"
                className={inputClass}
              />
              {gameInput && (
                <button
                  type="button"
                  aria-label="Clear game filter"
                  onClick={() => {
                    setGameInput("");
                    setGame("");
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-500 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFilterOpen(true)}
              className="h-9 gap-1.5 rounded-lg border-white/10 bg-[#1A2030] px-3 text-gray-300 hover:bg-[#252b3d] hover:text-white"
            >
              <Filter size={16} className="text-[#B93DEB]" />
              Filters
              {chips.length > 0 && (
                <span className="rounded-md bg-purple-500 px-1.5 py-0.5 text-[11px] leading-none text-white">
                  {chips.length}
                </span>
              )}
            </Button>

            <ExportMenu disabled={!data || total === 0} />

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={refresh}
              disabled={loading === "full"}
              title="Refresh — reload the latest figures"
              aria-label="Refresh"
              className="h-9 w-9 rounded-lg border-white/10 bg-[#1A2030] text-gray-300 hover:bg-[#252b3d] hover:text-white"
            >
              <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>

        <ReportFilterDrawer
          open={filterOpen}
          onOpenChange={setFilterOpen}
          title="Player Performance Filters"
          description="Every filter is applied on the server, across all players — not just the page on screen."
          fields={fields}
          values={toDrawerValues(filters)}
          defaults={DRAWER_DEFAULTS}
          onApply={(v) => setFilters(fromDrawerValues(v))}
        />

        <FilterChips
          chips={chips}
          onRemove={(chip) => setFilters(chip.clear(filters))}
          onClearAll={() => {
            setGameInput("");
            setFilters(DEFAULT_PERFORMANCE_FILTERS);
          }}
        />

        {error ? (
          <>
            {toolbar}
            <ErrorState message={error} onRetry={refresh} />
          </>
        ) : (
          <>
            <LeaderCards
              leaders={data?.summary.leaders ?? null}
              currency={shownCurrency}
              skeleton={firstLoad}
              dimmed={dimAll}
              onOpen={openPlayer}
            />

            <TotalsStrip summary={data?.summary ?? null} currency={shownCurrency} dimmed={dimAll} />

            {toolbar}

            {updateError && (
              <div
                role="status"
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-xs text-amber-300"
              >
                <span className="flex items-center gap-2">
                  <AlertTriangle size={14} className="shrink-0" />
                  Couldn&apos;t update these figures ({updateError}). Showing the last loaded results.
                </span>
                <button
                  type="button"
                  onClick={refresh}
                  className="rounded px-2 py-0.5 font-medium text-amber-200 underline-offset-2 hover:underline"
                >
                  Retry
                </button>
              </div>
            )}

            <PerformanceTable
              rows={data?.items ?? []}
              limit={limit}
              currency={shownCurrency}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={toggleSort}
              skeleton={firstLoad}
              dimmed={dimTable}
              hiddenGroups={hidden}
              onRowClick={openPlayer}
              emptyAction={
                chips.length > 0 || search ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={clearEverything}
                    className="border-gray-700 bg-[#242B35] text-white hover:bg-[#2f3743] hover:text-white"
                  >
                    Clear search and filters
                  </Button>
                ) : undefined
              }
            />

            {data && total > 0 && (
              <div className="flex flex-col gap-3 rounded-xl border border-[#242B35] bg-[#191D24] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500">
                  <span>
                    Showing {fmtCount(firstRow)}–{fmtCount(lastRow)} of {fmtCount(total)} players
                  </span>
                  <div className="flex items-center gap-2">
                    <span id="pp-page-size">Rows per page</span>
                    <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
                      <SelectTrigger
                        size="sm"
                        aria-labelledby="pp-page-size"
                        className="h-8 w-[72px] border-gray-700 bg-[#242B35] text-white"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-gray-700 bg-[#1a2030] text-white">
                        {PAGE_SIZE_OPTIONS.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {data.totalPages > 1 && (
                  <div className="max-w-full overflow-x-auto scrollbar-hide">
                    <Pagination currentPage={page} totalPages={data.totalPages} onPageChange={setPage} />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
