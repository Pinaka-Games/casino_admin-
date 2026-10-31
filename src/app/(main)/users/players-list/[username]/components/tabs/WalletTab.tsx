"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import TableSkeleton from "@/components/TableSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SortableTh,
  useSortedRows,
  useTableSort,
} from "@/components/filters/tableSort";
import FilterToolbar from "@/components/filters/FilterToolbar";
import EntityFilterSheet from "@/components/filters/EntityFilterSheet";
import { useEntityFilters } from "@/components/filters/useEntityFilters";
import {
  WALLET_ALL,
  WALLET_DEFAULTS,
  buildWalletFields,
  filterWalletRows,
} from "./walletFilters";
import type { ComponentProps, ReactNode } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { chip, diamond, notes, twonotes } from "@/assets/images/banner";
import { coingold, coingreen, coinpurple } from "@/assets/icons";
import api from "@/api/config/axios.config";
import { manualDepositApi } from "@/api/manual-deposit/manual-deposit.api";
import { ArrowDownCircle, ArrowRight, ArrowUpCircle, Calendar, Info, Loader2, Pencil, Save, Sparkles, X } from "lucide-react";
import { redeemApi } from "@/api/redeem/redeem.api";
import Pagination from "@/components/Pagination/Pagination";
import { transactionsApi, Transaction } from "@/api/transactions/transactions.api";
import NoData from "@/components/NoData";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ManualDepositModal from "../../../components/ManualDepositModal";
import EditBalanceConfirmModal from "../../../components/EditBalanceConfirmModal";
import type { EditSnapshot } from "@/api/wallet/balance-adjustment.api";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";
import { PermissionGuard } from "@/components/guard/permission-guard";
import { NAV_PERMISSIONS } from "@/config/menu.config";

const num = (v: unknown): number | null =>
  v === null || v === undefined || v === "" ? null : Number(v);

/**
 * Which wallet currency a transaction actually moved. `currency` is set on
 * normal wallet rows; composite rows (bundles, deposit bonuses) only carry the
 * per-currency *Added columns, so fall back to whichever one is non-zero.
 */
const rowCurrency = (row: Transaction): "wulfCoin" | "wulfCash" | "bonusWulfCash" | null => {
  if (row.currency === "wulfCoin") return "wulfCoin";
  if (row.currency === "wulfCash" || row.currency === "redeemableWulfCash")
    return "wulfCash";
  if (row.currency === "bonusWulfCash") return "bonusWulfCash";
  if (num(row.wulfCoinAdded)) return "wulfCoin";
  if (num(row.wulfCashAdded)) return "wulfCash";
  if (num(row.bonusWulfCashAdded)) return "bonusWulfCash";
  return null;
};

/** Signed movement for the row's currency. Debits are already stored negative. */
const rowAmount = (row: Transaction): number | null => {
  const currency = rowCurrency(row);
  const added =
    currency === "wulfCoin"
      ? num(row.wulfCoinAdded)
      : currency === "bonusWulfCash"
        ? num(row.bonusWulfCashAdded)
        : num(row.wulfCashAdded);
  if (added !== null && added !== 0) return added;
  // Legacy rows (redeems written before the movement was stored signed) left
  // the *Added column at 0 — derive the delta from the balance snapshots.
  const { before, after } = rowBalances(row);
  if (before !== null && after !== null && before !== after) return after - before;
  // Fiat-only rows (subscriptions) carry just `amount`.
  const fallback = num(row.amount);
  return fallback === null ? null : row.type === "DEBIT" ? -fallback : fallback;
};

const rowBalances = (row: Transaction) => {
  const currency = rowCurrency(row);
  if (currency === "wulfCoin")
    return {
      before: num(row.wulfCoinBalanceBefore),
      after: num(row.wulfCoinBalanceAfter),
    };
  if (currency === "bonusWulfCash")
    return {
      before: num(row.bonusWulfCashBalanceBefore),
      after: num(row.bonusWulfCashBalanceAfter),
    };
  return {
    before: num(row.wulfCashBalanceBefore),
    after: num(row.wulfCashBalanceAfter),
  };
};

/**
 * Status shown per row. Only some sources have a real lifecycle: redeems carry
 * the request status, card deposits the payin status. Everything else is a
 * completed wallet movement the moment it is written.
 */
const rowStatus = (row: Transaction): { label: string; tone: string } => {
  const raw =
    row.source === "REDEEM"
      ? // Payout status is the more specific of the two once a payout page
        // exists (PROCESSING / COMPLETED / FAILED vs the request's APPROVED).
        (row.redeemPayoutStatus ?? row.redeemStatus ?? null)
      : (row.breezePayin?.status ?? row.coinflowPayin?.status ?? row.status ?? null);
  const label = raw ?? "COMPLETED";
  const tone = /REJECT|FAIL|CANCEL|EXPIRE/i.test(label)
    ? "bg-red-500/10 text-red-400 border-red-500/20"
    : /PENDING|PROCESS|CREATED|REQUIRE/i.test(label)
      ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
      : "bg-green-500/10 text-green-400 border-green-500/20";
  return { label, tone };
};

/**
 * Second line under the source: the payment provider. Deposits get it from the
 * enriched payin (Breeze / Coinflow), redeems from the payout page. Refund legs
 * are labelled so a credit against REDEEM doesn't read as a payout.
 *
 */
const rowSourceDetail = (row: Transaction): string | null => {
  if (row.source !== "REDEEM") return row.paymentMethod ?? null;
  const provider = row.redeemProvider
    ? row.redeemProvider.replace(/_/g, " ")
    : null;
  const leg = row.type === "CREDIT" ? "Refund" : null;
  return [provider, leg].filter(Boolean).join(" · ") || null;
};

/**
 * Why the money moved, in the words the writer used: "Daily Streak Reward -
 * Day 7", "Manual deposit approved: <note>", "Raffle #12 prize". The source
 * alone says what kind of event it was, never which one or why — and a
 * milestone day writes two credits under the same DAILY STREAK source that only
 * the description tells apart.
 */
