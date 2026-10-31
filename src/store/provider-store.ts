import { create } from "zustand";
import { reportsApi, ReportCurrency, WinLossReportRow } from "@/api/reports/reports";
import { getProviderGameCounts } from "@/api/games/games";

/** What a provider produced inside ONE money bucket. */
export interface ProviderBucketStats {
  totalVolume: number;
  totalWin: number;
  ggr: number;
}

/**
 * Which money bucket the overview is scoped to. "all" shows Wulf Cash and Wulf
 * Coins side by side — never added together, because a virtual coin wagered is
 * not a dollar wagered and summing them made Total Bet meaningless.
 */
export type ProviderCurrencyFilter = ReportCurrency;

export interface ProviderStats {
  id: string;
  name: string;
  totalGames: number;
  enabledGames: number;
  // The two buckets are tracked independently and NEVER summed.
  cash: ProviderBucketStats;
  coin: ProviderBucketStats;
  status: "active" | "maintenance" | "disabled";
  lastUpdated?: string;
}

interface ProviderStore {
  providers: ProviderStats[];
  isLoading: boolean;
  searchQuery: string;
  currency: ProviderCurrencyFilter;
  setSearchQuery: (query: string) => void;
  setCurrency: (currency: ProviderCurrencyFilter) => void;
  fetchProviders: (params?: { startDate?: string; endDate?: string }) => Promise<void>;
  updateProviderStatus: (id: string, status: ProviderStats["status"]) => Promise<void>;
}

const emptyBucket = (): ProviderBucketStats => ({
  totalVolume: 0,
  totalWin: 0,
  ggr: 0,
});

/**
 * The report is grouped by provider AND game category, so one provider can span
 * several rows — taking the first match under-reported every multi-category
 * provider. Sum them into one bucket per provider.
 */
const bucketByProvider = (rows: WinLossReportRow[]): Record<string, ProviderBucketStats> => {
  const map: Record<string, ProviderBucketStats> = {};
  (rows || []).forEach((row) => {
    const key = (row.provider || "").toLowerCase();
    if (!key) return;
    const bucket = (map[key] ??= emptyBucket());
    bucket.totalVolume += parseFloat(row.totalBet || "0") || 0;
    bucket.totalWin += parseFloat(row.totalWin || "0") || 0;
    bucket.ggr = bucket.totalVolume - bucket.totalWin;
  });
  return map;
};

/** Volume in the selected bucket — what the table sorts and ranks on. */
export const providerVolume = (
  provider: ProviderStats,
  currency: ProviderCurrencyFilter,
): number =>
  currency === "wulfCoin" ? provider.coin.totalVolume : provider.cash.totalVolume;

export const useProviderStore = create<ProviderStore>((set, get) => ({
  providers: [],
  isLoading: false,
  searchQuery: "",
  currency: "wulfCash",

  setSearchQuery: (query) => set({ searchQuery: query }),

  // Both buckets are already loaded, so switching the filter is a pure re-render
  // — no refetch, and no flash of stale numbers from the other currency.
  setCurrency: (currency) => set({ currency }),

  fetchProviders: async (params) => {
    set({ isLoading: true });
    try {
      // Game counts per provider (server-side GROUP BY — this used to download
      // the whole admin catalogue and count it here), plus win/loss ONCE PER
      // MONEY BUCKET: the unfiltered report combines Wulf Coin and Wulf Cash
      // into a single Total Bet, which is what made coin play look like cash
      // volume. All three are independent, so they run in parallel.
      const [counts, cashRes, coinRes] = await Promise.all([
        getProviderGameCounts(),
        reportsApi.getWinLossReport({ ...(params || {}), currency: "wulfCash" }),
        reportsApi.getWinLossReport({ ...(params || {}), currency: "wulfCoin" }),
      ]);
      const cashByProvider = bucketByProvider(cashRes.data);
      const coinByProvider = bucketByProvider(coinRes.data);

      const providerMap: Record<string, { total: number; enabled: number }> = {};
      counts.forEach((c) => {
        providerMap[c.provider] = { total: c.total, enabled: c.enabled };
      });

      // 4. Combine data
      const providers: ProviderStats[] = Object.keys(providerMap).map((name) => {
        const key = name.toLowerCase();

        return {
          id: name, // Using name as ID if no distinct ID is available
          name: name.charAt(0).toUpperCase() + name.slice(1),
          totalGames: providerMap[name].total,
          enabledGames: providerMap[name].enabled,
          cash: cashByProvider[key] ?? emptyBucket(),
          coin: coinByProvider[key] ?? emptyBucket(),
          status: "active", // Defaulting to active for now
        };
      });

      const currency = get().currency;
      set({
        providers: providers.sort(
          (a, b) => providerVolume(b, currency) - providerVolume(a, currency),
        ),
      });
    } catch (error) {
      console.error("Failed to fetch provider data", error);
    } finally {
      set({ isLoading: false });
    }
  },

  updateProviderStatus: async (id, status) => {
    // This would call a hypothetical PATCH /providers/:id endpoint
    // For now, we update local state
    set((state) => ({
      providers: state.providers.map((p) =>
        p.id === id ? { ...p, status } : p
      ),
    }));
  },
}));
