"use client";

import React, { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { ListChecks, Zap, CheckCircle, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Pagination from "@/components/Pagination";
import { utcDayEndISO, utcDayStartISO } from "@/lib/utils";
import NoData from "@/components/NoData";
import ExportCSV from "@/components/ExportCSV";
import Image from "next/image";
import { coingreen } from "@/assets/icons";
import {
  UserBonusClaimsParams,
  UserBonusClaim,
  ClaimHistoryKpi,
} from "@/api/bonus/bonus.api";
import { useUserBonusClaimHistoryStore } from "@/store/user-bonus-claim-history.store";
import ReportFilterDrawer, { FilterField } from "@/components/report/ReportFilterDrawer";
import { TableSkeletonRows, StatCardsSkeleton } from "@/components/report/ReportSkeleton";
import { formatStat } from "@/lib/utils";

/* ============================
   CONSTANTS
============================ */
const PAGE_SIZE = 20;

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "expired", label: "Expired" },
  { value: "forfeited", label: "Forfeited" },
];

const sourceOptions = [
  { value: "all", label: "All Sources" },
  { value: "bonus", label: "Bonus" },
  { value: "promotion", label: "Promotion" },
];

const statusColor = (status: string) => {
  switch (status) {
    case "active": return "text-green-400";
    case "completed": return "text-blue-400";
    case "expired": return "text-orange-400";
    case "forfeited": return "text-red-400";
    default: return "text-gray-400";
  }
};

const TYPE_LABELS: Record<string, string> = {
  deposit_match: "Deposit Match",
  first_deposit: "First Deposit",
  free_spins: "Free Spins",
  cashback: "Cashback",
  reload_bonus: "Reload Bonus",
  no_deposit: "Welcome Bonus",
  profile_complete: "Profile Complete Bonus",
  lossback: "Lossback",
  hourly_rakeback: "Hourly Cashback",
  daily_rakeback: "Daily Cashback",
  weekly_rakeback: "Weekly Cashback",
  monthly_rakeback: "Monthly Cashback",
  vip_reward: "VIP Reward",
};

const BAR_COLORS = ["#F59E0B", "#3B82F6", "#10B981", "#EF4444", "#8B5CF6", "#06B6D4", "#EC4899"];

/* ============================
   KPI COMPONENTS
============================ */
function KpiCards({ kpi }: { kpi: ClaimHistoryKpi }) {
  const fmt = (n: number) => formatStat(n);

  const cards = [
    { label: "Total Records", value: formatStat(kpi.totalRecords), sub: "all time", icon: ListChecks, color: "text-purple-400", bg: "bg-purple-400/10" },
    { label: "Active", value: formatStat(kpi.activeCount), sub: `${kpi.activePercent}%`, icon: Zap, color: "text-yellow-400", bg: "bg-yellow-400/10" },
    { label: "Completed", value: formatStat(kpi.completedCount), sub: `${kpi.completedPercent}%`, icon: CheckCircle, color: "text-green-400", bg: "bg-green-400/10" },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-[#191D24] rounded-xl p-4 flex items-start gap-3">
            <div className={`${c.bg} p-2 rounded-lg mt-0.5`}>
              <c.icon size={18} className={c.color} />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">{c.label}</p>
              <p className="text-xl font-bold text-white leading-tight">{c.value}</p>
              <p className={`text-xs ${c.color} mt-0.5`}>{c.sub}</p>
            </div>
          </div>
        ))}
        {/* Total Amount card with green coin */}
        <div className="bg-[#191D24] rounded-xl p-4 flex items-start gap-3">
          <div className="bg-orange-400/10 p-2 rounded-lg mt-0.5 flex items-center justify-center">
            <Image src={coingreen} alt="WulfCash" width={18} height={18} />
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Total Amount</p>
            <p className="text-xl font-bold text-white leading-tight">{fmt(kpi.totalValue)}</p>
            <p className="text-xs text-orange-400 mt-0.5">claimed</p>
          </div>
        </div>
      </div>

      {/* Bar chart */}
      {/* {kpi.claimsByType.length > 0 && (
        <div className="bg-[#191D24] rounded-xl p-5">
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-white font-semibold">Claims by bonus type</p>
            <span className="text-xs text-gray-500">{kpi.claimsByType.reduce((s, t) => s + t.count, 0)} total</span>
          </div>
          <div className="relative overflow-x-auto">
            {[100, 75, 50, 25].map((pct) => (
              <div
                key={pct}
                className="absolute w-full border-t border-dashed border-white/5"
                style={{ bottom: `${pct}%` }}
              />
            ))}
            <div className="flex items-end gap-4 relative z-10">
              {(() => {
                const max = Math.max(...kpi.claimsByType.map((t) => t.count), 1);
                const sorted = [...kpi.claimsByType].sort((a, b) => b.count - a.count);
                return sorted.map((t, i) => {
                  const pct = Math.max(6, (t.count / max) * 100);
                  const color = BAR_COLORS[i % BAR_COLORS.length];
                  const label = TYPE_LABELS[t.type] ?? t.type.replace(/_/g, " ");
                  return (
                    <div key={t.type} className="flex flex-col items-center group" style={{ width: "72px", flexShrink: 0 }}>
                      <span
                        className="text-[11px] font-semibold mb-1"
                        style={{ color }}
                      >
                        {t.count}
                      </span>
                      <div className="w-full flex items-end" style={{ height: "90px" }}>
                        <div
                          className="w-full rounded-t-md transition-all duration-300 group-hover:opacity-80 relative overflow-hidden"
                          style={{
                            height: `${pct}%`,
                            backgroundColor: color,
                          }}
                        >
                          <div
                            className="absolute inset-0 opacity-20"
                            style={{
                              background: "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 60%)",
                            }}
                          />
                        </div>
                      </div>
                      <div className="mt-2 text-center w-full px-0.5" title={label}>
                        <span className="text-[10px] text-gray-400 group-hover:text-gray-200 transition-colors leading-tight line-clamp-2">
                          {label}
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )} */}
    </div>
  );
}

