"use client";

import { coingold, coingreen } from "@/assets/icons";
import ExportCSV, { type ExportDateRange } from "@/components/ExportCSV/ExportCSV";
import CopyButton from "@/components/CopyButton";
import TableSkeleton from "@/components/TableSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import api from "@/api/config/axios.config";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Loader2,
} from "lucide-react";
import Pagination from "@/components/Pagination/Pagination";
import NoData from "@/components/NoData";
import RoundDetailModal, { type RoundDetail } from "@/components/game/RoundDetailModal";
import UserActivityTimeline, {
  USER_ACTIVITY_ANCHOR,
} from "./UserActivityTimeline";
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";
import FilterToolbar from "@/components/filters/FilterToolbar";
import EntityFilterSheet from "@/components/filters/EntityFilterSheet";
import { useEntityFilters } from "@/components/filters/useEntityFilters";
import {
  DEFAULT_GAME_HISTORY_SORT,
  GAME_HISTORY_DEFAULTS,
  GAME_HISTORY_FIELDS,
  GameHistorySort,
  GameHistorySortKey,
  appendGameHistorySort,
  buildGameHistoryParams,
} from "./gameHistoryFilters";

interface GameDisplayItem {
  id: string;
  title: string;
  image: string;
}

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return `${d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}, ${d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const EXPORT_CHUNK_SIZE = 500;
// Safety valve: 100 × 500 = 50k rounds.
const EXPORT_MAX_PAGES = 100;

/** A bet-history API row with the display values the table and export use. */
const toHistoryRow = (row: any) => ({
  ...row,
  coinType: row.playCurrency === 'wulfCoin' ? 'gold' : 'green',
  mappedBuyIn: Number(row.betAmount) || 0,
  mappedMultiplier: row.payoutMultiplier ? `${Number(row.payoutMultiplier).toFixed(2)}x` : '-',
  mappedProfitLoss: Number(row.profit) || 0,
  mappedTime: formatDateTime(row.createdAt),
  // OUR promotion paid this round (it carries a promoType).
  isFreeSpin: Boolean(row.isFreeSpin),
  // The GAME awarded this round — free-spins feature, retrigger, bonus round.
  // Costs nothing, but it is ordinary play on money already wagered, so it has
  // no grant and opens no rollover. Labelling it "Free Spin" sent support
  // hunting for a missing promotional rollover that was never owed.
  isFeatureRound: Boolean(row.isFeatureRound),
  // Wallet balance (in the round's currency) before its first leg and
  // after its last. Null on rounds logged without a snapshot.
  mappedBalanceBefore:
    row.balanceBefore == null ? null : Number(row.balanceBefore),
  mappedBalanceAfter:
    row.balanceAfter == null ? null : Number(row.balanceAfter),
});

const ActivityTab =({ username }: { username: string }) => {
  const [favoriteGames, setFavoriteGames] = useState<GameDisplayItem[]>([]);
  const [recentGames, setRecentGames] = useState<GameDisplayItem[]>([]);
  const [gameHistory, setGameHistory] = useState<any[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sort, setSort] = useState<GameHistorySort>(DEFAULT_GAME_HISTORY_SORT);
  // The round whose full detail is open. The list row already carries every
  // field it shows, so opening it costs no extra request.
  const [selectedRound, setSelectedRound] = useState<RoundDetail | null>(null);

  const [loading, setLoading] = useState(true);

  const {
    values: filters,
    setValues: setFilters,
    searchInput,
    setSearchInput,
    sheetOpen,
    setSheetOpen,
    chips,
    activeCount,
    hasAnyFilter,
    reset: resetFilters,
  } = useEntityFilters({
    fields: GAME_HISTORY_FIELDS,
    defaults: GAME_HISTORY_DEFAULTS,
  });

  // Any filter or sort change restarts paging — page 4 of the old result set is
  // meaningless against the new one.
  useEffect(() => {
    setHistoryPage(1);
  }, [filters, sort]);

  /** First click sorts high-to-low (the useful direction for money columns). */
  const toggleSort = (key: GameHistorySortKey) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "desc" ? "asc" : "desc" }
        : { key, dir: "desc" }
    );

  // Fetch Favorites & Recent (Once on mount)
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const userId = username;

        const [favRes, recentRes] = await Promise.allSettled([
          api.get(`/games/user/${userId}/favorites`),
          api.get(`/games/user/${userId}/recent`),
        ]);

        const getImageUrl = (g: any) => {
          if (typeof g.imageUrl === 'string' && g.imageUrl) return g.imageUrl;
          if (typeof g.thumbnail?.url === 'string') return g.thumbnail.url;
          if (g.thumbnail?.url?.s279x400) return g.thumbnail.url.s279x400;
          if (g.thumbnail?.url?.s300x200) return g.thumbnail.url.s300x200;
          if (g.thumbnail?.s279x400) return g.thumbnail.s279x400;
          return "/placeholder.png";
        };

        if (favRes.status === "fulfilled") {
          const mappedFavs = favRes.value.data.map((g: any) => ({
            id: g.id,
            title: g.name || g.gameName,
            image: getImageUrl(g),
          }));
          setFavoriteGames(mappedFavs);
        }

        if (recentRes.status === "fulfilled") {
          const mappedRecent = recentRes.value.data.map((g: any) => ({
            id: g.id,
            title: g.name || g.gameName,
            image: getImageUrl(g),
          }));
          setRecentGames(mappedRecent);
        }
      } catch (err) {
        console.error("Failed to fetch games data:", err);
      } finally {
        setLoading(false);
      }
    };

    if (username) fetchData();
  }, [username]);

  // Fetch Paginated Game History
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoadingHistory(true);

        // Presets are resolved backend side so every client agrees on where
        // "last 7 days" starts; a custom range sends explicit dates instead.
        const params = appendGameHistorySort(buildGameHistoryParams(filters), sort);
        params.append("page", String(historyPage));
        params.append("limit", "10");

        const res = await api.get(
          `/games/user/${username}/bet-history?${params.toString()}`
        );
        setGameHistory(res.data.rows || []);
        setHistoryTotalPages(res.data.pagination?.totalPages || 1);
        setHistoryTotal(res.data.pagination?.total || 0);
      } catch (err) {
        console.error("Failed to fetch game history:", err);
      } finally {
        setLoadingHistory(false);
      }
    };

    if (username) fetchHistory();
  }, [username, historyPage, filters, sort]);

  const gameHistoryWithCoin = useMemo(
    () => gameHistory.map(toHistoryRow),
    [gameHistory]
  );

  /**
   * The table holds one page of ten, so export re-reads the COMPLETE filtered,
   * sorted history from the server in chunks. A range picked in the export
   * popover overrides the filter sheet's time period.
   */
  const fetchAllHistory = async (range: ExportDateRange) => {
    const base = appendGameHistorySort(buildGameHistoryParams(filters), sort);
    if (range.from || range.to) {
      base.delete("range");
      base.delete("from");
      base.delete("to");
      if (range.from) base.append("from", range.from.toISOString());
      if (range.to) base.append("to", range.to.toISOString());
    }

    const all: any[] = [];
    for (let page = 1; page <= EXPORT_MAX_PAGES; page += 1) {
      const params = new URLSearchParams(base);
      params.append("page", String(page));
      params.append("limit", String(EXPORT_CHUNK_SIZE));
      const res = await api.get(
        `/games/user/${username}/bet-history?${params.toString()}`
      );
      const rows: any[] = res.data.rows || [];
      all.push(...rows);
      // A short page is the last page; the total guards against a server
      // that keeps handing back full ones.
      if (rows.length < EXPORT_CHUNK_SIZE) break;
      if (all.length >= (res.data.pagination?.total ?? Infinity)) break;
    }
    return all.map(toHistoryRow);
  };

  /** A history row as the shared round-detail view wants it. */
  const toRoundDetail = (row: any): RoundDetail => ({
    gameName: row.gameName || row.title || row.gameType || "Unknown Game",
    gameImage: row.gameMetadata?.imageUrl ?? null,
    gameId: row.gameId,
    gameType: row.gameType,
    provider: row.provider,
    hostName: row.hostName || row.studio,
    roundId: row.roundId,
    transactionId: row.transactionId || row.id,
    transactionType: row.transactionType,
    status: row.status,
    playedAt: row.createdAt,
    betAmount: row.mappedBuyIn,
    winAmount: Number(row.winAmount) || 0,
    profit: row.mappedProfitLoss,
    payoutMultiplier: Number(row.payoutMultiplier) || 0,
    // The list already resolved the round's currency into its coin colour.
    isCashPlay: row.coinType === "green",
    isFreeSpin: row.isFreeSpin,
    isFeatureRound: row.isFeatureRound,
    promoType: row.promoType,
    balanceBefore: row.mappedBalanceBefore,
    balanceAfter: row.mappedBalanceAfter,
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-40 bg-gray-700/40" />
        <div className="overflow-hidden rounded-lg border border-gray-800 bg-[#15181E]">
          <TableSkeleton rows={6} cols={6} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-hidden space-y-10">
      {/* ================= GAME HISTORY ================= */}
      <div>
        <FilterToolbar
          title="Game History"
          countLabel={
            loadingHistory
              ? undefined
              : `${historyTotal} ${historyTotal === 1 ? "round" : "rounds"}`
          }
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder="Search game, round or transaction id"
          activeCount={activeCount}
          chips={chips}
          hasAnyFilter={hasAnyFilter}
          onOpenFilters={() => setSheetOpen(true)}
          actions={
            <>
              {/* The activity timeline is the second table in this tab and sits
                  below the game grids, so on a busy account it is several
                  screens down with nothing up here saying it exists. */}
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  document
                    .getElementById(USER_ACTIVITY_ANCHOR)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className="shrink-0 cursor-pointer gap-2 border-gray-700 bg-[#242B35] text-white hover:bg-[#2f3743] hover:text-white"
              >
                <History size={16} className="text-[#B93DEB]" />
                View Activity Log
              </Button>

              <ExportCSV
              data={gameHistoryWithCoin}
              fileName="game_history.csv"
              headers={["ID", "Game", "Buy In", "Multiplier", "Profit / Loss", "Balance Before", "Balance After", "Time"]}
              fetchAll={fetchAllHistory}
              mapRow={(row) => [
                row.transactionId || row.id,
                row.gameName || row.gameType || "Unknown Game",
                row.isFreeSpin
                  ? "Free Spin"
                  : row.isFeatureRound
                    ? "Bonus Round"
                    : row.mappedBuyIn.toFixed(2),
                row.mappedMultiplier,
                row.mappedProfitLoss.toFixed(2),
                row.mappedBalanceBefore == null ? "-" : row.mappedBalanceBefore.toFixed(2),
                row.mappedBalanceAfter == null ? "-" : row.mappedBalanceAfter.toFixed(2),
                row.createdAt ? new Date(row.createdAt).toLocaleString() : "-",
              ]}
              />
            </>
          }
          onResetAll={resetFilters}
        />

        <div className="overflow-x-auto rounded-lg bg-[#15181E]">
          <table className="min-w-[1400px] w-full table-fixed">
            <thead className="bg-[#242B35]">
              <tr className="border-b border-gray-800">
                <th className="w-[22rem] px-4 py-3 text-center text-xs text-white">ID</th>
                <th className="px-4 py-3 text-center text-xs text-white">Game</th>
                <SortableHeader
                  label="Buy In"
                  sortKey="buyIn"
                  sort={sort}
                  onToggle={toggleSort}
                />
                <SortableHeader
                  label="Multiplier"
                  sortKey="multiplier"
                  sort={sort}
                  onToggle={toggleSort}
                />
                <SortableHeader
                  label="Profit / Loss"
                  sortKey="profit"
                  sort={sort}
                  onToggle={toggleSort}
                />
                <th className="px-4 py-3 text-center text-xs text-white">Balance Before</th>
                <th className="px-4 py-3 text-center text-xs text-white">Balance After</th>
                <SortableHeader
                  label="Time"
                  sortKey="time"
                  sort={sort}
                  onToggle={toggleSort}
                />
              </tr>
            </thead>
            <tbody>
              {loadingHistory ? (
                <tr>
                  <td colSpan={8} className="p-0">
                    <TableSkeleton rows={5} cols={8} />
                  </td>
                </tr>
              ) : gameHistoryWithCoin.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12">
                    <NoData
                      title={
                        hasAnyFilter
                          ? "No rounds match these filters"
                          : "No game history found"
                      }
                    />
                  </td>
                </tr>
              ) : (
                gameHistoryWithCoin.map((row: any, index: number) => (
                  <tr
                    key={`${row.transactionId || row.id}-${index}`}
                    role="button"
                    tabIndex={0}
                    title="View round details"
                    onClick={() => setSelectedRound(toRoundDetail(row))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedRound(toRoundDetail(row));
                      }
                    }}
                    className={`cursor-pointer hover:bg-[#1a2030] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#B93DEB] ${index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"}`}
                  >
                    <td className="px-4 py-4 text-xs text-gray-300">
                      <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                        <span className="font-mono">
                          {row.transactionId || row.id}
                        </span>
                        <CopyButton value={row.transactionId || row.id} />
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center text-xs text-gray-300">
                      {row.gameName || row.gameType || "Unknown Game"}
                    </td>
                    <td className="px-4 py-4 text-center text-xs font-medium text-gray-300">
                      {row.isFreeSpin ? (
                        <span
                          title={row.promoType ? `Promotional free spin (${row.promoType})` : "Promotional free spin"}
                          className="inline-block px-2 py-1 rounded-md bg-purple-500/15 text-purple-300 text-[11px] font-medium"
                        >
                          Free Spin
                        </span>
                      ) : row.isFeatureRound ? (
                        <span
                          title="The game awarded this round — free-spins feature, retrigger or bonus round. Not a promotional grant."
                          className="inline-block px-2 py-1 rounded-md bg-sky-500/15 text-sky-300 text-[11px] font-medium"
                        >
                          Bonus Round
                        </span>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <Image src={row.coinType === "green" ? coingreen : coingold} alt="coin" width={12} height={12} />
                          <span>{row.mappedBuyIn.toFixed(2)}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center text-xs text-gray-300">
                      {row.mappedMultiplier}
                    </td>
                    <td className={`px-4 py-4 text-center text-xs font-medium ${row.mappedProfitLoss >= 0 ? "text-green-400" : "text-red-400"}`}>
                      <div className="flex items-center justify-center gap-1">
                        <Image src={row.coinType === "green" ? coingreen : coingold} alt="coin" width={12} height={12} />
                        <span>{row.mappedProfitLoss >= 0 ? "+" : ""}{row.mappedProfitLoss.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center text-xs font-medium text-gray-300">
                      <BalanceValue value={row.mappedBalanceBefore} coinType={row.coinType} />
                    </td>
                    <td className="px-4 py-4 text-center text-xs font-medium text-gray-300">
                      <BalanceValue value={row.mappedBalanceAfter} coinType={row.coinType} />
                    </td>
                    <td className="px-4 py-4 text-center text-xs text-gray-300 whitespace-nowrap">
                      {row.mappedTime}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loadingHistory && historyTotalPages > 1 && (
          <div className="mt-4">
            <Pagination
              currentPage={historyPage}
              totalPages={historyTotalPages}
              onPageChange={setHistoryPage}
            />
          </div>
        )}
      </div>

      <div className="space-y-10 w-full">
        <Section title="Recently Played Games" data={recentGames} />
        <Section title="Favorites games" data={favoriteGames} />
      </div>

      {/* Last, because it is the widest net: the grids above answer "what do
          they play", this answers "what did they do, in what order". */}
      <div className="w-full pb-8">
        <UserActivityTimeline userId={username} />
      </div>

      <RoundDetailModal
        round={selectedRound}
        onClose={() => setSelectedRound(null)}
      />

      <EntityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Game History Filters"
        description="Filter this player's rounds by time, currency and amount"
        fields={GAME_HISTORY_FIELDS}
        values={filters}
        defaults={GAME_HISTORY_DEFAULTS}
        onApply={setFilters}
      />
    </div>
  );
};

export default ActivityTab;

/** A wallet balance in the round's currency, or a dash when none was logged. */
function BalanceValue({
  value,
  coinType,
}: {
  value: number | null;
  coinType: "gold" | "green";
}) {
  if (value == null || !Number.isFinite(value)) {
    return <span className="text-gray-500">-</span>;
  }
  return (
    <div className="flex items-center justify-center gap-1 whitespace-nowrap">
      <Image src={coinType === "green" ? coingreen : coingold} alt="coin" width={12} height={12} />
      <span>
        {value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}

/** A Game History column header that orders the whole history, not the page. */
function SortableHeader({
  label,
  sortKey,
  sort,
  onToggle,
}: {
  label: string;
  sortKey: GameHistorySortKey;
  sort: GameHistorySort;
  onToggle: (key: GameHistorySortKey) => void;
}) {
  const active = sort.key === sortKey;

  return (
    <th className="px-4 py-3 text-center text-xs text-white">
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        className="mx-auto flex items-center gap-1 hover:text-[#B93DEB] transition-colors"
      >
        {label}
        {!active && <ChevronsUpDown size={12} className="text-gray-400" />}
        {active && sort.dir === "desc" && (
          <ChevronDown size={12} className="text-[#B93DEB]" />
        )}
        {active && sort.dir === "asc" && (
          <ChevronUp size={12} className="text-[#B93DEB]" />
        )}
      </button>
    </th>
  );
}

function Section({ title, data }: { title: string; data: any[] }) {
  const [page, setPage] = useState(0);
  const itemsPerPage = 8;
  const totalPages = Math.ceil(data.length / itemsPerPage);

  const visibleData = useMemo(() => {
    const start = page * itemsPerPage;
    return data.slice(start, start + itemsPerPage);
  }, [page, data]);

  if (data.length === 0) {
    return (
      <div className="space-y-3 w-full">
        <h2 className="text-white/80 text-sm font-medium">{title}</h2>
        <div className="py-6">
          <NoData title="No games found" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 w-full">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h2 className="text-white/80 text-sm font-medium">{title}</h2>

        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="w-10 h-10 flex items-center justify-center bg-[#2A2F3A] rounded-[12px] hover:bg-[#353b49] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={20} className="text-[#9BA1B0]" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="w-10 h-10 flex items-center justify-center bg-[#2A2F3A] rounded-[12px] hover:bg-[#353b49] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={20} className="text-[#9BA1B0]" />
            </button>
          </div>
        )}
      </div>

      {/* GRID */}
      <div className="w-full">
        <div
          className="
            grid
            gap-1 sm:gap-2 md:gap-2
            grid-cols-[repeat(auto-fill,minmax(80px,1fr))]
            sm:grid-cols-[repeat(auto-fill,minmax(100px,1fr))]
            md:grid-cols-[repeat(auto-fill,minmax(110px,1fr))]
            lg:grid-cols-[repeat(auto-fill,minmax(130px,1fr))]
          "
        >
          {visibleData.map((game: any) => (
            <div
              key={game.id}
              className="
                bg-[#1A2027]
                rounded-xl
                overflow-hidden
                cursor-pointer
                transition-transform
                duration-300
                hover:-translate-y-1
              "
            >
              <div className="relative aspect-[3/4] w-full">
                <img
                  src={game.image}
                  alt={game.title}
                  className="w-full h-full object-cover absolute inset-0 rounded-xl"
                  onError={(e: any) => {
                    (e.target as HTMLImageElement).src =
                      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><rect fill="%23242B35" width="100%" height="100%"/><text fill="%23555" x="50%" y="50%" font-family="sans-serif" font-size="14" text-anchor="middle" dominant-baseline="middle">No Logo</text></svg>';
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
