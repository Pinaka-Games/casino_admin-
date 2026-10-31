"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  SortableTh,
  useSortedRows,
  useTableSort,
} from "@/components/filters/tableSort";
import CopyButton from "@/components/CopyButton";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, Eye, Calendar, ChevronDown, ArrowLeft, CheckCircle2, Clock, Send, XCircle, Copy, Filter, Settings } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DatePicker from "@/components/DatePicker";
import NoData from "@/components/NoData";
import Pagination from "@/components/Pagination";
import ExportCSV from "@/components/ExportCSV";
import { formatUtcDateTime, formatUtcDateTimeFull, toReportDay } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  transactionsApi,
  Transaction,
  BreezePayinSummary,
  CoinflowPayinSummary,
} from "@/api/transactions/transactions.api";
import { coingold, coingreen } from "@/assets/icons";

const PAGE_SIZE = 10;

/**
 * Sources shown when no specific one is picked.
 *
 * Shared by the table and the CSV export so a download always matches what is
 * on screen — the two lists had drifted apart. MANUAL_DEPOSIT is deliberately
 * excluded: admin-credited deposits have their own listing, and they carry no
 * Amount Paid, so here they only added rows with empty money columns.
 */
const DEFAULT_SOURCES =
  "BUNDLE_PURCHASE,SUBSCRIPTION_BUY,SUBSCRIPTION_UPGRADE,SUBSCRIPTION_RENEW,BREEZE_PAYIN,COINFLOW_PAYIN";

const SOURCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "All", label: "All Entry Sources" },
  { value: "BUNDLE_PURCHASE", label: "Bundle Purchase" },
  { value: "SUBSCRIPTION_BUY", label: "Subscription Buy" },
  { value: "SUBSCRIPTION_UPGRADE", label: "Subscription Upgrade" },
  { value: "SUBSCRIPTION_RENEW", label: "Subscription Renew" },
  // NOT an admin action, despite the label it used to carry. WALLET_ADD is the
  // default source for any wallet credit that isn't a purchase — jackpot and
  // raffle prizes, profile-completion bonuses, waitlist reward grants. An
  // admin-entered deposit is MANUAL_DEPOSIT and lives on its own listing, so
  // "Admin Credit" here pointed operators at the wrong screen entirely.
  { value: "WALLET_ADD", label: "Wallet Credit (System)" },
];
// DEPOSIT_BONUS is deliberately absent too: a deposit bonus is a granted
// credit, not money the player paid in, and it is already excluded from the
// default "All Entry Sources" query — so offering it as a filter surfaced rows
// with no Amount Paid and no Coins/Cash figures.
//
// TRANSFER is deliberately absent: despite the old "User Transfer" label it is
// written by vault movements and in-wallet currency conversion, never by a
// player-to-player transfer, and none of it is a deposit — the rows rendered
// with no Amount Paid and negative coin/cash values on this screen.

const sourceLabel = (v: string) =>
  SOURCE_OPTIONS.find((o) => o.value === v)?.label ?? v;

const PAYMENT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "All", label: "All Methods" },
  { value: "Breeze", label: "Breeze" },
  { value: "Coinflow", label: "Coinflow" },
];

const paymentLabel = (v: string) =>
  PAYMENT_OPTIONS.find((o) => o.value === v)?.label ?? v;

/**
 * Deposit lifecycle. Only COMPLETED is a `transactions` row; the rest are
 * checkout attempts that stopped at the provider, which the listing pulls in
 * via `includeUnsettled`. Without them the screen could only ever show
 * successes, so a failed or expired payment looked like it never happened.
 */
/**
 * Selectable statuses. There is no "All" entry — an empty selection already
 * means every status, and an explicit All that had to be de-selected when
 * ticking a second box is the usual way multi-selects go wrong.
 */
const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "COMPLETED", label: "Completed" },
  { value: "PENDING", label: "Pending" },
  { value: "PROCESSING", label: "Paid · Not Credited" },
  { value: "FAILED", label: "Failed" },
  { value: "EXPIRED", label: "Expired" },
  { value: "CANCELED", label: "Canceled" },
  // Credited, then the provider took the money back. Not COMPLETED, so the
  // Completed total matches the processor's PAID pay-ins.
  { value: "CHARGEBACK", label: "Charged Back" },
  { value: "REFUNDED", label: "Refunded" },
];

const statusLabel = (v: string) =>
  STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v;

/** What the trigger reads: all, the single choice, or how many are ticked. */
const statusSummary = (selected: string[]) => {
  if (selected.length === 0) return "All Statuses";
  if (selected.length === 1) return statusLabel(selected[0]);
  return `${selected.length} statuses`;
};

/**
 * Status pills, matching Payment Processor Transactions — the same statuses show
 * on both screens and were styled two different ways.
 */
