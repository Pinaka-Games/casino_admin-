"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import CopyButton from "@/components/CopyButton";
import { Eye, Wrench, FileText, ChevronDown, ChevronUp, ChevronsUpDown, ArrowLeft, ArrowRight, CheckCircle2, Clock, XCircle, Send, Settings, Filter, Search, Calendar } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DatePicker from "@/components/DatePicker";
import Pagination from "@/components/Pagination";
import { formatUtcDateTime, formatUtcDateTimeFull, toReportDay } from "@/lib/utils";
import PayoutFundingBanner from "./PayoutFundingBanner";
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
import WithdrawInformationModal from "../components/withdrawallisting-viewmodel";
import ExportCSV from "@/components/ExportCSV";
import {
  redeemApi,
  RedeemRequest,
  RedeemStatus,
  type RedeemDateBasis,
} from "@/api/redeem/redeem.api";
import {
  useWithdrawalListingStore,
  toListQuery,
  PAYMENT_METHOD_OPTIONS,
  PAYOUT_STATUS_OPTIONS,
  WITHDRAWAL_PAGE_SIZE,
  type PayoutProvider,
  type WithdrawalFilters,
} from "@/store/withdrawal-listing-store";
import { useSystemConfigStore } from "@/store/system-config-store";

const PAGE_SIZE = WITHDRAWAL_PAGE_SIZE;

// Export pulls the filtered set in server-sized chunks. 200 is the API's
// `limit` ceiling; 25 chunks caps a single export at 5,000 rows so one click
// can never hammer the API indefinitely.
const EXPORT_CHUNK_SIZE = 200;
const EXPORT_MAX_PAGES = 25;

// Whole UTC days: the rows print their UTC timestamp and the reports count them
// on that day, so the filter has to cut on the same boundary.
const dayStartISO = (d?: Date) => (d ? `${toReportDay(d)}T00:00:00.000Z` : null);

const dayEndISO = (d?: Date) => (d ? `${toReportDay(d)}T23:59:59.999Z` : null);

/**
 * The two dates a redeem request has, and what each one answers.
 *
 * `created` is when the player filed the request; `paid` is when the money
 * actually left — settlement, or the payout release while it is still in
 * flight. The dashboard's Gross Withdrawals card counts on the paid date and
 * ignores requests that released nothing, which is why the same day used to
 * total differently on the two screens. Switching this screen to `paid` makes
 * them the same question.
 */
const DATE_BASIS_OPTIONS: Array<{
  value: RedeemDateBasis;
  label: string;
  hint: string;
}> = [
  {
    value: "created",
    label: "Request date",
    hint: "Every request, dated when the player filed it.",
  },
  {
    value: "paid",
    label: "Paid date",
    hint: "Released payouts only, dated when the money left. Matches Gross Withdrawals.",
  },
];

/**
 * The Date a picker should show for a stored range bound.
 *
 * Bounds are stored as UTC day boundaries, but `DatePicker` and `dayStartISO`
 * both work in LOCAL calendar fields — so `new Date(iso)` west of Greenwich
 * hands the picker the previous day, and re-applying the sheet then saves that
 * shifted day. Rebuilding as local midnight of the same UTC day makes the
 * round-trip exact in every zone.
 */
