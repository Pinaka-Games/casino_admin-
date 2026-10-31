"use client";

import { X, Loader2, Package, CreditCard, Coins } from "lucide-react";
import { usePaymentAvailability } from "@/hooks/use-payment-availability";

export type PaymentProvider = "BREEZE" | "COINFLOW";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (provider: PaymentProvider) => void;
  planName: string;
  price: string | number;
  actionLabel?: string; // "Upgrade" | "Buy"
  processing?: boolean;
  // Which provider is currently processing — only that button shows a spinner.
  processingProvider?: PaymentProvider | null;
}

/**
 * Payment-method selection for buying/upgrading an agent package.
 * Mirrors the payout RequestPayoutModal PROVIDER step.
 *
 * Only gateways the admin enabled for AGENT pay-in (Settings → Payment Manager)
 * are offered. The checkout is refused server-side as well, so this is
 * presentation rather than the gate itself.
 */
export function PackagePaymentModal({
  isOpen,
  onClose,
  onSelect,
  planName,
  price,
  actionLabel = "Upgrade",
  processing = false,
  processingProvider = null,
}: Props) {
  const payinAvailability = usePaymentAvailability("agent", "payin");

  if (!isOpen) return null;

  // Fallback: if the parent only signals `processing` without naming the
  // provider, don't spin both — this stays null and no button spins.
  const isBreezeLoading = processingProvider === "BREEZE";
  const isCoinflowLoading = processingProvider === "COINFLOW";

  const priceNum = Number(price);
  const priceLabel = Number.isNaN(priceNum) ? String(price) : priceNum.toLocaleString();

  return (
    <div className="fixed inset-0 z-[1000] flex items-start sm:items-center justify-center p-3 sm:p-4 overflow-y-auto bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-[#11141D] w-full max-w-md rounded-lg border border-white/5 shadow-2xl overflow-hidden relative animate-in zoom-in-90 duration-300 max-h-[92dvh] overflow-y-auto">
        <button
          onClick={onClose}
          disabled={processing}
          className="absolute top-4 right-4 z-20 p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-40"
        >
          <X size={18} />
        </button>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#B93DEB]/15 border border-[#B93DEB]/30 flex items-center justify-center">
              <Package size={18} className="text-[#B93DEB]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight">
                Choose a payment method
              </h3>
              <p className="text-[11px] text-gray-500">
                {actionLabel} to <span className="text-[#B93DEB] font-bold">{planName}</span> · {priceLabel} / month
              </p>
            </div>
          </div>

          {payinAvailability.breeze && (
          <button
            onClick={() => onSelect("BREEZE")}
            disabled={processing}
            className="w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-[#B93DEB]/10 hover:border-[#B93DEB]/40 transition-all text-left disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#B93DEB]/20 border border-[#B93DEB]/30 flex items-center justify-center">
                <CreditCard size={18} className="text-[#B93DEB]" />
              </div>
              <div>
                <p className="text-sm font-black text-white">Breeze</p>
                <p className="text-[11px] text-gray-500">
                  Card, Apple Pay, Google Pay, or crypto
                </p>
              </div>
            </div>
            {isBreezeLoading ? (
              <Loader2 size={16} className="animate-spin text-[#B93DEB]" />
            ) : (
              <span className="text-[#B93DEB] text-sm font-bold">Continue</span>
            )}
          </button>
          )}

          {payinAvailability.coinflow && (
          <button
            onClick={() => onSelect("COINFLOW")}
            disabled={processing}
            className="w-full flex items-center justify-between gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-yellow-500/10 hover:border-yellow-500/40 transition-all text-left disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center">
                <Coins size={18} className="text-yellow-400" />
              </div>
              <div>
                <p className="text-sm font-black text-white">Coinflow</p>
                <p className="text-[11px] text-gray-500">
                  Pay with on-chain wallets and stablecoins
                </p>
              </div>
            </div>
            {isCoinflowLoading ? (
              <Loader2 size={16} className="animate-spin text-yellow-400" />
            ) : (
              <span className="text-yellow-400 text-sm font-bold">Continue</span>
            )}
          </button>
          )}

          {!payinAvailability.breeze && !payinAvailability.coinflow && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
              Payments are temporarily unavailable. Please check back shortly.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
