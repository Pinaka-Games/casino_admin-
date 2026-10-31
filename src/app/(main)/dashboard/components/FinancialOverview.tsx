"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { financedoller } from "@/assets/icons";
import { utcDayEndISO, utcDayStartISO } from "@/lib/utils";
import { useDashboardStore } from "@/store/dashboard-store";
import { paymentTransactionsApi } from "@/api/payment-transactions/payment-transactions.api";

interface ProviderRow {
  provider: "breeze" | "coinflow";
  currency: string;
  payInTotal: number;
  payOutTotal: number;
  payInCount: number;
  payOutCount: number;
  // Requested but unsettled redeems. Pay-outs only counts money that has
  // actually left, so without this line a brand-new redeem request left the
  // whole provider block reading 0.00.
  payOutPendingTotal?: number;
  payOutPendingCount?: number;
}

const PROVIDER_LABEL: Record<string, string> = {
  breeze: "Breeze",
  coinflow: "Coinflow",
};

const formatAmount = (n: number, currency: string) =>
  `${currency.toUpperCase()} ${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function Financial() {
  const { activeFilter, fromDate, toDate, refreshKey } = useDashboardStore();
  const [isLoading, setIsLoading] = useState(true);
  const [providers, setProviders] = useState<ProviderRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    paymentTransactionsApi
      .summary({
        // Whole UTC days, matching the KPI cards above this panel.
        dateFrom: utcDayStartISO(fromDate),
        dateTo: utcDayEndISO(toDate),
      })
      .then((res) => {
        if (!cancelled) setProviders(res.providers);
      })
      .catch(() => {
        if (!cancelled) setProviders([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeFilter, fromDate, toDate, refreshKey]);

  const LoadingSkeleton = () => (
    <div className="space-y-10 relative overflow-hidden rounded-xl">
      <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent animate-shimmer pointer-events-none"></div>
      <div className="flex flex-col items-center gap-3 mt-6">
        <div className="h-12 w-12 bg-[#1F242D] rounded-full"></div>
        <div className="h-5 w-32 bg-[#1F242D] rounded"></div>
      </div>
      <div className="space-y-5 pt-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3 px-2">
            <div className="h-4 w-44 bg-[#1F242D] rounded"></div>
            <div className="h-4 w-40 bg-[#1F242D] rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col rounded-xl border border-[#1F242D] shadow-2xl overflow-hidden bg-[#161B23]">
      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <>
          <div className="flex flex-col items-center mb-5 pt-5">
            <div className="rounded-full flex items-center justify-center mb-3 shadow-lg">
              <Image
                src={financedoller}
                alt="coin"
                width={40}
                height={40}
              />
            </div>
            <h2 className="text-white font-bold text-base">Financial</h2>
          </div>

          <div className="flex-1 space-y-5 px-3 pb-4">
            {providers.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-6">
                No provider data
              </p>
            ) : (
              providers.map((p) => {
                const pendingCount = p.payOutPendingCount ?? 0;
                const pendingTotal = p.payOutPendingTotal ?? 0;

                // A zero reads as "nothing happened", so it should not compete
                // for attention with real money. Colour is reserved for
                // non-zero figures; zeros drop to grey.
                const amountTone = (value: number, tone: string) =>
                  value === 0 ? "text-gray-500" : tone;

                return (
                  <div key={p.provider} className="space-y-2.5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-white text-[13px] font-semibold tracking-wide">
                        {PROVIDER_LABEL[p.provider] ?? p.provider}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-gray-600">
                        {p.currency.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-md bg-white/[0.02] px-2.5 py-1.5">
                      <span className="text-gray-300 text-[13px] font-medium tracking-wide">
                        Pay-ins
                        <span className="ml-1.5 text-[11px] text-gray-500">
                          ({p.payInCount})
                        </span>
                      </span>
                      <span
                        className={`text-[13px] font-semibold tabular-nums ${amountTone(p.payInTotal, "text-emerald-400")}`}
                      >
                        {formatAmount(p.payInTotal, p.currency)}
                      </span>
                    </div>

                    <div className="rounded-md bg-white/[0.02] px-2.5 py-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300 text-[13px] font-medium tracking-wide">
                          Pay-outs
                          <span className="ml-1.5 text-[11px] text-gray-500">
                            ({p.payOutCount})
                          </span>
                        </span>
                        <span
                          className={`text-[13px] font-semibold tabular-nums ${amountTone(p.payOutTotal, "text-rose-400")}`}
                        >
                          {formatAmount(p.payOutTotal, p.currency)}
                        </span>
                      </div>

                      {/* Nested under Pay-outs on purpose: "0 paid out, 2
                          pending" read as a contradiction when the two sat side
                          by side as siblings. Pay-outs counts money that has
                          actually left; this is money still owed. */}
                      {pendingCount > 0 && (
                        <div
                          className="mt-1.5 flex items-center justify-between border-l-2 border-amber-400/30 pl-2"
                          title="Redeems requested through this provider that have not settled yet"
                        >
                          <span className="text-[11.5px] font-medium tracking-wide text-gray-400">
                            Awaiting settlement
                            <span className="ml-1.5 text-[11px] text-gray-500">
                              ({pendingCount})
                            </span>
                          </span>
                          <span className="text-[11.5px] font-semibold tabular-nums text-amber-400">
                            {formatAmount(pendingTotal, p.currency)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Matches the User Activity card's footer, and lands on the screen
              these totals are summarised from — the processors' own
              transaction listing, not the dashboard's deposit logs. */}
          <div className="mt-auto flex shrink-0 items-center justify-center border-t border-[#1F242D] px-4 py-2">
            <Link
              href="/settings/payment-processor-management"
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#B93DEB] transition-colors duration-200 hover:text-[#A32DD4]"
            >
              View All
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
