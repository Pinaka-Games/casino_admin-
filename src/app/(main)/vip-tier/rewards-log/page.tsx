"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import CopyButton from "@/components/CopyButton";
import Image from "next/image";
import { coingold, coingreen } from "@/assets/icons";
import {
  SortableTh,
  useSortedRows,
  useTableSort,
} from "@/components/filters/tableSort";
import FilterToolbar from "@/components/filters/FilterToolbar";
import EntityFilterSheet from "@/components/filters/EntityFilterSheet";
import { useEntityFilters } from "@/components/filters/useEntityFilters";
import { applyClientFilters } from "@/components/filters/applyClientFilters";
import type { FilterField, FilterValues } from "@/components/filters/types";

import NoData from "@/components/NoData";
import Pagination from "@/components/Pagination";
import ExportCSV from "@/components/ExportCSV";
import { getRewardLogs, RewardLogRow } from "@/api/reports/instant-rebate.api";
import { UserVipProgress, vipAdminApi } from "@/api/vip/vip";
import { profileApi } from "@/api/users/users";


/* ============================
   CONSTANTS
============================ */
const PAGE_SIZE = 10;
const TIER_REGEX =
  /\b(bronze|silver|gold|platinum|diamond|ruby|emerald|sapphire)\s*[-_ ]?(\d+)\b/i;

/* ============================
   TYPES
============================ */
interface VipRewardLogRow {
  id: number;
  username: string;
  feature: string;
  currentTier: string;
  rewardTier: string;
  rewardAt: string;
  rewardAmount: number;
  coinAmount: number;
  cashAmount: number;
  bonusCashAmount: number;
}

interface NormalizedRewardLogRow {
  rowId: string;
  usernameLabel: string;
  usernameDisplay: string;
  userId: string | null;
  description: string;
  source: string;
  provider: string;
  rewardAmount: number;
  rewardAtIso: string;
  rewardAtDate: string;
  rewardAtDateTime: string;
  rewardTier: string;
  feature: string;
  coinAmount: number;
  cashAmount: number;
  bonusCashAmount: number;
}

/**
 * Only two currencies exist as far as a player is concerned: Gold Coin and
 * Sweep Coin. `bonusWulfCash` is not a third one — it is Sweep Coin credited
 * behind a wagering rollover, and the player app shows it as "SC" on the same
 * green coin, summed into the same balance. Daily Streak pays into it whenever
 * cash wagering is enabled, so the log folds it back into Sweep Coin rather
 * than reporting a currency the player never sees.
 */
const CURRENCY_META = [
  { key: "coinAmount", label: "Gold Coin", icon: coingold, tone: "text-yellow-500" },
  { key: "cashAmount", label: "Sweep Coin", icon: coingreen, tone: "text-green-400" },
] as const;

const formatValue = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

interface RawAmounts {
  coinAmount: number;
  cashAmount: number;
  bonusCashAmount: number;
}

interface CurrencyAmounts {
  coinAmount: number;
  cashAmount: number;
}

/**
 * Wagering-locked Sweep Coin is still Sweep Coin, so the two columns are added
 * before anything is rendered. The locked share is kept alongside only to
 * caption the line for an admin — it is not shown as its own amount.
 */
function toDisplayAmounts(raw: RawAmounts): CurrencyAmounts {
  return {
    coinAmount: raw.coinAmount,
    cashAmount: raw.cashAmount + raw.bonusCashAmount,
  };
}

/**
 * One entry per currency, icon + tier colour, slash separated. `showZero`
 * keeps every currency visible for the footer total, where a column has to
 * account for all three even when one of them never moved.
 */
