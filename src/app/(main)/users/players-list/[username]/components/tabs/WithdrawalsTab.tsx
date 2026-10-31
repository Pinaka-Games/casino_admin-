"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  SortableTh,
  useSortedRows,
  useTableSort,
} from "@/components/filters/tableSort";
import { ArrowLeft, CheckCircle2, Clock, Eye, Send, XCircle } from "lucide-react";
import { redeemApi, RedeemRequest, RedeemStatus } from "@/api/redeem/redeem.api";
import Pagination from "@/components/Pagination";
import NoData from "@/components/NoData";
import { Button } from "@/components/ui/button";

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

const statusColor = (status: RedeemStatus) => {
  switch (status) {
    case "PENDING":
      return "text-orange-400";
    case "APPROVED":
      return "text-green-500";
    case "REJECTED":
      return "text-red-500";
    case "PROCESSED":
      return "text-blue-400";
    default:
      return "text-gray-400";
  }
};

// Mirrors the Wallet / Withdrawal Listing labels. CANCELLED is spelled out as
// "CANCELLED BY USER" because every other status is an admin action, so an
// unqualified "CANCELLED" reads as one.
const STATUS_LABELS: Record<RedeemStatus, string> = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "DECLINED",
  PROCESSED: "PROCESSED",
  CANCELLED: "CANCELLED BY USER",
};

// `paymentMethod` is stamped on the request when the provider is picked, so it is
// the authority. A request can carry BOTH providers' payout records, and the old
// `breezePayout ?? coinflowPayout` then showed a stale Breeze page for a Coinflow
// request — its status, method and flow all came from the wrong provider.
const isCoinflowRequest = (row: RedeemRequest): boolean =>
  row.paymentMethod === "COINFLOW_PAYOUT" ||
  (!!row.coinflowPayout && !row.breezePayout);

const getPayout = (row: RedeemRequest) =>
  (isCoinflowRequest(row) ? row.coinflowPayout : row.breezePayout) ?? null;

const getPayoutStatus = (row: RedeemRequest): string | null =>
  getPayout(row)?.status ?? null;

const payoutStatusColor = (status?: string | null) => {
  switch (status) {
    case "PENDING":
    case "CREATED":
      return "text-orange-400";
    case "COMPLETED":
    case "PROCESSED":
      return "text-green-500";
    case "PROCESSING":
      return "text-sky-400";
    case "FAILED":
    case "CANCELED":
    case "REFUNDED":
      return "text-red-500";
    // Terminal and unpaid, but not an error — the page simply timed out.
    case "EXPIRED":
      return "text-gray-400";
    default:
      return "text-gray-500";
  }
};

// A payout page in one of these states is dead: nothing was paid and nothing can
// be released, so it must not read as awaiting anyone's action.
const DEAD_PAYOUT_STATUSES = new Set([
  "EXPIRED",
  "FAILED",
  "CANCELED",
  "REFUNDED",
]);

