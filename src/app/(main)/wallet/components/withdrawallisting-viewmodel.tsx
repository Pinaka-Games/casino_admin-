"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink, RefreshCw, Send, ShieldCheck, X, Copy } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import type { RedeemRequest } from "@/api/redeem/redeem.api";
import type { PayoutProvider } from "@/store/withdrawal-listing-store";

interface Props {
  open: boolean;
  onClose: () => void;
  request: RedeemRequest | null;
  // Admin-configured default provider (system config). Seeds the picker.
  defaultProvider?: PayoutProvider;
  onApprove?: (requestId: string, provider: PayoutProvider) => void | Promise<void>;
  onReject?: (requestId: string) => void | Promise<void>;
  onCreatePayout?: (requestId: string, provider: PayoutProvider) => void | Promise<void>;
  onRefreshPayout?: (pageId: string, provider: PayoutProvider) => void | Promise<void>;
  onReleasePayout?: (pageId: string, provider: PayoutProvider) => void | Promise<void>;
  actionLoadingKey?: string | null;
  readOnly?: boolean;
}

function fmtDate(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString();
}

function statusColor(status?: string | null) {
  switch (status) {
    case "PENDING":
      return "text-orange-400";
    case "APPROVED":
    case "PROCESSED":
    case "COMPLETED":
      return "text-green-400";
    case "FAILED":
    case "REJECTED":
    case "CANCELED":
    case "REFUNDED":
      return "text-red-400";
    case "PROCESSING":
      return "text-sky-400";
    default:
      return "text-gray-300";
  }
}

const providerLabel = (provider: PayoutProvider) =>
  provider === "coinflow" ? "Coinflow" : "Breeze";

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    // `min-w-0` on the value cell is what stops this row from forcing the panel
    // wider than its column: a hosted-checkout URL or a Coinflow reference is
    // one unbroken token, and a grid track defaults to `min-content`, so
    // without it the whole modal grew a horizontal scrollbar of its own.
    <div className="grid grid-cols-[minmax(120px,180px)_1fr] gap-4 border-b border-white/5 py-3 last:border-b-0">
      <span className="text-sm text-gray-400">{label}</span>
      <div className="min-w-0 text-sm text-white break-words [overflow-wrap:anywhere]">
        {value}
      </div>
    </div>
  );
}

export interface WithdrawInformation {
  referenceId: string;
}