const STATUS_STYLE: Record<string, string> = {
  COMPLETED: "bg-emerald-900/40 text-emerald-400",
  PENDING: "bg-sky-900/40 text-sky-400",
  PROCESSING: "bg-sky-900/40 text-sky-400",
  FAILED: "bg-red-900/40 text-red-400",
  EXPIRED: "bg-amber-900/40 text-amber-400",
  CANCELED: "bg-amber-900/40 text-amber-400",
  CHARGEBACK: "bg-rose-900/50 text-rose-300",
  REFUNDED: "bg-rose-900/50 text-rose-300",
};

const statusStyle = (v: string) =>
  STATUS_STYLE[v] ?? "bg-gray-700 text-gray-300";

const getStatus = (row: Transaction) => (row.status || "COMPLETED").toUpperCase();

/* ============================
   HELPERS
============================ */
// Rendered in UTC, the zone the reports count these rows in — see
// formatUtcDateTime.
const fmtDate = (iso: string) => formatUtcDateTimeFull(iso);

const formatDateTime = (value: string) => formatUtcDateTime(value);

const getUserContact = (row: Transaction) => row.userEmail ?? row.userPhone ?? "—";
const getPaymentMethod = (row: Transaction) => row.paymentMethod ?? "—";

const SOURCE_TITLE: Record<string, string> = {
  BUNDLE_PURCHASE: "Bundle Purchase",
  SUBSCRIPTION_BUY: "Subscription Buy",
  SUBSCRIPTION_UPGRADE: "Subscription Upgrade",
  SUBSCRIPTION_RENEW: "Subscription Renew",
  // System-granted wallet credit (prize, bonus, reward) — not an admin deposit.
  // Matches the filter option and the Wallet tab so one source reads the same
  // everywhere in the panel.
  WALLET_ADD: "Wallet Credit (System)",
  // Kept for display only — a legacy row can still carry this source.
  TRANSFER: "Vault / Conversion",
  DEPOSIT_BONUS: "Deposit Bonus",
  MANUAL_DEPOSIT: "Manual Deposit",
  BREEZE_PAYIN: "Breeze Payin",
  COINFLOW_PAYIN: "Coinflow Payin",
};

