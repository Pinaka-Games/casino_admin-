"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Wrench,
  Calendar,
  ChevronDown,
  Search,
  X,
  ArrowLeft,
  Mail,
  Share2,
  Tag as TagIcon,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  ArrowRightLeft,
} from "lucide-react";

import { coingold, coingreen, coinpurple } from "@/assets/icons";

import DatePicker from "@/components/DatePicker";
import Pagination from "@/components/Pagination";
import NoData from "@/components/NoData";
import ExportCSV from "@/components/ExportCSV";
import CopyButton from "@/components/CopyButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import toast from "react-hot-toast";
import {
  DepositListingRow,
  DepositListingSummary,
  DepositTagTotals,
  manualDepositApi,
  ManualDepositStatus,
  formatManualDepositTag,
} from "@/api/manual-deposit/manual-deposit.api";
import { subscriptionChangeApi } from "@/api/subscription-change/subscription-change.api";
import { balanceAdjustmentApi } from "@/api/wallet/balance-adjustment.api";

/* ============================================================ */

const PAGE_SIZE = 10;
// Per-request page size used while pulling the full dataset (see `fetchAll`).
const FETCH_CHUNK = 500;
const MAX_CHUNKS = 20;

const formatDateTime = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}, ${d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "ALL", label: "All Statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const statusLabel = (v: string) =>
  STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v;

/** Money direction. A balance edit that raises one figure and lowers another
    (MIXED) shows under both. */
const TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "ALL", label: "All Types" },
  { value: "CREDIT", label: "Credit" },
  { value: "DEBIT", label: "Debit" },
];

const DIRECTION_META: Record<string, { label: string; tone: string }> = {
  CREDIT: { label: "Credit", tone: "text-green-400 bg-green-500/10 border-green-500/20" },
  DEBIT: { label: "Debit", tone: "text-red-400 bg-red-500/10 border-red-500/20" },
  MIXED: { label: "Credit / Debit", tone: "text-amber-300 bg-amber-500/10 border-amber-500/20" },
};