const rowReason = (row: Transaction): string | null => {
  const description = row.description?.trim();
  if (!description) return null;
  // The source column already says "DAILY STREAK"; don't repeat it.
  return description.replace(/^Daily Streak\s*[-–]?\s*/i, "") || null;
};

type Currency = "wulfCoin" | "wulfCash" | "bonusWulfCash";

/**
 * Bonus Wulf Cash used to render with the same green chip as real Wulf Cash, so
 * a bonus balance read as cash. Each currency now has its own chip, its own word
 * and its own colour — matching the player's own wallet history, where bonus is
 * the purple chip. `order` fixes the vertical order of the per-currency lines so
 * the Amount, Balance Before and Balance After columns line up entry-for-entry.
 */
type ImageSrc = ComponentProps<typeof Image>["src"];

const CURRENCY_META: Record<
  Currency,
  { label: string; order: number; icon: ImageSrc; tone: string; valueTone: string }
> = {
  wulfCoin: {
    label: "Coin",
    order: 0,
    icon: coingold,
    tone: "text-yellow-500/80",
    valueTone: "text-yellow-500",
  },
  wulfCash: {
    label: "Cash",
    order: 1,
    icon: coingreen,
    tone: "text-green-400/80",
    valueTone: "text-green-400",
  },
  bonusWulfCash: {
    label: "Bonus",
    order: 2,
    // Purple Wulf Cash coin: bonus IS Wulf Cash, just locked — same coin, its
    // own colour, so it can't be read as spendable cash or as a chip.
    icon: coinpurple,
    tone: "text-purple-300/80",
    valueTone: "text-purple-300",
  },
};

const currencyOrder = (c: Currency | null) => (c ? CURRENCY_META[c].order : 9);

interface Fiat {
  amount: number;
  currency: string;
}

/**
 * Subscription rows are a real-money charge: they carry `amount` + `fiatCurrency`
 * and move no wallet currency at all. Rendered through the wallet path they came
 * out as a bare "-20" in a column of coin and cash figures, reading as 20 coins
 * rather than $20. They get their own line, tagged with the currency code.
 */
const rowFiat = (row: Transaction): Fiat | null => {
  const amount = num(row.amount);
  if (amount === null || !row.fiatCurrency) return null;
  return {
    amount: row.type === "DEBIT" ? -Math.abs(amount) : Math.abs(amount),
    currency: row.fiatCurrency,
  };
};

interface Entry {
  currency: Currency | null;
  amount: number | null;
  before: number | null;
  after: number | null;
}

interface HistoryRow {
  id: string;
  createdAt: string;
  type: string;
  source: string;
  sourceDetail: string | null;
  /** Why the money moved — the writer's own description. */
  reason: string | null;
  status: { label: string; tone: string };
  entries: Entry[];
  /** Set on real-money rows (subscriptions); wallet balances did not move. */
  fiat: Fiat | null;
}

const CURRENCY_FIELDS: Array<{
  currency: Currency;
  added: keyof Transaction;
  before: keyof Transaction;
  after: keyof Transaction;
}> = [
  {
    currency: "wulfCoin",
    added: "wulfCoinAdded",
    before: "wulfCoinBalanceBefore",
    after: "wulfCoinBalanceAfter",
  },
  {
    currency: "wulfCash",
    added: "wulfCashAdded",
    before: "wulfCashBalanceBefore",
    after: "wulfCashBalanceAfter",
  },
  {
    currency: "bonusWulfCash",
    added: "bonusWulfCashAdded",
    before: "bonusWulfCashBalanceBefore",
    after: "bonusWulfCashBalanceAfter",
  },
];

/**
 * One entry per currency the transaction actually moved. A bundle purchase
 * moves coin + cash (+ bonus) in a single row; most transactions move one.
 */
const entriesOf = (row: Transaction): Entry[] => {
  const moved = CURRENCY_FIELDS.filter(({ added }) => num(row[added]));
  if (moved.length) {
    return moved.map(({ currency, added, before, after }) => ({
      currency,
      amount: num(row[added]),
      before: num(row[before]),
      after: num(row[after]),
    }));
  }
  // A real-money charge moves no wallet currency — it is rendered from `fiat`.
  if (rowFiat(row)) return [];
  // Nothing recorded in the *Added columns — fall back to the single-currency
  // read (covers legacy redeems).
  const { before, after } = rowBalances(row);
  return [{ currency: rowCurrency(row), amount: rowAmount(row), before, after }];
};

// Manual deposits credit coin and cash as two transactions sharing one
// referenceId (the pairId); daily streaks do the same. They are one event to
// the admin, so collapse them into a single row instead of two half-rows.
// A daily streak milestone bonus carries its own referenceId, so it stays a
// row of its own rather than being summed into the day's base reward.
// An admin balance edit writes one row per currency under one referenceId too.
const GROUPED_SOURCES = new Set(["MANUAL_DEPOSIT", "DAILY_STREAK", "ADMIN_ADJUSTMENT"]);

/** Up to 2 decimals, digits only — the API rejects anything else anyway. */
const BALANCE_INPUT = /^\d*\.?\d{0,2}$/;

type DraftBalances = Record<keyof EditSnapshot, string>;

const EDIT_KEYS = ["xp", "wulfCash", "wulfCoin", "bonusWulfCash"] as const;

const toDraft = (b: EditSnapshot): DraftBalances => ({
  xp: String(b.xp),
  wulfCash: String(b.wulfCash),
  wulfCoin: String(b.wulfCoin),
  bonusWulfCash: String(b.bonusWulfCash),
});

