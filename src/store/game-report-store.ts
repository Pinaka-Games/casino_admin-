import { create } from "zustand";
import { reportsApi, ReportCurrency, GameAggregateRow } from "@/api/reports/reports";
import { getReportCatalogue, getThumbnailUrl, resolveRtp } from "@/api/games/games";
import { format } from "date-fns";

export interface GameReportFilters {
  provider: string;
  category: string;
  startDate?: Date;
  endDate?: Date;
}

export interface GameRow {
  id: string;
  gameName: string;
  provider: string;
  category: string;
  thumbnail: string | null;
  totalPlayers: number;
  betCounts: number;
  totalBet: number;
  totalWin: number;
  ggr: number;
  /**
   * RTP as the provider reports it, read off the games catalogue this report is
   * merged with — so it costs no extra request. Null for games with no published
   * RTP, and for played games the catalogue no longer carries.
   */
  rtp: number | null;
}

interface GameReportState {
  gameRows: GameRow[];
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  pageSize: number;
  filters: GameReportFilters;
  providerOptions: string[];
  categoryOptions: string[];
  filterOpen: boolean;
  // Money bucket the report is scoped to. Defaults to real money (Wulf Cash).
  currency: ReportCurrency;
  // The full game catalogue is currency/date-independent, so it is fetched once
  // and reused — switching the Cash/Coins tab only re-runs the (fast) report
  // query instead of the slow games/list call.
  cachedGames: Awaited<ReturnType<typeof getReportCatalogue>> | null;
}

interface GameReportActions {
  fetchReport: (filters?: GameReportFilters) => Promise<void>;
  fetchRowsForRange: (range: { from?: Date; to?: Date }) => Promise<GameRow[]>;
  setPage: (page: number) => void;
  setFilters: (filters: GameReportFilters) => void;
  setCurrency: (currency: ReportCurrency) => void;
  setFilterOpen: (open: boolean) => void;
  reset: () => void;
}

type GameReportStore = GameReportState & GameReportActions;

// Merge the API's per-game totals with the full games catalogue into the rows
// the table shows. Shared by the live report and the export-range refetch so
// both stay identical.
//
// The totals themselves are NOT computed here any more. They used to be summed
// from one page of the raw log endpoint, so once the log passed that page size
// the table was adding up a sliding window of the newest rows — the numbers
// moved on every refresh and never matched the daily report or the dashboard.
// The API now groups by game over the whole range; this only attaches the
// catalogue's name/thumbnail and keeps zero-activity games visible.
function buildGameRows(
  aggregates: GameAggregateRow[],
  allGames: Awaited<ReturnType<typeof getReportCatalogue>>,
): { gameRows: GameRow[]; providerOptions: string[]; categoryOptions: string[] } {
  const norm = (value: string) => (value || "").trim().toLowerCase();

  const statsMap = new Map<string, GameAggregateRow>();
  aggregates.forEach((row) => {
    statsMap.set(norm(row.gameKey || row.gameName || "unknown"), row);
  });

  /*
    Each aggregate attaches to exactly ONE catalogue row.

    The API groups by game NAME, so a title two providers both carry — or one
    the catalogue lists twice — comes back as a single aggregate. A plain
    `statsMap.get(key)` handed that same object to every matching catalogue
    entry, and since the cards sum the rows, its bet and win were counted once
    per duplicate. That is why this screen read a higher Total Bet Amount and a
    smaller loss than the User Win Loss Detail and Daily Report, which each take
    one flat SUM over the same logs.

    Pass 1 attaches provider-qualified matches, so the volume lands on the
    catalogue entry that actually served it. Pass 2 gives whatever is left to
    the first catalogue row bearing the name. Anything still unclaimed is a
    played game the catalogue does not carry, and is appended below.
  */
  const claimed = new Set<string>();
  const gameRows: GameRow[] = [];
  const rowKeys: (string | null)[] = [];

  allGames.forEach((g) => {
    const key = norm(g.name);
    const s = statsMap.get(key);
    const providerMatch = s && norm(s.provider) === norm(g.provider) && !claimed.has(key);
    if (providerMatch) claimed.add(key);

    rowKeys.push(providerMatch ? null : key);
    gameRows.push({
      id: g.id,
      gameName: g.name,
      provider: g.provider,
      category: g.category,
      thumbnail: getThumbnailUrl(g.thumbnail),
      rtp: resolveRtp(g),
      totalPlayers: providerMatch ? s!.totalPlayers : 0,
      betCounts: providerMatch ? s!.betCounts : 0,
      totalBet: providerMatch ? s!.totalBet : 0,
      totalWin: providerMatch ? s!.totalWin : 0,
      ggr: providerMatch ? s!.ggr : 0,
    });
  });

  // Pass 2 — aggregates whose provider matched no catalogue entry still belong
  // to the report; give each to the first row carrying its name.
  rowKeys.forEach((key, i) => {
    if (!key || claimed.has(key)) return;
    const s = statsMap.get(key);
    if (!s) return;
    claimed.add(key);
    gameRows[i] = {
      ...gameRows[i],
      totalPlayers: s.totalPlayers,
      betCounts: s.betCounts,
      totalBet: s.totalBet,
      totalWin: s.totalWin,
      ggr: s.ggr,
    };
  });

  // Played games the catalogue does not carry (renamed or delisted) still have
  // to be reported, otherwise their volume silently disappears from the totals.
  statsMap.forEach((s, key) => {
    if (!claimed.has(key)) {
      gameRows.push({
        id: key,
        gameName: s.gameName || key,
        provider: s.provider,
        category: s.category,
        thumbnail: null,
        // No catalogue row means no RTP to read.
        rtp: null,
        totalPlayers: s.totalPlayers,
        betCounts: s.betCounts,
        totalBet: s.totalBet,
        totalWin: s.totalWin,
        ggr: s.ggr,
      });
    }
  });

  // Games with bets first, then alphabetical
  gameRows.sort((a, b) => b.totalBet - a.totalBet || a.gameName.localeCompare(b.gameName));

  const providerOptions = Array.from(new Set(gameRows.map((g) => g.provider).filter(Boolean))).sort();
  const categoryOptions = Array.from(new Set(gameRows.map((g) => g.category).filter(Boolean))).sort();

  return { gameRows, providerOptions, categoryOptions };
}