function DirectionBadge({ direction }: { direction?: string | null }) {
  const meta = direction ? DIRECTION_META[direction] : undefined;
  if (!meta) return <span className="text-xs text-gray-500">—</span>;
  return (
    <span
      className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${meta.tone}`}
    >
      {meta.label}
    </span>
  );
}

const CURRENCY_LABELS: Record<string, string> = {
  wulfCash: "Wulf Cash",
  bonusWulfCash: "Bonus Wulf Cash",
  wulfCoin: "Wulf Coin",
};

// Grouping (a coin+cash pair collapses into one row) and the merge with
// subscription changes now happen in SQL, so a page holds exactly PAGE_SIZE
// rendered rows and the client never downloads the whole dataset.
type DisplayRow = DepositListingRow;

/** Pull every matching row — used only by the CSV export. */
async function fetchAllRows(opts: {
  status?: string;
  type?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}): Promise<DisplayRow[]> {
  const rows: DisplayRow[] = [];
  for (let page = 1; page <= MAX_CHUNKS; page++) {
    const res = await manualDepositApi.listing({
      page,
      limit: FETCH_CHUNK,
      status: opts.status,
      type: opts.type,
      search: opts.search,
      startDate: opts.startDate,
      endDate: opts.endDate,
    });
    rows.push(...res.data.data);
    if (!res.data.data.length || rows.length >= res.data.total) break;
  }
  return rows;
}

const dayStartISO = (d?: Date) => {
  if (!d) return undefined;
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s.toISOString();
};

const dayEndISO = (d?: Date) => {
  if (!d) return undefined;
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e.toISOString();
};

/** Icon + amount. Gold coin = Wulf Coin, green = Wulf Cash, purple = Bonus. */
function CurrencyAmount({
  currency,
  amount,
  signed,
}: {
  currency?: string;
  amount?: number | null;
  /** Show +/- and colour a negative amount red (balance-edit changes). */
  signed?: boolean;
}) {
  if (amount == null) return <span className="text-xs text-gray-500">—</span>;
  const isCoin = currency === "wulfCoin";
  const isBonus = currency === "bonusWulfCash";
  const tone =
    signed && amount < 0
      ? "text-red-400"
      : isCoin
        ? "text-yellow-500"
        : isBonus
          ? "text-purple-300"
          : "text-green-500";
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <Image
        src={isCoin ? coingold : isBonus ? coinpurple : coingreen}
        alt={CURRENCY_LABELS[currency ?? ""] ?? currency ?? ""}
        width={16}
        height={16}
      />
      <span className={`text-xs font-bold ${tone}`}>
        {signed && amount > 0 ? "+" : ""}
        {amount.toFixed(2)}
      </span>
    </span>
  );
}

/**
 * Channel label for a balance edit. An edit that touched XP and nothing else
 * reads "Update XP"; one that moved any balance keeps "Balance Edit".
 */
function balanceEditChannel(
  row: Pick<
    DepositListingRow,
    "origin" | "xpAmount" | "coinAmount" | "cashAmount" | "bonusAmount"
  >,
): string {
  if (row.origin === "topout") return "Top Out";
  const moved = (v?: number | null) => Math.abs(Number(v) || 0) >= 0.005;
  const xpOnly =
    moved(row.xpAmount) &&
    !moved(row.coinAmount) &&
    !moved(row.cashAmount) &&
    !moved(row.bonusAmount);
  return xpOnly ? "Update XP" : "Balance Edit";
}

/**
 * XP figure for a balance edit, sky icon.
 *
 * XP is stored to 2 decimals (users.xp and xpDelta are numeric(20,2)), so it is
 * shown that way. Rounding to a whole number turned a -0.60 edit into "-1 XP"
 * — a value that was never requested and is not what approval would apply.
 */
const formatXp = (amount: number) =>
  amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
function XpAmount({ amount, signed }: { amount: number; signed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <Sparkles className="h-4 w-4 text-sky-300" aria-label="XP" />
      <span
        className={`text-xs font-bold ${signed && amount < 0 ? "text-red-400" : "text-sky-300"}`}
      >
        {signed && amount > 0 ? "+" : ""}
        {formatXp(amount)} XP
      </span>
    </span>
  );
}

/**
 * Balance-edit figures stacked: Gold Coin, Sweep Coin, Bonus, XP — only the ones
 * the edit touches. `side` picks the change itself or the approval's before/after.
 */
function BalanceEditLines({
  row,
  side,
}: {
  row: DepositListingRow;
  side: "amount" | "before" | "after";
}) {
  const coin =
    side === "amount" ? row.coinAmount : side === "before" ? row.coinBefore : row.coinAfter;
  const cash =
    side === "amount" ? row.cashAmount : side === "before" ? row.cashBefore : row.cashAfter;
  const bonus =
    side === "amount" ? row.bonusAmount : side === "before" ? row.bonusBefore : row.bonusAfter;
  const xp = side === "amount" ? row.xpAmount : side === "before" ? row.xpBefore : row.xpAfter;
  if (coin == null && cash == null && bonus == null && xp == null)
    return <span className="text-xs text-gray-500">—</span>;
  const signed = side === "amount";
  return (
    <div className="flex flex-col gap-1">
      {coin != null && <CurrencyAmount currency="wulfCoin" amount={coin} signed={signed} />}
      {cash != null && <CurrencyAmount currency="wulfCash" amount={cash} signed={signed} />}
      {bonus != null && (
        <CurrencyAmount currency="bonusWulfCash" amount={bonus} signed={signed} />
      )}
      {xp != null && <XpAmount amount={xp} signed={signed} />}
    </div>
  );
}

/** Coin + cash balances stacked. A single dash when neither is known yet. */
function BalancePair({
  coin,
  cash,
}: {
  coin?: number | null;
  cash?: number | null;
}) {
  if (coin == null && cash == null)
    return <span className="text-xs text-gray-500">—</span>;
  return (
    <div className="flex flex-col gap-1">
      <CurrencyAmount currency="wulfCoin" amount={coin} />
      <CurrencyAmount currency="wulfCash" amount={cash} />
    </div>
  );
}

const statusColor = (status: ManualDepositStatus) => {
  switch (status) {
    case "PENDING":
      return "text-orange-400";
    case "APPROVED":
      return "text-green-500";
    case "REJECTED":
      return "text-red-500";
    default:
      return "text-gray-400";
  }
};

const TableSkeleton = () => (
  <>
    {[...Array(PAGE_SIZE)].map((_, i) => (
      <tr
        key={i}
        className={`${i % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"} animate-pulse`}
      >
        {[...Array(10)].map((_, j) => (
          <td key={j} className="px-4 py-4">
            <div className="h-3 w-full bg-gray-700/40 rounded" />
          </td>
        ))}
      </tr>
    ))}
  </>
);

