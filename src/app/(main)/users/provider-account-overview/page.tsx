"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { coingold, coingreen } from "@/assets/icons";
import {
  useProviderStore,
  ProviderStats,
  ProviderCurrencyFilter,
  providerVolume,
} from "@/store/provider-store";
import CurrencyToggle from "@/components/report/CurrencyToggle";
import { useDashboardStore } from "@/store/dashboard-store";
import NoData from "@/components/NoData/NoData";
import { useRouter } from "next/navigation";
import { Building2, Gamepad2, TrendingUp, Activity, Search, RefreshCcw, ExternalLink, Settings2, CheckCircle2, AlertCircle, PauseCircle, ArrowUpRight, Target, Trophy, Filter } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { toast } from "react-hot-toast";
import ListSearch from "@/components/TableSearch/ListSearch";
import { Button } from "@/components/ui/button";
import ExportCSV from "@/components/ExportCSV";
import { ProviderFilterSheet, ProviderFilters } from "./components/provider-filter-sheet";

export default function ProviderAccountOverview() {
  const router = useRouter();
  const { fromDate, toDate, refreshKey, setRefreshKey } = useDashboardStore();
  const {
    providers,
    isLoading,
    fetchProviders,
    searchQuery,
    setSearchQuery,
    currency,
    setCurrency,
    updateProviderStatus,
  } = useProviderStore();

  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<ProviderFilters>({
    status: "all",
  });

  const showCash = currency !== "wulfCoin";
  const showCoin = currency !== "wulfCash";

  const filteredProviders = useMemo(() => {
    return providers
      .filter((p: ProviderStats) => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = filters.status === "all" || p.status === filters.status;
        return matchesSearch && matchesStatus;
      })
      // Ranking follows the selected bucket: under "Wulf Coins" the biggest coin
      // provider is the one that belongs on top, not the biggest cash earner.
      .sort((a, b) => providerVolume(b, currency) - providerVolume(a, currency));
  }, [providers, searchQuery, filters.status, currency]);

  // Totals per bucket. Never added together — a coin wagered is not a dollar
  // wagered, and summing them is exactly what made Total Bet unreadable.
  const totals = useMemo(
    () =>
      providers.reduce(
        (acc, p: ProviderStats) => ({
          games: acc.games + p.totalGames,
          cashBet: acc.cashBet + p.cash.totalVolume,
          coinBet: acc.coinBet + p.coin.totalVolume,
          cashWin: acc.cashWin + p.cash.totalWin,
          coinWin: acc.coinWin + p.coin.totalWin,
        }),
        { games: 0, cashBet: 0, coinBet: 0, cashWin: 0, coinWin: 0 },
      ),
    [providers],
  );

  const exportData = useMemo(() => {
    return filteredProviders.map((p: ProviderStats) => ({
      name: p.name,
      id: p.id,
      totalGames: p.totalGames,
      enabledGames: p.enabledGames,
      cashVolume: p.cash.totalVolume,
      cashGgr: p.cash.ggr,
      coinVolume: p.coin.totalVolume,
      coinGgr: p.coin.ggr,
      status: p.status,
    }));
  }, [filteredProviders]);

  useEffect(() => {
    const params = {
      startDate: fromDate?.toISOString(),
      endDate: toDate?.toISOString(),
    };
    fetchProviders(params);
  }, [fromDate, toDate, refreshKey, fetchProviders]);



  // Calculate Peak Provider — ranked inside the selected money bucket.
  const peakProvider =
    providers.length > 0
      ? providers.reduce((prev: ProviderStats, current: ProviderStats) =>
          providerVolume(prev, currency) > providerVolume(current, currency)
            ? prev
            : current,
        )
      : null;

  const handleStatusChange = async (
    providerId: string,
    newStatus: ProviderStats["status"],
  ) => {
    try {
      await updateProviderStatus(providerId, newStatus);
      toast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const StatCard = ({
    label,
    value,
    subtext,
    icon: Icon,
    color,
    trend,
    trendColor = "text-emerald-400",
  }: any) => (
    <div className="bg-[#191D24] border border-white/5 rounded-2xl p-4 md:p-6 relative overflow-hidden group transition-all hover:bg-[#1c2129]">
      <div className="flex justify-between items-start mb-2">
        <p className="text-[10px] uppercase tracking-[0.1em] text-white/50 font-bold">
          {label}
        </p>
        <div className="w-10 h-10 rounded-xl bg-[#242B35] flex items-center justify-center border border-white/5 shadow-inner">
          <Icon
            className={`w-5 h-5 text-${color === "amber" ? "amber-500" : color === "indigo" ? "indigo-400" : color === "sky" ? "sky-400" : "white/70"}`}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight tabular-nums">
          {value}
        </h3>
        {trend ? (
          <p className={`text-[11px] font-bold ${trendColor}`}>{trend}</p>
        ) : subtext ? (
          <p
            className={`text-[10px] font-medium uppercase tracking-wider ${subtext === "active" ? "text-emerald-500" : subtext === "player payouts" ? "text-rose-500" : "text-white/30"}`}
          >
            {subtext}
          </p>
        ) : null}
      </div>
    </div>
  );

  const fmtNum = (n: number) =>
    (Number.isFinite(n) ? n : 0).toLocaleString("en-US", {
      maximumFractionDigits: 2,
    });

  /**
   * One line per money bucket, each behind its own coin icon — green for Wulf
   * Cash (real money), gold for Wulf Coins (virtual). The two are shown side by
   * side and NEVER added: a coin wagered is not a dollar wagered, and the single
   * combined figure this page used to print made the number unusable.
   *
   * The currency toggle hides whichever bucket is not selected, so "Wulf Cash"
   * and "Wulf Coins" each read as a clean single number.
   */
  const MoneySplit = ({
    cash,
    coin,
    cashClass = "text-emerald-400",
    coinClass = "text-amber-500/90",
    size = "sm",
  }: {
    cash: number;
    coin: number;
    cashClass?: string;
    coinClass?: string;
    size?: "sm" | "lg";
  }) => {
    const icon = size === "lg" ? 16 : 12;
    const text = size === "lg" ? "text-2xl" : "text-xs";
    return (
      <div
        className={`flex ${size === "lg" ? "flex-col gap-1" : "flex-col gap-0.5 items-center"}`}
      >
        {showCash && (
          <span
            className={`flex items-center gap-1.5 font-bold tabular-nums ${text} ${cashClass}`}
            title="Wulf Cash (real money)"
          >
            <Image src={coingreen} alt="Wulf Cash" width={icon} height={icon} />
            {fmtNum(cash)}
          </span>
        )}
        {showCoin && (
          <span
            className={`flex items-center gap-1.5 font-bold tabular-nums ${text} ${coinClass}`}
            title="Wulf Coins (virtual)"
          >
            <Image src={coingold} alt="Wulf Coins" width={icon} height={icon} />
            {fmtNum(coin)}
          </span>
        )}
      </div>
    );
  };

  const StatusBadge = ({ status }: { status: ProviderStats["status"] }) => {
    const config = {
      active: {
        icon: CheckCircle2,
        text: "Active",
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/10",
      },
      maintenance: {
        icon: AlertCircle,
        text: "Maintenance",
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        border: "border-amber-500/10",
      },
      disabled: {
        icon: PauseCircle,
        text: "Disabled",
        color: "text-rose-400",
        bg: "bg-rose-500/10",
        border: "border-rose-500/10",
      },
    }[status] || {
      icon: CheckCircle2,
      text: status || "Active",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/10",
    };

    const Icon = config.icon;

    return (
      <div
        className={`flex items-center gap-2 px-3 py-1 rounded-full ${config.bg} ${config.border} border`}
      >
        <Icon className={`w-3 h-3 ${config.color}`} />
        <span
          className={`text-[9px] font-bold uppercase tracking-wider ${config.color}`}
        >
          {config.text}
        </span>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-[#15181E] p-3 md:p-6 focus:outline-none overflow-hidden min-w-0">
      {/* Header Container */}
      <div className="bg-[#191D24] mb-3 px-3 py-2 rounded-lg flex items-center justify-between border border-white/5 md:mb-6 md:px-5">
        <div className="flex items-center gap-4">
        
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              Provider Account Overview
            </h1>
           
          </div>
        </div>

        
      </div>


       {/* Stacked on a phone: search + export and the currency toggle side by
           side left the search box a few dozen pixels wide. */}
       <div className="bg-[#191D24] mb-3 rounded-xl p-2 flex flex-col items-stretch gap-2 shrink-0 border border-[#242B35] md:mb-6 md:flex-row md:items-center">
              <div className="flex-1 flex items-center gap-2">
                <ListSearch
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search providers ..."
                  showButton={false}
                />
      
                {/* <Button
                  variant="outline"
                  size="icon"
                  className="bg-[#1A2030] border-white/10 rounded-lg w-10 h-10 text-white hover:bg-[#252b3d] flex items-center justify-center shrink-0"
                  onClick={() => setFilterOpen(!filterOpen)}
                >
                  <Filter size={20} className="text-[#B93DEB]" />
                </Button> */}
      
                {/* The export keeps BOTH buckets in their own columns whatever
                    the toggle shows — a spreadsheet with one nameless "volume"
                    column is the same ambiguity this screen had. */}
                <ExportCSV
                  data={exportData}
                  fileName="provider_account_overview.csv"
                  headers={[
                    "Provider Name",
                    "API ID",
                    "Total Games",
                    "Active Games",
                    "Wulf Cash Volume",
                    "Wulf Cash GGR",
                    "Wulf Coin Volume",
                    "Wulf Coin GGR",
                    "Status",
                  ]}
                  mapRow={(row: any) => [
                    row.name,
                    row.id,
                    row.totalGames,
                    row.enabledGames,
                    row.cashVolume,
                    row.cashGgr,
                    row.coinVolume,
                    row.coinGgr,
                    row.status,
                  ]}
                />


              </div>

              {/* Which money the figures below are counting. Wulf Coin play used
                  to be added straight into Total Bet alongside real Wulf Cash,
                  so the page could not tell virtual volume from actual revenue. */}
              <CurrencyToggle
                value={currency}
                onChange={(value: ProviderCurrencyFilter) => setCurrency(value)}
                className="shrink-0"
              />
            </div>
      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3 md:mb-6">
        <StatCard
          label="Providers"
          value={providers.length}
          subtext="active"
          icon={Building2}
          color="indigo"
        />
        <StatCard
          className="text-white"
          label="Total Games"
          value={totals.games.toLocaleString()}
          trend="+18.7%"
          icon={Gamepad2}
          color="emerald"
        />
        <StatCard
          label="Total Bet Amount"
          value={
            <MoneySplit
              size="lg"
              cash={totals.cashBet}
              coin={totals.coinBet}
              cashClass="text-white"
              coinClass="text-white"
            />
          }
          subtext="all providers"
          icon={TrendingUp}
          color="sky"
        />
        <StatCard
          label="Total Win"
          value={
            <MoneySplit
              size="lg"
              cash={totals.cashWin}
              coin={totals.coinWin}
              cashClass="text-white"
              coinClass="text-white"
            />
          }
          subtext="player payouts"
          icon={Activity}
          color="amber"
        />
      </div>

      {/* Table Section */}
      <div className="flex-1 bg-[#191D24] border border-white/5 rounded-2xl overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-[#242B35]/50 border-b border-white/[0.03] sticky top-0 z-10">
                <th className="px-6 py-4 text-left text-[10px] font-bold text-white/30 uppercase tracking-widest">
                  Source Provider
                </th>
                <th className="px-6 py-4 text-center text-[10px] font-bold text-white/30 uppercase tracking-widest">
                  Game Inventory
                </th>
                <th className="px-6 py-4 text-center text-[10px] font-bold text-white/30 uppercase tracking-widest">
                  Total Volume
                </th>
                <th className="px-6 py-4 text-center text-[10px] font-bold text-white/30 uppercase tracking-widest">
                  Net Revenue (GGR)
                </th>
                <th className="px-6 py-4 text-center text-[10px] font-bold text-white/30 uppercase tracking-widest">
                  Current Status
                </th>
                <th className="px-6 py-4 text-right text-[10px] font-bold text-white/30 uppercase tracking-widest">
                  Management
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-8">
                      <div className="h-4 bg-white/5 rounded-lg w-full" />
                    </td>
                  </tr>
                ))
              ) : filteredProviders.length > 0 ? (
                filteredProviders.map((provider: ProviderStats) => (
                  <tr
                    key={provider.id}
                    className="hover:bg-white/[0.01] transition-colors"
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/5 flex items-center justify-center font-bold text-white/80 text-sm">
                          {provider.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white/90">
                            {provider.name}
                          </p>
                          <p className="text-[10px] text-white/20 font-medium uppercase tracking-tighter">
                            API: {provider.id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-bold text-white/80 tabular-nums">
                          {provider.enabledGames} / {provider.totalGames}
                        </span>
                        <div className="w-20 h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                          <div
                            className="h-full bg-[#B93DEB] rounded-full shadow-[0_0_8px_rgba(185,61,235,0.4)]"
                            style={{
                              width: `${(provider.enabledGames / provider.totalGames) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex justify-center">
                        <MoneySplit
                          cash={provider.cash.totalVolume}
                          coin={provider.coin.totalVolume}
                          cashClass="text-emerald-400"
                          coinClass="text-amber-500/90"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex justify-center">
                        <MoneySplit
                          cash={provider.cash.ggr}
                          coin={provider.coin.ggr}
                          cashClass={
                            provider.cash.ggr >= 0
                              ? "text-emerald-400"
                              : "text-rose-400"
                          }
                          coinClass={
                            provider.coin.ggr >= 0
                              ? "text-amber-500/90"
                              : "text-rose-400"
                          }
                        />
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex justify-center">
                        <StatusBadge status={provider.status} />
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-end gap-2">
                        {/* <button className="p-2 rounded-lg bg-white/5 border border-white/5 hover:border-[#B93DEB]/30 hover:bg-[#B93DEB]/10 transition-all text-white/40 hover:text-[#B93DEB]">
                           <Settings2 className="w-3.5 h-3.5" />
                         </button> */}
                        <button
                          onClick={() =>
                            router.push(
                              `/game/game-listing?provider=${provider.id}`,
                            )
                          }
                          className="p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/20 transition-all text-white/40 hover:text-white/80"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-24">
                    <NoData title="No Game Providers Discovered" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProviderFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onApply={setFilters}
      />
    </div>
  );
}
