"use client";

import { format } from "date-fns";
import { X } from "lucide-react";
import type { FilterField, FilterValues } from "@/components/report/ReportFilterDrawer";
import type {
  PerformanceActivity,
  PerformanceThresholdKey,
} from "@/api/player-performance/player-performance.api";
import type { ReportCurrency } from "@/api/reports/reports";
import type { VipTier } from "@/api/vip/vip";
import {
  DEFAULT_PERFORMANCE_FILTERS,
  type PerformanceFilters,
  type ThresholdParam,
  type Thresholds,
} from "@/store/player-performance-store";
import { currencyName, fmtCount, fmtExact, fmtUsd, tierLabel } from "./columns";

type Option<V extends string = string> = { value: V; label: string };

export const ACTIVITY_OPTIONS: Option<PerformanceActivity>[] = [
  { value: "active", label: "Active in range" },
  { value: "all", label: "All players" },
  { value: "depositors", label: "Depositors" },
  { value: "players", label: "Played games" },
  { value: "redeemers", label: "Redeemers" },
  { value: "referrers", label: "Referrers" },
];

const STATUS_OPTIONS: Option<PerformanceFilters["status"]>[] = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const RG_OPTIONS: Option<PerformanceFilters["rgStatus"]>[] = [
  { value: "all", label: "All RG Statuses" },
  { value: "ACTIVE", label: "No restriction" },
  { value: "PAUSED", label: "Paused" },
  { value: "SELF_EXCLUDED", label: "Self-excluded" },
  { value: "CLOSED", label: "Closed" },
];

const KYC_OPTIONS: Option<PerformanceFilters["kyc"]>[] = [
  { value: "all", label: "All KYC" },
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
  { value: "rejected", label: "Rejected" },
  { value: "not_started", label: "Not started" },
];

const SOURCE_OPTIONS: Option<PerformanceFilters["source"]>[] = [
  { value: "all", label: "All Sources" },
  { value: "direct", label: "Direct" },
  { value: "agent", label: "Agent" },
  { value: "subagent", label: "Sub-agent" },
  { value: "player", label: "Player referral" },
];

/** Mirrors ReportFilterDrawer's own list, so a chip names the preset the admin picked. */
const DATE_PRESET_LABELS: Record<string, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7: "Last 7 Days",
  last30: "Last 30 Days",
  thisMonth: "This Month",
  lastMonth: "Last Month",
};

type ThresholdUnit = "usd" | "amount" | "count";

export const THRESHOLD_FIELDS: { key: PerformanceThresholdKey; label: string; unit: ThresholdUnit }[] = [
  { key: "depositUsd", label: "Deposits", unit: "usd" },
  { key: "redeemUsd", label: "Redeemed", unit: "usd" },
  { key: "stake", label: "Wagered", unit: "amount" },
  { key: "playerPl", label: "Player P/L", unit: "amount" },
  { key: "ggr", label: "GGR", unit: "amount" },
  { key: "bonus", label: "Bonus", unit: "amount" },
];

function thresholdLabel(f: (typeof THRESHOLD_FIELDS)[number], currency: ReportCurrency) {
  if (f.unit === "usd") return `${f.label} (USD)`;
  if (f.unit === "amount") return `${f.label} (${currencyName(currency)})`;
  return f.label;
}

/**
 * Each tier NAME once ("Silver", not "Silver L1/L2/L3"), cheapest tier first.
 * The server filters by name across every level of it.
 */
export function uniqueTierNames(tiers: VipTier[]): string[] {
  const sorted = [...tiers].sort(
    (a, b) => (a.xp_required ?? 0) - (b.xp_required ?? 0) || (a.level ?? 0) - (b.level ?? 0),
  );
  const seen = new Set<string>();
  const names: string[] = [];
  for (const t of sorted) {
    const name = tierLabel(t.name);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    names.push(name);
  }
  return names;
}