/** Newest-first transactions → display rows, with pair transactions merged. */
const buildHistoryRows = (transactions: Transaction[]): HistoryRow[] => {
  const rows: HistoryRow[] = [];
  const byKey = new Map<string, HistoryRow>();

  for (const tx of transactions) {
    const entries = entriesOf(tx);
    const groupKey =
      tx.referenceId && GROUPED_SOURCES.has(tx.source)
        ? `${tx.source}|${tx.referenceId}`
        : null;
    const existing = groupKey ? byKey.get(groupKey) : undefined;

    if (!existing) {
      const row: HistoryRow = {
        id: tx.id,
        createdAt: tx.createdAt,
        type: tx.type,
        source: tx.source,
        sourceDetail: rowSourceDetail(tx),
        reason: rowReason(tx),
        status: rowStatus(tx),
        entries,
        fiat: rowFiat(tx),
      };
      rows.push(row);
      if (groupKey) byKey.set(groupKey, row);
      continue;
    }

    // Merge into the row already created for this pair. Transactions arrive
    // newest-first, so the later arrival holds the earlier `before` balance.
    for (const entry of entries) {
      const match = existing.entries.find((e) => e.currency === entry.currency);
      if (!match) {
        existing.entries.push(entry);
        continue;
      }
      match.amount = (match.amount ?? 0) + (entry.amount ?? 0);
      match.before = entry.before ?? match.before;
    }
  }

  // Fixed currency order per row so Amount / Balance Before / Balance After read
  // as three aligned columns of the same list.
  for (const row of rows) {
    row.entries.sort((a, b) => currencyOrder(a.currency) - currencyOrder(b.currency));
  }

  return rows;
};

/** Entries worth a line: anything that carries a movement or a balance. */
const visibleEntries = (entries: Entry[]): Entry[] =>
  entries.filter((e) => e.amount !== null || e.before !== null || e.after !== null);

const formatValue = (value: number) =>
  value.toLocaleString(undefined, { maximumFractionDigits: 2 });

/** Icon-only currency marker; the icon colour alone tells Coin, Cash and Bonus
    apart (gold / green / purple). The label survives as alt text + tooltip. */
function CurrencyTag({ currency }: { currency: Currency | null }) {
  if (!currency) return null;
  const meta = CURRENCY_META[currency];
  return (
    <span className="inline-flex items-center" title={meta.label}>
      <Image src={meta.icon} alt={meta.label} width={16} height={16} />
    </span>
  );
}

/** Currency code in place of a chip, so a fiat charge can't read as coins. */
function FiatTag({ currency }: { currency: string }) {
  return (
    <span className="text-[10px] uppercase tracking-wide text-sky-300/80">
      {currency}
    </span>
  );
}

