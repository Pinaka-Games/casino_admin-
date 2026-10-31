"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import NoData from "@/components/NoData";
import { formatStat } from "@/lib/utils";
import type {
  PlayerPerformanceDaily,
  PlayerPerformanceDetail,
} from "@/api/player-performance/player-performance.api";
import type { ReportCurrency } from "@/api/reports/reports";
import {
  CURRENCY_META,
  addDays,
  dayKeyToMs,
  daysBetween,
  fmtAmount,
  fmtCount,
  fmtDayKey,
  fmtUsd,
  msToDayKey,
  num,
  withSign,
} from "./PerformanceFormat";

type Metric = "money" | "gameplay" | "rounds" | "bonus";
type SeriesKey = Exclude<keyof PlayerPerformanceDaily, "day">;
type Grain = "day" | "week" | "month";

/** More bars than this stop being readable at tab width, so they get grouped. */
const MAX_POINTS = 120;

const METRICS: { value: Metric; label: string }[] = [
  { value: "money", label: "Money" },
  { value: "gameplay", label: "Gameplay" },
  { value: "rounds", label: "Rounds" },
  { value: "bonus", label: "Bonus" },
];

/*
 * Each chart's series were checked for colour-blind separation and contrast
 * against the panel surface (#191D24). Wagered purple and GGR blue are close
 * for deuteranopes, which is why GGR is the line: the mark shape tells them
 * apart where the hue cannot.
 */
const SERIES: Record<SeriesKey, { label: string; color: string }> = {
  depositUsd: { label: "Deposits", color: "#04AD37" },
  redeemUsd: { label: "Redeems", color: "#B93DEB" },
  stake: { label: "Wagered", color: "#B93DEB" },
  win: { label: "Won", color: "#C47A0A" },
  ggr: { label: "GGR", color: "#1590CC" },
  rounds: { label: "Rounds", color: "#B93DEB" },
  bonus: { label: "Bonus", color: "#C47A0A" },
};

const METRIC_SERIES: Record<Metric, SeriesKey[]> = {
  money: ["depositUsd", "redeemUsd"],
  gameplay: ["stake", "win", "ggr"],
  rounds: ["rounds"],
  bonus: ["bonus"],
};

const EMPTY_TITLE: Record<Metric, string> = {
  money: "No deposits or redeems in this range",
  gameplay: "No gameplay in this range",
  rounds: "No rounds in this range",
  bonus: "No bonuses in this range",
};

interface Point extends Record<SeriesKey, number> {
  key: string;
  axisLabel: string;
  tooltipLabel: string;
}

const zeroPoint = (key: string): Omit<Point, "axisLabel" | "tooltipLabel"> => ({
  key,
  depositUsd: 0,
  redeemUsd: 0,
  stake: 0,
  win: 0,
  ggr: 0,
  rounds: 0,
  bonus: 0,
});

const SERIES_KEYS = Object.keys(SERIES) as SeriesKey[];