/**
 * `productName` arrives as "SUBSCRIPTION_UPGRADE (Player → Hustler)". Split it
 * so the source renders as a readable title and the plan detail drops to its
 * own line instead of overflowing the fixed-width cell.
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

// Subscription payments never credit Wulf Coins / Wulf Cash — they buy plan
// access — so a "0.00 / 0.00" pair there is noise, not data.
const isSubscriptionSource = (row: Transaction) =>
  (row.source ?? "").startsWith("SUBSCRIPTION");

type PayinFlowStatus = "done" | "active" | "failed" | "pending";

interface PayinFlowStep {
  title: string;
  description: string;
  timestamp?: string | null;
  status: PayinFlowStatus;
}

function buildPayinFlow(row: Transaction): PayinFlowStep[] {
  // Coinflow rows were falling through to the "non-Breeze deposit" branch and
  // showing a bare two-step flow, so a Coinflow failure had no visible reason.
  const breeze = row.breezePayin ?? null;
  const payin: BreezePayinSummary | CoinflowPayinSummary | null =
    breeze ?? row.coinflowPayin ?? null;
  const provider = breeze ? "Breeze" : "Coinflow";
  const pageId = breeze
    ? (breeze.breezePageId ?? breeze.id)
    : (row.coinflowPayin?.coinflowSessionId ?? payin?.id);
  const steps: PayinFlowStep[] = [];

  steps.push({
    title: "Checkout Page Created",
    description: payin
      ? `${provider} hosted page created (id: ${pageId}). Amount: ${payin.currency} ${(payin.amountMinor / 100).toFixed(2)}.`
      : "User initiated bundle purchase. Backend created internal transaction record.",
    timestamp: payin?.createdAt ?? row.createdAt,
    status: "done",
  });

  if (payin) {
    const failed = payin.status === "FAILED" || payin.status === "CANCELED" || payin.status === "EXPIRED";
    // A reversal is not a failed payment: the money was taken and the coins were
    // credited before it went back, so it gets its own step rather than reading
    // as "the player never paid".
    const reversed = payin.status === "REFUNDED" || payin.status === "CHARGEBACK";
    const paid = payin.status === "PAID";
    steps.push({
      title: `User Redirected to ${provider}`,
      description: payin.hostedUrl
        ? `User opened hosted checkout. Preferred method: ${payin.paymentType ?? "—"}.`
        : "Hosted URL not generated yet.",
      timestamp: payin.createdAt,
      status: "done",
    });

    if (paid) {
      steps.push({
        title: "Payment Authorized",
        description: `${provider} authorized payment via ${payin.paymentType ?? "unknown"}. Billing email: ${payin.billingEmail ?? "—"}.`,
        timestamp: payin.paidAt,
        status: "done",
      });
      steps.push({
        title: "Webhook PAYMENT_SUCCEEDED",
        description: `${provider} fired ${payin.lastWebhookEventType ?? "PAYMENT_SUCCEEDED"} webhook. Backend validated signature and started wallet credit.`,
        timestamp: payin.paidAt,
        status: "done",
      });
      steps.push({
        title: "Wallet Credited",
        description: "Backend ran bundle purchase logic; wulfCoin and wulfCash credited. Deposit transaction recorded.",
        timestamp: row.createdAt,
        status: "done",
      });
    } else if (reversed) {
      steps.push({
        title: payin.status === "REFUNDED" ? "Payment Refunded" : "Chargeback Raised",
        description:
          payin.failureReason ||
          `${provider} reported a ${payin.status === "REFUNDED" ? "refund" : "chargeback"} after settlement. Review whether credited coins need clawing back.`,
        timestamp: payin.paidAt,
        status: "failed",
      });
    } else if (failed) {
      steps.push({
        title: payin.status === "EXPIRED" ? "Checkout Expired" : payin.status === "CANCELED" ? "Checkout Canceled" : "Payment Failed",
        description:
          payin.failureReason ||
          (payin.errorCode
            ? `${provider} error code: ${payin.errorCode}.`
            : `${provider} rejected the payment.`),
        timestamp: payin.expiredAt ?? payin.paidAt,
        status: "failed",
      });
    } else {
      steps.push({
        title: "Awaiting Payment",
        description: `Checkout page is ${payin.status}. Waiting for user to complete payment on ${provider}.`,
        timestamp: null,
        status: "active",
      });
    }
  } else {
    steps.push({
      title: "Wallet Credited",
      description: "Non-provider deposit (admin credit or manual). Wallet balances updated directly.",
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

function fmtDT(value?: string | null) {
  return formatUtcDateTimeFull(value);
}

function InfoCell({
  label,
  value,
  copy,
}: {
  label: string;
  value: React.ReactNode;
  /** Raw text for the clipboard, when the cell is worth copying. */
  copy?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-[#2A3140] bg-[#1A2030] px-4 py-3">
      <span className="text-[11px] uppercase tracking-wider text-gray-500">{label}</span>
      <span className="flex items-center gap-1.5 text-sm text-white break-all">
        {value}
        {copy ? <CopyButton value={copy} size={12} /> : null}
      </span>
    </div>
  );
}