function AmountBreakdown({
  raw,
  showZero = false,
  strong = false,
}: {
  raw: RawAmounts;
  showZero?: boolean;
  strong?: boolean;
}) {
  const amounts = toDisplayAmounts(raw);
  const lines = CURRENCY_META.filter(
    (meta) => showZero || amounts[meta.key] > 0,
  );

  const caption = (key: (typeof CURRENCY_META)[number]["key"], label: string) =>
    key === "cashAmount" && raw.bonusCashAmount > 0
      ? `${label} (${formatValue(raw.bonusCashAmount)} locked by wagering)`
      : label;

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1">
      {lines.map((meta, index) => (
        <React.Fragment key={meta.key}>
          {index > 0 && <span className="text-gray-600">/</span>}
          <span
            className="inline-flex items-center gap-1 whitespace-nowrap"
            title={caption(meta.key, meta.label)}
          >
            <Image src={meta.icon} alt={meta.label} width={16} height={16} />
            <span
              className={`tabular-nums ${strong ? "font-semibold" : "font-medium"} ${meta.tone}`}
            >
              {formatValue(amounts[meta.key])}
            </span>
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

/** One row's payout. */
function AmountCell({
  amounts,
  fallback,
}: {
  amounts: RawAmounts;
  fallback: number;
}) {
  const display = toDisplayAmounts(amounts);
  const hasCurrency = CURRENCY_META.some((meta) => display[meta.key] > 0);

  // Legacy rows predate the per-currency columns and only carry a total, so
  // there is no currency to label them with.
  if (!hasCurrency) {
    return (
      <span className="tabular-nums text-gray-300">{formatValue(fallback)}</span>
    );
  }

  return <AmountBreakdown raw={amounts} />;
}

/** Flat "10.00 GC / 5.00 SC" form, for the CSV. */
function amountsText(amounts: RawAmounts, fallback: number): string {
  const display = toDisplayAmounts(amounts);
  const parts = CURRENCY_META.filter((meta) => display[meta.key] > 0).map(
    (meta) => `${formatValue(display[meta.key])} ${meta.label}`,
  );
  return parts.length ? parts.join(" / ") : formatValue(fallback);
}

function formatDateOnly(date?: Date): string | undefined {
  if (!date) return undefined;
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function extractUserId(usernameLabel: string): string | null {
  const match = usernameLabel.match(/\(ID:\s*([^)]+)\)\s*$/i);
  return match?.[1] ?? null;
}

function parseAmount(value: string | number | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function titleCase(input: string): string {
  return input
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function resolveProvider(source?: string, description?: string): string {
  const normalizedSource = (source || "").trim().toUpperCase();
  const normalizedDescription = (description || "").toLowerCase();
  if (normalizedSource === "DAILY_STREAK") return "Daily Streak";
  if (normalizedSource === "LEVEL_UP_BONUS") return "Level Up Bonus";
  if (normalizedSource === "RAKEBACK") {
    if (normalizedDescription.includes("instant rebate")) {
      return "Instant Rebate (slots)";
    }
    return "Rakeback";
  }
  return source ? titleCase(source.replace(/[_-]+/g, " ")) : "-";
}

function resolveVipFeature(source?: string, description?: string): string {
  const normalizedSource = (source || "").trim().toUpperCase();
  const normalizedDescription = (description || "").toLowerCase();
  const combined = `${normalizedSource} ${normalizedDescription}`;

  const cashbackPeriod = (() => {
    if (/\bhourly\b|\bhour\b/.test(combined)) return "Hourly";
    if (/\bdaily\b|\bday\b/.test(combined)) return "Daily";
    if (/\bweekly\b|\bweek\b/.test(combined)) return "Weekly";
    if (/\bmonthly\b|\bmonth\b/.test(combined)) return "Monthly";
    return "";
  })();

  if (normalizedSource === "DAILY_STREAK") return "Daily Streak";
  if (normalizedSource === "INSTANT_REBATE") return "Instant Rebate";
  if (normalizedSource === "CASHBACK") {
    return cashbackPeriod ? `Cashback - ${cashbackPeriod}` : "Cashback";
  }
  if (normalizedSource === "RAKEBACK") {
    if (normalizedDescription.includes("instant rebate")) return "Instant Rebate";
    return cashbackPeriod ? `Cashback - ${cashbackPeriod}` : "Cashback";
  }
  if (normalizedSource === "LEVEL_UP_BONUS") return "Level Up Bonus";

  return resolveProvider(source, description);
}

function toDateOnly(isoValue: string): string {
  if (!isoValue) return "-";
  const d = new Date(isoValue);
  if (Number.isNaN(d.getTime())) return isoValue;
  return d.toISOString().slice(0, 10);
}

function toDateTime(isoValue: string): string {
  if (!isoValue) return "-";
  const d = new Date(isoValue);
  if (Number.isNaN(d.getTime())) return isoValue;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function parseUsername(usernameLabel: string): { usernameDisplay: string; userId: string | null } {
  const userId = extractUserId(usernameLabel);
  const usernameDisplay = usernameLabel.replace(/\s*\(ID:\s*[^)]+\)\s*$/i, "").trim();
  return {
    usernameDisplay: usernameDisplay || usernameLabel || "-",
    userId,
  };
}

function deriveRewardTier(description: string): string {
  const match = description?.match(TIER_REGEX);
  if (!match) return "-";
  return `${titleCase(match[1])} ${match[2]}`;
}


/** The log is fetched for a date window, so the range starts populated. */
function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 7);
  return { from: formatDateOnly(from) ?? "", to: formatDateOnly(to) ?? "" };
}

const REWARD_LOG_DEFAULTS: FilterValues = {
  search: "",
  feature: "all",
  ...defaultRange(),
  minAmount: "",
  maxAmount: "",
};
export default function VipRewardsLogPage() {
  const [logs, setLogs] = useState<RewardLogRow[]>([]);

  // Offer only the features the loaded window actually contains — a fixed list
  // would show options that always return nothing.
  const featureOptions = useMemo(() => {
    const seen = new Set<string>();
    logs.forEach((row) => {
      const feature = resolveVipFeature(row.source, row.description);
      if (feature && feature !== "-") seen.add(feature);
    });
    return [
      { label: "All features", value: "all" },
      ...Array.from(seen)
        .sort((a, b) => a.localeCompare(b))
        .map((feature) => ({ label: feature, value: feature })),
    ];
  }, [logs]);

  const rewardLogFields = useMemo<FilterField[]>(
    () => [
      { type: "dateRange", fromKey: "from", toKey: "to", label: "Date Range" },
      {
        type: "select",
        key: "feature",
        label: "VIP Feature",
        options: featureOptions,
      },
      {
        type: "numberRange",
        minKey: "minAmount",
        maxKey: "maxAmount",
        label: "Reward Amount",
      },
    ],
    [featureOptions],
  );

  const {
    values: filters,
    setValues: setFilters,
    searchInput,
    setSearchInput,
    sheetOpen,
    setSheetOpen,
    chips,
    activeCount,
    hasAnyFilter,
    reset: resetFilters,
  } = useEntityFilters({
    fields: rewardLogFields,
    defaults: REWARD_LOG_DEFAULTS,
  });
  const [progressMap, setProgressMap] = useState<Record<string, UserVipProgress>>({});
  const [emailMap, setEmailMap] = useState<Record<string, string | null>>({});
  const [totals, setTotals] = useState({ coin: 0, cash: 0, bonusCash: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getRewardLogs({
        userType: "USER",
        startDate: filters.from || undefined,
        endDate: filters.to || undefined,
      });

      const fetchedItems = response?.items ?? [];
      setLogs(fetchedItems);
      setTotals({
        coin: parseAmount(response?.totalCoinAmount),
        cash: parseAmount(response?.totalCashAmount),
        bonusCash: parseAmount(response?.totalBonusCashAmount),
      });
      setProgressMap({});
      setEmailMap({});
      setCurrentPage(1);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load rewards log");
      setLogs([]);
      setTotals({ coin: 0, cash: 0, bonusCash: 0 });
    } finally {
      setLoading(false);
    }
  }, [filters.from, filters.to]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const normalizedRows = useMemo<NormalizedRewardLogRow[]>(() => {
    return [...logs]
      .map((row, index) => {
        const { usernameDisplay, userId } = parseUsername(row.username || "");
        return {
          rowId: `${row.transactionDate}-${row.username}-${index}`,
          usernameLabel: row.username || "-",
          usernameDisplay,
          userId,
          description: row.description || "",
          source: row.source || "",
          provider: resolveProvider(row.source, row.description),
          rewardAmount: parseAmount(row.amount),
          rewardAtIso: row.transactionDate || "",
          rewardAtDate: toDateOnly(row.transactionDate),
          rewardAtDateTime: toDateTime(row.transactionDate),
          rewardTier: deriveRewardTier(row.description || ""),
          feature: resolveVipFeature(row.source, row.description),
          coinAmount: parseAmount(row.coinAmount),
          cashAmount: parseAmount(row.cashAmount),
          bonusCashAmount: parseAmount(row.bonusCashAmount),
        };
      })
      .sort((a, b) => {
        const at = new Date(a.rewardAtIso).getTime();
        const bt = new Date(b.rewardAtIso).getTime();
        if (!Number.isNaN(at) && !Number.isNaN(bt)) return bt - at;
        return b.rowId.localeCompare(a.rowId);
      });
  }, [logs]);


  /* ============================
     PAGINATION
  ============================ */
  const filteredRows = useMemo<NormalizedRewardLogRow[]>(
    () =>
      applyClientFilters(normalizedRows, filters, {
        search: (row) => [
          row.usernameLabel,
          row.usernameDisplay,
          (row.userId ? emailMap[row.userId] : null) || "",
          row.description,
          row.source,
          row.provider,
          row.rewardTier,
        ],
        selects: [
          {
            key: "feature",
            match: (row, v) => row.feature === v,
          },
        ],
        dateRange: { fromKey: "from", toKey: "to", get: (row) => row.rewardAtIso },
        numberRanges: [
          { minKey: "minAmount", maxKey: "maxAmount", get: (row) => Number(row.rewardAmount || 0) },
        ],
      }),
    [normalizedRows, filters, emailMap],
  );

  // The log is loaded whole and paged locally, so sorting covers every reward.
  const { sort, toggle } = useTableSort<"date" | "amount" | "user">();
  const visibleRows = useSortedRows(filteredRows, sort, {
    date: (row) => new Date(row.rewardAtIso).getTime(),
    amount: (row) => Number(row.rewardAmount) || 0,
    user: (row) => row.usernameDisplay || row.usernameLabel,
  });

  const totalPages = Math.max(Math.ceil(visibleRows.length / PAGE_SIZE), 1);

  const paginatedRows = useMemo<NormalizedRewardLogRow[]>(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return visibleRows.slice(start, start + PAGE_SIZE);
  }, [currentPage, visibleRows]);

  // A narrowed filter can leave fewer pages than the one being viewed.
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  useEffect(() => {
    const missingIds = paginatedRows
      .map((row) => row.userId)
      .filter((id): id is string => id !== null)
      .filter((id) => !progressMap[id]);

    const uniqueMissingIds = Array.from(new Set(missingIds));
    if (uniqueMissingIds.length === 0) return;

    let cancelled = false;

    const fetchProgress = async () => {
      const results = await Promise.allSettled(
        uniqueMissingIds.map((userId) => vipAdminApi.getUserVipProgress(userId)),
      );

      if (cancelled) return;

      setProgressMap((prev) => {
        const next = { ...prev };
        results.forEach((result, index) => {
          if (result.status === "fulfilled") {
            next[uniqueMissingIds[index]] = result.value.data;
          }
        });
        return next;
      });
    };

    void fetchProgress();

    return () => {
      cancelled = true;
    };
  }, [paginatedRows, progressMap]);

  useEffect(() => {
    const missingIds = normalizedRows
      .map((row) => row.userId)
      .filter((id): id is string => id !== null)
      .filter((id) => emailMap[id] === undefined);

    const uniqueMissingIds = Array.from(new Set(missingIds));
    if (uniqueMissingIds.length === 0) return;

    let cancelled = false;

    const fetchEmails = async () => {
      const results = await Promise.allSettled(
        uniqueMissingIds.map((userId) => profileApi.getUserProfile(userId)),
      );

      if (cancelled) return;

      setEmailMap((prev) => {
        const next = { ...prev };
        results.forEach((result, index) => {
          const userId = uniqueMissingIds[index];
          if (result.status === "fulfilled") {
            const data = result.value.data as any;
            const emailCandidate =
              data?.email ||
              data?.profile?.email ||
              (typeof data?.entity === "string" && data.entity.includes("@")
                ? data.entity
                : null);
            next[userId] = typeof emailCandidate === "string" && emailCandidate.trim()
              ? emailCandidate.trim()
              : null;
          } else {
            next[userId] = null;
          }
        });
        return next;
      });
    };

    void fetchEmails();

    return () => {
      cancelled = true;
    };
  }, [normalizedRows, emailMap]);

  const tableRows = useMemo<VipRewardLogRow[]>(() => {
    return paginatedRows.map((row, index) => {
      const progress = row.userId ? progressMap[row.userId] : undefined;
      const currentTier = progress?.currentTier
        ? progress.currentTier.name
        : "-";
      const rewardTier = row.rewardTier !== "-" ? row.rewardTier : currentTier;
      const email = row.userId ? emailMap[row.userId] : null;
      const identityText = email || row.usernameDisplay;
      const usernameCell = identityText;

      return {
        id: (currentPage - 1) * PAGE_SIZE + index + 1,
        username: usernameCell,
        feature: row.feature,
        currentTier,
        rewardTier,
        rewardAt: row.rewardAtDateTime,
        rewardAmount: row.rewardAmount,
        coinAmount: row.coinAmount,
        cashAmount: row.cashAmount,
        bonusCashAmount: row.bonusCashAmount,
      };
    });
  }, [paginatedRows, progressMap, currentPage, emailMap]);


  /* ============================
     EXPORT
  ============================ */
  const exportRows = useMemo<VipRewardLogRow[]>(() => {
    return normalizedRows.map((row, index) => {
      const progress = row.userId ? progressMap[row.userId] : undefined;
      const currentTier = progress?.currentTier
        ? progress.currentTier.name
        : "-";
      const rewardTier = row.rewardTier !== "-" ? row.rewardTier : currentTier;
      const email = row.userId ? emailMap[row.userId] : null;
      const identityText = email || row.usernameDisplay;
      const usernameCell = identityText;

      return {
        id: index + 1,
        username: usernameCell,
        feature: row.feature,
        currentTier,
        rewardTier,
        rewardAt: row.rewardAtDateTime,
        rewardAmount: row.rewardAmount,
        coinAmount: row.coinAmount,
        cashAmount: row.cashAmount,
        bonusCashAmount: row.bonusCashAmount,
      };
    });
  }, [normalizedRows, progressMap, emailMap]);

  return (
    <div className="h-full bg-[#0a0e1a] p-3 md:p-6 text-white">
      {/* GRID LAYOUT */}
      <div className="h-full grid grid-rows-[auto_auto_1fr_auto] gap-4">

        {/* HEADER */}
        <div className="bg-[#191D24] rounded-lg px-3 py-2 md:px-4">
          <h1 className="text-white text-base font-normal">
            VIP / Rewards Log
          </h1>
        </div>

        <FilterToolbar
          title="Rewards Log"
          countLabel={`${visibleRows.length} ${visibleRows.length === 1 ? "reward" : "rewards"}`}
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          searchPlaceholder="Search user, description or source"
          activeCount={activeCount}
          chips={chips}
          hasAnyFilter={hasAnyFilter}
          onOpenFilters={() => setSheetOpen(true)}
          onResetAll={resetFilters}
          actions={
            <ExportCSV
                data={exportRows}
                fileName="vip_rewards_log.csv"
                getRowDate={(row) => row.rewardAt}
                headers={[
                  "ID",
                  "User / Email",
                  "VIP Feature",
                  "Current Tier",
                  "Reward Tier",
                  "Reward At",
                  "Reward Amount",
                ]}
                mapRow={(row) => [
                  row.id,
                  row.username,
                  row.feature,
                  row.currentTier,
                  row.rewardTier,
                  row.rewardAt,
                  amountsText(row, row.rewardAmount),
              ]}
            />
          }
        />

        <EntityFilterSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title="Rewards Log Filters"
          description="Filter VIP reward payouts"
          fields={rewardLogFields}
          values={filters}
          defaults={REWARD_LOG_DEFAULTS}
          onApply={setFilters}
        />

        {/*  ONLY TABLE SCROLLS */}
        <div className="bg-[#15181E] rounded-lg overflow-hidden">
          <div className="h-full overflow-x-auto overflow-y-auto">
            <table className="min-w-[1320px] items-center justify-center text-center table-fixed w-full">
              <thead className="bg-[#242B35] sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-xs text-white">ID</th>
                  <SortableTh
                    label="User / Email"
                    sortKey="user"
                    sort={sort}
                    onToggle={toggle}
                    className="px-4 py-3 text-xs text-white"
                  />
                  <th className="px-4 py-3 text-xs text-white">VIP Feature</th>
                  <th className="px-4 py-3 text-xs text-white">Current Tier</th>
                  <th className="px-4 py-3 text-xs text-white">Reward Tier</th>
                  <SortableTh
                    label="Reward Date & Time"
                    sortKey="date"
                    sort={sort}
                    onToggle={toggle}
                    className="px-4 py-3 text-xs text-white"
                  />
                  <SortableTh
                    label="Amount (Cash / Coins)"
                    sortKey="amount"
                    sort={sort}
                    onToggle={toggle}
                    align="right"
                    className="px-4 py-3 text-xs text-white text-right w-[340px]"
                  />
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-gray-400 text-sm">
                      Loading rewards logs...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-red-400 text-sm">
                      {error}
                    </td>
                  </tr>
                ) : tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-20">
                      <NoData title="No data found" />
                    </td>
                  </tr>
                ) : (
                  tableRows.map((row, index) => (
                    <tr
                      key={row.id}
                      className={
                        index % 2 === 0
                          ? "bg-[#191D24]"
                          : "bg-[#161A21]"
                      }
                    >
                      <td className="px-4 py-3 text-xs text-gray-300">
                        {row.id}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-300">
                        <span className="flex items-center gap-1.5">
                          <span className="min-w-0 break-all">{row.username}</span>
                          <CopyButton value={row.username} size={12} />
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-300">
                        {row.feature}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-300">
                        {row.currentTier}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-300">
                        {row.rewardTier}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-300">
                        {row.rewardAt}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-300 text-right font-medium">
                        <AmountCell amounts={row} fallback={row.rewardAmount} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              <tfoot>
                <tr className="bg-[#242B35]">
                  <td colSpan={6} className="px-4 py-3 text-white font-medium">
                    Total
                  </td>
                  <td className="px-4 py-3 text-white font-medium text-right">
                    {/* Coins and cash are different currencies, so they are
                        totalled separately rather than added together. */}
                    <AmountBreakdown
                      showZero
                      strong
                      raw={{
                        coinAmount: totals.coin,
                        cashAmount: totals.cash,
                        bonusCashAmount: totals.bonusCash,
                      }}
                    />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* PAGINATION (FIXED, NO SCROLL) */}
        {!loading && !error && totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}
      </div>
    </div>
  );
}