export function buildFilterFields(
  tierNames: string[],
  currency: ReportCurrency,
  /** The applied tier, offered even if the tier list failed to load. */
  currentTier: string,
): FilterField[] {
  const names =
    currentTier !== "all" && !tierNames.includes(currentTier) ? [...tierNames, currentTier] : tierNames;
  return [
    { kind: "datePreset", label: "Date Range" },
    { kind: "dateRange" },
    { kind: "select", key: "activity", label: "Activity", options: ACTIVITY_OPTIONS },
    {
      kind: "select",
      key: "tierName",
      label: "VIP Tier",
      options: [{ value: "all", label: "All Tiers" }, ...names.map((n) => ({ value: n, label: n }))],
    },
    { kind: "select", key: "status", label: "Account Status", options: STATUS_OPTIONS },
    { kind: "select", key: "rgStatus", label: "Responsible Gaming", options: RG_OPTIONS },
    { kind: "select", key: "kyc", label: "KYC", options: KYC_OPTIONS },
    { kind: "select", key: "source", label: "Source", options: SOURCE_OPTIONS },
    ...THRESHOLD_FIELDS.map(
      (f): FilterField => ({ kind: "numberRange", key: f.key, label: thresholdLabel(f, currency) }),
    ),
  ];
}

const thresholdParams = (): ThresholdParam[] =>
  THRESHOLD_FIELDS.flatMap((f) => [`${f.key}Min`, `${f.key}Max`] as ThresholdParam[]);

export function toDrawerValues(f: PerformanceFilters): FilterValues {
  return {
    datePreset: f.datePreset,
    startDate: f.startDate,
    endDate: f.endDate,
    tierName: f.tierName,
    // Not a drawer field: it rides along so Apply keeps it and Reset clears it.
    game: f.game,
    status: f.status,
    rgStatus: f.rgStatus,
    kyc: f.kyc,
    source: f.source,
    activity: f.activity,
    ...f.thresholds,
  };
}

/** Reset hands the drawer these; every threshold is listed so Reset clears it. */
export const DRAWER_DEFAULTS: FilterValues = {
  ...toDrawerValues(DEFAULT_PERFORMANCE_FILTERS),
  ...Object.fromEntries(thresholdParams().map((p) => [p, undefined])),
};

const pick = <V extends string>(options: Option<V>[], value: unknown, fallback: V): V =>
  options.some((o) => o.value === value) ? (value as V) : fallback;

export function fromDrawerValues(v: FilterValues): PerformanceFilters {
  const thresholds: Thresholds = {};
  for (const param of thresholdParams()) {
    const n = v[param];
    if (typeof n === "number" && Number.isFinite(n)) thresholds[param] = n;
  }
  const startDate = v.startDate instanceof Date ? v.startDate : undefined;
  const endDate = v.endDate instanceof Date ? v.endDate : undefined;
  const preset = typeof v.datePreset === "string" ? v.datePreset : "all";
  return {
    // A cleared range is "all time" whatever the preset dropdown last said.
    datePreset: startDate || endDate ? preset : "all",
    startDate,
    endDate,
    tierName: typeof v.tierName === "string" && v.tierName ? v.tierName : "all",
    // Tags and trend are no longer offered as table filters.
    tag: "all",
    trend: "all",
    game: typeof v.game === "string" ? v.game.trim() : "",
    status: pick(STATUS_OPTIONS, v.status, "all"),
    rgStatus: pick(RG_OPTIONS, v.rgStatus, "all"),
    kyc: pick(KYC_OPTIONS, v.kyc, "all"),
    source: pick(SOURCE_OPTIONS, v.source, "all"),
    activity: pick(ACTIVITY_OPTIONS, v.activity, "active"),
    thresholds,
  };
}

/* ------------------------------------------------------------------ */
/* Chips                                                               */
/* ------------------------------------------------------------------ */

export interface FilterChip {
  id: string;
  label: string;
  /** The filters with this one taken back to its default. */
  clear: (f: PerformanceFilters) => PerformanceFilters;
}

const labelOf = <V extends string>(options: Option<V>[], value: V) =>
  options.find((o) => o.value === value)?.label ?? value;

function formatThreshold(n: number, unit: ThresholdUnit) {
  if (unit === "usd") return fmtUsd(n);
  if (unit === "count") return fmtCount(n);
  return fmtExact(n);
}