function DepositDetailView({ row }: { row: Transaction }) {
  const payin = row.breezePayin ?? null;
  const coinflow = row.coinflowPayin ?? null;
  const flow = buildPayinFlow(row);
  const status = (row.status || "COMPLETED").toUpperCase();
  const failureReason =
    row.failureReason ?? payin?.failureReason ?? coinflow?.failureReason ?? null;

  return (
    <div className="flex-1 overflow-y-auto space-y-4 pr-1">
      <div className="bg-[#191D24] rounded-lg p-4">
        <h2 className="text-white text-sm font-semibold mb-3">Deposit Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <InfoCell label="Reference Id" value={<span className="font-mono">{row.referenceId || "—"}</span>} />
          <InfoCell label="Transaction Id" value={<span className="font-mono">{row.id}</span>} />
          <InfoCell label="Email" value={row.userEmail ?? "—"} copy={row.userEmail} />
          <InfoCell label="Phone" value={row.userPhone ?? "—"} copy={row.userPhone} />
          <InfoCell label="Description" value={row.description ?? "—"} />
          <InfoCell label="Product (Source)" value={row.productName ?? row.source} />
          <InfoCell label="Payment Method" value={row.paymentMethod ?? "—"} />
          <InfoCell
            label="Status"
            value={
              <span
                className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold ${statusStyle(status)}`}
              >
                {status}
              </span>
            }
          />
          <InfoCell label="Created At" value={fmtDT(row.createdAt)} />
          {failureReason ? (
            <InfoCell label="Failure Reason" value={failureReason} />
          ) : null}
        </div>
      </div>

      {payin ? (
        <div className="bg-[#191D24] rounded-lg p-4">
          <h2 className="text-white text-sm font-semibold mb-3">Breeze Payin</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <InfoCell label="Payin Id" value={<span className="font-mono">{payin.id}</span>} />
            <InfoCell label="Breeze Page Id" value={payin.breezePageId ?? "—"} />
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

      {coinflow ? (
        <div className="bg-[#191D24] rounded-lg p-4">
          <h2 className="text-white text-sm font-semibold mb-3">Coinflow Payin</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <InfoCell label="Payin Id" value={<span className="font-mono">{coinflow.id}</span>} />
            <InfoCell
              label="Payment Id"
              value={coinflow.coinflowSessionId ?? "—"}
              copy={coinflow.coinflowSessionId}
            />
            <InfoCell
              label="Customer Id"
              value={<span className="font-mono">{coinflow.userId ?? row.userId ?? "—"}</span>}
              copy={coinflow.userId ?? row.userId}
            />
            <InfoCell label="Status" value={coinflow.status} />
            <InfoCell label="Payment Type" value={coinflow.paymentType ?? "—"} />
            <InfoCell
              label="Amount"
              value={`${coinflow.currency} ${(coinflow.amountMinor / 100).toFixed(2)}`}
            />
            <InfoCell label="Billing Email" value={coinflow.billingEmail ?? "—"} />
            <InfoCell label="Customer Email" value={coinflow.customerEmail ?? "—"} />
            <InfoCell label="Last Webhook" value={coinflow.lastWebhookEventType ?? "—"} />
            <InfoCell label="Error Code" value={coinflow.errorCode ?? "—"} />
            <InfoCell label="Failure Reason" value={coinflow.failureReason ?? "—"} />
            <InfoCell label="Paid At" value={fmtDT(coinflow.paidAt)} />
            <InfoCell label="Expired At" value={fmtDT(coinflow.expiredAt)} />
          </div>
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

const TableSkeleton = () => (
  <>
    {[...Array(PAGE_SIZE)].map((_, i) => (
      <tr key={i} className={`${i % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"} animate-pulse`}>
        <td className="px-4 py-4"><div className="h-3 w-32 bg-gray-700/40 rounded" /></td>
        <td className="px-4 py-4"><div className="h-3 w-48 bg-gray-700/40 rounded" /></td>
        <td className="px-4 py-4"><div className="h-3 w-20 bg-gray-700/40 rounded" /></td>
        <td className="px-4 py-4"><div className="h-3 w-24 bg-gray-700/40 rounded" /></td>
        <td className="px-4 py-4"><div className="h-3 w-24 bg-gray-700/40 rounded" /></td>
        <td className="px-4 py-4"><div className="h-3 w-32 bg-gray-700/40 rounded" /></td>
        <td className="px-4 py-4"><div className="h-3 w-16 bg-gray-700/40 rounded" /></td>
        <td className="px-4 py-4 text-center"><div className="h-4 w-4 bg-gray-700/40 rounded mx-auto" /></td>
      </tr>
    ))}
  </>
);

/* ============================
   PAGE COMPONENT
============================ */
/**
 * A date picker hands back midnight local time. Sent as-is, the "to" bound
 * excluded every deposit made later that day — so picking today, or any single
 * day, returned nothing even though rows existed. Widen each bound to cover the
 * whole day the operator picked.
 *
 * The day is the UTC one, because the rows below now print their UTC timestamp
 * and the reports count them on that day. Cutting the filter at LOCAL midnight
 * while labelling the rows UTC would put a row outside the range it was
 * returned for.
 */
const dayStartISO = (d?: Date) => {
  if (!d) return undefined;
  return `${toReportDay(d)}T00:00:00.000Z`;
};

const dayEndISO = (d?: Date) => {
  if (!d) return undefined;
  return `${toReportDay(d)}T23:59:59.999Z`;
};