export default function WithdrawInformationModal({
  open,
  onClose,
  request,
  defaultProvider = "breeze",
  onApprove,
  onReject,
  onCreatePayout,
  onRefreshPayout,
  onReleasePayout,
  actionLoadingKey,
  readOnly = false,
}: Props) {
  const [selectedProvider, setSelectedProvider] =
    useState<PayoutProvider>(defaultProvider);

  // Re-seed the picker from the configured default when the modal opens for a new
  // request (only matters before a payout exists; an existing payout fixes it).
  useEffect(() => {
    setSelectedProvider(defaultProvider);
  }, [defaultProvider, request?.id]);

  if (!open || !request) return null;

  const breezePayout = request.breezePayout ?? null;
  const coinflowPayout = request.coinflowPayout ?? null;
  // The gateway the USER picked at claim time binds us — the payout has to go out
  // the way they asked for it — so it is consulted FIRST. It used to come second,
  // behind "whichever payout record exists", with Breeze winning a tie; a request
  // carrying BOTH records therefore resolved to Breeze even when the user had
  // chosen Coinflow and completed the Coinflow flow.
  const requestedProvider: PayoutProvider | null =
    request.paymentMethod === "COINFLOW_PAYOUT"
      ? "coinflow"
      : request.paymentMethod === "BREEZE_PAYOUT"
        ? "breeze"
        : null;
  // Falling back to an existing payout page still fixes the provider when the
  // request carries no method (legacy rows).
  const existingProvider: PayoutProvider | null = breezePayout
    ? "breeze"
    : coinflowPayout
      ? "coinflow"
      : null;
  const activeProvider: PayoutProvider =
    requestedProvider ?? existingProvider ?? selectedProvider;
  // Read the payout of the ACTIVE provider. Mixing these up meant refresh/release
  // were keyed to one provider's page id while the action dispatched to the other.
  const payout = activeProvider === "coinflow" ? coinflowPayout : breezePayout;
  const payoutRefId =
    (activeProvider === "coinflow"
      ? coinflowPayout?.coinflowSessionId
      : breezePayout?.breezePageId) ?? null;

  const awaitingUserDetails =
    Boolean(payout) &&
    (request.status === "PENDING" || request.status === "APPROVED") &&
    (payout?.pendingStatus ?? "").toUpperCase().startsWith("PENDING_USER") &&
    !payout?.customerConfirmedAtMs &&
    !payout?.payoutMethod;
  const approveKey = `approve:${request.id}`;
  const rejectKey = `reject:${request.id}`;
  const createKey = `create:${request.id}`;
  const refreshKey = payout ? `refresh:${payout.id}` : null;
  const releaseKey = payout ? `release:${payout.id}` : null;

  // PENDING means the request needs a decision: it is born that way whenever the
  // payout will not auto-release (auto-release threshold at 0, or the amount is
  // above it), and approving is what builds the payout page and lets the player
  // enter their bank details. Requests within the threshold skip this entirely —
  // they are born APPROVED with their page already created.
  const isAwaitingApproval = request.status === "PENDING";
  const canApprove = !readOnly && isAwaitingApproval;
  // A request can be declined (and refunded) right up until the money leaves.
  const canReject =
    !readOnly && !payout?.releasedAt && (isAwaitingApproval || request.status === "APPROVED");
  // Recovery only: the payout page is normally created with the request, or on
  // approval for one that needed it, so this is for the case where the provider
  // was down at that moment.
  const canCreatePayout = !readOnly && request.status === "APPROVED" && !payout;
  const canRefreshPayout = !readOnly && Boolean(payout?.id);
  // The one remaining admin money gate: payouts above the auto-release threshold
  // are stamped MANUAL and park here until someone releases them.
  const canReleasePayout =
    !readOnly &&
    Boolean(payout?.id) &&
    request.status === "APPROVED" &&
    payout?.releaseMethod === "MANUAL" &&
    payout?.status === "PENDING" &&
    payout?.pendingStatus === "PENDING_MERCHANT_RELEASE";

  // Only offer a choice when nothing has already fixed one — never let the admin
  // override the gateway the user requested.
  const showProviderPicker =
    !readOnly &&
    !existingProvider &&
    !requestedProvider &&
    (canApprove || canCreatePayout);

  return (
    // One scroll container, not two. The overlay used to scroll as well as the
    // body below it, so a long payout panel gave two nested vertical bars that
    // fought each other — the outer one is now fixed and only the body inside
    // scrolls.
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/60 p-4 sm:p-6">
        <div className="relative flex max-h-[calc(100vh-3rem)] w-full max-w-7xl flex-col rounded-2xl bg-[#15181E] p-6 shadow-2xl">
          <div className="mb-6 flex shrink-0 items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-white">Withdrawal Request</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 transition hover:text-white"
          >
            <X />
          </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-xl border border-white/10 bg-[#191D24] p-5">
                <h3 className="mb-4 text-base font-semibold text-white">
                  Request Details
                </h3>
                <div>
                  <InfoRow
                    label="Reference Id"
                    value={<span className="font-mono text-xs">{request.id}</span>}
                  />
                  <InfoRow
                    label="User Id"
                    value={
                      <span className="font-mono text-xs">{request.userId}</span>
                    }
                  />
                  <InfoRow
                    label="Amount"
                    value={`${Number(request.amount).toFixed(2)} Wulf Cash`}
                  />
                  <InfoRow
                    label="Redeem Status"
                    value={
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={statusColor(request.status)}>
                          {request.status}
                        </span>
                        {awaitingUserDetails && (
                          <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-300 whitespace-nowrap">
                            Awaiting user details
                          </span>
                        )}
                      </span>
                    }
                  />
                  <InfoRow
                    label="Payment Method"
                    value={request.paymentMethod ?? "—"}
                  />
                  <InfoRow
                    label="Processed At"
                    value={fmtDate(request.processedAt)}
                  />
                  <InfoRow label="Created At" value={fmtDate(request.createdAt)} />
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#191D24] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white">
                    {providerLabel(activeProvider)} Payout
                  </h3>
                  {payout?.url ? (
                    <a
                      href={payout.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-sky-400 hover:text-sky-300"
                    >
                      Open hosted page
                      <ExternalLink size={14} />
                    </a>
                  ) : null}
                </div>

                <div>
                  <InfoRow
                    label="Payout Status"
                    value={
                      payout ? (
                        <span className={statusColor(payout.status)}>
                          {payout.pendingStatus
                            ? `${payout.status} / ${payout.pendingStatus}`
                            : payout.status}
                        </span>
                      ) : (
                        "Not created yet"
                      )
                    }
                  />
                  <InfoRow
                    label="Release Method"
                    value={payout?.releaseMethod ?? "—"}
                  />
                  <InfoRow
                    label={`${providerLabel(activeProvider)} Ref Id`}
                    value={payoutRefId ?? "—"}
                  />
                  <InfoRow
                    label="Hosted URL"
                    value={
                      payout?.url ? (
                        <div className="flex items-start gap-2">
                          <span className="break-all text-xs flex-1">{payout.url}</span>
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard.writeText(payout.url!);
                              toast.success("URL copied");
                            }}
                            className="shrink-0 inline-flex items-center justify-center rounded-md border border-white/10 bg-[#242B35] p-1.5 text-gray-300 hover:bg-[#2b323b] hover:text-white"
                            aria-label="Copy hosted URL"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <InfoRow
                    label="Payout Method"
                    value={payout?.payoutMethod ?? "—"}
                  />
                  <InfoRow
                    label="Bank Last4"
                    value={payout?.bankAccountLast4 ?? "—"}
                  />
                  <InfoRow
                    label="Card Last4"
                    value={payout?.cardLast4 ?? "—"}
                  />
                  <InfoRow
                    label="Wallet Address"
                    value={payout?.walletAddress ?? "—"}
                  />
                  <InfoRow
                    label="Customer Confirmed"
                    value={fmtDate(payout?.customerConfirmedAtMs)}
                  />
                  <InfoRow
                    label="Released At"
                    value={fmtDate(payout?.releasedAt)}
                  />
                </div>
              </div>
            </div>
          </div>

          {!readOnly && awaitingUserDetails ? (
            <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-xs text-amber-200">
              User has not completed their {providerLabel(activeProvider)} payout
              details yet. Nothing to do here until they submit a payout method.
            </div>
          ) : null}

          {!readOnly && !awaitingUserDetails && canReleasePayout ? (
            <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-2.5 text-xs text-emerald-200">
              This payout is above the auto-release threshold, so it needs a manual
              release. Payouts within the threshold release themselves and never
              appear here.
            </div>
          ) : null}

          {!readOnly ? (
            <div className="mt-6 flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-white/10 pt-6">
            {!showProviderPicker && (canCreatePayout || canReleasePayout) ? (
              <div className="mr-auto flex items-center gap-2">
                <span className="text-xs text-gray-400">Payment method</span>
                <span className="rounded-md border border-white/10 bg-[#242B35] px-3 py-1.5 text-xs font-medium text-gray-200">
                  {providerLabel(activeProvider)}
                </span>
                <span className="text-xs text-gray-500">
                  {existingProvider ? "locked by payout page" : "chosen by user"}
                </span>
              </div>
            ) : null}

            {showProviderPicker ? (
              <div className="mr-auto flex items-center gap-2">
                <span className="text-xs text-gray-400">Payment method</span>
                <div className="inline-flex overflow-hidden rounded-md border border-white/10">
                  {(["breeze", "coinflow"] as PayoutProvider[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSelectedProvider(p)}
                      className={`px-3 py-1.5 text-xs font-medium transition ${
                        selectedProvider === p
                          ? "bg-[#B93DEB] text-white"
                          : "bg-[#242B35] text-gray-300 hover:bg-[#2b323b]"
                      }`}
                    >
                      {providerLabel(p)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {canReject ? (
              <Button
                variant="outline"
                className="border-red-500/50 text-red-300 hover:bg-red-500/10"
                disabled={actionLoadingKey === rejectKey}
                onClick={() => onReject?.(request.id)}
              >
                Reject
              </Button>
            ) : null}

            {canApprove ? (
              <Button
                className="bg-[#B93DEB] text-white hover:bg-[#a330d4]"
                disabled={actionLoadingKey === approveKey}
                onClick={() => onApprove?.(request.id, activeProvider)}
              >
                <ShieldCheck size={16} className="mr-2" />
                {actionLoadingKey === approveKey
                  ? "Approving..."
                  : "Approve (legacy request)"}
              </Button>
            ) : null}

            {canCreatePayout ? (
              <Button
                variant="outline"
                className="border-sky-500/40 text-sky-300 hover:bg-sky-500/10"
                disabled={actionLoadingKey === createKey}
                onClick={() => onCreatePayout?.(request.id, activeProvider)}
              >
                <Send size={16} className="mr-2" />
                {actionLoadingKey === createKey
                  ? "Preparing..."
                  : payout
                    ? "Resume Payout Page"
                    : "Create Payout Page"}
              </Button>
            ) : null}

            {canRefreshPayout && refreshKey ? (
              <Button
                variant="outline"
                className="border-gray-600 text-gray-200 hover:bg-white/5"
                disabled={actionLoadingKey === refreshKey}
                onClick={() => payout?.id && onRefreshPayout?.(payout.id, activeProvider)}
              >
                <RefreshCw size={16} className="mr-2" />
                {actionLoadingKey === refreshKey ? "Refreshing..." : "Refresh"}
              </Button>
            ) : null}

            {canReleasePayout && releaseKey ? (
              <Button
                className="bg-emerald-500 text-white hover:bg-emerald-600"
                disabled={actionLoadingKey === releaseKey}
                onClick={() => payout?.id && onReleasePayout?.(payout.id, activeProvider)}
              >
                <Send size={16} className="mr-2" />
                {actionLoadingKey === releaseKey
                  ? "Releasing..."
                  : "Release Payout"}
              </Button>
            ) : null}
            </div>
          ) : null}
        </div>
    </div>
  );
}
