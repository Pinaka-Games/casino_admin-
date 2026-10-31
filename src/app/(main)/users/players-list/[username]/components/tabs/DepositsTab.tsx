"use client";

import React, { useEffect, useMemo, useState } from "react";
import ExportCSV from "@/components/ExportCSV/ExportCSV";
import {
  SortableTh,
  useSortedRows,
  useTableSort,
} from "@/components/filters/tableSort";
import Image from "next/image";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  Layers,
  Mail,
  Send,
  Share2,
  Tag as TagIcon,
  XCircle,
} from "lucide-react";
import { transactionsApi, Transaction } from "@/api/transactions/transactions.api";
import {
  formatManualDepositTag,
  type DepositTagTotals,
} from "@/api/manual-deposit/manual-deposit.api";
import Pagination from "@/components/Pagination";
import NoData from "@/components/NoData";
import { Button } from "@/components/ui/button";
import { coingold, coingreen } from "@/assets/icons";

const PAGE_SIZE = 10;

const TableSkeleton = ({ cols, rows = PAGE_SIZE }: { cols: number; rows?: number }) => (
  <>
    {[...Array(rows)].map((_, i) => (
      <tr
        key={i}
        className={`${i % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"} animate-pulse`}
      >
        {Array.from({ length: cols }).map((__, c) => (
          <td key={c} className="px-4 py-4">
            <div className="h-3 w-24 bg-gray-700/40 rounded" />
          </td>
        ))}
      </tr>
    ))}
  </>
);

