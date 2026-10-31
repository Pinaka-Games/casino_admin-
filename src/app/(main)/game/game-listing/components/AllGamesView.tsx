"use client";

import { useEffect, useMemo } from "react";
import { Search, X } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Pagination from "@/components/Pagination";
import { useGameStore, AllGamesFilters } from "@/store/game-store";
import GameItem from "./Game-items";
import { GameGridSkeleton } from "./GameSkeletons";

// Radix Select cannot hold "" as an item value, so "no filter" needs a stand-in.
const ANY = "__any__";

// Short: a superseded request is aborted, so a quick pause costs little.
const SEARCH_DEBOUNCE_MS = 200;

interface Props {
  onToggle: (
    providerId: string | number,
    categoryId: string | number,
    itemId: string | number,
    value: boolean
  ) => Promise<void>;
}

const triggerClass =
  "h-9 w-full bg-[#1a2030] border-gray-800 text-sm text-gray-200 focus:ring-[#B93DEB] sm:w-auto sm:min-w-[150px]";

/**
 * Every game in one flat list, whatever its provider or category, so a game can
 * be found and switched on or off without first knowing where it lives.
 */
export default function AllGamesView({ onToggle }: Props) {
  const {
    allGames,
    allGamesMeta: meta,
    allGamesLoading: loading,
    allGamesFilters: filters,
    categories,
    providers,
    setAllGamesFilters,
    fetchAllGames,
  } = useGameStore();

  // Search is debounced so each keystroke is not a request; every other
  // filter, and paging, fetches straight away.
  const { search, filterBy, filterValue, status, sortBy, page } = filters;
  useEffect(() => {
    const t = setTimeout(
      () => fetchAllGames().catch(() => toast.error("Failed to fetch games")),
      search ? SEARCH_DEBOUNCE_MS : 0,
    );
    return () => clearTimeout(t);
  }, [search, filterBy, filterValue, status, sortBy, page, fetchAllGames]);

  const valueOptions = useMemo(
    () =>
      filterBy === "category"
        ? categories.map((c) => ({ value: c.name, label: c.name }))
        : providers.map((p) => ({ value: p.name, label: `${p.name} (${p.gameCount})` })),
    [filterBy, categories, providers],
  );

  const start = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const end = Math.min(meta.page * meta.limit, meta.total);
  const hasFilters = !!(search || filterValue || status !== "all" || sortBy !== "default");

  return (
    <div className="flex flex-col h-full min-w-0 text-white">
      {/* ================= FILTER BAR ================= */}
      <div className="bg-[#191D24] px-3 py-3 rounded-t-xl border border-gray-800/50 grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap md:px-4 md:gap-3">
        {/* Searches every game across all providers and categories, narrowed by
            the filters beside it. */}
        <div className="relative group col-span-2 min-w-0 sm:col-auto sm:flex-1 sm:min-w-[220px] sm:max-w-sm">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#B93DEB] transition-colors"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setAllGamesFilters({ search: e.target.value })}
            // Enter skips the debounce wait.
            onKeyDown={(e) => {
              if (e.key === "Enter") fetchAllGames().catch(() => toast.error("Failed to fetch games"));
            }}
            placeholder="Search all games…"
            className="w-full h-9 rounded-md border border-gray-800 bg-[#1a2030] pl-9 pr-8 text-sm text-white placeholder:text-gray-500 outline-none focus:border-[#B93DEB] [&::-webkit-search-cancel-button]:hidden"
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setAllGamesFilters({ search: "" })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <span className="hidden text-[11px] font-medium uppercase tracking-wider text-gray-500 sm:inline">Filter by</span>
        <Select
          value={filterBy}
          onValueChange={(v) => setAllGamesFilters({ filterBy: v as AllGamesFilters["filterBy"] })}
        >
          <SelectTrigger className={triggerClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="category">Category</SelectItem>
            <SelectItem value="provider">Provider</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filterValue || ANY}
          onValueChange={(v) => setAllGamesFilters({ filterValue: v === ANY ? "" : v })}
        >
          <SelectTrigger className={`${triggerClass} sm:min-w-[200px]`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value={ANY}>
              {filterBy === "category" ? "All categories" : "All providers"}
            </SelectItem>
            {valueOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status}
          onValueChange={(v) => setAllGamesFilters({ status: v as AllGamesFilters["status"] })}
        >
          <SelectTrigger className={triggerClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active only</SelectItem>
            <SelectItem value="inactive">Inactive only</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={sortBy}
          onValueChange={(v) => setAllGamesFilters({ sortBy: v as AllGamesFilters["sortBy"] })}
        >
          <SelectTrigger className={triggerClass}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Display order</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
            <SelectItem value="popular">Most popular</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <button
            type="button"
            onClick={() =>
              setAllGamesFilters({
                search: "",
                filterValue: "",
                status: "all",
                sortBy: "default",
              })
            }
            className="text-xs text-gray-400 hover:text-[#B93DEB] transition-colors"
          >
            Clear filters
          </button>
        )}

        <span className="justify-self-center whitespace-nowrap px-2 py-0.5 bg-[#B93DEB]/20 text-[#B93DEB] text-[10px] font-bold rounded uppercase tracking-wider sm:ml-auto sm:justify-self-auto">
          {meta.total} Games
        </span>
      </div>

      {/* ================= GRID ================= */}
      <div className="flex-1 overflow-y-auto px-6 py-6 bg-[#15181E]/40 border-x border-gray-800/50">
        {loading && allGames.length === 0 ? (
          <GameGridSkeleton count={18} />
        ) : allGames.length > 0 ? (
          <div
            className={`grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-6 transition-opacity ${loading ? "opacity-50" : ""
              }`}
          >
            {allGames.map((g) => (
              <div key={g.id} className="flex flex-col gap-1 min-w-0">
                <GameItem
                  providerId={g.provider}
                  categoryId={g.category}
                  item={{
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
                  }}
                  onToggle={onToggle}
                />
                {/* Where the game lives — the whole point of a flat list is that
                    the grid no longer says it. */}
                <span className="truncate text-[10px] text-gray-500" title={`${g.studio ?? g.provider} · ${g.category}`}>
                  {g.studio ?? g.provider} · {g.category}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-gray-500">
            <Search size={48} className="mb-4 opacity-10" />
            <p className="text-sm">No games match these filters.</p>
          </div>
        )}
      </div>

      {/* ================= PAGINATION ================= */}
      {/* The count and the pager shared one row with 24px of padding, so on a
          phone the count was clipped mid-word and the pager had nothing left.
          They stack below `sm`, and the framing words go — "1–24 of 5496" says
          the same thing in the space available. */}
      <div className="shrink-0 bg-[#15181E] px-3 py-3 border border-gray-800/50 rounded-b-xl flex flex-col items-center gap-2 sm:flex-row sm:justify-between sm:px-6 sm:py-4">
        <div className="text-[11px] text-gray-500 font-medium whitespace-nowrap">
          <span className="hidden sm:inline">Showing </span>
          <span className="text-gray-300">{start}</span>
          <span className="hidden sm:inline"> to </span>
          <span className="sm:hidden">–</span>
          <span className="text-gray-300">{end}</span> of{" "}
          <span className="text-gray-300">{meta.total}</span>
          <span className="hidden sm:inline"> games</span>
        </div>
        {meta.totalPages > 1 && (
          <Pagination
            currentPage={meta.page}
            totalPages={meta.totalPages}
            onPageChange={(p) => setAllGamesFilters({ page: p })}
          />
        )}
      </div>
    </div>
  );
}
