"use client";

import ExportCSV, { type ExportDateRange } from "@/components/ExportCSV/ExportCSV";
import {
  playerPerformanceApi,
  type PlayerPerformanceRow,
} from "@/api/player-performance/player-performance.api";
import type { ReportCurrency } from "@/api/reports/reports";
import { toReportDay } from "@/lib/utils";
import {
  buildPerformanceQuery,
  usePlayerPerformanceStore,
} from "@/store/player-performance-store";
import { currencyName, tierLabel } from "./columns";

/** The API's maximum page size. */
const EXPORT_PAGE_SIZE = 1000;
/** 50,000 players — one click must not be able to pull the table indefinitely. */
const MAX_EXPORT_PAGES = 50;

type ExportKind = "text" | "usd" | "amount" | "count";

interface ExportColumn {
  header: string;
  kind: ExportKind;
  value: (row: PlayerPerformanceRow) => string | number | null;
}

const utc = (value: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toISOString().replace("T", " ").slice(0, 19);
};

/**
 * Email leads, as on screen; rows come in the table's sort order. Every
 * figure the table shows is here, plus the balances.
 */
function exportColumns(currency: ReportCurrency): ExportColumn[] {
  const cur = currencyName(currency);
  return [
    { header: "Email", kind: "text", value: (r) => r.email },
    { header: "Phone", kind: "text", value: (r) => r.phone },
    { header: "Username", kind: "text", value: (r) => r.username },
    { header: "User ID", kind: "text", value: (r) => r.userId },
    { header: "Login", kind: "text", value: (r) => r.contact },
    { header: "VIP Tier", kind: "text", value: (r) => tierLabel(r.tierName) },
    { header: "Account Status", kind: "text", value: (r) => (r.isActive ? "Active" : "Inactive") },
    { header: "RG Status", kind: "text", value: (r) => r.rgStatus },
    { header: "KYC", kind: "text", value: (r) => r.kycStatus },
    { header: "Source", kind: "text", value: (r) => r.source },
    { header: "Joined (UTC)", kind: "text", value: (r) => utc(r.joinedAt) },
    { header: "Last Seen (UTC)", kind: "text", value: (r) => utc(r.lastSeenAt) },

    // Recent activity: relative to today, whatever the range.
    { header: "Days Inactive", kind: "count", value: (r) => r.daysInactive },
    { header: "Last Played (UTC)", kind: "text", value: (r) => utc(r.lastPlayedAt) },
    { header: "Last Deposit Day (UTC)", kind: "text", value: (r) => r.lastDepositDay },
    { header: "Last Redeem (UTC)", kind: "text", value: (r) => utc(r.lastRedeemAt) },
    { header: "Rounds Last 7 Days", kind: "count", value: (r) => r.rounds7d },
    { header: "Rounds Previous 7 Days", kind: "count", value: (r) => r.roundsPrev7d },
    { header: "Deposits Last 7 Days (USD)", kind: "usd", value: (r) => r.deposit7d },
    { header: "Deposits Previous 7 Days (USD)", kind: "usd", value: (r) => r.depositPrev7d },

    { header: "Deposits (USD)", kind: "usd", value: (r) => r.depositUsd },
    { header: "Deposit Count", kind: "count", value: (r) => r.depositCount },
    { header: "Max Deposit (USD)", kind: "usd", value: (r) => r.maxDepositUsd },
    { header: "First Deposit Day (UTC)", kind: "text", value: (r) => r.firstDepositDay },
    { header: "Redeemed (USD)", kind: "usd", value: (r) => r.redeemUsd },
    { header: "Redeem Count", kind: "count", value: (r) => r.redeemCount },
    { header: "Pending Redeem Now (USD)", kind: "usd", value: (r) => r.pendingRedeemUsd },

    { header: "Top Game", kind: "text", value: (r) => r.topGame?.gameName ?? null },
    { header: "Top Game Provider", kind: "text", value: (r) => r.topGame?.provider ?? null },
    { header: "Top Game Rounds", kind: "count", value: (r) => r.topGame?.rounds ?? null },
    { header: "Active Days", kind: "count", value: (r) => r.activeDays },
    { header: `Wagered (${cur})`, kind: "amount", value: (r) => r.stake },
    { header: `Payout (${cur})`, kind: "amount", value: (r) => r.win },
    { header: `Player P/L (${cur})`, kind: "amount", value: (r) => r.playerPl },
    { header: `GGR (${cur})`, kind: "amount", value: (r) => r.ggr },

    { header: `Bonus (${cur})`, kind: "amount", value: (r) => r.bonus },
    { header: `NGR (${cur})`, kind: "amount", value: (r) => r.ngr },

    { header: "Referrals", kind: "count", value: (r) => r.referrals },
    { header: "Referrals Deposited", kind: "count", value: (r) => r.referralsQualified },

    { header: "Wulf Cash Balance Now", kind: "amount", value: (r) => r.balance?.wulfCash ?? null },
    { header: "Bonus Wulf Cash Balance Now", kind: "amount", value: (r) => r.balance?.bonusWulfCash ?? null },
    { header: "Redeemable Wulf Cash Now", kind: "amount", value: (r) => r.balance?.redeemableWulfCash ?? null },
    { header: "Wulf Coin Balance Now", kind: "amount", value: (r) => r.balance?.wulfCoin ?? null },
  ];
}