const formatDateTime = (value: string) => {
  const d = new Date(value);
  return `${d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}, ${d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const SOURCE_TITLE: Record<string, string> = {
  BUNDLE_PURCHASE: "Bundle Purchase",
  SUBSCRIPTION_BUY: "Subscription Buy",
  SUBSCRIPTION_UPGRADE: "Subscription Upgrade",
  SUBSCRIPTION_RENEW: "Subscription Renew",
  // System-granted wallet credit (jackpot / raffle prize, profile-completion
  // bonus, waitlist reward) — NOT an admin deposit. An admin-entered deposit is
  // MANUAL_DEPOSIT, below, and the two must not read as the same thing.
  WALLET_ADD: "Wallet Credit (System)",
  // Vault movements and in-wallet currency conversion, not a player-to-player
  // transfer. Display only — this tab does not query the source.
  TRANSFER: "Vault / Conversion",
  DEPOSIT_BONUS: "Deposit Bonus",
  MANUAL_DEPOSIT: "Manual Deposit",
  BREEZE_PAYIN: "Breeze Payin",
  COINFLOW_PAYIN: "Coinflow Payin",
};

/**
 * `productName` arrives as "SUBSCRIPTION_UPGRADE (Player → Hustler)". Split it
 * so the source reads as a title and the plan detail sits on its own line.
 */
const getProductParts = (row: Transaction) => {
  const raw = row.productName ?? row.source ?? "—";
  const match = /^([^(]+?)\s*\((.+)\)\s*$/.exec(raw);
  const source = (match ? match[1] : raw).trim();
  return {
    title: SOURCE_TITLE[source] ?? source.replace(/_/g, " "),
    detail: match ? match[2].trim() : null,
  };
};

// Subscription payments buy plan access, not currency — no coin/cash credit.
const isSubscriptionSource = (row: Transaction) =>
  (row.source ?? "").startsWith("SUBSCRIPTION");

interface DepositRow {
  /** The transaction opened when the row is clicked. */
  tx: Transaction;
  createdAt: string;
  coin: number;
  cash: number;
  /** Money charged, and the pre-discount list price when there was a discount. */
  paid: number;
  original: number | null;
  promoCode?: string | null;
  fiatCurrency?: string;
  paymentMethod: string | null;
  /** Manual deposits only: the reporting tag, already formatted for display. */
  tag: string | null;
  /** The tag's raw code ("postcard" / "social_media" / "other"), for bucketing. */
  tagKey: string | null;
  /** Transaction source, so a manual deposit can be told from a user purchase. */
  source: string;
  status: string;
}

const toDepositRow = (row: Transaction): DepositRow => {
  const coinAdded = Number(row.wulfCoinAdded || 0);
  const cashAdded = Number(row.wulfCashAdded || 0);
  const fiatAmount = row.fiatCurrency ? Number(row.amount || 0) : 0;
  // Rows that only carry a single `amount` + `currency` (older manual credits).
  const fallbackCoin =
    !row.fiatCurrency && !coinAdded && !cashAdded && row.currency === "wulfCoin"
      ? Number(row.amount || 0)
      : 0;
  const fallbackCash =
    !row.fiatCurrency && !coinAdded && !cashAdded && row.currency !== "wulfCoin"
      ? Number(row.amount || 0)
      : 0;
  const subscription = isSubscriptionSource(row);

  return {
    tx: row,
    createdAt: row.createdAt,
    coin: subscription ? 0 : coinAdded || fallbackCoin,
    cash: subscription ? 0 : cashAdded || fallbackCash,
    paid: row.totalPaid != null ? Number(row.totalPaid) : fiatAmount,
    original: row.originalPrice != null ? Number(row.originalPrice) : null,
    promoCode: row.promoCode,
    fiatCurrency: row.fiatCurrency,
    paymentMethod: row.paymentMethod ?? null,
    tag: row.meta?.depositTag
      ? formatManualDepositTag(row.meta.depositTag, row.meta.depositTagDetail)
      : null,
    tagKey: row.meta?.depositTag ?? null,
    source: row.source,
    status: row.status || "COMPLETED",
  };
};

// A manual deposit credits coin and cash as two transactions sharing one
// referenceId (the pairId). They are one deposit to the admin, so show one row.
const GROUPED_SOURCES = new Set(["MANUAL_DEPOSIT", "DAILY_STREAK"]);

const buildDepositRows = (transactions: Transaction[]): DepositRow[] => {
  const rows: DepositRow[] = [];
  const byKey = new Map<string, DepositRow>();

  for (const tx of transactions) {
    const row = toDepositRow(tx);
    const key =
      tx.referenceId && GROUPED_SOURCES.has(tx.source)
        ? `${tx.source}|${tx.referenceId}`
        : null;
    const existing = key ? byKey.get(key) : undefined;

    if (!existing) {
      rows.push(row);
      if (key) byKey.set(key, row);
      continue;
    }

    existing.coin += row.coin;
    existing.cash += row.cash;
    existing.paid += row.paid;
    existing.paymentMethod = existing.paymentMethod ?? row.paymentMethod;
    // Both halves of a coin+cash pair carry the same tag, but a row written
    // before tagging existed has none — take it from whichever half has it.
    existing.tag = existing.tag ?? row.tag;
    existing.tagKey = existing.tagKey ?? row.tagKey;
  }

  return rows;
};

function fmtDT(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

type PayinFlowStatus = "done" | "active" | "failed" | "pending";

interface PayinFlowStep {
  title: string;
  description: string;
  timestamp?: string | null;
  status: PayinFlowStatus;
}

function buildPayinFlow(row: Transaction): PayinFlowStep[] {
  const payin = row.breezePayin ?? row.coinflowPayin ?? null;
  const providerName = row.coinflowPayin && !row.breezePayin ? "Coinflow" : "Breeze";
  const payinPageRef =
    row.breezePayin?.breezePageId ??
    row.coinflowPayin?.coinflowSessionId ??
    payin?.id ??
    null;
  const steps: PayinFlowStep[] = [];

  steps.push({
    title: "Checkout Page Created",
    description: payin
      ? `${providerName} hosted page created (id: ${payinPageRef ?? payin.id}). Amount: ${payin.currency} ${(payin.amountMinor / 100).toFixed(2)}.`
      : "User initiated bundle purchase. Backend created internal transaction record.",
    timestamp: payin?.createdAt ?? row.createdAt,
    status: "done",
  });

  if (payin) {
    const failed =
      payin.status === "FAILED" ||
      payin.status === "CANCELED" ||
      payin.status === "EXPIRED";
    const paid = payin.status === "PAID";
    steps.push({
      title: `User Redirected to ${providerName}`,
      description: payin.hostedUrl
        ? `User opened hosted checkout. Preferred method: ${payin.paymentType ?? "—"}.`
        : "Hosted URL not generated yet.",
      timestamp: payin.createdAt,
      status: "done",
    });

    if (paid) {
      steps.push({
        title: "Payment Authorized",
        description: `${providerName} authorized payment via ${payin.paymentType ?? "unknown"}. Billing email: ${payin.billingEmail ?? "—"}.`,
        timestamp: payin.paidAt,
        status: "done",
      });
      steps.push({
        title: "Webhook PAYMENT_SUCCEEDED",
        description: `${providerName} fired ${payin.lastWebhookEventType ?? "PAYMENT_SUCCEEDED"} webhook. Backend validated signature and started wallet credit.`,
        timestamp: payin.paidAt,
        status: "done",
      });
      steps.push({
        title: "Wallet Credited",
        description:
          "Backend ran bundle purchase logic; wulfCoin and wulfCash credited. Deposit transaction recorded.",
        timestamp: row.createdAt,
        status: "done",
      });
    } else if (failed) {
      steps.push({
        title:
          payin.status === "EXPIRED"
            ? "Checkout Expired"
            : payin.status === "CANCELED"
              ? "Checkout Canceled"
              : "Payment Failed",
        description:
          payin.failureReason ||
          (payin.errorCode ? `${providerName} error code: ${payin.errorCode}.` : `${providerName} rejected the payment.`),
        timestamp: payin.expiredAt ?? payin.paidAt,
        status: "failed",
      });
    } else {
      steps.push({
        title: "Awaiting Payment",
        description: `Checkout page is ${payin.status}. Waiting for user to complete payment on ${providerName}.`,
        timestamp: null,
        status: "active",
      });
    }
  } else {
    steps.push({
      title: "Wallet Credited",
      description:
        "Non-Breeze deposit (admin credit or manual). Wallet balances updated directly.",
      timestamp: row.createdAt,
      status: "done",
    });
  }

  return steps;
}

function FlowIcon({ status }: { status: PayinFlowStatus }) {
  if (status === "done") return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
  if (status === "failed") return <XCircle className="h-5 w-5 text-red-400" />;
  if (status === "active") return <Send className="h-5 w-5 text-blue-400" />;
  return <Clock className="h-5 w-5 text-gray-500" />;
}

function InfoCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-[#2A3140] bg-[#1A2030] px-4 py-3">
      <span className="text-[11px] uppercase tracking-wider text-gray-500">{label}</span>
      <span className="text-sm text-white break-all">{value}</span>
    </div>
  );
}

function DepositDetailView({ row }: { row: Transaction }) {
  const payin = row.breezePayin ?? row.coinflowPayin ?? null;
  const providerName = row.coinflowPayin && !row.breezePayin ? "Coinflow" : "Breeze";
  const payinPageRef =
    row.breezePayin?.breezePageId ?? row.coinflowPayin?.coinflowSessionId ?? null;
  const flow = buildPayinFlow(row);

  return (
    <div className="space-y-4">
      <div className="bg-[#191D24] rounded-lg p-4">
        <h2 className="text-white text-sm font-semibold mb-3">Deposit Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <InfoCell label="Reference Id" value={<span className="font-mono">{row.referenceId || "—"}</span>} />
          <InfoCell label="Transaction Id" value={<span className="font-mono">{row.id}</span>} />
          <InfoCell label="Email" value={row.userEmail ?? "—"} />
          <InfoCell label="Phone" value={row.userPhone ?? "—"} />
          <InfoCell label="Description" value={row.description ?? "—"} />
          <InfoCell label="Product (Source)" value={row.productName ?? row.source} />
          <InfoCell
            label="Tag"
            value={formatManualDepositTag(
              row.meta?.depositTag,
              row.meta?.depositTagDetail,
            )}
          />
          <InfoCell label="Payment Method" value={row.paymentMethod ?? "—"} />
          <InfoCell label="Status" value={row.status || "COMPLETED"} />
          <InfoCell label="Created At" value={fmtDT(row.createdAt)} />
        </div>
      </div>

      {payin ? (
        <div className="bg-[#191D24] rounded-lg p-4">
          <h2 className="text-white text-sm font-semibold mb-3">{providerName} Payin</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <InfoCell label="Payin Id" value={<span className="font-mono">{payin.id}</span>} />
            <InfoCell label={`${providerName} Ref Id`} value={payinPageRef ?? "—"} />
            <InfoCell label="Status" value={payin.status} />
            <InfoCell label="Payment Type" value={payin.paymentType ?? "—"} />
            <InfoCell
              label="Amount"
              value={`${payin.currency} ${(payin.amountMinor / 100).toFixed(2)}`}
            />
            <InfoCell label="Billing Email" value={payin.billingEmail ?? "—"} />
            <InfoCell label="Customer Email" value={payin.customerEmail ?? "—"} />
            <InfoCell label="Last Webhook" value={payin.lastWebhookEventType ?? "—"} />
            <InfoCell label="Error Code" value={payin.errorCode ?? "—"} />
            <InfoCell label="Failure Reason" value={payin.failureReason ?? "—"} />
            <InfoCell label="Paid At" value={fmtDT(payin.paidAt)} />
            <InfoCell label="Expired At" value={fmtDT(payin.expiredAt)} />
          </div>
          {payin.hostedUrl ? (
            <div className="mt-3 rounded-lg border border-[#2A3140] bg-[#1A2030] px-4 py-3 flex items-start gap-2">
              <div className="flex-1">
                <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Hosted URL</div>
                <div className="text-xs text-gray-200 break-all">{payin.hostedUrl}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(payin.hostedUrl!);
                  toast.success("URL copied");
                }}
                className="shrink-0 inline-flex items-center justify-center rounded-md border border-white/10 bg-[#242B35] p-1.5 text-gray-300 hover:bg-[#2b323b] hover:text-white"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="bg-[#191D24] rounded-lg p-4">
        <h2 className="text-white text-sm font-semibold mb-4">Payin Flow</h2>
        <ol className="relative border-l border-[#2A3140] ml-2 space-y-5">
          {flow.map((step, idx) => (
            <li key={idx} className="ml-5">
              <span className="absolute -left-[11px] flex h-6 w-6 items-center justify-center rounded-full bg-[#191D24] border border-[#2A3140]">
                <FlowIcon status={step.status} />
              </span>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3
                  className={`text-sm font-semibold ${
                    step.status === "failed"
                      ? "text-red-300"
                      : step.status === "active"
                        ? "text-blue-300"
                        : step.status === "done"
                          ? "text-emerald-300"
                          : "text-gray-400"
                  }`}
                >
                  {step.title}
                </h3>
                <span className="text-[11px] text-gray-500">{fmtDT(step.timestamp)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** One card's worth of this player's deposits: how many, and what they moved. */
interface PlayerDepositTotals extends DepositTagTotals {
  /** Money charged. Manual deposits cost the player nothing, so they stay at 0. */
  paid: number;
}

const emptyTotals = (): PlayerDepositTotals => ({
  count: 0,
  coin: 0,
  cash: 0,
  paid: 0,
});

/**
 * Buckets this player's deposits for the summary cards. A manual deposit lands
 * in its tag's bucket (an untagged one — raised before tagging existed — only
 * in the total); everything else is a purchase the player made themselves, so
 * it lands in "User Deposit". The four cards therefore partition the table.
 */
const buildDepositSummary = (rows: DepositRow[]) => {
  const total = emptyTotals();
  const buckets: Record<string, PlayerDepositTotals> = {
    user: emptyTotals(),
    postcard: emptyTotals(),
    other: emptyTotals(),
    social_media: emptyTotals(),
  };

  for (const row of rows) {
    const key = row.source === "MANUAL_DEPOSIT" ? row.tagKey : "user";
    for (const bucket of [total, key ? buckets[key] : undefined]) {
      if (!bucket) continue;
      bucket.count += 1;
      bucket.coin += row.coin;
      bucket.cash += row.cash;
      bucket.paid += row.paid;
    }
  }

  return { total, buckets };
};

const SUMMARY_CARDS: {
  title: string;
  key: string;
  icon: React.ComponentType<{ size?: number }>;
}[] = [
  { title: "User Deposit", key: "user", icon: Layers },
  { title: "Postcard", key: "postcard", icon: Mail },
  { title: "Other", key: "other", icon: TagIcon },
  { title: "Social Media", key: "social_media", icon: Share2 },
];

const fmtAmount = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

import FilterToolbar from "@/components/filters/FilterToolbar";
import EntityFilterSheet from "@/components/filters/EntityFilterSheet";
import { useEntityFilters } from "@/components/filters/useEntityFilters";
import {
  DEPOSIT_DEFAULTS,
  DEPOSIT_FIELDS,
  filterDepositRows,
} from "./depositFilters";

const DEPOSIT_SOURCES =
  "BUNDLE_PURCHASE,SUBSCRIPTION_BUY,SUBSCRIPTION_UPGRADE,SUBSCRIPTION_RENEW,MANUAL_DEPOSIT,BREEZE_PAYIN";
// Per-request size while pulling this player's deposits, and a hard stop so a
// pathological account cannot loop forever.
const FETCH_CHUNK = 200;
const MAX_CHUNKS = 25;

const DepositsTab = ({ username }: { username: string }) => {
  const [rows, setRows] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [detailRow, setDetailRow] = useState<Transaction | null>(null);

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
  } = useEntityFilters({ fields: DEPOSIT_FIELDS, defaults: DEPOSIT_DEFAULTS });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Merging a coin+cash pair into one row changes the row count, so the
        // server's transaction-level paging can no longer produce pages of ten.
        // A single player's deposit history is bounded, so pull it once and
        // paginate the merged rows on the client.
        const all: Transaction[] = [];
        for (let p = 1; p <= MAX_CHUNKS; p++) {
          const res = await transactionsApi.getAllTransactions({
            page: p,
            limit: FETCH_CHUNK,
            source: DEPOSIT_SOURCES,
            // Route param is the user's id, so filter on it directly — `search`
            // only matches username / phone / email and would return nothing.
            userId: username,
          });
          if (cancelled) return;
          const batch = res.data.data ?? [];
          all.push(...batch);
          if (!batch.length || all.length >= (res.data.total ?? 0)) break;
        }
        if (!cancelled) setRows(all);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username]);

  const depositRows = useMemo(() => buildDepositRows(rows), [rows]);

  // Cards cover the player's whole deposit history, not the page on screen —
  // and deliberately not the filters either, so narrowing the table does not
  // silently redefine what the totals mean.
  const summary = useMemo(() => buildDepositSummary(depositRows), [depositRows]);

  // Rows are merged (a coin+cash pair is one row) after the fetch, so filtering
  // happens here rather than on the server that never saw the merged shape.
  const filteredRows = useMemo(
    () => filterDepositRows(depositRows, filters),
    [depositRows, filters]
  );

  // The whole deposit history is in memory, so sorting covers all of it.
  const { sort, toggle } = useTableSort<"date" | "paid" | "coin" | "cash">();
  const visibleRows = useSortedRows(filteredRows, sort, {
    date: (row) => new Date(row.createdAt).getTime(),
    paid: (row) => Number(row.paid) || 0,
    coin: (row) => Number(row.coin) || 0,
    cash: (row) => Number(row.cash) || 0,
  });

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));

  // Exactly PAGE_SIZE merged rows per page.
  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return visibleRows.slice(start, start + PAGE_SIZE);
  }, [visibleRows, page]);

  // A narrowed filter can leave fewer pages than the one being viewed.
  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (detailRow) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white text-sm font-semibold">Deposit Details</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDetailRow(null)}
            className="h-9 bg-[#1a2030] text-gray-300 border-gray-700 hover:bg-[#242B35]"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        </div>
        <DepositDetailView row={detailRow} />
      </div>
    );
  }

  if (!loading && !rows.length) {
    return <NoData />;
  }

  return (
    <div className="space-y-4">
      {/* SUMMARY CARDS — this player's deposits split by where they came from:
          their own purchases, and each manual-deposit tag. */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {SUMMARY_CARDS.map((card) => {
          const Icon = card.icon;
          const totals = summary.buckets[card.key];
          return (
            <div
              key={card.key}
              className="rounded-xl border border-[#242B35] bg-[#191D24] p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
                    {card.title}
                  </p>
                  {loading ? (
                    <div className="mt-3 h-7 w-16 animate-pulse rounded bg-gray-700/40" />
                  ) : (
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-white">
                      {totals.count.toLocaleString()}
                    </p>
                  )}
                  {/* The count answers "how many"; the amounts answer "how much",
                      and they cannot be added together — different currencies. */}
                  <div className="mt-2 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-yellow-500">
                      <Image src={coingold} alt="Wulf Coin" width={12} height={12} />
                      {fmtAmount(totals.coin)}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-green-500">
                      <Image src={coingreen} alt="Wulf Cash" width={12} height={12} />
                      {fmtAmount(totals.cash)}
                    </span>
                    {totals.paid > 0 ? (
                      <span className="text-[11px] font-semibold text-gray-300">
                        ${fmtAmount(totals.paid)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#242B35] text-[#C05CFF]">
                  <Icon size={18} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <FilterToolbar
        title="Deposits"
        countLabel={
          loading
            ? undefined
            : `${visibleRows.length} ${visibleRows.length === 1 ? "deposit" : "deposits"}`
        }
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search product, tag, promo or method"
        activeCount={activeCount}
        chips={chips}
        hasAnyFilter={hasAnyFilter}
        onOpenFilters={() => setSheetOpen(true)}
        actions={
          <ExportCSV
            data={visibleRows}
            fileName="player_deposits.csv"
            headers={[
              "Date",
              "Product Type",
              "Coins",
              "Cash",
              "Amount Paid",
              "Tag",
              "Payment Method",
              "Status",
            ]}
            getRowDate={(row) => row.createdAt}
            mapRow={(row) => [
              formatDateTime(row.createdAt),
              row.tx.productName ?? row.tx.source ?? "-",
              Number(row.coin || 0).toFixed(2),
              Number(row.cash || 0).toFixed(2),
              Number(row.paid || 0).toFixed(2),
              row.tag ?? "-",
              row.paymentMethod ?? "-",
              row.status,
            ]}
          />
        }
        onResetAll={resetFilters}
      />

      <div className="overflow-x-auto rounded-lg bg-[#15181E]">
        <table className="w-full table-auto min-w-[760px]">
          <thead className="bg-[#242B35]">
            <tr className="border-b border-gray-800">
              <SortableTh
                label="Date"
                sortKey="date"
                sort={sort}
                onToggle={toggle}
                className="px-4 py-3 text-white text-xs text-left whitespace-nowrap"
              />
              <th className="px-4 py-3 text-white text-xs text-left whitespace-nowrap">Product Type</th>
              <SortableTh
                label="Coins / Cash"
                sortKey="coin"
                sort={sort}
                onToggle={toggle}
                className="px-4 py-3 text-white text-xs text-left whitespace-nowrap"
              />
              <SortableTh
                label="Amount Paid"
                sortKey="paid"
                sort={sort}
                onToggle={toggle}
                className="px-4 py-3 text-white text-xs text-left whitespace-nowrap"
              />
              <th className="px-4 py-3 text-white text-xs text-left whitespace-nowrap">Tag</th>
              <th className="px-4 py-3 text-white text-xs text-left whitespace-nowrap">Payment Method</th>
              <th className="px-4 py-3 text-white text-xs text-left whitespace-nowrap">Status</th>
              <th className="px-4 py-3 text-white text-xs text-center whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={8} />
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12">
                  {/* An empty grid after filtering means "nothing matched",
                      not "this player never deposited" — say which. */}
                  <NoData
                    title={
                      hasAnyFilter
                        ? "No deposits match these filters"
                        : "No deposits found"
                    }
                  />
                </td>
              </tr>
            ) : (
              pageRows.map((row, idx) => {
                const product = getProductParts(row.tx);
                const hasCredits = row.coin > 0 || row.cash > 0;
                const savedAmount =
                  row.original != null && row.original > row.paid + 0.001
                    ? row.original - row.paid
                    : 0;

                return (
                  <tr
                    key={row.tx.id}
                    onClick={() => setDetailRow(row.tx)}
                    className={`${idx % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"} hover:bg-[#1a2030] cursor-pointer`}
                  >
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="px-4 py-3" title={row.tx.productName ?? row.tx.source}>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-gray-300 text-xs font-medium">{product.title}</span>
                        {product.detail ? (
                          <span className="text-[11px] text-purple-300/80">{product.detail}</span>
                        ) : null}
                      </div>
                    </td>
                    {/* RECEIVED — Wulf Coins + Wulf Cash, one section. Subscriptions
                        credit neither, so they show a dash. */}
                    <td className="px-4 py-3">
                      {hasCredits ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <Image src={coingold} alt="Wulf Coins" width={16} height={16} />
                            <span className="text-xs font-bold text-yellow-500">
                              {row.coin.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Image src={coingreen} alt="Wulf Cash" width={16} height={16} />
                            <span className="text-xs font-bold text-green-500">
                              {row.cash.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                    </td>
                    {/* AMOUNT PAID — on a discount, list price is struck through and
                        the charged price sits below it. */}
                    <td className="px-4 py-3">
                      {row.paid > 0 ? (
                        savedAmount > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[11px] text-gray-500 line-through">
                              ${row.original!.toFixed(2)}
                            </span>
                            <span className="text-sm font-bold text-white">
                              ${row.paid.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-purple-300">
                              Saved ${savedAmount.toFixed(2)}
                              {row.promoCode ? ` · ${row.promoCode}` : ""}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm font-bold text-white">
                            ${row.paid.toFixed(2)}
                            {row.fiatCurrency ? ` ${row.fiatCurrency}` : ""}
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs" title={row.tag ?? undefined}>
                      {row.tag ?? <span className="text-gray-500">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs whitespace-nowrap">
                      {row.paymentMethod ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded border border-green-500/20 uppercase font-bold">
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailRow(row.tx);
                        }}
                        className="p-1.5 bg-[#1a2030] rounded-md text-purple-400 hover:text-white hover:bg-purple-600 transition shadow-sm"
                        aria-label="View details"
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}

      <EntityFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Deposit Filters"
        description="Filter this player's deposits by product, tag and amount"
        fields={DEPOSIT_FIELDS}
        values={filters}
        defaults={DEPOSIT_DEFAULTS}
        onApply={setFilters}
      />
    </div>
  );
};

export default DepositsTab;