function AmountCell({ entries, fiat }: { entries: Entry[]; fiat: Fiat | null }) {
  if (fiat) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <FiatTag currency={fiat.currency} />
        <span className={fiat.amount < 0 ? "text-red-400" : "text-green-400"}>
          {fiat.amount < 0 ? "-" : "+"}
          {Math.abs(fiat.amount).toFixed(2)}
        </span>
      </span>
    );
  }
  const visible = visibleEntries(entries);
  if (!visible.length) return <span className="text-gray-500">—</span>;
  return (
    <div className="flex flex-col items-center gap-1">
      {visible.map((entry, i) => (
        <span
          key={`${entry.currency}-${i}`}
          className="inline-flex items-center gap-1.5 whitespace-nowrap"
        >
          <CurrencyTag currency={entry.currency} />
          {entry.amount === null ? (
            <span className="text-gray-500">—</span>
          ) : (
            <span className={entry.amount < 0 ? "text-red-400" : "text-green-400"}>
              {entry.amount > 0 ? "+" : ""}
              {formatValue(entry.amount)}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

function BalanceCell({
  entries,
  side,
  fiat,
}: {
  entries: Entry[];
  side: "before" | "after";
  fiat: Fiat | null;
}) {
  // A real-money charge leaves every wallet balance untouched.
  if (fiat) return <span className="text-gray-500">—</span>;
  const visible = visibleEntries(entries);
  if (!visible.length) return <span className="text-gray-500">—</span>;
  return (
    <div className="flex flex-col items-center gap-1">
      {visible.map((entry, i) => {
        const tone = entry.currency
          ? CURRENCY_META[entry.currency].valueTone
          : "text-gray-300";
        return (
          <span
            key={`${entry.currency}-${i}`}
            className="inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <CurrencyTag currency={entry.currency} />
            {entry[side] === null ? (
              <span className="text-gray-500">—</span>
            ) : (
              <span className={tone}>{formatValue(entry[side]!)}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

const ALL = "All";

/**
 * `type` is the ledger direction the row was written with — note that manual
 * deposits are stored as CREDIT, not DEPOSIT, so "Credit" is what surfaces an
 * admin top-up.
 */
const TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: ALL, label: "All Types" },
  { value: "CREDIT", label: "Credit" },
  { value: "DEBIT", label: "Debit" },
  { value: "DEPOSIT", label: "Deposit" },
  { value: "PROMOTION", label: "Promotion" },
];

/** Every source a player's wallet can be written by, grouped for scanning. */
const SOURCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: ALL, label: "All Sources" },
  { value: "MANUAL_DEPOSIT", label: "Manual Deposit (Admin)" },
  { value: "ADMIN_ADJUSTMENT", label: "Balance Edit (Admin)" },
  { value: "FREE_SPIN_WIN", label: "Free Spin Win" },
  { value: "BUNDLE_PURCHASE", label: "Bundle Purchase" },
  { value: "BREEZE_PAYIN", label: "Breeze Payin" },
  { value: "COINFLOW_PAYIN", label: "Coinflow Payin" },
  { value: "DEPOSIT_BONUS", label: "Deposit Bonus" },
  { value: "REDEEM", label: "Redeem" },
  { value: "DAILY_STREAK", label: "Daily Streak" },
  { value: "RAKEBACK", label: "Rakeback / Cashback" },
  { value: "ACHIEVEMENT_REWARD", label: "Medal Reward" },
  { value: "REFERRAL_COMMISSION", label: "Referral Commission" },
  { value: "REFERRAL_REVERSAL", label: "Referral Reversal" },
  { value: "TOURNAMENT_WIN", label: "Tournament Win" },
  { value: "RACE_ENTRY", label: "Race Entry" },
  { value: "RACE_REWARD", label: "Race Reward" },
  { value: "LEVEL_UP_BONUS", label: "Level Up Bonus" },
  { value: "BONUS_CONVERSION", label: "Bonus Conversion" },
  { value: "ROLLOVER_UNLOCK", label: "Rollover Unlock" },
  { value: "SUBSCRIPTION_BUY", label: "Subscription Buy" },
  { value: "SUBSCRIPTION_UPGRADE", label: "Subscription Upgrade" },
  { value: "SUBSCRIPTION_RENEW", label: "Subscription Renew" },
  { value: "WALLET_ADD", label: "Wallet Credit (System)" },
  { value: "WALLET_DEDUCT", label: "Wallet Debit (System)" },
  { value: "TRANSFER", label: "Transfer / Vault" },
];

interface UserProfile {
  id: string;
  username?: string;
  disableWallet?: boolean;
  restrictDeposit?: boolean;
  restrictWithdraw?: boolean;
  /** users.xp — numeric(20,2), so it arrives as a string. 1 SC wagered = 1 XP. */
  xp?: number | string;
  wallet?: {
    wulfCash: number;
    wulfCoin: number;
    bonusWulfCash: number;
    /**
     * What the player can actually redeem right now — Wulf Cash minus anything
     * an unfinished DEPOSIT/WINNINGS rollover still holds. Served by the same
     * calculation as the player's own Redeem screen, so the two always agree.
     */
    availableToWithdraw?: number;
    /** The part of Wulf Cash those rollovers are holding back. */
    lockedWulfCash?: number;
  };
}

// ── Total Deposit / Total Withdrawal cards ──────────────────────────────────

interface MoneyTotals {
  depositUsd: number;
  depositCount: number;
  withdrawalUsd: number;
  withdrawalCount: number;
  pendingWithdrawalUsd: number;
}

const EMPTY_MONEY_TOTALS: MoneyTotals = {
  depositUsd: 0,
  depositCount: 0,
  withdrawalUsd: 0,
  withdrawalCount: 0,
  pendingWithdrawalUsd: 0,
};

// Purchases the player paid for. MANUAL_DEPOSIT is left out: an admin credit
// costs the player nothing, the same reason the Deposits tab keeps it out of
// its "User Deposit" card.
const PAID_DEPOSIT_SOURCES =
  "BUNDLE_PURCHASE,SUBSCRIPTION_BUY,SUBSCRIPTION_UPGRADE,SUBSCRIPTION_RENEW,BREEZE_PAYIN";
const MONEY_FETCH_CHUNK = 200;
const MONEY_MAX_CHUNKS = 25;

async function fetchMoneyTotals(userId: string): Promise<MoneyTotals> {
  const [deposits, redeems] = await Promise.all([
    (async () => {
      const all: Transaction[] = [];
      for (let p = 1; p <= MONEY_MAX_CHUNKS; p++) {
        const res = await transactionsApi.getAllTransactions({
          page: p,
          limit: MONEY_FETCH_CHUNK,
          source: PAID_DEPOSIT_SOURCES,
          userId,
        });
        const batch = res.data.data ?? [];
        all.push(...batch);
        if (!batch.length || all.length >= (res.data.total ?? 0)) break;
      }
      return all;
    })(),
    redeemApi.getRequestsByUserId(userId).then((res) => res.data ?? []),
  ]);

  const totals = { ...EMPTY_MONEY_TOTALS };

  for (const tx of deposits) {
    // Same figure the Deposits tab shows as Paid: totalPaid, else the fiat amount.
    const paid =
      tx.totalPaid != null
        ? Number(tx.totalPaid)
        : tx.fiatCurrency
          ? Number(tx.amount || 0)
          : 0;
    totals.depositUsd += Number.isFinite(paid) ? paid : 0;
    totals.depositCount += 1;
  }

  for (const r of redeems) {
    const amount = Number(r.amount) || 0;
    // Money has left once the request is released (paidAt) — the moment the
    // dashboard's Gross Withdrawals counts it. Pending = still owed.
    if (r.paidAt) {
      totals.withdrawalUsd += amount;
      totals.withdrawalCount += 1;
    } else if (r.status === "PENDING" || r.status === "APPROVED") {
      totals.pendingWithdrawalUsd += amount;
    }
  }

  return totals;
}

const fmtUsd = (value: number) =>
  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const WalletTab = () => {
  const { username: userId } = useParams<{ username: string }>();
  const [data, setData] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

  // Balance edit: `editBase` is the wallet as it stood when Edit was clicked
  // (sent as `expected`, so the API can refuse if it moved meanwhile); `draft`
  // is what the admin is typing; `editTarget` is the parsed draft under review.
  // Saving raises a PENDING request on the Manual Deposit Listing — nothing
  // moves until it is approved there.
  const [editing, setEditing] = useState(false);
  const [editBase, setEditBase] = useState<EditSnapshot | null>(null);
  const [draft, setDraft] = useState<DraftBalances | null>(null);
  const [editTarget, setEditTarget] = useState<EditSnapshot | null>(null);

  const [disableWallet, setDisableWallet] = useState(false);
  const [restrictDeposit, setRestrictDeposit] = useState(false);
  const [restrictWithdraw, setRestrictWithdraw] = useState(false);
  // How many of this player's requests are still waiting on the Manual Deposit
  // Listing. The notice is only worth showing when there is actually something
  // held there — as a permanent caption it was just noise on the row.
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  // The first chunk is on screen while the rest of a long history streams in.
  const [loadingMore, setLoadingMore] = useState(false);
  // Only the newest fetch may write state: switching filters mid-stream would
  // otherwise let the abandoned run append its pages to the new result.
  const transactionsRequestId = useRef(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Lifetime money in / out, on the same definitions as the Deposits tab's
  // "User Deposit" card and the dashboard's Gross Withdrawals. Null = loading.
  const [moneyTotals, setMoneyTotals] = useState<MoneyTotals | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setMoneyTotals(null);
    fetchMoneyTotals(userId)
      .then((totals) => {
        if (!cancelled) setMoneyTotals(totals);
      })
      .catch(() => {
        if (!cancelled) setMoneyTotals(EMPTY_MONEY_TOTALS);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const walletFields = useMemo(
    () => buildWalletFields(TYPE_OPTIONS, SOURCE_OPTIONS),
    []
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
  } = useEntityFilters({ fields: walletFields, defaults: WALLET_DEFAULTS });

  // Only these two reach the API; the rest are applied to the grouped rows.
  const typeFilter = filters.type;
  const sourceFilter = filters.source;



  const PAGE_SIZE = 10;

  const fetchPendingApprovals = useCallback(async (username?: string) => {
    if (!username) return;
    try {
      // The listing searches by username/email, so rows are narrowed to this
      // player's id — a partial username match must not count someone else's.
      const res = await manualDepositApi.listing({
        status: "PENDING",
        search: username,
        limit: 50,
      });
      const mine = (res.data?.data ?? []).filter(
        (row) => !row.user?.username || row.user.username === username,
      );
      setPendingApprovals(mine.length);
    } catch {
      // A failed check just leaves the notice hidden.
      setPendingApprovals(0);
    }
  }, []);

  const fetchWalletData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/profile/user/${userId}`);
      setData(response.data);
      void fetchPendingApprovals(response.data?.username);
      setDisableWallet(response.data.disableWallet || false);
      setRestrictDeposit(response.data.restrictDeposit || false);
      setRestrictWithdraw(response.data.restrictWithdraw || false);
    } catch (err: any) {
      console.error("Failed to fetch wallet data:", err);
      setError("Failed to load wallet data.");
    } finally {
      setLoading(false);
    }
  }, [userId, fetchPendingApprovals]);

  /*
    The whole history, however long it is.

    This used to request `limit: 100` with no `page` and paginate those hundred
    rows ten at a time, so the pager stopped dead at page 10 and every older
    transaction was unreachable. Rows are GROUPED after fetching (a redeem and
    its refund render as one row), so server-side paging would split pairs
    across page boundaries — the history is pulled in chunks instead and the
    grouping and paging stay client-side.

    Chunks are appended as they land rather than awaited as a whole: the first
    page of a long history renders immediately and the rest fills in behind it.
    There is no row ceiling — a player with 40,000 transactions gets all of
    them — only a request guard so a stale fetch cannot overwrite a newer one.
  */
  const fetchTransactions = useCallback(async () => {
    // 200 is the API ceiling (it clamps `limit`), and the page offset is
    // derived from the SERVED size — asking for more would silently re-read the
    // same 200 rows under a different page number.
    const CHUNK = 200;
    const token = ++transactionsRequestId.current;
    const isStale = () => token !== transactionsRequestId.current;

    try {
      setLoadingTransactions(true);
      setLoadingMore(false);
      const params = {
        userId,
        ...(typeFilter !== WALLET_ALL ? { type: typeFilter } : {}),
        ...(sourceFilter !== WALLET_ALL ? { source: sourceFilter } : {}),
      };

      const first = await transactionsApi.getAllTransactions({
        ...params,
        limit: CHUNK,
        page: 1,
      });
      if (isStale()) return;

      const rows = [...(first.data.data || [])];
      const total = first.data.total ?? rows.length;
      setTransactions(rows);
      setLoadingTransactions(false);

      const pages = Math.ceil(total / CHUNK);
      if (pages <= 1) return;

      // Sequential: one player's history is a background read, not worth
      // opening dozens of parallel connections for.
      setLoadingMore(true);
      for (let page = 2; page <= pages; page++) {
        const res = await transactionsApi.getAllTransactions({
          ...params,
          limit: CHUNK,
          page,
        });
        if (isStale()) return;
        const batch = res.data.data || [];
        if (!batch.length) break;
        rows.push(...batch);
        setTransactions([...rows]);
      }
    } catch (err) {
      if (isStale()) return;
      console.error("Failed to fetch wallet transactions:", err);
      setTransactions([]);
    } finally {
      if (!isStale()) {
        setLoadingTransactions(false);
        setLoadingMore(false);
      }
    }
  }, [userId, typeFilter, sourceFilter]);

  const refresh = () => {
    fetchWalletData();
    fetchTransactions();
  };

  useEffect(() => {
    if (userId) fetchWalletData();
  }, [userId, fetchWalletData]);

  useEffect(() => {
    if (userId) fetchTransactions();
  }, [userId, fetchTransactions]);

  // A narrowed filter can leave fewer pages than the one being viewed.
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Group first, then paginate — otherwise a pair split across a page boundary
  // would render as two half-rows on different pages.
  const historyRows = useMemo(
    () => buildHistoryRows(transactions),
    [transactions],
  );

  // Grouped rows are filtered here (the server never saw the grouping), then paged.
  const filteredRows = useMemo(
    () => filterWalletRows(historyRows, filters),
    [historyRows, filters]
  );

  // The whole history is pulled in chunks before it is grouped, so a column
  // sort orders every entry rather than the ten rows currently on screen.
  const { sort, toggle } = useTableSort<"date" | "amount" | "type" | "source" | "status">();
  const visibleRows = useSortedRows(filteredRows, sort, {
    date: (row) => new Date(row.createdAt).getTime(),
    // One row can move two currencies; the largest movement is what the
    // Amount column leads with, so that is what it sorts on.
    amount: (row) =>
      row.entries.reduce(
        (largest, entry) => Math.max(largest, Math.abs(Number(entry.amount) || 0)),
        0
      ),
    type: (row) => row.type,
    source: (row) => row.source,
    status: (row) => row.status.label,
  });

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));

  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return visibleRows.slice(start, start + PAGE_SIZE);
  }, [visibleRows, currentPage]);

  const handleToggle = async (key: string, value: boolean) => {
    // Optimistic UI update
    if (key === "disableWallet") setDisableWallet(value);
    if (key === "restrictDeposit") setRestrictDeposit(value);
    if (key === "restrictWithdraw") setRestrictWithdraw(value);

    try {
      await api.put(`/profile/${userId}`, {
        [key]: value,
      });
    } catch (err) {
      console.error(`Failed to update ${key}:`, err);
      // Revert the state on error
      if (key === "disableWallet") setDisableWallet(!value);
      if (key === "restrictDeposit") setRestrictDeposit(!value);
      if (key === "restrictWithdraw") setRestrictWithdraw(!value);
    }
  };

  const startEdit = () => {
    const w = data?.wallet;
    const base: EditSnapshot = {
      xp: Math.round((Number(data?.xp) || 0) * 100) / 100,
      wulfCash: Number(w?.wulfCash) || 0,
      wulfCoin: Number(w?.wulfCoin) || 0,
      bonusWulfCash: Number(w?.bonusWulfCash) || 0,
    };
    setEditBase(base);
    setDraft(toDraft(base));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditBase(null);
    setDraft(null);
    setEditTarget(null);
  };

  const handleDraftChange = (key: keyof EditSnapshot, value: string) => {
    // XP is kept to the cent (users.xp numeric(20,2)), same input rule as balances.
    if (!BALANCE_INPUT.test(value)) return;
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  // Save does not write anything: it opens the comparison + reason dialog.
  const handleSaveClick = () => {
    if (!draft || !editBase) return;
    const parsed = {} as EditSnapshot;
    for (const key of EDIT_KEYS) {
      const raw = draft[key].trim();
      const value = Number(raw);
      if (raw === "" || raw === "." || !Number.isFinite(value) || value < 0) {
        toast.error("Every value needs a valid number (0 or more)");
        return;
      }
      // XP takes 2 decimals like the balances (users.xp is numeric(20,2)).
      if (key === "xp" && !/^\d+(\.\d{1,2})?$/.test(raw)) {
        toast.error("XP can have at most 2 decimal places");
        return;
      }
      parsed[key] = Math.round(value * 100) / 100;
    }
    const changed = EDIT_KEYS.some((k) => Math.abs(parsed[k] - editBase[k]) >= 0.005);
    if (!changed) {
      toast("Nothing was changed");
      return;
    }
    setEditTarget(parsed);
  };

  const finishEdit = () => {
    cancelEdit();
    refresh();
  };

  /** Where the pending request waits — searched to this player. */
  const listingHref = `/wallet/manual-deposit-listing${
    data?.username ? `?search=${encodeURIComponent(data.username)}` : ""
  }`;


  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-40 bg-gray-700/40" />
        <div className="overflow-hidden rounded-lg border border-gray-800 bg-[#15181E]">
          <TableSkeleton rows={6} cols={7} />
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-20 text-red-400">{error}</div>;
  }

  const wallet = data?.wallet;

  return (
    <div className="space-y-4 text-white md:space-y-6">
      {/* TOP CONTROLS */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 md:gap-x-6">
        <Toggle
          label="Disable Wallet"
          value={disableWallet}
          onChange={(val) => handleToggle("disableWallet", val)}
        />

        <Toggle
          label="Restrict Deposit"
          value={restrictDeposit}
          onChange={(val) => handleToggle("restrictDeposit", val)}
        />

        <Toggle
          label="Restrict Withdraw"
          value={restrictWithdraw}
          onChange={(val) => handleToggle("restrictWithdraw", val)}
        />

        {/*
        <div className="flex items-center gap-4 ml-auto">
          <span className="text-sm text-white/80">Allow Negative Limit</span>

          <div className="flex flex-col gap-3">
            <LimitInput image={chip} />
            <LimitInput image={diamond} />
          </div>
        </div>
        */}
        {/* Sits with the toggles on the left, in the space the actions leave —
            it explains the toggles' neighbour (Edit Balance) without crowding
            the buttons it describes. */}
        {pendingApprovals > 0 && (
          <span className="hidden min-w-0 flex-1 items-center gap-1 text-[10px] leading-tight text-amber-300/90 md:inline-flex">
            <Info className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {pendingApprovals === 1
                ? "1 change is waiting for approval on the Manual Deposit Listing"
                : `${pendingApprovals} changes are waiting for approval on the Manual Deposit Listing`}
            </span>
          </span>
        )}

        {/* Actions share the toggles row, pushed to the right. */}
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          {/* Raising an edit needs EITHER the dedicated grant
              (wallet:balance-edit) OR wallet:manual-deposit — the API accepts
              the same pair. Manual deposit already credits a player's balance,
              so a role holding it is not gaining reach here; the edit is still
              only applied once approved on the Manual Deposit Listing, which is
              its own separate grant. */}
          {/* Balance edits and manual deposits for this player are approved on
              the listing — opened already searched to this player. */}
          <PermissionGuard permission={NAV_PERMISSIONS.WALLET_MANUAL_DEPOSIT_LISTING}>
            <Link href={listingHref}>
              <Button
                variant="outline"
                className="border-gray-700 bg-transparent text-white hover:bg-white/5 hover:text-white text-xs h-9 px-4"
              >
                Manual Deposit Listing
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
          </PermissionGuard>
          <PermissionGuard
            permissions={[
              NAV_PERMISSIONS.WALLET_BALANCE_EDIT,
              NAV_PERMISSIONS.WALLET_MANUAL_DEPOSIT,
            ]}
          >
            {editing ? (
              <>
                <Button
                  variant="ghost"
                  onClick={cancelEdit}
                  className="text-gray-400 hover:text-white hover:bg-white/5 text-xs h-9 px-4"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveClick}
                  className="bg-[#B93DEB] hover:bg-[#a32cd6] text-white text-xs h-9 px-4"
                >
                  <Save className="h-3.5 w-3.5 mr-1" />
                  Save
                </Button>
              </>
            ) : (
              <Button
                onClick={startEdit}
                variant="outline"
                className="border-gray-700 bg-transparent text-white hover:bg-white/5 text-xs h-9 px-4"
              >
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Edit Balance
              </Button>
            )}
          </PermissionGuard>
        </div>
      </div>

      {/* BALANCE CARDS */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7 gap-3 sm:gap-4">
          {/* Total XP drives the VIP tier (1 SC wagered = 1 XP); editing it
              re-derives the tier on save. */}
          <BalanceCard
            title="Total XP"
            icon={<Sparkles className="h-[34px] w-[34px] my-1 text-sky-300" />}
            editValue={editing ? draft?.xp : undefined}
            onEditChange={(v) => handleDraftChange("xp", v)}
            subLabel={editing ? "VIP tier recalculates on approval" : "1 SC wagered = 1 XP"}
            value={(Number(data?.xp) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          />
          <BalanceCard
            title="WulfCash"
            image={twonotes}
            editValue={editing ? draft?.wulfCash : undefined}
            onEditChange={(v) => handleDraftChange("wulfCash", v)}
            value={
              wallet?.wulfCash?.toLocaleString(undefined, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              }) || "0.0"
            }
          />
          <BalanceCard
            title="WulfCoin"
            image={coingold}
            imageClassName="scale-[0.68]"
            editValue={editing ? draft?.wulfCoin : undefined}
            onEditChange={(v) => handleDraftChange("wulfCoin", v)}
            value={wallet?.wulfCoin?.toLocaleString() || "0"}
          />
          <BalanceCard
            title="Bonus Balance"
            image={coinpurple}
            editValue={editing ? draft?.bonusWulfCash : undefined}
            onEditChange={(v) => handleDraftChange("bonusWulfCash", v)}
            value={
              wallet?.bonusWulfCash?.toLocaleString(undefined, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              }) || "0.0"
            }
          />
          {/* Not the Wulf Cash balance: this is what the player sees as
              "Available Balance" on their Redeem screen, with rollover-locked
              money excluded. It is derived (WulfCash minus rollover locks), so
              it is never typed directly — it follows the WulfCash edit. */}
          <BalanceCard
            title="Redeemable"
            image={coingreen}
            subLabel={
              editing
                ? "Calculated from WulfCash — updates after approval"
                : wallet?.lockedWulfCash
                  ? `${wallet.lockedWulfCash.toLocaleString(undefined, {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })} locked in rollover`
                  : undefined
            }
            value={
              wallet?.availableToWithdraw?.toLocaleString(undefined, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              }) ?? "0.0"
            }
          />
          {/* Lifetime USD, read-only: not wallet balances, so no edit input. */}
          <BalanceCard
            title="Total Deposit"
            icon={<ArrowDownCircle className="h-[34px] w-[34px] my-1 text-emerald-400" />}
            value={moneyTotals ? fmtUsd(moneyTotals.depositUsd) : "…"}
            subLabel={
              moneyTotals
                ? `${moneyTotals.depositCount.toLocaleString()} paid ${moneyTotals.depositCount === 1 ? "purchase" : "purchases"} · excl. manual credits`
                : undefined
            }
          />
          <BalanceCard
            title="Total Withdrawal"
            icon={<ArrowUpCircle className="h-[34px] w-[34px] my-1 text-rose-400" />}
            value={moneyTotals ? fmtUsd(moneyTotals.withdrawalUsd) : "…"}
            subLabel={
              moneyTotals
                ? `${moneyTotals.withdrawalCount.toLocaleString()} paid out${
                    moneyTotals.pendingWithdrawalUsd > 0
                      ? ` · ${fmtUsd(moneyTotals.pendingWithdrawalUsd)} pending`
                      : ""
                  }`
                : undefined
            }
          />
        </div>
      </div>

      <FilterToolbar
        title="Transactions History"
        countLabel={
          loadingTransactions
            ? undefined
            : `${visibleRows.length} ${visibleRows.length === 1 ? "entry" : "entries"}`
        }
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search source, reason or status"
        activeCount={activeCount}
        chips={chips}
        hasAnyFilter={hasAnyFilter}
        onOpenFilters={() => setSheetOpen(true)}
        onResetAll={resetFilters}
        // Add Balance button hidden for now — uncomment to restore.
        // actions={
        //   /* Creating a deposit is the wallet:manual-deposit capability no
        //      matter which page hosts the button — the API now enforces it, so
        //      hide the button from anyone the call would 403. */
        //   <PermissionGuard permission={NAV_PERMISSIONS.WALLET_MANUAL_DEPOSIT}>
        //     <Button
        //       onClick={() => setIsDepositModalOpen(true)}
        //       className="bg-[#B93DEB] hover:bg-[#a32cd6] text-white text-xs h-9 px-4 shrink-0"
        //     >
        //       Add Balance
        //     </Button>
        //   </PermissionGuard>
        // }
      />

      <div className="rounded-lg bg-[#15181E] overflow-hidden">


        <div className="overflow-x-auto">
          <table className="w-full table-fixed min-w-[900px]">
            <thead className="bg-[#242B35]">
              <tr className="border-b border-gray-800">
                <SortableTh
                  label="Date"
                  sortKey="date"
                  sort={sort}
                  onToggle={toggle}
                  align="center"
                  className="px-4 py-3 text-center text-xs text-white w-[18%]"
                />
                <SortableTh
                  label="Type"
                  sortKey="type"
                  sort={sort}
                  onToggle={toggle}
                  align="center"
                  className="px-4 py-3 text-center text-xs text-white w-[10%]"
                />
                <SortableTh
                  label="Source"
                  sortKey="source"
                  sort={sort}
                  onToggle={toggle}
                  align="center"
                  className="px-4 py-3 text-center text-xs text-white w-[20%]"
                />
                <SortableTh
                  label="Amount (Cash / Coins)"
                  sortKey="amount"
                  sort={sort}
                  onToggle={toggle}
                  align="center"
                  className="px-4 py-3 text-center text-xs text-white w-[14%]"
                />
                <th className="px-4 py-3 text-center text-xs text-white w-[14%]">
                  Balance Before (Cash / Coins)
                </th>
                <th className="px-4 py-3 text-center text-xs text-white w-[14%]">
                  Balance After (Cash / Coins)
                </th>
                <SortableTh
                  label="Status"
                  sortKey="status"
                  sort={sort}
                  onToggle={toggle}
                  align="center"
                  className="px-4 py-3 text-center text-xs text-white w-[12%]"
                />
              </tr>
            </thead>

            <tbody>
              {loadingTransactions ? (
                <tr>
                  <td colSpan={7} className="p-0">
                    <TableSkeleton rows={5} cols={7} />
                  </td>
                </tr>
              ) : paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12">
                    {/* An empty grid after filtering means "nothing matched",
                        not "this player has no wallet history" — say which. */}
                    <NoData
                      title={
                        hasAnyFilter
                          ? "No transactions match these filters"
                          : "No transactions found"
                      }
                    />
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((row, index) => {
                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-[#1a2030] ${index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"
                        }`}
                    >
                      <td className="px-4 py-4 text-center text-xs text-gray-300">
                        <div className="flex items-center justify-center gap-2">
                          <Calendar size={12} className="text-gray-500" />
                          <span>{new Date(row.createdAt).toLocaleString()}</span>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-center text-xs text-gray-300">
                        {row.type}
                      </td>

                      <td className="px-4 py-4 text-center text-xs">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-gray-300">
                            {row.source.replace(/_/g, " ")}
                          </span>
                          {row.sourceDetail ? (
                            <span className="text-[10px] text-purple-300/80">
                              {row.sourceDetail}
                            </span>
                          ) : null}
                          {/* Why the money moved — without it the source alone
                              never says which reward, note or prize this was. */}
                          {row.reason ? (
                            <span
                              className="text-[10px] text-gray-500"
                              title={row.reason}
                            >
                              {row.reason}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-center text-xs font-medium">
                        <AmountCell entries={row.entries} fiat={row.fiat} />
                      </td>

                      <td className="px-4 py-4 text-center text-xs">
                        <BalanceCell entries={row.entries} side="before" fiat={row.fiat} />
                      </td>

                      <td className="px-4 py-4 text-center text-xs">
                        <BalanceCell entries={row.entries} side="after" fiat={row.fiat} />
                      </td>

                      <td className="px-4 py-4 text-center">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded border uppercase font-bold ${row.status.tone}`}
                        >
                          {row.status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loadingTransactions && loadingMore && (
        <div className="flex items-center justify-center gap-2 py-3 text-xs text-gray-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading older transactions…
        </div>
      )}

      {!loadingTransactions && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}

      <EntityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Transaction Filters"
        description="Filter this player's wallet history"
        fields={walletFields}
        values={filters}
        defaults={WALLET_DEFAULTS}
        onApply={setFilters}
      />

      {/* MANUAL DEPOSIT MODAL */}
      <ManualDepositModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        userId={data?.id || userId}
        username={data?.username || userId}
        onSuccess={refresh}
      />

      {/* BALANCE EDIT CONFIRMATION */}
      {editBase && editTarget && (
        <EditBalanceConfirmModal
          isOpen={!!editTarget}
          onClose={() => setEditTarget(null)}
          userId={data?.id || userId}
          username={data?.username || userId}
          current={editBase}
          target={editTarget}
          onSuccess={finishEdit}
          onConflict={finishEdit}
        />
      )}
    </div>
  );
};

export default WalletTab;

/* ================= SUB COMPONENTS ================= */

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm font-medium">{label}</span>

      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-300
          ${value ? "bg-[#B93DEB]" : "bg-white/20"}
        `}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300
            ${value ? "translate-x-5" : "translate-x-0"}
          `}
        />
      </button>
    </div>
  );
}

function BalanceCard({
  title,
  value,
  image,
  imageClassName,
  subLabel,
  editValue,
  onEditChange,
  icon,
}: {
  title: string;
  value: string;
  image?: any;
  /** Rendered instead of `image` when there is no asset for the card. */
  icon?: ReactNode;
  imageClassName?: string;
  /** Small line under the figure — used to qualify what the number excludes. */
  subLabel?: string;
  /** When set, the figure becomes an input holding this draft value. */
  editValue?: string;
  onEditChange?: (value: string) => void;
}) {
  const isEditing = editValue !== undefined && !!onEditChange;
  return (
    // The 260px cap kept the card from filling its column, so in the single
    // column a phone gets it sat in the left half with dead space beside it.
    // Capped only from `md`, where the grid puts several cards on a row.
    <div className="bg-[#161A21] rounded-lg  overflow-hidden shadow-lg w-full md:max-w-[260px] align-self-start">
      {/* Header */}
      <div className="bg-[#1E2430] text-center py-2 text-sm text-white/70">
        {title}
      </div>

      {/* Content */}
      <div className="flex flex-col items-center justify-center min-h-[10px]  p-2 w-full">
        {/* ICON */}
        {icon ?? (
          <Image
            src={image}
            alt={title}
            width={42}
            height={42}
            className={`object-contain ${imageClassName || ""}`}
          />
        )}

        {/* VALUE */}
        {isEditing ? (
          <div className="w-full px-2 pt-1">
            <Input
              type="text"
              inputMode="decimal"
              aria-label={`New ${title}`}
              value={editValue}
              onChange={(e) => onEditChange!(e.target.value)}
              placeholder="0.00"
              className="bg-[#242B35] border border-[#B93DEB]/60 text-white h-9 text-center text-[16px] font-semibold"
            />
            <span className="block mt-1 text-[10px] text-white/40 text-center">
              Current: {value}
            </span>
          </div>
        ) : (
          <span className="text-[18px] font-semibold tracking-wide">{value}</span>
        )}
        {subLabel ? (
          <span className="mt-1 text-[10px] text-white/40 text-center leading-tight">
            {subLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function LimitInput({ image }: { image: any }) {
  return (
    <div className="flex items-center gap-3 bg-[#161A21] rounded-lg px-4 py-2 w-56 border border-white/10">
      <Image
        src={image}
        alt="coin"
        width={20}
        height={20}
        className="object-contain"
      />

      <input
        type="text"
        placeholder="-10,000"
        className="bg-transparent outline-none text-sm w-full text-white placeholder-white/40"
      />
    </div>
  );
}
