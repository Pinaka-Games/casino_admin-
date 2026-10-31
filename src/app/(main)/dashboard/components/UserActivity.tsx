"use client";

import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { coingold, coingreen, useracivity } from "@/assets/icons";
import { useDashboardStore } from "@/store/dashboard-store";

// Each activity belongs to a different listing — sending them all to the player
// list (the old behaviour) dropped the admin somewhere unrelated to the row.
const ACTIVITY_LINKS: Record<string, string> = {
  REDEEM: "/wallet/withdrawal-listing",
  BUNDLE_PURCHASE: "/wallet/user-deposit-logs",
  MANUAL_DEPOSIT: "/wallet/manual-deposit-listing",
  ACHIEVEMENT_REWARD: "/report/reward-distribution-report",
  DAILY_STREAK: "/report/reward-distribution-report",
};

const activityHref = (source?: string) =>
  (source && ACTIVITY_LINKS[source]) || "/wallet/user-deposit-logs";

/** USD is real money and reads as a price; wallet units are plain counts. */
const formatAmount = (value?: string, currency?: string) => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return value ?? "";
  return currency === "usd"
    ? `$${n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : n.toLocaleString();
};

type Unit = "usd" | "wulfCash" | "wulfCoin";

/**
 * Wallet units are identified by their coin, the same way the player sees
 * them — gold for Gold Coin, green for Sweep Coin. USD is money rather than a
 * wallet unit, so it keeps its "$" and takes no coin.
 */
const UNIT_META: Record<Unit, { icon: typeof coingold | null; label: string }> = {
  wulfCoin: { icon: coingold, label: "Gold Coin" },
  wulfCash: { icon: coingreen, label: "Sweep Coin" },
  usd: { icon: null, label: "USD" },
};

/**
 * A redeem is the one row whose colour is about direction, not currency: the
 * refund leg has to read as a reversal. Everything else is coloured by what it
 * moved, so a figure's colour and its coin always agree.
 */
const lineColor = (item: any, unit: Unit) => {
  if (item?.source === "REDEEM") return item?.amountColor ?? "#E5484D";
  return unit === "wulfCoin" ? "#FFB800" : "#03B739";
};

/**
 * Every unit the row moved, headline first. A reward claim credits Gold Coin
 * and Sweep Coin in one claim and a bundle purchase takes dollars while
 * granting both, so one figure cannot stand for the row.
 */
const amountLines = (item: any): { amount: string; currency: Unit }[] => {
  const extras: { amount: string; currency: Unit }[] = Array.isArray(item?.extras)
    ? item.extras
    : item?.subAmount
      ? [{ amount: item.subAmount, currency: item.subCurrency as Unit }]
      : [];

  return [
    { amount: item?.amount, currency: (item?.currency ?? "wulfCoin") as Unit },
    ...extras,
  ].filter((line) => line.currency && Number(line.amount ?? 0) !== 0);
};

export default function UserActivity() {
  const { stats: data, loading: isLoading } = useDashboardStore();

  // Loading skeleton
  const LoadingSkeleton = () => (
    <div className="space-y-10 relative overflow-hidden rounded-xl h-[400px]">
      <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent animate-shimmer pointer-events-none"></div>
      <div className="flex flex-col items-center gap-3 mt-6">
        <div className="h-12 w-12 bg-[#1F242D] rounded-full"></div>
        <div className="h-5 w-32 bg-[#1F242D] rounded"></div>
      </div>
      <div className="space-y-5 pt-4">
        {[...Array(5)]?.map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3 px-2">
            <div className="h-4 w-44 bg-[#1F242D] rounded"></div>
            <div className="h-4 w-40 bg-[#1F242D] rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* Card Container */}
      <div className="flex h-full flex-col rounded-xl border border-[#1F242D] shadow-2xl overflow-hidden bg-[#161B23]">
        {isLoading && !data ? (
          <LoadingSkeleton />
        ) : (
          <>
            {/* Header with Icon */}
            <div className="flex flex-col items-center mb-4 pt-4">
              <div className=" rounded-full flex items-center justify-center mb-3 shadow-lg">
                <Image
                  src={useracivity}
                  alt="coin"
                  width={32}
                  height={32}
                  className=""
                />
              </div>
              <h2 className="text-white font-bold text-sm">User Activity</h2>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2 pb-4 border-b border-[#1F242D]">
              <div className="text-center">
                <p className="text-lg text-white font-semibold mb-0.5">
                  {data?.activePlayerCount ?? 0}
                </p>
                <p className="text-gray-400 text-[9px] leading-tight">
                  Active Player
                </p>
              </div>
              <div className="text-center">
                <p className="text-lg text-white font-semibold mb-0.5">
                  {data?.newRegisteredCount ?? 0}
                </p>
                <p className="text-gray-400 text-[9px] leading-tight">
                  New Registered
                </p>
              </div>
              <div className="text-center">
                <p className="text-lg text-white font-semibold mb-0.5">
                  {data?.firstDepositUserCount ?? 0}
                </p>
                <p className="text-gray-400 text-[9px] leading-tight">
                  First Deposit User
                </p>
              </div>
            </div>

            {/* Table Header */}
            {/* The header used to share both its fill and its type scale with
                the rows under it, so the table read as six identical bands. It
                now sits a shade darker with brighter, wider-tracked type — the
                labels lead the columns instead of competing with the data. */}
            <div className="grid grid-cols-[1.1fr_1.5fr_1.1fr] items-center border-y border-[#2B3342] bg-[#1B212B] px-4 py-2.5">
              <span className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-gray-300">
                Username
              </span>
              <span className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-gray-300">
                Activity
              </span>
              <span className="text-right text-[9.5px] font-bold uppercase tracking-[0.12em] text-gray-300">
                Amount
              </span>
            </div>

            {/* Activity List */}
            <div className="min-h-[150px] flex-1">
              {(data?.activities || []).length > 0 ? (
                (data?.activities || []).slice(0, 5).map((item: any, i: number) => (
                  <Link
                    key={i}
                    href={activityHref(item?.source)}
                    /* Rows sit on the card's own fill, not the header's, and
                       alternate by a hair so five of them stay separable
                       without five hard rules. */
                    className={`group grid grid-cols-[1.1fr_1.5fr_1.1fr] items-center gap-2 px-4 py-2.5
                    border-b border-[#1F242D]/50 transition-colors duration-150 hover:bg-[#242B36]
                    ${i % 2 === 1 ? "bg-white/[0.015]" : "bg-transparent"}`}
                  >
                    <span className="truncate text-[11px] font-semibold text-gray-100">
                      {item?.username}
                    </span>

                    <span className="truncate text-[10.5px] font-medium text-gray-400 group-hover:text-gray-300">
                      {item?.activity}
                    </span>

                    {/* One line per unit the row moved, right-aligned under
                        the Amount column. The struck list price rides with the
                        headline, when a discount applied — `originalAmount` is
                        the snapshot taken at purchase time, so editing a
                        bundle's discount later cannot rewrite what this player
                        paid. */}
                    <div className="flex flex-col items-end gap-0.5 leading-none">
                      {amountLines(item).map((line, index) => {
                        const meta = UNIT_META[line.currency];
                        return (
                          <div
                            key={`${line.currency}-${index}`}
                            className="flex items-center justify-end gap-1"
                            title={meta?.label}
                          >
                            {index === 0 && item?.originalAmount && (
                              <span className="text-[10px] font-medium tabular-nums text-gray-500 line-through">
                                {formatAmount(item.originalAmount, item?.currency)}
                              </span>
                            )}
                            {meta?.icon && (
                              <Image
                                src={meta.icon}
                                alt={meta.label}
                                width={13}
                                height={13}
                                className="shrink-0"
                              />
                            )}
                            <span
                              /* Secondary units step down a size so the row
                                 still has a headline figure to scan. */
                              className={`tabular-nums font-bold ${
                                index === 0 ? "text-[13px]" : "text-[11px]"
                              }`}
                              style={{ color: lineColor(item, line.currency) }}
                            >
                              {formatAmount(line.amount, line.currency)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="flex h-[200px] flex-col items-center justify-center px-6 text-center text-gray-500">
                  <p className="text-[10px] leading-relaxed">
                    No engagement records localized for this temporal range
                  </p>
                </div>
              )}
            </div>
            {/* View All. A right-aligned link on a thin strip rather than a
                centred block: it was taking a full row's worth of height for
                one word, and this card is the shortest of the three. */}
            <div className="mt-auto flex shrink-0 items-center justify-center border-t border-[#1F242D] px-4 py-2">
              <Link
                href={activityHref(data?.activities?.[0]?.source)}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#B93DEB] transition-colors duration-200 hover:text-[#A32DD4]"
              >
                View All
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}
