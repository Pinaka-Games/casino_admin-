"use client";

import { useEffect, useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  paymentTransactionsApi,
  type PaymentTransaction,
  type PaymentTransactionDetail,
} from "@/api/payment-transactions/payment-transactions.api";
import { formatUtcDateTimeFull } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: PaymentTransaction | null;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  PAID: { label: "Successful", cls: "bg-emerald-900/40 text-emerald-400" },
  COMPLETED: { label: "Successful", cls: "bg-emerald-900/40 text-emerald-400" },
  PROCESSED: { label: "Successful", cls: "bg-emerald-900/40 text-emerald-400" },
  PROCESSING: { label: "Processing", cls: "bg-sky-900/40 text-sky-400" },
  PENDING: { label: "Pending", cls: "bg-sky-900/40 text-sky-400" },
  CREATED: { label: "Created", cls: "bg-sky-900/40 text-sky-400" },
  UNPAID: { label: "Unpaid", cls: "bg-gray-700 text-gray-300" },
  EXPIRED: { label: "Expired", cls: "bg-amber-900/40 text-amber-400" },
  CANCELED: { label: "Canceled", cls: "bg-amber-900/40 text-amber-400" },
  FAILED: { label: "Failed", cls: "bg-red-900/40 text-red-400" },
  REFUNDED: { label: "Refunded", cls: "bg-red-900/40 text-red-400" },
};

// UTC, matching the listing and User Deposit logs.
const formatDate = (iso: string) => formatUtcDateTimeFull(iso);

const CopyBtn = ({ value }: { value: string }) => (
  <button
    type="button"
    onClick={() => {
      navigator.clipboard
        .writeText(value)
        .then(() => toast.success("Copied"))
        .catch(() => toast.error("Copy failed"));
    }}
    className="text-gray-500 hover:text-purple-400"
    aria-label="Copy"
  >
    <Copy size={14} />
  </button>
);

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="mt-4">
    <div className="bg-[#242B35] px-4 py-2 rounded-md text-sm font-medium text-white">
      {title}
    </div>
    <div className="px-1 py-3 space-y-3">{children}</div>
  </div>
);

const Field = ({
  label,
  value,
  mono,
  link,
  copyValue,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  link?: boolean;
  copyValue?: string;
}) => (
  <div>
    <div className="text-xs text-gray-400">{label}</div>
    <div className="flex items-center gap-2 mt-0.5">
      <div
        className={`${mono ? "font-mono" : ""} text-sm ${
          link ? "text-purple-400 underline" : "text-gray-200"
        } break-all`}
      >
        {value ?? "—"}
      </div>
      {copyValue ? <CopyBtn value={copyValue} /> : null}
    </div>
  </div>
);

