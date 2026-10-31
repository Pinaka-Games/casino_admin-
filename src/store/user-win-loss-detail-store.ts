import { create } from "zustand";
import api from "@/api/config/axios.config";
import { GameReportRow, GameReportResponse, ReportCurrency, REPORT_TIMEOUT_MS } from "@/api/reports/reports";
import { format } from "date-fns";
import { ExportLimitError } from "@/components/ExportCSV";

export interface GameReportFilters {
  status: string;
  provider: string;
  startDate?: Date;
  endDate?: Date;
  result: "all" | "win" | "loss";
  // Promotional free spin rows: show all, only them, or everything else.
  freeSpin: "all" | "only" | "exclude";
  gameType: string;
  // Player lookup, server-side: matches user id, username or email/phone.
  player?: string;
  // Numeric range filters (client-side, applied to the loaded rows).
  betMin?: number;
  betMax?: number;
  winMin?: number;
  winMax?: number;
  ggrMin?: number;
  ggrMax?: number;
}

interface UserWinLossDetailState {
  reportData: GameReportRow[];
  isLoading: boolean;
  totals: {
    totalBetAmount: number;
    validBet: number;
    // Gross payout to players; the cards headline net win, but GGR is built
    // from this.
    totalPayout: number;
    totalWin: number;
    totalLose: number;
    ggr: number;
  };
  currentPage: number;
  totalCount: number;
  itemsPerPage: number;
  filters: GameReportFilters;
  filterOpen: boolean;
  openSlipModal: boolean;
  selectedSlip: any | null;
  providerOptions: string[];
  gameTypeOptions: string[];
  // Money bucket the report is scoped to. Defaults to real money (Wulf Cash).
  currency: ReportCurrency;
}

interface UserWinLossDetailActions {
  fetchReport: (page?: number, signal?: AbortSignal) => Promise<void>;
  fetchAllForExport: (range?: { from?: Date; to?: Date }) => Promise<GameReportRow[]>;
  setCurrentPage: (page: number) => void;
  setFilters: (filters: GameReportFilters) => void;
  setCurrency: (currency: ReportCurrency) => void;
  setFilterOpen: (open: boolean) => void;
  setOpenSlipModal: (open: boolean) => void;
  setSelectedSlip: (slip: any | null) => void;
  reset: () => void;
}

type UserWinLossDetailStore = UserWinLossDetailState & UserWinLossDetailActions;

const initialFilters: GameReportFilters = {
  status: "all",
  provider: "all",
  startDate: undefined,
  endDate: undefined,
  result: "all",
  freeSpin: "all",
  gameType: "all",
  player: "",
  betMin: undefined,
  betMax: undefined,
  winMin: undefined,
  winMax: undefined,
  ggrMin: undefined,
  ggrMax: undefined,
};

const initialState: UserWinLossDetailState = {
  reportData: [],
  isLoading: false,
  totals: {
    totalBetAmount: 0,
    validBet: 0,
    totalPayout: 0,
    totalWin: 0,
    totalLose: 0,
    ggr: 0,
  },
  currentPage: 1,
  totalCount: 0,
  itemsPerPage: 20,
  filters: initialFilters,
  filterOpen: false,
  openSlipModal: false,
  selectedSlip: null,
  providerOptions: [],
  gameTypeOptions: [],
  currency: "wulfCash",
};