export default function WalletUserDepositLogs() {
  const router = useRouter();
  const [data, setData] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);
  
  // APPLIED filters (drive the server query). Search (above) applies live.
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [sourceFilter, setSourceFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  // DRAFT filters — edited inside the sheet, committed on "Apply Filters"
  // (mirrors the Players / Withdrawal filter sheets). Seeded from applied on open.
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftStart, setDraftStart] = useState<Date | undefined>();
  const [draftEnd, setDraftEnd] = useState<Date | undefined>();
  const [draftSource, setDraftSource] = useState("All");
  const [draftPayment, setDraftPayment] = useState("All");
  const [draftStatus, setDraftStatus] = useState<string[]>([]);
  const [draftMin, setDraftMin] = useState("");
  const [draftMax, setDraftMax] = useState("");

  useEffect(() => {
    if (!filterOpen) return;
    setDraftStart(startDate);
    setDraftEnd(endDate);
    setDraftSource(sourceFilter);
    setDraftPayment(paymentFilter);
    setDraftStatus(statusFilter);
    setDraftMin(minAmount);
    setDraftMax(maxAmount);
    // Seed the draft from the applied values each time the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterOpen]);

  const hasSideFilters =
    !!startDate ||
    !!endDate ||
    sourceFilter !== "All" ||
    paymentFilter !== "All" ||
    statusFilter.length > 0 ||
    minAmount !== "" ||
    maxAmount !== "";

  // A stable key for the selected statuses: the array is rebuilt on each
  // render, so depending on it directly would refetch in a loop.
  const statusKey = statusFilter.join(",");

  const [detailRow, setDetailRow] = useState<Transaction | null>(null);

  const { sort, toggle } = useTableSort<"date" | "paid">();
  const sortedData = useSortedRows(data, sort, {
    date: (row) => new Date(row.createdAt).getTime(),
    paid: (row) =>
      row.totalPaid != null
        ? Number(row.totalPaid)
        : row.fiatCurrency
          ? Number(row.amount || 0)
          : 0,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await transactionsApi.getAllTransactions({
        page: currentPage,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        fromDate: dayStartISO(startDate),
        toDate: dayEndISO(endDate),
        source: sourceFilter !== "All" ? sourceFilter : DEFAULT_SOURCES,
        paymentMethod: paymentFilter !== "All" ? paymentFilter : undefined,
        minAmount: minAmount !== "" ? Number(minAmount) : undefined,
        maxAmount: maxAmount !== "" ? Number(maxAmount) : undefined,
        // The endpoint splits this on commas, so several statuses can be
        // asked for in one call.
        status: statusFilter.length ? statusFilter.join(",") : undefined,
        // This screen is the deposit ledger, so it wants the attempts that never
        // became money too — otherwise every row reads COMPLETED by definition.
        includeUnsettled: true,
      });
      setData(res.data.data);
      setTotal(res.data.total);
    } catch {
      toast.error("Failed to load deposit logs");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearch, startDate, endDate, sourceFilter, paymentFilter, statusKey, minAmount, maxAmount]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const applyFilters = () => {
    setStartDate(draftStart);
    setEndDate(draftEnd);
    setSourceFilter(draftSource);
    setPaymentFilter(draftPayment);
    setStatusFilter(draftStatus);
    setMinAmount(draftMin);
    setMaxAmount(draftMax);
    setCurrentPage(1);
    setFilterOpen(false);
  };

  const resetFilters = () => {
    setDraftStart(undefined);
    setDraftEnd(undefined);
    setDraftSource("All");
    setDraftPayment("All");
    setDraftStatus([]);
    setDraftMin("");
    setDraftMax("");
    setStartDate(undefined);
    setEndDate(undefined);
    setSourceFilter("All");
    setPaymentFilter("All");
    setStatusFilter([]);
    setMinAmount("");
    setMaxAmount("");
    setSearch("");
    setCurrentPage(1);
  };

  return (
    <div className="h-screen flex flex-col bg-[#15181E] p-3 md:p-6 overflow-hidden">
      <div className="bg-[#191D24] mb-4 py-3 px-4 rounded-lg flex items-center justify-between shadow-lg border border-gray-800/50">
        <h1 className="text-base font-semibold text-white tracking-wide">
          Wallet / User Deposit Logs{detailRow ? " / Details" : ""}
        </h1>
        {detailRow && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDetailRow(null)}
            className="h-9 bg-[#1a2030] text-gray-300 border-gray-700 hover:bg-[#242B35]"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        )}
      </div>

      {detailRow ? (
        <DepositDetailView row={detailRow} />
      ) : (
        <>

      {/* TOOLBAR */}
      <div className="bg-[#191D24] rounded-lg p-2.5 mb-4 flex items-center gap-4 shrink-0 shadow-sm border border-gray-800/30">
        <div className="group relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-gray-500 transition-colors group-focus-within:text-[#B93DEB]" />
          <Input
            placeholder="Search by email or phone..."
            className="h-9 w-full pl-9 bg-[#1a2030]/50 border-gray-700/50 text-white text-xs focus:ring-purple-500 placeholder:text-gray-600 rounded-md transition-all focus:bg-[#1a2030]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Deposit limits and processor settings live in System Configuration;
            the withdrawal listing has the same shortcut. */}
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 bg-[#1a2030] text-gray-400 border-gray-700"
          onClick={() => router.push("/settings/system-configuration")}
          title="Deposit and processor settings"
        >
          <Settings className="h-4 w-4" />
        </Button>

        <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 bg-[#1a2030]/50 border-gray-700/50 text-gray-300 gap-2 hover:bg-[#1a2030] hover:text-white hover:border-purple-500/50 transition-all rounded-md px-4">
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
              // Date pickers and dropdowns portal to <body>; a click inside one
              // counts as "outside" the sheet and would close it. Keep it open
              // when the interaction targets a Radix popper.
              const target = e.target as HTMLElement | null;
              if (target?.closest("[data-radix-popper-content-wrapper]")) {
                e.preventDefault();
              }
            }}
          >
            <SheetHeader className="pb-4 border-b border-gray-700">
              <SheetTitle className="text-lg text-white">Filter Deposits</SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* DATE RANGE */}
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

              {/* TRANSACTION SOURCE */}
              <div className="space-y-2">
                <Label className="text-gray-300">Transaction Source</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between bg-[#242B35] border-gray-700 text-white hover:bg-[#2b323b]"
                    >
                      <span className="truncate">{sourceLabel(draftSource)}</span>
                      <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-(--radix-dropdown-menu-trigger-width) max-h-[280px] overflow-y-auto border-gray-700 bg-[#1a2030] text-white"
                  >
                    {SOURCE_OPTIONS.map((o) => (
                      <DropdownMenuItem
                        key={o.value}
                        onClick={() => setDraftSource(o.value)}
                        className={draftSource === o.value ? "bg-[#2B3240] text-white" : ""}
                      >
                        {o.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* PAYMENT METHOD (provider) */}
              <div className="space-y-2">
                <Label className="text-gray-300">Payment Method</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between bg-[#242B35] border-gray-700 text-white hover:bg-[#2b323b]"
                    >
                      <span className="truncate">{paymentLabel(draftPayment)}</span>
                      <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-(--radix-dropdown-menu-trigger-width) max-h-[280px] overflow-y-auto border-gray-700 bg-[#1a2030] text-white"
                  >
                    {PAYMENT_OPTIONS.map((o) => (
                      <DropdownMenuItem
                        key={o.value}
                        onClick={() => setDraftPayment(o.value)}
                        className={draftPayment === o.value ? "bg-[#2B3240] text-white" : ""}
                      >
                        {o.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* STATUS */}
              <div className="space-y-2">
                <Label className="text-gray-300">Status</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between bg-[#242B35] border-gray-700 text-white hover:bg-[#2b323b]"
                    >
                      <span className="truncate">{statusSummary(draftStatus)}</span>
                      <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-(--radix-dropdown-menu-trigger-width) max-h-[280px] overflow-y-auto border-gray-700 bg-[#1a2030] text-white"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <DropdownMenuCheckboxItem
                        key={o.value}
                        checked={draftStatus.includes(o.value)}
                        // Radix closes the menu on select by default; ticking
                        // several boxes has to leave it open.
                        onSelect={(e) => e.preventDefault()}
                        onCheckedChange={(checked) =>
                          setDraftStatus((prev) =>
                            checked
                              ? [...prev, o.value]
                              : prev.filter((v) => v !== o.value),
                          )
                        }
                        className="text-white focus:bg-[#2B3240] focus:text-white"
                      >
                        {o.label}
                      </DropdownMenuCheckboxItem>
                    ))}

                    {draftStatus.length > 0 && (
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          setDraftStatus([]);
                        }}
                        className="mt-1 border-t border-gray-700 text-xs text-gray-400"
                      >
                        Clear selection (show all)
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* AMOUNT PAID RANGE (USD) */}
              <div className="space-y-2">
                <Label className="text-gray-300">Amount Paid ($)</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="Min"
                    value={draftMin}
                    onChange={(e) => setDraftMin(e.target.value)}
                    className="bg-[#242B35] border-gray-700 text-white text-sm"
                  />
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="Max"
                    value={draftMax}
                    onChange={(e) => setDraftMax(e.target.value)}
                    className="bg-[#242B35] border-gray-700 text-white text-sm"
                  />
                </div>
              </div>
            </div>

            {/* FOOTER — Apply / Reset (Players filter-sheet style) */}
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

        <ExportCSV
          data={data}
          fileName="user_deposit_logs.csv"
          getRowDate={(row) => row.createdAt}
          fetchAll={async (range) => {
            // Pull the COMPLETE matching dataset (all pages), not just the
            // current page. Popover range overrides the toolbar date filter.
            const fromDate = dayStartISO(range.from ?? startDate);
            const toDate = dayEndISO(range.to ?? endDate);
            const source =
              sourceFilter !== "All" ? sourceFilter : DEFAULT_SOURCES;

            const EXPORT_LIMIT = 500;
            const all: Transaction[] = [];
            let page = 1;
            // Safety valve: cap at 100 pages (50k rows).
            for (let i = 0; i < 100; i++) {
              const res = await transactionsApi.getAllTransactions({
                page,
                limit: EXPORT_LIMIT,
                search: debouncedSearch || undefined,
                fromDate,
                toDate,
                source,
                paymentMethod: paymentFilter !== "All" ? paymentFilter : undefined,
                minAmount: minAmount !== "" ? Number(minAmount) : undefined,
                maxAmount: maxAmount !== "" ? Number(maxAmount) : undefined,
                status: statusFilter.length ? statusFilter.join(",") : undefined,
                includeUnsettled: true,
              });
              all.push(...res.data.data);
              if (all.length >= res.data.total || res.data.data.length === 0) break;
              page += 1;
            }
            return all;
          }}
          headers={[
            "Date",
            "Email/Phone",
            "Product Type",
            "Wulf Coins",
            "Wulf Cash",
            "Amount Paid",
            "Currency",
            "Original Price",
            "Discount",
            "Promo Code",
            "Payment Method",
            "Status",
            "Failure Reason",
          ]}
          mapRow={(row) => {
            const coin = Number(row.wulfCoinAdded || (row.currency === "wulfCoin" ? row.amount : 0) || 0);
            const cash = Number(row.wulfCashAdded || (row.currency && row.currency !== "wulfCoin" ? row.amount : 0) || 0);

            // What the user actually PAID — the same resolution the table uses:
            // meta.totalPaid for bundle deposits, else the fiat `amount`. The
            // export was missing this entirely, so a deposit report had no money
            // column in it at all.
            const fiatAmount = row.fiatCurrency ? Number(row.amount || 0) : 0;
            const paid = row.totalPaid != null ? Number(row.totalPaid) : fiatAmount || 0;
            const original = row.originalPrice != null ? Number(row.originalPrice) : null;
            const discount = original != null && original > paid + 0.001 ? original - paid : 0;

            return [
              fmtDate(row.createdAt),
              row.userEmail ?? row.userPhone ?? "—",
              row.productName ?? row.source,
              isSubscriptionSource(row) ? "—" : coin.toFixed(2),
              isSubscriptionSource(row) ? "—" : cash.toFixed(2),
              paid > 0 ? paid.toFixed(2) : "—",
              row.fiatCurrency ?? "USD",
              original != null ? original.toFixed(2) : "—",
              discount > 0 ? discount.toFixed(2) : "—",
              row.promoCode ?? "—",
              row.paymentMethod ?? "—",
              getStatus(row),
              row.failureReason ??
                row.breezePayin?.failureReason ??
                row.coinflowPayin?.failureReason ??
                "—",
            ];
          }}
        />
      </div>

      {/* TABLE */}
      <div className="flex-1 overflow-x-auto overflow-y-auto rounded-lg bg-[#15181E] [&::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">
        <table className="w-full min-w-[1250px] table-fixed">
          <thead className="bg-[#242B35] sticky top-0 z-10">
            <tr className="border-b border-gray-800">
              <SortableTh
                label="Date"
                sortKey="date"
                sort={sort}
                onToggle={toggle}
                className="px-6 py-3 text-white text-xs text-left whitespace-nowrap w-[14%]"
              />
              <th className="px-6 py-3 text-white text-xs text-left whitespace-nowrap w-[18%]">Email/Phone</th>
              <th className="px-6 py-3 text-white text-xs text-left whitespace-nowrap w-[20%]">Product Type</th>
              <th className="px-6 py-3 text-white text-xs text-left whitespace-nowrap w-[10%]">Coins / Cash</th>
              <SortableTh
                label="Amount Paid"
                sortKey="paid"
                sort={sort}
                onToggle={toggle}
                className="px-6 py-3 text-white text-xs text-left whitespace-nowrap w-[12%]"
              />
              <th className="px-6 py-3 text-white text-xs text-left whitespace-nowrap w-[13%]">Payment Method</th>
              <th className="px-6 py-3 text-white text-xs text-left whitespace-nowrap w-[9%]">Status</th>
              <th className="px-6 py-3 text-white text-xs text-center w-[80px]">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton />
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-20 text-center">
                  <NoData title="No deposits found" />
                </td>
              </tr>
            ) : (
              sortedData.map((row, idx) => {
                const coinAdded = Number(row.wulfCoinAdded || 0);
                const cashAdded = Number(row.wulfCashAdded || 0);
                // Fallback for rows that only have a single `amount` + `currency` field
                const fiatAmount = row.fiatCurrency ? Number(row.amount || 0) : 0;
                const fallbackCoin = !row.fiatCurrency && !coinAdded && !cashAdded && row.currency === "wulfCoin" ? Number(row.amount || 0) : 0;
                const fallbackCash = !row.fiatCurrency && !coinAdded && !cashAdded && row.currency !== "wulfCoin" ? Number(row.amount || 0) : 0;
                const displayCoin = coinAdded || fallbackCoin;
                const displayCash = cashAdded || fallbackCash;
                const product = getProductParts(row);
                // Hide the coin/cash pair when nothing was credited (all
                // subscription rows, and any other zero-credit deposit).
                const showCredits =
                  !isSubscriptionSource(row) && (displayCoin > 0 || displayCash > 0);

                // What the user actually PAID (money), and the pre-discount list
                // price. Bundle deposits snapshot these in tx meta; fiat rows fall
                // back to the fiat amount.
                const paid =
                  row.totalPaid != null ? Number(row.totalPaid) : fiatAmount || 0;
                const original =
                  row.originalPrice != null ? Number(row.originalPrice) : null;
                const savedAmount =
                  original != null && original > paid + 0.001 ? original - paid : 0;
                const hasDiscount = savedAmount > 0;

                const rowStatus = getStatus(row);
                const settled = rowStatus === "COMPLETED";
                // On an unsettled row the figure is what the checkout asked for,
                // not what was collected — rendered muted and struck so it is
                // never read as revenue.
                const failureReason =
                  row.failureReason ??
                  row.breezePayin?.failureReason ??
                  row.coinflowPayin?.failureReason ??
                  null;

                return (
                  <tr
                    key={row.id}
                    onClick={() => setDetailRow(row)}
                    className={`${idx % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"} hover:bg-[#1a2030] transition border-b border-gray-800/20 cursor-pointer`}
                  >
                    <td className="px-6 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                    <td className="px-6 py-3 text-xs max-w-[220px]" title={getUserContact(row)}>
                      {/* Copy affordance matches the players list: the address is
                          the handle operators paste into search, tickets and
                          refunds, and re-typing it from a truncated cell is how
                          transpositions happen. */}
                      <div className="flex items-center gap-2 max-w-full">
                        {row.userId ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/users/players-list/${row.userId}`);
                            }}
                            className="text-[#B93DEB] hover:underline truncate max-w-full text-left"
                          >
                            {getUserContact(row)}
                          </button>
                        ) : (
                          <span className="text-gray-300 truncate">{getUserContact(row)}</span>
                        )}

                        {getUserContact(row) !== "—" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(getUserContact(row));
                              toast.success("Copied");
                            }}
                            title="Copy"
                            className="shrink-0 text-gray-500 hover:text-purple-400 transition-colors"
                          >
                            <Copy size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3" title={row.productName ?? row.source}>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-gray-300 text-xs font-medium break-words">
                          {product.title}
                        </span>
                        {product.detail ? (
                          <span className="text-[11px] text-purple-300/80 break-words">
                            {product.detail}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    {/* RECEIVED — Wulf Coins + Wulf Cash the user got, one section.
                        Subscriptions credit neither, so they show a dash. */}
                    <td className="px-6 py-3">
                      {showCredits ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <Image src={coingold} alt="Wulf Coins" width={16} height={16} />
                            <span className="text-xs font-bold text-yellow-500">{displayCoin.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Image src={coingreen} alt="Wulf Cash" width={16} height={16} />
                            <span className="text-xs font-bold text-green-500">{displayCash.toFixed(2)}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                    </td>
                    {/* AMOUNT PAID — the price. On a discount, list price is struck
                        through and the final charged price is shown below it. */}
                    <td className="px-6 py-3">
                      {paid > 0 || fiatAmount > 0 ? (
                        hasDiscount ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[11px] text-gray-500 line-through">
                              ${original!.toFixed(2)}
                            </span>
                            <span
                              className={
                                settled
                                  ? "text-sm font-bold text-white"
                                  : "text-sm font-bold text-gray-500 line-through"
                              }
                              title={settled ? undefined : "Attempted amount — not collected"}
                            >
                              ${paid.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-purple-300">
                              Saved ${savedAmount.toFixed(2)}
                              {row.promoCode ? ` · ${row.promoCode}` : ""}
                            </span>
                          </div>
                        ) : (
                          <span
                            className={
                              settled
                                ? "text-sm font-bold text-white"
                                : "text-sm font-bold text-gray-500 line-through"
                            }
                            title={settled ? undefined : "Attempted amount — not collected"}
                          >
                            ${paid.toFixed(2)}
                            {row.fiatCurrency ? ` ${row.fiatCurrency}` : ""}
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-gray-300 text-xs">{getPaymentMethod(row)}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold ${statusStyle(rowStatus)}`}
                        title={failureReason ?? undefined}
                      >
                        {rowStatus}
                      </span>
                      {failureReason ? (
                        <div className="mt-1 text-[10px] text-red-300/70 line-clamp-2 break-words">
                          {failureReason}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <button
                        className="p-1.5 bg-[#1a2030] rounded-md text-purple-400 hover:text-white hover:bg-purple-600 transition shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailRow(row);
                        }}
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

      {/* FOOTER / PAGINATION */}
      {totalPages > 1 && !loading && (
        <div className="bg-[#191D24] mt-4 px-3 py-2 rounded-lg flex flex-wrap items-center justify-between gap-2 shadow-lg md:px-4">
          <span className="text-xs text-gray-500">
            <span className="hidden sm:inline">Showing </span>
            {data.length} of {total}
            <span className="hidden sm:inline"> results</span>
          </span>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
        </>
      )}
    </div>
  );
}