const defaultFilters: GameReportFilters = {
  provider: "all",
  category: "all",
  startDate: undefined,
  endDate: undefined,
};

const initialState: GameReportState = {
  gameRows: [],
  isLoading: false,
  error: null,
  currentPage: 1,
  pageSize: 10,
  filters: defaultFilters,
  providerOptions: [],
  categoryOptions: [],
  filterOpen: false,
  currency: "wulfCash",
  cachedGames: null,
};

export const useGameReportStore = create<GameReportStore>((set, get) => ({
  ...initialState,

  fetchReport: async (filters) => {
    set({ isLoading: true, error: null, gameRows: [] });
    const activeFilters = filters ?? get().filters;

    const reportParams: Record<string, any> = { currency: get().currency };
    if (activeFilters.startDate) reportParams.startDate = format(activeFilters.startDate, "yyyy-MM-dd");
    if (activeFilters.endDate)   reportParams.endDate   = format(activeFilters.endDate,   "yyyy-MM-dd");

    // The report query is currency/date-specific; the games catalogue is not, so
    // reuse it once cached. On the first load both run in parallel; subsequent
    // currency/filter changes only re-run the report.
    const cachedGames = get().cachedGames;
    const [reportResult, gamesResult] = await Promise.allSettled([
      reportsApi.getGameReportAggregate(reportParams),
      cachedGames ? Promise.resolve(cachedGames) : getReportCatalogue(),
    ]);

    const aggregates = reportResult.status === "fulfilled" ? (reportResult.value.data?.items || []) : [];
    const allGames   = gamesResult.status  === "fulfilled" ? gamesResult.value : (cachedGames ?? []);
    if (!cachedGames && gamesResult.status === "fulfilled") {
      set({ cachedGames: gamesResult.value });
    }

    const { gameRows, providerOptions, categoryOptions } = buildGameRows(aggregates, allGames);

    set({
      gameRows,
      isLoading: false,
      currentPage: 1,
      providerOptions,
      categoryOptions,
      error: null,
    });
  },

  // Re-query + re-aggregate the report for an explicit date range, WITHOUT
  // touching page state — used by the export "range" popover (rows are per-game
  // aggregates with no per-row date, so the range must be applied server-side).
  fetchRowsForRange: async (range) => {
    const reportParams: Record<string, any> = { currency: get().currency };
    if (range.from) reportParams.startDate = format(range.from, "yyyy-MM-dd");
    if (range.to)   reportParams.endDate   = format(range.to,   "yyyy-MM-dd");

    const cachedGames = get().cachedGames;
    const [reportResult, gamesResult] = await Promise.allSettled([
      reportsApi.getGameReportAggregate(reportParams),
      cachedGames ? Promise.resolve(cachedGames) : getReportCatalogue(),
    ]);

    const aggregates = reportResult.status === "fulfilled" ? (reportResult.value.data?.items || []) : [];
    const allGames   = gamesResult.status  === "fulfilled" ? gamesResult.value : (cachedGames ?? []);
    if (!cachedGames && gamesResult.status === "fulfilled") {
      set({ cachedGames: gamesResult.value });
    }

    return buildGameRows(aggregates, allGames).gameRows;
  },

  setPage: (page) => set({ currentPage: page }),

  setFilters: (filters) => {
    set({ filters, currentPage: 1 });
    get().fetchReport(filters);
  },

  setCurrency: (currency) => {
    set({ currency, currentPage: 1 });
    get().fetchReport();
  },

  setFilterOpen: (open) => set({ filterOpen: open }),

  reset: () => set(initialState),
}));
