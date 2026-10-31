"use client";

import React, { useEffect, useMemo, useState } from "react";
import { DollarSign, Filter } from "lucide-react";
import toast from "react-hot-toast";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import { Button } from "@/components/ui/button";
import { formatStat, toReportDay } from "@/lib/utils";
import ExportCSV from "@/components/ExportCSV";
import {
  getInstantRebateLogs,
  type InstantRebateLogRow,
} from "@/api/reports/instant-rebate.api";
import Pagination from "@/components/Pagination";
import ReportFilterDrawer, { FilterField } from "@/components/report/ReportFilterDrawer";
import { TableSkeletonRows, StatCardsSkeleton } from "@/components/report/ReportSkeleton";

// ─── helpers ──────────────────────────────────────────────────────────────────

function parseAmount(v: string | undefined): number {
  if (!v) return 0;
  return parseFloat(v.replace(/[^0-9.]/g, "")) || 0;
}

function formatAmount(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Sun Mon Tue ... from ISO date string */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()] ?? iso;
}

// ─── stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
  subColor?: string;
  icon: React.ReactNode;
  iconBg: string;
}

function StatCard({ label, value, sub, subColor = "text-gray-500", icon, iconBg }: StatCardProps) {
  return (
    <div className="bg-[#191D24] border border-[#242B35] rounded-xl p-4 md:p-5 shadow-sm relative overflow-hidden group">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</p>
      </div>
      <h3 className="text-2xl sm:text-3xl font-black text-white pl-1 mt-1">{value}</h3>
      <p className={`text-xs font-bold mt-2 pl-1 ${subColor}`}>{sub}</p>
    </div>
  );
}

// ─── custom tooltip ───────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1E2330] border border-[#2A3040] rounded-lg px-3 py-2 text-xs text-white shadow-xl">
      <p className="text-[#8292AA] mb-1">{label}</p>
      <p className="font-semibold">{formatAmount(payload[0]?.value ?? 0)}</p>
    </div>
  );
};

// ─── page ─────────────────────────────────────────────────────────────────────