function bucketKey(day: string, grain: Grain): string {
  if (grain === "day") return day;
  if (grain === "month") return `${day.slice(0, 7)}-01`;
  // ISO weeks start on Monday.
  const weekday = new Date(dayKeyToMs(day)).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

function labelsFor(key: string, grain: Grain) {
  if (grain === "month") {
    const text = fmtDayKey(key, { month: "short", year: "numeric" });
    return { axisLabel: text, tooltipLabel: text };
  }
  const axisLabel = fmtDayKey(key);
  const full = fmtDayKey(key, { month: "short", day: "numeric", year: "numeric" });
  return {
    axisLabel,
    tooltipLabel: grain === "week" ? `Week of ${full}` : full,
  };
}

/**
 * The API returns only days with activity. Every day of the range is filled in
 * so a quiet week shows as a gap instead of the bars on either side touching,
 * then long ranges are grouped by week (or month) to stay readable.
 */
function buildSeries(
  daily: PlayerPerformanceDaily[],
  range: PlayerPerformanceDetail["range"] | undefined,
): { points: Point[]; grain: Grain; spanDays: number } {
  if (!daily.length) return { points: [], grain: "day", spanDays: 0 };

  const byDay = new Map<string, PlayerPerformanceDaily>();
  for (const d of daily) byDay.set(d.day.slice(0, 10), d);

  const days = [...byDay.keys()].sort();
  const first = days[0];
  const last = days[days.length - 1];
  const rangeStart = range?.startDate?.slice(0, 10);
  const rangeEnd = range?.endDate?.slice(0, 10);
  // Widened to the requested range, never narrowed below the data itself.
  const from = rangeStart && rangeStart < first ? rangeStart : first;
  const to = rangeEnd && rangeEnd > last ? rangeEnd : last;
  const spanDays = daysBetween(from, to) + 1;

  let grain: Grain = "day";
  if (spanDays > MAX_POINTS) grain = spanDays / 7 > MAX_POINTS ? "month" : "week";

  const buckets = new Map<string, Omit<Point, "axisLabel" | "tooltipLabel">>();
  for (let ms = dayKeyToMs(from), end = dayKeyToMs(to); ms <= end; ms += 86_400_000) {
    const day = msToDayKey(ms);
    const key = bucketKey(day, grain);
    const bucket = buckets.get(key) ?? zeroPoint(key);
    const row = byDay.get(day);
    if (row) for (const s of SERIES_KEYS) bucket[s] += num(row[s]);
    buckets.set(key, bucket);
  }

  const points = [...buckets.values()].map((p) => ({ ...p, ...labelsFor(p.key, grain) }));
  return { points, grain, spanDays };
}

export default function PerformanceTrendChart({
  detail,
  currency,
}: {
  detail: PlayerPerformanceDetail;
  currency: ReportCurrency;
}) {
  const [metric, setMetric] = useState<Metric>("money");

  const { points, grain, spanDays } = useMemo(
    () => buildSeries(detail.daily ?? [], detail.range),
    [detail.daily, detail.range],
  );

  const keys = METRIC_SERIES[metric];
  const config = useMemo(
    () =>
      Object.fromEntries(keys.map((k) => [k, SERIES[k]])) satisfies ChartConfig,
    [keys],
  );
  const hasValues = points.some((p) => keys.some((k) => p[k] !== 0));

  const formatValue = (key: SeriesKey, value: number) => {
    if (key === "depositUsd" || key === "redeemUsd") return fmtUsd(value);
    if (key === "rounds") return fmtCount(value);
    const text = fmtAmount(value, currency);
    return key === "ggr" ? withSign(text, value) : text;
  };
  const formatTick = (value: number) =>
    metric === "money" ? `$${formatStat(value)}` : formatStat(value);

  const grainNote =
    grain === "day"
      ? `Daily · ${fmtCount(spanDays)} ${spanDays === 1 ? "day" : "days"}`
      : `Grouped by ${grain} — ${fmtCount(spanDays)} days is too many bars to read one per day`;

  const unitNote =
    metric === "money"
      ? "USD"
      : metric === "rounds"
        ? "Rounds"
        : CURRENCY_META[currency].label;

  const axes = (
    <>
      <CartesianGrid vertical={false} stroke="#ffffff0a" />
      <XAxis
        dataKey="axisLabel"
        tickLine={false}
        axisLine={false}
        tickMargin={8}
        minTickGap={16}
        tick={{ fill: "#9CA3AF", fontSize: 11 }}
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        width={56}
        tickFormatter={formatTick}
        tick={{ fill: "#9CA3AF", fontSize: 11 }}
      />
      <ChartTooltip
        cursor={{ fill: "#ffffff0d" }}
        content={
          <ChartTooltipContent
            className="border-[#242B35] bg-[#15181E] text-white"
            labelFormatter={(_, payload) =>
              (payload?.[0]?.payload as Point | undefined)?.tooltipLabel ?? ""
            }
            formatter={(value, name, item) => (
              <div className="flex w-full items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                  style={{ background: (item as { color?: string })?.color }}
                />
                <span className="flex-1 text-gray-400">
                  {SERIES[name as SeriesKey]?.label ?? String(name)}
                </span>
                <span className="font-mono font-medium tabular-nums text-white">
                  {formatValue(name as SeriesKey, num(value))}
                </span>
              </div>
            )}
          />
        }
      />
    </>
  );

  const bar = (key: SeriesKey) => (
    <Bar
      key={key}
      dataKey={key}
      name={key}
      fill={`var(--color-${key})`}
      radius={[4, 4, 0, 0]}
      maxBarSize={26}
    />
  );

  return (
    <div className="min-w-0 rounded-xl border border-[#242B35] bg-[#191D24]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#242B35] px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">Daily Trend</h3>
          <p className="text-[11px] text-gray-500">
            {points.length ? `${grainNote} · ${unitNote}` : unitNote}
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Trend metric"
          className="flex flex-wrap gap-1 rounded-lg border border-[#242B35] bg-[#0F1216] p-1"
        >
          {METRICS.map((m) => (
            <button
              key={m.value}
              type="button"
              role="tab"
              aria-selected={metric === m.value}
              onClick={() => setMetric(m.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                metric === m.value
                  ? "bg-[#B93DEB] text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {!points.length || !hasValues ? (
          <div className="py-6">
            <NoData title={points.length ? EMPTY_TITLE[metric] : "No daily activity in this range"} />
          </div>
        ) : (
          <>
            <ChartContainer config={config} className="aspect-auto h-70 w-full">
              {metric === "gameplay" ? (
                <ComposedChart data={points} margin={{ left: 0, right: 8, top: 8 }} barGap={2}>
                  {axes}
                  {bar("stake")}
                  {bar("win")}
                  <Line
                    dataKey="ggr"
                    name="ggr"
                    type="monotone"
                    stroke="var(--color-ggr)"
                    strokeWidth={2}
                    dot={points.length <= 31 ? { r: 3, fill: "var(--color-ggr)" } : false}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              ) : (
                <BarChart data={points} margin={{ left: 0, right: 8, top: 8 }} barGap={2}>
                  {axes}
                  {keys.map(bar)}
                </BarChart>
              )}
            </ChartContainer>

            {/* The tooltip is hover-only; the legend names the series for
                everyone, and says which mark is the line. */}
            {keys.length > 1 ? (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                {keys.map((k) => (
                  <span key={k} className="flex items-center gap-1.5">
                    {k === "ggr" ? (
                      <span className="h-0.5 w-3.5 rounded" style={{ background: SERIES[k].color }} />
                    ) : (
                      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: SERIES[k].color }} />
                    )}
                    {SERIES[k].label}
                  </span>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