export const useUserWinLossDetailStore = create<UserWinLossDetailStore>((set, get) => ({
  ...initialState,

  fetchReport: async (page, signal) => {
    const { currentPage, filters, itemsPerPage, currency } = get();
    const activePage = page ?? currentPage;
    set({ isLoading: true });

    try {
      const params = {
        startDate: filters.startDate
          ? format(filters.startDate, "yyyy-MM-dd")
          : undefined,
        endDate: filters.endDate
          ? format(filters.endDate, "yyyy-MM-dd")
          : undefined,
        provider: filters.provider !== 'all' ? filters.provider : undefined,
        category: filters.gameType !== 'all' ? filters.gameType : undefined,
        userStatus: filters.status !== 'all' ? filters.status : undefined,
        result: filters.result !== 'all' ? filters.result : undefined,
        freeSpin: filters.freeSpin !== 'all' ? filters.freeSpin : undefined,
        player: filters.player?.trim() || undefined,
        currency,
        page: activePage,
        limit: itemsPerPage
      };

      const response = await api.get<GameReportResponse>("/reports/game-report", { 
        params,
        signal,
        timeout: REPORT_TIMEOUT_MS,
      });

      const data = response.data.items || [];
      // Only surface SA Gaming providers in the filter — aleaplay is intentionally
      // excluded from the provider list.
      const providers = Array.from(new Set(data.map((r) => r.gameProvider)))
        .filter(Boolean)
        .filter((p) => !/aleaplay/i.test(p))
        .sort() as string[];
      const gameTypes = Array.from(new Set(data.map((r) => r.gameType)))
        .filter(Boolean)
        .sort() as string[];

      // Net win, net loss and GGR all arrive already bucketed per row by the API.
      // Deriving net win here as `max(0, payout - handle)` collapsed the whole
      // range into one signed figure, which made it equal to the loss card the
      // moment players were ahead and left the GGR card reading 0.
      const rawSummary = response.data.summary || initialState.totals;
      set({
        reportData: data,
        totalCount: response.data.total || 0,
        totals: rawSummary,
        providerOptions: providers,
        gameTypeOptions: gameTypes,
        isLoading: false,
      });
    } catch (error: any) {
      if (error.name === 'CanceledError' || error.name === 'AbortError') return;
      console.error("Failed to fetch game report:", error);
      // Drop the rows a FAILED fetch could not replace. Keeping them left the
      // previous population on screen under the new filters — a player search
      // that errored looked exactly like a search that had been ignored.
      set({
        isLoading: false,
        reportData: [],
        totalCount: 0,
        totals: initialState.totals,
      });
    }
  },

  fetchAllForExport: async (range) => {
    const { filters, currency } = get();
    /*
      Export used to pull the dataset 100 rows at a time and fire every
      remaining page AT ONCE. On a book this size that is hundreds of parallel
      requests: the browser queues them, the API sheds them, one rejects, and
      the catch below returned an empty array — so the button did nothing and
      the user was told there were no records.

      Bigger pages, a bounded number in flight, and a hard ceiling so one click
      can never hammer the API indefinitely.
    */
    const PAGE_LIMIT = 500;
    const MAX_PAGES = 40; // 20,000 rows
    const CONCURRENCY = 4;

    // The export popover's range goes to the SERVER. It used to be applied in
    // the browser to whatever had been fetched — which, with the row cap
    // below, was only the newest rows — so an older range came back short.
    // Narrowed to the report's own date filter where both are set.
    const latest = (a?: Date, b?: Date) => (a && b ? (a > b ? a : b) : a ?? b);
    const earliest = (a?: Date, b?: Date) => (a && b ? (a < b ? a : b) : a ?? b);
    const from = latest(filters.startDate, range?.from);
    const to = earliest(filters.endDate, range?.to);

    const baseParams = {
      startDate: from ? format(from, "yyyy-MM-dd") : undefined,
      endDate: to ? format(to, "yyyy-MM-dd") : undefined,
      provider: filters.provider !== "all" ? filters.provider : undefined,
      category: filters.gameType !== "all" ? filters.gameType : undefined,
      userStatus: filters.status !== "all" ? filters.status : undefined,
      result: filters.result !== "all" ? filters.result : undefined,
      freeSpin: filters.freeSpin !== "all" ? filters.freeSpin : undefined,
      player: filters.player?.trim() || undefined,
      currency,
      limit: PAGE_LIMIT,
    };

    const fetchPage = async (page: number) => {
      const res = await api.get<GameReportResponse>("/reports/game-report", {
        params: { ...baseParams, page },
        timeout: REPORT_TIMEOUT_MS,
      });
      return res.data;
    };

    // Errors propagate: the export button reports a failure, which is honest.
    // Returning [] here made a broken export look like an empty result set.
    const first = await fetchPage(1);
    const allItems: GameReportRow[] = [...(first.items || [])];
    const total = first.total || 0;
    // Refuse rather than truncate. Silently stopping at the cap produced a
    // sheet whose GGR could not match the report or the Dashboard (one week of
    // Wulf Cash on prod is ~300k rows), with nothing saying rows were missing.
    if (total > PAGE_LIMIT * MAX_PAGES) {
      throw new ExportLimitError(
        `This range has ${total.toLocaleString()} rows — the export limit is ${(PAGE_LIMIT * MAX_PAGES).toLocaleString()}. Please choose a shorter date range.`,
      );
    }
    const totalPages = Math.ceil(total / PAGE_LIMIT);

    for (let page = 2; page <= totalPages; page += CONCURRENCY) {
      const batch = Array.from(
        { length: Math.min(CONCURRENCY, totalPages - page + 1) },
        (_, i) => page + i,
      );
      const results = await Promise.all(batch.map(fetchPage));
      results.forEach((res) => allItems.push(...(res.items || [])));
    }

    return allItems;
  },

  // These only change state: the page's effect (keyed on page, filters and
  // currency) does the fetching. Fetching here as well sent every page click
  // and currency switch twice, on an endpoint slow enough that the doubled
  // traffic tripped the edge rate limit (429).
  setCurrentPage: (page) => {
    set({ currentPage: page });
  },

  setFilters: (filters) => {
    set({ filters, currentPage: 1 });
  },

  setCurrency: (currency) => {
    set({ currency, currentPage: 1 });
  },

  setFilterOpen: (open) => set({ filterOpen: open }),
  setOpenSlipModal: (open) => set({ openSlipModal: open }),
  setSelectedSlip: (slip) => set({ selectedSlip: slip }),

  reset: () => set(initialState),
}));