export default function InstantRebateReportPage() {
  const [userType, setUserType] = useState<"USER" | "AGENT">("USER");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [rows, setRows] = useState<InstantRebateLogRow[]>([]);
  const [totalSlotsAmount, setTotalSlotsAmount] = useState("0.00");
  const [totalAmount, setTotalAmount] = useState("0.00");
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const PAGE_SIZE = 10;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await getInstantRebateLogs({
          userType,
          // toISOString() is the UTC instant, so slicing it rolled the day
          // back for any admin east of UTC. The API widens the picked day to
          // 00:00:00 / 23:59:59 itself.
          startDate: toReportDay(startDate),
          endDate: toReportDay(endDate),
        });
        setRows(data.items ?? []);
        setTotalSlotsAmount(data.totalSlotsAmount ?? "0.00");
        setTotalAmount(data.totalAmount ?? "0.00");
        setCurrentPage(1);
      } catch {
        toast.error("Failed to load instant rebate logs");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userType, startDate, endDate]);

  // ── derived stats ────────────────────────────────────────────────────────────
  //
  // Only the rebate total is headlined now. The Rebate Events, Avg Rebate and
  // Rebate Rate cards were removed: the per-row "Rebate %" column already
  // states the rate for each payout, and the row count is visible in the table
  // itself, so the three added no information the table did not already carry.
  const stats = useMemo(
    () => ({ total: parseAmount(totalAmount) }),
    [totalAmount],
  );

  // What period the cards actually cover — the filter decides, not a fixed
  // string. Matches the "Showing … · all time" line in the filter bar.
  const rangeLabel = startDate || endDate ? "selected range" : "all time";

  // ── chart data: aggregate amount by transactionDate day ──────────────────────
  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const day = r.transactionDate?.slice(0, 10) ?? "";
      map.set(day, (map.get(day) ?? 0) + parseAmount(r.amount));
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ day: dayLabel(date), date, value }));
  }, [rows]);

  return (
    <div className="min-h-full bg-[#15181E] p-3 md:p-6 space-y-4">

      {/* Header */}
      <div className="bg-[#191D24] px-3 py-3 md:px-4 rounded-lg">
        <h1 className="text-white text-base font-normal">Report / Instant Rebate</h1>
      </div>

      {/* Filters */}
      <div className="bg-[#15181E] p-3 rounded-lg flex items-center gap-3 flex-wrap">
        <Button
          variant="outline"
          className="bg-[#1a2030] border-white/10 text-gray-200 hover:bg-[#252b3d] flex items-center gap-2 h-10"
          onClick={() => setFilterOpen(true)}
        >
          <Filter size={20} className="text-[#B93DEB]" />
          <span className="text-sm">Filter</span>
          {(userType !== "USER" || startDate || endDate) && (
            <span className="w-2 h-2 rounded-full bg-[#B93DEB]" />
          )}
        </Button>
        <span className="text-gray-500 text-xs">
          Showing <span className="text-gray-300">{userType === "USER" ? "Players" : "Agents"}</span>
          {startDate || endDate ? " · date filtered" : " · all time"}
        </span>
        <div className="ml-auto">
          <ExportCSV<InstantRebateLogRow>
            data={rows}
            headers={["Date & Time", "User", "Bet Amount", "Rebate %", "Rebate Amount"]}
            fileName="instant_rebate_report.csv"
            getRowDate={(r) => r.transactionDate}
            mapRow={(r) => {
              const rebateAmt = parseAmount(r.amount);
              const totalBet = parseAmount(r.betAmount);
              const rebatePct = totalBet > 0 ? ((rebateAmt / totalBet) * 100).toFixed(2) + "%" : "0%";
              const dateOnly = r.transactionDate ? r.transactionDate.slice(0, 10) : "";
              return [
                dateOnly,
                r.username,
                formatAmount(totalBet),
                rebatePct,
                formatAmount(rebateAmt),
              ];
            }}
          />
        </div>
      </div>

      <ReportFilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title="Instant Rebate Filters"
        description="Filter rebate logs by audience and date."
        fields={[
          {
            kind: "select",
            key: "userType",
            label: "Audience",
            options: [
              { value: "USER", label: "Players" },
              { value: "AGENT", label: "Agents" },
            ],
          },
          { kind: "dateRange" },
        ] as FilterField[]}
        values={{ userType, startDate, endDate }}
        defaults={{ userType: "USER", startDate: undefined, endDate: undefined }}
        onApply={(v) => {
          setUserType((v.userType as "USER" | "AGENT") ?? "USER");
          setStartDate(v.startDate);
          setEndDate(v.endDate);
        }}
      />

      {loading ? (
        <>
          <StatCardsSkeleton count={4} />
          <div className="bg-[#15181E] rounded-xl overflow-hidden">
            <table className="w-full">
              <tbody>
                <TableSkeletonRows rows={8} cols={5} />
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Rebated"
              value={formatStat(stats.total)}
              // The caption said "this week" no matter what the filter was set
              // to, so an all-time total was labelled as one week's worth.
              sub={rangeLabel}
              subColor="text-red-400"
              icon={<DollarSign className="w-5 h-5 text-red-400" />}
              iconBg="bg-red-500/10 border border-red-500/20"
            />
          </div>

          {/* Chart */}
          <div className="bg-[#15181E] rounded-xl px-3 pt-4 pb-4 md:px-6 md:pt-5">
            <p className="text-white text-sm font-medium mb-4">Rebate payouts — last 7 days</p>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rebateGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#E05252" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#E05252" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="0"
                    horizontal
                    vertical={false}
                    stroke="#242B35"
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "#8292AA", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#8292AA", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}`}
                    width={60}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#E05252"
                    strokeWidth={2}
                    fill="url(#rebateGrad)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-[#8292AA] text-sm">
                No data for the selected range
              </div>
            )}
          </div>

          {/* Detailed data table */}
          <div className="bg-[#15181E] rounded-xl overflow-hidden">
            <div className="px-3 py-4 md:px-6 border-b border-[#242B35]">
              <p className="text-white text-sm font-medium">Detailed data</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full">
                <thead>
                  <tr className="border-b border-[#242B35]">
                    {["Date & Time", "User", "Bet Amount", "Rebate %", "Rebate Amount"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs text-[#8292AA] font-medium whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-sm text-[#8292AA]">
                        No instant rebate logs found for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    rows
                      .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
                      .map((row, i) => {
                        const rebateAmt = parseAmount(row.amount);
                        const totalBet = parseAmount(row.betAmount);
                        const rebatePct = totalBet > 0 ? ((rebateAmt / totalBet) * 100).toFixed(1) + "%" : "—";
                        return (
                          <tr
                            key={`${row.username}-${row.transactionDate}-${i}`}
                            className="border-b border-[#1E2330] hover:bg-[#1E2330] transition-colors"
                          >
                            <td className="px-5 py-3 text-xs text-[#8292AA] whitespace-nowrap">{row.transactionDate}</td>
                            <td className="px-5 py-3 text-xs text-white">{row.username}</td>
                            <td className="px-5 py-3 text-xs text-white">{formatAmount(totalBet)}</td>
                            <td className="px-5 py-3 text-xs text-white">{rebatePct}</td>
                            <td className="px-5 py-3 text-xs text-white">{formatAmount(rebateAmt)}</td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {rows.length > PAGE_SIZE && (
            <div className="mt-4 rounded-xl border border-[#242B35] bg-[#191D24] px-3 py-3 md:px-5 flex justify-end">
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(rows.length / PAGE_SIZE)}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