export function TransactionDetailDrawer({ open, onOpenChange, row }: Props) {
  const [detail, setDetail] = useState<PaymentTransactionDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !row) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    paymentTransactionsApi
      .getDetail(row.flow, row.id)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(
            (err as { response?: { data?: { message?: string } } })?.response
              ?.data?.message || "Failed to load detail",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, row]);

  const status = detail?.status ?? row?.status ?? "";
  const statusMeta = STATUS_LABEL[status] ?? {
    label: status,
    cls: "bg-gray-700 text-gray-300",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md bg-[#15181E] border-l border-[#242B35] text-white p-6 overflow-y-auto"
      >
        <SheetHeader className="p-0">
          <SheetTitle className="text-lg font-semibold text-white">
            {row?.flow === "pay-out"
              ? "Payout Quick View"
              : "Payment Page Quick View"}
          </SheetTitle>
        </SheetHeader>

        {loading || !detail ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-2xl font-semibold text-purple-400">
                {detail.currency?.toUpperCase()} {detail.amount.toFixed(2)}
              </span>
              <span
                className={`px-2 py-1 rounded-full text-xs ${statusMeta.cls}`}
              >
                {statusMeta.label}
              </span>
            </div>

            <Section title="Basic Information">
              <Field
                label={detail.flow === "pay-out" ? "Payout ID" : "Page ID"}
                value={
                  <span className="font-mono">
                    {detail.pageId ?? detail.clientReferenceId}
                  </span>
                }
                copyValue={detail.pageId ?? detail.clientReferenceId}
              />
              <Field
                label="Email"
                value={detail.customerEmail}
                link
                copyValue={detail.customerEmail ?? undefined}
              />
              <Field
                label="Client Reference ID"
                value={
                  <span className="font-mono text-xs">
                    {detail.clientReferenceId}
                  </span>
                }
                copyValue={detail.clientReferenceId}
              />
              {detail.flow === "pay-out" && detail.paymentType ? (
                <Field label="Payout Method" value={detail.paymentType} />
              ) : null}
              <Field label="Created At" value={formatDate(detail.createdAt)} />
              {detail.paidAt ? (
                <Field label="Paid At" value={formatDate(detail.paidAt)} />
              ) : null}
              {detail.processedAt ? (
                <Field
                  label="Processed At"
                  value={formatDate(detail.processedAt)}
                />
              ) : null}
              {detail.releasedAt ? (
                <Field
                  label="Released At"
                  value={formatDate(detail.releasedAt)}
                />
              ) : null}
              {detail.pendingStatus ? (
                <Field label="Pending Status" value={detail.pendingStatus} />
              ) : null}
              {detail.flow !== "pay-out" && detail.paymentType ? (
                <Field label="Payment Type" value={detail.paymentType} />
              ) : null}
              {detail.declineReason ? (
                <Field label="Decline Reason" value={detail.declineReason} />
              ) : null}
            </Section>

            {detail.product &&
            (detail.product.name || detail.product.productId) ? (
              <Section title="Product">
                <Field label="Product Name" value={detail.product.name} />
                <Field
                  label="Product ID"
                  value={
                    <span className="font-mono text-xs">
                      {detail.product.productId}
                    </span>
                  }
                  copyValue={detail.product.productId ?? undefined}
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-400">Price</div>
                    <div className="text-sm text-gray-200">
                      {detail.product.price !== null
                        ? `${detail.currency?.toUpperCase()} ${detail.product.price.toFixed(2)}`
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Quantity</div>
                    <div className="text-sm text-purple-400">
                      {detail.product.quantity}
                    </div>
                  </div>
                </div>
              </Section>
            ) : null}

            {detail.flow === "pay-out" ? (
              <Section title="Payout Receipt">
                {detail.receipt?.receiverNetAmount !== null &&
                detail.receipt?.receiverNetAmount !== undefined ? (
                  <Field
                    label="Receiver Net Amount"
                    value={`${detail.receipt.receiverNetAmount.toFixed(2)} ${detail.currency?.toUpperCase()}`}
                  />
                ) : null}
                {detail.receipt?.processingFee !== null &&
                detail.receipt?.processingFee !== undefined ? (
                  <Field
                    label="Processing Fee"
                    value={`${detail.receipt.processingFee.toFixed(2)} ${detail.currency?.toUpperCase()}`}
                  />
                ) : null}
                {detail.receipt?.totalFee !== null &&
                detail.receipt?.totalFee !== undefined ? (
                  <Field
                    label="Total Fee"
                    value={`${detail.receipt.totalFee.toFixed(2)} ${detail.currency?.toUpperCase()}`}
                  />
                ) : null}
                {detail.walletAddress ? (
                  <Field
                    label="Crypto Wallet Address"
                    value={
                      <span className="font-mono text-xs">
                        {detail.walletAddress}
                      </span>
                    }
                    copyValue={detail.walletAddress}
                  />
                ) : null}
                {detail.receipt?.destinationNetwork ? (
                  <Field
                    label="Destination Network"
                    value={detail.receipt.destinationNetwork.toUpperCase()}
                  />
                ) : null}
                {detail.receipt?.destinationToken ? (
                  <Field
                    label="Destination Token"
                    value={detail.receipt.destinationToken.toUpperCase()}
                  />
                ) : null}
                {detail.receipt?.transactionHash ? (
                  <Field
                    label="Transaction Hash"
                    value={
                      <span className="font-mono text-xs">
                        {detail.receipt.transactionHash}
                      </span>
                    }
                    copyValue={detail.receipt.transactionHash}
                  />
                ) : null}
                {detail.cardLast4 ? (
                  <Field label="Card last 4" value={detail.cardLast4} />
                ) : null}
                {detail.bankAccountLast4 ? (
                  <Field
                    label="Bank Account last 4"
                    value={detail.bankAccountLast4}
                  />
                ) : null}
              </Section>
            ) : null}

          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