/* ============================
   PAGE
============================ */
export default function UserBonusClaimHistoryPage() {
  const {
    records,
    total,
    totalPages,
    loading,
    kpi,
    kpiLoading,
    fetchRecords,
    fetchAllForExport,
    fetchKpi,
  } = useUserBonusClaimHistoryStore();
  const [currentPage, setCurrentPage] = useState(1);

  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [amountMin, setAmountMin] = useState<number | undefined>(undefined);
  const [amountMax, setAmountMax] = useState<number | undefined>(undefined);
  const [filterOpen, setFilterOpen] = useState(false);

  /* ============================
     FETCH
  ============================ */
  const fetchData = useCallback(
    async (page: number) => {
      const params: UserBonusClaimsParams = { page, limit: PAGE_SIZE };
      // Whole UTC days — the boundary every report and money log uses.
      params.startDate = utcDayStartISO(startDate);
      params.endDate = utcDayEndISO(endDate);
      if (search.trim()) params.search = search.trim();
      if (status !== "all") params.status = status;
      if (source !== "all") params.source = source;
      if (amountMin !== undefined) params.minAmount = amountMin;
      if (amountMax !== undefined) params.maxAmount = amountMax;
      await fetchRecords(params);
    },
    [startDate, endDate, search, status, source, amountMin, amountMax, fetchRecords]
  );

  const fetchKpiData = useCallback(async () => {
    const params: { startDate?: string; endDate?: string; status?: string; source?: string; minAmount?: number; maxAmount?: number } = {};
    params.startDate = utcDayStartISO(startDate);
    params.endDate = utcDayEndISO(endDate);
    if (status !== "all") params.status = status;
    if (source !== "all") params.source = source;
    if (amountMin !== undefined) params.minAmount = amountMin;
    if (amountMax !== undefined) params.maxAmount = amountMax;
    await fetchKpi(params);
  }, [startDate, endDate, status, source, amountMin, amountMax, fetchKpi]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchData(1);
      void fetchKpiData();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [fetchData, fetchKpiData]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchData(1);
    fetchKpiData();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch();
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchData(page);
  };

  /* ============================
     EXPORT
  ============================ */
  const buildExportParams = (): UserBonusClaimsParams => {
    const params: UserBonusClaimsParams = {};
    params.startDate = utcDayStartISO(startDate);
    params.endDate = utcDayEndISO(endDate);
    if (search.trim()) params.search = search.trim();
    if (status !== "all") params.status = status;
    if (source !== "all") params.source = source;
    if (amountMin !== undefined) params.minAmount = amountMin;
    if (amountMax !== undefined) params.maxAmount = amountMax;
    return params;
  };

  /* ============================
     RENDER
  ============================ */
  return (
    <div className="h-full bg-[#15181E] p-3 md:p-6 space-y-4 md:space-y-6 overflow-y-auto w-full scrollbar-hide">
      <div className="flex flex-col gap-6">
        {/* HEADER */}
        <div className="bg-[#161A21] px-3 py-3 md:px-5 rounded-lg border border-[#242B35] flex flex-wrap items-center justify-between gap-3">
          <span className="text-md font-mono font-semibold text-gray-100">
            Report / User Bonus Claim History
          </span>
        </div>

        {/* KPI CARDS */}
        {kpiLoading ? <StatCardsSkeleton count={4} /> : kpi && <KpiCards kpi={kpi} />}

        {/* FILTER BAR */}
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-[#242B35] bg-[#191D24] px-3 py-3 md:px-4 md:grid-cols-[auto_minmax(260px,1fr)_auto] md:items-center">
          <Button
            variant="outline"
            className="h-9 bg-[#15181E] border-[#242B35] text-gray-200 hover:bg-[#242B35] flex items-center gap-2"
            onClick={() => setFilterOpen(true)}
          >
            <Filter size={20} className="text-[#B93DEB]" />
            <span className="text-xs">Filter</span>
            {(status !== "all" || source !== "all" || amountMin !== undefined || amountMax !== undefined || startDate || endDate) && (
              <span className="w-2 h-2 rounded-full bg-[#B93DEB]" />
            )}
          </Button>

          <div className="min-w-0">
            <Input
              placeholder="Search username / entity / bonus..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-9 w-full bg-[#15181E] border-[#242B35] text-white text-xs placeholder:text-gray-500"
            />
          </div>

          <div className="flex justify-end">
            <ExportCSV<UserBonusClaim>
              data={records}
              headers={["Date", "Bonus Name", "Bonus Type", "Source", "User", "Amount", "Status"]}
              mapRow={(r) => [
                r.createdAt ? r.createdAt.slice(0, 10) : "",
                r.bonus?.name ?? "-",
                r.bonus?.type ?? "-",
                r.source === "promotion" ? "Promotion" : "Bonus",
                r.user?.username ?? r.user?.entity ?? r.userId,
                r.bonusAmount,
                r.status,
              ]}
              fileName="user_bonus_claim_history"
              fetchAll={async (range) => {
                const params = buildExportParams();
                params.startDate = utcDayStartISO(range.from);
                params.endDate = utcDayEndISO(range.to);
                return fetchAllForExport(params);
              }}
            />
          </div>
        </div>

        <ReportFilterDrawer
          open={filterOpen}
          onOpenChange={setFilterOpen}
          title="Claim History Filters"
          description="Filter bonus claim history by source, amount, status and date."
          fields={[
            {
              kind: "select",
              key: "source",
              label: "Source",
              options: sourceOptions,
            },
            {
              kind: "select",
              key: "status",
              label: "Status",
              options: statusOptions,
            },
            {
              kind: "numberRange",
              key: "amount",
              label: "Amount",
            },
            { kind: "dateRange" },
          ] as FilterField[]}
          values={{ source, status, amountMin, amountMax, startDate, endDate }}
          defaults={{ source: "all", status: "all", amountMin: undefined, amountMax: undefined, startDate: undefined, endDate: undefined }}
          onApply={(v) => {
            setSource((v.source as string) ?? "all");
            setStatus((v.status as string) ?? "all");
            setAmountMin(v.amountMin as number | undefined);
            setAmountMax(v.amountMax as number | undefined);
            setStartDate(v.startDate);
            setEndDate(v.endDate);
            setCurrentPage(1);
          }}
        />

        {/* TABLE CONTAINER */}
        <div className="rounded-xl border border-[#242B35] bg-[#191D24] overflow-hidden">
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full min-w-[1200px]">
              <thead className="bg-[#242B35]">
                <tr>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">Date</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">Bonus Name</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">Type</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">Source</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">User</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">Amount</th>
                  <th className="px-5 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242B35]">
                {loading ? (
                  <TableSkeletonRows rows={8} cols={7} />
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-center">
                      <NoData title="No bonus claim records found" />
                    </td>
                  </tr>
                ) : (
                  records.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-[#242B35]/30 transition-colors"
                    >
                      <td className="px-5 py-4 text-sm text-gray-300 whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-sm text-white font-medium">
                        {row.bonus?.name ?? "-"}
                      </td>
                      <td className="px-5 py-4 text-xs text-gray-400 capitalize">
                        {row.bonus?.type?.replace(/_/g, " ") ?? "-"}
                      </td>
                      <td className="px-5 py-4 text-xs">
                        {row.source === "promotion" ? (
                          <span className="px-2 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold uppercase tracking-wider">Promotion</span>
                        ) : (
                          <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold uppercase tracking-wider">Bonus</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-100">
                        {row.user?.username ?? row.user?.entity ?? row.userId}
                      </td>
                      <td className="px-5 py-4 text-sm text-white font-mono">
                        {Number(row.bonusAmount).toFixed(2)}
                      </td>
                      <td className={`px-5 py-4 text-xs capitalize font-bold ${statusColor(row.status)}`}>
                        {row.status}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* FOOTER / PAGINATION */}
        <div className="mt-4 rounded-xl border border-[#242B35] bg-[#191D24] px-3 py-3 md:px-5 flex justify-end">
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}