const pickerDate = (iso: string | null) => {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return undefined;
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

const DATE_BASIS_LABEL: Record<RedeemDateBasis, string> = {
  created: "Request date",
  paid: "Paid date",
};

const STATUS_OPTIONS: Array<RedeemStatus | "ALL"> = [
  "ALL",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "PROCESSED",
  "CANCELLED",
];

// CANCELLED is spelled out as "CANCELLED BY USER": on this screen every other
// status is something an admin did, so an unqualified "CANCELLED" reads as an
// admin action. Only the player can put a request in this state.
const STATUS_LABELS: Record<RedeemStatus | "ALL", string> = {
  ALL: "All Statuses",
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "DECLINED",
  PROCESSED: "PROCESSED",
  // Distinct from DECLINED: the player withdrew this one themselves.
  CANCELLED: "CANCELLED BY USER",
};

const TableSkeleton = () => (
  <>
    {[...Array(PAGE_SIZE)].map((_, i) => (
      <tr
        key={i}
        className={`${i % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"} animate-pulse`}
      >
        <td className="px-4 py-4"><div className="h-3 w-24 bg-gray-700/40 rounded" /></td>
        <td className="px-4 py-4"><div className="h-3 w-24 bg-gray-700/40 rounded" /></td>
        <td className="px-4 py-4"><div className="h-3 w-16 bg-gray-700/40 rounded" /></td>
        <td className="px-4 py-4"><div className="h-3 w-20 bg-gray-700/40 rounded" /></td>
        <td className="px-4 py-4"><div className="h-3 w-20 bg-gray-700/40 rounded" /></td>
        <td className="px-4 py-4"><div className="h-3 w-16 bg-gray-700/40 rounded" /></td>
        <td className="px-4 py-4"><div className="h-3 w-32 bg-gray-700/40 rounded" /></td>
        <td className="px-4 py-4 text-center"><div className="h-4 w-4 bg-gray-700/40 rounded mx-auto" /></td>
      </tr>
    ))}
  </>
);

const getUserContact = (row: RedeemRequest) =>
  row.userEmail ?? row.userPhone ?? "—";

const getPaymentMethod = (row: RedeemRequest) =>
  row.productName ?? "—";

/**
 * Which provider actually owns this request's payout. `paymentMethod` is stamped
 * on the request the moment the provider is picked, so it is the authority — a
 * request can carry BOTH providers' payout records (each is attached
 * independently, and an admin can create or resume a payout with either), and
 * reading `breezePayout ?? coinflowPayout` then showed a stale Breeze page for a
 * Coinflow request.
 */
const isCoinflowRequest = (row: RedeemRequest): boolean =>
  row.paymentMethod === "COINFLOW_PAYOUT" ||
  (!!row.coinflowPayout && !row.breezePayout);

const getPayout = (row: RedeemRequest) =>
  (isCoinflowRequest(row) ? row.coinflowPayout : row.breezePayout) ?? null;

/**
 * True when a payout page exists but the user has not yet completed their payout
 * details (still PENDING_USER_*, no method/confirmation). Admin should not act on
 * these yet. Covers both providers — Coinflow requests were previously ignored
 * here and showed no badge at all.
 */
const isAwaitingUserDetails = (row: RedeemRequest): boolean => {
  const p = getPayout(row);
  if (!p) return false;
  if (row.status !== "PENDING" && row.status !== "APPROVED") return false;
  // An expired/failed page keeps its last pendingStatus forever; without this
  // check those dead rows kept showing "Awaiting user details".
  if (DEAD_PAYOUT_STATUSES.has(p.status)) return false;
  const pending = (p.pendingStatus ?? "").toUpperCase();
  return pending.startsWith("PENDING_USER") && !p.customerConfirmedAtMs && !p.payoutMethod;
};

const AwaitingUserBadge = () => (
  <span className="inline-flex w-fit items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-300 whitespace-nowrap">
    Awaiting user details
  </span>
);

/**
 * What an APPROVED request is REALLY waiting on.
 *
 * RedeemStatus has no state between APPROVED and PROCESSED, so "APPROVED" covers
 * both "just requested" and "user finished the payment flow, money is moving".
 * The status column showed the bare enum, so a Coinflow request the user had
 * already completed still read APPROVED and looked untouched. This qualifies it
 * from the payout record. Returns null when the plain status already says it all.
 */
const approvedSubState = (
  row: RedeemRequest,
): { label: string; className: string } | null => {
  if (row.status !== "APPROVED") return null;
  const p = getPayout(row);
  if (!p) return null;

  const pending = (p.pendingStatus ?? "").toUpperCase();

  if (["PROCESSED", "COMPLETED"].includes(p.status)) {
    // Payout settled but the request has not been synced across yet.
    return { label: "Payout settled", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" };
  }
  if (p.status === "PROCESSING") {
    return { label: "Payout processing", className: "border-sky-400/30 bg-sky-400/10 text-sky-300" };
  }
  if (["FAILED", "CANCELED", "REFUNDED", "EXPIRED"].includes(p.status)) {
    return { label: `Payout ${p.status.toLowerCase()}`, className: "border-red-400/30 bg-red-400/10 text-red-300" };
  }
  if (p.status === "PENDING" && pending === "PENDING_MERCHANT_RELEASE") {
    return { label: "Awaiting your release", className: "border-purple-400/30 bg-purple-400/10 text-purple-300" };
  }
  if (p.status === "PENDING") {
    // Details submitted (confirmed / method captured) and not user-blocked.
    if (!pending.startsWith("PENDING_USER")) {
      return { label: "Details submitted", className: "border-blue-400/30 bg-blue-400/10 text-blue-300" };
    }
  }
  return null;
};

const ApprovedSubStateBadge = ({ row }: { row: RedeemRequest }) => {
  const sub = approvedSubState(row);
  if (!sub) return null;
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${sub.className}`}
    >
      {sub.label}
    </span>
  );
};

const getPayoutStatus = (row: RedeemRequest): string | null =>
  getPayout(row)?.status ?? null;

/**
 * Status pills, matching Payment Processor Transactions — the same status words
 * appear on both screens and were styled two different ways.
 */
const STATUS_PILL: Record<string, string> = {
  APPROVED: "bg-emerald-900/40 text-emerald-400",
  COMPLETED: "bg-emerald-900/40 text-emerald-400",
  PROCESSED: "bg-emerald-900/40 text-emerald-400",
  PROCESSING: "bg-sky-900/40 text-sky-400",
  PENDING: "bg-sky-900/40 text-sky-400",
  CREATED: "bg-sky-900/40 text-sky-400",
  EXPIRED: "bg-amber-900/40 text-amber-400",
  CANCELED: "bg-amber-900/40 text-amber-400",
  // The player withdrawing their own request, not the platform refusing it.
  CANCELLED: "bg-gray-700 text-gray-300",
  REJECTED: "bg-red-900/40 text-red-400",
  DECLINED: "bg-red-900/40 text-red-400",
  FAILED: "bg-red-900/40 text-red-400",
  REFUNDED: "bg-red-900/40 text-red-400",
};

const statusPill = (status?: string | null) =>
  STATUS_PILL[String(status ?? "").toUpperCase()] ?? "bg-gray-700 text-gray-300";


// A payout page in one of these states is dead: nothing was paid and nothing can
// be released, so it must not read as awaiting anyone's action.
const DEAD_PAYOUT_STATUSES = new Set([
  "EXPIRED",
  "FAILED",
  "CANCELED",
  "REFUNDED",
]);

// UTC, matching the day boundary the reports use — see formatUtcDateTime.
const formatDateTime = (value: string) => formatUtcDateTime(value);

/**
 * The date the Date column shows, for the basis currently applied. On the paid
 * basis the server has already excluded rows without a paid date, so the
 * fallback only ever covers a row rendered mid-switch.
 */
const rowDate = (row: RedeemRequest, basis: RedeemDateBasis) =>
  basis === "paid" ? (row.paidAt ?? row.createdAt) : row.createdAt;

type FlowStepStatus = "done" | "active" | "failed" | "pending";

interface FlowStep {
  title: string;
  description: string;
  timestamp?: string | null;
  status: FlowStepStatus;
}

const PAYOUT_DEAD_STATUSES = [
  "FAILED",
  "CANCELED",
  "REFUNDED",
  "EXPIRED",
  "REJECTED",
];

function buildPayoutFlow(row: RedeemRequest): FlowStep[] {
  const payout = getPayout(row);
  const providerName = isCoinflowRequest(row) ? "Coinflow" : "Breeze";
  const isRejected = row.status === "REJECTED";
  const isProcessed = row.status === "PROCESSED";
  // A payout the gateway killed. Kept separate from the request status because
  // the two genuinely disagree for a while: Breeze reports PROCESSED for a
  // payout that is merely in transit — including one heading for REFUNDED — so
  // a request can read PROCESSED while its payout has already died.
  const payoutFailed =
    !!payout && PAYOUT_DEAD_STATUSES.includes(String(payout.status));
  // The reversal writes this marker when it returns the money.
  const refundedToWallet = /\[Payout Failed\]/.test(row.notes ?? "");

  const steps: FlowStep[] = [];

  steps.push({
    title: "Redeem Requested",
    description: `User submitted redeem request for ${Number(row.amount).toFixed(2)} SC. Amount debited immediately and the ${providerName} payout page was prepared in the same step — there is no admin approval stage.`,
    timestamp: row.createdAt,
    status: "done",
  });

  if (row.status === "CANCELLED") {
    steps.push({
      title: "Cancelled by User",
      description:
        row.notes ||
        "The player withdrew this redeem request before it was released. The amount was refunded to their balance.",
      timestamp: row.processedAt,
      status: "failed",
    });
    return steps;
  }

  // Only a genuine admin decline short-circuits here. A request that reached
  // REJECTED because its payout failed is a gateway refund, not a decision
  // anyone made, and it still deserves the full payout timeline below.
  if (isRejected && !payoutFailed) {
    steps.push({
      title: "Admin Declined",
      description:
        row.notes ||
        "Admin declined the redeem request. Funds returned to the user's balance.",
      timestamp: row.processedAt,
      status: "failed",
    });
    return steps;
  }

  steps.push({
    title: `${providerName} Payout Created`,
    description: payout
      ? `${providerName} payout page generated (id: ${payout.id}). Release method: ${payout.releaseMethod}.`
      : `Payout page creation did not complete. The user can retry it from their pending redemptions, or you can create it here.`,
    timestamp: payout?.createdAt ?? null,
    status: payout ? "done" : "active",
  });

  if (payout) {
    const detailsSubmitted = Boolean(
      payout.customerConfirmedAtMs || payout.payoutMethod,
    );
    steps.push({
      title: "User Submitted Payout Details",
      description: detailsSubmitted
        ? `User completed the ${providerName} form. Destination: ${payout.payoutMethod || "unknown"}.`
        : `Waiting for the user to enter their bank/card details in the ${providerName} form.`,
      timestamp: payout.customerConfirmedAtMs
        ? new Date(payout.customerConfirmedAtMs).toISOString()
        : null,
      status: detailsSubmitted ? "done" : "active",
    });

    const releaseDone = Boolean(payout.releasedAt) || isProcessed;
    steps.push({
      title:
        payout.releaseMethod === "MANUAL"
          ? "Manual Merchant Release"
          : "Auto Release",
      description:
        payout.releaseMethod === "MANUAL"
          ? "Amount is above the auto-release threshold, so an admin must release it. Pending status: PENDING_MERCHANT_RELEASE."
          : "Amount is within the auto-release threshold, so the payout releases itself as soon as the user submits their details.",
      timestamp: payout.releasedAt,
      status: releaseDone
        ? "done"
        : payout.pendingStatus === "PENDING_MERCHANT_RELEASE"
          ? "active"
          : "pending",
    });

    steps.push({
      title: payoutFailed ? "Payout Failed" : "Payout Completed",
      description: payoutFailed
        ? `${providerName} reported ${payout.status}. The money did not reach the player.`
        : `${providerName} processed the payout. Funds delivered to user via ${payout.payoutMethod || providerName}.`,
      timestamp: payout.processedAt,
      status: payoutFailed
        ? "failed"
        : isProcessed
          ? "done"
          : payout.releasedAt
            ? "active"
            : "pending",
    });
  }

  // A failed payout can never end in "Redeem Settled". Showing that green tick
  // under a REFUNDED payout was the timeline contradicting itself and hiding the
  // case that actually needs attention: the player is still debited.
  if (payoutFailed) {
    steps.push({
      title: refundedToWallet ? "Refunded to Wallet" : "Refund Outstanding",
      description: refundedToWallet
        ? "The payout did not complete, so the amount was returned to the player's wallet and the request was closed."
        : "The payout did not complete and the amount was NOT returned automatically. The player is still debited — refund manually and check the failure reason above.",
      timestamp: row.processedAt ?? row.updatedAt,
      status: refundedToWallet ? "done" : "failed",
    });
  } else if (isProcessed) {
    steps.push({
      title: "Redeem Settled",
      description:
        "Redeem request marked PROCESSED. Pending balance deducted; transaction logged.",
      timestamp: row.updatedAt,
      status: "done",
    });
  }

  return steps;
}

function FlowStepIcon({ status }: { status: FlowStepStatus }) {
  if (status === "done") return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
  if (status === "failed") return <XCircle className="h-5 w-5 text-red-400" />;
  if (status === "active") return <Send className="h-5 w-5 text-blue-400" />;
  return <Clock className="h-5 w-5 text-gray-500" />;
}

function fmtDT(value?: string | null) {
  return formatUtcDateTimeFull(value);
}

function RedeemDetailView({ row }: { row: RedeemRequest }) {
  const flow = buildPayoutFlow(row);
  const payout = getPayout(row);
  const isCoinflow = isCoinflowRequest(row);
  const payoutProviderName = isCoinflow ? "Coinflow" : "Breeze";
  const payoutRefId =
    (isCoinflow
      ? row.coinflowPayout?.coinflowSessionId
      : row.breezePayout?.breezePageId) ?? null;

  const InfoCell = ({
    label,
    value,
    copy,
  }: {
    label: string;
    value: React.ReactNode;
    /** Raw text for the clipboard, when the cell is worth copying. */
    copy?: string | null;
  }) => (
    <div className="flex flex-col gap-1 rounded-lg border border-[#2A3140] bg-[#1A2030] px-4 py-3">
      <span className="text-[11px] uppercase tracking-wider text-gray-500">{label}</span>
      <span className="flex items-center gap-1.5 text-sm text-white break-all">
        {value}
        {copy ? <CopyButton value={copy} size={12} /> : null}
      </span>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto space-y-4 pr-1">
      <div className="bg-[#191D24] rounded-lg p-4">
        <h2 className="text-white text-sm font-semibold mb-3">User</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <InfoCell label="Name" value={row.userName ?? "—"} />
          <InfoCell label="Username" value={row.userUsername ?? "—"} copy={row.userUsername} />
          <InfoCell
            label="User Id"
            value={<span className="font-mono">{row.userId}</span>}
            copy={row.userId}
          />
          <InfoCell label="Email" value={row.userEmail ?? "—"} copy={row.userEmail} />
          <InfoCell label="Phone" value={row.userPhone ?? "—"} copy={row.userPhone} />
        </div>
      </div>

      <div className="bg-[#191D24] rounded-lg p-4">
        <h2 className="text-white text-sm font-semibold mb-3">Redeem Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <InfoCell label="Reference Id" value={<span className="font-mono">{row.id}</span>} />
          <InfoCell label="Amount (SC)" value={Number(row.amount).toFixed(2)} />
          <InfoCell label="Payment Method" value={row.productName ?? "—"} />
          <InfoCell
            label="Redeem Status"
            value={
              <span className="flex items-center gap-2 flex-wrap">
                {row.status}
                {isAwaitingUserDetails(row) && <AwaitingUserBadge />}
              </span>
            }
          />

          <InfoCell label="Created At" value={fmtDT(row.createdAt)} />
          <InfoCell label="Processed At" value={fmtDT(row.processedAt)} />
        </div>
        {/* {row.notes ? (
          <div className="mt-3 rounded-lg border border-[#2A3140] bg-[#1A2030] px-4 py-3">
            <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Notes</div>
            <div className="text-sm text-gray-200 whitespace-pre-wrap">{row.notes}</div>
          </div>
        ) : null} */}
      </div>

      {payout ? (
        <div className="bg-[#191D24] rounded-lg p-4">
          <h2 className="text-white text-sm font-semibold mb-3">{payoutProviderName} Payout</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <InfoCell label="Payout Id" value={<span className="font-mono">{payout.id}</span>} />
            <InfoCell label={`${payoutProviderName} Ref Id`} value={payoutRefId ?? "—"} />
            <InfoCell label="Status" value={payout.status} />
            <InfoCell label="Pending Status" value={payout.pendingStatus ?? "—"} />
            <InfoCell label="Release Method" value={payout.releaseMethod} />
            <InfoCell label="Payout Method" value={payout.payoutMethod ?? "—"} />
            <InfoCell label="Bank Last4" value={payout.bankAccountLast4 ?? "—"} />
            <InfoCell label="Card Last4" value={payout.cardLast4 ?? "—"} />
            <InfoCell label="Wallet" value={payout.walletAddress ?? "—"} />
            <InfoCell label="Live Mode" value={payout.livemode ? "Yes" : "No"} />
            <InfoCell label="Released At" value={fmtDT(payout.releasedAt)} />
            <InfoCell label="Processed At" value={fmtDT(payout.processedAt)} />
          </div>
        </div>
      ) : null}

      <div className="bg-[#191D24] rounded-lg p-4">
        <h2 className="text-white text-sm font-semibold mb-4">Payout Flow</h2>
        <ol className="relative border-l border-[#2A3140] ml-2 space-y-5">
          {flow.map((step, idx) => (
            <li key={idx} className="ml-5">
              <span className="absolute -left-[11px] flex h-6 w-6 items-center justify-center rounded-full bg-[#191D24] border border-[#2A3140]">
                <FlowStepIcon status={step.status} />
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

function WalletWithdrawalListingsView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    requests,
    total,
    page: currentPage,
    isLoading,
    filters,
    selectedRequestId,
    isModalOpen,
    actionLoadingKey,
    setSearch,
    applyFilters: applyStoreFilters,
    resetFilters: resetStoreFilters,
    setPage: setCurrentPage,
    toggleSort,
    fetchRequests,
    openModal,
    closeModal,
    approveAndPreparePayout,
    rejectRequest,
    createOrResumePayout,
    refreshPayout,
    releasePayout,
  } = useWithdrawalListingStore();

  const [detailRow, setDetailRow] = useState<RedeemRequest | null>(null);

  // Re-checks the payout funding banner whenever the listing reloads, so a
  // successful release clears it without the admin refreshing the page.
  const [fundingRefreshKey, setFundingRefreshKey] = useState(0);
  useEffect(() => {
    setFundingRefreshKey((key) => key + 1);
  }, [requests]);

  // Header search (Email/Phone). The APPLIED term lives in the store because it
  // is part of the server query; this is only what is currently typed.
  const [searchInput, setSearchInput] = useState(filters.search);

  // DRAFT side-panel filters — edited inside the sheet, committed on "Apply
  // Filters" (mirrors the Players filter sheet). Seeded from applied on open.
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftStart, setDraftStart] = useState<Date | undefined>(undefined);
  const [draftEnd, setDraftEnd] = useState<Date | undefined>(undefined);
  const [draftBasis, setDraftBasis] = useState<RedeemDateBasis>("created");
  const [draftStatus, setDraftStatus] = useState<RedeemStatus | "ALL">("ALL");
  const [draftPayment, setDraftPayment] = useState("ALL");
  const [draftPayout, setDraftPayout] = useState("ALL");
  const [draftMin, setDraftMin] = useState("");
  const [draftMax, setDraftMax] = useState("");

  useEffect(() => {
    if (!filterOpen) return;
    setDraftStart(pickerDate(filters.dateFrom));
    setDraftEnd(pickerDate(filters.dateTo));
    setDraftBasis(filters.dateBasis);
    setDraftStatus(filters.status);
    setDraftPayment(filters.paymentMethod);
    setDraftPayout(filters.payoutStatus);
    setDraftMin(filters.amountMin);
    setDraftMax(filters.amountMax);
    // Seed the draft from the applied values each time the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterOpen]);

  // Fixed option lists. They cannot be derived from `requests` any more: that
  // array is one page, so the dropdowns would only ever offer whatever the
  // current ten rows happened to contain.
  const paymentMethodOptions = PAYMENT_METHOD_OPTIONS;
  const payoutStatusOptions = PAYOUT_STATUS_OPTIONS;

  const hasSideFilters =
    filters.status !== "ALL" ||
    !!filters.dateFrom ||
    !!filters.dateTo ||
    filters.dateBasis !== "created" ||
    filters.paymentMethod !== "ALL" ||
    filters.payoutStatus !== "ALL" ||
    filters.amountMin !== "" ||
    filters.amountMax !== "";

  const applyFilters = () => {
    applyStoreFilters({
      status: draftStatus,
      dateFrom: dayStartISO(draftStart),
      dateTo: dayEndISO(draftEnd),
      dateBasis: draftBasis,
      paymentMethod: draftPayment,
      payoutStatus: draftPayout,
      amountMin: draftMin,
      amountMax: draftMax,
    });
    setFilterOpen(false);
  };

  const resetFilters = () => {
    setDraftStart(undefined);
    setDraftEnd(undefined);
    setDraftBasis("created");
    setDraftStatus("ALL");
    setDraftPayment("ALL");
    setDraftPayout("ALL");
    setDraftMin("");
    setDraftMax("");
    resetStoreFilters();
  };

  /**
   * Debounced search: the applied term follows the input instead of waiting for
   * Enter, but each keystroke would otherwise be its own server round-trip.
   *
   * An emptied box resets immediately (no debounce) — there is nothing to wait
   * for, and the delay makes "clear" feel broken.
   */
  useEffect(() => {
    const next = searchInput.trim();
    if (next === filters.search) return;

    if (next === "") {
      setSearch("");
      return;
    }

    const timer = window.setTimeout(() => setSearch(next), 350);
    return () => window.clearTimeout(timer);
  }, [searchInput, filters.search, setSearch]);

  /**
   * Filters handed over in the URL, applied once on arrival.
   *
   * The dashboard's Gross Withdrawals card links here with its own period and
   * `basis=paid`, so "Go to page" lands on the rows behind the number the
   * operator just clicked instead of an unfiltered request log that totals
   * something else. Applied once — a `filters` dependency here would fight the
   * user every time they changed a filter afterwards.
   */
  const urlFiltersApplied = useRef(false);
  useEffect(() => {
    if (urlFiltersApplied.current) return;
    urlFiltersApplied.current = true;

    const basis = searchParams.get("basis");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const method = searchParams.get("method");

    const next: Partial<typeof filters> = {};
    if (basis === "paid" || basis === "created") next.dateBasis = basis;
    /**
     * Whole UTC days, the same boundary the reports count on.
     *
     * The day name is used verbatim — NOT routed through `new Date()` and back.
     * A bare `yyyy-MM-dd` parses as UTC midnight, while `dayStartISO` reads the
     * LOCAL calendar fields off that instant, so west of Greenwich the pair
     * silently walked the date back one day: a card showing 6 Sep handed the
     * listing 5 Sep. A full instant is still accepted (someone hand-editing the
     * URL) and is resolved in UTC, the zone every row is rendered in.
     */
    const day = (value: string | null, edge: "start" | "end") => {
      if (!value) return undefined;
      const suffix = edge === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";
      if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        return `${value.trim()}${suffix}`;
      }
      const parsed = new Date(value);
      if (isNaN(parsed.getTime())) return undefined;
      return `${parsed.toISOString().slice(0, 10)}${suffix}`;
    };
    const fromISO = day(from, "start");
    const toISO = day(to, "end");
    if (fromISO !== undefined) next.dateFrom = fromISO;
    if (toISO !== undefined) next.dateTo = toISO;
    if (method === "Breeze" || method === "Coinflow") next.paymentMethod = method;

    if (Object.keys(next).length) applyStoreFilters(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Admin-configured default payout provider (system config). Seeds the modal's
  // provider picker so manual approvals follow the same setting the auto-flow uses.
  const systemConfig = useSystemConfigStore((s) => s.config);
  const fetchSystemConfig = useSystemConfigStore((s) => s.fetchConfig);
  const defaultProvider: PayoutProvider =
    systemConfig?.withdraw_redeem?.default_payout_provider === "COINFLOW"
      ? "coinflow"
      : "breeze";

  // One effect, one request: filters and page are both part of the server
  // query, so any change to either re-reads exactly one page.
  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests, filters, currentPage]);

  useEffect(() => {
    if (!systemConfig) void fetchSystemConfig();
  }, [systemConfig, fetchSystemConfig]);

  // Filtering, sorting and paging all happen in SQL now — `requests` IS the
  // page, already newest-first.
  const paginatedRows = requests;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const selectedRequest =
    requests.find((request) => request.id === selectedRequestId) ?? null;



  return (
    <div className="h-screen flex flex-col bg-[#15181E] p-3 md:p-6 overflow-hidden">
      <div className="bg-[#191D24] mb-4 px-4 py-3 rounded-lg flex items-center justify-between">
        <h1 className="text-base font-normal text-white">
          Wallet / Withdrawal Listing{detailRow ? " / Details" : ""}
        </h1>
        {detailRow ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDetailRow(null)}
            className="h-9 bg-[#1a2030] text-gray-300 border-gray-700 hover:bg-[#242B35]"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        ) : (
          // Redeem Requests is reached from here rather than the sidebar — the
          // two screens are one flow.
          <Link href="/settings/redeem-requests">
            <Button
              variant="outline"
              className="h-9 border-gray-700 bg-[#242B35] text-white hover:bg-[#2c3441] hover:text-white"
            >
              Redeem Requests
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>


      {detailRow ? (
        <RedeemDetailView row={detailRow} />
      ) : (
        <>
      {/* Only renders when a provider is actually refusing payouts; returns
          null otherwise, so the listing is untouched in the normal case. */}
      <PayoutFundingBanner refreshKey={fundingRefreshKey} />

      <div className="bg-[#191D24] rounded-lg p-2 mb-4 flex items-center gap-3 shrink-0 flex-wrap">
        {/* SEARCH — Email / Phone, matched server-side (debounced above) */}
        <div className="group relative min-w-0 flex-1 sm:min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-gray-500 transition-colors group-focus-within:text-[#B93DEB]" />
          <Input
            placeholder="Search Email / Phone..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-9 w-full pl-9 bg-[#1a2030]/50 border-gray-700/50 text-white text-xs placeholder:text-gray-600 rounded-md focus:ring-purple-500 focus:bg-[#1a2030]"
          />
        </div>

        {/* FILTER SHEET — date range, payment method, amount, payout status.
            Draft/Apply pattern + frame mirror the Players filter sheet. */}
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
              <SheetTitle className="text-lg text-white">Filter Withdrawals</SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* DATE BASIS — which of the row's two dates everything below
                  cuts on. Sits above the range because it changes what the
                  range means, and on "Paid date" it also changes which rows
                  exist at all. */}
              <div className="space-y-2">
                <Label className="text-gray-300">Date Basis</Label>
                <div className="grid grid-cols-2 gap-2">
                  {DATE_BASIS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setDraftBasis(option.value)}
                      className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
                        draftBasis === option.value
                          ? "border-purple-500/60 bg-[#2B3240] text-white"
                          : "border-gray-700 bg-[#242B35] text-gray-400 hover:bg-[#2b323b]"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] leading-snug text-gray-500">
                  {DATE_BASIS_OPTIONS.find((o) => o.value === draftBasis)?.hint}
                </p>
              </div>

              {/* DATE RANGE */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-purple-400" />
                  <Label className="text-gray-300">
                    Date Range · {DATE_BASIS_LABEL[draftBasis]}
                  </Label>
                  {/* Both ends are whole UTC days — the zone the rows print in
                      and the zone every report cuts its days in. Said out loud
                      because the picker itself shows local calendar days. */}
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    UTC
                  </span>
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

              {/* REDEEM STATUS — was a dropdown on the toolbar. It belongs
                  with the other filters, and the toolbar is a search box and a
                  Filters button on every other listing. */}
              <div className="space-y-2">
                <Label className="text-gray-300">Redeem Status</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between border-[#3a4250] bg-[#242B35] text-white hover:bg-[#2b323b] hover:text-white"
                    >
                      <span className="truncate">{STATUS_LABELS[draftStatus]}</span>
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-[var(--radix-dropdown-menu-trigger-width)] border-[#3a4250] bg-[#1a2030] text-white"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <DropdownMenuItem
                        key={status}
                        onClick={() => setDraftStatus(status)}
                        className={draftStatus === status ? "bg-[#2B3240] text-white" : ""}
                      >
                        {STATUS_LABELS[status]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* PAYMENT METHOD */}
              <div className="space-y-2">
                <Label className="text-gray-300">Payment Method</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between bg-[#242B35] border-gray-700 text-white hover:bg-[#2b323b]"
                    >
                      <span className="truncate">
                        {draftPayment === "ALL" ? "All Methods" : draftPayment}
                      </span>
                      <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-(--radix-dropdown-menu-trigger-width) max-h-[280px] overflow-y-auto border-gray-700 bg-[#1a2030] text-white"
                  >
                    <DropdownMenuItem
                      onClick={() => setDraftPayment("ALL")}
                      className={draftPayment === "ALL" ? "bg-[#2B3240] text-white" : ""}
                    >
                      All Methods
                    </DropdownMenuItem>
                    {paymentMethodOptions.map((m) => (
                      <DropdownMenuItem
                        key={m}
                        onClick={() => setDraftPayment(m)}
                        className={draftPayment === m ? "bg-[#2B3240] text-white" : ""}
                      >
                        {m}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* PAYOUT STATUS */}
              <div className="space-y-2">
                <Label className="text-gray-300">Payout Status</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between bg-[#242B35] border-gray-700 text-white hover:bg-[#2b323b]"
                    >
                      <span className="truncate">
                        {draftPayout === "ALL" ? "All Payout Statuses" : draftPayout}
                      </span>
                      <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-(--radix-dropdown-menu-trigger-width) max-h-[280px] overflow-y-auto border-gray-700 bg-[#1a2030] text-white"
                  >
                    <DropdownMenuItem
                      onClick={() => setDraftPayout("ALL")}
                      className={draftPayout === "ALL" ? "bg-[#2B3240] text-white" : ""}
                    >
                      All Payout Statuses
                    </DropdownMenuItem>
                    {payoutStatusOptions.map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onClick={() => setDraftPayout(s)}
                        className={draftPayout === s ? "bg-[#2B3240] text-white" : ""}
                      >
                        {s}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* AMOUNT RANGE */}
              <div className="space-y-2">
                <Label className="text-gray-300">Amount (SC)</Label>
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

        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 bg-[#1a2030] text-gray-400 border-gray-700"
          onClick={() => router.push("/settings/system-configuration")}
          title="Redeem and payout settings"
        >
          <Settings className="h-4 w-4" />
        </Button>

        <ExportCSV
          data={requests}
          fileName="wallet_withdrawal_logs.csv"
          fetchAll={async (range) => {
            // `requests` is one page, so export re-reads the COMPLETE filtered
            // set from the server in chunks. The popover's range overrides the
            // filter sheet's date range when one is picked.
            const base = {
              ...filters,
              dateFrom: range.from ? dayStartISO(range.from) : filters.dateFrom,
              dateTo: range.to ? dayEndISO(range.to) : filters.dateTo,
            };

            const all: RedeemRequest[] = [];
            for (let p = 1; p <= EXPORT_MAX_PAGES; p += 1) {
              const res = await redeemApi.list(
                toListQuery(base, p, EXPORT_CHUNK_SIZE),
              );
              all.push(...res.data.data);
              // A short page is the last page; the total guards against a
              // server that keeps handing back full ones.
              if (res.data.data.length < EXPORT_CHUNK_SIZE) break;
              if (all.length >= res.data.total) break;
            }
            return all;
          }}
          headers={[
            filters.dateBasis === "paid" ? "Paid Date" : "Date",
            "Reference Id",
            "Email/Phone",
            "Payment Method",
            "Amount (SC)",
            "Redeem Status",
            "Payout Status",
          ]}
          mapRow={(row) => [
            formatDateTime(rowDate(row, filters.dateBasis)),
            row.id,
            getUserContact(row),
            getPaymentMethod(row),
            Number(row.amount).toFixed(2),
            row.status,
            getPayoutStatus(row) ?? "—",
          ]}
        />
      </div>

      {/* The paid basis silently hides rows (anything that never released), so
          it says so rather than leaving an operator to wonder where the
          pending and cancelled requests went. */}
      {filters.dateBasis === "paid" && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-4 py-2.5 text-xs text-gray-300 shrink-0">
          <Calendar className="h-3.5 w-3.5 text-purple-400 shrink-0" />
          <span>
            Showing <strong className="text-white">released payouts only</strong>,
            dated when the money left. Totals here match the dashboard&apos;s
            Gross Withdrawals card. Pending, declined and cancelled requests are
            excluded.
          </span>
          <button
            type="button"
            onClick={() => applyStoreFilters({ dateBasis: "created" })}
            className="ml-auto rounded-md border border-gray-700 bg-[#242B35] px-2.5 py-1 text-[11px] text-gray-300 hover:bg-[#2b323b] hover:text-white"
          >
            Switch to request date
          </button>
        </div>
      )}

      <div className="flex-1 overflow-x-auto overflow-y-auto rounded-lg bg-[#15181E] scrollbar-hide">
        <table className="w-full min-w-[1150px] table-auto">
          <thead className="bg-[#242B35]">
            <tr className="border-b border-gray-800">
              <th className="px-4 py-3 text-white text-xs text-left whitespace-nowrap">
                <SortHeader
                  label={filters.dateBasis === "paid" ? "Paid Date" : "Date"}
                  column="date"
                  filters={filters}
                  onToggle={toggleSort}
                />
              </th>
              <th className="px-4 py-3 text-white text-xs text-left whitespace-nowrap">Reference Id</th>
              <th className="px-4 py-3 text-white text-xs text-left whitespace-nowrap">Email/Phone</th>
              <th className="px-4 py-3 text-white text-xs text-left whitespace-nowrap">Payment Method</th>
              <th className="px-4 py-3 text-white text-xs text-left whitespace-nowrap">
                <SortHeader
                  label="Amount (SC)"
                  column="amount"
                  filters={filters}
                  onToggle={toggleSort}
                />
              </th>
              <th className="px-4 py-3 text-white text-xs text-left whitespace-nowrap">
                <SortHeader
                  label="Redeem Status"
                  column="status"
                  filters={filters}
                  onToggle={toggleSort}
                />
              </th>
              <th className="px-4 py-3 text-white text-xs text-left whitespace-nowrap">Payout Status</th>
              <th className="px-4 py-3 text-white text-xs text-center whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeleton />
            ) : paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-gray-500 py-12 text-sm">
                  No records found.
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, index) => (
                <tr
                  key={row.id}
                  className={`${index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"} hover:bg-[#1a2030]`}
                >
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {formatDateTime(rowDate(row, filters.dateBasis))}
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs font-mono whitespace-nowrap">
                    {row.id}
                  </td>
                  <td className="px-4 py-3 text-xs truncate">
                    {/* The contact goes to the player, not to this request —
                        clicking an address is an ask about who that person is.
                        Both views of the request itself live in Action. Plain
                        text when the row carries no userId, so there is never a
                        link that leads nowhere. */}
                    {/* The address is a link, so selecting it by hand navigates
                        — the button is how it gets copied. */}
                    <span className="flex items-center gap-1.5 min-w-0">
                      {row.userId ? (
                        <button
                          onClick={() => router.push(`/users/players-list/${row.userId}`)}
                          title="Open player details"
                          className="cursor-pointer truncate text-blue-400 hover:text-blue-300 underline-offset-2 hover:underline"
                        >
                          {getUserContact(row)}
                        </button>
                      ) : (
                        <span className="truncate text-gray-300">{getUserContact(row)}</span>
                      )}
                      <CopyButton value={getUserContact(row)} size={12} />
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-xs truncate">
                    {getPaymentMethod(row)}
                  </td>
                  <td className="px-4 py-3 text-white text-xs font-semibold">
                    {Number(row.amount).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold">
                    <div className="flex flex-col gap-1">
                      {/* Label map, not the raw enum — that is what makes a
                          user cancellation read as "CANCELLED BY USER" rather
                          than being mistaken for an admin rejection. */}
                      <span
                        className={`w-fit whitespace-nowrap rounded-full px-2 py-1 ${statusPill(row.status)}`}
                      >
                        {STATUS_LABELS[row.status] ?? row.status}
                      </span>
                      {isAwaitingUserDetails(row) ? (
                        <AwaitingUserBadge />
                      ) : (
                        // APPROVED alone cannot distinguish "just requested" from
                        // "user completed the payment flow" — this qualifies it.
                        <ApprovedSubStateBadge row={row} />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap">
                    {getPayoutStatus(row) ? (
                      <span
                        className={`rounded-full px-2 py-1 ${statusPill(getPayoutStatus(row))}`}
                      >
                        {getPayoutStatus(row)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="relative text-center">
                    {/* Two ways into the same request, and they are not
                        interchangeable: the modal is where the request is
                        acted on (approve / create / release), the details page
                        is the read-only record with the full user, redeem and
                        payout breakdown. */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          aria-label="Row actions"
                          className="cursor-pointer text-red-400 transition-colors hover:text-orange-400"
                        >
                          <Wrench size={16} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="z-50 border-gray-700 bg-[#1a2030] p-2 text-white"
                      >
                        <DropdownMenuItem
                          onClick={() => setDetailRow(row)}
                          className="cursor-pointer text-sm hover:bg-[#242B35]"
                        >
                          <Eye className="mr-3 h-4 w-4 text-purple-400" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openModal(row.id)}
                          className="cursor-pointer text-sm hover:bg-[#242B35]"
                        >
                          <FileText className="mr-3 h-4 w-4 text-sky-400" /> View Request
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Outside the scroller: the table is wider than a phone, so a pager
          inside it would slide away with the rows. */}
      {totalPages > 1 && (
        <div className="shrink-0 mt-4 px-1 md:px-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
        </>
      )}

      <WithdrawInformationModal
        open={isModalOpen}
        request={selectedRequest}
        defaultProvider={defaultProvider}
        onClose={closeModal}
        onApprove={(requestId, provider) =>
          void approveAndPreparePayout(requestId, provider)
        }
        onReject={(requestId) => void rejectRequest(requestId)}
        onCreatePayout={(requestId, provider) =>
          void createOrResumePayout(requestId, provider)
        }
        onRefreshPayout={(pageId, provider) => void refreshPayout(pageId, provider)}
        onReleasePayout={(pageId, provider) => void releasePayout(pageId, provider)}
        actionLoadingKey={actionLoadingKey}
      />
    </div>
  );
}

/**
 * `useSearchParams` opts the tree into client-side rendering, and Next requires
 * the boundary to be explicit — without it the whole route falls back to a
 * blank shell during prerender.
 */
export default function WalletWithdrawalListings() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#15181E]" />}>
      <WalletWithdrawalListingsView />
    </Suspense>
  );
}

/** Column header that asks the API to reorder the whole result set. */
function SortHeader({
  label,
  column,
  filters,
  onToggle,
}: {
  label: string;
  column: WithdrawalFilters["sortBy"];
  filters: WithdrawalFilters;
  onToggle: (column: WithdrawalFilters["sortBy"]) => void;
}) {
  const active = filters.sortBy === column;

  return (
    <button
      type="button"
      onClick={() => onToggle(column)}
      className="flex items-center gap-1 hover:text-[#B93DEB] transition-colors"
    >
      {label}
      {!active && <ChevronsUpDown size={12} className="text-gray-400" />}
      {active && filters.sortDir === "desc" && (
        <ChevronDown size={12} className="text-[#B93DEB]" />
      )}
      {active && filters.sortDir === "asc" && (
        <ChevronUp size={12} className="text-[#B93DEB]" />
      )}
    </button>
  );
}
