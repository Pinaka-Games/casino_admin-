"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { coingold, coingreen } from "@/assets/icons";
import { useProviderStore, ProviderStats } from "@/store/provider-store";
import { useDashboardStore } from "@/store/dashboard-store";
import { toReportDay } from "@/lib/utils";
import NoData from "@/components/NoData/NoData";
import { 
  Building2, 
  Gamepad2, 
  TrendingUp, 
  Activity, 
  Search, 
  Filter, 
  RefreshCcw,
  ExternalLink,
  Settings2,
  CheckCircle2,
  AlertCircle,
  PauseCircle
} from "lucide-react";

export default function ProviderListingPage() {
  const { fromDate, toDate, refreshKey, setRefreshKey } = useDashboardStore();
  const { providers, isLoading, fetchProviders, searchQuery, setSearchQuery } = useProviderStore();

  useEffect(() => {
    const params = {
      // Whole UTC days, like every other report filter.
      startDate: toReportDay(fromDate),
      endDate: toReportDay(toDate),
    };
    fetchProviders(params);
  }, [fromDate, toDate, refreshKey, fetchProviders]);

  const filteredProviders = providers.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const StatCard = ({ label, value, icon: Icon, color }: any) => (
    <div className="bg-[#15181E] border border-white/5 rounded-2xl p-5 relative overflow-hidden group">
      <div className={`absolute top-0 right-0 w-24 h-24 blur-[60px] opacity-20 bg-${color}-500 group-hover:opacity-30 transition-opacity`} />
      <div className="flex items-center gap-4 relative z-10">
        <div className={`w-12 h-12 rounded-xl bg-${color}-500/10 flex items-center justify-center border border-${color}-500/20`}>
          <Icon className={`w-6 h-6 text-${color}-400`} />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1">{label}</p>
          <h3 className="text-xl font-bold text-white tracking-tight">{value}</h3>
        </div>
      </div>
    </div>
  );

  const fmtNum = (n: number) =>
    (Number.isFinite(n) ? n : 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

  /**
   * Wulf Cash (real money, green) above Wulf Coins (virtual, gold). Kept apart
   * on purpose: this column used to print a single `$` figure that silently
   * included coin play, so virtual volume read as revenue.
   */
  const MoneySplit = ({
    cash,
    coin,
    cashClass = "text-emerald-400",
    coinClass = "text-amber-500",
  }: {
    cash: number;
    coin: number;
    cashClass?: string;
    coinClass?: string;
  }) => (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className={`flex items-center gap-1.5 text-sm font-bold tabular-nums ${cashClass}`}
        title="Wulf Cash (real money)"
      >
        <Image src={coingreen} alt="Wulf Cash" width={13} height={13} />
        {fmtNum(cash)}
      </span>
      <span
        className={`flex items-center gap-1.5 text-xs font-bold tabular-nums ${coinClass}`}
        title="Wulf Coins (virtual)"
      >
        <Image src={coingold} alt="Wulf Coins" width={12} height={12} />
        {fmtNum(coin)}
      </span>
    </div>
  );

  const StatusBadge = ({ status }: { status: ProviderStats["status"] }) => {
    const config = {
      active: { icon: CheckCircle2, text: "Active", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
      maintenance: { icon: AlertCircle, text: "Under Maintenance", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
      disabled: { icon: PauseCircle, text: "Disabled", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
    }[status];

    const Icon = config.icon;
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bg} ${config.border} border`}>
        <Icon className={`w-3.5 h-3.5 ${config.color}`} />
        <span className={`text-[10px] font-bold uppercase tracking-wider ${config.color}`}>{config.text}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#15181E] p-3 md:p-8 flex flex-col gap-4 md:gap-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#B93DEB] to-[#9b2fd1] flex items-center justify-center shadow-lg shadow-[#B33DEB]/20">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Provider Operations</h1>
            <p className="text-sm text-white/40 font-medium">Manage and monitor game source providers</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-[#B93DEB] transition-colors" />
            <input
              type="text"
              placeholder="Search providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#15181E] border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#B93DEB]/50 focus:ring-1 focus:ring-[#B93DEB]/20 w-64 transition-all"
            />
          </div>

          <button 
             onClick={() => setRefreshKey()}
             className="p-2.5 rounded-xl bg-[#15181E] border border-white/5 hover:border-white/10 transition-all group"
          >
            <RefreshCcw className="w-5 h-5 text-white/40 group-hover:text-white/80 group-active:rotate-180 transition-all duration-500" />
          </button>
        </div>
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          label="Total Providers" 
          value={providers.length} 
          icon={Building2} 
          color="indigo" 
        />
        <StatCard 
          label="Active Games" 
          value={providers.reduce((acc, p) => acc + p.enabledGames, 0).toLocaleString()} 
          icon={Gamepad2} 
          color="emerald" 
        />
        {/* Real-money GGR only. Adding the Wulf Coin side in made virtual play
            inflate a figure the admin reads as revenue. */}
        <StatCard
          label="Total GGR (Wulf Cash)"
          value={`$${fmtNum(providers.reduce((acc, p) => acc + p.cash.ggr, 0))}`}
          icon={TrendingUp}
          color="sky"
        />
        <StatCard 
          label="Avg Performance" 
          value="98.4%" 
          icon={Activity} 
          color="fuchsia" 
        />
      </div>

      {/* Table Section */}
      <div className="bg-[#15181E] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#1a1d27] border-b border-white/[0.03]">
                <th className="px-6 py-4 text-left text-[11px] font-bold text-white/30 uppercase tracking-widest">Provider</th>
                <th className="px-6 py-4 text-center text-[11px] font-bold text-white/30 uppercase tracking-widest">Inventory</th>
                <th className="px-6 py-4 text-center text-[11px] font-bold text-white/30 uppercase tracking-widest">Total Volume</th>
                <th className="px-6 py-4 text-center text-[11px] font-bold text-white/30 uppercase tracking-widest">Provider GGR</th>
                <th className="px-6 py-4 text-center text-[11px] font-bold text-white/30 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-right text-[11px] font-bold text-white/30 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="px-6 py-8">
                       <div className="h-4 bg-white/5 rounded-lg w-full" />
                    </td>
                  </tr>
                ))
              ) : filteredProviders.length > 0 ? (
                filteredProviders.map((provider) => (
                  <tr key={provider.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center font-bold text-[#B93DEB] text-lg">
                          {provider.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{provider.name}</p>
                          <p className="text-[10px] text-white/30 font-medium">Internal ID: {provider.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-bold text-white">{provider.enabledGames} / {provider.totalGames}</span>
                        <div className="w-24 h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full" 
                            style={{ width: `${(provider.enabledGames / provider.totalGames) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <MoneySplit
                        cash={provider.cash.totalVolume}
                        coin={provider.coin.totalVolume}
                      />
                    </td>
                    <td className="px-6 py-5 text-center">
                      <MoneySplit
                        cash={provider.cash.ggr}
                        coin={provider.coin.ggr}
                        cashClass={provider.cash.ggr >= 0 ? "text-emerald-400" : "text-rose-400"}
                        coinClass={provider.coin.ggr >= 0 ? "text-amber-500" : "text-rose-400"}
                      />
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex justify-center">
                        <StatusBadge status={provider.status} />
                      </div>
                    </td>
                    <td className="px-6 py-5">
                       <div className="flex items-center justify-end gap-2">
                         <button className="p-2 rounded-lg bg-white/5 border border-white/5 hover:border-[#B93DEB]/30 hover:bg-[#B93DEB]/10 transition-all text-white/40 hover:text-[#B93DEB]" title="Settings">
                           <Settings2 className="w-4 h-4" />
                         </button>
                         <button className="p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/20 transition-all text-white/40 hover:text-white/80" title="View Games">
                           <ExternalLink className="w-4 h-4" />
                         </button>
                       </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-20">
                     <NoData title="No Game Providers Found" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