/** Numbers stay numbers (so the sheet can sum them), rounded to what the UI shows. */
function cellValue(col: ExportColumn, row: PlayerPerformanceRow): string | number {
  const v = col.value(row);
  if (v === null || v === undefined || v === "") return "";
  if (col.kind === "text") return String(v);
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "";
  if (col.kind === "count") return n;
  const r = Math.round(n * 100) / 100;
  return r === 0 ? 0 : r;
}

/**
 * The admin's standard export (ExportCSV): the same icon button, the same
 * "Export range" popover (All data / Last 7 days / Last 30 days / Custom) and
 * the same styled Excel file as every other listing.
 *
 * The popover range is the window the figures are computed over — "All data"
 * is all time. Every other setting on screen (search, filters, currency and
 * sort) carries into the file, and it holds EVERY matching player, not just
 * the page on screen.
 */
export default function ExportMenu({ disabled }: { disabled?: boolean }) {
  const { data, currency } = usePlayerPerformanceStore();
  const cols = exportColumns(currency);

  const fetchAll = async (range: ExportDateRange): Promise<PlayerPerformanceRow[]> => {
    // Snapshot at click time; page, limit and dates are replaced below.
    const base = buildPerformanceQuery(usePlayerPerformanceStore.getState());
    const dates = { startDate: toReportDay(range.from), endDate: toReportDay(range.to) };

    const rows: PlayerPerformanceRow[] = [];
    // The gameplay rollup refreshes every few minutes, so a player can move
    // across a page boundary mid-export; keep the first sighting only.
    const seen = new Set<string>();
    let pages = 1;
    // Sequential on purpose: each page is a server-side aggregate; firing them
    // in parallel would only queue behind the API's read limit.
    for (let page = 1; page <= Math.min(pages, MAX_EXPORT_PAGES); page++) {
      const res = await playerPerformanceApi.list({
        ...base,
        ...dates,
        page,
        limit: EXPORT_PAGE_SIZE,
      });
      pages = res.totalPages;
      if (!res.items.length) break;
      for (const r of res.items) {
        if (seen.has(r.userId)) continue;
        seen.add(r.userId);
        rows.push(r);
      }
    }
    return rows;
  };

  const fileName = `player-performance_${currency}.xlsx`;

  return (
    <ExportCSV<PlayerPerformanceRow>
      data={data?.items ?? []}
      headers={cols.map((c) => c.header)}
      fileName={fileName}
      mapRow={(row) => cols.map((c) => cellValue(c, row))}
      fetchAll={fetchAll}
      locked={disabled}
    />
  );
}