/**
 * True when a payout page exists but the user has not finished entering their
 * payout details — admin should not act on these yet.
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

const getPaymentMethod = (row: RedeemRequest) => row.productName ?? "—";

type FlowStepStatus = "done" | "active" | "failed" | "pending";

interface FlowStep {
  title: string;
  description: string;
  timestamp?: string | null;
  status: FlowStepStatus;
}

function buildPayoutFlow(row: RedeemRequest): FlowStep[] {
  const payout = getPayout(row);
  const providerName = isCoinflowRequest(row) ? "Coinflow" : "Breeze";
  const isRejected = row.status === "REJECTED";
  const isProcessed = row.status === "PROCESSED";
  const isApproved = row.status === "APPROVED" || isProcessed;
  // Breeze reports PROCESSED for a payout merely in transit - including one on
  // its way to REFUNDED - so the request status and the payout status can
  // legitimately disagree. Track the payout's own death separately.
  const payoutFailed =
    !!payout &&
    ["FAILED", "CANCELED", "REFUNDED", "EXPIRED", "REJECTED"].includes(
      String(payout.status),
    );
  const refundedToWallet = /\[Payout Failed\]/.test(row.notes ?? "");
  const steps: FlowStep[] = [];

  steps.push({
    title: "Redeem Requested",
    description: `User submitted redeem request for ${Number(row.amount).toFixed(2)} SC. Status PENDING; funds held in pending bucket.`,
    timestamp: row.createdAt,
    status: "done",
  });

  // A gateway refund also lands on REJECTED, but nobody rejected it - let those
  // fall through to the full payout timeline below.
  if (isRejected && !payoutFailed) {
    steps.push({
      title: "Admin Rejected",
      description: row.notes || "Admin rejected the redeem request. Pending funds returned to user balance.",
      timestamp: row.processedAt,
      status: "failed",
    });
    return steps;
  }

  steps.push({
    title: "Admin Approved",
    description: `Admin approved request. Backend prepares ${providerName} payout page.`,
    timestamp: isApproved ? row.processedAt || row.updatedAt : null,
    status: isApproved ? "done" : "active",
  });

  steps.push({
    title: `${providerName} Payout Created`,
    description: payout
      ? `${providerName} payout page generated (id: ${payout.id}). Release method: ${payout.releaseMethod}.`
      : `Awaiting ${providerName} payout page creation.`,
    timestamp: payout?.createdAt ?? null,
    status: payout ? "done" : isApproved ? "active" : "pending",
  });

  if (payout) {
    const releaseDone = Boolean(payout.releasedAt) || isProcessed;
    steps.push({
      title: payout.releaseMethod === "MANUAL" ? "Manual Merchant Release" : "Auto Release",
      description:
        payout.releaseMethod === "MANUAL"
          ? "Admin must release payout. Pending status: PENDING_MERCHANT_RELEASE."
          : `${providerName} auto-releases payout once customer confirms.`,
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
        : `${providerName} processed payout. Funds delivered via ${payout.payoutMethod || providerName}.`,
      timestamp: payout.processedAt,
      status: payoutFailed ? "failed" : isProcessed ? "done" : payout.releasedAt ? "active" : "pending",
    });
  }

  // Never show "Redeem Settled" under a dead payout - that green tick was the
  // timeline contradicting itself and masking a player who is still debited.
  if (payoutFailed) {
    steps.push({
      title: refundedToWallet ? "Refunded to Wallet" : "Refund Outstanding",
      description: refundedToWallet
        ? "The payout did not complete, so the amount was returned to the player's wallet and the request was closed."
        : "The payout did not complete and the amount was NOT returned automatically. The player is still debited - refund manually.",
      timestamp: row.processedAt ?? row.updatedAt,
      status: refundedToWallet ? "done" : "failed",
    });
  } else if (isProcessed) {
    steps.push({
      title: "Redeem Settled",
      description: "Redeem request marked PROCESSED. Pending balance deducted; transaction logged.",
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
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
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

  const InfoCell = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex flex-col gap-1 rounded-lg border border-[#2A3140] bg-[#1A2030] px-4 py-3">
      <span className="text-[11px] uppercase tracking-wider text-gray-500">{label}</span>
      <span className="text-sm text-white break-all">{value}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-[#191D24] rounded-lg p-4">
        <h2 className="text-white text-sm font-semibold mb-3">User</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <InfoCell label="Name" value={row.userName ?? "—"} />
          <InfoCell label="Username" value={row.userUsername ?? "—"} />
          <InfoCell label="User Id" value={<span className="font-mono">{row.userId}</span>} />
          <InfoCell label="Email" value={row.userEmail ?? "—"} />
          <InfoCell label="Phone" value={row.userPhone ?? "—"} />
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
                {STATUS_LABELS[row.status] ?? row.status}
                {isAwaitingUserDetails(row) && <AwaitingUserBadge />}
              </span>
            }
          />
          <InfoCell label="Payout Status" value={getPayoutStatus(row) ?? "—"} />
          <InfoCell label="Created At" value={fmtDT(row.createdAt)} />
          <InfoCell label="Processed At" value={fmtDT(row.processedAt)} />
        </div>
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

import FilterToolbar from "@/components/filters/FilterToolbar";
import EntityFilterSheet from "@/components/filters/EntityFilterSheet";
import { useEntityFilters } from "@/components/filters/useEntityFilters";
import {
  WITHDRAWAL_DEFAULTS,
  WITHDRAWAL_FIELDS,
  filterWithdrawalRows,
} from "./withdrawalFilters";

const WithdrawalsTab = ({ username }: { username: string }) => {
  const [rows, setRows] = useState<RedeemRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [detailRow, setDetailRow] = useState<RedeemRequest | null>(null);

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
    fields: WITHDRAWAL_FIELDS,
    defaults: WITHDRAWAL_DEFAULTS,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await redeemApi.getRequestsByUserId(username);
        if (!cancelled) setRows(res.data ?? []);
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

  const filteredRows = useMemo(
    () => filterWithdrawalRows(rows, filters),
    [rows, filters]
  );

  // Every request is already loaded, so a column sort covers the whole history
  // rather than reordering the page on screen.
  const { sort, toggle } = useTableSort<"date" | "amount" | "status">();
  const visibleRows = useSortedRows(filteredRows, sort, {
    date: (row) => new Date(row.createdAt).getTime(),
    amount: (row) => Number(row.amount) || 0,
    status: (row) => row.status,
  });

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const paginated = visibleRows.slice(start, start + PAGE_SIZE);

  // A narrowed filter can leave fewer pages than the one being viewed.
  useEffect(() => {
    setPage(1);
  }, [filters]);

  if (detailRow) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white text-sm font-semibold">Withdrawal Details</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDetailRow(null)}
            className="h-9 bg-[#1a2030] text-gray-300 border-gray-700 hover:bg-[#242B35]"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        </div>
        <RedeemDetailView row={detailRow} />
      </div>
    );
  }

  if (!loading && !rows.length) {
    return <NoData />;
  }

  return (
    <div className="space-y-4">
      <FilterToolbar
        title="Withdrawals"
        countLabel={
          loading
            ? undefined
            : `${visibleRows.length} ${visibleRows.length === 1 ? "request" : "requests"}`
        }
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search reference id, method or note"
        activeCount={activeCount}
        chips={chips}
        hasAnyFilter={hasAnyFilter}
        onOpenFilters={() => setSheetOpen(true)}
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
              <th className="px-4 py-3 text-white text-xs text-left whitespace-nowrap">Reference Id</th>
              <th className="px-4 py-3 text-white text-xs text-left whitespace-nowrap">Payment Method</th>
              <SortableTh
                label="Amount (SC)"
                sortKey="amount"
                sort={sort}
                onToggle={toggle}
                className="px-4 py-3 text-white text-xs text-left whitespace-nowrap"
              />
              <SortableTh
                label="Redeem Status"
                sortKey="status"
                sort={sort}
                onToggle={toggle}
                className="px-4 py-3 text-white text-xs text-left whitespace-nowrap"
              />
              <th className="px-4 py-3 text-white text-xs text-left whitespace-nowrap">Payout Status</th>
              <th className="px-4 py-3 text-white text-xs text-center whitespace-nowrap w-20">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={7} />
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12">
                  <NoData title="No withdrawals match these filters" />
                </td>
              </tr>
            ) : (
              paginated.map((row, index) => (
              <tr
                key={row.id}
                onClick={() => setDetailRow(row)}
                className={`${index % 2 === 0 ? "bg-[#191D24]" : "bg-[#161A21]"} hover:bg-[#1a2030] cursor-pointer`}
              >
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                  {formatDateTime(row.createdAt)}
                </td>
                <td className="px-4 py-3 text-gray-300 text-xs font-mono whitespace-nowrap">
                  {row.id}
                </td>
                <td className="px-4 py-3 text-gray-300 text-xs">
                  {getPaymentMethod(row)}
                </td>
                <td className="px-4 py-3 text-white text-xs font-semibold">
                  {Number(row.amount).toFixed(2)}
                </td>
                <td className={`px-4 py-3 text-xs font-semibold ${statusColor(row.status)}`}>
                  <div className="flex flex-col gap-1">
                    {/* Label map, not the raw enum — that is what makes a user
                        cancellation read as "CANCELLED BY USER" rather than
                        being mistaken for an admin rejection. */}
                    <span>{STATUS_LABELS[row.status] ?? row.status}</span>
                    {isAwaitingUserDetails(row) && <AwaitingUserBadge />}
                  </div>
                </td>
                <td
                  className={`px-4 py-3 text-xs font-semibold whitespace-nowrap ${payoutStatusColor(getPayoutStatus(row))}`}
                >
                  {getPayoutStatus(row) ?? "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailRow(row);
                    }}
                    className="p-1.5 bg-[#1a2030] rounded-md text-purple-400 hover:text-white hover:bg-purple-600 transition shadow-sm"
                    aria-label="View details"
                  >
                    <Eye size={14} />
                  </button>
                </td>
              </tr>
              ))
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
        title="Withdrawal Filters"
        description="Filter this player's redeem requests"
        fields={WITHDRAWAL_FIELDS}
        values={filters}
        defaults={WITHDRAWAL_DEFAULTS}
        onApply={setFilters}
      />
    </div>
  );
};

export default WithdrawalsTab;
