"use client"

import * as React from "react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { addDays, format, parseISO } from "date-fns"
import { EarningRecord } from "@/types/profile.type"
import { useAuthStore } from "@/store/auth-store"
import EmptyStatePage from "@/components/emptystatePage"
import { notfound } from "@/assets/icons"
import { getDisplayCommissionAmount } from "./earning-display"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

interface EarningsChartProps {
  earnings: EarningRecord[];
  isLoading: boolean;
}

const chartConfig = {
  commission: {
    label: "Earnings",
    color: "#B93DEB",
  },
} satisfies ChartConfig

export function EarningsChart({ earnings, isLoading }: EarningsChartProps) {
  const user = useAuthStore((state) => state.user)
  const isSubAgent =
    user?.roles?.some((role) => role.name.toLowerCase().includes("sub")) ??
    false

  const chartData = React.useMemo(() => {
    if (!earnings || earnings.length === 0) return [];

    const grouped = earnings
      .reduce((acc: Record<string, number>, current) => {
        const createdAtDate = parseISO(current.createdAt);
        const dateKey = format(createdAtDate, "yyyy-MM-dd");
        const earning = getDisplayCommissionAmount(current, isSubAgent);

        acc[dateKey] =
          (acc[dateKey] || 0) +
          (earning > 0 ? earning : 0);
        return acc;
      }, {});

    const sortedDates = Object.keys(grouped).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );

    if (sortedDates.length === 0) return [];

    const startDate = parseISO(sortedDates[0]);
    const endDate = parseISO(sortedDates[sortedDates.length - 1]);

    const filledDailyData: { date: string; commission: number }[] = [];
    let cursor = startDate;

    while (cursor <= endDate) {
      const dateKey = format(cursor, "yyyy-MM-dd");
      filledDailyData.push({
        date: dateKey,
        commission: grouped[dateKey] ?? 0,
      });
      cursor = addDays(cursor, 1);
    }

    return filledDailyData;
  }, [earnings, isSubAgent]);

  if (isLoading) {
    return <div className="h-full w-full bg-white/5 animate-pulse rounded-xl" />;
  }

  if (chartData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center rounded-xl p-8">
        <EmptyStatePage
          title="No revenue generated yet"
          image={notfound}
          imageWidth={140}
          imageHeight={70}
        />
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {/* Total summary */}
      {/* <div className="flex items-center justify-between px-1">
        <span className="text-[10px] text-gray-500 uppercase font-bold">
          Total Earnings
        </span>
        <span className="text-lg font-bold text-white tracking-tighter">
          {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      </div> */}

      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-50 sm:h-[260px] w-full"
      >
        <LineChart
          accessibilityLayer
          data={chartData}
          margin={{ left: 4, right: 4, top: 4, bottom: 4 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#ffffff0a" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={32}
            tick={{ fill: "#6B7280", fontSize: 10, fontWeight: 700 }}
            tickFormatter={(value) =>
              new Date(value).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            }
          />
          <YAxis hide domain={[0, (max: number) => (max > 0 ? max : 1)]} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                className="w-[150px] sm:w-[180px] bg-[#191D24] border-white/10 text-white"
                nameKey="commission"
                labelFormatter={(value) => format(parseISO(String(value)), "MMM d, yyyy")}
              />
            }
          />
          <Line
            dataKey="commission"
            type="monotone"
            stroke="#B93DEB"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#B93DEB" }}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}