/**
 * The listing's summary cards, over the same filtered set as the table.
 * "Credited" already covers every manual deposit (plus balance-edit increases),
 * so there is no separate Deposit card. The tag cards need not add up to it — a
 * deposit raised before tagging existed has no tag.
 */
const SUMMARY_CARDS: {
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  pick: (s: DepositListingSummary | null) => DepositTagTotals | null;
  /** Icon colour — defaults to the brand purple. */
  iconTone?: string;
}[] = [
  // Credit = deposits + balance-edit increases; Debit = balance-edit decreases.
  {
    title: "Credited",
    icon: ArrowDownLeft,
    pick: (s) => s?.credit ?? null,
    iconTone: "text-green-400",
  },
  {
    title: "Debited",
    icon: ArrowUpRight,
    pick: (s) => s?.debit ?? null,
    iconTone: "text-red-400",
  },
  { title: "Postcard", icon: Mail, pick: (s) => s?.tags?.postcard ?? null },
  { title: "Other", icon: TagIcon, pick: (s) => s?.tags?.other ?? null },
  {
    title: "Social Media",
    icon: Share2,
    pick: (s) => s?.tags?.social_media ?? null,
  },
];

const fmtAmount = (value?: number) =>
  (value ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/* ============================================================ */

export default function WalletManualDepositListing() {
  const [pageRows, setPageRows] = useState<DisplayRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  // APPLIED date range (drives the server load). Status stays live in the header.
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [status, setStatus] = useState<string>("ALL");
  // Credit / Debit — APPLIED from the filter sheet like the date range.
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  // Debounced so a query is not fired per keystroke — the listing query joins
  // users and counts the whole merged set, so it is not free.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [summary, setSummary] = useState<DepositListingSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Approve and reject both go through a confirmation dialog — a mis-click on a
  // dropdown item must not move a player's balance. Reject additionally collects
  // the mandatory reason there.
  const [confirmAction, setConfirmAction] = useState<{
    row: DisplayRow;
    action: "approve" | "reject";
  } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // DRAFT date range — edited in the filter sheet, committed on "Apply Filters"
  // (mirrors the Deposit / Withdrawal filter sheets). Seeded from applied on open.
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftStart, setDraftStart] = useState<Date | undefined>(undefined);
  const [draftEnd, setDraftEnd] = useState<Date | undefined>(undefined);
  const [draftType, setDraftType] = useState<string>("ALL");

  useEffect(() => {
    if (!filterOpen) return;
    setDraftStart(startDate);
    setDraftEnd(endDate);
    setDraftType(typeFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterOpen]);

  // Opened from a player's Wallet tab as ?search=<username>: start already
  // narrowed to that player. Read once on mount (not useSearchParams, which
  // would need a Suspense boundary around the page).
  // Nothing loads until this has run, so an unfiltered first request cannot
  // land after the filtered one and overwrite it.
  const [urlReady, setUrlReady] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("search")?.trim();
    if (q) {
      setSearch(q);
      setDebouncedSearch(q);
    }
    setUrlReady(true);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(id);
  }, [search]);

  const hasSideFilters = !!startDate || !!endDate || typeFilter !== "ALL";
  const typeParam = typeFilter === "ALL" ? undefined : typeFilter;

  const applyFilters = () => {
    setStartDate(draftStart);
    setEndDate(draftEnd);
    setTypeFilter(draftType);
    setFilterOpen(false);
  };

  const resetFilters = () => {
    setDraftStart(undefined);
    setDraftEnd(undefined);
    setDraftType("ALL");
    setStartDate(undefined);
    setEndDate(undefined);
    setTypeFilter("ALL");
  };

  const load = async (page = currentPage) => {
    setLoading(true);
    try {
      const res = await manualDepositApi.listing({
        page,
        limit: PAGE_SIZE,
        status,
        type: typeParam,
        search: debouncedSearch || undefined,
        startDate: dayStartISO(startDate),
        endDate: dayEndISO(endDate),
      });
      setPageRows(res.data.data);
      setTotalPages(Math.max(1, res.data.totalPages));
      // Rows can disappear after an approve/reject or a filter change — never
      // strand the user on a page that no longer exists.
      if (page > res.data.totalPages && res.data.totalPages >= 1) {
        setCurrentPage(res.data.totalPages);
      }
    } catch {
      toast.error("Failed to load manual deposits");
    } finally {
      setLoading(false);
    }
  };

  // The cards describe the same filtered set as the table, so they reload with
  // the filters — but not with the page, since they summarise every match, not
  // the ten rows on screen.
  const loadSummary = async () => {
    setSummaryLoading(true);
    try {
      const res = await manualDepositApi.listingSummary({
        status,
        type: typeParam,
        search: debouncedSearch || undefined,
        startDate: dayStartISO(startDate),
        endDate: dayEndISO(endDate),
      });
      setSummary(res.data);
    } catch {
      // The table is the page; a failed summary greys the cards out rather
      // than throwing a toast on top of whatever the table already said.
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    if (!urlReady) return;
    setCurrentPage(1);
    load(1);
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlReady, startDate, endDate, status, typeFilter, debouncedSearch]);

  useEffect(() => {
    if (!urlReady) return;
    load(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // A deposit can be rejected while PENDING (nothing was credited) or after
  // APPROVAL (the credit gets debited back off the player's wallet). Subscription
  // changes and balance edits stay pending-only — those flows have no reversal.
  const canReject = (row: DisplayRow) =>
    row.kind === "deposit"
      ? row.status === "PENDING" || row.status === "APPROVED"
      : row.allPending;

  const isBalanceEdit = confirmAction?.row.kind === "balance_edit";
  const isReversal =
    confirmAction?.action === "reject" &&
    confirmAction.row.kind === "deposit" &&
    confirmAction.row.status === "APPROVED";
  // Only a deposit rejection carries a reason — the subscription endpoint takes none.
  const needsReason =
    confirmAction?.action === "reject" && confirmAction.row.kind !== "subscription";

  // Both actions move money, so both are confirmed before they fire.
  // For paired rows only one id is sent — the backend handles the partner.
  const handleApprove = (row: DisplayRow) => setConfirmAction({ row, action: "approve" });

  const handleReject = (row: DisplayRow) => {
    setRejectReason("");
    setConfirmAction({ row, action: "reject" });
  };

  const closeConfirm = () => {
    setConfirmAction(null);
    setRejectReason("");
  };

  const submitConfirm = async () => {
    if (!confirmAction) return;
    const { row, action } = confirmAction;
    const reason = rejectReason.trim();
    if (needsReason && !reason) {
      toast.error("Please enter a reason");
      return;
    }

    setActionLoading(row.key);
    try {
      if (action === "approve") {
        if (row.kind === "subscription") {
          await subscriptionChangeApi.approve(row.ids[0]);
          toast.success("Subscription change approved");
        } else if (row.kind === "balance_edit") {
          await balanceAdjustmentApi.approve(row.ids[0]);
          toast.success("Balance edit approved and applied");
        } else {
          await manualDepositApi.approve(row.ids[0]);
          toast.success("Deposit approved and wallet credited");
        }
      } else if (row.kind === "subscription") {
        await subscriptionChangeApi.reject(row.ids[0]);
        toast.success("Subscription change rejected");
      } else if (row.kind === "balance_edit") {
        await balanceAdjustmentApi.reject(row.ids[0], reason);
        toast.success("Balance edit rejected");
      } else {
        await manualDepositApi.reject(row.ids[0], reason);
        toast.success(
          row.status === "APPROVED"
            ? "Deposit reversed — the amount was debited from the player's wallet"
            : "Deposit request rejected",
        );
      }
      // Only close once the request actually succeeded; a failure keeps the
      // dialog (and the typed reason) so the admin can retry.
      closeConfirm();
      load();
      // An approval or a reversal moves the row between status buckets, so the
      // cards are stale the moment the table reloads.
      loadSummary();
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message ??
          (action === "approve" ? "Failed to approve" : "Failed to reject"),
      );
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#15181E] p-6 overflow-hidden">
      {/* HEADER */}
      <div className="bg-[#191D24] mb-4 px-4 py-3 rounded-lg flex items-center justify-between gap-4">
        <h1 className="text-base font-normal text-white">
          Wallet / Manual Deposit Listing
        </h1>
        {/* This page is no longer in the sidebar — it is entered from Manual
            Deposit, so it has to offer the way back. */}
        <Link href="/wallet/manual-deposit">
          <Button
            variant="outline"
            className="h-9 border-gray-700 bg-[#242B35] text-white hover:bg-[#2c3441] hover:text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Manual Deposit
          </Button>
        </Link>
      </div>

      {/* SUMMARY CARDS — one per tag plus the overall total, over the same
          filtered set as the table below. */}
      <div className="grid grid-cols-1 gap-3 mb-4 shrink-0 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {SUMMARY_CARDS.map((card) => {
          const Icon = card.icon;
          const totals = card.pick(summary);
          return (
            <div
              key={card.title}
              className="rounded-xl border border-[#242B35] bg-[#191D24] p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
                    {card.title}
                  </p>
                  {summaryLoading ? (
                    <div className="mt-3 h-7 w-16 animate-pulse rounded bg-gray-700/40" />
                  ) : (
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-white">
                      {totals ? totals.count.toLocaleString() : "—"}
                    </p>
                  )}
                  {/* The count answers "how many"; the two amounts answer "how
                      much", and they cannot be added together — different
                      currencies. */}
                  <div className="mt-2 flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-yellow-500">
                      <Image src={coingold} alt="Wulf Coin" width={12} height={12} />
                      {fmtAmount(totals?.coin)}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-green-500">
                      <Image src={coingreen} alt="Wulf Cash" width={12} height={12} />
                      {fmtAmount(totals?.cash)}
                    </span>
                  </div>
                </div>
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#242B35] ${card.iconTone ?? "text-[#C05CFF]"}`}
                >
                  <Icon size={18} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* FILTER BAR */}
      <div className="bg-[#191D24] rounded-lg p-2 mb-4 flex items-center gap-3 shrink-0 flex-wrap">
        {/* SEARCH — matches the columns an operator can actually read off the
            table: the player's username / email, and the plan names on a
            subscription row. */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search username, email or plan..."
            className="h-9 w-72 rounded-md border-gray-700/50 bg-[#242B35] pl-9 text-sm text-white placeholder:text-gray-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 transition-colors hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* STATUS — header dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 min-w-[170px] justify-between rounded-md border-[#3b414d] bg-[#242B35] px-3 text-sm text-white hover:bg-[#2b323b]"
            >
              <span>{statusLabel(status)}</span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="min-w-[170px] border-[#3a4250] bg-[#1a2030] text-white"
          >
            {STATUS_OPTIONS.map((o) => (
              <DropdownMenuItem
                key={o.value}
                onClick={() => setStatus(o.value)}
                className={status === o.value ? "bg-[#2B3240] text-white" : ""}
              >
                {o.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* FILTERS SHEET — date range (Apply / Reset draft) */}
        <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 bg-[#1a2030]/50 border-gray-700/50 text-gray-300 gap-2 hover:bg-[#1a2030] hover:text-white hover:border-purple-500/50 rounded-md px-4"
            >
              <Filter size={20} className="text-[#B93DEB]" />
              Filters
              {hasSideFilters && (
                <span className="ml-1 w-2 h-2 rounded-full bg-purple-500 shadow-sm shadow-purple-900" />
              )}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="bg-[#1F2430] border-l border-gray-700 text-white w-[360px] sm:max-w-[360px] flex flex-col"
            onInteractOutside={(e) => {
              // The date pickers portal their calendar to <body>; a click inside
              // one counts as "outside" the sheet and would close it before Apply.
              // Keep the sheet open when the interaction targets a Radix popper.
              const target = e.target as HTMLElement | null;
              if (target?.closest("[data-radix-popper-content-wrapper]")) {
                e.preventDefault();
              }
            }}
          >
            <SheetHeader className="pb-4 border-b border-gray-700">
              <SheetTitle className="text-lg text-white">Filter Manual Deposits</SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-purple-400" />
                  <Label className="text-gray-300">Type</Label>
                </div>
                <div className="grid grid-cols-3 gap-2 bg-[#191D24] p-2 rounded-xl border border-gray-800/50">
                  {TYPE_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setDraftType(o.value)}
                      className={`h-9 rounded-md text-xs font-medium transition-colors ${
                        draftType === o.value
                          ? "bg-purple-500 text-white"
                          : "bg-[#242B35] text-gray-300 hover:bg-[#2c3441] hover:text-white"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-purple-400" />
                  <Label className="text-gray-300">Date Range</Label>
                </div>
                <div className="grid grid-cols-2 gap-3 bg-[#191D24] p-3 rounded-xl border border-gray-800/50">
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-gray-500 uppercase font-bold px-1">From</p>
                    <DatePicker
                      date={draftStart}
                      maxDate={draftEnd}
                      onChange={(d) => {
                        setDraftStart(d);
                        if (d && draftEnd && d > draftEnd) setDraftEnd(undefined);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-gray-500 uppercase font-bold px-1">To</p>
                    <DatePicker
                      date={draftEnd}
                      minDate={draftStart}
                      onChange={(d) => {
                        setDraftEnd(d);
                        if (d && draftStart && d < draftStart) setDraftStart(undefined);
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-auto p-4 border-t border-gray-700 space-y-3">
              <Button
                type="button"
                onClick={applyFilters}
                className="w-full bg-purple-500 hover:bg-purple-600 text-white"
              >
                Apply Filters
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetFilters();
                  toast.success("Filters cleared");
                }}
                className="w-full bg-[#2A3240] border-gray-700 text-white hover:bg-[#313B4A]"
              >
                Reset Filters
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex-1" />

        <ExportCSV
          data={pageRows}
          fileName="manual_deposits.csv"
          getRowDate={(row) => row.createdAt}
          fetchAll={async (range) => {
            // Export walks every page of the merged listing. Popover range
            // overrides the toolbar date filter.
            return fetchAllRows({
              status,
              type: typeParam,
              // Export what is on screen: the same search the table is showing.
              search: debouncedSearch || undefined,
              startDate: dayStartISO(range.from ?? startDate),
              endDate: dayEndISO(range.to ?? endDate),
            });
          }}
          headers={[
            "Date",
            "Username",
            "Email",
            "Channel",
            "Type",
            "Tag",
            "Added Value",
            "Previous Value",
            "Updated Value",
            "Status",
          ]}
          mapRow={(row) => {
            const isSub = row.kind === "subscription";
            const isEdit = row.kind === "balance_edit";
            const channel = isSub
              ? "Subscription"
              : isEdit
                ? balanceEditChannel(row)
                : row.isPaired
                  ? "Manual Pair"
                  : "Manual";

            // The table shows currency as an icon; CSV has to spell it out.
            const fmtPair = (coin?: number | null, cash?: number | null) =>
              coin == null && cash == null
                ? "—"
                : `${coin?.toFixed(2) ?? "0.00"} Wulf Coin + ${cash?.toFixed(2) ?? "0.00"} Wulf Cash`;
            const fmtSingle = (amount?: number | null) =>
              amount == null
                ? "—"
                : `${amount.toFixed(2)} ${
                    CURRENCY_LABELS[row.singleCurrency ?? ""] ??
                    row.singleCurrency ??
                    ""
                  }`.trim();
            const isCoin = row.singleCurrency === "wulfCoin";
            // Balance edit: only the figures it touches, signed for the change.
            const fmtEdit = (
              coin?: number | null,
              cash?: number | null,
              bonus?: number | null,
              xp?: number | null,
              signed = false,
            ) => {
              const sign = (v: number) => (signed && v > 0 ? "+" : "");
              const parts = [
                coin != null ? `${sign(coin)}${coin.toFixed(2)} Wulf Coin` : null,
                cash != null ? `${sign(cash)}${cash.toFixed(2)} Wulf Cash` : null,
                bonus != null ? `${sign(bonus)}${bonus.toFixed(2)} Bonus Wulf Cash` : null,
                xp != null ? `${sign(xp)}${xp.toFixed(2)} XP` : null,
              ].filter(Boolean);
              return parts.length ? parts.join(" + ") : "—";
            };

            if (isEdit) {
              return [
                formatDateTime(row.createdAt),
                row.user?.username || "—",
                row.user?.email || "—",
                channel,
                DIRECTION_META[row.direction ?? ""]?.label ?? "—",
                "—",
                fmtEdit(row.coinAmount, row.cashAmount, row.bonusAmount, row.xpAmount, true),
                fmtEdit(row.coinBefore, row.cashBefore, row.bonusBefore, row.xpBefore),
                fmtEdit(row.coinAfter, row.cashAfter, row.bonusAfter, row.xpAfter),
                row.status,
              ];
            }

            const addedValue = isSub
              ? "—"
              : row.isPaired
                ? fmtPair(row.coinAmount, row.cashAmount)
                : fmtSingle(row.singleAmount);
            const previousValue = isSub
              ? row.fromPlanName || "—"
              : row.isPaired
                ? fmtPair(row.coinBefore, row.cashBefore)
                : fmtSingle(isCoin ? row.coinBefore : row.cashBefore);
            const updatedValue = isSub
              ? row.toPlanName || "—"
              : row.isPaired
                ? fmtPair(row.coinAfter, row.cashAfter)
                : fmtSingle(isCoin ? row.coinAfter : row.cashAfter);

            return [
              formatDateTime(row.createdAt),
              row.user?.username || "—",
              row.user?.email || "—",
              channel,
              DIRECTION_META[row.direction ?? ""]?.label ?? "—",
              formatManualDepositTag(row.tag, row.tagDetail),
              addedValue,
              previousValue,
              updatedValue,
              row.status,
            ];
          }}
        />
      </div>

      {/* TABLE */}
      <div className="flex-1 overflow-y-auto rounded-lg scrollbar-hide bg-[#15181E]">
        <table className="w-full table-fixed">
          <thead className="bg-[#242B35]">
            <tr className="border-b border-gray-800">
              <th className="px-4 py-3 text-left text-xs text-white font-normal w-[15%]">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs text-white font-normal w-[18%]">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs text-white font-normal">
                Channel
              </th>
              <th className="px-4 py-3 text-left text-xs text-white font-normal">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs text-white font-normal">
                Tag
              </th>
              <th className="px-4 py-3 text-left text-xs text-white font-normal">
                Added Value
              </th>
              <th className="px-4 py-3 text-left text-xs text-white font-normal">
                Previous Value
              </th>
              <th className="px-4 py-3 text-left text-xs text-white font-normal">
                Updated Value
              </th>
              <th className="px-4 py-3 text-left text-xs text-white font-normal">
                Status
              </th>
              <th className="px-4 py-3 text-center text-xs text-white font-normal w-[60px]">
                Action
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <TableSkeleton />
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-20">
                  <NoData
                    title={
                      debouncedSearch
                        ? `No deposits match "${debouncedSearch}"`
                        : undefined
                    }
                  />
                </td>
              </tr>
            ) : (
              pageRows.map((row, index) => {
                const isSub = row.kind === "subscription";
                const isEdit = row.kind === "balance_edit";

                // Values render as icon + amount (gold = Wulf Coin, green =
                // Wulf Cash) instead of spelling the currency out.
                const addedCell = isSub ? (
                  <span className="text-xs text-gray-500">—</span>
                ) : isEdit ? (
                  <BalanceEditLines row={row} side="amount" />
                ) : row.isPaired ? (
                  <div className="flex flex-col gap-1">
                    <CurrencyAmount currency="wulfCoin" amount={row.coinAmount} />
                    <CurrencyAmount currency="wulfCash" amount={row.cashAmount} />
                  </div>
                ) : (
                  <CurrencyAmount
                    currency={row.singleCurrency}
                    amount={row.singleAmount}
                  />
                );

                // Wallet balance either side of the approval. Still PENDING →
                // nothing has been credited, so there is no snapshot to show.
                const previousCell = isSub ? (
                  <span className="text-gray-300">{row.fromPlanName || "—"}</span>
                ) : isEdit ? (
                  <BalanceEditLines row={row} side="before" />
                ) : row.isPaired ? (
                  <BalancePair
                    coin={row.coinBefore}
                    cash={row.cashBefore}
                  />
                ) : (
                  <CurrencyAmount
                    currency={row.singleCurrency}
                    amount={
                      row.singleCurrency === "wulfCoin"
                        ? row.coinBefore
                        : row.cashBefore
                    }
                  />
                );

                const updatedCell = isSub ? (
                  <span className="text-purple-300 font-semibold whitespace-nowrap">
                    {row.toPlanName || "—"}
                  </span>
                ) : isEdit ? (
                  <BalanceEditLines row={row} side="after" />
                ) : row.isPaired ? (
                  <BalancePair coin={row.coinAfter} cash={row.cashAfter} />
                ) : (
                  <CurrencyAmount
                    currency={row.singleCurrency}
                    amount={
                      row.singleCurrency === "wulfCoin"
                        ? row.coinAfter
                        : row.cashAfter
                    }
                  />
                );

                const typeCell = isSub ? (
                  <span className="text-purple-400">Subscription</span>
                ) : isEdit ? (
                  <span className="text-sky-300" title={row.notes || undefined}>
                    {balanceEditChannel(row)}
                  </span>
                ) : row.isPaired ? (
                  <span className="text-purple-400">Manual Pair</span>
                ) : (
                  <span className="text-gray-300">Manual</span>
                );

                return (
                  <tr
                    key={row.key}
                    className={`${
                      index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                    } hover:bg-[#1a2030]`}
                  >
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {formatDateTime(row.createdAt)}
                    </td>
                    {/* The player is identified by email (copyable); the
                        username is kept in the tooltip. Falls back to the
                        username for an account without an email. */}
                    <td className="px-4 py-3 text-xs text-gray-300">
                      <div
                        className="flex min-w-0 items-center gap-2"
                        title={
                          [row.user?.email, row.user?.username]
                            .filter(Boolean)
                            .join(" · ") || undefined
                        }
                      >
                        <span className="truncate">
                          {row.user?.email || row.user?.username || "—"}
                        </span>
                        <CopyButton value={row.user?.email || row.user?.username} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">{typeCell}</td>
                    <td className="px-4 py-3 text-xs">
                      <DirectionBadge direction={row.direction} />
                    </td>
                    <td
                      className="px-4 py-3 text-xs text-gray-300 truncate"
                      title={row.tagDetail || undefined}
                    >
                      {formatManualDepositTag(row.tag, row.tagDetail)}
                    </td>
                    <td className="px-4 py-3 text-xs">{addedCell}</td>
                    <td className="px-4 py-3 text-xs">{previousCell}</td>
                    <td className="px-4 py-3 text-xs">{updatedCell}</td>
                    <td
                      className={`px-4 py-3 text-xs font-semibold ${statusColor(row.status)}`}
                      title={row.rejectionReason || undefined}
                    >
                      {row.status}
                      {row.reversedAt && (
                        <span className="block text-[10px] font-normal text-gray-500">
                          reversed
                        </span>
                      )}
                    </td>
                    <td className="relative text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="text-red-400 hover:text-orange-400"
                            disabled={actionLoading === row.key}
                          >
                            <Wrench size={16} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="absolute right-0 top-full mt-2 z-50 bg-[#1a2030] text-white">
                          <DropdownMenuItem
                            className="text-green-400 focus:text-green-300"
                            onClick={() => handleApprove(row)}
                            disabled={!row.allPending}
                          >
                            Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-400 focus:text-red-300"
                            onClick={() => handleReject(row)}
                            disabled={!canReject(row)}
                          >
                            {row.kind === "deposit" && row.status === "APPROVED"
                              ? "Reject & Reverse"
                              : "Reject"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <div className="mt-4 px-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      {/* APPROVE / REJECT confirmation. Closes only on success. */}
      <Dialog
        open={!!confirmAction}
        onOpenChange={(open) => {
          if (!open) closeConfirm();
        }}
      >
        <DialogContent className="sm:max-w-[480px] bg-[#15181E] border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-white">
              {confirmAction?.action === "approve"
                ? confirmAction.row.kind === "subscription"
                  ? "Approve subscription change"
                  : isBalanceEdit
                    ? confirmAction.row.origin === "topout"
                      ? "Approve top out"
                      : "Approve balance edit"
                    : "Approve deposit"
                : isReversal
                  ? "Reject & reverse deposit"
                  : confirmAction?.row.kind === "subscription"
                    ? "Reject subscription change"
                    : isBalanceEdit
                      ? confirmAction?.row.origin === "topout"
                        ? "Reject top out"
                        : "Reject balance edit"
                      : "Reject deposit request"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {confirmAction?.action === "approve" && (
              <p className="text-xs text-gray-400 bg-[#242B35] rounded-lg p-3">
                {confirmAction.row.kind === "subscription"
                  ? "The player is moved onto the requested plan."
                  : isBalanceEdit
                    ? "The change is applied to the player's balance as it stands now (added or taken off), and the player is notified. It cannot be reversed from here."
                    : "The amount is credited to the player's wallet straight away. It can still be reversed afterwards, but that debits their balance."}
              </p>
            )}

            {isReversal && (
              <p className="text-xs text-orange-300 bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                This deposit was already approved and credited. Rejecting it debits
                the amount back off the player&apos;s wallet — if they have already
                spent it, the balance goes negative and the shortfall is covered by
                their next credit.
              </p>
            )}

            {needsReason && (
              <div className="space-y-1.5">
                <Label className="text-sm text-gray-400">
                  Reason <span className="text-red-400">*</span>
                </Label>
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Why is this being rejected?"
                  maxLength={500}
                  className="bg-[#242B35] border-none text-white resize-none min-h-[90px]"
                />
                <p className="text-[10px] text-gray-500">
                  {isBalanceEdit
                    ? "Kept on the request for the audit trail. The player is not notified."
                    : "Shown to the player in their notifications."}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={closeConfirm}
              className="text-gray-400 hover:text-white hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              onClick={submitConfirm}
              disabled={
                (needsReason && !rejectReason.trim()) ||
                actionLoading === confirmAction?.row.key
              }
              className={`px-6 text-white ${
                confirmAction?.action === "approve"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {actionLoading === confirmAction?.row.key
                ? "Submitting..."
                : confirmAction?.action === "approve"
                  ? "Approve"
                  : isReversal
                    ? "Reject & Reverse"
                    : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