export function buildChips(f: PerformanceFilters, currency: ReportCurrency): FilterChip[] {
  const chips: FilterChip[] = [];

  if (f.startDate || f.endDate) {
    const day = (d: Date) => format(d, "MMM d, yyyy");
    const named = DATE_PRESET_LABELS[f.datePreset];
    const label = named
      ? named
      : f.startDate && f.endDate
        ? `${day(f.startDate)} – ${day(f.endDate)}`
        : f.startDate
          ? `From ${day(f.startDate)}`
          : `Until ${day(f.endDate as Date)}`;
    chips.push({
      id: "date",
      label: `Date: ${label}`,
      clear: (x) => ({ ...x, datePreset: "all", startDate: undefined, endDate: undefined }),
    });
  }

  if (f.activity !== DEFAULT_PERFORMANCE_FILTERS.activity) {
    chips.push({
      id: "activity",
      label: `Activity: ${labelOf(ACTIVITY_OPTIONS, f.activity)}`,
      clear: (x) => ({ ...x, activity: DEFAULT_PERFORMANCE_FILTERS.activity }),
    });
  }

  if (f.tierName !== "all") {
    chips.push({
      id: "tier",
      label: `Tier: ${tierLabel(f.tierName) ?? f.tierName}`,
      clear: (x) => ({ ...x, tierName: "all" }),
    });
  }

  if (f.game) {
    chips.push({
      id: "game",
      label: `Game: “${f.game}”`,
      clear: (x) => ({ ...x, game: "" }),
    });
  }

  if (f.status !== "all") {
    chips.push({
      id: "status",
      label: `Status: ${labelOf(STATUS_OPTIONS, f.status)}`,
      clear: (x) => ({ ...x, status: "all" }),
    });
  }

  if (f.rgStatus !== "all") {
    chips.push({
      id: "rg",
      label: `RG: ${labelOf(RG_OPTIONS, f.rgStatus)}`,
      clear: (x) => ({ ...x, rgStatus: "all" }),
    });
  }

  if (f.kyc !== "all") {
    chips.push({
      id: "kyc",
      label: `KYC: ${labelOf(KYC_OPTIONS, f.kyc)}`,
      clear: (x) => ({ ...x, kyc: "all" }),
    });
  }

  if (f.source !== "all") {
    chips.push({
      id: "source",
      label: `Source: ${labelOf(SOURCE_OPTIONS, f.source)}`,
      clear: (x) => ({ ...x, source: "all" }),
    });
  }

  for (const field of THRESHOLD_FIELDS) {
    const minKey = `${field.key}Min` as ThresholdParam;
    const maxKey = `${field.key}Max` as ThresholdParam;
    const min = f.thresholds[minKey];
    const max = f.thresholds[maxKey];
    if (min === undefined && max === undefined) continue;
    const name = thresholdLabel(field, currency);
    const range =
      min !== undefined && max !== undefined
        ? `${formatThreshold(min, field.unit)} – ${formatThreshold(max, field.unit)}`
        : min !== undefined
          ? `≥ ${formatThreshold(min, field.unit)}`
          : `≤ ${formatThreshold(max as number, field.unit)}`;
    chips.push({
      id: `threshold-${field.key}`,
      label: `${name} ${range}`,
      clear: (x) => {
        const thresholds = { ...x.thresholds };
        delete thresholds[minKey];
        delete thresholds[maxKey];
        return { ...x, thresholds };
      },
    });
  }

  return chips;
}

export function FilterChips({
  chips,
  onRemove,
  onClearAll,
}: {
  chips: FilterChip[];
  onRemove: (chip: FilterChip) => void;
  onClearAll: () => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#B93DEB]/40 bg-[#B93DEB]/10 py-1 pl-3 pr-1.5 text-xs text-gray-200"
        >
          <span className="truncate">{chip.label}</span>
          <button
            type="button"
            onClick={() => onRemove(chip)}
            aria-label={`Remove filter ${chip.label}`}
            className="rounded-full p-0.5 text-gray-400 hover:bg-[#B93DEB]/30 hover:text-white"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="text-xs text-gray-400 underline-offset-2 hover:text-white hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}
